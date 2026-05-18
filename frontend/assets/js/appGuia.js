/**
 * Script principal de la aplicación
 * 
 * Inicializa y coordina todos los componentes
 */
//import { FacturaAPI } from "./classes/FacturaAPI_v2.js";
//import { FacturaViewer } from "./classes/FacturaViewer_v2.js";
//import { FacturaList } from "./classes/FacturaList_v2.js"; // Clase refactorizada
//aplicar herencia desde factura para guias

import {GuiaAPI} from "./classes/GuiaAPI.js";
import {GuiaViewer} from "./classes/GuiaViewer.js";
import {FacturaList} from "./classes/GuiaList.js";


document.addEventListener('DOMContentLoaded', function () {
    // Inicializar API
    const api = new GuiaAPI();

    // Inicializar el visor de facturas
    const facturaViewer = new GuiaViewer(api);
    facturaViewer.init();

    // Inicializar la lista de facturas con callback para selección
    const facturaList = new FacturaList(
        api,
        'factura-table-container',
        'factura-header-tools',
        'pagination',
        'pagination-info',
        (facturaId) => {facturaViewer.loadGuia(facturaId); }
    );
    facturaList.init();
    window.facturaList = facturaList; // Hacer disponible globalmente

    // Configurar formulario de carga
    setupUploadForm(api, facturaList);
});

/**
 * Configurar formulario de carga de facturas
 * 
 * @param {FacturaAPI} api Instancia de FacturaAPI
 * @param {FacturaList} facturaList Instancia de FacturaList
 */
function setupUploadForm(api, facturaList) {
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');

    if (!uploadForm || !uploadStatus) return;

    uploadForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Validar archivo seleccionado
        const fileInput = document.getElementById('xml-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            showUploadStatus('error', 'Debe seleccionar un archivo XML');
            return;
        }

        const file = fileInput.files[0];

        // Validar tipo de archivo
        if (!file.name.toLowerCase().endsWith('.xml')) {
            showUploadStatus('error', 'El archivo debe ser un XML válido');
            return;
        }

        try {
            // Mostrar estado de carga
            showUploadStatus('loading', 'Procesando factura...');

            // Preparar datos del formulario
            const formData = new FormData();
            formData.append('xml_file', file);

            // Enviar a la API
            const result = await api.uploadGuia(formData);

            // Mostrar resultado exitoso
            showUploadStatus('success', `Factura/Guia ${result.data.id} cargada correctamente`);

            // Limpiar formulario
            uploadForm.reset();

            // Recargar lista de facturas
            facturaList.loadFacturas();

        } catch (error) {
            showUploadStatus('error', `Error al procesar la factura: ${error.message}`);
        }
    });

    /**
     * Mostrar estado de la carga
     * 
     * @param {string} type Tipo de mensaje ('success', 'error', 'loading')
     * @param {string} message Mensaje a mostrar
     */
    function showUploadStatus(type, message) {
        if (!uploadStatus) return;

        let className = 'status-message ';
        let icon = '';

        switch (type) {
            case 'success':
                className += 'status-success';
                icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill me-2" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
                break;
            case 'error':
                className += 'status-error';
                icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle-fill me-2" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>';
                break;
            case 'loading':
                className += 'status-loading';
                icon = '<div class="loader me-2"></div>';
                break;
        }

        uploadStatus.className = className;
        uploadStatus.innerHTML = `${icon} ${message}`;

        // Si es exitoso, establecer un temporizador para ocultar el mensaje
        if (type === 'success') {
            setTimeout(() => {
                uploadStatus.style.opacity = '0';

                // Después de la transición, limpiar el contenido
                setTimeout(() => {
                    uploadStatus.innerHTML = '';
                    uploadStatus.style.opacity = '1';
                    uploadStatus.className = '';
                }, 500);
            }, 3000);
        }
    }
}