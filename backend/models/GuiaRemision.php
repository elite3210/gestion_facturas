<?php
require_once '../config/conexion.php';

class GuiaRemision {
    private $conn;
    private $table_name = "guias_remision";

    // Propiedades de la guía de remisión
    public $id;
    public $serie_numero;
    public $fecha_emision;
    public $ruc_emisor;
    public $razon_social_emisor;
    public $ruc_destinatario;
    public $razon_social_destinatario;
    public $motivo_traslado;
    public $peso_bruto;
    public $punto_partida;
    public $punto_llegada;
    public $fecha_traslado;
    public $serie_numero_factura;
    public $contenido_xml;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Método para guardar una guía de remisión

    
    public function crear() {
        $query = "INSERT INTO " . $this->table_name . " 
                  (serie_numero, fecha_emision, ruc_emisor, razon_social_emisor, 
                   ruc_destinatario, razon_social_destinatario, motivo_traslado, 
                   peso_bruto, punto_partida, punto_llegada, fecha_traslado, 
                   serie_numero_factura, contenido_xml, fecha_registro) 
                  VALUES 
                  (:serie_numero, :fecha_emision, :ruc_emisor, :razon_social_emisor,
                   :ruc_destinatario, :razon_social_destinatario, :motivo_traslado,
                   :peso_bruto, :punto_partida, :punto_llegada, :fecha_traslado,
                   :serie_numero_factura, :contenido_xml, NOW())";

        $stmt = $this->conn->prepare($query);

        // Sanitización de datos
        $this->serie_numero = htmlspecialchars(strip_tags($this->serie_numero));
        $this->fecha_emision = htmlspecialchars(strip_tags($this->fecha_emision));
        $this->ruc_emisor = htmlspecialchars(strip_tags($this->ruc_emisor));
        $this->razon_social_emisor = htmlspecialchars(strip_tags($this->razon_social_emisor));
        $this->ruc_destinatario = htmlspecialchars(strip_tags($this->ruc_destinatario));
        $this->razon_social_destinatario = htmlspecialchars(strip_tags($this->razon_social_destinatario));
        $this->motivo_traslado = htmlspecialchars(strip_tags($this->motivo_traslado));
        $this->punto_partida = htmlspecialchars(strip_tags($this->punto_partida));
        $this->punto_llegada = htmlspecialchars(strip_tags($this->punto_llegada));
        $this->fecha_traslado = htmlspecialchars(strip_tags($this->fecha_traslado));
        $this->serie_numero_factura = htmlspecialchars(strip_tags($this->serie_numero_factura));

        // Bindeo de parámetros
        $stmt->bindParam(":serie_numero", $this->serie_numero);
        $stmt->bindParam(":fecha_emision", $this->fecha_emision);
        $stmt->bindParam(":ruc_emisor", $this->ruc_emisor);
        $stmt->bindParam(":razon_social_emisor", $this->razon_social_emisor);
        $stmt->bindParam(":ruc_destinatario", $this->ruc_destinatario);
        $stmt->bindParam(":razon_social_destinatario", $this->razon_social_destinatario);
        $stmt->bindParam(":motivo_traslado", $this->motivo_traslado);
        $stmt->bindParam(":peso_bruto", $this->peso_bruto);
        $stmt->bindParam(":punto_partida", $this->punto_partida);
        $stmt->bindParam(":punto_llegada", $this->punto_llegada);
        $stmt->bindParam(":fecha_traslado", $this->fecha_traslado);
        $stmt->bindParam(":serie_numero_factura", $this->serie_numero_factura);
        $stmt->bindParam(":contenido_xml", $this->contenido_xml);

        if ($stmt->execute()) {
            return true;
        }
        return false;
    }

    // Método para obtener todas las guías
    public function leer() {
        // ✅ CORREGIDO: Usar campos que existen en la tabla
        $query = "SELECT id, serie_numero, fecha_emision, ruc_emisor, razon_social_emisor, 
                         ruc_destinatario, razon_social_destinatario, serie_numero_factura, 
                         motivo_traslado, fecha_registro 
                  FROM " . $this->table_name . " 
                  ORDER BY fecha_emision DESC, serie_numero DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt;
    }

