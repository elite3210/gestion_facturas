<?php
/**
 * Punto de entrada para la API RESTful de Guías de Remisión
 * 
 * Este archivo simplemente define acceso a la API y la incluye
 */

// Definir constante para permitir acceso desde la API
define('ACCESO_API', true);

// Debugging temporal
error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
    http_response_code(200);
    exit;
}


// Incluir el archivo de la API
require_once './guia.php';