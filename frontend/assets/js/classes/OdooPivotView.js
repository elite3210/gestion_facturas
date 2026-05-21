/**
 * OdooPivotView.js
 * 
 * Clase genérica para renderizar una tabla dinámica estilo Odoo con soporte de filas y columnas.
 */

export class OdooPivotView {
    constructor(api, containerId, config = {}) {
        this.api = api;
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        this.config = {
            defaultMeasures: ['monto_total', 'count'], // array of measures
            defaultRowGroup: 'cliente',
            defaultColGroup: 'none', 
            onFetchData: async () => ({ items: [] }),
            ...config
        };

        this.currentMeasures = this.config.defaultMeasures;
        this.currentRowGroup = this.config.defaultRowGroup;
        this.currentColGroup = this.config.defaultColGroup; // 'none', 'fecha_anio_mes', etc.
        this.expandedColKeys = new Set(); // Para llevar el registro de qué años están expandidos
        this.currentData = [];
    }

    init() {
        if (!this.container) return;
        this.renderUI();
    }

    renderUI() {
        this.container.innerHTML = `
            <div class="o-pivot-controls mb-3 d-flex flex-wrap gap-4 align-items-center">
                <div style="display: inline-flex; position: relative;" id="pivot-custom-dropdown-wrap">
                    <button id="pivotMeasuresDropdown" type="button" style="background-color: #714B67; border: 1px solid #55384D; color: white; padding: 4px 10px; font-size: 13px; border-radius: 4px 0 0 4px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        Medidas <i class="fa-solid fa-caret-down"></i>
                    </button>
                    <button id="pivot-swap-axes" type="button" style="background-color: #e9ecef; border: 1px solid #ccc; border-left: none; color: #333; padding: 4px 10px; font-size: 13px; border-radius: 0 4px 4px 0; cursor: pointer; display: flex; align-items: center;" title="Invertir Ejes">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i>
                    </button>
                    
                    <ul id="pivot-measures-group" style="display: none; position: absolute; top: 100%; left: 0; z-index: 9999; margin: 2px 0 0 0; padding: 5px 0; list-style: none; background-color: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); min-width: 180px;">
                        <!-- Checkboxes for measures se inyectan aquí -->
                    </ul>
                </div>

                <div class="d-inline-flex gap-2 align-items-center">
                    <span class="text-muted fw-bold" style="font-size:0.85rem;">Filas:</span>
                    <select class="form-select form-select-sm w-auto" id="pivot-groupby-select">
                        <option value="cliente" ${this.currentRowGroup === 'cliente' ? 'selected' : ''}>${window.currentModule === 'in_invoice' ? 'Proveedor' : 'Cliente'}</option>
                        <option value="fecha_anio" ${this.currentRowGroup === 'fecha_anio' ? 'selected' : ''}>Año</option>
                        <option value="fecha_mes" ${this.currentRowGroup === 'fecha_mes' ? 'selected' : ''}>Mes</option>
                        <option value="estado" ${this.currentRowGroup === 'estado' ? 'selected' : ''}>Estado</option>
                        <option value="tipo_comprobante" ${this.currentRowGroup === 'tipo_comprobante' ? 'selected' : ''}>Tipo Comprobante</option>
                    </select>
                </div>
                <div class="d-inline-flex gap-2 align-items-center">
                    <span class="text-muted fw-bold" style="font-size:0.85rem;">Columnas:</span>
                    <select class="form-select form-select-sm w-auto" id="pivot-colgroupby-select">
                        <option value="none" ${this.currentColGroup === 'none' ? 'selected' : ''}>Ninguno</option>
                        <option value="fecha_anio" ${this.currentColGroup === 'fecha_anio' ? 'selected' : ''}>Año</option>
                        <option value="fecha_anio_mes" ${this.currentColGroup === 'fecha_anio_mes' ? 'selected' : ''}>Año > Mes</option>
                        <option value="fecha_mes" ${this.currentColGroup === 'fecha_mes' ? 'selected' : ''}>Mes (Plano)</option>
                        <option value="cliente" ${this.currentColGroup === 'cliente' ? 'selected' : ''}>${window.currentModule === 'in_invoice' ? 'Proveedor' : 'Cliente'}</option>
                        <option value="estado" ${this.currentColGroup === 'estado' ? 'selected' : ''}>Estado</option>
                        <option value="tipo_comprobante" ${this.currentColGroup === 'tipo_comprobante' ? 'selected' : ''}>Tipo Comprobante</option>
                    </select>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-sm o-pivot-table">
                    <thead id="pivot-thead"></thead>
                    <tbody id="pivot-tbody"></tbody>
                    <tfoot id="pivot-tfoot"></tfoot>
                </table>
            </div>
        `;

        this.renderMeasuresToggles();
        this.setupEvents();
    }

