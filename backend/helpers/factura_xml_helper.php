<?php
/**
 * Helper para procesamiento de XML de facturas electrónicas
 */

/**
 * Clase para manejar las facturas electrónicas en formato XML UBL 2.1
 */
class FacturaElectronicaXML {
    private $xml;
    private $namespaces;
    
    /**
     * Constructor
     * 
     * @param string $xmlContent Contenido XML de la factura
     */
    public function __construct($xmlContent) {
        $this->xml = new SimpleXMLElement($xmlContent);
        $this->namespaces = $this->xml->getNamespaces(true);
        
        // Registrar namespaces para XPath
        $this->xml->registerXPathNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
        $this->xml->registerXPathNamespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
        $this->xml->registerXPathNamespace('ext', 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2');
        $this->xml->registerXPathNamespace('sac', 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1');
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
            return trim((string) $nodes[0]);
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
     * Obtiene los datos principales de la factura
     * 
     * @return array Datos de la factura
     */
    public function getMainData() {
        $data = [
            'serie_numero' => $this->getValue('//cbc:ID'),
            'fecha_emision' => $this->getValue('//cbc:IssueDate'),
            'fecha_vencimiento' => $this->getValue('//cbc:DueDate'),
            'tipo_documento' => $this->getValue('//cbc:InvoiceTypeCode'),
            'tipo_documento_nombre' => $this->getAttribute('//cbc:InvoiceTypeCode', 'name'),
            'moneda' => $this->getValue('//cbc:DocumentCurrencyCode'),
            'total_letras' => $this->getValue('//cbc:Note[@languageLocaleID="1000"]'),
            'guia_remision' => $this->getValue('//cac:DespatchDocumentReference/cbc:ID'),
            'formaPago' => $this->getValue('//cac:PaymentTerms/cbc:PaymentMeansID'),
            'orden_compra' => $this->getValue('//cac:OrderReference/cbc:ID'),
            
            // Datos del emisor
            'ruc_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID'),
            'tipo_documento_emisor' => $this->getAttribute('//cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID', 'schemeID'),
            'razon_social_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName'),
            'nombre_comercial_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name'),
            'direccion_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cac:AddressLine/cbc:Line'),
            'distrito_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:District'),
            'provincia_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:CityName'),
            'departamento_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:CountrySubentity'),
            'ubigeo_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:ID'),
            'pais_emisor' => $this->getValue('//cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cac:Country/cbc:IdentificationCode'),
            
            // Datos del receptor
            'ruc_receptor' => $this->getValue('//cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID'),
            'tipo_documento_receptor' => $this->getAttribute('//cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID', 'schemeID'),
            'razon_social_receptor' => $this->getValue('//cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName'),
            'direccion_receptor' => $this->getValue('//cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cac:AddressLine/cbc:Line'),
            'distrito_receptor' => $this->getValue('//cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:District'),
            'provincia_receptor' => $this->getValue('//cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:CityName'),
            'departamento_receptor' => $this->getValue('//cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cac:RegistrationAddress/cbc:CountrySubentity'),
        ];
        
        return $data;
    }
    
    /**
     * Obtiene los totales de la factura
     * 
     * @return array Totales
     */
    public function getTotales() {
        $totales = [
            'subtotal' => $this->getValue('//cac:LegalMonetaryTotal/cbc:LineExtensionAmount'),
            'total_gravadas' => $this->getValue('//cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="1000"]/cbc:TaxableAmount'),
            'total_inafectas' => $this->getValue('//cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="9998"]/cbc:TaxableAmount'),
            'total_exoneradas' => $this->getValue('//cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="9997"]/cbc:TaxableAmount'),
            'total_gratuitas' => $this->getValue('//cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="9996"]/cbc:TaxableAmount'),
            'total_descuentos' => $this->getValue('//cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount'),
            'total_otros_cargos' => $this->getValue('//cac:LegalMonetaryTotal/cbc:ChargeTotalAmount'),
            'total_igv' => $this->getValue('//cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID="1000"]/cbc:TaxAmount'),
            'total_isc' => $this->getValue('//cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID="2000"]/cbc:TaxAmount'),
            'total_otros_tributos' => $this->getValue('//cac:TaxTotal[cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID="9999"]/cbc:TaxAmount'),
            'total_valor_venta' => $this->getValue('//cac:LegalMonetaryTotal/cbc:PayableAmount'),
            'total_precio_venta' => $this->getValue('//cac:LegalMonetaryTotal/cbc:PayableAmount'),
            'redondeo' => $this->getValue('//cac:LegalMonetaryTotal/cbc:PayableRoundingAmount'),
        ];
        
        return $totales;
    }
    
    /**
     * Obtiene los detalles/líneas de la factura
     * 
     * @return array Lista de todas las linea o detalles
     */
    public function getDetalles() {
        $detalles = [];
        $nodes = $this->xml->xpath('//cac:InvoiceLine');
        
        foreach ($nodes as $node) {
            $item = [
                'numero_item' => $this->getNodeValue($node, './cbc:ID'),
                'cantidad' => $this->getNodeValue($node, './cbc:InvoicedQuantity'),
                'unidad_medida' => $this->getNodeAttribute($node, './cbc:InvoicedQuantity', 'unitCode'),
                'codigo_producto' => $this->getNodeValue($node, './cac:Item/cac:SellersItemIdentification/cbc:ID'),
                'codigo_producto_sunat' => $this->getNodeValue($node, './cac:Item/cac:CommodityClassification/cbc:ItemClassificationCode'),
                'descripcion' => $this->getNodeValue($node, './cac:Item/cbc:Description'),
                'precio_unitario' => $this->getNodeValue($node, './cac:Price/cbc:PriceAmount'),
                'valor_unitario' => $this->getNodeValue($node, './cac:PricingReference/cac:AlternativeConditionPrice/cbc:PriceAmount'),
                'tipo_precio' => $this->getNodeAttribute($node, './cac:PricingReference/cac:AlternativeConditionPrice/cbc:PriceAmount', 'priceTypeCode'),
                'valor_venta' => $this->getNodeValue($node, './cbc:LineExtensionAmount'),
                'igv' => $this->getNodeValue($node, './cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="1000"]/cbc:TaxAmount'),
                'isc' => $this->getNodeValue($node, './cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="2000"]/cbc:TaxAmount'),
                'tipo_afectacion_igv' => $this->getNodeValue($node, './cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TierRange'),
                'porcentaje_igv' => $this->getNodeValue($node, './cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:ID="1000"]/cbc:Percent'),
            ];
            
            $detalles[] = $item;
        }
        
        return $detalles;
    }
    
    /**
     * Obtiene información de pagos
     * 
     * @return array Información de pagos
     */
    public function getPagos() {
        $pagos = [
            'forma_pago' => $this->getValue('//cac:PaymentTerms/cbc:PaymentMeansID') ?: 'N/D',
            'forma_pago_desc' => $this->getValue('//cac:PaymentTerms/cbc:Note'),
            'cuotas' => []
        ];

        //<cac:PaymentTerms>
		//<cbc:ID>FormaPago</cbc:ID>
		//<cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
	    //</cac:PaymentTerms>
        
        // Obtener cuotas si existen
        $cuotasNodes = $this->xml->xpath('//cac:PaymentTerms[cbc:ID]');
        foreach ($cuotasNodes as $cuota) {
            $pagos['cuotas'][] = [
                'cuota' => $this->getNodeValue($cuota, './cbc:ID'),
                'monto' => $this->getNodeValue($cuota, './cbc:Amount'),
                'fecha' => $this->getNodeValue($cuota, './cbc:PaymentDueDate')
            ];
        }
        
        return $pagos;
    }
    
    /**
     * Obtiene valor de nodo hijo
     */
    private function getNodeValue($node, $xpath) {
        $result = $node->xpath($xpath);
        return !empty($result) ? trim((string) $result[0]) : '';
    }
    
    /**
     * Obtiene atributo de nodo hijo
     */
    private function getNodeAttribute($node, $xpath, $attribute) {
        $result = $node->xpath($xpath);
        if (!empty($result)) {
            $attrs = $result[0]->attributes();
            return isset($attrs[$attribute]) ? (string) $attrs[$attribute] : '';
        }
        return '';
    }
}
?>