/**
 * DataTable.js - Versión completa con header-tools y selección de filas
 * 
 * Implementa una tabla moderna con selección de filas y barra de herramientas
 */
export class DataTable {
    constructor(config) {
        this.api = config.api;
        this.tableContainer = document.getElementById(config.tableContainerId);
        this.headerToolsContainer = document.getElementById(config.headerToolsId);
        this.paginationContainer = document.getElementById(config.paginationId);
        this.paginationInfoContainer = document.getElementById(config.paginationInfoId);

        // Configuración de tabla
        this.columns = config.columns || [];
        this.actions = config.actions || [];
        this.emptyMessage = config.emptyMessage || 'No se encontraron datos';
        this.onDataLoad = config.onDataLoad || (() => { });
        this.onSelectionChange = config.onSelectionChange || (() => { });

        // Configuración de selección
        this.selectionMode = config.selectionMode || 'single'; // 'single', 'multiple', 'none'
        this.selectableRows = config.selectableRows !== false; // true por defecto

        // Estado
        this.currentPage = 1;
        this.limit = config.limit || 10;
        this.currentFilters = {};
        this.selectedRows = new Set();
        this.currentData = [];

        // Configuración de búsqueda
        this.searchFormId = config.searchFormId;
        this.filterConfig = config.filterConfig || {};

        // Templates
        this.templates = {
            table: config.tableTemplate || this.getDefaultTableTemplate(),
            headerTools: config.headerToolsTemplate || this.getDefaultHeaderToolsTemplate()
        };

        // Estado de ordenamiento
        this.currentSort = {
            column: null,
            direction: 'desc'
        };
    }

