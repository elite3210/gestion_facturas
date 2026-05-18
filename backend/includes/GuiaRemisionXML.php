<?php
/**
 * Clase GuiaRemisionXML
 * 
 * Procesa y valida XML de guías de remisión según estándar UBL 2.1
 */
class GuiaRemisionXML {
    private $dom;
    private $xpath;
    private $namespaces = [
        'cac' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'cbc' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'ext' => 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'ds'  => 'http://www.w3.org/2000/09/xmldsig#'
    ];

    /**
     * Constructor
     * @param string $xmlContent Contenido del XML
     */
    public function __construct($xmlContent) {
        libxml_use_internal_errors(true);
        
        $this->dom = new DOMDocument();
        if (!$this->dom->loadXML($xmlContent)) {
            $errors = libxml_get_errors();
            libxml_clear_errors();
            throw new Exception('XML inválido: ' . $errors[0]->message);
        }

        $this->xpath = new DOMXPath($this->dom);
        foreach ($this->namespaces as $prefix => $uri) {
            $this->xpath->registerNamespace($prefix, $uri);
        }
    }

    /**
     * Obtiene los datos principales de la guía
     */
    public function getMainData() {
        return [
            'serie_numero' => $this->getNodeValue('//cbc:ID'),
            'fecha_emision' => $this->getNodeValue('//cbc:IssueDate'),
            'hora_emision' => $this->getNodeValue('//cbc:IssueTime'),
            'tipo_documento' => $this->getNodeValue('//cbc:DespatchAdviceTypeCode'),
            'ruc_emisor' => $this->getNodeValue('//cac:DespatchSupplierParty//cbc:ID'),
            'razon_social_emisor' => $this->getNodeValue('//cac:DespatchSupplierParty//cbc:RegistrationName'),
            'ruc_destinatario' => $this->getNodeValue('//cac:DeliveryCustomerParty//cbc:ID'),
            'razon_social_destinatario' => $this->getNodeValue('//cac:DeliveryCustomerParty//cbc:RegistrationName'),
            'motivo_traslado' => $this->getNodeValue('//cbc:HandlingInstructions'),
            'peso_bruto' => $this->getNodeValue('//cbc:GrossWeightMeasure'),
            'punto_partida' => $this->getNodeValue('//cac:Shipment//cac:OriginAddress/cac:AddressLine/cbc:Line'),
            'punto_llegada' => $this->getNodeValue('//cac:Shipment//cac:DeliveryAddress/cac:AddressLine/cbc:Line'),
            'fecha_traslado' => $this->getNodeValue('//cac:ShipmentStage//cac:TransitPeriod/cbc:StartDate')
        ];
    }

    /**
     * Obtiene los items de la guía
     */
    public function getItems() {
        $items = [];
        $nodes = $this->xpath->query('//cac:DespatchLine');
        
        foreach ($nodes as $node) {
            $items[] = [
                'numero_orden' => $this->getNodeValue('.//cbc:ID', $node),
                'codigo' => $this->getNodeValue('.//cac:Item/cac:SellersItemIdentification/cbc:ID', $node),
                'descripcion' => $this->getNodeValue('.//cac:Item/cbc:Description', $node),
                'cantidad' => $this->getNodeValue('.//cbc:DeliveredQuantity', $node),
                'unidad' => $this->getNodeValue('.//cbc:DeliveredQuantity/@unitCode', $node)
            ];
        }
        
        return $items;
    }

    /**
     * Obtiene los datos del transportista
     */
    public function getTransportista() {
        return [
            'ruc' => $this->getNodeValue('//cac:ShipmentStage//cac:CarrierParty//cbc:CompanyID'),
            'razon_social' => $this->getNodeValue('//cac:ShipmentStage//cac:CarrierParty//cbc:RegistrationName'),
            'tipo_documento' => $this->getNodeValue('//cac:ShipmentStage//cac:CarrierParty//cbc:CompanyID/@schemeID')
        ];
    }

    /**
     * Obtiene los datos del vehículo
     */
    public function getVehiculo() {
        return [
            'placa' => $this->getNodeValue('//cac:ShipmentStage//cac:TransportMeans/cac:RoadTransport/cbc:LicensePlateID'),
            'conductor_tipo_doc' => $this->getNodeValue('//cac:ShipmentStage//cac:DriverPerson/cbc:ID/@schemeID'),
            'conductor_doc' => $this->getNodeValue('//cac:ShipmentStage//cac:DriverPerson/cbc:ID'),
            'conductor_nombre' => $this->getNodeValue('//cac:ShipmentStage//cac:DriverPerson/cbc:FirstName')
        ];
    }

    /**
     * Obtiene el valor de un nodo XML
     */
    private function getNodeValue($query, $contextNode = null) {
        $nodes = $contextNode ? 
            $this->xpath->query($query, $contextNode) : 
            $this->xpath->query($query);
            
        return $nodes->length > 0 ? trim($nodes->item(0)->nodeValue) : '';
    }

    /**
     * Valida la estructura del XML
     */
    public function validate() {
        $required = [
            'serie_numero',
            'fecha_emision',
            'ruc_emisor',
            'razon_social_emisor',
            'ruc_destinatario',
            'razon_social_destinatario',
            'motivo_traslado'
        ];

        $data = $this->getMainData();
        foreach ($required as $field) {
            if (empty($data[$field])) {
                throw new Exception("Campo obligatorio faltante: {$field}");
            }
        }

        return true;
    }
}