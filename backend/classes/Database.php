<?php
/**
 * Clase Database - Gestiona la conexión a la base de datos
 * 
 * Implementa el patrón Singleton para asegurar una única conexión
 */
class Database {
    private static $instance = null;
    private $connection;
    
    /**
     * Constructor privado para prevenir instanciación directa
     */
    private function __construct() {
        $config = require_once __DIR__ . '../config/configFactura.php';
        $dbConfig = $config['db'];
        
        try {
            #$dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
            $dsn = "pgsql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['dbname']};charset={$dbConfig['charset']}";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ];
            
            $this->connection = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $options);
        } catch (PDOException $e) {
            throw new Exception("Error de conexión a la base de datos: " . $e->getMessage());
        }
    }
    
    /**
     * Obtener instancia única de la clase
     */
    public static function getInstance() {
        if (self::$instance === null) {//si no hay instancia, crear una nueva
            self::$instance = new self();// crear una nueva instancia
        }
        return self::$instance;
    }
    
    /**
     * Obtener conexión PDO
     */
    public function getConnection() {
        return $this->connection;
    }
    
    /**
     * Ejecutar consulta con prepared statement
     * 
     * @param string $query Consulta SQL
     * @param array $params Parámetros para la consulta
     * @return PDOStatement
     */
    public function executeQuery($query, $params = []) {
        try {
            $stmt = $this->connection->prepare($query);// preparar la consulta
            $stmt->execute($params);// ejecutar la consulta con los parámetros
            return $stmt;// devolver el statement
        } catch (PDOException $e) {
            throw new Exception("Error al ejecutar consulta: " . $e->getMessage());
        }
    }
}