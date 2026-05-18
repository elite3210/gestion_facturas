// api/iaQuery.php
<?php
header('Content-Type: application/json');
require_once '../config/conexion.php';

// Verificar método y autenticación
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

// Obtener la clave API de los encabezados
$headers = getallheaders();
$apiKey = isset($headers['X-API-Key']) ? $headers['X-API-Key'] : '';

// Verificar la clave API (usa una comparación segura)
$validApiKey = 'TU_CLAVE_API_SECRETA'; // Guarda esto en una variable de entorno
if (!hash_equals($validApiKey, $apiKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Clave API no válida']);
    exit;
}

// Obtener datos de la solicitud
$data = json_decode(file_get_contents('php://input'), true);
$query = isset($data['query']) ? $data['query'] : null;

// Validar la consulta
if (!$query) {
    http_response_code(400);
    echo json_encode(['error' => 'No se proporcionó ninguna consulta']);
    exit;
}

try {
    // Conectar a la base de datos
    $db = new Database();
    $conn = $db->getConnection();
    
    // Opción 1: Si envías SQL directamente
    if (isset($data['type']) && $data['type'] === 'sql') {
        $sql = $query;
        // Validar SQL (solo permitir SELECTs)
        if (!validateSqlQuery($sql)) {
            throw new Exception('Consulta SQL no permitida');
        }
    } 
    // Opción 2: Si envías lenguaje natural (necesitarás implementar esta función)
    else {
        $sql = naturalLanguageToSql($query);
    }
    
    // Ejecutar la consulta
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    // Obtener los resultados
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Registrar la consulta (para auditoría)
    logQuery($apiKey, $query, $sql);
    
    // Devolver los resultados como JSON
    echo json_encode([
        'success' => true,
        'data' => $results,
        'sql' => $sql, // Opcional: devolver la SQL generada
        'metadata' => [
            'row_count' => count($results),
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
}

// Funciones auxiliares
function validateSqlQuery($sql) {
    // Implementación igual a la anterior, solo permitir SELECTs
    // ...
    return true;
}

function naturalLanguageToSql($naturalQuery) {
    // Implementación simplificada para convertir lenguaje natural a SQL
    // En una implementación real, podrías usar una API como OpenAI para generar SQL
    
    // Ejemplo muy básico:
    if (stripos($naturalQuery, 'usuarios') !== false && stripos($naturalQuery, 'activos') !== false) {
        return "SELECT * FROM usuarios WHERE estado = 'activo'";
    } 
    
    // Lógica más avanzada aquí...
    
    // Si no podemos interpretar, usamos una consulta segura por defecto
    return "SELECT 'No pude interpretar la consulta' as mensaje";
}

function logQuery($apiKey, $originalQuery, $sqlQuery) {
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'api_key' => substr($apiKey, 0, 8) . '...', // Solo registrar parte de la clave API
        'original_query' => $originalQuery,
        'sql_query' => $sqlQuery,
        'ip' => $_SERVER['REMOTE_ADDR']
    ];
    
    file_put_contents(
        'logs/ia_queries.log', 
        json_encode($logEntry) . PHP_EOL, 
        FILE_APPEND
    );
}
?>