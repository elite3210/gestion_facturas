<?php
/**
 * Clase Logger - Sistema de logging para guías de remisión
 * 
 * Implementa un sistema completo de logging con rotación automática,
 * diferentes niveles y formato estructurado
 */
class Logger {
    
    // Niveles de log (valores numéricos para comparación)
    const DEBUG = 1;
    const INFO = 2;
    const WARNING = 3;
    const ERROR = 4;
    
    // Nombres de niveles para mostrar
    const LEVEL_NAMES = [
        1 => 'DEBUG',
        2 => 'INFO',
        3 => 'WARNING',
        4 => 'ERROR'
    ];
    
    private $logFile;
    private $maxFileSize;
    private $maxFiles;
    private $currentLevel;
    private $enabled;
    private $logDirectory;
    
    /**
     * Constructor
     * 
     * @param array $config Configuración del logger
     */
    public function __construct($config = []) {
        // Configuración por defecto
        $defaultConfig = [
            'enabled' => true,
            'level' => 'INFO',
            'file_path' => './logs/guias_remision.log',
            //'file_path' => __DIR__ . '/../logs/guias_remision.log',
            'max_file_size' => '10M',
            'max_files' => 5
        ];
        
        $config = array_merge($defaultConfig, $config);
        
        $this->enabled = $config['enabled'];
        $this->logFile = $config['file_path'];
        $this->maxFileSize = $this->parseSize($config['max_file_size']);
        $this->maxFiles = $config['max_files'];
        $this->currentLevel = $this->parseLevel($config['level']);
        
        // Crear directorio de logs si no existe
        $this->logDirectory = dirname($this->logFile);
        if (!is_dir($this->logDirectory)) {
            mkdir($this->logDirectory, 0755, true);
        }
        
        // Verificar rotación en cada inicialización
        $this->checkRotation();
    }
    
    /**
     * Log nivel DEBUG
     * 
     * @param string $message Mensaje a loggear
     * @param array $context Contexto adicional
     */
    public function debug($message, $context = []) {
        $this->log(self::DEBUG, $message, $context);
    }
    
    /**
     * Log nivel INFO
     * 
     * @param string $message Mensaje a loggear
     * @param array $context Contexto adicional
     */
    public function info($message, $context = []) {
        $this->log(self::INFO, $message, $context);
    }
    
    /**
     * Log nivel WARNING
     * 
     * @param string $message Mensaje a loggear
     * @param array $context Contexto adicional
     */
    public function warning($message, $context = []) {
        $this->log(self::WARNING, $message, $context);
    }
    
    /**
     * Log nivel ERROR
     * 
     * @param string $message Mensaje a loggear
     * @param array $context Contexto adicional
     */
    public function error($message, $context = []) {
        $this->log(self::ERROR, $message, $context);
    }
    
    /**
     * Método principal de logging
     * 
     * @param int $level Nivel del log
     * @param string $message Mensaje
     * @param array $context Contexto adicional
     */
    private function log($level, $message, $context = []) {
        // Si está deshabilitado o el nivel es menor al configurado, no loggear
        if (!$this->enabled || $level < $this->currentLevel) {
            return;
        }
        
        // Formatear el mensaje
        $formattedMessage = $this->formatMessage($level, $message, $context);
        
        // Escribir al archivo
        $this->writeToFile($formattedMessage);
    }
    
    /**
     * Formatear mensaje de log
     * 
     * @param int $level Nivel del log
     * @param string $message Mensaje
     * @param array $context Contexto
     * @return string Mensaje formateado
     */
    private function formatMessage($level, $message, $context) {
        //$timestamp = date('Y-m-d H:i:s');
        $fecha = new DateTime('now', new DateTimeZone('America/Lima'));
        $timestamp = $fecha->format('Y-m-d H:i:s');
        $levelName = self::LEVEL_NAMES[$level];
        
        // Información adicional del contexto
        $pid = getmypid();
        $memory = round((memory_get_usage(true)/1024)/1024, 2);// convertir a MB
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';// IP del cliente, o 'CLI' si no es una petición HTTP
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $uri = $_SERVER['REQUEST_URI'] ?? 'N/A';
        
        // Construir el mensaje base
        $logMessage = sprintf(
            "[%s] [%s] [PID:%d] [MEM:%sMB] [%s:%s] %s",
            $timestamp,
            $levelName,
            $pid,
            $memory,
            $method,
            $ip,
            $message
        );
        
        // Agregar contexto si existe
        if (!empty($context)) {
            $contextString = json_encode($context, JSON_UNESCAPED_UNICODE);
            $logMessage .= " | Context: " . $contextString;
        }
        
        // Agregar información de la petición HTTP si existe
        if ($method !== 'CLI' && $uri !== 'N/A') {
            $logMessage .= " | URI: " . $uri;
        }
        
        return $logMessage . PHP_EOL;
    }
    
    /**
     * Escribir mensaje al archivo de log
     * 
     * @param string $message Mensaje formateado
     */
    private function writeToFile($message) {
        try {
            // Verificar rotación antes de escribir
            $this->checkRotation();
            
            // Escribir con bloqueo para concurrencia
            file_put_contents($this->logFile, $message, FILE_APPEND | LOCK_EX);
            
        } catch (Exception $e) {
            // En caso de error escribiendo logs, usar error_log de PHP
            error_log("Logger Error: " . $e->getMessage());
        }
    }
    
