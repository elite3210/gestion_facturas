<?php
$host = '145.79.6.153';
$db = 'heinz_db';
$user = 'postgres';
$pass = 'Onajudnameli12?';

$dsn = "pgsql:host=$host;port=5432;dbname=$db;";
try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $stmt = $pdo->query("SELECT numero_factura, move_type, nombre_emisor, nombre_receptor FROM facturas_electronicas WHERE move_type='in_invoice' LIMIT 5");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($rows);
} catch (PDOException $e) {
    echo $e->getMessage();
}
