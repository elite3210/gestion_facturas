<?php
/**
 * Endpoint administrativo para gestión de logs
 * URL: /backend/api/adminLogs.php
 * 
 * Permite ver, filtrar y gestionar los logs del sistema
 */

// Verificar acceso administrativo (implementar según tu sistema de autenticación)
// if (!isAdmin()) {
//     header('HTTP/1.1 403 Forbidden');
//     exit('Access denied');
// }

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../classes/Logger.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'view';

// Configuración del logger
$logConfig = [
    'enabled' => true,
    'level' => 'INFO',
    'file_path' => __DIR__ . '/../logs/guias_remision.log',
    'max_file_size' => '10M',
    'max_files' => 5
];

$logger = new Logger($logConfig);

try {
    switch ($action) {
        case 'stats':
            // Obtener estadísticas del logger
            $stats = $logger->getStats();
            echo json_encode([
                'success' => true,
                'data' => $stats
            ]);
            break;
            
        case 'view':
            // Ver logs con filtros
            $logFile = $logConfig['file_path'];
            $lines = (int)($_GET['lines'] ?? 100);
            $level = $_GET['level'] ?? null;
            $search = $_GET['search'] ?? null;
            
            if (!file_exists($logFile)) {
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'logs' => [],
                        'message' => 'No log file found'
                    ]
                ]);
                break;
            }
            
            // Leer las últimas líneas del archivo
            $logs = tailFile($logFile, $lines);
            
            // Filtrar por nivel si se especifica
            if ($level) {
                $logs = array_filter($logs, function($log) use ($level) {
                    return strpos($log, "[$level]") !== false;
                });
            }
            
            // Filtrar por búsqueda si se especifica
            if ($search) {
                $logs = array_filter($logs, function($log) use ($search) {
                    return stripos($log, $search) !== false;
                });
            }
            
            // Parsear logs para mejor visualización
            $parsedLogs = array_map('parseLogLine', $logs);
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'logs' => array_values($parsedLogs),
                    'total_lines' => count($logs),
                    'file_size' => filesize($logFile),
                    'last_modified' => date('Y-m-d H:i:s', filemtime($logFile))
                ]
            ]);
            break;
            
        case 'download':
            // Descargar archivo de log
            $logFile = $logConfig['file_path'];
            $fileNumber = (int)($_GET['file'] ?? 0);
            
            if ($fileNumber > 0) {
                $baseName = pathinfo($logFile, PATHINFO_FILENAME);
                $extension = pathinfo($logFile, PATHINFO_EXTENSION);
                $directory = dirname($logFile);
                $logFile = sprintf("%s/%s.%d.%s", $directory, $baseName, $fileNumber, $extension);
            }
            
            if (!file_exists($logFile)) {
                http_response_code(404);
                echo json_encode(['error' => 'Log file not found']);
                break;
            }
            
            $fileName = basename($logFile);
            header('Content-Type: text/plain');
            header('Content-Disposition: attachment; filename="' . $fileName . '"');
            header('Content-Length: ' . filesize($logFile));
            readfile($logFile);
            break;
            
        case 'clear':
            // Limpiar logs (requiere confirmación)
            if ($method !== 'DELETE') {
                echo json_encode(['error' => 'Use DELETE method to clear logs']);
                break;
            }
            
            $confirm = $_GET['confirm'] ?? false;
            if ($confirm !== 'true') {
                echo json_encode(['error' => 'Add ?confirm=true to clear logs']);
                break;
            }
            
            $logger->clearLogs();
            echo json_encode([
                'success' => true,
                'message' => 'All log files cleared'
            ]);
            break;
            
        case 'files':
            // Listar archivos de log disponibles
            $baseName = pathinfo($logConfig['file_path'], PATHINFO_FILENAME);
            $extension = pathinfo($logConfig['file_path'], PATHINFO_EXTENSION);
            $directory = dirname($logConfig['file_path']);
            
            $files = [];
            
            // Archivo principal
            if (file_exists($logConfig['file_path'])) {
                $files[] = [
                    'name' => basename($logConfig['file_path']),
                    'path' => $logConfig['file_path'],
                    'size' => filesize($logConfig['file_path']),
                    'modified' => filemtime($logConfig['file_path']),
                    'number' => 0
                ];
            }
            
            // Archivos rotados
            for ($i = 1; $i <= $logConfig['max_files']; $i++) {
                $rotatedFile = sprintf("%s/%s.%d.%s", $directory, $baseName, $i, $extension);
                if (file_exists($rotatedFile)) {
                    $files[] = [
                        'name' => basename($rotatedFile),
                        'path' => $rotatedFile,
                        'size' => filesize($rotatedFile),
                        'modified' => filemtime($rotatedFile),
                        'number' => $i
                    ];
                }
            }
            
            echo json_encode([
                'success' => true,
                'data' => $files
            ]);
            break;
            
        default:
            echo json_encode(['error' => 'Invalid action']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Leer las últimas N líneas de un archivo
 */
function tailFile($filename, $lines = 100) {
    $handle = fopen($filename, "r");
    $linecounter = $lines;
    $pos = -2;
    $beginning = false;
    $text = array();
    
    while ($linecounter > 0) {
        $t = " ";
        while ($t != "\n") {
            if (fseek($handle, $pos, SEEK_END) == -1) {
                $beginning = true;
                break;
            }
            $t = fgetc($handle);
            $pos--;
        }
        $linecounter--;
        if ($beginning) {
            rewind($handle);
        }
        $text[$lines - $linecounter - 1] = fgets($handle);
        if ($beginning) break;
    }
    fclose($handle);
    
    return array_reverse($text);
}

/**
 * Parsear una línea de log para extraer componentes
 */
function parseLogLine($line) {
    $pattern = '/\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/';
    
    if (preg_match($pattern, $line, $matches)) {
        $contextPos = strpos($matches[6], '| Context:');
        $uriPos = strpos($matches[6], '| URI:');
        
        $message = $matches[6];
        $context = null;
        $uri = null;
        
        if ($contextPos !== false) {
            $message = trim(substr($matches[6], 0, $contextPos));
            $remaining = substr($matches[6], $contextPos + 10);
            
            if ($uriPos !== false) {
                $contextEnd = strpos($remaining, '| URI:');
                $context = trim(substr($remaining, 0, $contextEnd));
                $uri = trim(substr($remaining, $contextEnd + 6));
            } else {
                $context = trim($remaining);
            }
        } elseif ($uriPos !== false) {
            $message = trim(substr($matches[6], 0, $uriPos - 10));
            $uri = trim(substr($matches[6], $uriPos + 6));
        }
        
        return [
            'timestamp' => $matches[1],
            'level' => $matches[2],
            'pid' => $matches[3],
            'memory' => $matches[4],
            'request' => $matches[5],
            'message' => $message,
            'context' => $context ? json_decode($context, true) : null,
            'uri' => $uri,
            'raw' => trim($line)
        ];
    }
    
    return [
        'timestamp' => null,
        'level' => 'UNKNOWN',
        'pid' => null,
        'memory' => null,
        'request' => null,
        'message' => trim($line),
        'context' => null,
        'uri' => null,
        'raw' => trim($line)
    ];
}
?>