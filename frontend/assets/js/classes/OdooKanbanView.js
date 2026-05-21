/**
 * OdooKanbanView.js
 * 
 * Componente genérico y modular para renderizar un tablero Kanban interactivo estilo Odoo.
 * Soporta filtros, arrastrar y soltar (Drag and Drop) nativo, desgloses y cálculo de totales.
 */
export class OdooKanbanView {
    /**
     * @param {Object} api Instancia del API
     * @param {string} containerId ID del elemento DOM contenedor
     * @param {Object} config Configuración personalizada del Kanban
     */
    constructor(api, containerId, config = {}) {
        this.api = api;
        this.container = document.getElementById(containerId);
        
        // Configuración por defecto estructurada para facturas pero configurable para otros módulos
        this.config = {
            groupBy: 'state', // Campo por el cual agrupar las columnas
            columns: {
                'draft': { label: 'Borrador', color: '#adb5bd' },
                'posted': { label: 'Confirmado', color: '#28a745' },
                'cancel': { label: 'Cancelado', color: '#343a40' }
            },
            renderCard: (item) => this.defaultRenderCard(item),
            onCardClick: (id) => {},
            onStateChange: async (id, newState) => {},
            ...config
        };

        this.currentData = [];
        this.currentFilters = {};
    }

    /**
     * Inicializa la vista Kanban inyectando los estilos CSS básicos necesarios
     */
    init() {
        if (!this.container) return;
        this.injectStyles();
    }

    /**
     * Carga y renderiza los datos en base a filtros globales
     * @param {Object} filters Filtros de búsqueda
     */
    async loadData(filters = {}) {
        this.currentFilters = { ...filters };
        try {
            // Mostrar estado de carga
            this.container.innerHTML = `
                <div class="d-flex justify-content-center align-items-center" style="height: 300px;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </div>
            `;

            // Obtener listado de facturas. Se solicita un límite alto (10000) para mostrar la distribución Kanban completa.
            const result = await this.api.getFacturas(this.currentFilters, 1, 10000);
            this.currentData = result.data.facturas || [];

            this.render();
        } catch (err) {
            console.error("Error al cargar datos en Kanban:", err);
            this.container.innerHTML = `
                <div class="alert alert-danger text-center m-4">
                    Hubo un problema al cargar el tablero Kanban.
                </div>
            `;
        }
    }

