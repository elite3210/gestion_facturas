<?php
/**
 * Script para descargar facturas electrónicas en formato PDF
 * URL: https://www.heinzsport.com/facturacion/backend/api/facturaDownload.php?id=118
 */

// Incluir configuración de base de datos
// =======================
// 📄 Lógica de descarga
// =======================

//require_once '../config/conexion.php';
require_once '../classes/Database.php';  // CAMBIO: Ruta corregida (quitar / inicial)

// Incluir generador de PDF para facturas
require_once '../includes/factura_pdf_generator.php';

// =======================
// 🔧 Manejo de CORS
// =======================
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    exit(0);
}

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/pdf");


// Verificar si se proporciona un ID
if (!isset($_GET['id']) || empty($_GET['id'])) {
    header('HTTP/1.1 400 Bad Request');
    echo 'Se requiere el ID de la factura';
    exit;
}

try {
    // Obtener ID y validar que sea numérico
    $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
    
    if (!$id) {
        header('HTTP/1.1 400 Bad Request');
        echo 'ID de factura inválido';
        exit;
    }
    
    // Conectar a la base de datos
    //$database = new Database();
    $db = Database::getInstance();
    
    // Obtener la factura completa
    $query = "SELECT id, numero_factura, contenido_xml, nombre_receptor FROM facturas_electronicas WHERE id = :id";
    $params = [':id' => $id];//funcionó
    //$stmt = $db->prepare($query);
    //$stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt = $db->executeQuery($query, $params);
    
    $factura = $stmt->fetch();
    
    if (!$factura) {
        header('HTTP/1.1 404 Not Found');
        echo 'Factura no encontrada';
        exit;
    }
    
    // Verificar que el contenido XML no esté vacío
    if (empty($factura['contenido_xml'])) {
        header('HTTP/1.1 422 Unprocessable Entity');
        echo 'La factura no tiene contenido XML válido';
        exit;
    }
    
    // Inicializar generador de PDF (pasar array completo)
    $generator = new FacturaElectronicaPDF($factura);

    // Verificar que el generador se creó correctamente  
        
    // Generar PDF
    $pdfResult = $generator->generate();
    
    // Decodificar PDF desde base64
    $pdfContent = base64_decode($pdfResult);
    
    // Verificar que el PDF se generó correctamente
    if (!$pdfContent) {
        throw new Exception('Error al decodificar el contenido PDF');
    }

    // Limpiar cualquier salida previa
    if (ob_get_length()) ob_clean();
    
    // Limpiar el nombre del archivo para evitar caracteres problemáticos
    $fileName = 'Factura_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $factura['numero_factura']) . '.pdf';
    
    // Cabeceras de respuesta
    // Configurar headers para descarga
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $fileName . '"');
    header('Content-Length: ' . strlen($pdfContent));
    header('Cache-Control: no-cache, must-revalidate');
    header('Pragma: no-cache');
    
    // Enviar contenido
    echo $pdfContent;
    
} catch (PDOException $e) {
    // Error específico de base de datos
    error_log('Error de base de datos en descarga de factura: ' . $e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    echo 'Error de base de datos: No se pudo acceder a la información de la factura';
} catch (Exception $e) {
    // Error general
    error_log('Error en descarga de factura: ' . $e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Error al generar el PDF: ' . $e->getMessage()]);
    echo 'Error al generar PDF: ' . $e->getMessage();
}
?>