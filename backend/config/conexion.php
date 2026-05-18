<?php
class Database {
    private $host = 'localhost';
    private $db_name = 'heinz_db';                    // CAMBIO: Nueva base de datos
    private $username = 'postgres';                   // CAMBIO: Usuario PostgreSQL
    private $password = 'Onajudnameli12?';           // CAMBIO: Contraseña PostgreSQL
    private $port = 5432;                            // NUEVO: Puerto PostgreSQL
    private $conn;

    public function getConnection() {
        // CAMBIO: DSN de MySQL a PostgreSQL (sin charset)
        $dsn = "pgsql:host=" . $this->host . ";port=" . $this->port . ";dbname=" . $this->db_name;
        $options = [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    ];
        $this->conn = null;
        try {
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch(PDOException $e) {
            echo "Error de conexión: " . $e->getMessage();
        }
        return $this->conn;
    }
}
?>
