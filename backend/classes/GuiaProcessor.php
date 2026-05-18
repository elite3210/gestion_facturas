<?php

/**
 * Clase GuiaProcessor con sistema de logging integrado
 * 
 * Ejemplo de cómo integrar el sistema de logging en las operaciones del procesador
 */

// Incluir el logger
require_once 'Logger.php';


class GuiaProcessor
{
    private $db;
    private $logger;
    private $namespaces = [
        'cbc' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'cac' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'ext' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'ubl' => 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
        'ds' => 'http://www.w3.org/2000/09/xmldsig#',
        'sac' => 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1'
    ];

    /**
     * Constructor con inicialización del logger
     */
    public function __construct()
    {
        $this->db = Database::getInstance();
        
        // Inicializar logger con configuración
        $logConfig = [
            'enabled' => true,
            'level' => 'INFO',
            'file_path' => __DIR__ . '/../logs/guias_remision.log',
            'max_file_size' => '10M',
            'max_files' => 5
        ];
        
        $this->logger = new Logger($logConfig);
        
        // Log de inicialización
        $this->logger->info("i1>GuiaProcessor initialized", [
            'memory_usage' => memory_get_usage(true),
            'database_connection' => 'established'
        ]);
    }

    /**
     * Procesar archivo XML de guía de remisión con logging
     */
    public function processXmlFile($file)
    {
        // Validar que el archivo sea un array y tenga las claves esperadas
        $this->logger->info("i2>Starting XML file processing", [
            'filename' => $file['name'],
            'size' => $file['size'],
            'type' => $file['type']
        ]);
        // Validar estructura del archivo
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errorMessage = $this->getUploadErrorMessage($file['error']);
            $this->logger->error("e1>File upload error", [
                'error_code' => $file['error'],
                'error_message' => $errorMessage,
                'filename' => $file['name']
            ]);
            throw new Exception('Error al subir el archivo: ' . $errorMessage);
        }

        // Validar tipo de archivo
        $finfo = finfo_open(FILEINFO_MIME_TYPE);// Obtener tipo MIME del archivo
        $mime = finfo_file($finfo, $file['tmp_name']);// Leer el tipo MIME del archivo subido
        finfo_close($finfo);

        if (!in_array($mime, ['application/xml', 'text/xml'])) {
            $this->logger->warning("w1>Invalid file type uploaded", [
                'expected' => ['application/xml', 'text/xml'],
                'received' => $mime,
                'filename' => $file['name']
            ]);
            throw new Exception('El archivo debe ser un XML válido');
        }

        // Cargar y procesar XML
        $xmlContent = file_get_contents($file['tmp_name']);
        if (!$xmlContent) {
            $this->logger->error("e2>Could not read file content", [
                'filename' => $file['name'],
                'tmp_name' => $file['tmp_name']
            ]);
            throw new Exception('No se pudo leer el contenido del archivo');
        }

        $this->logger->debug("d1>XML content loaded successfully", [
            'content_length' => strlen($xmlContent),
            'filename' => $file['name']
        ]);

