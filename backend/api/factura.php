<?php
/**
 * API RESTful para gestión de facturas electrónicas
 * 
 * Este archivo maneja todas las peticiones relacionadas con facturas
 * a través de métodos HTTP (GET, POST, PUT, DELETE)
 */

// Prevenir acceso directo al archivo
if (!defined('ACCESO_API')) {
    header('HTTP/1.1 403 Forbidden');
    echo 'Acceso denegado';
    exit; // Termina la ejecución del script
}

// Habilitar CORS para peticiones desde el frontend
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a las peticiones OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Cargar clases necesarias
//require_once __DIR__ . '../classes/Database.php';
//require_once __DIR__ . '../classes/FacturaProcessor.php';
//require_once __DIR__ . '../classes/Response.php';

require_once '../classes/Database.php';
require_once '../classes/FacturaProcessor.php';
require_once '../classes/Response.php';

// Inicializar procesador de facturas
$facturaProcessor = new FacturaProcessor();

// Determinar la acción basada en el método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Manejar solicitud GET (listar, detallar, o datos agrupados)
            if (isset($_GET['action']) && $_GET['action'] === 'get_pivot_data') {
                // Filtros
                $filters = [];
                $allowedFilters = ['numero_factura', 'fecha_desde', 'fecha_hasta', 'ruc_emisor', 'ruc_receptor', 'serie_numero_guia', 'nombre_receptor', 'search', 'move_type', 'state'];
                
                foreach ($allowedFilters as $filter) {
                    if (isset($_GET[$filter]) && !empty($_GET[$filter])) {
                        $filters[$filter] = trim($_GET[$filter]);
                    }
                }
                
                $groupBy = isset($_GET['groupBy']) ? explode(',', $_GET['groupBy']) : [];
                $measures = isset($_GET['measures']) ? explode(',', $_GET['measures']) : [];
                
                $data = $facturaProcessor->getFacturasAgrupadas($filters, $groupBy, $measures);
                Response::success($data);
            }
            elseif (isset($_GET['id'])) {
                // Obtener detalle de una factura específica
                $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
                if (!$id) {
                    Response::error('ID de factura inválido, debe ser tipo numero', 400);
                }
                
                $factura = $facturaProcessor->getFacturaById($id);
                
                // Extraer detalles del XML para visualización
                $facturaDetails = $facturaProcessor->extractFacturaDetails($factura['contenido_xml']);
                
                // Incluir metadatos de la BD junto con datos procesados del XML
                $result = [
                    'id' => $factura['id'],
                    #'nombre_archivo' => $factura['nombre_archivo'],
                    'fecha_creacion' => $factura['fecha_creacion'],
                    'state' => $factura['state'],
                    'move_type' => $factura['move_type'],
                    'detalles' => $facturaDetails
                ];
                
                Response::success($result);
            } else {
                // Obtener listado de facturas con paginación y filtros
                $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
                $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 20;
                $offset = ($page - 1) * $limit;
                
                // Filtros
                $filters = [];
                $allowedFilters = ['numero_factura', 'fecha_desde', 'fecha_hasta', 'ruc_emisor', 'ruc_receptor', 'serie_numero_guia', 'nombre_receptor', 'search', 'move_type', 'state'];
                
                foreach ($allowedFilters as $filter) {
                    if (isset($_GET[$filter]) && !empty($_GET[$filter])) {
                        $filters[$filter] = trim($_GET[$filter]);
                    }
                }
                
                // Obtener parámetros de ordenamiento
                $sort = isset($_GET['sort']) ? trim($_GET['sort']) : 'fecha_emision';
                $order = isset($_GET['order']) ? strtoupper(trim($_GET['order'])) : 'DESC';
                
                // Validar dirección de ordenamiento
                if (!in_array($order, ['ASC', 'DESC'])) {
                    $order = 'DESC';
                }

                // Obtener facturas y total para paginación
                $facturas = $facturaProcessor->getFacturas($filters, $limit, $offset, $sort, $order);
                $total = $facturaProcessor->countFacturas($filters);
                
                $result = [
                    'facturas' => $facturas,
                    'paginacion' => [
                        'total' => $total,
                        'pagina_actual' => $page,
                        'total_paginas' => ceil($total / $limit),
                        'items_por_pagina' => $limit
                    ]
                ];
                
                Response::success($result);
            }
            break;
            
        case 'POST':
            // Manejar solicitud POST (crear/subir factura o acciones especiales)
            if (isset($_GET['action']) && $_GET['action'] === 'regularizar_facturas') {
                $facturaProcessor->regularizarFacturasHuerfanas();
                Response::success(['mensaje' => 'Guias encontradas para facturas' ], 'Operación exitosa', 200);
            } elseif (isset($_FILES['xml_file'])) {
                // Procesar archivo subido
                $facturaData = $facturaProcessor->processXmlFile($_FILES['xml_file']);
                
                // Guardar en la base de datos
                $facturaId = $facturaProcessor->saveFactura($facturaData);
                
                Response::success([
                    'id' => $facturaId,
                    'mensaje' => 'Factura procesada correctamente'
                ], 'Factura cargada exitosamente', 201);
            } else {
                Response::error('No se ha enviado ningún archivo XML', 400);
            }
            break;
            
        case 'PUT':
            // Actualizar estado de la factura
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (isset($input['id']) && isset($input['state'])) {
                $id = filter_var($input['id'], FILTER_VALIDATE_INT);
                $state = trim($input['state']);
                
                if (!$id) {
                    Response::error('ID de factura inválido', 400);
                }
                
                $facturaProcessor->updateFacturaState($id, $state);
                
                Response::success([
                    'id' => $id,
                    'state' => $state,
                    'mensaje' => 'Estado actualizado correctamente'
                ], 'Estado actualizado');
            } else {
                Response::error('Faltan parámetros requeridos (id, state)', 400);
            }
            break;

        case 'DELETE':
            // Esta funcionalidad podría implementarse si es necesaria
            Response::error('Método no implementado', 501);
            break;
            
        default:
            Response::error('Método HTTP no permitido', 405);
    }
} catch (Exception $e) {
    // Capturar cualquier excepción y devolver error
    $statusCode = ($e instanceof PDOException) ? 500 : 400;
    Response::error($e->getMessage(), $statusCode);
}