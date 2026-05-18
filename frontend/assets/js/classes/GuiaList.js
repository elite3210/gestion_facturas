/**
 * FacturaList.js - Refactorizada completa con DataTable y Header-Tools
 * 
 * Configura y maneja específicamente el listado de facturas electrónicas
 * con selección de filas y barra de herramientas moderna
 */
import { DataTable } from './DataTable.js';

export class FacturaList {
    /**
     * Constructor
     * 
     * @param {FacturaAPI} api Instancia de FacturaAPI
     * @param {string} tableContainerId ID del contenedor de la tabla
     * @param {string} headerToolsId ID del contenedor de header-tools
     * @param {string} paginationId ID del contenedor de paginación
     * @param {string} paginationInfoId ID del elemento de información
     * @param {function} onFacturaSelected Callback para cuando se selecciona una factura
     */
    constructor(api, tableContainerId = 'factura-table-container', 
                headerToolsId = 'factura-header-tools', paginationId = 'pagination', 
                paginationInfoId = 'pagination-info', onFacturaSelected = null) {
        
        this.api = api;
        this.onFacturaSelected = onFacturaSelected;
        
        // Crear wrapper de API para interface común
        this.apiWrapper = {
            getData: async (filters, page, limit) => {
                const result = await api.getGuias(filters, page, limit);
                // Mapear estructura para DataTable
                return {
                    data: {
                        items: result.data.guias,
                        paginacion: result.data.paginacion
                    }
                };
            }
        };
        
        // Configurar DataTable
        this.dataTable = new DataTable({
            api: this.apiWrapper,
            tableContainerId: tableContainerId,
            headerToolsId: headerToolsId,
            paginationId: paginationId,
            paginationInfoId: paginationInfoId,
            columns: this.getColumnConfig(),
            actions: this.getActionConfig(),
            emptyMessage: 'No se encontraron facturas electrónicas',
            searchFormId: 'search-form',
            filterConfig: this.getFilterConfig(),
            selectionMode: 'multiple', // Modo de selección: 'single', 'multiple', 'none'
            limit: 15,
            onSelectionChange: this.handleSelectionChange.bind(this)// Callback para selección de filas
        });
    }

    /**
     * Configuración de columnas específicas para facturas
     */
    getColumnConfig() {
        return [
            {
                key: 'fecha_emision',
                label: 'Fecha Emisión',
                formatter: this.formatDate,
                sortable: true,
                width: '110px'
            },
            {
                key: 'numero_guia',
                label: 'Guía Remisión',
                formatter: (value) => value || 'N/D',
                width: '120px'
            },
            {
                key: 'motivo_traslado',
                label: 'Motivo traslado',
                className: 'text-end',
                sortable: true,
                width: '120px'
            },
                        {
                key: 'nombre_receptor',
                label: 'Nombre Receptor',
                className: 'text-truncate',
                formatter: this.formatReceptorName
            },
            {
                key: 'ruc_receptor',
                label: 'RUC Receptor',
                width: '120px'
            },
            {
                key: 'numero_factura',
                label: 'Número Factura',
                sortable: true,
                width: '120px'
            }
        ];
    }

    /**
     * Configuración de acciones específicas para facturas en header-tools
     */
    getActionConfig() {
        return [
            {
                key: 'view',
                label: '',//ver detalle
                icon: 'fas fa-eye',
                className: 'btn-action-view',
                title: 'Ver detalle de la factura seleccionada',
                minSelection: 1,
                maxSelection: 1,
                handler: (selectedIds) => {
                    console.log('ver;)',selectedIds);
                    if (this.onFacturaSelected) {
                        this.onFacturaSelected(selectedIds);
                    }
                }
            },
            {
                key: 'pdf',
                label: '',// descargar PDF
                icon: 'fas fa-download',
                className: 'btn-action-download',
                title: 'Descargar PDF de la factura seleccionada',
                minSelection: 1,
                maxSelection: 1,
                handler: (selectedIds) => {
                    console.log('Descargando;)',selectedIds);
                    this.downloadPdf(selectedIds);
                }
            },
            {
                key: 'export',
                label: '',//Exportar
                icon: 'fas fa-file-export',
                className: 'btn-outline-info',
                title: 'Exportar facturas seleccionadas',
                minSelection: 1,
                handler: (selectedIds) => {
                    this.exportFacturas(selectedIds);
                }
            },
            {
                key: 'print',
                label: '',//Imprimir
                icon: 'fas fa-print',
                className: 'btn-outline-secondary',
                title: 'Imprimir facturas seleccionadas',
                minSelection: 1,
                maxSelection: 5, // Máximo 5 facturas para imprimir
                handler: (selectedIds) => {
                    this.printFacturas(selectedIds);
                }
            }
        ];
    }