        return $this->processXmlContent($xmlContent);
    }

    /**
     * Procesar contenido XML con logging detallado
     */
    public function processXmlContent($xmlContent)
    {
        $this->logger->debug("d2>Starting XML content processing", [
            'content_size' => strlen($xmlContent)
        ]);

        libxml_use_internal_errors(true);
        // Crear DOMDocument y cargar el XML
        $dom = new DOMDocument();
        if (!$dom->loadXML($xmlContent)) {
            $errors = libxml_get_errors();
            $errorMessages = array_map(function($error) {
                return trim($error->message);
            }, $errors);
            
            $this->logger->error("e3>XML parsing failed", [
                'errors' => $errorMessages,
                'line_number' => $errors[0]->line ?? 'unknown'
            ]);
            
            libxml_clear_errors();
            throw new Exception('XML inválido: ' . $errors[0]->message);
        }

        $xpath = new DOMXPath($dom);// Crear objeto DOMXPath para consultas XPath

        // Registrar namespaces
        foreach ($this->namespaces as $prefix => $uri) {
            $xpath->registerNamespace($prefix, $uri);
        }

        $this->logger->debug("d3>XML parsed successfully, extracting data");

        // Extraer datos principales
        $guiaData = [
            'contenido_xml' => bin2hex($xmlContent), // ✅ CONVERTIR A HEXADECIMAL para PostgreSQL
            'numero_guia' => $this->getXPathValue($xpath,'//*[local-name()="DespatchAdvice"]/cbc:ID'),
            //'fecha_emision' => $this->getXPathValue($xpath, '//cbc:IssueDate'),
            'fecha_emision' => $this->getXPathValue($xpath, 'gg'),
            'ruc_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cbc:ID'),
            'nombre_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cbc:RegistrationName'),
            'ruc_receptor' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cbc:ID'),
            'nombre_receptor' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cbc:RegistrationName'),
            'motivo_traslado' => $this->getXPathValue($xpath, '//cac:Shipment//cbc:HandlingCode'),
            'peso_bruto' => $this->getXPathValue($xpath, '//cac:Shipment//cbc:GrossWeightMeasure'),
            'punto_partida' => $this->getXPathValue($xpath, empty('//cac:Shipment//cac:OriginAddress//cbc:Line') ? '//cac:Shipment//cac:OriginAddress//cbc:Line':'//cac:DespatchAddress/cac:AddressLine/cbc:Line'),
            'punto_llegada' => $this->getXPathValue($xpath, '//cac:Shipment//cac:DeliveryAddress//cbc:Line'),
            'fecha_traslado' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cac:TransitPeriod//cbc:StartDate'),
            'numero_factura' => str_replace(' ','', $this->getXPathValue($xpath, '//cac:AdditionalDocumentReference//cbc:ID'))
        ];

        // Log de datos extraídos
        $this->logger->info("i3>XML data extracted successfully", [
            'numero_guia' => $guiaData['numero_guia'],
            'ruc_emisor' => $guiaData['ruc_emisor'],
            'ruc_receptor' => $guiaData['ruc_receptor'],
            'motivo_traslado' => $guiaData['motivo_traslado'],
            'peso_bruto' => $guiaData['peso_bruto']
        ]);

        // Validar datos mínimos requeridos
        $requiredFields = ['numero_guia', 'fecha_emision', 'ruc_emisor', 'ruc_receptor'];
        $missingFields = [];

        foreach ($requiredFields as $field) {
            if (empty($guiaData[$field])) {
                $missingFields[] = $field;
            }
        }

        if (!empty($missingFields)) {
            $this->logger->error("e4>Missing required fields in XML", [
                'missing_fields' => $missingFields,
                'numero_guia' => $guiaData['numero_guia'] ?? 'N/A'
            ]);
            throw new Exception('El archivo XML no contiene la información mínima requerida: ' . implode(', ', $missingFields));
        }

        // Warnings para campos opcionales vacíos
        $optionalFields = ['peso_bruto', 'numero_factura', 'motivo_traslado'];
        foreach ($optionalFields as $field) {
            if (empty($guiaData[$field])) {
                $this->logger->warning("w2>Optional field is empty", [
                    'field' => $field,
                    'numero_guia' => $guiaData['numero_guia']
                ]);
            }
        }

        $this->logger->debug("d4>XML processing completed successfully");
        return $guiaData;
    }

    /**
     * Guardar guía en la base de datos con logging de transacciones
     */
    public function saveGuia($guiaData)
    {
        $this->logger->info("Starting to save guia to database", [
            'numero_guia' => $guiaData['numero_guia'],
            'ruc_emisor' => $guiaData['ruc_emisor'],
            'ruc_receptor' => $guiaData['ruc_receptor']
        ]);

        try {
            $query = "INSERT INTO guias_remision 
                     (contenido_xml, numero_guia, fecha_emision, 
                      ruc_emisor, nombre_emisor, ruc_receptor, nombre_receptor, 
                      motivo_traslado, peso_bruto, punto_partida, punto_llegada, 
                      fecha_traslado, numero_factura, fecha_registro) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                      ON CONFLICT (numero_guia) 
                      DO UPDATE SET 
                      contenido_xml = EXCLUDED.contenido_xml,
                      fecha_emision = EXCLUDED.fecha_emision,
                      ruc_emisor = EXCLUDED.ruc_emisor,
                      nombre_emisor = EXCLUDED.nombre_emisor,
                      ruc_receptor = EXCLUDED.ruc_receptor,
                      nombre_receptor = EXCLUDED.nombre_receptor,
                      motivo_traslado = EXCLUDED.motivo_traslado,
                      peso_bruto = EXCLUDED.peso_bruto,
                      punto_partida = EXCLUDED.punto_partida,
                      punto_llegada = EXCLUDED.punto_llegada,
                      fecha_traslado = EXCLUDED.fecha_traslado,
                      numero_factura = EXCLUDED.numero_factura,
                      fecha_registro = NOW()";

            $params = [
                $guiaData['contenido_xml'],
                $guiaData['numero_guia'],
                $guiaData['fecha_emision'],
                $guiaData['ruc_emisor'],
                $guiaData['nombre_emisor'],
                $guiaData['ruc_receptor'],
                $guiaData['nombre_receptor'],
                $guiaData['motivo_traslado'],
                $guiaData['peso_bruto'],
                $guiaData['punto_partida'],
                $guiaData['punto_llegada'],
                $guiaData['fecha_traslado'],
                $guiaData['numero_factura']
            ];

            $stmt = $this->db->executeQuery($query, $params);

            // Buscar ID de la guía insertada/actualizada
            $queryFind = "SELECT id FROM guias_remision WHERE numero_guia = ?";
            $stmtFind = $this->db->executeQuery($queryFind, [$guiaData['numero_guia']]);
            $result = $stmtFind->fetch(PDO::FETCH_ASSOC);
        
            if ($result) {
                $this->logger->info("Guia saved successfully to database", [
                    'id' => $result['id'],
                    'numero_guia' => $guiaData['numero_guia'],
                    'operation' => 'insert_or_update'
                ]);
                return $result['id'];
            } else {
                $this->logger->error("Could not retrieve saved guia ID", [
                    'numero_guia' => $guiaData['numero_guia']
                ]);
                throw new Exception('No se pudo obtener el ID de la guía guardada');
            }
        
        } catch (PDOException $e) {
            $sqlState = $e->getCode();
            
            $this->logger->error("Database error while saving guia", [
                'numero_guia' => $guiaData['numero_guia'],
                'sql_state' => $sqlState,
                'error_message' => $e->getMessage()
            ]);
            
            // Error de violación de restricción única (duplicado)
            if ($sqlState == '23505') {
                throw new Exception("Error: La guía con el número '{$guiaData['numero_guia']}' ya existe.");
            }
            // Error de violación de integridad referencial
            elseif ($sqlState == '23503') {
                throw new Exception("Error de integridad: Violación de clave foránea.");
            }
            // Error de datos demasiado largos
            elseif ($sqlState == '22001') {
                throw new Exception("Error: Algunos datos son demasiado largos para los campos de la base de datos.");
            }
            // Otros errores
            else {
                throw new Exception("Error inesperado de base de datos: " . $e->getMessage());
            }
        }
    }

    /**
     * Obtener listado de guías con logging de consultas
     * obtener listado de guías con filtros y paginación desde la base de datos
     * @param array $filters Filtros de búsqueda
     * @param int $limit Límite de resultados
     * @param int $offset Desplazamiento para paginación
     * @return array Lista de guías encontradas
     */
    public function getGuias($filters = [], $limit = 50, $offset = 0)
    {
        $this->logger->debug("Getting guias list", [
            'filters' => $filters,
            'limit' => $limit,
            'offset' => $offset
        ]);

        // ... resto del código igual pero con logs en puntos importantes
        $query = "SELECT id, numero_guia, fecha_emision, 
                  ruc_emisor, nombre_emisor, ruc_receptor, nombre_receptor, 
                  motivo_traslado, peso_bruto, numero_factura
                  FROM guias_remision";

        $params = [];
        $whereConditions = [];

        // Aplicar filtros si existen
        if (!empty($filters)) {
            foreach ($filters as $field => $value) {
                if (!empty($value)) {
                    switch ($field) {
                        case 'numero_guia':
                        case 'numero_factura':
                            $whereConditions[] = "$field ILIKE ?"; // ✅ ILIKE para PostgreSQL (case insensitive)
                            $params[] = "%$value%";
                            break;
                        case 'fecha_desde':
                            $whereConditions[] = "fecha_emision >= ?";
                            $params[] = $value;
                            break;
                        case 'fecha_hasta':
                            $whereConditions[] = "fecha_emision <= ?";
                            $params[] = $value;
                            break;
                        case 'ruc_emisor':
                        case 'ruc_receptor':
                            $whereConditions[] = "$field = ?";
                            $params[] = $value;
                            break;
                    }
                }
            }
        }

        // Construir cláusula WHERE si hay condiciones
        if (!empty($whereConditions)) {
            $query .= " WHERE " . implode(' AND ', $whereConditions);
        }

        // Ordenar por fecha de emisión (más recientes primero)
        $query .= " ORDER BY fecha_emision DESC, numero_guia DESC";

        // Aplicar límite y offset para paginación
        $query .= " LIMIT ? OFFSET ?";
        $params[] = (int)$limit;
        $params[] = (int)$offset;

        $stmt = $this->db->executeQuery($query, $params);
        //return $stmt->fetchAll();

        $this->logger->info("Guias list retrieved", [
            'count' => count($result ?? []),
            'filters_applied' => !empty($filters)
        ]);

        return $stmt->fetchAll() ?? [];
    }

    /**
     * Obtener guía por ID
     * 
     * @param int $id ID de la guía
     * @return array Datos completos de la guía
     */
    public function getGuiaById($id)
    {
        $query = "SELECT * FROM guias_remision WHERE id = ?";
        $stmt = $this->db->executeQuery($query, [$id]);
        $guia = $stmt->fetch();

        if (!$guia) {
            throw new Exception('Guía de remisión no encontrada');
        }

        return $guia;
    }

    /**
     * Contar total de guías en db (para paginación)
     * 
     * @param array $filters Filtros de búsqueda
     * @return int Total de guías
     */
    public function countGuias($filters = [])
    {
        $query = "SELECT COUNT(*) AS total FROM guias_remision";

        $params = [];
        $whereConditions = [];

        // Aplicar filtros si existen
        if (!empty($filters)) {
            foreach ($filters as $field => $value) {
                if (!empty($value)) {
                    switch ($field) {
                        case 'numero_guia':
                        case 'numero_factura':
                            $whereConditions[] = "$field ILIKE ?"; // ✅ ILIKE para PostgreSQL
                            $params[] = "%$value%";
                            break;
                        case 'fecha_desde':
                            $whereConditions[] = "fecha_emision >= ?";
                            $params[] = $value;
                            break;
                        case 'fecha_hasta':
                            $whereConditions[] = "fecha_emision <= ?";
                            $params[] = $value;
                            break;
                        case 'ruc_emisor':
                        case 'ruc_recptor':
                            $whereConditions[] = "$field = ?";
                            $params[] = $value;
                            break;
                    }
                }
            }
        }

        // Construir cláusula WHERE si hay condiciones
        if (!empty($whereConditions)) {
            $query .= " WHERE " . implode(' AND ', $whereConditions);
        }

        $stmt = $this->db->executeQuery($query, $params);
        $result = $stmt->fetch();

        return (int)$result['total'];
    }

    /**
     * Extraer datos de XML para la representación en frontend
     * 
     * @param string $xmlContent Contenido XML (puede estar en hexadecimal)
     * @return array Datos de la guía en formato estructurado
     */
    public function extractGuiaDetails($xmlContent)
    {
        // ✅ DECODIFICAR XML HEXADECIMAL si es necesario
        if (ctype_xdigit($xmlContent) && strlen($xmlContent) % 2 === 0) {
            $xmlContent = hex2bin($xmlContent);// Convertir de hexadecimal a binario
        }
        
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();
        if (!$dom->loadXML($xmlContent)) {
            $errors = libxml_get_errors();
            libxml_clear_errors();
            throw new Exception('XML inválido: ' . $errors[0]->message);
        }

        $xpath = new DOMXPath($dom);

        // Registrar namespaces
        foreach ($this->namespaces as $prefix => $uri) {
            $xpath->registerNamespace($prefix, $uri);
        }

        // Datos del emisor
        $emisor = [
            'ruc_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cbc:ID'),
            'nombre_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cbc:RegistrationName'),
            'direccion_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cac:RegistrationAddress/cac:AddressLine/cbc:Line')
        ];

        // Datos del destinatario
        $destinatario = [
            'ruc_receptor' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cbc:ID'),
            'nombre_receptor' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cbc:RegistrationName'),
            'direccion_receptor' => $this->getXPathValue($xpath, empty('//cac:DeliveryCustomerParty//cac:RegistrationAddress/cac:AddressLine/cbc:Line')?'//cec:UBLExtensions//cec:UBLExtension//cec:ExtensionContent//fac:AdditionalPrintedElement//fac:AdditionalPrintedProperty//cbc:Value':'//cac:DeliveryCustomerParty//cac:RegistrationAddress/cac:AddressLine/cbc:Line')
            //'direccion' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cac:RegistrationAddress/cac:AddressLine/cbc:Line')
        ];

        // Datos de la guía
        $guia = [
            'guia_numero' => $this->getXPathValue($xpath,  empty('//cbc:ID') ?'//cbc:ID':'cbc:ID'),
            'fecha_emision' => $this->getXPathValue($xpath, '//cbc:IssueDate'),
            'fecha_traslado' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cac:TransitPeriod//cbc:StartDate'),
            'motivo_traslado' => $this->getXPathValue($xpath, '//cac:Shipment//cbc:HandlingCode'),
            'peso_total' => $this->getXPathValue($xpath, '//cac:Shipment//cbc:GrossWeightMeasure'),
            'unidad_medida_peso' => $this->getXPathValue($xpath, '//cac:Shipment//cbc:GrossWeightMeasure/@unitCode'),
            'punto_partida' => $this->getXPathValue($xpath, empty('//cac:Shipment//cac:OriginAddress//cbc:Line') ? '//cac:Shipment//cac:OriginAddress//cbc:Line':'//cac:DespatchAddress/cac:AddressLine/cbc:Line'),
            'punto_llegada' => $this->getXPathValue($xpath, '//cac:Shipment//cac:DeliveryAddress//cbc:Line'),
            'numero_factura' => $this->getXPathValue($xpath, '//cac:AdditionalDocumentReference//cbc:ID'),
            'modalidad_traslado' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cbc:TransportModeCode')
        ];

        // Datos del transportista
        $transportista = [
            'ruc_transporte' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cac:CarrierParty//cbc:ID'),
            'nombre_transporte' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cac:CarrierParty//cbc:RegistrationName'),
            'licencia' => $this->getXPathValue($xpath, '//cac:Shipment/cac:ShipmentStage/cac:CarrierParty/cac:PartyLegalEntity/cbc:CompanyID'),
            'placa' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cac:TransportMeans//cbc:RegistrationNationalityID')
            //'licencia' => $this->getXPathValue($xpath, '//cac:Shipment//cac:ShipmentStage//cac:DriverPerson//cbc:ID'),
        ];

        // Detalles/Items
        $detalles = [];
        $items = $xpath->query('//cac:DespatchLine');

        foreach ($items as $item) {
            $itemXpath = new DOMXPath($dom);
            foreach ($this->namespaces as $prefix => $uri) {
                $itemXpath->registerNamespace($prefix, $uri);
            }

            $detalle = [
                'itemID' => $this->getNodeValue($itemXpath, './/cbc:ID', $item),
                'cantidad' => $this->getNodeValue($itemXpath, './/cbc:DeliveredQuantity', $item),
                'unidad' => $this->getNodeValue($itemXpath, './/cbc:DeliveredQuantity/@unitCode', $item),
                'descripcion' => $this->getNodeValue($itemXpath, './/cac:Item/cbc:Description', $item) ?: $this->getNodeValue($itemXpath, './/cac:Item/cbc:Name', $item)
            ];

            $detalles[] = $detalle;
        }

        return [
            'emisor' => $emisor,
            'destinatario' => $destinatario,
            'guia' => $guia,
            'transportista' => $transportista,
            'detalles' => $detalles
        ];
    }

    /**
     * Obtener valor de nodo XPath
     * 
     * @param DOMXPath $xpath Objeto XPath
     * @param string $expression Expresión XPath
     * @return string Valor encontrado o vacío
     */
    private function getXPathValue($xpath, $expression)
    {
        $nodes = $xpath->query($expression);
        if ($nodes->length > 0) {
            return trim($nodes->item(0)->textContent);
        }
        return '';
    }

    /**
     * Obtener valor de nodo relativo a un contexto
     * 
     * @param DOMXPath $xpath Objeto XPath
     * @param string $expression Expresión XPath
     * @param DOMNode $contextNode Nodo de contexto
     * @return string Valor encontrado o vacío
     */
    private function getNodeValue($xpath, $expression, $contextNode)
    {
        $nodes = $xpath->query($expression, $contextNode);
        if ($nodes->length > 0) {
            return trim($nodes->item(0)->textContent);
        }
        return '';
    }

    /**
     * Obtener mensaje de error de carga
     * 
     * @param int $errorCode Código de error
     * @return string Mensaje descriptivo
     */
    private function getUploadErrorMessage($errorCode)
    {
        switch ($errorCode) {
            case UPLOAD_ERR_INI_SIZE:
                return 'El archivo excede el tamaño máximo permitido por PHP';
            case UPLOAD_ERR_FORM_SIZE:
                return 'El archivo excede el tamaño máximo permitido por el formulario';
            case UPLOAD_ERR_PARTIAL:
                return 'El archivo fue subido parcialmente';
            case UPLOAD_ERR_NO_FILE:
                return 'No se subió ningún archivo';
            case UPLOAD_ERR_NO_TMP_DIR:
                return 'No se encuentra el directorio temporal';
            case UPLOAD_ERR_CANT_WRITE:
                return 'Error al escribir el archivo en el disco';
            case UPLOAD_ERR_EXTENSION:
                return 'Una extensión de PHP detuvo la carga del archivo';
            default:
                return 'Error desconocido al subir el archivo';
        }
    }



    /**
     * Obtener estadísticas del logger
     */
    public function getLoggerStats()
    {
        return $this->logger->getStats();
    }

    /**
     * Limpiar logs (método administrativo)
     */
    public function clearLogs()
    {
        $this->logger->clearLogs();
    }

    // ... resto de métodos con logging similar
}
?>