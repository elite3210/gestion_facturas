<?php
/**
 * AdminLogs API - Versión simplificada para diagnóstico
 */

// Headers CORS primero
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Función para enviar respuesta JSON
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

$action = $_GET['action'] ?? 'test';

try {
    switch ($action) {
        case 'test':
            sendResponse([
                'success' => true,
                'message' => 'AdminLogs API is working',
                'timestamp' => date('Y-m-d H:i:s'),
                'php_version' => phpversion(),
                'action' => $action,
                'get_params' => $_GET,
                'current_dir' => __DIR__,
                'log_file_path' => __DIR__ . '/../logs/guias_remision.log',
                'log_file_exists' => file_exists(__DIR__ . '/../logs/guias_remision.log'),
                'log_dir_exists' => is_dir(__DIR__ . '/../logs/'),
                'log_dir_writable' => is_writable(__DIR__ . '/../logs/')
            ]);
            break;

        case 'stats':
            $logFile = __DIR__ . '/../logs/guias_remision.log';
            
            if (!file_exists($logFile)) {
                sendResponse([
                    'success' => true,
                    'data' => [
                        'enabled' => false,
                        'file_exists' => false,
                        'file_size_formatted' => '0B',
                        'message' => 'Log file not found at: ' . $logFile
                    ]
                ]);
            }
            
            $fileSize = filesize($logFile);
            $fileSizeFormatted = formatBytes($fileSize);
            
            sendResponse([
                'success' => true,
                'data' => [
                    'enabled' => true,
                    'file_exists' => true,
                    'file_size' => $fileSize,
                    'file_size_formatted' => $fileSizeFormatted,
                    'current_level' => 'INFO',
                    'log_file' => $logFile,
                    'directory_writable' => is_writable(dirname($logFile)),
                    'last_modified' => date('Y-m-d H:i:s', filemtime($logFile))
                ]
            ]);
            break;

        case 'view':
            $logFile = __DIR__ . '/../logs/guias_remision.log';
            $lines = (int)($_GET['lines'] ?? 100);
            $level = $_GET['level'] ?? null;
            $search = $_GET['search'] ?? null;
            
            if (!file_exists($logFile)) {
                sendResponse([
                    'success' => true,
                    'data' => [
                        'logs' => [],
                        'total_lines' => 0,
                        'file_size' => 0,
                        'last_modified' => date('Y-m-d H:i:s'),
                        'message' => 'Log file not found'
                    ]
                ]);
            }
            
            // Leer archivo completo
            $fileContent = file_get_contents($logFile);
            $allLines = explode("\n", $fileContent);
            $allLines = array_filter($allLines, function($line) {
                return !empty(trim($line));
            });
            
            // Tomar las últimas líneas
            $logs = array_slice($allLines, -$lines);
            
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
            
            // Parsear logs
            $parsedLogs = [];
            foreach ($logs as $log) {
                $parsedLogs[] = parseLogLine($log);
            }
            
            sendResponse([
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
            $logFile = __DIR__ . '/../logs/guias_remision.log';
            
            if (!file_exists($logFile)) {
                sendResponse(['error' => 'Log file not found'], 404);
            }
            
            $fileName = basename($logFile);
            header('Content-Type: text/plain');
            header('Content-Disposition: attachment; filename="' . $fileName . '"');
            header('Content-Length: ' . filesize($logFile));
            readfile($logFile);
            exit;
            break;

        default:
            sendResponse(['error' => 'Invalid action: ' . $action], 400);
    }

} catch (Exception $e) {
    sendResponse([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], 500);
}

/**
 * Formatear bytes
 */
function formatBytes($bytes) {
    if ($bytes === 0) return '0B';
    $k = 1024;
    $sizes = ['B', 'KB', 'MB', 'GB'];
    $i = floor(log($bytes) / log($k));
    return round($bytes / pow($k, $i), 2) . $sizes[$i];
}

/**
 * Parsear línea de log
 */
function parseLogLine($line) {
    if (empty(trim($line))) {
        return [
            'timestamp' => null,
            'level' => 'UNKNOWN',
            'message' => '',
            'raw' => ''
        ];
    }

    // Patrón: [timestamp] [level] [PID:xxx] [MEM:xxx] [method:ip] message
    $pattern = '/\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)/';
    
    if (preg_match($pattern, $line, $matches)) {
        $message = $matches[6];
        $context = null;
        $uri = null;
        
        // Extraer context y URI si existen
        if (strpos($message, '| Context:') !== false) {
            $parts = explode('| Context:', $message);
            $message = trim($parts[0]);
            
            if (isset($parts[1])) {
                $contextPart = $parts[1];
                if (strpos($contextPart, '| URI:') !== false) {
                    $contextParts = explode('| URI:', $contextPart);
                    $context = trim($contextParts[0]);
                    $uri = trim($contextParts[1] ?? '');
                } else {
                    $context = trim($contextPart);
                }
            }
        } elseif (strpos($message, '| URI:') !== false) {
            $parts = explode('| URI:', $message);
            $message = trim($parts[0]);
            $uri = trim($parts[1] ?? '');
        }
        
        return [
            'timestamp' => $matches[1],
            'level' => $matches[2],
            'pid' => $matches[3],
            'memory' => $matches[4],
            'request' => $matches[5],
            'message' => $message,
            'context' => $context,
            'uri' => $uri,
            'raw' => trim($line)
        ];
    }
    
    return [
        'timestamp' => null,
        'level' => 'UNKNOWN',
        'message' => trim($line),
        'context' => null,
        'uri' => null,
        'raw' => trim($line)
    ];
}
?>