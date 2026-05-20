/**
 * appFactura.js
 * 
 * Script principal de la aplicación de Facturas.
 * Modificado para usar la nueva interfaz estilo Odoo.
 */
import { FacturaAPI } from "./classes/FacturaAPI.js";
import { FacturaViewer } from "./classes/FacturaViewer.js";
import { FacturaOdooList } from "./classes/FacturaOdooList.js";
import { OdooPivotView } from "./classes/OdooPivotView.js";
import { OdooGraphView } from "./classes/OdooGraphView.js";
import { OdooKanbanView } from "./classes/OdooKanbanView.js";

document.addEventListener('DOMContentLoaded', function () {
    // Inicializar API
    const api = new FacturaAPI();

    // Inicializar el visor de facturas (sin renderizar aún porque la plantilla no está)
    const facturaViewer = new FacturaViewer(api);
    window.facturaViewer = facturaViewer; // Hacer disponible globalmente

    // Función principal para cargar la vista de detalle dinámicamente
    async function openDetailView(facturaId, pushState = true) {
        let container = document.getElementById('form-view-container');
        if (!container) return;

        // Si la plantilla no ha sido inyectada aún, descargarla
        if (!document.getElementById('view-form')) {
            try {
                // Obtener ruta base según la ubicación actual (puede estar en /views/ o en /views/facturas/)
                const basePath = window.location.pathname.includes('/facturas/') ? '../' : './';
                const resp = await fetch(basePath + 'templates/detalleFactura.html');
                if (!resp.ok) throw new Error('No se pudo cargar la plantilla del detalle');
                const html = await resp.text();
                container.innerHTML = html;

                // Reinicializar eventos del FacturaViewer ya que hay nuevos elementos DOM
                facturaViewer.init();
            } catch (err) {
                console.error("Error cargando detalleFactura.html:", err);
                alert("Error al cargar la vista de detalle.");
                return;
            }
        }

        const titleCrumb = document.getElementById('form-title-crumb');
        if (titleCrumb) titleCrumb.textContent = facturaId;

        if (pushState) {
            const basePath = window.location.pathname.includes('/facturas/') ? './' : 'facturas/';
            history.pushState({ id: facturaId, view: 'form' }, '', basePath + facturaId);
        }

        if (window.uiOdoo && uiOdoo.openFormView) uiOdoo.openFormView();
        facturaViewer.loadFactura(facturaId);

        // Actualizar el paginador del formulario
        updateFormPager(facturaId);
    }

    // Hacer la función global por si se necesita en otros sitios
    window.openDetailView = openDetailView;

    // Lógica para actualizar el paginador del Form View
    function updateFormPager(currentId) {
        if (!window.facturaList || !window.facturaList.currentData) return;

        const data = window.facturaList.currentData;
        const total = data.length;
        if (total === 0) return;

        // Buscar el índice del ID actual
        // Asegurarnos de comparar como strings o números de manera uniforme
        const index = data.findIndex(item => String(item.id) === String(currentId));

        const valEl = document.getElementById('form-pager-val');
        const totalEl = document.getElementById('form-pager-total');

        if (valEl && totalEl) {
            valEl.textContent = index !== -1 ? (index + 1) : 1;
            totalEl.textContent = total;
        }
    }

    // Lógica para navegar a la siguiente o anterior factura
    window.navigateForm = function (direction) {
        if (!window.facturaList || !window.facturaList.currentData) return;

        const data = window.facturaList.currentData;
        const currentId = facturaViewer.getCurrentFacturaId(); // Necesita devolver el ID

        if (!currentId) return;

        const currentIndex = data.findIndex(item => String(item.id) === String(currentId));
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;

        // Verificar límites
        if (newIndex >= 0 && newIndex < data.length) {
            const nextId = data[newIndex].id;
            openDetailView(nextId, true);
        }
    };

    // Inicializar la lista de facturas de Odoo
    const facturaList = new FacturaOdooList(
        api,
        'main-table',
        null,
        null,
        null,
        (facturaId) => {
            // Callback al hacer clic en una fila (Redirección SPA)
            openDetailView(facturaId, true);
        }
    );
    facturaList.init();
    window.facturaList = facturaList;

    // Inicializar Vista Pivot
    const pivotView = new OdooPivotView(api, 'view-pivot', {
        onFetchData: async (filters, groupBy, measures) => {
            return await api.getPivotData(filters, groupBy, measures);
        }
    });
    pivotView.init();

    // Inicializar Vista Gráfico
    const graphView = new OdooGraphView(api, 'view-graph', {
        onFetchData: async (filters, groupBy, measures) => {
            return await api.getPivotData(filters, groupBy, measures);
        }
    });
    graphView.init();

    // Inicializar Vista Kanban
    const kanbanView = new OdooKanbanView(api, 'view-kanban', {
        onCardClick: (facturaId) => {
            openDetailView(facturaId, true);
        },
        onStateChange: async (facturaId, newState) => {
            await api.updateState(facturaId, newState);
        }
    });
    kanbanView.init();

    // Escuchar cambios de vista para cargar datos si es necesario
    document.addEventListener('odooViewChanged', (e) => {
        const view = e.detail.view;
        // Obtener filtros actuales de la lista
        const currentFilters = (facturaList && facturaList.dataTable) ? facturaList.dataTable.currentFilters : {};
        
        if (view === 'kanban') {
            kanbanView.loadData(currentFilters);
        } else if (view === 'pivot') {
            pivotView.loadData(currentFilters);
        } else if (view === 'graph') {
            graphView.loadData(currentFilters);
        }
    });

    // Escuchar cambios en el estado interno del pivot (medidas, expandir)
    document.addEventListener('odooPivotStateChanged', () => {
        const currentFilters = (facturaList && facturaList.dataTable) ? facturaList.dataTable.currentFilters : {};
        const pivotEl = document.getElementById('view-pivot');
        const graphEl = document.getElementById('view-graph');
        const kanbanEl = document.getElementById('view-kanban');
        
        if (kanbanEl && kanbanEl.style.display !== 'none') {
            kanbanView.loadData(currentFilters);
        }
        if (pivotEl && pivotEl.style.display !== 'none') {
            pivotView.loadData(currentFilters);
        }
        if (graphEl && graphEl.style.display !== 'none') {
            graphView.loadData(currentFilters);
        }
    });

    // Escuchar cambios en los filtros para actualizar las vistas secundarias si están activas
    document.addEventListener('odooFiltersChanged', (e) => {
        const currentFilters = e.detail.filters;
        const pivotEl = document.getElementById('view-pivot');
        const graphEl = document.getElementById('view-graph');
        const kanbanEl = document.getElementById('view-kanban');
        
        if (kanbanEl && kanbanEl.style.display !== 'none') {
            kanbanView.loadData(currentFilters);
        }
        if (pivotEl && pivotEl.style.display !== 'none') {
            pivotView.loadData(currentFilters);
        }
        if (graphEl && graphEl.style.display !== 'none') {
            graphView.loadData(currentFilters);
        }
    });

    // Sincronizar el agrupador entre tabla dinámica y gráfico
    document.addEventListener('odooGroupByChanged', (e) => {
        const groupBy = e.detail.groupBy;
        const source = e.detail.source;
        const currentFilters = (facturaList && facturaList.dataTable) ? facturaList.dataTable.currentFilters : {};
        
        if (source === 'pivot' && graphView) {
            graphView.currentGroupBy = groupBy;
            const select = document.getElementById('graph-groupby-select');
            if (select) select.value = groupBy;
            const graphEl = document.getElementById('view-graph');
            if (graphEl && graphEl.style.display !== 'none') graphView.loadData(currentFilters);
        } else if (source === 'graph' && pivotView) {
            pivotView.currentRowGroup = groupBy;
            const select = document.getElementById('pivot-groupby-select');
            if (select) select.value = groupBy;
            const pivotEl = document.getElementById('view-pivot');
            if (pivotEl && pivotEl.style.display !== 'none') pivotView.loadData(currentFilters);
        }
    });

    // Escuchar el evento popstate (botón Atrás/Adelante del navegador)
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.view === 'form' && e.state.id) {
            openDetailView(e.state.id, false);
        } else {
            if (window.uiOdoo && uiOdoo.closeFormView) uiOdoo.closeFormView(false);
        }
    });

    // Leer la URL inicial por si entramos directamente a un enlace de factura
    const initialMatch = window.location.pathname.match(/\/facturas\/([^\/]+)$/);
    if (initialMatch) {
        const initialId = initialMatch[1];
        // Reemplazar estado inicial para que al dar "Atrás" sepa volver a la lista
        history.replaceState({ id: initialId, view: 'form' }, '', window.location.pathname);
        openDetailView(initialId, false);
    } else {
        history.replaceState({ view: 'list' }, '', window.location.pathname);
    }

    // Configurar acción Encontrar Guías
    const btnRegularizarGuias = document.getElementById('btn-regularizar-guias');
    if (btnRegularizarGuias) {
        btnRegularizarGuias.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                // Opcional: Cerrar el menú
                const gearMenu = document.getElementById('gear-menu');
                if (gearMenu) gearMenu.classList.remove('show');

                // Mostrar alerta de progreso (toast/alert nativo básico por ahora)
                const uploadStatus = document.getElementById('upload-status');
                if (uploadStatus) {
                    uploadStatus.className = 'status-loading';
                    uploadStatus.innerHTML = '<div class="loader"></div> Encontrando guías...';
                    uploadStatus.style.opacity = '1';
                    uploadStatus.style.display = 'inline-block';
                }

                // Llamar a la API
                const result = await api.regularizarFacturas();
                console.log('resultado regularizarFacturas', result);
                // Mostrar éxito
                if (uploadStatus) {
                    uploadStatus.className = 'status-success';
                    uploadStatus.innerHTML = `¡${result.mensaje || 'Guías regularizadas con éxito'}!`;
                    setTimeout(() => {
                        uploadStatus.style.opacity = '0';
                        setTimeout(() => uploadStatus.style.display = 'none', 300);
                    }, 3000);
                }

                // Recargar la tabla
                facturaList.loadFacturas();
            } catch (error) {
                console.error("Error al encontrar guías:", error);
                const uploadStatus = document.getElementById('upload-status');
                if (uploadStatus) {
                    uploadStatus.className = 'status-error';
                    uploadStatus.innerHTML = 'Error al encontrar guías.';
                    setTimeout(() => {
                        uploadStatus.style.opacity = '0';
                        setTimeout(() => uploadStatus.style.display = 'none', 300);
                    }, 3000);
                } else {
                    alert("Ocurrió un error al intentar encontrar las guías.");
                }
            }
        });
    }

    // Configurar formulario de carga de XML invisible
    setupUploadForm(api, facturaList);
});