    // Método para obtener una guía específica
    public function leerUno() {
        $query = "SELECT * FROM " . $this->table_name . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row) {
            $this->serie_numero = $row['serie_numero'];
            $this->fecha_emision = $row['fecha_emision'];
            $this->ruc_emisor = $row['ruc_emisor'];
            $this->razon_social_emisor = $row['razon_social_emisor'];
            $this->ruc_destinatario = $row['ruc_destinatario'];
            $this->razon_social_destinatario = $row['razon_social_destinatario'];
            $this->motivo_traslado = $row['motivo_traslado'];
            $this->peso_bruto = $row['peso_bruto'];
            $this->punto_partida = $row['punto_partida'];
            $this->punto_llegada = $row['punto_llegada'];
            $this->fecha_traslado = $row['fecha_traslado'];
            $this->contenido_xml = $row['contenido_xml'];
            return true;
        }
        return false;
    }

    // ✅ MÉTODO CORREGIDO: Convertir XML a hexadecimal para PostgreSQL
    public function procesarXML($xml_content) {
        try {
            $dom = new DOMDocument();
            
            // Verificar que el XML sea válido
            if (!$dom->loadXML($xml_content)) {
                throw new Exception('XML no válido');
            }
            
            $xpath = new DOMXPath($dom);
            
            // Registrar namespaces necesarios para UBL 2.0
            $xpath->registerNamespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
            $xpath->registerNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
            $xpath->registerNamespace('despatch', 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2');
            
            // ✅ MEJORADO: Extraer datos con validación
            $serie = $xpath->query('//cbc:ID');
            if ($serie->length > 0) {
                $this->serie_numero = $serie->item(0)->nodeValue;
            }
            
            $fecha = $xpath->query('//cbc:IssueDate');
            if ($fecha->length > 0) {
                $this->fecha_emision = $fecha->item(0)->nodeValue;
            }
            
            // Extraer RUC y razón social del emisor
            $ruc_emisor = $xpath->query('//cac:DespatchSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID');
            if ($ruc_emisor->length > 0) {
                $this->ruc_emisor = $ruc_emisor->item(0)->nodeValue;
            }
            
            $razon_emisor = $xpath->query('//cac:DespatchSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName');
            if ($razon_emisor->length > 0) {
                $this->razon_social_emisor = $razon_emisor->item(0)->nodeValue;
            }
            
            // Extraer RUC y razón social del destinatario
            $ruc_destinatario = $xpath->query('//cac:DeliveryCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID');
            if ($ruc_destinatario->length > 0) {
                $this->ruc_destinatario = $ruc_destinatario->item(0)->nodeValue;
            }
            
            $razon_destinatario = $xpath->query('//cac:DeliveryCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName');
            if ($razon_destinatario->length > 0) {
                $this->razon_social_destinatario = $razon_destinatario->item(0)->nodeValue;
            }
            
            // Extraer motivo de traslado
            $motivo_desc = $xpath->query('//cbc:HandlingInstructions');
            if ($motivo_desc->length > 0) {
                $this->motivo_traslado = $motivo_desc->item(0)->nodeValue;
            }
            
            // Extraer peso bruto
            $peso = $xpath->query('//cbc:GrossWeightMeasure');
            if ($peso->length > 0) {
                $this->peso_bruto = $peso->item(0)->nodeValue;
            }
            
            // Extraer direcciones
            $partida = $xpath->query('//cac:DespatchAddress/cac:AddressLine/cbc:Line');
            if ($partida->length > 0) {
                $this->punto_partida = $partida->item(0)->nodeValue;
            }
            
            $llegada = $xpath->query('//cac:DeliveryAddress/cac:AddressLine/cbc:Line');
            if ($llegada->length > 0) {
                $this->punto_llegada = $llegada->item(0)->nodeValue;
            }
            
            // Extraer fecha de traslado
            $fecha_traslado = $xpath->query('//cac:TransitPeriod/cbc:StartDate');
            if ($fecha_traslado->length > 0) {
                $this->fecha_traslado = $fecha_traslado->item(0)->nodeValue;
            }

            // Extraer serie y número de la factura relacionada
            $factura = $xpath->query('//cac:AdditionalDocumentReference/cbc:ID');
            if ($factura->length > 0) {
                $this->serie_numero_factura = $factura->item(0)->nodeValue;
            }
            
            // ✅ CRUCIAL: Convertir XML a hexadecimal para PostgreSQL
            $this->contenido_xml = bin2hex($xml_content);
            
            return true;
            
        } catch (Exception $e) {
            error_log('Error procesando XML: ' . $e->getMessage());
            return false;
        }
    }
}
?>