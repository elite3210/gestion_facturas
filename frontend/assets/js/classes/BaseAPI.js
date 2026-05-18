/**
 * BaseAPI - Clase base compartida para APIs de facturas y guías
 * 
 * Contiene funcionalidad común para comunicación con el backend
 */
export class BaseAPI {
    /**
     * Constructor
     * @param {string} baseUrl URL base para las peticiones API
     */
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.timeout = 30000; // 30 segundos
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    /**
     * Realizar petición HTTP genérica
     * 
     * @param {string} method Método HTTP (GET, POST, etc.)
     * @param {string} endpoint Endpoint específico
     * @param {Object} options Opciones adicionales
     * @returns {Promise} Promesa con la respuesta
     */
    async request(method, endpoint = '', options = {}) {
        const url = new URL(endpoint, this.baseUrl);
        
        // Configurar opciones por defecto
        const requestOptions = {
            method: method.toUpperCase(),
            headers: { ...this.defaultHeaders, ...options.headers },
            signal: AbortSignal.timeout(this.timeout),
            ...options
        };

        // Agregar parámetros de consulta si existen
        if (options.params) {
            Object.keys(options.params).forEach(key => {
                if (options.params[key] !== null && options.params[key] !== undefined) {
                    url.searchParams.append(key, options.params[key]);
                }
            });
        }

        // Agregar body para métodos que lo requieren
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && options.data) {
            if (options.data instanceof FormData) {
                // Para FormData, eliminar Content-Type para que el navegador lo establezca automáticamente
                delete requestOptions.headers['Content-Type'];
                requestOptions.body = options.data;
            } else {
                requestOptions.body = JSON.stringify(options.data);
            }
        }

        try {
            const response = await fetch(url.toString(), requestOptions);
            
            // Verificar si la respuesta es exitosa
            if (!response.ok) {
                throw new APIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    await this.parseResponse(response)
                );
            }

            return await this.parseResponse(response);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new APIError('Request timeout', 408);
            }
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Network error: ' + error.message, 0);
        }
    }

    /**
     * Parsear respuesta del servidor
     * 
     * @param {Response} response Respuesta del fetch
     * @returns {Object} Datos parseados
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    /**
     * Petición GET
     * 
     * @param {string} endpoint Endpoint
     * @param {Object} params Parámetros de consulta
     * @returns {Promise} Promesa con los datos
     */
    async get(endpoint = '', params = {}) {
        return this.request('GET', endpoint, { params });
    }

    /**
     * Petición POST
     * 
     * @param {string} endpoint Endpoint
     * @param {Object|FormData} data Datos a enviar
     * @returns {Promise} Promesa con los datos
     */
    async post(endpoint = '', data = null) {
        return this.request('POST', endpoint, { data });
    }

    /**
     * Petición PUT
     * 
     * @param {string} endpoint Endpoint
     * @param {Object} data Datos a enviar
     * @returns {Promise} Promesa con los datos
     */
    async put(endpoint = '', data = null) {
        return this.request('PUT', endpoint, { data });
    }

    /**
     * Petición DELETE
     * 
     * @param {string} endpoint Endpoint
     * @returns {Promise} Promesa con los datos
     */
    async delete(endpoint = '') {
        return this.request('DELETE', endpoint);
    }

    /**
     * Subir archivo
     * 
     * @param {string} endpoint Endpoint
     * @param {File} file Archivo a subir
     * @param {string} fieldName Nombre del campo
     * @returns {Promise} Promesa con el resultado
     */
    async uploadFile(endpoint = '', file, fieldName = 'file') {
        const formData = new FormData();
        formData.append(fieldName, file);
        
        return this.post(endpoint, formData);
    }

    /**
     * Descargar archivo
     * 
     * @param {string} endpoint Endpoint
     * @param {string} filename Nombre del archivo
     */
    downloadFile(endpoint, filename = null) {
        const url = new URL(endpoint, this.baseUrl);
        const link = document.createElement('a');
        link.href = url.toString();
        link.download = filename || '';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Establecer timeout personalizado
     * 
     * @param {number} timeout Timeout en milisegundos
     */
    setTimeout(timeout) {
        this.timeout = timeout;
    }

    /**
     * Establecer headers personalizados
     * 
     * @param {Object} headers Headers adicionales
     */
    setHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    /**
     * Obtener información de la API
     * 
     * @returns {Object} Información de la API
     */
    getInfo() {
        return {
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            headers: this.defaultHeaders
        };
    }
}

/**
 * Clase personalizada para errores de API
 */
export class APIError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Utilidades comunes para APIs
 */
export class APIUtils {
    /**
     * Validar formato de RUC peruano
     * 
     * @param {string} ruc RUC a validar
     * @returns {boolean} true si es válido
     */
    static validarRUC(ruc) {
        if (!ruc || ruc.length !== 11) return false;
        if (!['10', '20'].includes(ruc.substring(0, 2))) return false;
        return /^\d+$/.test(ruc);
    }

    /**
     * Formatear fecha para visualización
     * 
     * @param {string|Date} date Fecha a formatear
     * @returns {string} Fecha formateada
     */
    static formatDate(date) {
        if (!date) return '';
        
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Formatear valor monetario
     * 
     * @param {number|string} value Valor a formatear
     * @param {boolean} includeSymbol Incluir símbolo de moneda
     * @returns {string} Valor formateado
     */
    static formatMoney(value, includeSymbol = true) {
        if (value === undefined || value === null) return '';
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '';
        
        const prefix = includeSymbol ? 'S/ ' : '';
        
        return prefix + new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numValue);
    }

    /**
     * Debounce para eventos
     * 
     * @param {Function} func Función a ejecutar
     * @param {number} wait Tiempo de espera en ms
     * @returns {Function} Función con debounce
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Generar ID único
     * 
     * @returns {string} ID único
     */
    static generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
}