    /**
     * Verificar si es necesario rotar el archivo de log
     */
    private function checkRotation() {
        if (!file_exists($this->logFile)) {
            return;
        }
        
        $fileSize = filesize($this->logFile);
        
        if ($fileSize >= $this->maxFileSize) {
            $this->rotateLogFile();
        }
    }
    
    /**
     * Realizar rotación del archivo de log
     */
    private function rotateLogFile() {
        $baseName = pathinfo($this->logFile, PATHINFO_FILENAME);
        $extension = pathinfo($this->logFile, PATHINFO_EXTENSION);
        $directory = dirname($this->logFile);
        
        // Eliminar el archivo más antiguo si existe
        $oldestFile = sprintf(
            "%s/%s.%d.%s",
            $directory,
            $baseName,
            $this->maxFiles,
            $extension
        );
        
        if (file_exists($oldestFile)) {
            unlink($oldestFile);
        }
        
        // Rotar archivos existentes
        for ($i = $this->maxFiles - 1; $i >= 1; $i--) {
            $currentFile = sprintf(
                "%s/%s.%d.%s",
                $directory,
                $baseName,
                $i,
                $extension
            );
            
            $nextFile = sprintf(
                "%s/%s.%d.%s",
                $directory,
                $baseName,
                $i + 1,
                $extension
            );
            
            if (file_exists($currentFile)) {
                rename($currentFile, $nextFile);
            }
        }
        
        // Rotar el archivo actual
        $rotatedFile = sprintf(
            "%s/%s.1.%s",
            $directory,
            $baseName,
            $extension
        );
        
        rename($this->logFile, $rotatedFile);
        
        // Log de rotación en el nuevo archivo
        $this->info("Log file rotated", [
            'previous_file' => $rotatedFile,
            'max_size_reached' => $this->formatBytes($this->maxFileSize)
        ]);
    }
    
    /**
     * Convertir string de tamaño a bytes
     * 
     * @param string $size Tamaño (ej: "10M", "5G")
     * @return int Tamaño en bytes
     */
    private function parseSize($size) {
        $units = ['B' => 1, 'K' => 1024, 'M' => 1048576, 'G' => 1073741824];
        $size = strtoupper(trim($size));
        
        if (is_numeric($size)) {
            return (int)$size;
        }
        
        $unit = substr($size, -1);
        $value = (int)substr($size, 0, -1);
        
        return isset($units[$unit]) ? $value * $units[$unit] : $value;
    }
    
    /**
     * Convertir string de nivel a constante numérica
     * 
     * @param string $level Nivel (ej: "INFO", "DEBUG")
     * @return int Nivel numérico
     */
    private function parseLevel($level) {
        $levels = [
            'DEBUG' => self::DEBUG,
            'INFO' => self::INFO,
            'WARNING' => self::WARNING,
            'ERROR' => self::ERROR
        ];
        
        return $levels[strtoupper($level)] ?? self::INFO;
    }
    
    /**
     * Formatear bytes para mostrar
     * 
     * @param int $bytes Bytes
     * @return string Tamaño formateado
     */
    private function formatBytes($bytes) {
        $units = ['B', 'KB', 'MB', 'GB'];
        $index = 0;
        
        while ($bytes >= 1024 && $index < count($units) - 1) {
            $bytes /= 1024;
            $index++;
        }
        
        return round($bytes, 2) . $units[$index];
    }
    
    /**
     * Obtener estadísticas del logger
     * 
     * @return array Estadísticas
     */
    public function getStats() {
        $stats = [
            'enabled' => $this->enabled,
            'current_level' => array_search($this->currentLevel, array_flip(self::LEVEL_NAMES)),
            'log_file' => $this->logFile,
            'file_exists' => file_exists($this->logFile),
            'file_size' => file_exists($this->logFile) ? filesize($this->logFile) : 0,
            'file_size_formatted' => file_exists($this->logFile) ? $this->formatBytes(filesize($this->logFile)) : '0B',
            'max_file_size' => $this->formatBytes($this->maxFileSize),
            'max_files' => $this->maxFiles,
            'directory_writable' => is_writable($this->logDirectory)
        ];
        
        return $stats;
    }
    
    /**
     * Limpiar todos los archivos de log
     */
    public function clearLogs() {
        $baseName = pathinfo($this->logFile, PATHINFO_FILENAME);
        $extension = pathinfo($this->logFile, PATHINFO_EXTENSION);
        $directory = dirname($this->logFile);
        
        // Eliminar archivo principal
        if (file_exists($this->logFile)) {
            unlink($this->logFile);
        }
        
        // Eliminar archivos rotados
        for ($i = 1; $i <= $this->maxFiles; $i++) {
            $rotatedFile = sprintf(
                "%s/%s.%d.%s",
                $directory,
                $baseName,
                $i,
                $extension
            );
            
            if (file_exists($rotatedFile)) {
                unlink($rotatedFile);
            }
        }
        
        $this->info("All log files cleared");
    }
}
?>