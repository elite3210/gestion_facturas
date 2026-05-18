<?php
/**
 * Helper para procesamiento de XML de guías de remisión
 */

/**
 * Clase para manejar las guías de remisión en formato XML
 */
require_once '../classes/Logger.php';

class GuiaRemisionXML {
    private $xml;// Contenido XML de la guía
    private $namespaces;
    private $logger;
    
    /**
     * Constructor
     * 
     * @param string $xmlContent Contenido XML de la guía
     */
    public function __construct($xmlContent) {

        // Inicializar logger con configuración
        $logConfig = [
            'enabled' => true,
            'level' => 'INFO',
            'file_path' => __DIR__ . '/../logs/guias_remision.log',
            'max_file_size' => '10M',
            'max_files' => 5
        ];
        
        $this->logger = new Logger($logConfig);

        $this->xml = new SimpleXMLElement($xmlContent);
        $this->namespaces = $this->xml->getNamespaces(true);
        
        // Registrar namespaces para XPath
        $this->xml->registerXPathNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
        $this->xml->registerXPathNamespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
    }
    
    /**
     * Obtiene el valor de un nodo usando XPath
     * 
     * @param string $xpath Expresión XPath
     * @return string Valor del nodo
     */
    public function getValue($xpath) {
        $nodes = $this->xml->xpath($xpath);
        
        if (!empty($nodes)) {
            return (string) $nodes[0];
        }
        
        return '';
    }
    
    /**
     * Obtiene el valor de un atributo usando XPath
     * 
     * @param string $xpath Expresión XPath
     * @param string $attribute Nombre del atributo
     * @return string Valor del atributo
     */
    public function getAttribute($xpath, $attribute) {
        $nodes = $this->xml->xpath($xpath);
        
        if (!empty($nodes)) {
            $attrs = $nodes[0]->attributes();
            
            if (isset($attrs[$attribute])) {
                return (string) $attrs[$attribute];
            }
        }
        
        return '';
    }
    
    /**
     * Obtiene los datos principales de la guía de remisión
     * 
     * @return array Datos de la guía
     */
    public function getMainData() {
        $data = [
            'contenido_xml' =>bin2hex($this->xml->asXML()), // Guardar el contenido XML completo convertido a hexadecimal para postgresql
            'numero_guia' => $this->getValue('//*[local-name()="DespatchAdvice"]/cbc:ID'),
            'fecha_emision' => $this->getValue('//cbc:IssueDate'),
            'ruc_emisor' => $this->getValue('//cac:DespatchSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID'),
            'nombre_emisor' => $this->getValue('//cac:DespatchSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName'),
            'ruc_receptor' => $this->getValue('//cac:DeliveryCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID'),
            'nombre_receptor' => $this->getValue('//cac:DeliveryCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName'),
            'motivo_traslado' => $this->getValue('//cbc:HandlingInstructions' ? '//cbc:HandlingInstructions' : '//cbc:HandlingCode'),
            'modalidad_traslado' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cbc:TransportModeCode'),
            'peso_bruto' => $this->getValue('//cbc:GrossWeightMeasure'),
            'unidad_medida_peso' => $this->getAttribute('//cbc:GrossWeightMeasure', 'unitCode'),
            'punto_partida' => $this->getValue('//cac:Despatch/cac:DespatchAddress/cac:AddressLine/cbc:Line'),
            'punto_llegada' => $this->getValue('//cac:Shipment/cac:Delivery/cac:DeliveryAddress/cac:AddressLine/cbc:Line'),
            'fecha_traslado' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:TransitPeriod/cbc:StartDate'),
            'numero_factura' => $this->getValue('//cac:AdditionalDocumentReference/cbc:ID'),
        ];///cac:ShipmentStage/cac:Delivery/cac:Despatch/cac:DespatchAddress/cac:AddressLine/cbc:Line
    
        return $data;
    }