    /**
     * Configuración de filtros específicos para facturas
     */
    getFilterConfig() {
        return {
            numero_factura: {
                transform: (value) => value.trim().toUpperCase()
            },
            fecha_desde: {
                validate: (value) => {
                    const date = new Date(value);
                    return !isNaN(date.getTime());
                },
                errorMessage: 'Fecha desde inválida'
            },
            fecha_hasta: {
                validate: (value) => {
                    const date = new Date(value);
                    return !isNaN(date.getTime());
                },
                errorMessage: 'Fecha hasta inválida'
            },
            ruc: {
                targetField: 'ruc_receptor',
                validate: (value) => /^\d{11}$/.test(value),
                errorMessage: 'El RUC debe tener exactamente 11 dígitos',
                transform: (value) => value.replace(/\D/g, '') // Remover caracteres no numéricos
            }
        };
    }

    /**
     * Inicializar el componente
     */
    init() {
        this.dataTable.init();
        
        // Configurar eventos específicos después de cada renderizado
        this.dataTable.onDataLoad = (data) => {
            this.setupSpecificEvents(data);
            this.updateStatistics(data);
        };
    }

    /**
     * Configurar eventos específicos de facturas
     */
    setupSpecificEvents(data) {
        // Configurar tooltips para montos
        const montoCells = this.dataTable.tableBody?.querySelectorAll('[data-monto]');
        montoCells?.forEach(cell => {
            const monto = cell.getAttribute('data-monto');
            if (monto) {
                //crear tambien scrip paramostrar tooltip en dolares
                cell.title = `Monto exacto: S/ ${parseFloat(monto).toFixed(2)}`;
            }
        });

        // Configurar validación de RUC en tiempo real
        this.setupRucValidation();
    }

    /**
     * Configurar validación de RUC en tiempo real
     */
    setupRucValidation() {
        const rucInput = document.getElementById('ruc');
        if (rucInput) {
            rucInput.addEventListener('input', (e) => {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = value;
                
                // Validación visual
                if (value.length === 11) {
                    e.target.classList.remove('is-invalid');
                    e.target.classList.add('is-valid');
                } else if (value.length > 0) {
                    e.target.classList.remove('is-valid');
                    e.target.classList.add('is-invalid');
                } else {
                    e.target.classList.remove('is-valid', 'is-invalid');
                }
            });
        }
    }

    /**
     * Manejar cambios en la selección
     */
    handleSelectionChange(selectedIds) {
        console.log('Facturas seleccionadas;)', selectedIds);
        
        // Actualizar información adicional si es necesario
        this.updateSelectionInfo(selectedIds);
    }

    /**
     * Actualizar información de selección
     */
    updateSelectionInfo(selectedIds) {
        // Calcular totales de facturas seleccionadas
        if (selectedIds.length > 0 && this.dataTable.currentData) {
            const selectedFacturas = this.dataTable.currentData.filter(factura => 
                selectedIds.includes(factura.id)
            );
            
            const totalMonto = selectedFacturas.reduce((sum, factura) => 
                sum + parseFloat(factura.monto_total || 0), 0
            );
            
            // Mostrar información adicional si hay contenedor
            const infoContainer = document.getElementById('selection-summary');
            if (infoContainer && selectedIds.length > 1) {
                infoContainer.innerHTML = `
                    <small class="text-info">
                        <i class="fas fa-calculator"></i> 
                        Total seleccionado: ${this.formatMoney(totalMonto, null)}
                    </small>
                `;
                infoContainer.style.display = 'block';
            } else if (infoContainer) {
                infoContainer.style.display = 'none';
            }
        }
    }

