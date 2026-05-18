<?php
// Configuración de la base de datos y otros parámetros
return [
    'db' => [
        //'host' => 'localhost',           // IP de tu VPS
        'host' => '145.79.6.153',           // IP de VPS Hostinger
        'dbname' => 'heinz_db',             // Nueva base de datos PostgreSQL
        'username' => 'postgres',           // Usuario PostgreSQL
        'password' => 'Onajudnameli12?',    // Contraseña PostgreSQL
        'charset' => 'utf8',                // PostgreSQL usa utf8 (no utf8mb4)
        'port' => 5432,                     // Puerto PostgreSQL (añadido)
        'driver' => 'pgsql'                 // Driver PostgreSQL (añadido)
    ],
    'app' => [
        'name' => 'Sistema de Gestión de Facturas Electrónicas',
        'version' => '1.0.0',
        'debug' => true
    ]
];