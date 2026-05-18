<?php

/**
 * Generador de PDF para guías de remisión
 * Requiere TCPDF (instalar vía Composer)
 */

// Incluir helper XML
require_once '../helpers/xml_helper.php';
require_once '../assets/TCPDF/tcpdf.php';
require_once '../includes/SpiralPatternHelper.php';

/**
 * Clase para generar PDF de guías de remisión
 */
class GuiaRemisionPDF
{
    private $guia;
    private $pdf;
    private $idGuia;

    /**
     * Constructor
     * 
     * @param string $xmlContent Contenido XML de la guía
     */
    public function __construct($guia)
    {
        // Validar que $guia sea un array y tenga las claves necesarias
        if (!is_array($guia)) {
            throw new InvalidArgumentException('El parámetro $guia debe ser un array');
        }

        if (!isset($guia['contenido_xml']) || empty($guia['contenido_xml'])) {
            throw new InvalidArgumentException('El array $guia debe contener contenido_xml válido');
        }

        if (!isset($guia['id'])) {
            throw new InvalidArgumentException('El array $guia debe contener un id válido');
        }

        // Extraer contenido XML
        $xmlContent = $guia['contenido_xml'];
        $this->idGuia = $guia['id'];

        // ✅ Decodificar XML Hexadecimal de Postgresql 
        $decodedXml = hex2bin($xmlContent);

        // Verificar que la decodificación fue exitosa
        if ($decodedXml === false) {
            throw new Exception('Error al decodificar el contenido XML hexadecimal');
        }

        // Verificar que el resultado es XML válido
        if (substr($decodedXml, 0, 1) !== '<' && substr($decodedXml, 0, 5) !== '<?xml') {
            throw new Exception('El contenido decodificado no es XML válido');
        }

        // Instanciar el helper XML con el string XML decodificado
        $this->guia = new GuiaRemisionXML($decodedXml);

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
        $mainData = $this->guia->getMainData();

        $this->pdf->SetCreator('Sistema de Guías de Remisión');
        $this->pdf->SetAuthor($mainData['nombre_emisor']);
        $this->pdf->SetTitle('Guía de Remisión ' . $mainData['numero_guia']);
        $this->pdf->SetSubject('Guía de Remisión ' . $mainData['numero_guia']);

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
     * Genera el PDF de la guía de remisión
     * 
     * @return string Contenido del PDF en base64
     */
    public function generate()
    {
        // Agregar página
        $this->pdf->AddPage();

        // ✅ APLICAR FONDO DE MARCA DE AGUA CORRECTAMENTE
        SpiralPatternHelper::generatePattern(
            $this->pdf,
            $this->pdf->getPageWidth(),
            $this->pdf->getPageHeight(),
            0.12  // Opacidad muy baja para marca de agua
        );

        // Obtener datos
        $mainData = $this->guia->getMainData();
        $items = $this->guia->getItems();
        $transportista = $this->guia->getTransportista();
        $vehiculo = $this->guia->getVehiculo();

        // Mapeo de motivos de traslado
        $motivos = [
            '01' => 'Venta',
            '02' => 'Compra',
            '04' => 'Traslado entre establecimientos de la misma empresa',
            '05' => 'Consignación',
            '08' => 'Importación',
            '09' => 'Exportación',
            '13' => 'Otros',
            '14' => 'Venta sujeta a confirmación del comprador',
            '18' => 'Traslado emisor itinerante CP',
            '19' => 'Traslado a zona primaria'
        ];

        // Mapeo de modalidad de traslado
        $modalidad = [
            '01' => 'Transporte público',
            '02' => 'Transporte privado'
        ];

        $unidad = [
            'NIU' => 'UNIDAD',
            'ZZ' => 'UNIDAD',
            'C62' => 'PIEZAS',
            'PK' => 'PAQUETE',
            'MLL' => 'MILLARES',
            'KGM' => 'KILOS',
            'BE' => 'FARDO',
            'BX' => 'CAJAS',
            'BG' => 'BOLSA',
            '4A' => 'BOBINAS'
        ];


        $motivoTraslado = isset($motivos[$mainData['motivo_traslado']]) ? $motivos[$mainData['motivo_traslado']] : 'Consignación';
        $modalidadTraslado = isset($modalidad[$mainData['modalidad_traslado']]) ? $modalidad[$mainData['modalidad_traslado']] : 'N/D';

        $x = 10; // Posición X (60 mm desde el borde derecho)
        $y = 10; // Posición Y (10 mm desde el borde superior)
        $w = 30; // Ancho del rectángulo
        $h = 25; // Alto del rectángulo

        // Agregar el logo de la empresa
        $this->pdf->ImageSVG('../assets/img/logo-heinz-azul-2025.svg', $x, $y, $w, $h, 'SVG', '', 'T', false, 300, '', false, false, 0, false, false, false);



        // Coordenadas y dimensiones del rectángulo
        $this->pdf->SetDrawColor(0, 0, 102);
        $this->pdf->SetLineWidth(0.3);
        $x = $this->pdf->getPageWidth() - 76; // Posición X (60 mm desde el borde derecho)
        $y = 10; // Posición Y (10 mm desde el borde superior)
        $w = 70; // Ancho del rectángulo
        $h = 25; // Alto del rectángulo
        $r = 2; // Radio de las esquinas

        // Dibujar el rectángulo con esquinas redondeadas
        $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

        // Ajustar la posición después del logo
        $this->pdf->SetY(8);
        $this->pdf->SetX(50);

        // Cabecera
        $this->pdf->SetFont('helvetica', 'B', 14);
        $this->pdf->SetTextColor(0, 0, 102);
        $this->pdf->Cell(40, 10, $mainData['nombre_emisor'], 0, 1, 'L');

        // Agregar el logo direccion
        $x = 50; // Posición X (60 mm desde el borde derecho)
        $y = 18; // Posición Y (10 mm desde el borde superior)
        $w = 3; // Ancho del rectángulo
        $h = 3; // Alto del rectángulo
        $this->pdf->SetTextColor(0, 0, 0);
        $this->pdf->ImageSVG('../assets/img/location.svg', $x, $y, $w, $h + 1, 'SVG', '', 'T', false, 300, '', false, false, 0, false, false, false);
        $this->pdf->SetXY(54, 14);
        $this->pdf->SetFont('helvetica', '', 7);
        $this->pdf->Cell(60, 10, 'AV. ISABEL CHIMPU OCLLO N°265', 0, 1, 'L');
        $this->pdf->SetXY(54, 17);
        $this->pdf->Cell(60, 10, 'URB. STA. ISABEL CARABAYLLO-LIMA', 0, 1, 'L');
        $this->pdf->ImageSVG('../assets/img/whatsapp.svg', $x, $y + 5.5, $w, $h, 'SVG', '', 'T', false, 300, '', false, false, 0, false, false, false);
        $this->pdf->SetFont('helvetica', '', 8);
        $this->pdf->SetXY(54, 20.5);
        $this->pdf->Cell(60, 10, '+51910876224', 0, 1, 'L');
        $this->pdf->ImageSVG('../assets/img/globe.svg', $x, $y + 10, $w, $h, 'SVG', '', 'T', false, 300, '', false, false, 0, false, false, false);
        $this->pdf->SetXY(54, 24);
        $this->pdf->Cell(60, 10, 'www.heinzsport.com', 0, 1, 'L');
        $this->pdf->ImageSVG('../assets/img/email.svg', $x, $y + 14, $w, $h, 'SVG', '', 'T', false, 300, '', false, false, 0, false, false, false);
        $this->pdf->SetXY(54, 28);
        $this->pdf->Cell(60, 10, 'info@heinzsport.com', 0, 1, 'L');



        $this->pdf->SetXY(140, 10);
        $this->pdf->SetFont('helvetica', '', 10);
        $this->pdf->Cell(0, 10, 'RUC: ' . $mainData['ruc_emisor'], 0, 1, 'C');

        $this->pdf->SetY(19);
        $this->pdf->SetX(137);

        // Título
        //$this->pdf->SetFont('helvetica', 'B', 8);
        //$this->pdf->MultiCell(0, 10, 'GUÍA DE REMISIÓN ELECTRÓNICA REMITENTE', 0, 'C', 0, 1, '', '', true, 0, false, true, 'M');

        $this->pdf->SetFont('helvetica', 'B', 10);
        $this->pdf->SetXY(140, 16);
        $this->pdf->Cell(0, 10, 'GUÍA DE REMISIÓN ELECTRÓNICA', 0, 1, 'C');

        $this->pdf->SetFont('helvetica', 'B', 10);
        $this->pdf->SetXY(140, 21);
        $this->pdf->Cell(0, 10, 'REMITENTE', 0, 1, 'C');


        $this->pdf->SetFont('helvetica', '', 10);
        $this->pdf->SetXY(140, 27);
        $this->pdf->Cell(0, 10, 'N° ' . $mainData['numero_guia'], 0, 1, 'C');

        $this->pdf->Ln(1);

        // Información general
        $this->pdf->SetDrawColor(0, 0, 102);
        $this->pdf->SetLineWidth(0.2);
        // Coordenadas y dimensiones del rectángulo para Información general
        $x = 10; // Posición X (60 mm desde el borde derecho)
        $y = $this->pdf->GetY() + 4; // Posición Y (10 mm desde el borde superior)
        $w = 194; // Ancho del rectángulo
        $h = 15; // Alto del rectángulo
        $r = 2; // Radio de las esquinas
        $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

        $fontSize = 8;

        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->SetFillColor(255, 255, 255);
        $this->pdf->SetX(12);
        $this->pdf->Cell(33, 8, 'Información General', 0, 1, 'L', 1);
        $this->pdf->SetDrawColor(200, 200, 200);
        //$this->pdf->Line(10, $this->pdf->GetY(), 200, $this->pdf->GetY());
        $this->pdf->Ln(-2);

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(30, 6, 'Fecha Emisión:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '',  $fontSize);
        $this->pdf->Cell(30, 6, $this->formatDate($mainData['fecha_emision']), 0, 0, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(30, 6, 'Fecha Traslado:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '',  $fontSize);
        $this->pdf->Cell(35, 6, $this->formatDate($mainData['fecha_traslado']), 0, 1, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(30, 6, 'Motivo Traslado:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '',  $fontSize);
        $this->pdf->Cell(30, 6, $motivoTraslado, 0, 0, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(30, 6, 'Factura:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '',  $fontSize);
        $this->pdf->Cell(35, 6, $mainData['numero_factura'], 0, 0, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(40, 6, 'Modalidad de Traslado:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '',  $fontSize);
        $this->pdf->Cell(20, 6, $modalidadTraslado, 0, 1, 'L');

        //AQUI ERA PESO

        $this->pdf->Ln(2);

        // Datos del destinatario
        // Coordenadas y dimensiones del rectángulo para Datos del destinatario
        $this->pdf->SetDrawColor(0, 0, 102);
        $this->pdf->SetLineWidth(0.2);
        $x = 10; // Posición X (60 mm desde el borde derecho)
        $y = $this->pdf->GetY() + 4; // Posición Y (10 mm desde el borde superior)
        $w = 194; // Ancho del rectángulo
        $h = 15; // Alto del rectángulo
        $r = 2; // Radio de las esquinas
        $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->SetFillColor(255, 255, 255);
        $this->pdf->SetX(12);
        $this->pdf->Cell(36, 8, 'Datos del Destinatario', 0, 1, 'L', 1);
        $this->pdf->SetDrawColor(200, 200, 200);
        //$this->pdf->Line(10, $this->pdf->GetY(), 200, $this->pdf->GetY());
        // Dibujar el rectángulo con esquinas redondeadas
        $this->pdf->Ln(-2);

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(40, 6, 'Razón Social:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->MultiCell(0, 6, $mainData['nombre_receptor'], 0, 'L', 0, 1);

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(40, 6, 'RUC:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(60, 6, $mainData['ruc_receptor'], 0, 0, 'L');

        $this->pdf->Ln(8);

        // Datos del traslado
        // Coordenadas y dimensiones del rectángulo para Datos del destinatario
        $this->pdf->SetDrawColor(0, 0, 102);
        $this->pdf->SetLineWidth(0.2);
        $x = 10; // Posición X (60 mm desde el borde derecho)
        $y = $this->pdf->GetY() + 4; // Posición Y (10 mm desde el borde superior)
        $w = 194; // Ancho del rectángulo
        $h = 15; // Alto del rectángulo
        $r = 2; // Radio de las esquinas
        $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->SetFillColor(255, 255, 255);
        $this->pdf->SetX(12);
        $this->pdf->Cell(30, 8, 'Datos del Traslado', 0, 1, 'L', 1);
        $this->pdf->SetDrawColor(200, 200, 200);
        //$this->pdf->Line(10, $this->pdf->GetY(), 200, $this->pdf->GetY());
        $this->pdf->Ln(-2);

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(40, 6, 'Punto de Partida:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(0, 6, $mainData['punto_partida'], 0, 1, 'L');

        $this->pdf->SetFont('helvetica', 'B', $fontSize);
        $this->pdf->Cell(40, 6, 'Punto de Llegada:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(0, 6, $mainData['punto_llegada'], 0, 1, 'L');


        $this->pdf->Ln(1);

        // Detalle de ítems
        $this->pdf->SetFont('helvetica', 'B', 9);
        $this->pdf->Cell(0, 8, 'Bienes por transportar:', 0, 1, 'L');
        $this->pdf->SetDrawColor(0, 0, 0);
        //$this->pdf->Line(10, $this->pdf->GetY(), 200, $this->pdf->GetY());
        $this->pdf->Ln(0);

        // Tabla de ítems
        $h = 6; // Alto del rectángulo
        $this->pdf->SetFillColor(204, 204, 204);
        $this->pdf->SetFont('helvetica', 'B', 10);
        $this->pdf->Cell(6, $h, 'N°', 1, 0, 'C', 1);
        $this->pdf->Cell(19, $h, 'CANTIDAD', 1, 0, 'C', 1);
        $this->pdf->Cell(17, $h, 'UNIDAD', 1, 0, 'C', 1);
        $this->pdf->Cell(152, $h, 'DESCRIPCIÓN', 1, 1, 'C', 1);

        $this->pdf->SetFont('helvetica', '', 10);
        $height = $this->pdf->getLastH() - 1;
        foreach ($items as $item) {
            // Calcular altura necesaria para la descripción
            //$height = $this->pdf->getLastH() -1;
            $startY = $this->pdf->GetY();

            // Si no cabe en la página, agregar página nueva
            if ($startY + $height > 270) {
                $this->pdf->AddPage();
                $startY = $this->pdf->GetY();
            }

            // Dibujar celdas
            $this->pdf->SetY($startY);
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(6, $height, $item['itemID'], 1, 0, 'C');
            $this->pdf->Cell(19, $height, $item['cantidad'], 1, 0, 'C');
            $this->pdf->Cell(17, $height, $unidad[$item['unidad']], 1, 0, 'C');

            // Descripción con MultiCell
            $this->pdf->MultiCell(152, $height, $item['descripcion'], 1, 'L', 0, 1, '', '', true, 0, false, true, $height, 'M');
        }

        //peso

        $this->pdf->SetFont('helvetica', 'B', 10);
        $this->pdf->Cell(40, 6, 'Peso Bruto total:', 0, 0, 'L');
        $this->pdf->SetFont('helvetica', '', $fontSize);
        $this->pdf->Cell(0, 6, $mainData['peso_bruto'] . ' ' . $mainData['unidad_medida_peso'], 0, 1, 'L');

        // Si hay datos de transportista
        if (!empty($transportista['ruc_transporte'])) {
            $this->pdf->Ln(2);

            // Coordenadas y dimensiones del rectángulo para Datos del destinatario
            $this->pdf->SetDrawColor(0, 0, 102);
            $this->pdf->SetLineWidth(0.2);
            $x = 10; // Posición X (60 mm desde el borde derecho)
            $y = $this->pdf->GetY() + 4; // Posición Y (10 mm desde el borde superior)
            $w = 194; // Ancho del rectángulo
            $h = 17; // Alto del rectángulo
            $r = 2; // Radio de las esquinas
            $this->pdf->RoundedRect($x, $y, $w, $h, $r, '1111', 'D');

            $this->pdf->SetFont('helvetica', 'B', 9);
            $this->pdf->SetFillColor(255, 255, 255);
            $this->pdf->SetX(12);
            $this->pdf->Cell(38, 8, 'Datos del Transportista', 0, 1, 'L', 1);
            //$this->pdf->SetDrawColor(200, 200, 200);
            //$this->pdf->Line(10, $this->pdf->GetY(), 200, $this->pdf->GetY());
            $this->pdf->Ln(-2);

            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(40, 6, 'Razón Social:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->MultiCell(0, 6, $transportista['nombre_transporte'], 0, 'L', 0, 1);

            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(40, 6, 'RUC:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(60, 6, $transportista['ruc_transporte'], 0, 0, 'L');

            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(40, 6, 'Licencia MTC:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(0, 6, $transportista['licencia'], 0, 1, 'L');
        }

        // Si hay datos de vehículo
        if (!empty($vehiculo['placa'])) {
            $this->pdf->SetFont('helvetica', 'B', $fontSize);
            $this->pdf->Cell(40, 6, 'Placa:', 0, 0, 'L');
            $this->pdf->SetFont('helvetica', '', $fontSize);
            $this->pdf->Cell(0, 6, $vehiculo['placa'], 0, 1, 'L');
        }

        // Generar el código QR con el RUC del emisor
        $qrContent = 'https://facturacion.heinzsport.com/backend/api/guiaDownload.php?id=' . strval($this->idGuia);

        // Posicionar el QR en la parte inferior izquierda
        $x = 10; // Coordenada X (margen izquierdo)
        $y = $this->pdf->getPageHeight() - 40; // Coordenada Y (40 mm desde el borde inferior)
        $w = 30;
        $h = 30;
        // Definir estilo del QR con color personalizado
        $style = array(
            'border' => 2,                    // Grosor del borde (0 = sin borde)
            'vpadding' => 'auto',                 // Padding vertical valor= 10
            'hpadding' => 'auto',                 // Padding horizontal valor= 10
            'fgcolor' => array(0, 0, 102),    // Color del QR (tu azul)
            'bgcolor' => array(255, 255, 255), // Color de fondo
            'module_width' => 1,              // Ancho de cada módulo Módulos más grandes = mejor legibilidad
            'module_height' => 1              // Alto de cada módulo
        );
        // Generar QR con estilo personalizado
        $this->pdf->write2DBarcode($qrContent, 'QRCODE,M', $x, $y, $w, $h, $style, 'N');

        $this->pdf->SetXY(60, -18);
        $this->pdf->SetFont('helvetica', 'I', $fontSize);
        $this->pdf->MultiCell(0, 8, 'Esta es una representación impresa sin valor tributario de la Guia de Remisión Electrónica generada en el sistema de la SUNAT. Puede verificarla utilizando su clave SOL ' . ' | Página ' . $this->pdf->PageNo() . ' de ' . $this->pdf->getAliasNbPages(), 0, 'L', 0, 1);
        //$this->pdf->Cell(0, 10, 'Esta es una representación impresa sin valor tributario de la Guia de Remisión Electrónica generada en el sistema de la SUNAT. Puede verificarla utilizando su clave SOL', 0, false, 'L', 0, '', 0, false, 'T','M');
        //Pie de pagina footer:
        //$this->pdf->SetY(-14);
        //$this->pdf->footer();

        {


            //$this->pdf->Cell(0, 10, 'Esta es una representación impresa sin valor tributario de la Guia de Remisión Electrónica.', 0, false, 'L', 0, '', 0, false, 'T','M');


            //$this->pdf->SetX(45);
            //$this->pdf->getPageHeight()-20;
            //$this->pdf->SetFont('helvetica', 'I', $fontSize);
            //$this->pdf->Cell(0, 13, 'Página '.$this->pdf->PageNo().' de '.$this->pdf->getAliasNbPages(), 0, false, 'R', 0, '', 0, false, 'T','M');
        }

        // Generar salida
        return base64_encode($this->pdf->Output('guia_' . str_replace(['/', '-'], '-', $mainData['numero_guia']) . '.pdf', 'S'));
    }

    /**
     * Formatea una fecha de YYYY-MM-DD a DD/MM/YYYY
     * 
     * @param string $date Fecha en formato YYYY-MM-DD
     * @return string Fecha formateada
     */
    private function formatDate($date)
    {
        if (empty($date)) {
            return '';
        }

        $parts = explode('-', $date);
        if (count($parts) !== 3) {
            return $date;
        }

        return $parts[2] . '/' . $parts[1] . '/' . $parts[0];
    }
}
