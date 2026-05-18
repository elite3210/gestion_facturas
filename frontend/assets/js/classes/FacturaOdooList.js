/**
 * FacturaOdooList.js
 * 
 * Renderiza el listado de facturas utilizando el diseño de Odoo 18.
 * Reemplaza a FacturaList.js en la vista factura.html.
 */

export class FacturaOdooList {
    constructor(api, tableContainerId, headerToolsId, paginationId, paginationInfoId, onFacturaSelected) {
        this.api = api;
        this.onFacturaSelected = onFacturaSelected;
        
        // Estado
        this.currentData = [];
        this.selectedRows = new Set();
        this.currentPage = 1;
        this.limit = 15;
        this.activeFacets  = [];           // ← facetas activas
        this.currentFilters = { move_type: 'out_invoice' };
        this.currentSort = 'fecha_emision';
        this.currentOrder = 'desc';
        
        // Referencias DOM
        this.tbody = document.getElementById('tbody');
        this.pagerVal = document.getElementById('pager-val');
        this.totalFooter = document.getElementById('total-footer');
        this.subtotalFooter = document.getElementById('subtotal-footer');
        this.igvFooter = document.getElementById('igv-footer');
        this.chkAll = document.getElementById('chk-all');
        
        // Exponer función global para que funcione el onclick de descargar PDF del gear menu
        window.downloadSelectedPdf = () => this.downloadSelectedPdf();
    }

    init() {
        this.setupEvents();
        this.initOptColPanel();
        this.initSearchPanel();   // ← nuevo
        this.loadFacturas();
    }

