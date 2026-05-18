<?php
/**
 * nombre del archivo: pdfDownload.php
 * Script para descargar guías de remisión en formato PDF
 */

// Incluir configuración de base de datos
//require_once '../config/conexion.php';  // CAMBIO: Ruta corregida (quitar / inicial)
require_once '../classes/Database.php';  // CAMBIO: Ruta corregida (quitar / inicial)

// Incluir generador de PDF
require_once '../includes/pdf_generator.php';

// Verificar si se proporciona un ID
if (!isset($_GET['id']) || empty($_GET['id'])) {
    header('HTTP/1.1 400 Bad Request');
    echo 'Se requiere el ID de la guía';
    exit;
}

try {
    // Obtener ID y validar que sea numérico
    $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
    
    if (!$id) {
        header('HTTP/1.1 400 Bad Request');
        echo 'ID de guía inválido';
        exit;
    }
    
    // Conectar a la base de datos
    //$database = new Database();
    //$db = $database->getConnection();
    $db = Database::getInstance();
    
    // CAMBIO: Nombre de tabla actualizado para PostgreSQL
    $query = "SELECT id, numero_guia, contenido_xml FROM guias_remision WHERE id = :id";
    //$query = "SELECT id, numero_guia, contenido_xml FROM guias_remision WHERE id = ?";
    $params = [':id' => $id];//funcionó
    //$params = [':id',$id];//no funcionó
    //$params = [':id', $id, PDO::PARAM_INT];//no funcionó
    //$stmt = $db->prepare($query);
    //$stmt->bindParam(':id', $id, PDO::PARAM_INT);
    //$stmt->execute();
    $stmt = $db->executeQuery($query, $params);
    $guia = $stmt->fetch();
    
    if (!$guia) {
        header('HTTP/1.1 404 Not Found');
        echo 'Guía no encontrada';
        exit;
    }
    
    // Verificar que el contenido XML no esté vacío
    if (empty($guia['contenido_xml'])) {
        header('HTTP/1.1 422 Unprocessable Entity');
        echo 'La guía no tiene contenido XML válido';
        exit;
    }
    
    // Pasar array completo:
    $generator = new GuiaRemisionPDF($guia);//trae el contenido, id y numero_guia de la DB guias_remision 
    
    // Generar PDF
    $pdfContent = base64_decode($generator->generate());
    
    // Verificar que el PDF se generó correctamente
    if (!$pdfContent) {
        throw new Exception('Error al decodificar el contenido PDF');
    }
    
    // Limpiar el nombre del archivo para evitar caracteres problemáticos
    $fileName = 'Guia_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $guia['numero_guia']) . '.pdf';
    
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
    error_log('Error de base de datos en descarga de guía: ' . $e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    echo 'Error de base de datos: No se pudo acceder a la información de la guía';
} catch (Exception $e) {
    // Error general
    error_log('Error en descarga de guía: ' . $e->getMessage());
    header('HTTP/1.1 500 Internal Server Error');
    echo 'Error al generar PDF: ' . $e->getMessage();
}
?>