    /**
     * Actualizar estadísticas generales
     */
    updateStatistics(data) {
        // Calcular estadísticas de la página actual
        if (data.items && data.items.length > 0) {
            const totalMontoPagina = data.items.reduce((sum, factura) => 
                sum + parseFloat(factura.monto_total || 0), 0
            );
            
            // Mostrar estadísticas si hay contenedor
            const statsContainer = document.getElementById('page-statistics');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <small class="text-muted">
                        <i class="fas fa-chart-line"></i> 
                        Total en página: ${this.formatMoney(totalMontoPagina, null)}
                    </small>
                `;
            }
        }
    }

    /**
     * Formatear fecha para visualización
     */
    formatDate(date, item) {        
        if (!date) return '<span class="text-muted">N/D</span>';
        
        try {
            const dateObj = new Date(date);
            //de date input: 2025-07-17 y Output formatted: 17-07-2025
            const formatted = date.slice(8, 10) + "-" + date.slice(5, 7) + "-" + date.slice(0, 4);
            
            
            // Agregar clase para fechas recientes (últimos 7 días)
            const daysDiff = Math.floor((new Date() - dateObj) / (1000 * 60 * 60 * 24));
            const className = daysDiff <= 7 ? 'text-success fw-bold' : '';
            
            return `<span class="${className}" title="Hace ${daysDiff} días">${formatted}</span>`;
        } catch (e) {
            return date;
        }
    }

    /**
     * Formatear nombre del receptor
     */
    formatReceptorName(nombre, item) {
        if (!nombre) return '<span class="text-muted">N/D</span>';
        
        // Truncar nombre si es muy largo
        const maxLength = 40;
        if (nombre.length > maxLength) {
            return `<span title="${nombre}">${nombre.substring(0, maxLength)}...</span>`;
        }
        
        return nombre;
    }

    /**
     * Formatear valor monetario
     */
    formatMoney(value, item) {
        //console.log('Formateando monto:', value, item['codigo_moneda']);
        let formatted='';
        if (value === undefined || value === null) return '<span class="text-muted">S/ 0.00</span>';
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '<span class="text-muted">S/ 0.00</span>';
        
        if (item['codigo_moneda'] === 'PEN') {
            formatted = new Intl.NumberFormat('es-PE', {style: 'currency',currency: 'PEN'}).format(numValue);
        } else {
            formatted = new Intl.NumberFormat('en-US', {style: 'currency',currency: 'USD'}).format(numValue);
        }
        
        
        // Agregar clases para diferentes rangos de montos
        let className = '';
        if (item['codigo_moneda'] === 'USD') {
            className = 'text-success fw-bold';
        } else {
            className = 'text-dark';
        }
        
        return `<span class="${className}" data-monto="${numValue}">${formatted}</span>`;
    }

    /**
     * Descargar PDF de la factura
     */
    downloadPdf(id) {
        const url = this.api.getPdfDownloadUrl(id);
        window.location.href = url;
/*
        try {
            const url = `https://www.heinzsport.com/facturacion/backend/api/facturaDownload.php?id=${id}`;
            
            // Crear enlace temporal para descarga
            const link = document.createElement('a');
            link.href = url;
            link.download = `factura_${id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Mostrar notificación de éxito
            this.showNotification('PDF descargado correctamente', 'success');
            
        } catch (error) {
            console.error('Error al descargar PDF:', error);
            this.showNotification('Error al descargar PDF', 'error');
        }
            */
    }

    /**
     * Exportar facturas seleccionadas
     */
    exportFacturas(selectedIds) {
        console.log('Exportando facturas:)',selectedIds);
        
        try {
            // Obtener datos de las facturas seleccionadas
            // Filtrar las facturas seleccionadas por sus IDs
            // Esto asume que `this.dataTable.currentData` contiene todas las facturas cargadas
            // y que cada factura tiene un campo `id` único, con el cual se evalua en .includes 
            // y si lo esta devuelve true y con esto se seleccionada la factura
            const selectedFacturas = this.dataTable.currentData.filter(factura => 
                selectedIds.includes(factura.id)
            );
            
            // Crear CSV
            const csvContent = this.generateCSV(selectedFacturas);
            
            // Descargar CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `facturas_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();//click para descargar
            document.body.removeChild(link);// eliminar enlace
            
            this.showNotification(`${selectedIds.length} facturas exportadas correctamente`, 'success');
            
        } catch (error) {
            console.error('Error al exportar:', error);
            this.showNotification('Error al exportar facturas', 'error');
        }
    }

