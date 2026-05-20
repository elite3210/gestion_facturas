/**
 * OdooDataTable.js
 * 
 * Componente genérico para renderizar listados con el diseño de Odoo.
 * Maneja búsqueda por facetas, ordenamiento, visibilidad de columnas y paginación.
 */

export class OdooDataTable {
    constructor(config) {
        this.config = {
            storageKeyPrefix: 'odoo_table',
            defaultFilters: {},
            defaultFacets: [],
            defaultSort: 'id',
            defaultOrder: 'desc',
            limit: 15,
            facetToFilterMapper: (facets, base) => base,
            onFetchData: async () => ({ items: [], pagination: null }),
            onRenderRow: () => '',
            onRowClicked: () => { },
            onUpdateFooter: () => { },
            ...config
        };

        // Estado
        this.currentData = [];
        this.selectedRows = new Set();
        this.currentPage = 1;
        this.limit = this.config.limit;
        this.activeFacets = [...this.config.defaultFacets];
        this.currentFilters = { ...this.config.defaultFilters };
        this.currentSort = this.config.defaultSort;
        this.currentOrder = this.config.defaultOrder;

        // Referencias DOM fijas
        this.tbody = document.getElementById('tbody');
        this.pagerVal = document.getElementById('pager-val');
        this.chkAll = document.getElementById('chk-all');
        this.searchTimeout = null;
    }

    init() {
        this.setupEvents();
        this.initOptColPanel();
        this.initSearchPanel();

        // Sincronizar filtros iniciales con facetas por defecto
        if (this.activeFacets.length > 0) {
            this._renderFacetsUI();
            this._syncFilterBtns();
            this.buildFiltersFromFacets();
        }

        this.loadData();
    }

    // ════════════════════════════════════════════════════════
    //  COLUMNAS OPCIONALES
    // ════════════════════════════════════════════════════════

