/**
 * Clase FacturaViewer
 * 
 * Maneja la visualización detallada de una factura electrónica
 */
export class FacturaViewer {
    /**
     * Constructor
     * 
     * @param {FacturaAPI} api Instancia de FacturaAPI
     * @param {string} viewerContainerId ID del contenedor del visualizador
     * @param {string} sectionId ID de la sección completa
     * @param {string} titleId ID del elemento título
     */
    constructor(api, viewerContainerId = 'factura-viewer-container', sectionId = 'view-form', titleId = 'fld-serie-numero') {
        this.api = api;
        this.viewerContainerId = viewerContainerId;
        this.sectionId = sectionId;
        this.titleId = titleId;
        this.currentFacturaId = null;

        // Llamar init() para capturar referencias actuales del DOM
        this.init();

        // Configurar evento de cierre si existe
        this.closeButton = document.getElementById('close-viewer-btn');
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        }
    }

    /**
     * Inicializar o reinicializar el visualizador (necesario cuando el DOM cambia dinámicamente)
     */
    init() {
        this.viewerContainer = document.getElementById(this.viewerContainerId);
        this.section = document.getElementById(this.sectionId);
        this.titleElement = document.getElementById(this.titleId);
        this.facturaTemplate = document.getElementById('factura-template');
        this.itemTemplate = document.getElementById('item-template');
    }

    /**
     * Cargar y mostrar una factura
     * 
     * @param {number} id ID de la factura a mostrar
     */
    async loadFactura(id) {
        if (!this.viewerContainer) {
            this.viewerContainer = document.getElementById('factura-viewer-container');
        }
        if (!this.viewerContainer) return;

        try {
            this.currentFacturaId = Number(id);
            this.showLoading();

            const result = await this.api.getFacturaById(id);

            if (!result.success) {
                throw new Error(result.message || 'Error al cargar la factura');
            }

            this.renderFactura(result.data);
            this.show();
        } catch (error) {
            this.showError(error.message);
            console.log('Error en FacturaViewer:', error);

        }
    }

    /**
     * Renderizar factura (solo vista Odoo)
     * 
     * @param {Object} data Datos de la factura
     */
    renderFactura(data) {
        // Guardar en memoria para cuando se pida la vista impresa
        this.currentFacturaData = data;

        // Verificar si tenemos los detalles necesarios
        if (!data.detalles) {
            this.showError('La factura no contiene datos válidos');
            return;
        }

        console.log('data invoice:', data);
        console.log('data invoice detalles:', data.detalles);

        // Establecer título
        if (this.titleElement) {
            this.titleElement.textContent = data.detalles.factura.serie;
        }

        // Rellenar el formulario Odoo (Vista principal)
        this.fillOdooForm(data);
    }

    /**
     * Renderiza e inyecta la plantilla A4 de impresión solo bajo demanda
     */
    renderPrintPreview() {
        const data = this.currentFacturaData;
        if (!data || !data.detalles) {
            this.showError('No hay datos de factura para previsualizar');
            return;
        }

        if (!this.viewerContainer || !this.facturaTemplate) return;

        // Limpiar contenedor
        this.viewerContainer.innerHTML = '';

        // Clonar la plantilla
        const facturaElement = this.facturaTemplate.content.cloneNode(true);

        // Helper seguro
        const setVal = (selector, val) => {
            const el = facturaElement.querySelector(selector);
            if (el) el.textContent = val;
        };

        // Rellenar datos del emisor
        setVal('#emisor-nombre', data.detalles.emisor.razonSocial);
        setVal('#empresa-nombre', data.detalles.emisor.razonSocial); // Por si se muestra el logo
        setVal('#emisor-direccion', `${data.detalles.emisor.direccion}, ${data.detalles.emisor.distrito}, ${data.detalles.emisor.provincia}`);
        setVal('#emisor-ruc', data.detalles.emisor.ruc);

        // Rellenar datos de la factura
        setVal('#documento-serie-numero', data.detalles.factura.serie);
        setVal('#fecha-emision', this.formatDate(data.detalles.factura.fechaEmision));
        setVal('#receptor-nombre', data.detalles.receptor.razonSocial);
        setVal('#receptor-ruc', data.detalles.receptor.ruc);
        setVal('#receptor-direccion', data.detalles.receptor.direccion);
        setVal('#moneda-nombre', this.getMonedaText(data.detalles.factura.moneda));
        
        // Guia remision
        const guiaEl = facturaElement.querySelector('#guia-remision');
        if (guiaEl) {
            guiaEl.textContent = data.detalles.factura.guiaRemision ? data.detalles.factura.guiaRemision : 'N/D';
            const guiasContainer = facturaElement.querySelector('#guias-container');
            if (guiasContainer && data.detalles.factura.guiaRemision) {
                guiasContainer.style.display = 'flex';
            }
        }

        // Rellenar detalles/items
        const itemsContainer = facturaElement.querySelector('#items-table-body');
        if (itemsContainer && data.detalles.detalles) {
            this.renderItems(itemsContainer, data.detalles.detalles);
        }

        // Rellenar totales
        setVal('#monto-letras', data.detalles.factura.totalLetras);
        setVal('#total-gravado', this.formatMoney(data.detalles.totales.gravadas, data.detalles.factura.moneda));
        setVal('#total-igv', this.formatMoney(data.detalles.totales.igv, data.detalles.factura.moneda));
        setVal('#monto-total', this.formatMoney(data.detalles.totales.total, data.detalles.factura.moneda));

        // Generar QR code
        const qrCodeElement = facturaElement.querySelector('#qr-code-container');
        if (qrCodeElement) {
            setTimeout(() => {
                this.generateQRCode(qrCodeElement, data.detalles.emisor.ruc, data.detalles.receptor.ruc, data.detalles.factura.serie);
            }, 100); // Pequeño retraso para asegurar que el elemento esté en el DOM
        }

        // Agregar al contenedor
        this.viewerContainer.appendChild(facturaElement);
    }

    /**
     * Prepara y abre el Modal de Vista Previa
     */
    openPrintPreview() {
        // Asegurarse de que el DOM esté listo y tenga las referencias
        if (!this.viewerContainer) this.init();
        
        // Renderizar la plantilla usando la memoria actual
        this.renderPrintPreview();
        
        // Abrir el modal de vista previa personalizado (sin Bootstrap)
        const modalEl = document.getElementById('modal-print-view');
        if (modalEl) {
            modalEl.style.display = 'flex';
            this.initZoom();
        } else {
            console.error("No se encontró el modal-print-view en el DOM");
        }
    }

    /**
     * Inicializa los controles de zoom para la previsualización A4
     */
    initZoom() {
        if (this._zoomInitialized) return;
        this._zoomInitialized = true;
        this.currentZoom = 1;
        
        const btnIn = document.getElementById('btn-zoom-in');
        const btnOut = document.getElementById('btn-zoom-out');
        const zoomLevel = document.getElementById('zoom-level');
        const container = document.getElementById('factura-viewer-container');
        
        const updateZoom = () => {
            if (container) {
                container.style.transform = `scale(${this.currentZoom})`;
            }
            if (zoomLevel) {
                zoomLevel.textContent = Math.round(this.currentZoom * 100) + '%';
            }
        };

        if (btnIn) {
            btnIn.addEventListener('click', () => {
                if (this.currentZoom < 2.0) {
                    this.currentZoom += 0.1;
                    updateZoom();
                }
            });
        }

        if (btnOut) {
            btnOut.addEventListener('click', () => {
                if (this.currentZoom > 0.4) {
                    this.currentZoom -= 0.1;
                    updateZoom();
                }
            });
        }
    }

    /**
     * Rellena los campos de la vista "Form View" nativa de Odoo
     */
    fillOdooForm(data) {
        if (!data || !data.detalles) return;

        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt || '';
        };

        // Cabecera
        setTxt('fld-serie-numero', data.detalles.factura.serie);

        // Cliente o Proveedor según move_type
        const isCompra = data.move_type === 'in_invoice';
        const labelElem = document.querySelector('#fld-cliente-nombre').closest('.o-field-row').querySelector('.o-field-label');
        if (labelElem) {
            labelElem.textContent = isCompra ? 'Proveedor' : 'Cliente';
        }

        // Entidad objetivo: en compra el proveedor es el emisor, en venta el cliente es el receptor
        const entidad = isCompra ? data.detalles.emisor : data.detalles.receptor;

        // Cliente / Proveedor
        setTxt('fld-cliente-nombre', entidad.razonSocial);
        setTxt('fld-cliente-direccion', entidad.direccion);
        setTxt('fld-cliente-ruc', entidad.ruc);
        setTxt('fld-guia', data.detalles.factura.guiaRemision || 'N/D');

        // Detalles factura
        setTxt('fld-fecha-emision', this.formatDate(data.detalles.factura.fechaEmision));
        setTxt('fld-moneda', this.getMonedaText(data.detalles.factura.moneda));
        setTxt('fld-forma-pago', data.detalles.factura.formaPago);

        // Tabla de líneas
        const tbody = document.getElementById('fld-items-tbody');
        const moneda = data.detalles.factura.moneda;
        
        if (tbody && data.detalles.detalles) {
            tbody.innerHTML = data.detalles.detalles.map(item => `
                <tr>
                    <td class="num">${item.cantidad}</td>
                    <td>${this.getUnidadMedidaText(item.unidad)}</td>
                    <td>${item.descripcion}</td>
                    <td class="num">${this.formatMoney(item.valorUnitario, moneda)}</td>
                    <td class="num">${this.formatMoney(item.valorUnitario * item.cantidad, moneda)}</td>
                </tr>
            `).join('');
        }

        // Totales
        setTxt('fld-subtotal', this.formatMoney(data.detalles.totales.gravadas, data.detalles.factura.moneda));
        setTxt('fld-igv', this.formatMoney(data.detalles.totales.igv, data.detalles.factura.moneda));
        setTxt('fld-total', this.formatMoney(data.detalles.totales.total, data.detalles.factura.moneda));

        // Actualizar Status Bar (Visual)
        const statusBar = document.getElementById('form-statusbar');
        if (statusBar) {
            let html = '';
            const currentState = data.state || 'draft';
            if (currentState === 'draft') {
                html = `
                    <button class="o-status-step current" disabled="">Borrador</button>
                    <button class="o-status-step" disabled="">Confirmado</button>
                `;
            } else if (currentState === 'posted') {
                html = `
                    <button class="o-status-step done" disabled="">Borrador</button>
                    <button class="o-status-step current" disabled="">Confirmado</button>
                `;
            } else if (currentState === 'cancel') {
                html = `
                    <button class="o-status-step done" disabled="">Borrador</button>
                    <button class="o-status-step done" disabled="">Confirmado</button>
                    <button class="o-status-step current" disabled="">Cancelado</button>
                `;
            }
            statusBar.innerHTML = html;
        }

        // Actualizar visibilidad de botones de acción
        const btnConfirmar = document.getElementById('btn-action-confirmar');
        const btnBorrador = document.getElementById('btn-action-borrador');
        const btnCancelar = document.getElementById('btn-action-cancelar');
        
        const currentState = data.state || 'draft';
        if (btnConfirmar && btnBorrador && btnCancelar) {
            if (currentState === 'draft') {
                btnConfirmar.style.display = 'inline-block';
                btnCancelar.style.display = 'inline-block';
                btnBorrador.style.display = 'none';
            } else if (currentState === 'posted') {
                btnConfirmar.style.display = 'none';
                btnCancelar.style.display = 'none'; // A veces no se puede cancelar una vez confirmado en Odoo, pero por ahora lo ocultamos
                btnBorrador.style.display = 'inline-block';
            } else if (currentState === 'cancel') {
                btnConfirmar.style.display = 'none';
                btnCancelar.style.display = 'none';
                btnBorrador.style.display = 'inline-block';
            }
        }
    }

    /**
     * Cambiar el estado de la factura actual
     * @param {string} newState Nuevo estado
     */
    changeState(newState) {
        if (!this.currentFacturaId) return;

        console.log("Iniciando cambio de estado optimista a:", newState);
        const previousState = this.currentData ? this.currentData.state : 'draft';

        // 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA (Síncrona)
        if (this.currentData) {
            this.currentData.state = newState;
        }

        // Actualizar directamente el DOM para asegurar que no hay problemas en fillOdooForm
        const statusBar = document.getElementById('form-statusbar');
        if (statusBar) {
            if (newState === 'draft') {
                statusBar.innerHTML = `
                    <button class="o-status-step current" disabled="">Borrador</button>
                    <button class="o-status-step" disabled="">Confirmado</button>
                `;
            } else if (newState === 'posted') {
                statusBar.innerHTML = `
                    <button class="o-status-step done" disabled="">Borrador</button>
                    <button class="o-status-step current" disabled="">Confirmado</button>
                `;
            } else if (newState === 'cancel') {
                statusBar.innerHTML = `
                    <button class="o-status-step done" disabled="">Borrador</button>
                    <button class="o-status-step done" disabled="">Confirmado</button>
                    <button class="o-status-step current" disabled="">Cancelado</button>
                `;
            }
            statusBar.style.opacity = '0.7';
        }

        // Actualizar visibilidad de los botones izquierdos
        const btnConfirmar = document.getElementById('btn-action-confirmar');
        const btnBorrador = document.getElementById('btn-action-borrador');
        const btnCancelar = document.getElementById('btn-action-cancelar');
        if (btnConfirmar && btnBorrador && btnCancelar) {
            if (newState === 'draft') {
                btnConfirmar.style.display = 'inline-block';
                btnCancelar.style.display = 'inline-block';
                btnBorrador.style.display = 'none';
            } else if (newState === 'posted') {
                btnConfirmar.style.display = 'none';
                btnCancelar.style.display = 'none'; 
                btnBorrador.style.display = 'inline-block';
            } else if (newState === 'cancel') {
                btnConfirmar.style.display = 'none';
                btnCancelar.style.display = 'none';
                btnBorrador.style.display = 'inline-block';
            }
        }

        // Forzar al navegador a pintar los cambios antes de ejecutar operaciones asíncronas pesadas
        setTimeout(async () => {
            try {
                // 2. Llamar a la API en segundo plano
                const result = await this.api.updateState(this.currentFacturaId, newState);

                if (result && result.success) {
                    console.log('Estado actualizado correctamente en la BD');
                    // Actualizar silenciosamente la tabla principal en background
                    if (window.facturaList && typeof window.facturaList.loadFacturas === 'function') {
                        window.facturaList.loadFacturas();
                    }
                }
            } catch (error) {
                console.error('Error al cambiar el estado:', error);
                
                // 3. REVERTIR (Rollback) si hubo error
                if (this.currentData) {
                    this.currentData.state = previousState;
                    this.fillOdooForm(this.currentData);
                }
                alert('Error al comunicar con el servidor. Se revertirá el cambio.');
            } finally {
                if (statusBar) statusBar.style.opacity = '1';
            }
        }, 50); // 50ms es suficiente para que el navegador haga el render
    }

    /**
     * Renderizar items de la factura
     * 
     * @param {HTMLElement} container Contenedor donde insertar los items
     * @param {Array} items Lista de items a mostrar
     */
    renderItems(container, items) {
        if (!container || !items || !items.length) {
            console.warn("No se puede renderizar items: faltan datos o contenedor", { container, items });
            return;
        }

        // Limpiar contenedor
        container.innerHTML = '';

        items.forEach((item, index) => {
            const moneda = this.currentFacturaData ? this.currentFacturaData.detalles.factura.moneda : 'PEN';
            const igvVal = item.igv !== undefined ? item.igv : (item.valorUnitario * item.cantidad * 0.18);
            const importeVal = item.valorUnitario * item.cantidad;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center item-numero border-secondary">${index + 1}</td>
                <td class="text-center item-cantidad border-secondary">${item.cantidad}</td>
                <td class="text-center item-unidad border-secondary">${this.getUnidadMedidaText(item.unidad)}</td>
                <td class="text-start item-descripcion border-secondary">${item.descripcion}</td>
                <td class="text-end item-valor border-secondary">${this.formatMoney(item.valorUnitario, moneda)}</td>
                <td class="text-end item-igv border-secondary">${this.formatMoney(igvVal, moneda)}</td>
                <td class="text-end item-importe border-secondary">${this.formatMoney(importeVal, moneda)}</td>
            `;
            container.appendChild(tr);
        });
    }

    /**
     * Generar código QR
     * 
     * @param {HTMLElement} container Elemento donde generar el QR
     * @param {string} rucEmisor RUC del emisor
     * @param {string} rucReceptor RUC del receptor
     * @param {string} serieNumero Serie y número de la factura
     */
    async generateQRCode(container, rucEmisor, rucReceptor, serieNumero) {
        if (!container || !window.QRCode) return;

        // Limpiar contenedor primero
        container.innerHTML = '';

        // Construir datos para el QR (según formato SUNAT)
        const qrData = `${rucEmisor}|${serieNumero}|${rucReceptor}`;

        const qrCanvas = document.createElement('canvas');
        //const qrData = "https://www.heinzsport.com"; // Reemplaza con el enlace que quieras codificar
        await QRCode.toCanvas(qrCanvas, qrData, { errorCorrectionLevel: 'H' });  // Esperar a que se genere el QR
        const qrDataURL = qrCanvas.toDataURL('image/png');//code64
        //container.appendChild(qrDataURL);
        // Crear QR
        //new QRCode(container, {
        // text: qrData,
        //  width: 128,
        //  height: 128,
        //  colorDark: "#000000",
        //   colorLight: "#ffffff",
        //correctLevel: QRCode.CorrectLevel.H
        //});
    }

    generateQRCode_revison(container, rucEmisor, rucReceptor, serieNumero) {
        if (!container || !window.QRCode) return;

        // Limpiar contenedor primero
        container.innerHTML = '';

        // Construir datos para el QR (según formato SUNAT)
        const qrData = `${rucEmisor}|${serieNumero}|${rucReceptor}`;

        // Crear QR
        new QRCode(container, {
            text: qrData,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            //correctLevel: QRCode.CorrectLevel.H
        });
    }

    /**
     * Formatear fecha para visualización
     * 
     * @param {string} dateString Fecha en formato ISO
     * @returns {string} Fecha formateada
     */
    formatDate(dateString) {
        if (!dateString) return '';
        return dateString.slice(8, 10) + "-" + dateString.slice(5, 7) + "-" + dateString.slice(0, 4);
    }

    /**
     * Formatear valor monetario
     * 
     * @param {number|string} value Valor a formatear
     * @param {boolean} codigo_moneda Incluir símbolo ISO de moneda
     * @returns {string} Valor formateado
     */
    formatMoney(numValue, codigo_moneda) {
        if (!codigo_moneda) {
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
        }

        const locale = codigo_moneda === 'PEN' ? 'es-PE' : 'en-US';
        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency: codigo_moneda }).format(numValue);
        } catch (e) {
            return codigo_moneda + ' ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
        }
    }

    /**
     * Obtener texto descriptivo para la moneda
     * 
     * @param {string} monedaCode Código de moneda
     * @returns {string} Texto descriptivo
     */
    getMonedaText(monedaCode) {
        const monedas = {
            'PEN': 'SOLES',
            'USD': 'DÓLARES AMERICANOS',
            'EUR': 'EUROS'
        };

        return monedas[monedaCode] || monedaCode;
    }

    /**
     * Obtener texto descriptivo para unidad de medida
     * 
     * @param {string} unidadCode Código de unidad
     * @returns {string} Texto descriptivo
     */
    getUnidadMedidaText(unidadCode) {
        const unidades = {
            'NIU': 'UNIDAD',
            'ZZ': 'SERVICIO',
            'KGM': 'KILOGRAMO',
            'LTR': 'LITRO',
            'MTR': 'METRO',
            'MTK': 'METRO CUADRADO',
            'MTQ': 'METRO CÚBICO',
            'GLL': 'GALÓN',
            'HUR': 'HORA',
            'DAY': 'DÍA'
        };

        return unidades[unidadCode] || unidadCode;
    }

    /**
     * Mostrar el visualizador
     */
    show() {
        if (window.uiOdoo) {
            window.uiOdoo.openFormView();
        }
    }

    /**
     * Ocultar el visualizador
     */
    hide() {
        if (window.uiOdoo) {
            window.uiOdoo.closeFormView();
        }
        this.currentFacturaId = null;
    }

    /**
     * Mostrar indicador de carga
     */
    showLoading() {
        if (this.titleElement) {
            this.titleElement.textContent = "Cargando factura...";
        }
        this.show();
    }

    /**
     * Mostrar mensaje de error
     * 
     * @param {string} message Mensaje de error
     */
    showError(message) {
        if (this.titleElement) {
            this.titleElement.textContent = "Error: " + message;
        }
        alert("Error: " + message);
    }

    /**
     * Obtener datos de la factura actual
     * 
     * @returns {number|null} ID de la factura actual
     */
    getCurrentFacturaId() {
        return this.currentFacturaId;
    }

    /**
     * Obtener datos de la factura actual
     * 
     * @returns {number|null} ID de la factura actual
     */
    getCurrentFacturaId() {
        return this.currentFacturaId;
    }

    /**
     * Descargar PDF de la factura actual
     */
    async downloadPDF() {
        if (!this.currentFacturaId) {
            console.warn('No hay factura seleccionada para descargar.');
            return;
        }

        try {
            const url = `../../backend/api/facturaDownload.php?id=${encodeURIComponent(this.currentFacturaId)}`;
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `factura_${this.currentFacturaId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Error descargando factura', this.currentFacturaId, err);
            alert('Error al descargar el PDF.');
        }
    }
}