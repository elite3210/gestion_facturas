<?php
/**
 * API RESTful para gestión de guías de remisión electrónicas
 * 
 * Este archivo maneja todas las peticiones relacionadas con guías de remisión
 * a través de métodos HTTP (GET, POST, PUT, DELETE)
 */

// Definir constante para permitir acceso desde la API
define('ACCESO_API', true);


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
require_once '../classes/Database.php';
require_once '../classes/GuiaProcessor.php';
require_once '../classes/Response.php';
require_once '../helpers/xml_helper.php';

// Inicializar procesador de guías
$guiaProcessor = new GuiaProcessor();

// Determinar la acción basada en el método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Manejar solicitud GET (listar o detallar guías)
            if (isset($_GET['id'])) {
                // Obtener detalle de una guía específica
                //$id = intval($_GET['id']);
                $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
                if (!$id) {
                    Response::error('ID de guía inválido, debe ser tipo numero', 400);
                }
                
                $guiaId = $guiaProcessor->getGuiaById($id);
                $xmlContent = hex2bin($guiaId['contenido_xml']);// Convertir de hexadecimal a binario
                //$xmlContent = $GuiaId['contenido_xml'];// Convertir de hexadecimal a binario
                // Extraer detalles del XML para visualización
                //$guiaDetails = $guiaProcessor->extractGuiaDetails($guia['contenido_xml']);
                $guia = new GuiaRemisionXML($xmlContent);//trae el contenido, id y numero_guia de la DB guias_remision 
                $guiaData = $guia->extractGuiaDetails(); // Obtener datos principales de la guía
                
                // Incluir metadatos de la BD junto con datos procesados del XML
                $result = [
                    'id' => $guiaId ['id'],
                    'fecha_registro' => $guiaId ['fecha_registro'],
                    'values' => $guiaData 
                ];
                
                Response::success($result);
            } else {
                // Obtener listado de guías con paginación y filtros
                $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
                $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 20;
                $offset = ($page - 1) * $limit;
                
                // Filtros
                $filters = [];
                $allowedFilters = ['numero_guia', 'fecha_desde', 'fecha_hasta', 'ruc_emisor', 'ruc_receptor', 'numero_factura'];
                
                foreach ($allowedFilters as $filter) {
                    if (isset($_GET[$filter]) && !empty($_GET[$filter])) {
                        $filters[$filter] = trim($_GET[$filter]);
                    }
                }
                
                // Obtener guías y total para paginación
                $guias = $guiaProcessor->getGuias($filters, $limit, $offset);
                $total = $guiaProcessor->countGuias($filters);
                
                $result = [
                    'guias' => $guias,
                    'paginacion' => [
                        'total' => $total,
                        'pagina_actual' => $page,
                        'total_paginas' => ceil($total / $limit),
                        'items_por_pagina' => $limit
                    ]
                ];
                //echo json_encode($result);
                Response::success($result);
            }
            break;
            
        case 'POST':
            // Manejar solicitud POST (crear/subir guía)
            if (isset($_FILES['xml_file'])) {
                // Procesar archivo subido
                $file = $_FILES['xml_file'];
                $xmlContent = file_get_contents($file['tmp_name']);// traer el contenido del archivo XML del directorio temporal
                //$guiaData = $guiaProcessor->processXmlFile($_FILES['xml_file']);
                $guia = new GuiaRemisionXML($xmlContent);//crea una instancia de GuiaRemisionXML con el contenido del XML
                $guiaData = $guia->getMainData(); // Obtener datos principales de la guía
                // Guardar en la base de datos
                $guiaId = $guiaProcessor->saveGuia($guiaData);
                
                Response::success([
                    'id' => $guiaId,
                    'mensaje' => 'Guía de remisión procesada correctamente'
                ], 'Guía cargada exitosamente', 201);
            } else {
                Response::error('No se ha enviado ningún archivo XML', 400);
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