    renderMeasuresToggles() {
        const group = this.container.querySelector('#pivot-measures-group');
        if (!group) return;

        const availableMeasures = [
            { id: 'monto_total', label: 'Monto Total' },
            { id: 'amount_untaxed', label: 'Total sin IGV' },
            { id: 'amount_tax', label: 'IGV' },
            { id: 'count', label: 'Recuento' }
        ];

        let html = '';
        availableMeasures.forEach(m => {
            const isActive = this.currentMeasures.includes(m.id);
            html += `
                <li style="list-style: none !important; margin: 0; padding: 4px 15px;">
                    <label class="dropdown-item d-flex align-items-center" style="cursor: pointer; padding: 0; margin: 0; display: flex;">
                        <input class="form-check-input me-2 pivot-measure-chk" type="checkbox" value="${m.id}" ${isActive ? 'checked' : ''} style="margin: 0; cursor: pointer;">
                        <span style="font-size: 13px; color: #333;">${m.label}</span>
                    </label>
                </li>
            `;
        });
        group.innerHTML = html;
    }

    setupEvents() {
        const measureChks = this.container.querySelectorAll('.pivot-measure-chk');
        measureChks.forEach(chk => {
            chk.addEventListener('change', (e) => {
                // Mantener el dropdown abierto al hacer click
                e.stopPropagation();

                this.currentMeasures = Array.from(measureChks)
                                          .filter(c => c.checked)
                                          .map(c => c.value);
                
                // Asegurar que al menos una medida esté seleccionada
                if (this.currentMeasures.length === 0) {
                    chk.checked = true;
                    this.currentMeasures = [chk.value];
                }
                document.dispatchEvent(new CustomEvent('odooPivotStateChanged'));
            });
        });

        // Lógica de Toggle del Menú Custom
        const customDropdownBtn = this.container.querySelector('#pivotMeasuresDropdown');
        const customDropdownMenu = this.container.querySelector('#pivot-measures-group');
        if (customDropdownBtn && customDropdownMenu) {
            customDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                customDropdownMenu.style.display = customDropdownMenu.style.display === 'none' ? 'block' : 'none';
            });

            document.addEventListener('click', () => {
                customDropdownMenu.style.display = 'none';
            });

            customDropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar cerrar al hacer click dentro
            });
        }

        const swapBtn = this.container.querySelector('#pivot-swap-axes');
        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                const temp = this.currentRowGroup;
                this.currentRowGroup = this.currentColGroup === 'none' ? 'cliente' : this.currentColGroup; // fallback
                this.currentColGroup = temp;
                
                const rowSelect = this.container.querySelector('#pivot-groupby-select');
                if (rowSelect) rowSelect.value = this.currentRowGroup;
                const colSelect = this.container.querySelector('#pivot-colgroupby-select');
                if (colSelect) colSelect.value = this.currentColGroup;
                
                this.expandedColKeys.clear();
                
                document.dispatchEvent(new CustomEvent('odooGroupByChanged', { detail: { groupBy: this.currentRowGroup, source: 'pivot' } }));
                document.dispatchEvent(new CustomEvent('odooPivotStateChanged'));
            });
        }

        const groupbySelect = this.container.querySelector('#pivot-groupby-select');
        groupbySelect.addEventListener('change', (e) => {
            this.currentRowGroup = e.target.value;
            // Evitar que filas y columnas tengan el mismo agrupador estricto
            if (this.currentRowGroup === this.currentColGroup && this.currentRowGroup !== 'none') {
                this.currentColGroup = 'none';
                const colSelect = this.container.querySelector('#pivot-colgroupby-select');
                if (colSelect) colSelect.value = 'none';
            }
            document.dispatchEvent(new CustomEvent('odooGroupByChanged', { detail: { groupBy: this.currentRowGroup, source: 'pivot' } }));
            document.dispatchEvent(new CustomEvent('odooPivotStateChanged'));
        });

        const colgroupbySelect = this.container.querySelector('#pivot-colgroupby-select');
        colgroupbySelect.addEventListener('change', (e) => {
            this.currentColGroup = e.target.value;
            this.expandedColKeys.clear(); // Resetear expansiones al cambiar la agrupación
            
            if (this.currentColGroup === this.currentRowGroup && this.currentColGroup !== 'none') {
                this.currentRowGroup = 'none';
                const rowSelect = this.container.querySelector('#pivot-groupby-select');
                if (rowSelect) rowSelect.value = 'none';
            }
            document.dispatchEvent(new CustomEvent('odooPivotStateChanged'));
        });

        // Event delegation para botones de expandir/colapsar en el Thead
        const thead = this.container.querySelector('#pivot-thead');
        if (thead) {
            thead.addEventListener('click', (e) => {
                const btn = e.target.closest('.o-pivot-expand-btn');
                if (btn) {
                    const key = btn.dataset.key;
                    if (this.expandedColKeys.has(key)) {
                        this.expandedColKeys.delete(key);
                    } else {
                        this.expandedColKeys.add(key);
                    }
                    this.renderTable(); // Solo re-renderiza, no necesita recargar datos de la API
                }
            });
        }
    }

    async loadData(filters = {}) {
        if (!this.container) return;
        
        try {
            const tbody = this.container.querySelector('#pivot-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
            
            const groupBys = [];
            if (this.currentRowGroup !== 'none') groupBys.push(this.currentRowGroup);

            // Si es jerárquico 'fecha_anio_mes', le pedimos al backend 'fecha_mes' (que trae año y mes implícito)
            let colGroupForBackend = this.currentColGroup;
            if (colGroupForBackend === 'fecha_anio_mes') colGroupForBackend = 'fecha_mes';

            if (colGroupForBackend && colGroupForBackend !== 'none' && colGroupForBackend !== this.currentRowGroup) {
                groupBys.push(colGroupForBackend);
            }

            // Evitar array vacío si no hay filas ni columnas seleccionadas
            if (groupBys.length === 0) {
                // Al menos agrupar por algo ficticio o pedir solo medidas globales, Odoo usa un agrupamiento vacío,
                // Pero backend actual necesita al menos un groupBy para no fallar. Por defecto 'estado'.
                groupBys.push('estado');
            }

            const result = await this.config.onFetchData(filters, groupBys, this.currentMeasures);
            this.currentData = result.data || result;
            this.renderTable();
        } catch (err) {
            console.error("Error al cargar datos pivot:", err);
            const tbody = this.container.querySelector('#pivot-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="100%" class="text-danger text-center">Error al cargar datos</td></tr>';
        }
    }

    renderTable() {
        const thead = this.container.querySelector('#pivot-thead');
        const tbody = this.container.querySelector('#pivot-tbody');
        const tfoot = this.container.querySelector('#pivot-tfoot');
        
        if (!thead || !tbody) return;

        const measureLabels = {
            'monto_total': 'Monto Total',
            'amount_untaxed': 'Total sin IGV',
            'amount_tax': 'IGV',
            'count': 'Recuento'
        };

        const hasCols = this.currentColGroup && this.currentColGroup !== 'none';
        const isHierarchical = this.currentColGroup === 'fecha_anio_mes';

        // 1. Extraer valores únicos para filas
        let rowKeys = new Set();
        this.currentData.forEach(row => rowKeys.add(row[this.currentRowGroup] || '(No definido)'));
        rowKeys = Array.from(rowKeys).sort();

        // 2. Extraer valores para columnas y construir la estructura del árbol
        // tree = { '2026': { total: {m1:0, m2:0}, children: { '2026-01': {m1:0, m2:0} } } }
        const colTree = {};
        
        this.currentData.forEach(row => {
            let colValRaw = hasCols ? (row[this.currentColGroup === 'fecha_anio_mes' ? 'fecha_mes' : this.currentColGroup] || '(No definido)') : 'Total';
            
            let parentKey = 'Total';
            let childKey = null;

            if (isHierarchical && colValRaw !== '(No definido)') {
                // Parse YYYY-MM
                const match = colValRaw.match(/^(\d{4})-(\d{2})$/);
                if (match) {
                    parentKey = match[1]; // Año
                    childKey = colValRaw; // Mes (YYYY-MM)
                } else {
                    parentKey = colValRaw;
                }
            } else if (hasCols) {
                parentKey = colValRaw;
            }

            if (!colTree[parentKey]) {
                colTree[parentKey] = {
                    key: parentKey,
                    isExpanded: this.expandedColKeys.has(parentKey),
                    childrenKeys: new Set()
                };
            }

            if (childKey) {
                colTree[parentKey].childrenKeys.add(childKey);
            }
        });

        // Ordenar nodos principales (Años o Categorías)
        const topLevelColKeys = Array.from(Object.keys(colTree)).sort();
        
        // Estructura plana de columnas a renderizar (Nivel inferior)
        // Ejemplo: [ {parent: '2026', child: '2026-01'}, {parent: '2026', child: 'Total'} ]
        const renderCols = [];
        
        topLevelColKeys.forEach(pKey => {
            const node = colTree[pKey];
            if (node.isExpanded && node.childrenKeys.size > 0) {
                const sortedChildren = Array.from(node.childrenKeys).sort();
                sortedChildren.forEach(cKey => {
                    renderCols.push({ parent: pKey, child: cKey, isTotal: false });
                });
            }
            // Siempre mostrar el Total del parent
            renderCols.push({ parent: pKey, child: null, isTotal: true });
        });

        // 3. Construir Matriz de Datos
        const matrix = {};
        rowKeys.forEach(r => {
            matrix[r] = {};
            renderCols.forEach(col => {
                const colId = col.isTotal ? col.parent : col.child;
                matrix[r][colId] = {};
                this.currentMeasures.forEach(m => matrix[r][colId][m] = 0);
            });
        });

        const colTotals = {};
        renderCols.forEach(col => {
            const colId = col.isTotal ? col.parent : col.child;
            colTotals[colId] = {};
            this.currentMeasures.forEach(m => colTotals[colId][m] = 0);
        });

        const grandTotals = {};
        this.currentMeasures.forEach(m => grandTotals[m] = 0);

        const rowTotals = {};
        rowKeys.forEach(r => {
            rowTotals[r] = {};
            this.currentMeasures.forEach(m => rowTotals[r][m] = 0);
        });

        // Llenar datos
        this.currentData.forEach(row => {
            const r = row[this.currentRowGroup] || '(No definido)';
            let rawCol = hasCols ? (row[this.currentColGroup === 'fecha_anio_mes' ? 'fecha_mes' : this.currentColGroup] || '(No definido)') : 'Total';
            
            let pKey = 'Total';
            let cKey = null;

            if (isHierarchical && rawCol !== '(No definido)') {
                const match = rawCol.match(/^(\d{4})-(\d{2})$/);
                if (match) {
                    pKey = match[1];
                    cKey = rawCol;
                } else {
                    pKey = rawCol;
                }
            } else if (hasCols) {
                pKey = rawCol;
            }

            this.currentMeasures.forEach(m => {
                const val = parseFloat(row[m]) || 0;
                
                // Sumar al Total General
                grandTotals[m] += val;
                
                // Sumar al Total Fila (Grand Total de la fila, que aparece al final)
                rowTotals[r][m] += val;

                // Sumar al parent (Total de columna superior)
                if (matrix[r][pKey]) {
                    matrix[r][pKey][m] += val;
                    colTotals[pKey][m] += val;
                }

                // Sumar al child si está expandido
                if (cKey && colTree[pKey].isExpanded && matrix[r][cKey]) {
                    matrix[r][cKey][m] += val;
                    colTotals[cKey][m] += val;
                }
            });
        });

        // Helpers de formateo
        const formatNumber = (val, isCount) => {
            if (val === 0) return '';
            if (isCount) return val;
            return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const formatMonth = (val) => {
            if (val === null || val === undefined || val === '(No definido)' || val === 'Total') return val;
            const strVal = String(val);
            const match = strVal.match(/^(\d{4})-(\d{2})$/);
            if (match) {
                const year = match[1];
                const month = parseInt(match[2], 10);
                const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                return `${months[month - 1]} ${year}`;
            }
            return val;
        };

        // 4. Renderizar Thead
        let theadHtml = '';
        
        if (hasCols) {
            // Fila 1: Top Level (Años o Categorías)
            theadHtml += `<tr>`;
            const rowLevels = isHierarchical ? 3 : 2; 
            theadHtml += `<th rowspan="${rowLevels}" style="width: 250px; background-color: #f8f9fa;">Total</th>`;
            
            topLevelColKeys.forEach(pKey => {
                const node = colTree[pKey];
                const colsForThisParent = renderCols.filter(c => c.parent === pKey).length;
                const colspan = colsForThisParent * this.currentMeasures.length;
                
                let btnHtml = '';
                if (isHierarchical && pKey !== '(No definido)' && node.childrenKeys.size > 0) {
                    const icon = node.isExpanded ? 'fa-minus-square' : 'fa-plus-square';
                    btnHtml = `<i class="fa-regular ${icon} o-pivot-expand-btn me-1" data-key="${pKey}" style="cursor:pointer; color:var(--o-purple);"></i>`;
                }

                theadHtml += `<th colspan="${colspan}" class="text-center" style="background-color: #f8f9fa;">${btnHtml}${pKey}</th>`;
            });
            // Gran Total Columna Superior
            theadHtml += `<th colspan="${this.currentMeasures.length}" rowspan="${rowLevels - 1}" class="text-center" style="background-color: #f8f9fa;">Total General</th>`;
            theadHtml += `</tr>`;

            // Fila 2: Children Level (Meses) - SOLO si es jerárquico
            if (isHierarchical) {
                theadHtml += `<tr>`;
                topLevelColKeys.forEach(pKey => {
                    const node = colTree[pKey];
                    if (node.isExpanded && node.childrenKeys.size > 0) {
                        const sortedChildren = Array.from(node.childrenKeys).sort();
                        sortedChildren.forEach(cKey => {
                            theadHtml += `<th colspan="${this.currentMeasures.length}" class="text-center" style="background-color: #f8f9fa; font-size: 0.8em; color: #555;">${formatMonth(cKey)}</th>`;
                        });
                    }
                    theadHtml += `<th colspan="${this.currentMeasures.length}" class="text-center" style="background-color: #f8f9fa; font-size: 0.8em; color: #555;">Total ${pKey}</th>`;
                });
                theadHtml += `</tr>`;
            }

            // Fila Inferior: Medidas
            theadHtml += `<tr>`;
            renderCols.forEach(() => {
                this.currentMeasures.forEach(m => {
                    theadHtml += `<th class="text-end text-muted" style="background-color: #f8f9fa; font-weight:normal; font-size: 0.8em;">${measureLabels[m]}</th>`;
                });
            });
            // Medidas del Total General
            this.currentMeasures.forEach(m => {
                theadHtml += `<th class="text-end text-muted" style="background-color: #f8f9fa; font-weight:bold; font-size: 0.8em;">${measureLabels[m]}</th>`;
            });
            theadHtml += `</tr>`;

        } else {
            theadHtml += `<tr>`;
            theadHtml += `<th style="width: 250px; background-color: #f8f9fa;">Total</th>`;
            this.currentMeasures.forEach(m => {
                theadHtml += `<th class="text-end" style="background-color: #f8f9fa;">${measureLabels[m]}</th>`;
            });
            theadHtml += `</tr>`;
        }
        thead.innerHTML = theadHtml;

        // 5. Renderizar Tbody (incluyendo el Gran Total en la primera fila)
        let tbodyHtml = '';
        if (this.currentData.length === 0) {
            const colSpan = hasCols ? (renderCols.length + 1) * this.currentMeasures.length + 1 : this.currentMeasures.length + 1;
            tbodyHtml = `<tr><td colspan="${colSpan}" class="text-center text-muted py-4">No hay datos</td></tr>`;
        } else {
            // Fila de Total General (Arriba)
            tbodyHtml += `<tr style="background-color: #f8f9fa; font-weight: bold; border-bottom: 2px solid #dee2e6;">`;
            tbodyHtml += `<td><i class="fa-solid fa-minus me-1" style="font-size:0.7em; color: var(--o-purple);"></i> Total</td>`;
            
            if (hasCols) {
                renderCols.forEach(col => {
                    const colId = col.isTotal ? col.parent : col.child;
                    this.currentMeasures.forEach(m => {
                        const val = colTotals[colId][m];
                        const cssClass = col.isTotal ? "text-end bg-light" : "text-end";
                        tbodyHtml += `<td class="${cssClass}">${formatNumber(val, m === 'count')}</td>`;
                    });
                });

                // Grand Totals Right
                this.currentMeasures.forEach(m => {
                    const val = grandTotals[m];
                    tbodyHtml += `<td class="text-end" style="background-color: #e9ecef;">${formatNumber(val, m === 'count')}</td>`;
                });
            } else {
                this.currentMeasures.forEach(m => {
                    const val = grandTotals[m];
                    tbodyHtml += `<td class="text-end">${formatNumber(val, m === 'count')}</td>`;
                });
            }
            tbodyHtml += `</tr>`;

            // Filas de Datos
            rowKeys.forEach(r => {
                tbodyHtml += `<tr>`;
                tbodyHtml += `<td class="fw-bold" style="color: var(--o-purple); padding-left: 1.5rem;"><i class="fa-solid fa-plus me-1" style="font-size:0.7em; cursor:pointer;"></i> ${formatMonth(r)}</td>`;
                
                if (hasCols) {
                    renderCols.forEach(col => {
                        const colId = col.isTotal ? col.parent : col.child;
                        this.currentMeasures.forEach(m => {
                            const val = matrix[r][colId][m];
                            const cssClass = col.isTotal ? "text-end fw-bold bg-light" : "text-end";
                            tbodyHtml += `<td class="${cssClass}">${formatNumber(val, m === 'count')}</td>`;
                        });
                    });

                    // Row Grand Totals
                    this.currentMeasures.forEach(m => {
                        const val = rowTotals[r][m];
                        tbodyHtml += `<td class="text-end fw-bold" style="background-color: #f1f3f5;">${formatNumber(val, m === 'count')}</td>`;
                    });
                } else {
                    this.currentMeasures.forEach(m => {
                        const val = rowTotals[r][m];
                        tbodyHtml += `<td class="text-end">${formatNumber(val, m === 'count')}</td>`;
                    });
                }
                
                tbodyHtml += `</tr>`;
            });
        }
        tbody.innerHTML = tbodyHtml;

        // 6. Tfoot vacío ya que el total está arriba
        tfoot.innerHTML = '';
    }
}