    /**
     * Panel de columnas opcionales estilo Odoo.
     * Lee/escribe el estado en localStorage para recordar preferencias del usuario.
     */
    initOptColPanel() {
        const btn   = document.getElementById('opt-col-btn');
        const panel = document.getElementById('opt-col-panel');
        if (!btn || !panel) return;

        // Restaurar estado guardado
        const stored = JSON.parse(localStorage.getItem('facturas_hidden_cols') || '[]');
        stored.forEach(col => this._setColVisible(col, false));
        panel.querySelectorAll('input[data-col]').forEach(chk => {
            if (stored.includes(chk.dataset.col)) chk.checked = false;
        });

        // Abrir / cerrar panel
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });

        // Cambio de checkbox → mostrar/ocultar columna y guardar
        panel.addEventListener('change', (e) => {
            const chk = e.target;
            if (!chk.dataset.col) return;
            this._setColVisible(chk.dataset.col, chk.checked);
            // Persistir en localStorage
            const hidden = [...panel.querySelectorAll('input[data-col]')]
                .filter(c => !c.checked)
                .map(c => c.dataset.col);
            localStorage.setItem('facturas_hidden_cols', JSON.stringify(hidden));
        });

        // Cerrar panel al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && e.target !== btn) {
                panel.style.display = 'none';
                btn.classList.remove('active');
            }
        });
    }

    /** Muestra u oculta todas las celdas (th, td) con data-col === colId */
    _setColVisible(colId, visible) {
        const table = document.getElementById('main-table');
        if (!table) return;
        table.querySelectorAll(`[data-col="${colId}"]`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    }

    /** 
     * Aplica el estado de visibilidad de columnas guardado en localStorage 
     * a todas las celdas (th, td) de la tabla.
     */
    applyColVisibility() {
        const stored = JSON.parse(localStorage.getItem('facturas_hidden_cols') || '[]');
        const table = document.getElementById('main-table');
        if (!table) return;

        // Reset: Mostrar todo lo que tenga data-col
        table.querySelectorAll('[data-col]').forEach(el => el.style.display = '');

        // Ocultar lo que esté en localStorage
        stored.forEach(colId => {
            table.querySelectorAll(`[data-col="${colId}"]`).forEach(el => {
                el.style.display = 'none';
            });
        });
    }

    // ════════════════════════════════════════════════════════
    //  MOTOR DE BÚSQUEDA ESTILO ODOO
    // ════════════════════════════════════════════════════════

    /**
     * Inicializa el panel de búsqueda: toggle ▼, filtros predefinidos y favoritos.
     */
    initSearchPanel() {
        const panel      = document.getElementById('search-panel');
        const toggleBtn  = document.getElementById('search-dropdown-btn');
        const searchInput = document.getElementById('search-input');
        if (!panel || !toggleBtn) return;

        // ── Toggle ▼ ──────────────────────────────────────
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            toggleBtn.classList.toggle('active', !open);
            if (!open) {
                this.loadFavorites();
                // Focus primer filtro para accesibilidad
                panel.querySelector('.o-sp-filter-item')?.focus();
            }
        });

        // ── Cerrar al clic fuera ────────────────────────
        document.addEventListener('click', (e) => {
            const row = document.querySelector('.o-cp-search-row');
            if (row && !row.contains(e.target)) {
                panel.style.display = 'none';
                toggleBtn.classList.remove('active');
            }
        });

        // ── Cerrar con Escape ───────────────────────────
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                panel.style.display = 'none';
                toggleBtn.classList.remove('active');
            }
        });

        // ── Filtros predefinidos (toggle) ───────────────
        panel.querySelectorAll('.o-sp-filter-item[data-facet-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.facetId;
                const exists = this.activeFacets.find(f => f.id === id);
                if (exists) {
                    this.removeFacet(id);
                } else {
                    this.addFacet({
                        id:    btn.dataset.facetId,
                        label: btn.dataset.facetLabel,
                        field: btn.dataset.facetField,
                        value: btn.dataset.facetValue,
                        icon:  btn.dataset.facetIcon || 'filter',
                    });
                }
                // Marcar el botón del filtro como activo/inactivo
                btn.classList.toggle('active', !!this.activeFacets.find(f => f.id === id));
            });
        });

        // ── Búsqueda libre con Enter → faceta ──────────
        if (searchInput) {
            // Sobreescribir el listener anterior (en setupEvents se añade otro;
            // aquí manejamos el comportamiento de faceta al presionar Enter)
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = searchInput.value.trim();
                    if (!val) return;
                    // Quitar faceta de texto anterior si existe
                    this.removeFacet('__text__', false);
                    this.addFacet({ id: '__text__', label: val, field: 'search', value: val, icon: 'magnifying-glass' });
                    searchInput.value = '';
                    panel.style.display = 'none';
                    toggleBtn.classList.remove('active');
                }
            });
        }

        // ── Favoritos: guardar ──────────────────────────
        const btnSave   = document.getElementById('btn-save-favorite');
        const saveForm  = document.getElementById('save-favorite-form');
        const nameInput = document.getElementById('favorite-name-input');
        const btnConfirm = document.getElementById('btn-confirm-save');
        const btnCancel  = document.getElementById('btn-cancel-save');

        if (btnSave) {
            btnSave.addEventListener('click', (e) => {
                e.stopPropagation();
                saveForm.style.display = saveForm.style.display === 'none' ? 'block' : 'none';
                if (saveForm.style.display === 'block') nameInput?.focus();
            });
        }
        if (btnConfirm) {
            btnConfirm.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = nameInput?.value?.trim();
                if (!name) { nameInput?.focus(); return; }
                this.saveFavorite(name);
                saveForm.style.display = 'none';
                if (nameInput) nameInput.value = '';
            });
        }
        if (btnCancel) {
            btnCancel.addEventListener('click', (e) => {
                e.stopPropagation();
                saveForm.style.display = 'none';
                if (nameInput) nameInput.value = '';
            });
        }

        // Cargar favoritos al inicializar
        this.loadFavorites();
    }

    /** Agrega una faceta al estado activo y recarga la tabla */
    addFacet(facet, reload = true) {
        // Evitar duplicados
        if (this.activeFacets.find(f => f.id === facet.id)) return;
        this.activeFacets.push(facet);
        this.renderFacets();
        this._syncFilterBtns();
        if (reload) {
            this.currentPage = 1;
            this.buildFiltersFromFacets();
            this.loadFacturas();
        }
    }

    /** Elimina una faceta por id */
    removeFacet(id, reload = true) {
        this.activeFacets = this.activeFacets.filter(f => f.id !== id);
        this.renderFacets();
        this._syncFilterBtns();
        if (reload) {
            this.currentPage = 1;
            this.buildFiltersFromFacets();
            this.loadFacturas();
        }
    }

    /** Dibuja los pills de facetas en #facets-container */
    renderFacets() {
        const container = document.getElementById('facets-container');
        if (!container) return;
        container.innerHTML = this.activeFacets.map(f => `
            <div class="o-facet" data-facet-id="${f.id}">
                <span class="o-facet-label">
                    <i class="fa-solid fa-${f.icon}" style="font-size:0.6rem;"></i>
                </span>
                <span class="o-facet-value">${this._escHtml(f.label)}</span>
                <button class="o-facet-remove" data-remove-id="${f.id}" title="Eliminar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`).join('');

        // Bind de botones ×
        container.querySelectorAll('.o-facet-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFacet(btn.dataset.removeId);
            });
        });

        // Mostrar u ocultar placeholder del input
        const input = document.getElementById('search-input');
        if (input) {
            input.placeholder = this.activeFacets.length ? '' : 'Buscar…';
        }
    }

    /**
     * Convierte las facetas activas en currentFilters para la API.
     * Siempre mantiene move_type según el módulo.
     */
    buildFiltersFromFacets() {
        const today = new Date();
        const pad   = n => String(n).padStart(2, '0');
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
        const firstDay  = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;

        // Preservar siempre move_type base
        const base = { move_type: this.currentFilters.move_type || 'out_invoice' };

        this.activeFacets.forEach(f => {
            switch (f.field) {
                case 'state':           base.state          = f.value; break;
                case 'payment_status':  base.payment_status = f.value; break;
                case 'search':          base.search         = f.value; break;
                case 'fecha_hoy':
                    base.fecha_desde = todayStr;
                    base.fecha_hasta = todayStr;
                    break;
                case 'fecha_mes':
                    base.fecha_desde = firstDay;
                    base.fecha_hasta = todayStr;
                    break;
                case 'fecha_mes_pasado':
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    const lm = d.getMonth() + 1;
                    const ly = d.getFullYear();
                    base.fecha_desde = `${ly}-${pad(lm)}-01`;
                    base.fecha_hasta = `${ly}-${pad(lm)}-${new Date(ly, lm, 0).getDate()}`;
                    break;
                case 'fecha_anio':
                    const ty = today.getFullYear();
                    base.fecha_desde = `${ty}-01-01`;
                    base.fecha_hasta = `${ty}-12-31`;
                    break;
            }
        });

        this.currentFilters = base;
    }

    /** Sincroniza los botones del panel con las facetas activas */
    _syncFilterBtns() {
        const panel = document.getElementById('search-panel');
        if (!panel) return;
        panel.querySelectorAll('.o-sp-filter-item[data-facet-id]').forEach(btn => {
            const active = !!this.activeFacets.find(f => f.id === btn.dataset.facetId);
            btn.classList.toggle('active', active);
        });
    }

    /** Escapa HTML para evitar XSS en facetas de texto libre */
    _escHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Favoritos ───────────────────────────────────────────

    /** Guarda la búsqueda actual como favorito en localStorage */
    saveFavorite(name) {
        const favorites = this._getFavorites();
        // Evitar nombre duplicado
        if (favorites.find(f => f.name === name)) {
            alert(`Ya existe un favorito con el nombre "${name}"`);
            return;
        }
        favorites.push({ name, facets: [...this.activeFacets] });
        localStorage.setItem('facturas_favorites', JSON.stringify(favorites));
        this.loadFavorites();
    }

    /** Carga y renderiza la lista de favoritos en #favorites-list */
    loadFavorites() {
        const container = document.getElementById('favorites-list');
        if (!container) return;
        const favorites = this._getFavorites();

        if (favorites.length === 0) {
            container.innerHTML = '<div style="padding:4px 10px;font-size:0.78rem;color:var(--o-text-muted);">Sin favoritos guardados</div>';
            return;
        }

        container.innerHTML = favorites.map((fav, idx) => `
            <div class="o-sp-favorite-item">
                <button class="o-sp-filter-item o-sp-fav-apply" data-fav-idx="${idx}"
                    style="flex:1;text-align:left;">
                    <i class="fa-solid fa-star" style="font-size:0.7rem;color:#f59e0b;margin-right:4px;"></i>
                    ${this._escHtml(fav.name)}
                </button>
                <button class="o-sp-fav-delete" data-fav-idx="${idx}" title="Eliminar favorito">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`).join('');

        // Aplicar favorito al hacer clic
        container.querySelectorAll('.o-sp-fav-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fav = favorites[parseInt(btn.dataset.favIdx)];
                if (!fav) return;
                // Limpiar facetas actuales y aplicar las del favorito
                this.activeFacets = [];
                fav.facets.forEach(f => this.addFacet(f, false));
                this.currentPage = 1;
                this.buildFiltersFromFacets();
                this.loadFacturas();
                const panel = document.getElementById('search-panel');
                if (panel) panel.style.display = 'none';
            });
        });

        // Eliminar favorito
        container.querySelectorAll('.o-sp-fav-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const favs = this._getFavorites();
                favs.splice(parseInt(btn.dataset.favIdx), 1);
                localStorage.setItem('facturas_favorites', JSON.stringify(favs));
                this.loadFavorites();
            });
        });
    }

    _getFavorites() {
        try {
            return JSON.parse(localStorage.getItem('facturas_favorites') || '[]');
        } catch { return []; }
    }


    setupEvents() {
        // Event delegation para la tabla
        document.addEventListener('click', (e) => {

            if (!this.tbody) this.tbody = document.getElementById('tbody');
            if (!this.tbody || !this.tbody.contains(e.target)) return;

            // Checkbox clic
            const chkCell = e.target.closest('[data-action="chk"]');
            if (chkCell) {
                e.stopPropagation();
                this.toggleRow(chkCell.dataset.id, chkCell);
                return;
            }

            // Click en la fila -> abrir factura
            const row = e.target.closest('tr[data-id]');
            if (row) {
                const id = row.dataset.id;
                // Marcar como vista activa
                if (window.uiOdoo) window.uiOdoo.openFormView();
                if (this.onFacturaSelected) {
                    this.onFacturaSelected(id);
                }
            }
        });

        // Checkbox "Seleccionar todo"
        if (this.chkAll) {
            this.chkAll.addEventListener('click', (e) => {
                this.toggleAll(e.target);
            });
        }
        
        // Búsqueda
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value;
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadFacturas();
                }, 500);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(this.searchTimeout);
                    this.currentFilters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadFacturas();
                }
            });
        }
        
        // Ordenamiento
        const headers = document.querySelectorAll('th[data-sort]');
        headers.forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.dataset.sort;
                if (!sortField) return;

                if (this.currentSort === sortField) {
                    this.currentOrder = this.currentOrder === 'desc' ? 'asc' : 'desc';
                } else {
                    this.currentSort = sortField;
                    this.currentOrder = 'asc';
                }

                // Actualizar UI
                headers.forEach(h => h.classList.remove('sorted'));
                th.classList.add('sorted');
                
                const icon = th.querySelector('.sort-icon');
                if (icon) {
                    // Restaurar iconos a 'arrow-down'
                    headers.forEach(h => {
                        const i = h.querySelector('.sort-icon');
                        if (i && i !== icon) {
                            i.className = 'fa-solid fa-arrow-down sort-icon';
                        }
                    });
                    icon.className = `fa-solid fa-arrow-${this.currentOrder === 'desc' ? 'down' : 'up'} sort-icon`;
                }

                this.currentPage = 1;
                this.loadFacturas();
            });
        });
        
        // Paginación
        const btnPrev = document.getElementById('btn-pager-prev');
        const btnNext = document.getElementById('btn-pager-next');
        if (btnPrev) btnPrev.addEventListener('click', () => { if(this.currentPage > 1) { this.currentPage--; this.loadFacturas(); } });
        if (btnNext) btnNext.addEventListener('click', () => { this.currentPage++; this.loadFacturas(); });
    }

    async loadFacturas() {
        try {
            if (this.tbody) this.tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';
            
            const result = await this.api.getFacturas(this.currentFilters, this.currentPage, this.limit, this.currentSort, this.currentOrder);
            this.currentData = result.data.facturas;
            
            this.render();
            this.updatePager(result.data.paginacion);
            this.updateFooter();
        } catch (error) {
            console.error('Error cargando facturas:', error);
            if (this.tbody) this.tbody.innerHTML = `<tr><td colspan="9" class="text-danger text-center">Error: ${error.message}</td></tr>`;
        }
    }

    render() {
        if (!this.tbody) return;
        
        if (!this.currentData || this.currentData.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px; color: var(--o-text-muted);">No se encontraron facturas.</td></tr>';
            return;
        }

        this.tbody.innerHTML = this.currentData.map(r => {
            const sel = this.selectedRows.has(String(r.id));
            
            // Obtener el tipo de cambio, o 1 si no está disponible
            const rate = parseFloat(r.invoice_currency_rate) || 1;
            
            // Convertir montos a PEN usando el tipo de cambio
            const subtotalPEN = (parseFloat(r.amount_untaxed || 0) * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            const igvPEN = (parseFloat(r.amount_tax || 0) * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            const totalPEN = (parseFloat(r.monto_total || 0) * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            const prefix = 'S/';
            
            const fechaParts = (r.fecha_emision||'').split('-');
            const fechaFormat = fechaParts.length === 3 ? `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}` : r.fecha_emision;

            // Determinar texto y clase del estado
            let stateText = 'Borrador';
            let stateClass = 'badge-secondary';
            if (r.state === 'posted') {
                stateText = 'Confirmado';
                stateClass = 'badge-success';
            } else if (r.state === 'cancel') {
                stateText = 'Cancelado';
                stateClass = 'badge-dark';
            }

            return `<tr class="${sel ? 'selected' : ''}" data-id="${r.id}">
                <td class="col-chk" data-id="${r.id}" data-action="chk">
                    <div style="display:flex;justify-content:center;">
                        <div class="o-checkbox ${sel ? 'checked' : ''}" id="chk-${r.id}"></div>
                    </div>
                </td>
                <td class="fw-bold col-num">${r.numero_factura || 'N/D'}</td>
                <td class="col-date" data-col="col-date">${fechaFormat}</td>
                <td class="col-client" style="overflow:hidden;text-overflow:ellipsis;" title="${r.nombre_receptor}">${r.nombre_receptor || 'N/D'}</td>
                <td data-col="col-ruc">${r.ruc_receptor || ''}</td>
                <td class="monetary col-total" data-col="col-subtotal">${prefix} ${subtotalPEN}</td>
                <td class="monetary col-total" data-col="col-igv">${prefix} ${igvPEN}</td>
                <td class="monetary col-total fw-bold" data-col="col-total-pen">${prefix} ${totalPEN}</td>
                <td class="col-state" data-col="col-state"><span class="o-badge-pill ${stateClass}">${stateText}</span></td>
                <td class="col-inv" data-col="col-guia">${r.serie_numero_guia || ''}</td>
                <td class="col-opt"></td>
            </tr>`;
        }).join('');

        // Re-aplicar visibilidad de columnas tras el renderizado del body
        this.applyColVisibility();
    }

    updatePager(paginacion) {
        if (!this.pagerVal) return;
    
        if (!paginacion || typeof paginacion !== 'object') {
            this.pagerVal.textContent = '0-0 / 0';
            return;
        }
    
        const pagina_actual = Number(paginacion.pagina_actual) || 0;
        const items_por_pagina = Number(paginacion.items_por_pagina) || 0;
        const total = Number(paginacion.total) || 0;
    
        if (total <= 0 || items_por_pagina <= 0 || pagina_actual <= 0) {
            this.pagerVal.textContent = '0-0 / 0';
            return;
        }
    
        const start = ((pagina_actual - 1) * items_por_pagina) + 1;
        if (start > total) {
            this.pagerVal.textContent = '0-0 / 0';
            return;
        }
    
        const end = Math.min(start + items_por_pagina - 1, total);
        this.pagerVal.textContent = `${start}-${end} / ${total}`;
    }

    updateFooter() {
        // Sumar usando el tipo de cambio para convertir todo a PEN
        let sumSubtotal = 0;
        let sumIgv = 0;
        let sumTotal = 0;

        this.currentData.forEach(r => {
            const rate = parseFloat(r.invoice_currency_rate) || 1;
            sumSubtotal += parseFloat(r.amount_untaxed || 0) * rate;
            sumIgv      += parseFloat(r.amount_tax    || 0) * rate;
            sumTotal    += parseFloat(r.monto_total   || 0) * rate;
        });

        const fmt = (val) => 'S/ ' + val.toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});

        if (this.subtotalFooter) this.subtotalFooter.textContent = fmt(sumSubtotal);
        if (this.igvFooter)      this.igvFooter.textContent      = fmt(sumIgv);
        if (this.totalFooter)    this.totalFooter.textContent    = fmt(sumTotal);
    }

    toggleRow(id, cell) {
        id = String(id);
        if (this.selectedRows.has(id)) {
            this.selectedRows.delete(id);
            const chk = document.getElementById('chk-' + id);
            if (chk) chk.classList.remove('checked');
            if (cell.closest('tr')) cell.closest('tr').classList.remove('selected');
        } else {
            this.selectedRows.add(id);
            const chk = document.getElementById('chk-' + id);
            if (chk) chk.classList.add('checked');
            if (cell.closest('tr')) cell.closest('tr').classList.add('selected');
        }
        this.syncHeaderChk();
    }

    toggleAll(el) {
        if (this.selectedRows.size === this.currentData.length && this.currentData.length > 0) {
            this.selectedRows.clear();
            if (el.classList) el.classList.remove('checked');
        } else {
            this.currentData.forEach(r => this.selectedRows.add(String(r.id)));
            if (el.classList) el.classList.add('checked');
        }
        this.render();
        this.syncHeaderChk();
    }

    syncHeaderChk() {
        if (!this.chkAll) return;
        if (this.selectedRows.size === this.currentData.length && this.currentData.length > 0) {
            this.chkAll.classList.add('checked');
        } else {
            this.chkAll.classList.remove('checked');
        }
    }

    // JavaScript metodo para descargar PDF
    downloadInvoices(ids) {
        const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
        if (!this.pagerVal && !list.length) return; // ajuste según contexto si quieres otra condición

        if (list.length === 0) {
            console.warn('No invoice ids to download');
            return;
        }

        list.forEach((id, index) => {
            if (!id && id !== 0) return;
            setTimeout(async () => {
                try {
                    //const url = `../../backend/api/facturaDownload.php?id=${encodeURIComponent(id)}`;
                    const url = `https://facturas.heinzsport.com/backend/api/facturaDownload.php?id=${encodeURIComponent(id)}`;
                    console.log('Downloading invoice ID:', id, 'URL:', url);
                    //const url = `../../backend/api/facturaDownload.php?id=${id}`;
                    //const resp = await fetch(url, { credentials: 'include' });
                    const resp = await fetch(url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `factura_${encodeURIComponent(id)}.pdf`;
                    // Some browsers require the link to be added to the DOM
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(blobUrl);
                } catch (err) {
                    console.error('Error descargando factura', id, err);
                }
            }, index * 500);
        });
    }

    /**
     * Descargar PDF de todas las facturas seleccionadas en la lista
     */
    downloadSelectedPdf() {
        if (this.selectedRows.size === 0) {
            alert('Por favor, seleccione al menos una factura para descargar.');
            return;
        }
        
        // Convertir el Set a Array y enviarlo a downloadInvoices
        const selectedIds = Array.from(this.selectedRows);
        this.downloadInvoices(selectedIds);
    }
}