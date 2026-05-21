<?php

/**
 * Clase FacturaProcessor - Procesa y gestiona facturas electrónicas
 * 
 * Maneja la carga, extracción, almacenamiento y consulta de facturas electrónicas
 * en formato UBL 2.1 de SUNAT
 * 
 * ✅ ADAPTADO PARA POSTGRESQL
 */
class FacturaProcessor
{
    private $db;
    private $namespaces = [
        'cbc' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'cac' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'ext' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'ubl' => 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'ds' => 'http://www.w3.org/2000/09/xmldsig#',
        'sac' => 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
        'fac' => 'urn:facele:names:specification:ubl:peru:schema:xsd:FaceleAggregateComponents-1'
    ];

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Procesar archivo XML de factura
     * 
     * @param array $file Información del archivo subido
     * @return array Datos extraídos de la factura
     */
    public function processXmlFile($file, $moveType = 'out_invoice')
    {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Error al subir el archivo: ' . $this->getUploadErrorMessage($file['error']));
        }

        // Validar tipo de archivo
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, ['application/xml', 'text/xml'])) {
            throw new Exception('El archivo debe ser un XML válido');
        }

        // Cargar y procesar XML
        $xmlContent = file_get_contents($file['tmp_name']);
        if (!$xmlContent) {
            throw new Exception('No se pudo leer el contenido del archivo');
        }

        return $this->processXmlContent($xmlContent, $moveType);
    }

    /**
     * Procesar contenido XML
     * 
     * @param string $xmlContent Contenido XML
     * @param string $fileName Nombre del archivo (borrado en la versión actual)
     * @return array Datos extraídos de la factura
     */
    public function processXmlContent($xmlContent, $moveType = 'out_invoice')
    {
        libxml_use_internal_errors(true);

        $dom = new DOMDocument();// create a new DOMDocument instance
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

        // Extraer datos principales
        $facturaData = [
            'contenido_xml' => bin2hex($xmlContent), // ✅ CONVERTIR A HEXADECIMAL para PostgreSQL
            'numero_factura' => $this->getXPathValue($xpath, '//*[local-name()="Invoice"]/cbc:ID'),
            'fecha_emision' => $this->getXPathValue($xpath, '//cbc:IssueDate'),
            'ruc_emisor' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cbc:ID'),
            'ruc_receptor' => $this->getXPathValue($xpath, '//cac:AccountingCustomerParty//cbc:ID'),
            'nombre_emisor' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cbc:RegistrationName'),
            'nombre_receptor' => $this->getXPathValue($xpath, '//cac:AccountingCustomerParty//cbc:RegistrationName'),
            'monto_total' => $this->getXPathValue($xpath, '//cac:LegalMonetaryTotal/cbc:PayableAmount'),
            'codigo_moneda' => $this->getXPathValue($xpath, '//cbc:DocumentCurrencyCode'),
            'serie_numero_guia' => str_replace(' ', '', $this->getXPathValue($xpath, '//cac:DespatchDocumentReference/cbc:ID')),
            'amount_untaxed' => $this->getXPathValue($xpath, '//cac:LegalMonetaryTotal/cbc:LineExtensionAmount'),
            'amount_tax' => $this->getXPathValue($xpath, '//cac:TaxTotal/cbc:TaxAmount'),
            'l10n_latam_document_type_id' => intval($this->getXPathValue($xpath, '//cbc:InvoiceTypeCode'))
        ];

        // Validar datos minimos requeridos
        if (
            empty($facturaData['numero_factura']) || empty($facturaData['fecha_emision']) ||
            empty($facturaData['ruc_emisor']) || empty($facturaData['ruc_receptor'])
        ) {
            throw new Exception('El archivo XML no contiene la información mínima requerida');
        }

        // Detectar tipo de factura (Venta o Compra) basado en el RUC principal
        $miRuc = '20605216715'; // RUC de la empresa (Elite 3210)
        
        if ($moveType !== null) {
            $facturaData['move_type'] = $moveType;
        } else {
            if ($facturaData['ruc_emisor'] === $miRuc) {
                $facturaData['move_type'] = 'out_invoice'; // Factura de Venta (nosotros emitimos)
            } else if ($facturaData['ruc_receptor'] === $miRuc) {
                $facturaData['move_type'] = 'in_invoice'; // Factura de Compra (nosotros recibimos)
            } else {
                // Por defecto
                $facturaData['move_type'] = 'out_invoice';
            }
        }

        return $facturaData;
    }

    /**
     * Guardar factura en la base de datos
     * 
     * @param array $facturaData Datos de la factura
     * @return int ID de la factura guardada
     */
    public function saveFactura($facturaData)
    {
        try {
            // ✅ SINTAXIS POSTGRESQL: ON CONFLICT en lugar de ON DUPLICATE KEY UPDATE
            $query = "INSERT INTO facturas_electronicas 
                     (contenido_xml, numero_factura, fecha_emision, 
                      ruc_emisor, ruc_receptor, nombre_emisor, nombre_receptor, monto_total, codigo_moneda, serie_numero_guia, move_type, amount_untaxed, amount_tax, l10n_latam_document_type_id, fecha_creacion) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                      ON CONFLICT (numero_factura) 
                      DO UPDATE SET 
                      contenido_xml = EXCLUDED.contenido_xml,
                      fecha_emision = EXCLUDED.fecha_emision,
                      ruc_emisor = EXCLUDED.ruc_emisor,
                      ruc_receptor = EXCLUDED.ruc_receptor,
                      nombre_emisor = EXCLUDED.nombre_emisor,
                      nombre_receptor = EXCLUDED.nombre_receptor,
                      monto_total = EXCLUDED.monto_total,
                      codigo_moneda = EXCLUDED.codigo_moneda,
                      serie_numero_guia = EXCLUDED.serie_numero_guia,
                      move_type = EXCLUDED.move_type,
                      amount_untaxed = EXCLUDED.amount_untaxed,
                      amount_tax = EXCLUDED.amount_tax,
                      l10n_latam_document_type_id = EXCLUDED.l10n_latam_document_type_id,
                      fecha_actualizacion = NOW()";

            $params = [
                $facturaData['contenido_xml'],
                $facturaData['numero_factura'],
                $facturaData['fecha_emision'],
                $facturaData['ruc_emisor'],
                $facturaData['ruc_receptor'],
                $facturaData['nombre_emisor'],
                $facturaData['nombre_receptor'],
                $facturaData['monto_total'],
                $facturaData['codigo_moneda'],
                $facturaData['serie_numero_guia'],
                $facturaData['move_type'],
                $facturaData['amount_untaxed'] ?: null,
                $facturaData['amount_tax'] ?: null,
                $facturaData['l10n_latam_document_type_id'] ?: null
            ];

            $stmt = $this->db->executeQuery($query, $params);

            // ✅ POSTGRESQL: Buscar ID de la factura insertada/actualizada
            $queryFind = "SELECT id FROM facturas_electronicas WHERE numero_factura = ?";
            $stmtFind = $this->db->executeQuery($queryFind, [$facturaData['numero_factura']]);
            $result = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if ($result) {
                return $result['id'];
            } else {
                throw new Exception('No se pudo obtener el ID de la factura guardada. Revisa los logs de la base de datos.');
            }

        } catch (Exception $e) {
            // Database::executeQuery lanza una Exception base, no PDOException
            $msg = $e->getMessage();

            // Intentar detectar el código de error si está en el mensaje (ej: SQLSTATE[23505])
            if (strpos($msg, '23505') !== false) {
                throw new Exception("Error: La factura con el número '{$facturaData['numero_factura']}' ya existe.");
            } elseif (strpos($msg, '23503') !== false) {
                throw new Exception("Error de integridad: Violación de clave foránea.");
            } elseif (strpos($msg, '22001') !== false) {
                throw new Exception("Error: Algunos datos son demasiado largos para los campos de la base de datos.");
            } else {
                // Propagar el error original para que la API lo devuelva con HTTP 500
                throw new Exception("Error al guardar la factura en BD: " . $msg);
            }
        }
    }

    /**
     * Obtener listado de facturas
     * 
     * @param array $filters Filtros de búsqueda
     * @param int $limit Límite de resultados
     * @param int $offset Desplazamiento para paginación
     * @return array Lista de facturas
     */
    public function getFacturas($filters = [], $limit = 50, $offset = 0, $sort = 'fecha_emision', $order = 'DESC')
    {
        $query = "SELECT id, numero_factura, fecha_emision, 
                  ruc_emisor, ruc_receptor, nombre_emisor, nombre_receptor, monto_total, codigo_moneda, serie_numero_guia, move_type, state, payment_status, amount_untaxed, amount_tax, invoice_currency_rate
                  FROM facturas_electronicas";

        $params = [];
        $whereConditions = [];

        // Aplicar filtros si existen
        if (!empty($filters)) {
            foreach ($filters as $field => $value) {
                if (!empty($value)) {
                    switch ($field) {
                        case 'numero_factura':
                        case 'serie_numero_guia':
                        case 'nombre_receptor':
                            $whereConditions[] = "$field ILIKE ?"; // ✅ ILIKE para PostgreSQL (case insensitive)
                            $params[] = "%$value%";
                            break;
                        case 'search':
                            $whereConditions[] = "(numero_factura ILIKE ? OR nombre_receptor ILIKE ? OR ruc_receptor ILIKE ?)";
                            $params[] = "%$value%";
                            $params[] = "%$value%";
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
                        case 'move_type':
                        case 'state':
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

        // Validar campo de ordenamiento para evitar inyección SQL
        $allowedSortFields = ['numero_factura', 'fecha_emision', 'ruc_emisor', 'ruc_receptor', 'nombre_emisor', 'nombre_receptor', 'monto_total', 'serie_numero_guia'];
        if (!in_array($sort, $allowedSortFields)) {
            $sort = 'fecha_emision';
        }

        // Ordenar dinámicamente
        $query .= " ORDER BY $sort $order";

        // Aplicar límite y offset para paginación
        $query .= " LIMIT ? OFFSET ?";
        $params[] = (int) $limit;
        $params[] = (int) $offset;

        $stmt = $this->db->executeQuery($query, $params);
        return $stmt->fetchAll();
    }

    /**
     * Obtener datos agrupados para vistas dinámicas (Pivot/Graph)
     * 
     * @param array $filters Filtros de búsqueda (igual que getFacturas)
     * @param array $groupBy Lista de campos por los que agrupar
     * @param array $measures Lista de medidas
     * @return array Datos agrupados
     */
    public function getFacturasAgrupadas($filters = [], $groupBy = [], $measures = [])
    {
        $selects = [];
        $groupBys = [];
        
        // Mapeo de campos groupBy permitidos a expresiones SQL (PostgreSQL)
        $allowedGroupBy = [
            'cliente' => 'nombre_receptor',
            'fecha_mes' => "TO_CHAR(fecha_emision, 'YYYY-MM')", 
            'fecha_anio' => "TO_CHAR(fecha_emision, 'YYYY')",
            'estado' => 'state',
            'tipo_comprobante' => 'l10n_latam_document_type_id',
            'move_type' => 'move_type'
        ];
        
        foreach ($groupBy as $groupField) {
            if (isset($allowedGroupBy[$groupField])) {
                $sqlExpr = $allowedGroupBy[$groupField];
                $selects[] = "$sqlExpr AS $groupField";
                $groupBys[] = $sqlExpr;
            }
        }
        
        // Mapeo de medidas
        $allowedMeasures = [
            'monto_total' => 'SUM(COALESCE(monto_total, 0))',
            'amount_untaxed' => 'SUM(COALESCE(amount_untaxed, 0))',
            'amount_tax' => 'SUM(COALESCE(amount_tax, 0))',
            'count' => 'COUNT(id)'
        ];
        
        foreach ($measures as $measure) {
            if (isset($allowedMeasures[$measure])) {
                $sqlExpr = $allowedMeasures[$measure];
                $selects[] = "$sqlExpr AS $measure";
            }
        }
        
        // Si no hay medidas, por defecto devolvemos count
        if (empty($selects)) {
            $selects[] = "COUNT(id) AS count";
        }
        
        $query = "SELECT " . implode(', ', $selects) . " FROM facturas_electronicas";
        
        $params = [];
        $whereConditions = [];
        
        // Aplicar filtros (mismo lógica que getFacturas)
        if (!empty($filters)) {
            foreach ($filters as $field => $value) {
                if (!empty($value)) {
                    switch ($field) {
                        case 'numero_factura':
                        case 'serie_numero_guia':
                        case 'nombre_receptor':
                            $whereConditions[] = "$field ILIKE ?";
                            $params[] = "%$value%";
                            break;
                        case 'search':
                            $whereConditions[] = "(numero_factura ILIKE ? OR nombre_receptor ILIKE ? OR ruc_receptor ILIKE ?)";
                            $params[] = "%$value%";
                            $params[] = "%$value%";
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
                        case 'move_type':
                        case 'state':
                            $whereConditions[] = "$field = ?";
                            $params[] = $value;
                            break;
                    }
                }
            }
        }
        
        if (!empty($whereConditions)) {
            $query .= " WHERE " . implode(' AND ', $whereConditions);
        }
        
        if (!empty($groupBys)) {
            $query .= " GROUP BY " . implode(', ', $groupBys);
            $query .= " ORDER BY " . implode(', ', $groupBys) . " ASC";
        }
        
        $stmt = $this->db->executeQuery($query, $params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtener factura por ID
     * 
     * @param int $id ID de la factura
     * @return array Datos completos de la factura
     */
    public function getFacturaById($id)
    {
        $query = "SELECT * FROM facturas_electronicas WHERE id = ?";
        $stmt = $this->db->executeQuery($query, [$id]);
        $factura = $stmt->fetch();

        if (!$factura) {
            throw new Exception('Factura no encontrada');
        }

        return $factura;
    }

    /**
     * Contar total de facturas (para paginación)
     * 
     * @param array $filters Filtros de búsqueda
     * @return int Total de facturas
     */
    public function countFacturas($filters = [])
    {
        $query = "SELECT COUNT(*) AS total FROM facturas_electronicas";

        $params = [];
        $whereConditions = [];

        // Aplicar filtros si existen
        if (!empty($filters)) {
            foreach ($filters as $field => $value) {
                if (!empty($value)) {
                    switch ($field) {
                        case 'numero_factura':
                        case 'serie_numero_guia':
                        case 'nombre_receptor':
                            $whereConditions[] = "$field ILIKE ?"; // ✅ ILIKE para PostgreSQL
                            $params[] = "%$value%";
                            break;
                        case 'search':
                            $whereConditions[] = "(numero_factura ILIKE ? OR nombre_receptor ILIKE ? OR ruc_receptor ILIKE ?)";
                            $params[] = "%$value%";
                            $params[] = "%$value%";
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
                        case 'move_type':
                        case 'state':
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

        return (int) $result['total'];
    }

    /**
     * Extraer datos de XML para la representación en frontend
     * 
     * @param string $xmlContent Contenido XML (puede estar en hexadecimal)
     * @return array Datos de la factura en formato estructurado
     */
    public function extractFacturaDetails($xmlContent)
    {
        // ✅ DECODIFICAR XML HEXADECIMAL si es necesario
        if (ctype_xdigit($xmlContent) && strlen($xmlContent) % 2 === 0) {
            $xmlContent = hex2bin($xmlContent);
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
            'ruc' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cbc:ID'),
            'razonSocial' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cbc:RegistrationName'),
            'direccion' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cac:RegistrationAddress/cac:AddressLine/cbc:Line'),
            'distrito' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cac:RegistrationAddress/cbc:District'),
            'provincia' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cac:RegistrationAddress/cbc:CityName'),
            'departamento' => $this->getXPathValue($xpath, '//cac:AccountingSupplierParty//cac:RegistrationAddress/cbc:CountrySubentity')
        ];

        // Datos del receptor
        $receptor = [
            'ruc' => $this->getXPathValue($xpath, '//cac:AccountingCustomerParty//cbc:ID'),
            'razonSocial' => $this->getXPathValue($xpath, '//cac:AccountingCustomerParty//cbc:RegistrationName'),
            'direccion' => $this->getXPathValue($xpath, '//cac:AccountingCustomerParty//cac:RegistrationAddress/cac:AddressLine/cbc:Line')
        ];

        // Datos de la factura
        $factura = [
            'serie' => $this->getXPathValue($xpath, '//*[local-name()="Invoice"]/cbc:ID'),
            'fechaEmision' => $this->getXPathValue($xpath, '//cbc:IssueDate'),
            'tipoDocumento' => $this->getXPathValue($xpath, '//cbc:InvoiceTypeCode/@name'),
            'moneda' => $this->getXPathValue($xpath, '//cbc:DocumentCurrencyCode'),
            'totalLetras' => $this->getXPathValue($xpath, '//cbc:Note[@languageLocaleID="1000"]'),
            'formaPago' => $this->getXPathValue($xpath, '//cac:PaymentTerms/cbc:PaymentMeansID'),
            'guiaRemision' => $this->getXPathValue($xpath, '//cac:DespatchDocumentReference/cbc:ID') ? $this->getXPathValue($xpath, '//cac:DespatchDocumentReference/cbc:ID') : 'N/D'
        ];

        // Totales
        $totales = [
            'gravadas' => $this->getXPathValue($xpath, '//cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount'),
            'igv' => $this->getXPathValue($xpath, '//cac:TaxTotal/cbc:TaxAmount'),
            'total' => $this->getXPathValue($xpath, '//cac:LegalMonetaryTotal/cbc:PayableAmount')
        ];

        // Detalles/Items
        $detalles = [];
        $items = $xpath->query('//cac:InvoiceLine');
        $unidad = [
            'NIU' => 'UNIDAD',
            'ZZ' => 'UNIDAD',
            'C62' => 'PIEZAS',
            'PK' => 'PAQUETE',
            'MIL' => 'MILLARES',
            'KGM' => 'KILOS',
            'BE' => 'FARDO',
            'BX' => 'CAJAS',
            'BG' => 'BOLSA',
            '4A' => 'BOBINAS'
        ];

        foreach ($items as $item) {
            $itemXpath = new DOMXPath($dom);
            foreach ($this->namespaces as $prefix => $uri) {
                $itemXpath->registerNamespace($prefix, $uri);
            }

            $detalle = [
                'cantidad' => $this->getNodeValue($itemXpath, './/cbc:InvoicedQuantity', $item),
                'unidad' => $unidad[$this->getNodeValue($itemXpath, './/cbc:InvoicedQuantity/@unitCode', $item)] ?? 'UNIDAD',
                'descripcion' => $this->getNodeValue($itemXpath, './/cac:Item/cbc:Description', $item),
                'valorUnitario' => $this->getNodeValue($itemXpath, './/cac:Price/cbc:PriceAmount', $item),
                'precioUnitario' => $this->getNodeValue($itemXpath, './/cac:PricingReference//cbc:PriceAmount', $item),
                'igv' => $this->getNodeValue($itemXpath, './/cac:TaxTotal/cbc:TaxAmount', $item),
                'subtotal' => $this->getNodeValue($itemXpath, './/cbc:LineExtensionAmount', $item)
            ];

            $detalles[] = $detalle;
        }

        return [
            'emisor' => $emisor,
            'receptor' => $receptor,
            'factura' => $factura,
            'totales' => $totales,
            'detalles' => $detalles
        ];
    }

    /**
     * Actualizar estado de una factura
     * 
     * @param int $id ID de la factura
     * @param string $newState Nuevo estado (draft, posted, cancel)
     * @return bool Éxito de la operación
     */
    public function updateFacturaState($id, $newState)
    {
        $allowedStates = ['draft', 'posted', 'cancel', 'sent'];
        if (!in_array($newState, $allowedStates)) {
            throw new Exception("Estado no válido: " . $newState);
        }

        $query = "UPDATE facturas_electronicas SET state = ? WHERE id = ?";
        $this->db->executeQuery($query, [$newState, $id]);
        return true;
    }

    /**
     * Regularizar guías huérfanas ejecutando el procedimiento almacenado
     * 
     * @return bool Éxito de la operación
     */
    public function regularizarFacturasHuerfanas()
    {
        try {
            $query = "CALL public.sp_regularizar_facturas_huerfanas()";
            $stmt = $this->db->getConnection()->prepare($query);
            $stmt->execute();
            return true;
        } catch (Exception $e) {
            throw new Exception("Error al regularizar facturas huerfanas: " . $e->getMessage());
        }
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
}
?>