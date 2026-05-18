<?php
/**
 * Punto de entrada para la API RESTful
 * 
 * Este archivo simplemente define acceso a la API y la incluye
 */

// Definir constante para permitir acceso desde la API
define('ACCESO_API', true);

// Debugging temporal
error_reporting(E_ALL);
ini_set('display_errors', 1);
echo "Debug: Iniciando API...\n";

// Incluir el archivo de la API
//require_once __DIR__ . '/backend/api/factura.php';
require_once './factura.php';