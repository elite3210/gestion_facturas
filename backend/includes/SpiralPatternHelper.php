<?php
require_once '../assets/TCPDF/tcpdf.php';
// ============================================================================
// ✅ CLASE HELPER MEJORADA - CON ARCOS SEPARADOS (SIN LÍNEAS RECTAS)
// ============================================================================

/**
 * Clase helper optimizada para generar patrón de espiral SIN líneas rectas no deseadas
 */
class SpiralPatternHelper
{
    /**
     * ✅ NUEVA FUNCIÓN OPTIMIZADA - Genera patrón como arcos separados
     * Soluciona el problema de líneas rectas que cruzaban la página
     * 
     * @param TCPDF $pdf Instancia de TCPDF donde dibujar
     * @param float $width Ancho de la página
     * @param float $height Alto de la página
     * @param float $opacity Opacidad del patrón (0.05 - 0.2)
     */

    /**
     * ✅ Dibuja un arco continuo de puntos conectados
     */
    private static function drawContinuousArc($pdf, $arc_points)
    {
        if (count($arc_points) < 2) return;

        // Dibujar líneas conectadas dentro del arco
        for ($i = 0; $i < count($arc_points) - 1; $i++) {
            $pdf->Line(
                $arc_points[$i][0],
                $arc_points[$i][1],
                $arc_points[$i + 1][0],
                $arc_points[$i + 1][1]
            );
        }
    }

    /**
     * ✅ VERSIÓN ULTRA-LIGERA para archivos más pequeños
     * 
     * Dibuja una espiral como múltiples arcos separados
     * Esto evita las líneas rectas no deseadas
     */
    public static function generatePattern($pdf, $width, $height, $opacity = 0.15)
    {
        $center_x = $width / 2;
        $center_y = -$height / 1 + 205;
        $max_radius = min($width, $height) / 4; // Radio más pequeño

        $num_spirals = 20;        // Menos espirales
        $noise_factor = 0.60;     // Menos ruido
        $max_arc_length = 40;     // Arcos más cortos

        $margin = 1;
        $min_x = $margin;
        $max_x = $width - $margin;
        $min_y = $margin;
        $max_y = $height - $margin;

        for ($spiral_idx = 0; $spiral_idx < $num_spirals; $spiral_idx++) {
            $radius_offset = $spiral_idx * ($max_radius / $num_spirals);

            $current_arc = [];// Arco actual en construcción

            // Color más claro para efecto más sutil
            $pdf->SetDrawColor(240, 240, 240); // Color uniforme
            $pdf->SetLineWidth(0.2); // Grosor de línea más delgado

            // Generar puntos de la espiral
            for ($angle_step = 0; $angle_step < 27000; $angle_step += 6) { // Menos denso
                $rad = deg2rad($angle_step / 10.0);

                // Espiral logarítmica con ruido fractal
                $r = $radius_offset + ($angle_step / 120) * 1.8;
                $noise = $noise_factor * 15 * sin($rad * 12) * cos($rad * 18);
                $r += $noise;

                // Coordenadas polares → cartesianas
                $x = $center_x + $r * cos($rad);
                $y = $center_y + $r * sin($rad);

                // ✅ LÓGICA CLAVE: DETECTAR SI EL PUNTO ESTÁ DENTRO DE LOS LÍMITES SEGUROS
                if ($x >= $min_x && $x <= $max_x && $y >= $min_y && $y <= $max_y) {
                    // ✅ Punto dentro del área segura: agregarlo al arco actual
                    $current_arc[] = [$x, $y];

                    // Si el arco alcanza el tamaño máximo, dibujarlo y empezar uno nuevo
                    if (count($current_arc) >= $max_arc_length) {
                        self::drawContinuousArc($pdf, $current_arc);
                        // Continuar desde los últimos 2 puntos para suavidad
                        $current_arc = [
                            $current_arc[count($current_arc) - 2],
                            $current_arc[count($current_arc) - 1]
                        ];
                    }
                } else {
                    // ❌ Punto fuera del área segura: TERMINAR arco actual y empezar nuevo
                    if (count($current_arc) > 2) {
                        self::drawContinuousArc($pdf, $current_arc);
                    }
                    $current_arc = [];// ✅ REINICIAR arco - ESTO evita las líneas rectas
                }
            }

            // Dibujar el último arco si tiene puntos suficientes
            if (count($current_arc) > 2) {
                self::drawContinuousArc($pdf, $current_arc);
            }
        }
    }
}
