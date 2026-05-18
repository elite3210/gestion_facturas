<?php

/**
 * Generador de PDF para facturas electrónicas
 *  este archivo no genera marca de agua, es en blanco y el archivo pdf generado tiene un peso de 16KB
 * Requiere TCPDF
 */

// Incluir helper XML
require_once '../helpers/factura_xml_helper.php';
require_once '../assets/TCPDF/tcpdf.php';

/**
 * Clase para generar PDF de facturas electrónicas
 */
class FacturaElectronicaPDF
{
    private $factura;
    private $pdf;
    private $idFactura;

    /**
     * Constructor
     * 
     * @param array $factura Array con datos de la factura (id, numero_factura, contenido_xml)
     */
    public function __construct($factura)
    {
        // Validar que $factura sea un array y tenga las claves necesarias
        if (!is_array($factura)) {
            throw new InvalidArgumentException('El parámetro $factura debe ser un array');
        }

        if (!isset($factura['contenido_xml']) || empty($factura['contenido_xml'])) {
            throw new InvalidArgumentException('El array $factura debe contener contenido_xml válido');
        }

        if (!isset($factura['id'])) {
            throw new InvalidArgumentException('El array $factura debe contener un id válido');
        }

        // Extraer contenido XML
        $xmlContent = $factura['contenido_xml'];
        $this->idFactura = $factura['id'];

        // ✅ DECODIFICAR XML HEXADECIMAL
        if (ctype_xdigit($xmlContent) && strlen($xmlContent) % 2 === 0) {
            $decodedXml = hex2bin($xmlContent);
        } else {
            $decodedXml = $xmlContent; // Ya está decodificado
        }

        // Verificar que la decodificación fue exitosa
        if ($decodedXml === false) {
            throw new Exception('Error al decodificar el contenido XML hexadecimal');
        }

        // Verificar que el resultado es XML válido
        if (substr($decodedXml, 0, 1) !== '<' && substr($decodedXml, 0, 5) !== '<?xml') {
            throw new Exception('El contenido decodificado no es XML válido');
        }

        // Instanciar el helper XML con el string XML decodificado
        $this->factura = new FacturaElectronicaXML($decodedXml);

        // Crear instancia de TCPDF
        $this->pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);