    /**
     * Template por defecto para la tabla
     */
    getDefaultTableTemplate() {
        return `
            <div class="table-container">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead class="table-light">
                            <tr id="table-header">
                                ${this.selectionMode !== 'none' ? '<th width="40"><input type="checkbox" id="select-all-checkbox" title="Seleccionar todo"></th>' : ''}
                                <!-- Columnas se generarán dinámicamente -->
                            </tr>
                        </thead>
                        <tbody id="table-body">
                            <!-- Datos se generarán dinámicamente -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Template por defecto para header-tools
     * @returns {string} HTML template para header-tools
     */
    getDefaultHeaderToolsTemplate() {
        return `
            <div class="header-tools d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded">
                <div class="selection-info">
                    <span id="selection-count" class="text-muted">Ninguna fila seleccionada</span>
                </div>
                <div class="action-buttons" id="action-buttons">
                    <!-- Botones se generarán dinámicamente -->
                </div>
            </div>
        `;
    }

    /**
     * Inicializar el componente
     */
    init() {
        this.setupTable();
        this.setupHeaderTools();
        this.setupSearchForm();
        this.loadData();
    }

    /**
     * Configurar estructura de la tabla
     */
    setupTable() {
        if (!this.tableContainer) return;

        this.tableContainer.innerHTML = this.templates.table;

        // Referencias a elementos
        this.tableHeader = this.tableContainer.querySelector('#table-header');
        this.tableBody = this.tableContainer.querySelector('#table-body');
        this.selectAllCheckbox = this.tableContainer.querySelector('#select-all-checkbox');

        // Generar headers de columnas
        this.renderTableHeaders();

        // Configurar eventos de selección
        this.setupSelectionEvents();
    }

    /**
     * Configurar header-tools
     */
    setupHeaderTools() {
        if (!this.headerToolsContainer) return;

        this.headerToolsContainer.innerHTML = this.templates.headerTools;

        // Referencias a elementos
        this.selectionCountElement = this.headerToolsContainer.querySelector('#selection-count');
        this.actionButtonsContainer = this.headerToolsContainer.querySelector('#action-buttons');

        // Renderizar botones de acción
        this.renderActionButtons();

        // Configurar eventos de acciones
        this.setupActionEvents();
    }

    /**
     * Renderizar headers de la tabla
     */
    renderTableHeaders() {
        if (!this.tableHeader) return;

        // Limpiar headers existentes (excepto checkbox de selección)
        const checkboxHeader = this.tableHeader.querySelector('th');
        this.tableHeader.innerHTML = '';

        // Agregar checkbox de selección si está habilitado
        if (checkboxHeader && this.selectionMode !== 'none') {
            this.tableHeader.appendChild(checkboxHeader);
        }

        // Agregar headers de columnas
        this.columns.forEach(column => {
            const th = document.createElement('th');

            // Contenedor para texto e icono
            const div = document.createElement('div');
            div.className = 'd-flex align-items-center justify-content-between';
            div.style.gap = '5px';

            const spanText = document.createElement('span');
            spanText.textContent = column.label;
            div.appendChild(spanText);

            th.appendChild(div);

            if (column.className) {
                th.className = column.className;
            }

            if (column.width) {
                th.style.width = column.width;
            }

            // Agregar sorting si está habilitado
            if (column.sortable) {
                th.classList.add('sortable');
                th.style.cursor = 'pointer';
                th.title = 'Click para ordenar';

                // Icono de ordenamiento
                const icon = document.createElement('i');
                icon.className = 'fas fa-sort text-muted opacity-25'; // Icono neutro por defecto

                // Si esta columna es la actual ordenada
                if (this.currentSort.column === column.key) {
                    if (this.currentSort.direction === 'asc') {
                        icon.className = 'fas fa-sort-up text-primary';
                        th.classList.add('sort-asc');
                    } else {
                        icon.className = 'fas fa-sort-down text-primary';
                        th.classList.add('sort-desc');
                    }
                }

                div.appendChild(icon);

                th.addEventListener('click', () => this.handleSort(column.key));
            }

            this.tableHeader.appendChild(th);
        });
    }

    /**
     * Renderizar botones de acción en header-tools
     */
    renderActionButtons() {
        if (!this.actionButtonsContainer) return;// Limpiar botones existentes

        this.actionButtonsContainer.innerHTML = this.actions.map(action => {
            const disabled = this.selectedRows.size === 0 ? 'disabled' : '';
            const icon = action.icon ? `<i class="${action.icon}"></i> ` : '';

            return `
                <button class="btn btn-sm ${action.className || 'btn-secondary'} me-2" 
                        data-action="${action.key}"
                        title="${action.title || action.label}"
                        ${disabled}>
                    ${icon}${action.label}
                </button>
            `;
        }).join('');
    }

    /**
     * Configurar eventos de selección
     */
    setupSelectionEvents() {
        // Evento para select-all checkbox
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        // Los eventos de fila se configuran en renderTable()
    }

    /**
     * Configurar eventos de acciones
     */
    setupActionEvents() {
        if (!this.actionButtonsContainer) return;

        this.actionButtonsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (!button || button.disabled) return;

            const actionKey = button.getAttribute('data-action');
            const action = this.actions.find(a => a.key === actionKey);

            if (action && action.handler) {
                const selectedIds = Array.from(this.selectedRows);

                // Confirmar acción si es necesario
                if (action.confirm) {
                    const message = typeof action.confirm === 'function'
                        ? action.confirm(selectedIds)
                        : action.confirm;

                    if (!confirm(message)) return;
                }

                // Ejecutar handler
                if (this.selectionMode === 'single' && selectedIds.length === 1) {
                    action.handler(selectedIds[0], selectedIds);
                } else {
                    action.handler(selectedIds, selectedIds);
                }
            }
        });
    }

    /**
     * Cargar datos
     */
    async loadData() {
        try {
            this.showLoading();

            const result = await this.api.getData(
                this.currentFilters,
                this.currentPage,
                this.limit,
                this.currentSort.column,
                this.currentSort.direction
            );

            this.currentData = result.data.items;
            this.renderTable(this.currentData);
            this.renderPagination(result.data.paginacion);

            this.hideLoading();
            this.onDataLoad(result.data);

        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * Renderizar tabla de datos
     */
    renderTable(items) {
        if (!this.tableBody) return;

        this.tableBody.innerHTML = '';

        if (items.length === 0) {
            const colSpan = this.columns.length + (this.selectionMode !== 'none' ? 1 : 0);
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-inbox fa-2x mb-2"></i>
                            <p>${this.emptyMessage}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        items.forEach((item, index) => {
            const row = this.createTableRow(item, index);
            this.tableBody.appendChild(row);
        });

        // Actualizar estado de selección
        this.updateSelectionUI();
    }

    /**
     * Crear fila de tabla
     */
    createTableRow(item, index) {
        const row = document.createElement('tr');
        const itemId = this.getNestedValue(item, 'id');
        //console.log(`Creating row for item ID: ${itemId}, Index: ${index}`);

        row.setAttribute('data-id', Number(itemId));
        row.setAttribute('data-index', index);

        // Agregar clases de estado
        if (this.selectedRows.has(itemId)) {
            row.classList.add('table-primary', 'selected');
        }

        // Checkbox de selección
        if (this.selectionMode !== 'none') {
            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'row-checkbox';
            checkbox.checked = this.selectedRows.has(itemId);
            checkbox.addEventListener('change', (e) => {
                this.handleRowSelection(itemId, e.target.checked);
            });

            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);
        }

        // Celdas de datos
        this.columns.forEach(column => {
            const cell = document.createElement('td');
            let value = this.getNestedValue(item, column.key);

            // Aplicar formateador
            if (column.formatter) {
                value = column.formatter(value, item);
            }

            // Aplicar clase CSS
            if (column.className) {
                cell.className = column.className;
            }

            cell.innerHTML = value || '';
            row.appendChild(cell);
        });

        // Evento de clic en fila (para selección)
        if (this.selectionMode !== 'none') {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                // Ignorar clics en checkboxes
                if (e.target.type === 'checkbox') return;

                const checkbox = row.querySelector('.row-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.handleRowSelection(itemId, checkbox.checked);
                }
            });
        }

        return row;
    }

    /**
     * Manejar selección de fila
     */
    handleRowSelection(itemId, selected) {
        if (selected) {
            if (this.selectionMode === 'single') {
                // Limpiar selección previa en modo single
                this.selectedRows.clear();
                this.tableBody.querySelectorAll('tr.selected').forEach(row => {
                    row.classList.remove('table-primary', 'selected');
                    const checkbox = row.querySelector('.row-checkbox');
                    if (checkbox) checkbox.checked = false;
                });
            }

            this.selectedRows.add(itemId);
        } else {
            this.selectedRows.delete(itemId);
        }

        this.updateSelectionUI();
        this.updateActionButtons();
        this.onSelectionChange(Array.from(this.selectedRows));
    }

    /**
     * Manejar selección de todas las filas
     */
    handleSelectAll(selectAll) {
        this.selectedRows.clear();

        if (selectAll) {
            this.currentData.forEach(item => {
                const itemId = this.getNestedValue(item, 'id');
                this.selectedRows.add(itemId);
            });
        }

        // Actualizar checkboxes de filas
        this.tableBody.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = selectAll;
        });

        // Actualizar clases de filas
        this.tableBody.querySelectorAll('tr[data-id]').forEach(row => {
            if (selectAll) {
                row.classList.add('table-primary', 'selected');
            } else {
                row.classList.remove('table-primary', 'selected');
            }
        });

        this.updateSelectionUI();
        this.updateActionButtons();
        this.onSelectionChange(Array.from(this.selectedRows));
    }

    /**
     * Actualizar UI de selección
     */
    updateSelectionUI() {
        if (!this.selectionCountElement) return;

        const selectedCount = this.selectedRows.size;
        const totalCount = this.currentData.length;

        if (selectedCount === 0) {
            this.selectionCountElement.textContent = 'Ninguna fila seleccionada';
            this.selectionCountElement.className = 'text-muted';
        } else if (selectedCount === 1) {
            this.selectionCountElement.textContent = '1 fila seleccionada';
            this.selectionCountElement.className = 'text-primary fw-bold';
        } else {
            this.selectionCountElement.textContent = `${selectedCount} filas seleccionadas`;
            this.selectionCountElement.className = 'text-primary fw-bold';
        }

        // Actualizar estado del checkbox select-all
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
            this.selectAllCheckbox.checked = selectedCount === totalCount && totalCount > 0;
        }
    }

    /**
     * Actualizar estado de botones de acción
     */
    updateActionButtons() {
        if (!this.actionButtonsContainer) return;

        const selectedCount = this.selectedRows.size;

        this.actionButtonsContainer.querySelectorAll('button[data-action]').forEach(button => {
            const actionKey = button.getAttribute('data-action');
            const action = this.actions.find(a => a.key === actionKey);

            // Verificar si la acción debe estar habilitada
            let enabled = selectedCount > 0;

            if (action.minSelection && selectedCount < action.minSelection) {
                enabled = false;
            }

            if (action.maxSelection && selectedCount > action.maxSelection) {
                enabled = false;
            }

            if (action.enabled && typeof action.enabled === 'function') {
                enabled = enabled && action.enabled(Array.from(this.selectedRows));
            }

            button.disabled = !enabled;
            button.classList.toggle('disabled', !enabled);
        });
    }

    /**
     * Renderizar paginación (sin cambios del original)
     */
    renderPagination(paginacion) {
        if (!this.paginationContainer || !this.paginationInfoContainer) return;

        this.paginationContainer.innerHTML = '';

        // Información de paginación
        this.paginationInfoContainer.textContent =
            `Mostrando ${paginacion.items_por_pagina} de ${paginacion.total} elementos`;

        if (paginacion.total_paginas <= 1) return;

        // Botón "Anterior"
        const prevButton = document.createElement('li');
        prevButton.className = `page-item ${paginacion.pagina_actual === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = `<a class="page-link" href="#">&laquo;</a>`;

        if (paginacion.pagina_actual > 1) {
            prevButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.changePage(paginacion.pagina_actual - 1);
            });
        }

