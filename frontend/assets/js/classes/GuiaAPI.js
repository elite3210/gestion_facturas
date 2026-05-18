/**
 * Clase GuiaAPI
 * 
 * Maneja todas las interacciones con la API del backend para guías de remisión
 */
export class GuiaAPI {
    /**
     * Constructor
     * @param {string} baseUrl URL base para las peticiones API
     */
    constructor(baseUrl = 'https://facturas.heinzsport.com/backend/api/apiGuia.php') {
        this.baseUrl = baseUrl;
    }

    /**
     * Obtener listado de guías de remisión
     * 
     * @param {Object} filters Filtros para la búsqueda
     * @param {number} page Número de página
     * @param {number} limit Límite de resultados por página
     * @returns {Promise} Promesa con los resultados
     */
    async getGuias(filters = {}, page = 1, limit = 20) {
        // Construir URL con parámetros de consulta
        let url = new URL(this.baseUrl, window.location.origin);

        // Añadir parámetros de paginación
        url.searchParams.append('page', page);
        url.searchParams.append('limit', limit);

        // Añadir filtros si existen
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                url.searchParams.append(key, filters[key]);
            }
        });

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al obtener guías de remisión');
            }
            console.log('Guías obtenidas:', data);
            return data;
        } catch (error) {
            console.error('Error en getGuias:', error);
            throw error;
        }
    }

    /**
     * Obtener detalle de una guía de remisión
     * 
     * @param {number} id ID de la guía
     * @returns {Promise} Promesa con los detalles de la guía
     */
    async getGuiaById(id) {
        let url = new URL(this.baseUrl, window.location.origin);
        url.searchParams.append('id', id);

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al obtener guía de remisión');
            }

            return data;
        } catch (error) {
            console.error('Error en getGuiaById:', error);
            throw error;
        }
    }

    /**
     * Subir archivo XML de guía de remisión
     * 
     * @param {FormData} formData Datos del formulario con el archivo XML
     * @returns {Promise} Promesa con el resultado de la operación
     */
    async uploadGuia(formData) {
        try {
            const response = await fetch(this.baseUrl, { method: 'POST', body: formData });
            console.log('lo que se envia:', formData);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al subir guía de remisión');
            }

            return data;
        } catch (error) {
            console.error('Error en uploadGuia:', error);
            throw error;
        }
    }

    /**
     * Obtener URL para descarga de PDF
     * 
     * @param {number} id ID de la guía
     * @returns {string} URL para descarga
     */
    getPdfDownloadUrl(id) {
        return `../../backend/api/guiaDownload.php?id=${id}`;
    }
}