<?php
class GuiaRemisionProcessor {
    private $db;
    private $namespaces = [
        'cac' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'cbc' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'ext' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
    ];

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function processXmlFile($file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Error al subir el archivo');
        }

        // Validar tipo de archivo
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, ['application/xml', 'text/xml'])) {
            throw new Exception('El archivo debe ser un XML válido');
        }

        $xmlContent = file_get_contents($file['tmp_name']);
        return $this->processXmlContent($xmlContent);
    }

    public function processXmlContent($xmlContent) {
        libxml_use_internal_errors(true);
        
        $dom = new DOMDocument();
        if (!$dom->loadXML($xmlContent)) {
            throw new Exception('XML inválido');
        }

        $xpath = new DOMXPath($dom);
        foreach ($this->namespaces as $prefix => $uri) {
            $xpath->registerNamespace($prefix, $uri);
        }

        // Extraer datos principales
        return [
            'serie_numero' => $this->getXPathValue($xpath, '//cbc:ID'),
            'fecha_emision' => $this->getXPathValue($xpath, '//cbc:IssueDate'),
            'ruc_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cbc:ID'),
            'razon_social_emisor' => $this->getXPathValue($xpath, '//cac:DespatchSupplierParty//cbc:RegistrationName'),
            'ruc_destinatario' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cbc:ID'),
            'razon_social_destinatario' => $this->getXPathValue($xpath, '//cac:DeliveryCustomerParty//cbc:RegistrationName'),
            'motivo_traslado' => $this->getXPathValue($xpath, '//cbc:HandlingInstructions'),
            'peso_bruto' => $this->getXPathValue($xpath, '//cbc:GrossWeightMeasure'),
            'punto_partida' => $this->getXPathValue($xpath, '//cac:Shipment//cac:OriginAddress/cac:AddressLine/cbc:Line'),
            'punto_llegada' => $this->getXPathValue($xpath, '//cac:Shipment//cac:DeliveryAddress/cac:AddressLine/cbc:Line'),
            'fecha_traslado' => $this->getXPathValue($xpath, '//cac:ShipmentStage//cac:TransitPeriod/cbc:StartDate'),
            'contenido_xml' => bin2hex($xmlContent)
        ];
    }

    private function getXPathValue($xpath, $query) {
        $nodes = $xpath->query($query);
        return $nodes->length > 0 ? trim($nodes->item(0)->nodeValue) : '';
    }

    // Continuará en la siguiente parte...
 
    /**
     * Valida los datos extraídos del XML
     */
    private function validateData($data) {
        $required = [
            'serie_numero',
            'fecha_emision',
            'ruc_emisor',
            'razon_social_emisor',
            'ruc_destinatario',
            'razon_social_destinatario',
            'motivo_traslado'
        ];

        foreach ($required as $field) {
            if (empty($data[$field])) {
                throw new Exception("Campo requerido faltante: {$field}");
            }
        }

        return true;
    }

    /**
     * Procesa los items de la guía
     */
    public function processItems($xpath) {
        $items = [];
        $nodes = $xpath->query('//cac:DespatchLine');
        
        foreach ($nodes as $node) {
            $items[] = [
                'codigo' => $this->getXPathValue($xpath, './/cac:Item/cac:SellersItemIdentification/cbc:ID', $node),
                'descripcion' => $this->getXPathValue($xpath, './/cac:Item/cbc:Description', $node),
                'cantidad' => $this->getXPathValue($xpath, './/cbc:DeliveredQuantity', $node),
                'unidad' => $this->getXPathValue($xpath, './/cbc:DeliveredQuantity/@unitCode', $node)
            ];
        }

        return $items;
    }

    /**
     * Procesa datos del transportista
     */
    public function processTransportista($xpath) {
        return [
            'ruc' => $this->getXPathValue($xpath, '//cac:ShipmentStage//cac:CarrierParty//cbc:CompanyID'),
            'razon_social' => $this->getXPathValue($xpath, '//cac:ShipmentStage//cac:CarrierParty//cbc:RegistrationName'),
            'placa' => $this->getXPathValue($xpath, '//cac:ShipmentStage//cac:TransportMeans/cac:RoadTransport/cbc:LicensePlateID'),
            'conductor_doc' => $this->getXPathValue($xpath, '//cac:ShipmentStage//cac:DriverPerson/cbc:ID'),
            'conductor_nombre' => $this->getXPathValue($xpath, '//cac:ShipmentStage//cac:DriverPerson/cbc:FirstName')
        ];
    }

    /**
     * Guarda la guía en la base de datos
     */
    public function saveGuia($data) {
        $this->validateData($data);
        
        $db = Database::getInstance();
        
        try {
            $db->beginTransaction();

            // Insertar guía principal
            $stmt = $db->prepare("
                INSERT INTO guias_remision (
                    serie_numero, fecha_emision, ruc_emisor,
                    razon_social_emisor, ruc_destinatario,
                    razon_social_destinatario, motivo_traslado,
                    peso_bruto, punto_partida, punto_llegada,
                    fecha_traslado, contenido_xml
                ) VALUES (
                    :serie_numero, :fecha_emision, :ruc_emisor,
                    :razon_social_emisor, :ruc_destinatario,
                    :razon_social_destinatario, :motivo_traslado,
                    :peso_bruto, :punto_partida, :punto_llegada,
                    :fecha_traslado, :contenido_xml
                )
            ");
            
            $stmt->execute($data);
            $guiaId = $db->lastInsertId();

            // Insertar items si existen
            if (!empty($data['items'])) {
                $this->saveItems($guiaId, $data['items']);
            }

            // Insertar datos del transportista si existen
            if (!empty($data['transportista'])) {
                $this->saveTransportista($guiaId, $data['transportista']);
            }

            $db->commit();
            return $guiaId;

        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Guarda los items de la guía
     */
    private function saveItems($guiaId, $items) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            INSERT INTO guia_items (
                guia_id, codigo, descripcion, cantidad, unidad
            ) VALUES (
                :guia_id, :codigo, :descripcion, :cantidad, :unidad
            )
        ");

        foreach ($items as $item) {
            $item['guia_id'] = $guiaId;
            $stmt->execute($item);
        }
    }

    /**
     * Guarda los datos del transportista
     */
    private function saveTransportista($guiaId, $transportista) {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            INSERT INTO guia_transportista (
                guia_id, ruc, razon_social, placa,
                conductor_doc, conductor_nombre
            ) VALUES (
                :guia_id, :ruc, :razon_social, :placa,
                :conductor_doc, :conductor_nombre
            )
        ");

        $transportista['guia_id'] = $guiaId;
        $stmt->execute($transportista);
    }

}