    /**
     * Obtiene los datos principales de la guía de remisión
     * 
     * @return array Datos de la guía
     */
    public function getMainData2() {
        // Validar que el archivo sea un array y tenga las claves esperadas
        $this->logger->info("i2>Starting XML file processing", [
            'filename' => ' in xml_helper.php',
        ]);


        $data = [
            //'contenido_xml' =>bin2hex($this->xml->asXML()), // Guardar el contenido XML completo convertido a hexadecimal para postgresql
            'numero_guia' => $this->getValue('//*[local-name()="DespatchAdvice"]/cbc:ID'),
            'fecha_emision' => $this->getValue('//cbc:IssueDate'),
            'ruc_emisor' => $this->getValue('//cac:DespatchSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID'),
            'nombre_emisor' => $this->getValue('//cac:DespatchSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName'),
            'ruc_receptor' => $this->getValue('//cac:DeliveryCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID'),
            'nombre_receptor' => $this->getValue('//cac:DeliveryCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName'),
            'motivo_traslado' => $this->getValue('//cbc:HandlingInstructions' ? '//cbc:HandlingInstructions' : '//cbc:HandlingCode'),
            'modalidad_traslado' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cbc:TransportModeCode'),
            'peso_bruto' => $this->getValue('//cbc:GrossWeightMeasure'),
            'unidad_medida_peso' => $this->getAttribute('//cbc:GrossWeightMeasure', 'unitCode'),
            'punto_partida' => $this->getValue('//cac:Despatch/cac:DespatchAddress/cac:AddressLine/cbc:Line'),
            'punto_llegada' => $this->getValue('//cac:Shipment/cac:Delivery/cac:DeliveryAddress/cac:AddressLine/cbc:Line'),
            'fecha_traslado' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:TransitPeriod/cbc:StartDate'),
            'numero_factura' => $this->getValue('//cac:AdditionalDocumentReference/cbc:ID'),
        ];///cac:ShipmentStage/cac:Delivery/cac:Despatch/cac:DespatchAddress/cac:AddressLine/cbc:Line
    
        return $data;
    }
    
    /**
     * Obtiene los ítems de la guía de remisión
     * 
     * @return array Lista de ítems
     */
    public function getItems() {
        $items = [];
        $nodes = $this->xml->xpath('//cac:DespatchLine');
        
        foreach ($nodes as $node) {
            $itemID = $node->xpath('./cbc:ID');
            $cantidad = $node->xpath('./cbc:DeliveredQuantity');
            $unidad = $node->xpath('./cbc:DeliveredQuantity/@unitCode');
            $descripcion = $node->xpath('./cac:Item/cbc:Description') ? $node->xpath('./cac:Item/cbc:Description'): $node->xpath('./cac:Item/cbc:Name');    
            
            $items[] = [
                'itemID' => !empty($itemID) ? (string) $itemID[0] : '',
                'cantidad' => !empty($cantidad) ? (string) $cantidad[0] : '',
                'unidad' => !empty($unidad) ? (string) $unidad[0] : '',
                'descripcion' => !empty($descripcion) ? (string) $descripcion[0] : ''
            ];
        }
        
        return $items;
    }
    
    /**
     * Obtiene los datos del transportista
     * 
     * @return array Datos del transportista
     */
    public function getTransportista() {
        $transportista = [
            'ruc_transporte' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:CarrierParty/cac:PartyIdentification/cbc:ID'),
            'nombre_transporte' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:CarrierParty/cac:PartyLegalEntity/cbc:RegistrationName'),
            'licencia' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:CarrierParty/cac:PartyLegalEntity/cbc:CompanyID'),
            'placa' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:TransportMeans/cac:RoadTransport/cbc:LicensePlateID')
        ];
        
        return $transportista;
    }
    
    /**
     * Obtiene los datos del vehículo
     * 
     * @return array Datos del vehículo
     */
    public function getVehiculo() {
        $vehiculo = [
            'placa' => $this->getValue('//cac:Shipment/cac:ShipmentStage/cac:TransportMeans/cac:RoadTransport/cbc:LicensePlateID')
        ];
        
        return $vehiculo;
    }

    /**
     * Extraer datos de XML para la representación en frontend
     * 
     * @param string $xmlContent Contenido XML (puede estar en hexadecimal)
     * @return array Datos de la guía en formato estructurado
     */
    public function extractGuiaDetails()
    {
        return [
            'emisor' => $this->getMainData2(),
            'destinatario' => $this->getMainData2(),
            'guia' => $this->getMainData2(),
            'transportista' => $this->getTransportista(),
            'detalles' => $this->getItems(),
        ];
    }
}
?>