        // Configurar documento
        $this->setupDocument();
    }

    /**
     * Configura el documento PDF
     */
    private function setupDocument()
    {
        // Establecer información del documento
        $mainData = $this->factura->getMainData();

        $this->pdf->SetCreator('Sistema de Facturas Electrónicas');
        $this->pdf->SetAuthor($mainData['razon_social_emisor']);
        $this->pdf->SetTitle('Factura Electrónica ' . $mainData['serie_numero']);
        $this->pdf->SetSubject('Factura Electrónica ' . $mainData['serie_numero']);

        // Eliminar cabecera y pie de página
        $this->pdf->setPrintHeader(false);
        $this->pdf->setPrintFooter(false);

        // Establecer márgenes
        $this->pdf->SetMargins(10, 10, 10);

        // Establecer salto de página automático
        $this->pdf->SetAutoPageBreak(true, 10);

        // Establecer fuente
        $this->pdf->SetFont('helvetica', '', 10);
    }

    /**
     * Genera el PDF de la factura electrónica
     * 
     * @return string Contenido del PDF en base64
     */
    public function generate()
    {
        // Agregar página
        $this->pdf->AddPage();

        // Obtener datos
        $mainData = $this->factura->getMainData();
        $totales = $this->factura->getTotales();
        $detalles = $this->factura->getDetalles();
        $pagos = $this->factura->getPagos();

        // Mapeos
        $tiposDocumento = [
            '01' => 'FACTURA',
            '03' => 'BOLETA DE VENTA',
            '07' => 'NOTA DE CRÉDITO',
            '08' => 'NOTA DE DÉBITO'
        ];

        $unidades = [
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

        $tipoDocumentoNombre = isset($tiposDocumento[$mainData['tipo_documento']]) 
            ? $tiposDocumento[$mainData['tipo_documento']] 
            : 'COMPROBANTE ELECTRÓNICO';

        // ENCABEZADO
        $this->drawHeader($mainData, $tipoDocumentoNombre);

        // DATOS DEL CLIENTE
        $this->drawClientData($mainData);

        // CONDICIONES DE VENTA
        $this->drawSaleConditions($mainData, $pagos);

        // DETALLE DE PRODUCTOS
        $this->drawProductDetails($detalles, $unidades);

        // TOTALES
        $this->drawTotals($totales, $mainData);

        // PIE DE PÁGINA
        $this->drawFooter($mainData);

        // Generar salida
        return base64_encode($this->pdf->Output('factura_' . str_replace(['/', '-'], '_', $mainData['serie_numero']) . '.pdf', 'S'));
    }

    /**
     * Dibuja el encabezado de la factura
     */
    private function drawHeader($mainData, $tipoDocumentoNombre)
    {
        // Logo de la empresa
        $x = 10; $y = 10; $w = 30; $h = 25;
        $this->pdf->ImageSVG('../assets/img/logo-heinz-azul-2025.svg', $x, $y, $w, $h);

        // Rectángulo del RUC y tipo de documento
        $this->pdf->SetDrawColor(0, 0, 102);
        $this->pdf->SetLineWidth(0.3);
        $x = $this->pdf->getPageWidth() - 76;
        $y = 10; $w = 70; $h = 35; $r = 2;
        $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

        // Información de la empresa
        $this->pdf->SetXY(50, 8);
        $this->pdf->SetFont('helvetica', 'B', 14);
        $this->pdf->SetTextColor(0, 0, 102);
        $this->pdf->Cell(40, 10, $mainData['razon_social_emisor'], 0, 1, 'L');

        // Información de contacto
        $this->drawContactInfo();

        // RUC y tipo de documento
        $this->pdf->SetXY(140, 12);
        $this->pdf->SetFont('helvetica', '', 10);
        $this->pdf->SetTextColor(0, 0, 0);
        $this->pdf->Cell(0, 5, 'RUC: ' . $mainData['ruc_emisor'], 0, 1, 'C');

        $this->pdf->SetXY(140, 18);
        $this->pdf->SetFont('helvetica', 'B', 10);
        $this->pdf->Cell(0, 5, $tipoDocumentoNombre, 0, 1, 'C');

        $this->pdf->SetXY(140, 24);
        $this->pdf->SetFont('helvetica', 'B', 11);
        $this->pdf->Cell(0, 5, $mainData['serie_numero'], 0, 1, 'C');

        $this->pdf->Ln(5);
    }

    /**
     * Dibuja información de contacto
     */
    private function drawContactInfo()
    {
        $x = 50; $y = 18; $w = 3; $h = 3;

        // Dirección
        $this->pdf->ImageSVG('../assets/img/location.svg', $x, $y, $w, $h);
        $this->pdf->SetXY(54, 14);
        $this->pdf->SetFont('helvetica', '', 7);
        $this->pdf->SetTextColor(0, 0, 0);
        $this->pdf->Cell(60, 10, 'AV. ISABEL CHIMPU OCLLO N°265', 0, 1, 'L');
        $this->pdf->SetXY(54, 17);
        $this->pdf->Cell(60, 10, 'URB. STA. ISABEL CARABAYLLO-LIMA', 0, 1, 'L');

        // WhatsApp
        $this->pdf->ImageSVG('../assets/img/whatsapp.svg', $x, $y + 5.5, $w, $h);
        $this->pdf->SetFont('helvetica', '', 8);
        $this->pdf->SetXY(54, 20.5);
        $this->pdf->Cell(60, 10, '+51910876224', 0, 1, 'L');

        // Website
        $this->pdf->ImageSVG('../assets/img/globe.svg', $x, $y + 10, $w, $h);
        $this->pdf->SetXY(54, 24);
        $this->pdf->Cell(60, 10, 'www.heinzsport.com', 0, 1, 'L');

        // Email
        $this->pdf->ImageSVG('../assets/img/email.svg', $x, $y + 14, $w, $h);
        $this->pdf->SetXY(54, 28);
        $this->pdf->Cell(60, 10, 'info@heinzsport.com', 0, 1, 'L');
    }

    /**
     * Dibuja datos del cliente
     */
    private function drawClientData($mainData)
    {
        $this->drawSection('Datos del Cliente', 20);

        $fontSize = 8;
        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(25, 6, 'Cliente:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(100, 6, $mainData['razon_social_receptor'], 0, 0, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(20, 6, 'RUC:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(0, 6, $mainData['ruc_receptor'], 0, 1, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(25, 6, 'Dirección:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(0, 6, $mainData['direccion_receptor'], 0, 1, 'L');

        $this->pdf->Ln(3);
    }

    /**
     * Dibuja condiciones de venta
     */
    private function drawSaleConditions($mainData, $pagos)
    {
        $this->drawSection('Condiciones de Venta', 15);

        $fontSize = 8;
        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(25, 6, 'Fecha Emisión:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(40, 6, $this->formatDate($mainData['fecha_emision']), 0, 0, 'L');

        if (!empty($mainData['fecha_vencimiento'])) {
            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(25, 6, 'Fecha Venc.:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(40, 6, $this->formatDate($mainData['fecha_vencimiento']), 0, 0, 'L');
        }

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(20, 6, 'Moneda:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(0, 6, $mainData['moneda'], 0, 1, 'L');

        if (!empty($mainData['guia_remision'])) {
            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(25, 6, 'Guía Remisión:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(40, 6, $mainData['guia_remision'], 0, 0, 'L');
        }

        if (!empty($mainData['orden_compra'])) {
            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(25, 6, 'Orden Compra:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(0, 6, $mainData['orden_compra'], 0, 1, 'L');
        }

        $this->pdf->Ln(3);
    }

    /**
     * Dibuja detalle de productos
     */
    private function drawProductDetails($detalles, $unidades)
    {
        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->Cell(0, 8, 'Detalle de Productos/Servicios:', 0, 1, 'L');

        // Cabecera de tabla
        $h = 6;
        $this->pdf->SetFillColor(204, 204, 204);
        $this->pdf->SetFont('helvetica', 'B', 8);
        $this->pdf->Cell(8, $h, 'ITEM', 1, 0, 'C', 1);
        $this->pdf->Cell(15, $h, 'CANT.', 1, 0, 'C', 1);
        $this->pdf->Cell(12, $h, 'UND', 1, 0, 'C', 1);
        $this->pdf->Cell(80, $h, 'DESCRIPCIÓN', 1, 0, 'C', 1);
        $this->pdf->Cell(20, $h, 'P.UNIT', 1, 0, 'C', 1);
        $this->pdf->Cell(20, $h, 'IGV', 1, 0, 'C', 1);
        $this->pdf->Cell(25, $h, 'IMPORTE', 1, 1, 'C', 1);

        // Contenido de tabla
        $this->pdf->SetFont('helvetica', '', 7);
        $this->pdf->SetFillColor(255, 255, 255);

        foreach ($detalles as $detalle) {
            $startY = $this->pdf->GetY();

            // Si no cabe en la página, agregar página nueva
            if ($startY + 8 > 270) {
                $this->pdf->AddPage();
                $startY = $this->pdf->GetY();
            }

            $unidadTexto = isset($unidades[$detalle['unidad_medida']]) 
                ? $unidades[$detalle['unidad_medida']] 
                : $detalle['unidad_medida'];

            $this->pdf->Cell(8, 8, $detalle['numero_item'], 1, 0, 'C');
            $this->pdf->Cell(15, 8, number_format($detalle['cantidad'], 2), 1, 0, 'R');
            $this->pdf->Cell(12, 8, $unidadTexto, 1, 0, 'C');
            
            // Descripción con MultiCell simulada
            $descripcion = $this->truncateText($detalle['descripcion'], 50);
            $this->pdf->Cell(80, 8, $descripcion, 1, 0, 'L');
            
            $this->pdf->Cell(20, 8, number_format($detalle['precio_unitario'], 2), 1, 0, 'R');
            $this->pdf->Cell(20, 8, number_format($detalle['igv'], 2), 1, 0, 'R');
            $this->pdf->Cell(25, 8, number_format($detalle['valor_venta'], 2), 1, 1, 'R');
        }

        $this->pdf->Ln(3);
    }

    /**
     * Dibuja totales de la factura
     */
    private function drawTotals($totales, $mainData)
    {
        // Totales en texto
        if (!empty($mainData['total_letras'])) {
            $this->pdf->SetFont('helvetica', 'B', 8);
            $this->pdf->Cell(25, 6, 'Son:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', 8);
            $this->pdf->MultiCell(120, 6, $mainData['total_letras'], 1, 'L');
            $this->pdf->Ln(2);
        }

        // Tabla de totales
        $x = 120; // Posición X para la tabla de totales
        $this->pdf->SetXY($x, $this->pdf->GetY());

        $this->pdf->SetFont('helvetica', 'B', 8);
        $this->pdf->SetFillColor(240, 240, 240);

        // Subtotal
        if (!empty($totales['total_gravadas'])) {
            $this->pdf->Cell(40, 6, 'Op. Gravadas:', 1, 0, 'L', 1);
            $this->pdf->Cell(30, 6, $mainData['moneda'] . ' ' . number_format($totales['total_gravadas'], 2), 1, 1, 'R', 1);
            $this->pdf->SetX($x);
        }

        // Exoneradas
        if (!empty($totales['total_exoneradas']) && $totales['total_exoneradas'] > 0) {
            $this->pdf->Cell(40, 6, 'Op. Exoneradas:', 1, 0, 'L', 1);
            $this->pdf->Cell(30, 6, $mainData['moneda'] . ' ' . number_format($totales['total_exoneradas'], 2), 1, 1, 'R', 1);
            $this->pdf->SetX($x);
        }

        // IGV
        if (!empty($totales['total_igv'])) {
            $this->pdf->Cell(40, 6, 'IGV (18%):', 1, 0, 'L', 1);
            $this->pdf->Cell(30, 6, $mainData['moneda'] . ' ' . number_format($totales['total_igv'], 2), 1, 1, 'R', 1);
            $this->pdf->SetX($x);
        }

        // Total
        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->SetFillColor(200, 200, 200);
        $this->pdf->Cell(40, 8, 'TOTAL:', 1, 0, 'L', 1);
        $this->pdf->Cell(30, 8, $mainData['moneda'] . ' ' . number_format($totales['total_precio_venta'], 2), 1, 1, 'R', 1);

        $this->pdf->Ln(5);
    }

    /**
     * Dibuja pie de página
     */
    private function drawFooter($mainData)
    {
        // Código QR
        $qrContent = 'https://www.heinzsport.com/facturacion/backend/api/facturaDownload.php?id=' . $this->idFactura;
        $x = 10; $y = $this->pdf->getPageHeight() - 40; $w = 30; $h = 30;
        $this->pdf->write2DBarcode($qrContent, 'QRCODE,M', $x, $y, $w, $h, null, 'N');

        // Texto legal
        $this->pdf->SetXY(50, $this->pdf->getPageHeight() - 25);
        $this->pdf->SetFont('helvetica', 'I', 7);
        $this->pdf->MultiCell(0, 4, 
            'Esta es una representación impresa de la Factura Electrónica generada desde los sistemas de ' .
            $mainData['razon_social_emisor'] . '. Consulte su validez en www.sunat.gob.pe', 
            0, 'L');
    }

    /**
     * Dibuja una sección con borde
     */
    private function drawSection($title, $height)
    {
        $this->pdf->SetDrawColor(0, 0, 102);
        $this->pdf->SetLineWidth(0.2);
        $x = 10; $y = $this->pdf->GetY() + 2; $w = 194; $h = $height; $r = 2;
        $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->SetFillColor(255, 255, 255);
        $this->pdf->SetX(12);
        $this->pdf->Cell(strlen($title) * 2, 8, $title, 0, 1, 'L', 1);
        $this->pdf->Ln(-2);
    }

    /**
     * Formatea una fecha de YYYY-MM-DD a DD/MM/YYYY
     */
    private function formatDate($date)
    {
        if (empty($date)) return '';
        $parts = explode('-', $date);
        if (count($parts) !== 3) return $date;
        return $parts[2] . '/' . $parts[1] . '/' . $parts[0];
    }

    /**
     * Trunca texto si es muy largo
     */
    private function truncateText($text, $maxLength)
    {
        return strlen($text) > $maxLength ? substr($text, 0, $maxLength - 3) . '...' : $text;
    }
}
?>