/**
 * Configurar formulario de carga de facturas invisible
 */
function setupUploadForm(api, facturaList) {
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');

    if (!uploadForm || !uploadStatus) return;

    uploadForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const fileInput = document.getElementById('xml-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            return; // No se seleccionó archivo
        }

        try {
            // Mostrar estado de carga en la UI (animación simple)
            uploadStatus.className = 'status-loading';
            uploadStatus.innerHTML = '<div class="loader"></div> Subiendo...';
            uploadStatus.style.opacity = '1';

            // Preparar datos
            const formData = new FormData();
            formData.append('xml_file', fileInput.files[0]);

            // Enviar a la API
            await api.uploadFactura(formData);

            // Mostrar resultado exitoso
            uploadStatus.className = 'status-success';
            uploadStatus.innerHTML = '¡Cargado con éxito!';

            // Limpiar formulario
            uploadForm.reset();

            // Recargar lista de facturas
            facturaList.loadFacturas();

            // Ocultar mensaje después de 3 segundos
            setTimeout(() => {
                uploadStatus.style.opacity = '0';
                setTimeout(() => uploadStatus.innerHTML = '', 300);
            }, 3000);

        } catch (error) {
            // Mostrar error
            uploadStatus.className = 'status-error';
            uploadStatus.innerHTML = 'Error al subir.';
            console.error(error);

            // Ocultar mensaje después de 3 segundos
            setTimeout(() => {
                uploadStatus.style.opacity = '0';
                setTimeout(() => uploadStatus.innerHTML = '', 300);
            }, 3000);
        }
    });
}
