/**
 * OdooGraphView.js
 * 
 * Clase genérica para renderizar gráficos al estilo Odoo usando Chart.js
 */

export class OdooGraphView {
    constructor(api, containerId, config = {}) {
        this.api = api;
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        this.config = {
            defaultMeasure: 'monto_total',
            defaultGroupBy: 'fecha_mes', // 'cliente' o 'fecha_mes'
            defaultType: 'bar', // 'bar', 'line', 'pie'
            onFetchData: async () => ({ items: [] }),
            ...config
        };

        this.currentMeasure = this.config.defaultMeasure;
        this.currentGroupBy = this.config.defaultGroupBy;
        this.currentType = this.config.defaultType;
        this.chartInstance = null;
    }

    init() {
        if (!this.container) return;
        this.renderUI();
    }

    renderUI() {
        this.container.innerHTML = `
            <div class="o-graph-controls mb-3 d-flex gap-2 align-items-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-secondary ${this.currentType === 'bar' ? 'active' : ''}" data-type="bar" title="Barras"><i class="fa-solid fa-chart-column"></i></button>
                    <button type="button" class="btn btn-outline-secondary ${this.currentType === 'line' ? 'active' : ''}" data-type="line" title="Líneas"><i class="fa-solid fa-chart-line"></i></button>
                    <button type="button" class="btn btn-outline-secondary ${this.currentType === 'pie' ? 'active' : ''}" data-type="pie" title="Pastel"><i class="fa-solid fa-chart-pie"></i></button>
                </div>
                
                <select class="form-select form-select-sm w-auto d-inline-block" id="graph-measure-select">
                    <option value="monto_total" ${this.currentMeasure === 'monto_total' ? 'selected' : ''}>Monto Total</option>
                    <option value="amount_untaxed" ${this.currentMeasure === 'amount_untaxed' ? 'selected' : ''}>Subtotal (Sin IGV)</option>
                    <option value="amount_tax" ${this.currentMeasure === 'amount_tax' ? 'selected' : ''}>IGV</option>
                    <option value="count" ${this.currentMeasure === 'count' ? 'selected' : ''}>Recuento</option>
                </select>

                <select class="form-select form-select-sm w-auto d-inline-block" id="graph-groupby-select">
                    <option value="fecha_anio" ${this.currentGroupBy === 'fecha_anio' ? 'selected' : ''}>Por Año</option>
                    <option value="fecha_mes" ${this.currentGroupBy === 'fecha_mes' ? 'selected' : ''}>Por Mes</option>
                    <option value="cliente" ${this.currentGroupBy === 'cliente' ? 'selected' : ''}>${window.currentModule === 'in_invoice' ? 'Por Proveedor' : 'Por Cliente'}</option>
                    <option value="estado" ${this.currentGroupBy === 'estado' ? 'selected' : ''}>Por Estado</option>
                    <option value="tipo_comprobante" ${this.currentGroupBy === 'tipo_comprobante' ? 'selected' : ''}>Por Tipo de Comprobante</option>
                </select>
            </div>
            <div style="position: relative; height:400px; width:100%">
                <canvas id="odoo-chart-canvas"></canvas>
            </div>
        `;

        this.setupEvents();
    }

    setupEvents() {
        // Tipos de gráfico
        const typeBtns = this.container.querySelectorAll('[data-type]');
        typeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                typeBtns.forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                this.currentType = target.dataset.type;
                this.updateChart();
            });
        });

        // Medidas
        const measureSelect = this.container.querySelector('#graph-measure-select');
        measureSelect.addEventListener('change', (e) => {
            this.currentMeasure = e.target.value;
            this.loadData();
        });

        // Agrupación
        const groupbySelect = this.container.querySelector('#graph-groupby-select');
        groupbySelect.addEventListener('change', (e) => {
            this.currentGroupBy = e.target.value;
            document.dispatchEvent(new CustomEvent('odooGroupByChanged', { detail: { groupBy: this.currentGroupBy, source: 'graph' } }));
            this.loadData();
        });
    }

    async loadData(filters = {}) {
        if (!this.container) return;
        
        try {
            // Mostrar un indicador de carga en el canvas
            const result = await this.config.onFetchData(filters, [this.currentGroupBy], [this.currentMeasure]);
            this.currentData = result.data || result;
            this.updateChart();
        } catch (err) {
            console.error("Error al cargar datos del gráfico:", err);
        }
    }

    updateChart() {
        const canvas = document.getElementById('odoo-chart-canvas');
        if (!canvas || !window.Chart) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const labels = this.currentData.map(item => item[this.currentGroupBy] || 'Desconocido');
        const dataValues = this.currentData.map(item => parseFloat(item[this.currentMeasure]) || 0);
        
        let measureLabel = "Valor";
        const measureSelect = this.container.querySelector('#graph-measure-select');
        if (measureSelect && measureSelect.options[measureSelect.selectedIndex]) {
            measureLabel = measureSelect.options[measureSelect.selectedIndex].text;
        }

        const ctx = canvas.getContext('2d');
        
        // Colores Odoo
        const brandPurple = '#714b97';
        const brandPurpleLight = 'rgba(113, 75, 151, 0.5)';
        
        // Generar paleta de colores para pie chart
        const pieColors = labels.map((_, i) => `hsl(${(i * 137.508) % 360}, 70%, 50%)`);

        const isPie = this.currentType === 'pie';

        this.chartInstance = new Chart(ctx, {
            type: this.currentType,
            data: {
                labels: labels,
                datasets: [{
                    label: measureLabel,
                    data: dataValues,
                    backgroundColor: isPie ? pieColors : brandPurpleLight,
                    borderColor: isPie ? '#ffffff' : brandPurple,
                    borderWidth: 1,
                    fill: this.currentType === 'line',
                    tension: 0.1 // Suavizado para lineas
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: isPie, // Solo mostrar leyenda en pie chart
                        position: 'right'
                    }
                },
                scales: isPie ? {} : {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}
