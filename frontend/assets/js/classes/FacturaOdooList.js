/**
 * FacturaOdooList.js
 * 
 * Controlador específico de la vista de listado de facturas.
 * Hereda/Instancia la funcionalidad base de OdooDataTable.
 */

import { OdooDataTable } from './OdooDataTable.js';

export class FacturaOdooList {
    constructor(api, tableContainerId, headerToolsId, paginationId, paginationInfoId, onFacturaSelected) {
        this.api = api;
        this.onFacturaSelected = onFacturaSelected;
        
        // Inicializar la tabla genérica con la configuración específica de Facturas
        this.dataTable = new OdooDataTable({
            storageKeyPrefix: 'facturas',
            defaultFilters: { move_type: 'out_invoice' },
            defaultSort: 'fecha_emision',
            defaultOrder: 'desc',
            limit: 10000, // Eliminar límite de 15 (traer 10000 facturas)
            defaultFacets: [
                {
                    id: 'this_year',
                    label: 'Este año',
                    field: 'fecha_anio',
                    value: 'this_year',
                    icon: 'calendar'
                }
            ],
            
            // Función para transformar las facetas seleccionadas en filtros de la API
            facetToFilterMapper: (facets, baseFilters) => {
                const today = new Date();
                const pad = n => n.toString().padStart(2, '0');
                const todayStr  = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
                const firstDay  = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;

                const filters = { ...baseFilters };

                facets.forEach(f => {
                    switch (f.field) {
                        case 'state':           filters.state          = f.value; break;
                        case 'payment_status':  filters.payment_status = f.value; break;
                        case 'search':          filters.search         = f.value; break;
                        case 'fecha_hoy':
                            filters.fecha_desde = todayStr;
                            filters.fecha_hasta = todayStr;
                            break;
                        case 'fecha_mes':
                            filters.fecha_desde = firstDay;
                            filters.fecha_hasta = todayStr;
                            break;
                        case 'fecha_mes_pasado':
                            const d = new Date();
                            d.setMonth(d.getMonth() - 1);
                            const lm = d.getMonth() + 1;
                            const ly = d.getFullYear();
                            filters.fecha_desde = `${ly}-${pad(lm)}-01`;
                            filters.fecha_hasta = `${ly}-${pad(lm)}-${new Date(ly, lm, 0).getDate()}`;
                            break;
                        case 'fecha_anio':
                            const ty = today.getFullYear();
                            filters.fecha_desde = `${ty}-01-01`;
                            filters.fecha_hasta = `${ty}-12-31`;
                            break;
                    }
                });
                return filters;
            },

            // Callback para obtener datos de la API de Facturas
            onFetchData: async (filters, page, limit, sort, order) => {
                const result = await this.api.getFacturas(filters, page, limit, sort, order);
                return {
                    items: result.data.facturas,
                    pagination: result.data.paginacion
                };
            },

            // Callback para renderizar una fila de Factura
            onRenderRow: (r, isSelected) => {
                const rate = parseFloat(r.invoice_currency_rate) || 1;
                const subtotalPEN = (parseFloat(r.amount_untaxed || 0) * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
                const igvPEN = (parseFloat(r.amount_tax || 0) * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
                const totalPEN = (parseFloat(r.monto_total || 0) * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
                const prefix = 'S/';
                
                const fechaParts = (r.fecha_emision||'').split('-');
                const fechaFormat = fechaParts.length === 3 ? `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}` : r.fecha_emision;

                let stateText = 'Borrador';
                let stateClass = 'badge-secondary';
                if (r.state === 'posted') {
                    stateText = 'Confirmado';
                    stateClass = 'badge-success';
                } else if (r.state === 'cancel') {
                    stateText = 'Cancelado';
                    stateClass = 'badge-dark';
                }

                return `<tr class="${isSelected ? 'selected' : ''}" data-id="${r.id}">
                    <td class="col-chk" data-id="${r.id}" data-action="chk">
                        <div style="display:flex;justify-content:center;">
                            <div class="o-checkbox ${isSelected ? 'checked' : ''}" id="chk-${r.id}"></div>
                        </div>
                    </td>
                    <td class="fw-bold col-num">${r.numero_factura || 'N/D'}</td>
                    <td class="col-date" data-col="col-date">${fechaFormat}</td>
                    <td class="col-client" style="overflow:hidden;text-overflow:ellipsis;" title="${r.nombre_receptor}">${r.nombre_receptor || 'N/D'}</td>
                    <td data-col="col-ruc">${r.ruc_receptor || ''}</td>
                    <td class="monetary col-total" data-col="col-subtotal">${prefix} ${subtotalPEN}</td>
                    <td class="monetary col-total" data-col="col-igv">${prefix} ${igvPEN}</td>
                    <td class="monetary col-total fw-bold" data-col="col-total-pen">${prefix} ${totalPEN}</td>
                    <td class="col-state" data-col="col-state"><span class="o-badge-pill ${stateClass}">${stateText}</span></td>
                    <td class="col-inv" data-col="col-guia">${r.serie_numero_guia || ''}</td>
                    <td class="col-opt"></td>
                </tr>`;
            },

            // Callback cuando se hace clic en una fila
            onRowClicked: (id) => {
                if (window.uiOdoo) window.uiOdoo.openFormView();
                if (this.onFacturaSelected) {
                    this.onFacturaSelected(id);
                }
            },

            // Callback para actualizar los totales en el footer
            onUpdateFooter: (currentData) => {
                let sumSubtotal = 0;
                let sumIgv = 0;
                let sumTotal = 0;

                currentData.forEach(r => {
                    const rate = parseFloat(r.invoice_currency_rate) || 1;
                    sumSubtotal += parseFloat(r.amount_untaxed || 0) * rate;
                    sumIgv      += parseFloat(r.amount_tax    || 0) * rate;
                    sumTotal    += parseFloat(r.monto_total   || 0) * rate;
                });

                const fmt = (val) => 'S/ ' + val.toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});

                const subtotalFooter = document.getElementById('subtotal-footer');
                const igvFooter = document.getElementById('igv-footer');
                const totalFooter = document.getElementById('total-footer');

                if (subtotalFooter) subtotalFooter.textContent = fmt(sumSubtotal);
                if (igvFooter)      igvFooter.textContent      = fmt(sumIgv);
                if (totalFooter)    totalFooter.textContent    = fmt(sumTotal);
            }
        });
        
        // Exponer función global para que funcione el onclick de descargar PDF del gear menu
        window.downloadSelectedPdf = () => this.downloadSelectedPdf();
    }

    init() {
        this.dataTable.init();
    }

    // Wrappers de compatibilidad para appFactura.js
    get currentData() {
        return this.dataTable.currentData;
    }

    loadFacturas() {
        this.dataTable.loadData();
    }

    // JavaScript metodo para descargar PDF
    downloadInvoices(ids) {
        const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
        if (list.length === 0) {
            console.warn('No invoice ids to download');
            return;
        }

        list.forEach((id, index) => {
            if (!id && id !== 0) return;
            setTimeout(async () => {
                try {
                    const url = `https://facturas.heinzsport.com/backend/api/facturaDownload.php?id=${encodeURIComponent(id)}`;
                    console.log('Downloading invoice ID:', id, 'URL:', url);
                    const resp = await fetch(url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `factura_${encodeURIComponent(id)}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(blobUrl);
                } catch (err) {
                    console.error('Error descargando factura', id, err);
                }
            }, index * 500);
        });
    }

    /**
     * Descargar PDF de todas las facturas seleccionadas en la lista
     */
    downloadSelectedPdf() {
        const selectedIds = this.dataTable.getSelectedIds();
        if (selectedIds.length === 0) {
            alert('Por favor, seleccione al menos una factura para descargar.');
            return;
        }
        
        this.downloadInvoices(selectedIds);
    }
}