    /**
     * Inyecta estilos CSS específicos para el Kanban en el documento
     */
    injectStyles() {
        if (document.getElementById('o-kanban-styles')) return;

        const style = document.createElement('style');
        style.id = 'o-kanban-styles';
        style.innerHTML = `
            .o-kanban-board {
                display: flex;
                gap: 16px;
                overflow-x: auto;
                padding: 10px 0;
                align-items: flex-start;
                height: calc(100vh - 190px);
                scrollbar-width: thin;
            }
            .o-kanban-column {
                flex: 0 0 310px;
                background-color: #f3f4f6;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                max-height: 100%;
                border: 1px solid #e5e7eb;
                transition: background-color 0.2s ease, border-color 0.2s ease;
            }
            .o-kanban-column.drag-over {
                background-color: #e5e7eb !important;
                border: 2px dashed #9ca3af !important;
            }
            .o-kanban-column-header {
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                background-color: #f9fafb;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                border-bottom: 1px solid #e5e7eb;
            }
            .o-kanban-column-header-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .o-kanban-column-title {
                font-size: 13px;
                font-weight: 600;
                color: #374151;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .o-kanban-column-counter {
                font-size: 11px;
                background: #e5e7eb;
                color: #4b5563;
                padding: 1px 6px;
                border-radius: 12px;
                font-weight: 600;
            }
            .o-kanban-column-sum {
                font-size: 12px;
                font-weight: 600;
                color: #4b5563;
            }
            .o-kanban-cards-container {
                padding: 10px;
                overflow-y: auto;
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-height: 150px;
                background-color: #f3f4f6;
                border-bottom-left-radius: 6px;
                border-bottom-right-radius: 6px;
            }
            .o-kanban-card {
                background-color: white;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: 10px 12px;
                cursor: grab;
                user-select: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
                display: flex;
                flex-direction: column;
                gap: 6px;
                position: relative;
            }
            .o-kanban-card:hover {
                box-shadow: 0 4px 6px rgba(0,0,0,0.08);
                transform: translateY(-1px);
            }
            .o-kanban-card:active {
                cursor: grabbing;
            }
            .o-kanban-card-title {
                font-size: 13px;
                font-weight: 600;
                color: #714B67;
            }
            .o-kanban-card-client {
                font-size: 12px;
                color: #4b5563;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .o-kanban-card-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 4px;
                font-size: 11px;
            }
            .o-kanban-card-date {
                color: #9ca3af;
            }
            .o-kanban-card-total {
                font-weight: 600;
                color: #111827;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Dibuja la grilla Kanban y organiza las tarjetas por columna
     */
    render() {
        if (!this.container) return;

        // Limpiar contenedor
        this.container.innerHTML = '';

        const board = document.createElement('div');
        board.className = 'o-kanban-board';

        const columnsData = {};
        
        // Agrupar los datos por la columna configurada
        Object.keys(this.config.columns).forEach(colKey => {
            columnsData[colKey] = {
                items: [],
                totalSum: 0
            };
        });

        // Distribuir elementos
        this.currentData.forEach(item => {
            const groupVal = item[this.config.groupBy] || 'draft';
            
            // Si el estado o agrupación no existe en el mapa de columnas, clasificar en draft por defecto
            const targetCol = columnsData[groupVal] ? groupVal : Object.keys(this.config.columns)[0];
            
            columnsData[targetCol].items.push(item);

            // Suma del total (soportando tipo de cambio si existiera)
            const rate = parseFloat(item.invoice_currency_rate) || 1;
            const itemTotal = (parseFloat(item.monto_total || 0) * rate);
            columnsData[targetCol].totalSum += itemTotal;
        });

        // Crear las columnas en el DOM
        Object.keys(this.config.columns).forEach(colKey => {
            const colDef = this.config.columns[colKey];
            const colData = columnsData[colKey];

            const colEl = document.createElement('div');
            colEl.className = 'o-kanban-column';
            colEl.dataset.colId = colKey;

            // Formatear la sumatoria
            const formattedSum = colData.totalSum.toLocaleString('en-US', {
                style: 'currency',
                currency: 'PEN'
            });

            // Cabecera de la columna
            colEl.innerHTML = `
                <div class="o-kanban-column-header">
                    <div class="o-kanban-column-header-row">
                        <div class="o-kanban-column-title">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${colDef.color};"></span>
                            ${colDef.label}
                        </div>
                        <span class="o-kanban-column-counter">${colData.items.length}</span>
                    </div>
                    <div class="o-kanban-column-sum text-muted">${formattedSum}</div>
                </div>
            `;

            // Contenedor de las tarjetas
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'o-kanban-cards-container';
            cardsContainer.dataset.colId = colKey;

            // Renderizar cada tarjeta
            colData.items.forEach(item => {
                const cardEl = document.createElement('div');
                cardEl.className = 'o-kanban-card';
                cardEl.draggable = true;
                cardEl.dataset.cardId = item.id;
                cardEl.style.borderLeft = `4px solid ${colDef.color}`;

                // Plantilla de renderizado de la tarjeta
                cardEl.innerHTML = this.config.renderCard(item);

                // Eventos de click para ver detalle (SPA)
                cardEl.addEventListener('click', (e) => {
                    // Evitar activar la vista si se está interactuando con inputs u otros elementos internos
                    if (e.target.closest('input') || e.target.closest('button')) return;
                    this.config.onCardClick(item.id);
                });

                // Drag Start
                cardEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', String(item.id));
                    e.dataTransfer.setData('source-col', colKey);
                    setTimeout(() => {
                        cardEl.style.opacity = '0.4';
                    }, 0);
                });

                // Drag End
                cardEl.addEventListener('dragend', () => {
                    cardEl.style.opacity = '1';
                });

                cardsContainer.appendChild(cardEl);
            });

            // Eventos Drag and Drop en el contenedor de tarjetas
            cardsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                colEl.classList.add('drag-over');
            });

            cardsContainer.addEventListener('dragleave', () => {
                colEl.classList.remove('drag-over');
            });

            cardsContainer.addEventListener('drop', async (e) => {
                e.preventDefault();
                colEl.classList.remove('drag-over');

                const cardId = e.dataTransfer.getData('text/plain');
                const sourceCol = e.dataTransfer.getData('source-col');
                const targetCol = colKey;

                if (cardId && sourceCol !== targetCol) {
                    try {
                        // Actualizar localmente la interfaz al instante para mejorar la UX (Optimistic UI)
                        const cardDom = cardsContainer.querySelector(`[data-card-id="${cardId}"]`) || 
                                        document.querySelector(`[data-card-id="${cardId}"]`);
                        
                        if (cardDom) {
                            // Cambiar borde lateral de la tarjeta
                            cardDom.style.borderLeft = `4px solid ${colDef.color}`;
                            // Mover en el DOM
                            cardsContainer.appendChild(cardDom);
                        }

                        // Guardar en la base de datos
                        await this.config.onStateChange(cardId, targetCol);

                        // Recargar todo el tablero para recalcular totales y alineación oficial de datos
                        await this.loadData(this.currentFilters);

                    } catch (error) {
                        console.error("Error al mover tarjeta de estado:", error);
                        alert("No se pudo actualizar el estado de la factura.");
                        // Revertir recargando los datos
                        await this.loadData(this.currentFilters);
                    }
                }
            });

            colEl.appendChild(cardsContainer);
            board.appendChild(colEl);
        });

        this.container.appendChild(board);
    }

    /**
     * Renderizado por defecto de la tarjeta para facturas
     * @param {Object} item Datos del objeto factura
     * @returns {string} Código HTML interno para la tarjeta
     */
    defaultRenderCard(item) {
        const rate = parseFloat(item.invoice_currency_rate) || 1;
        const totalPEN = (parseFloat(item.monto_total || 0) * rate);
        const formattedTotal = totalPEN.toLocaleString('en-US', {
            style: 'currency',
            currency: 'PEN'
        });

        // Formatear la fecha
        const dateParts = (item.fecha_emision || '').split('-');
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.fecha_emision;

        const entityName = window.currentModule === 'in_invoice' ? item.nombre_emisor : item.nombre_receptor;

        return `
            <div class="o-kanban-card-title">${item.numero_factura || 'Factura sin número'}</div>
            <div class="o-kanban-card-client" title="${entityName}">${entityName || 'Sin cliente/proveedor'}</div>
            <div class="o-kanban-card-footer">
                <div class="o-kanban-card-date">
                    <i class="fa-regular fa-calendar me-1"></i> ${formattedDate}
                </div>
                <div class="o-kanban-card-total">${formattedTotal}</div>
            </div>
        `;
    }
}
