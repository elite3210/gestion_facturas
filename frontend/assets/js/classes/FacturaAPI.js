/**
 * Clase FacturaAPI CRUD del lado frontend
 * 
 * Maneja todas las interacciones con la API del backend
 */
export class FacturaAPI {
    /**
     * Constructor
     * @param {string} baseUrl URL base para las peticiones API
     */
    constructor(baseUrl = 'https://facturas.heinzsport.com/backend/api/apiFactura.php') {
        this.baseUrl = baseUrl;
    }

    /**
     * Obtener listado de facturas
     * 
     * @param {Object} filters Filtros para la búsqueda
     * @param {number} page Número de página
     * @param {number} limit Límite de resultados por página
     * @returns {Promise} Promesa con los resultados
     */
    async getFacturas(filters = {}, page = 1, limit = 20, sort = 'fecha_emision', order = 'DESC') {
        // Construir URL con parámetros de consulta
        let url = new URL(this.baseUrl, window.location.origin);

        // Añadir parámetros de paginación
        url.searchParams.append('page', page);
        url.searchParams.append('limit', limit);
        url.searchParams.append('sort', sort);
        url.searchParams.append('order', order);

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
                throw new Error(data.message || 'Error al obtener facturas');
            }
            console.log('Facturas obtenidas:', data);
            return data;
        } catch (error) {
            console.error('Error en getFacturas:', error);
            throw error;
        }
    }

    /**
     * Obtener datos agrupados para vistas dinámicas (Pivot/Graph)
     * 
     * @param {Object} filters Filtros para la búsqueda
     * @param {Array} groupBy Campos por los que agrupar
     * @param {Array} measures Medidas a calcular
     * @returns {Promise} Promesa con los datos agrupados
     */
    async getPivotData(filters = {}, groupBy = [], measures = []) {
        let url = new URL(this.baseUrl, window.location.origin);
        
        url.searchParams.append('action', 'get_pivot_data');
        url.searchParams.append('groupBy', groupBy.join(','));
        url.searchParams.append('measures', measures.join(','));

        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                url.searchParams.append(key, filters[key]);
            }
        });

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al obtener datos pivot');
            }
            return data;
        } catch (error) {
            console.error('Error en getPivotData:', error);
            throw error;
        }
    }

    /**
     * Obtener detalle de una factura
     * 
     * @param {number} id ID de la factura
     * @returns {Promise} Promesa con los detalles de la factura
     */
    async getFacturaById(id) {
        let url = new URL(this.baseUrl, window.location.origin);
        url.searchParams.append('id', Number(id));

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al obtener factura');
            }

            return data;
        } catch (error) {
            console.error('Error en getFacturaById:', error);
            throw error;
        }
    }

    /**
     * Subir archivo XML de factura
     * 
     * @param {FormData} formData Datos del formulario con el archivo XML
     * @returns {Promise} Promesa con el resultado de la operación
     */
    async uploadFactura(formData) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al subir factura');
            }

            return data;
        } catch (error) {
            console.error('Error en uploadFactura:', error);
            throw error;
        }
    }

    /**
     * Actualiza el estado de una factura
     * @param {number|string} id - ID de la factura
     * @param {string} state - Nuevo estado ('draft', 'posted', 'cancel')
     * @returns {Promise<Object>} Resultado de la operación
     */
    async updateState(id, state) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, state })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al actualizar el estado de la factura');
            }

            return data;
        } catch (error) {
            console.error('Error en updateState:', error);
            throw error;
        }
    }

    /**
     * Llama al procedimiento almacenado para regularizar facturas huérfanas
     * @returns {Promise<Object>} Resultado de la operación
     */
    async regularizarFacturas() {
        let url = new URL(this.baseUrl, window.location.origin);
        url.searchParams.append('action', 'regularizar_facturas');

        try {
            const response = await fetch(url, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al regularizar facturas');
            }

            return data;
        } catch (error) {
            console.error('Error en regularizarFacturas:', error);
            throw error;
        }
    }
}