    initOptColPanel() {
        const btn = document.getElementById('opt-col-btn');
        const panel = document.getElementById('opt-col-panel');
        if (!btn || !panel) return;

        const storageKey = `${this.config.storageKeyPrefix}_hidden_cols`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        stored.forEach(col => this._setColVisible(col, false));

        panel.querySelectorAll('input[data-col]').forEach(chk => {
            if (stored.includes(chk.dataset.col)) chk.checked = false;
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('active', !isOpen);
        });

        panel.addEventListener('change', (e) => {
            const chk = e.target;
            if (!chk.dataset.col) return;
            this._setColVisible(chk.dataset.col, chk.checked);

            const hidden = [...panel.querySelectorAll('input[data-col]')]
                .filter(c => !c.checked)
                .map(c => c.dataset.col);
            localStorage.setItem(storageKey, JSON.stringify(hidden));
        });

        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && e.target !== btn) {
                panel.style.display = 'none';
                btn.classList.remove('active');
            }
        });
    }

    _setColVisible(colId, visible) {
        const table = document.getElementById('main-table');
        if (!table) return;
        table.querySelectorAll(`[data-col="${colId}"]`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    }

    applyColVisibility() {
        const storageKey = `${this.config.storageKeyPrefix}_hidden_cols`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const table = document.getElementById('main-table');
        if (!table) return;

        table.querySelectorAll('[data-col]').forEach(el => el.style.display = '');
        stored.forEach(colId => {
            table.querySelectorAll(`[data-col="${colId}"]`).forEach(el => {
                el.style.display = 'none';
            });
        });
    }

    // ════════════════════════════════════════════════════════
    //  MOTOR DE BÚSQUEDA Y FACETAS
    // ════════════════════════════════════════════════════════

    initSearchPanel() {
        const panel = document.getElementById('search-panel');
        const toggleBtn = document.getElementById('search-dropdown-btn');
        const searchInput = document.getElementById('search-input');
        if (!panel || !toggleBtn) return;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = panel.style.display !== 'none';
            panel.style.display = open ? 'none' : 'block';
            toggleBtn.classList.toggle('active', !open);
            if (!open) {
                this.loadFavorites();
                panel.querySelector('.o-sp-filter-item')?.focus();
            }
        });

        document.addEventListener('click', (e) => {
            const row = document.querySelector('.o-cp-search-row');
            if (row && !row.contains(e.target)) {
                panel.style.display = 'none';
                toggleBtn.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                panel.style.display = 'none';
                toggleBtn.classList.remove('active');
            }
        });

        panel.querySelectorAll('.o-sp-filter-item[data-facet-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.facetId;
                const exists = this.activeFacets.find(f => f.id === id);
                if (exists) {
                    this.removeFacet(id);
                } else {
                    this.addFacet({
                        id: btn.dataset.facetId,
                        label: btn.dataset.facetLabel,
                        field: btn.dataset.facetField,
                        value: btn.dataset.facetValue,
                        icon: btn.dataset.facetIcon || 'filter',
                    });
                }
                btn.classList.toggle('active', !!this.activeFacets.find(f => f.id === id));
            });
        });

        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = searchInput.value.trim();
                    if (!val) return;
                    this.removeFacet('__text__', false);
                    this.addFacet({ id: '__text__', label: val, field: 'search', value: val, icon: 'magnifying-glass' });
                    searchInput.value = '';
                    panel.style.display = 'none';
                    toggleBtn.classList.remove('active');
                }
            });
        }

        const btnSaveFav = document.getElementById('btn-save-favorite');
        if (btnSaveFav) {
            btnSaveFav.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.activeFacets.length === 0) {
                    alert('Debe aplicar al menos un filtro para guardar un favorito.');
                    return;
                }
                const name = prompt('Nombre del favorito:');
                if (name && name.trim()) {
                    this.saveFavorite(name.trim());
                }
            });
        }

        this.loadFavorites();
    }

    addFacet(facetObj, reload = true) {
        if (!this.activeFacets.find(f => f.id === facetObj.id)) {
            this.activeFacets.push(facetObj);
            this._renderFacetsUI();
            this._syncFilterBtns();
            if (reload) {
                this.currentPage = 1;
                this.buildFiltersFromFacets();
                document.dispatchEvent(new CustomEvent('odooFiltersChanged', { detail: { filters: this.currentFilters } }));
                this.loadData();
            }
        }
    }

    removeFacet(facetId, reload = true) {
        this.activeFacets = this.activeFacets.filter(f => f.id !== facetId);
        this._renderFacetsUI();
        this._syncFilterBtns();
        if (reload) {
            this.currentPage = 1;
            this.buildFiltersFromFacets();
            document.dispatchEvent(new CustomEvent('odooFiltersChanged', { detail: { filters: this.currentFilters } }));
            this.loadData();
        }
    }

    _renderFacetsUI() {
        const container = document.getElementById('facets-container');
        if (!container) return;

        container.innerHTML = this.activeFacets.map(f => `
            <div class="o-facet">
                <span class="o-facet-label"><i class="fa-solid fa-${f.icon}"></i></span>
                <span class="o-facet-value">${this._escHtml(f.label)}</span>
                <button class="o-facet-remove" data-facet-id="${f.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');

        container.querySelectorAll('.o-facet-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFacet(btn.dataset.facetId);
            });
        });
    }

    buildFiltersFromFacets() {
        const base = { ...this.config.defaultFilters };
        this.currentFilters = this.config.facetToFilterMapper(this.activeFacets, base);
    }

    _syncFilterBtns() {
        const panel = document.getElementById('search-panel');
        if (!panel) return;
        panel.querySelectorAll('.o-sp-filter-item[data-facet-id]').forEach(btn => {
            const active = !!this.activeFacets.find(f => f.id === btn.dataset.facetId);
            btn.classList.toggle('active', active);
        });
    }

    _escHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ════════════════════════════════════════════════════════
    //  FAVORITOS
    // ════════════════════════════════════════════════════════

    saveFavorite(name) {
        const storageKey = `${this.config.storageKeyPrefix}_favorites`;
        const favorites = this._getFavorites();
        if (favorites.find(f => f.name === name)) {
            alert(`Ya existe un favorito con el nombre "${name}"`);
            return;
        }
        favorites.push({ name, facets: [...this.activeFacets] });
        localStorage.setItem(storageKey, JSON.stringify(favorites));
        this.loadFavorites();
    }

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

        container.querySelectorAll('.o-sp-fav-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fav = favorites[parseInt(btn.dataset.favIdx)];
                if (!fav) return;
                this.activeFacets = [];
                fav.facets.forEach(f => this.addFacet(f, false));
                this.currentPage = 1;
                this.buildFiltersFromFacets();
                this.loadData();
                const panel = document.getElementById('search-panel');
                if (panel) panel.style.display = 'none';
            });
        });

        container.querySelectorAll('.o-sp-fav-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const favs = this._getFavorites();
                favs.splice(parseInt(btn.dataset.favIdx), 1);
                localStorage.setItem(`${this.config.storageKeyPrefix}_favorites`, JSON.stringify(favs));
                this.loadFavorites();
            });
        });
    }

    _getFavorites() {
        try {
            return JSON.parse(localStorage.getItem(`${this.config.storageKeyPrefix}_favorites`) || '[]');
        } catch { return []; }
    }

    // ════════════════════════════════════════════════════════
    //  EVENTOS Y RENDERING DE TABLA
    // ════════════════════════════════════════════════════════

    setupEvents() {
        document.addEventListener('click', (e) => {
            if (!this.tbody) this.tbody = document.getElementById('tbody');
            if (!this.tbody || !this.tbody.contains(e.target)) return;

            const chkCell = e.target.closest('[data-action="chk"]');
            if (chkCell) {
                e.stopPropagation();
                this.toggleRow(chkCell.dataset.id, chkCell);
                return;
            }

            const row = e.target.closest('tr[data-id]');
            if (row) {
                this.config.onRowClicked(row.dataset.id);
            }
        });

        if (this.chkAll) {
            this.chkAll.addEventListener('click', (e) => {
                this.toggleAll(e.target);
            });
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value;
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadData();
                }, 500);
            });
        }

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

                headers.forEach(h => h.classList.remove('sorted'));
                th.classList.add('sorted');

                const icon = th.querySelector('.sort-icon');
                if (icon) {
                    headers.forEach(h => {
                        const i = h.querySelector('.sort-icon');
                        if (i && i !== icon) {
                            i.className = 'fa-solid fa-arrow-down sort-icon';
                        }
                    });
                    icon.className = `fa-solid fa-arrow-${this.currentOrder === 'desc' ? 'down' : 'up'} sort-icon`;
                }

                this.currentPage = 1;
                this.loadData();
            });
        });

        const btnPrev = document.getElementById('btn-pager-prev');
        const btnNext = document.getElementById('btn-pager-next');
        if (btnPrev) btnPrev.addEventListener('click', () => { if (this.currentPage > 1) { this.currentPage--; this.loadData(); } });
        if (btnNext) btnNext.addEventListener('click', () => { this.currentPage++; this.loadData(); });
    }

    async loadData() {
        try {
            if (this.tbody) this.tbody.innerHTML = '<tr><td colspan="100%" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';

            const result = await this.config.onFetchData(this.currentFilters, this.currentPage, this.limit, this.currentSort, this.currentOrder);
            this.currentData = result.items || [];

            this.render();
            this.updatePager(result.pagination);
            this.config.onUpdateFooter(this.currentData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            if (this.tbody) this.tbody.innerHTML = `<tr><td colspan="100%" class="text-danger text-center">Error: ${error.message}</td></tr>`;
        }
    }

    render() {
        if (!this.tbody) return;

        if (!this.currentData || this.currentData.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding: 20px; color: var(--o-text-muted);">No se encontraron registros.</td></tr>';
            return;
        }

        this.tbody.innerHTML = this.currentData.map(r => {
            const isSelected = this.selectedRows.has(String(r.id));
            return this.config.onRenderRow(r, isSelected);
        }).join('');

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

    getSelectedIds() {
        return Array.from(this.selectedRows);
    }
}