        this.paginationContainer.appendChild(prevButton);

        // Números de página
        let startPage = Math.max(1, paginacion.pagina_actual - 2);
        let endPage = Math.min(paginacion.total_paginas, startPage + 4);

        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageItem = document.createElement('li');
            pageItem.className = `page-item ${i === paginacion.pagina_actual ? 'active' : ''}`;
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;

            pageItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.changePage(i);
            });

            this.paginationContainer.appendChild(pageItem);
        }

        // Botón "Siguiente"
        const nextButton = document.createElement('li');
        nextButton.className = `page-item ${paginacion.pagina_actual === paginacion.total_paginas ? 'disabled' : ''}`;
        nextButton.innerHTML = `<a class="page-link" href="#">&raquo;</a>`;

        if (paginacion.pagina_actual < paginacion.total_paginas) {
            nextButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.changePage(paginacion.pagina_actual + 1);
            });
        }

        this.paginationContainer.appendChild(nextButton);
    }

    /**
     * Cambiar página
     */
    changePage(page) {
        this.currentPage = page;
        this.selectedRows.clear(); // Limpiar selección al cambiar página
        this.loadData();
    }

    /**
     * Configurar formulario de búsqueda
     */
    setupSearchForm() {
        if (!this.searchFormId) return;

        const searchForm = document.getElementById(this.searchFormId);
        if (!searchForm) return;

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSearch(e.target);
        });

        searchForm.addEventListener('reset', () => {
            this.currentFilters = {};
            this.currentPage = 1;
            this.selectedRows.clear();
            this.loadData();
        });
    }

    /**
     * Manejar búsqueda
     */
    handleSearch(form) {
        const formData = new FormData(form);
        const filters = {};

        for (const [key, value] of formData.entries()) {
            if (value) {
                if (this.filterConfig[key]) {
                    const config = this.filterConfig[key];
                    if (config.transform) {
                        filters[config.targetField || key] = config.transform(value);
                    } else {
                        filters[config.targetField || key] = value;
                    }

                    if (config.validate && !config.validate(value)) {
                        this.showError(config.errorMessage || `Valor inválido para ${key}`);
                        return;
                    }
                } else {
                    filters[key] = value;
                }
            }
        }

        this.currentFilters = filters;
        this.currentPage = 1;
        this.selectedRows.clear();
        this.loadData();
    }

    /**
     * Manejar ordenamiento de columnas
     */
    handleSort(columnKey) {
        // Toggle dirección si es la misma columna, sino default a 'asc'
        if (this.currentSort.column === columnKey) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = columnKey;
            this.currentSort.direction = 'asc';
        }

        // Actualizar UI de headers
        this.updateSortIcons();

        // Recargar datos
        this.loadData();
    }

    /**
     * Actualizar iconos de ordenamiento en headers
     */
    updateSortIcons() {
        if (!this.tableHeader) return;

        const headers = this.tableHeader.querySelectorAll('th');
        headers.forEach(th => {
            // Remover clases de iconos previos
            th.classList.remove('sort-asc', 'sort-desc');

            // Buscar si es la columna actual ordenada
            // Asumimos que el evento click se asigna en el orden de columns
            // Una mejor aproximación sería guardar la ref al th en columns o usar data attributes
            // Pero como handleSort recibe columnKey, necesitamos mapear de vuelta si queremos ser precisos
            // O simplemente iterar columnas y buscar el th correspondiente.

            // Dado que renderTableHeaders itera this.columns y crea th en orden
            // Podemos iterar y comparar texto o mejor, agregar data-key al renderizar
        });

        // Re-implementando renderTableHeaders para soportar iconos mejor
        this.renderTableHeaders();
    }

    /**
     * Obtener valor anidado
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * Mostrar carga
     */
    showLoading() {
        if (!this.tableBody) return;

        const colSpan = this.columns.length + (this.selectionMode !== 'none' ? 1 : 0);
        this.tableBody.innerHTML = `
            <tr>
                <td colspan="${colSpan}" class="text-center py-5">
                    <div class="d-flex justify-content-center align-items-center">
                        <div class="spinner-border text-primary me-3" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <span class="text-muted">Cargando datos...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Mostrar error
     */
    showError(message) {
        if (!this.tableBody) return;

        const colSpan = this.columns.length + (this.selectionMode !== 'none' ? 1 : 0);
        this.tableBody.innerHTML = `
            <tr>
                <td colspan="${colSpan}" class="text-center py-4">
                    <div class="text-danger">
                        <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                        <p class="mb-0">${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Ocultar carga
     */
    hideLoading() {
        // Se maneja automáticamente en renderTable
    }

    /**
     * Métodos públicos
     */
    refresh() {
        this.loadData();
    }

    getSelectedRows() {
        return Array.from(this.selectedRows);
    }

    clearSelection() {
        this.selectedRows.clear();
        this.updateSelectionUI();
        this.updateActionButtons();
    }

    selectRows(ids) {
        ids.forEach(id => this.selectedRows.add(Number(id)));
        this.updateSelectionUI();
        this.updateActionButtons();
    }

    getState() {
        return {
            currentPage: this.currentPage,
            currentFilters: this.currentFilters,
            selectedRows: Array.from(this.selectedRows),
            limit: this.limit
        };
    }
}