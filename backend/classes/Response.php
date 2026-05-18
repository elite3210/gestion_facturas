<?php

/**
 * Clase Response - Maneja la salida de la API en formato JSON
 * crear los todos los archivos , backend y frontend , para gestionar las guias remisión electrónicas, similar a los archivos para las facturas electrónicas. he probado la aplicación para gestionar las factura electrónicas y funciona muy bien, cumple mis requerimientos y me gustó  ahora quiero una aplicación similar para las guias de remisión, la que hicimos no me gusta.
 */
class Response
{
    /**
     * Envía respuesta exitosa
     * 
     * @param mixed $data Datos a devolver
     * @param string $message Mensaje descriptivo
     * @param int $statusCode Código HTTP
     */
    public static function success($data = null, $message = 'Operación exitosa', $statusCode = 200)
    {
        self::sendResponse(true, $message, $data, $statusCode);
    }

    /**
     * Envía respuesta de error
     * 
     * @param string $message Mensaje descriptivo del error
     * @param int $statusCode Código HTTP
     * @param mixed $data Datos adicionales sobre el error
     */
    public static function error($message = 'Error en la operación', $statusCode = 400, $data = null)
    {
        self::sendResponse(false, $message, $data, $statusCode);
    }

    /**
     * Método principal para enviar respuesta formateada
     */
    private static function sendResponse($success, $message, $data, $statusCode)
    {
        // Cabeceras CORS necesarias
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");


        // Establecer cabeceras
        header('Content-Type: application/json');
        http_response_code($statusCode);

        // Preparar respuesta
        $response = [
            'success' => $success,
            'message' => $message
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        // Enviar respuesta
        echo json_encode($response);
        exit;
    }
}