    /**
     * Generar contenido CSV
     */
    generateCSV(facturas) {
        const headers = [
            'Fecha Emisión',
            'Número Guia',
            'RUC Emisor',
            'Nombre Emisor',
            'RUC Receptor',
            'Nombre Receptor',
            'Motivo Traslado',
            'Peso Bruto',
            'Número Factura',
        ];
        
        const csvRows = [headers.join(',')];
        
        facturas.forEach(factura => {
            const row = [
                `"${factura.fecha_emision || ''}"`,
                `"${factura.numero_guia || ''}"`,
                `"${factura.ruc_emisor || ''}"`,
                `"${factura.nombre_emisor || ''}"`,
                `"${factura.ruc_receptor || ''}"`,
                `"${(factura.nombre_receptor || '').replace(/"/g, '""')}"`,
                `"${factura.motivo_traslado || 0}"`,
                `"${factura.peso_bruto || 0}"`,
                `"${factura.numero_factura || ''}"`
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    /**
     * Imprimir facturas seleccionadas
     */
    printFacturas(selectedIds) {
        if (selectedIds.length === 1) {
            // Imprimir una sola factura (abrir en nueva ventana)
            const url = `../../backend/api/facturaDownload.php?id=${selectedIds[0]}&action=print`;
            window.open(url, '_blank');
        } else {
            // Múltiples facturas - mostrar modal de confirmación
            this.showPrintModal(selectedIds);
        }
    }

    /**
     * Mostrar modal de confirmación para impresión múltiple
     */
    showPrintModal(selectedIds) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirmar Impresión</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Desea imprimir ${selectedIds.length} facturas?</p>
                        <p class="text-muted"><small>Se abrirán ${selectedIds.length} ventanas/pestañas nuevas.</small></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="confirm-print">Imprimir</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // Manejar confirmación
        modal.querySelector('#confirm-print').addEventListener('click', () => {
            selectedIds.forEach((id, index) => {
                setTimeout(() => {
                    const url = `https://www.heinzsport.com/facturacion/backend/api/facturaDownload.php?id=${id}&action=print`;
                    window.open(url, '_blank');
                }, index * 500); // Retraso entre ventanas
            });
            
            modalInstance.hide();
            this.showNotification(`Abriendo ${selectedIds.length} facturas para impresión`, 'info');
        });
        
        // Limpiar modal al cerrar
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    /**
     * Mostrar notificación
     */
    showNotification(message, type = 'info') {
        // Crear toast notification
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const toastInstance = new bootstrap.Toast(toast, { delay: 4000 });
        toastInstance.show();
        
        // Remover del DOM después de que se oculte
        toast.addEventListener('hidden.bs.toast', () => {
            toastContainer.removeChild(toast);
        });
    }

    /**
     * Crear contenedor de toasts si no existe
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1055';
        document.body.appendChild(container);
        return container;
    }

    /**
     * Recargar facturas (método público)
     */
    loadFacturas() {
        this.dataTable.refresh();
    }

    /**
     * Obtener estado actual del listado
     */
    getState() {
        return this.dataTable.getState();
    }

    /**
     * Aplicar filtros programáticamente
     */
    applyFilters(filters) {
        this.dataTable.setFilters(filters);
    }

    /**
     * Obtener facturas seleccionadas
     */
    getSelectedFacturas() {
        const selectedIds = this.dataTable.getSelectedRows();
        return this.dataTable.currentData.filter(factura => 
            selectedIds.includes(factura.id)
        );
    }

    /**
     * Limpiar selección
     */
    clearSelection() {
        this.dataTable.clearSelection();
    }
}