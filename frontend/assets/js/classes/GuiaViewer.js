/**
 * Clase GuiaViewer
 * 
 * Maneja la visualización detallada de una guía de remisión electrónica
 */
export class GuiaViewer {
    /**
     * Constructor
     * 
     * @param {GuiaAPI} api Instancia de GuiaAPI
     * @param {string} sectionId ID de la sección completa
     * @param {string} viewerContainerId ID del contenedor del visualizador
     * @param {string} titleId ID del elemento título
     */
    //constructor(api, sectionId = 'guia-viewer-section', viewerContainerId = 'guia-viewer', titleId = 'guia-title') {
    constructor(api, sectionId = 'factura-viewer-section', viewerContainerId = 'factura-viewer', titleId = 'factura-title') {
        this.api = api;
        this.section = document.getElementById(sectionId);
        this.viewerContainer = document.getElementById(viewerContainerId);
        this.titleElement = document.getElementById(titleId);
        this.closeButton = document.getElementById('close-viewer-btn');
        this.currentGuiaId = null;
        this.guiaTemplate = document.getElementById('guia-template');
        this.itemTemplate = document.getElementById('item-template');

        // Mapeos de códigos
        this.motivosTraslado = {
            '01': 'Venta',
            '02': 'Compra',
            '04': 'Traslado entre establecimientos de la misma empresa',
            '05': 'Consignación',
            '08': 'Importación',
            '09': 'Exportación',
            '13': 'Otros',
            '14': 'Venta sujeta a confirmación del comprador',
            '18': 'Traslado emisor itinerante CP',
            '19': 'Traslado a zona primaria'
        };

        this.modalidadesTraslado = {
            '01': 'Transporte público',
            '02': 'Transporte privado'
        };

        this.unidadesMedida = {
            'NIU': 'UNIDAD',
            'ZZ': 'UNIDAD',
            'C62': 'PIEZAS',
            'PK': 'PAQUETE',
            'MLL': 'MILLARES',
            'KGM': 'KILOS',
            'BE': 'FARDO',
            'BX': 'CAJAS',
            'BG': 'BOLSA',
            '4A': 'BOBINAS'
        };

        // Configurar evento de cierre
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        }
    }

    /**
     * Inicializar el visualizador
     */
    init() {
        // No es necesario hacer nada aquí
    }

    /**
     * Cargar y mostrar una guía
     * 
     * @param {number} id ID de la guía a mostrar
     */
    async loadGuia(id) {
        if (!this.viewerContainer || !this.section) return;

        try {
            this.currentGuiaId = id;
            this.showLoading();

            const result = await this.api.getGuiaById(id);

            if (!result.success) {
                throw new Error(result.message || 'Error al cargar la guía de remisión');
            }
            
            this.renderGuia(result.data);
            this.show();
        } catch (error) {
            this.showError(error.message);
            console.log('Error en GuiaViewer:', error);
        }
    }

    /**
     * Renderizar guía en pantalla
     * 
     * @param {Object} data Datos de la guía
     */
    renderGuia(data) {
        console.log('Datos de la guía:', data);
        if (!this.viewerContainer || !this.guiaTemplate) return;
        this.viewerContainer.innerHTML = '';

        // Limpiar contenedor
        
        // Verificar si tenemos los values necesarios
        if (!data.values) {
            this.showError('La guía no contiene los values necesarios');
            return;
        }

        // Establecer título
        if (this.titleElement) {
            this.titleElement.textContent = data.values.guia.numero_guia;
        }

        // Clonar la plantilla
        const guiaElement = this.guiaTemplate.content.cloneNode(true);

        // Rellenar datos del emisor
        guiaElement.querySelector('.empresa-nombre').textContent = data.values.emisor.nombre_emisor || 'N/D';
        guiaElement.querySelector('.direccion-emisor').textContent = data.values.emisor.direccion_emisor || 'N/D';
        guiaElement.querySelector('.ruc-emisor').textContent = data.values.emisor.ruc_emisor || 'N/D';

        // Rellenar datos de la guía
        guiaElement.querySelector('.serie-numero').textContent = data.values.guia.numero_guia;
        guiaElement.querySelector('.fecha-emision').textContent = this.formatDate(data.values.guia.fecha_emision);
        guiaElement.querySelector('.fecha-traslado').textContent = this.formatDate(data.values.guia.fecha_traslado) || 'N/D';
        
        // Motivo y modalidad de traslado
        const motivoTexto = this.motivosTraslado[data.values.guia.motivo_traslado] || data.values.guia.motivo_traslado || 'N/D';
        const modalidadTexto = this.modalidadesTraslado[data.values.guia.modalidad_traslado] || data.values.guia.modalidad_traslado || 'N/D';
        
        guiaElement.querySelector('.motivo-traslado').textContent = motivoTexto;
        guiaElement.querySelector('.modalidad-traslado').textContent = modalidadTexto;

        // Datos del destinatario
        guiaElement.querySelector('.destinatario-nombre').textContent = data.values.destinatario.nombre_receptor || 'N/D';
        guiaElement.querySelector('.destinatario-ruc').textContent = data.values.destinatario.ruc_receptor || 'N/D';
        guiaElement.querySelector('.destinatario-direccion').textContent = data.values.destinatario.direccion_receptor || 'N/D';

        // Datos del traslado
        guiaElement.querySelector('.punto-partida').textContent = data.values.guia.punto_partida;
        guiaElement.querySelector('.punto-llegada').textContent = data.values.guia.punto_llegada;
        guiaElement.querySelector('.peso-total').textContent = `${data.values.guia.peso_total} ${data.values.guia.unidad_medida_peso || 'KG'}`;
        guiaElement.querySelector('.factura-referencia').textContent = data.values.guia.numero_factura || 'N/D';

        // Datos del transportista (si existen)
        const transportistaSection = guiaElement.querySelector('.transportista-section');
        if (data.values.transportista && data.values.transportista.ruc_transporte) {
            guiaElement.querySelector('.transportista-nombre').textContent = data.values.transportista.nombre_transporte || 'N/D';
            guiaElement.querySelector('.transportista-ruc').textContent = data.values.transportista.ruc_transporte || 'N/D';
            guiaElement.querySelector('.transportista-licencia').textContent = data.values.transportista.licencia || 'N/D';
            guiaElement.querySelector('.vehiculo-placa').textContent = data.values.transportista.placa || 'N/D';
        } else {
            // Ocultar sección si no hay datos del transportista
            transportistaSection.style.display = 'none';
        }

        // Rellenar values/items
        const itemsContainer = guiaElement.querySelector('.items-container');
        if (itemsContainer && data.values.detalles) {
            this.renderItems(itemsContainer, data.values.detalles);
        }

        // Generar QR code
        const qrCodeElement = guiaElement.querySelector('#qrcode');
        if (qrCodeElement) {
            setTimeout(() => {
                this.generateQRCode(qrCodeElement, data.values.emisor.ruc_emisor, data.values.destinatario.ruc_receptor, data.values.guia.numero_guia);
            }, 100);
        }

        // Agregar al contenedor
        this.viewerContainer.appendChild(guiaElement);
    }

    /**
     * Renderizar items de la guía
     * 
     * @param {HTMLElement} container Contenedor donde insertar los items
     * @param {Array} items Lista de items a mostrar
     */
    renderItems(container, items) {
        if (!container || !this.itemTemplate || !items || !items.length) return;

        // Limpiar contenedor
        container.innerHTML = '';

        items.forEach(item => {
            const itemElement = this.itemTemplate.content.cloneNode(true);

            itemElement.querySelector('.item-numero').textContent = item.itemId;
            itemElement.querySelector('.item-cantidad').textContent = item.cantidad;
            itemElement.querySelector('.item-unidad').textContent = this.getUnidadMedidaText(item.unidad);
            itemElement.querySelector('.item-descripcion').textContent = item.descripcion;

            container.appendChild(itemElement);
        });
    }

    /**
     * Generar código QR
     * 
     * @param {HTMLElement} container Elemento donde generar el QR
     * @param {string} rucEmisor RUC del emisor
     * @param {string} rucDestinatario RUC del destinatario
     * @param {string} serieNumero Serie y número de la guía
     */
    async generateQRCode(container, rucEmisor, rucDestinatario, serieNumero) {
        if (!container || !window.QRCode) return;

        // Limpiar contenedor primero
        container.innerHTML = '';

        // Construir datos para el QR (según formato SUNAT para guías)
        const qrData = `${rucEmisor}|09|${serieNumero}|${rucDestinatario}`;

        try {
            const qrCanvas = document.createElement('canvas');
            await QRCode.toCanvas(qrCanvas, qrData, { 
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 120
            });
            
            container.appendChild(qrCanvas);
        } catch (error) {
            console.error('Error generando QR:', error);
            container.innerHTML = '<p class="text-muted">Error generando código QR</p>';
        }
    }

    /**
     * Formatear fecha para visualización
     * 
     * @param {string} dateString Fecha en formato ISO
     * @returns {string} Fecha formateada
     */
    formatDate(dateString) {
        if (!dateString) return '';
        return  dateString.slice(8, 10) + "-" + dateString.slice(5, 7) + "-" + dateString.slice(0, 4);
    }

    /**
     * Obtener texto descriptivo para unidad de medida
     * 
     * @param {string} unidadCode Código de unidad
     * @returns {string} Texto descriptivo
     */
    getUnidadMedidaText(unidadCode) {
        return this.unidadesMedida[unidadCode] || unidadCode || 'UNIDAD';
    }

    /**
     * Mostrar el visualizador
     */
    show() {
        if (this.section) {
            this.section.classList.remove('d-none');
            // Desplazar a la sección
            this.section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Ocultar el visualizador
     */
    hide() {
        if (this.section) {
            this.section.classList.add('d-none');
        }
        this.currentGuiaId = null;
    }

    /**
     * Mostrar indicador de carga
     */
    showLoading() {
        if (!this.viewerContainer) return;

        this.viewerContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="loader"></div>
                <p class="mt-3">Cargando guía de remisión...</p>
            </div>
        `;

        this.show();
    }

    /**
     * Mostrar mensaje de error
     * 
     * @param {string} message Mensaje de error
     */
    showError(message) {
        if (!this.viewerContainer) return;

        this.viewerContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">Error</h4>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Obtener datos de la guía actual
     * 
     * @returns {number|null} ID de la guía actual
     */
    getCurrentGuiaId() {
        return this.currentGuiaId;
    }
}