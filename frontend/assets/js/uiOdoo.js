/**
 * uiOdoo.js
 * Funcionalidad genérica de la interfaz estilo Odoo (menús, tabs, cambio de vistas)
 */

// ══════════════════════════════════════════════════════════
//  VIEW SWITCHER (Toggle active class on view buttons)
// ══════════════════════════════════════════════════════════
function switchView(btn) {
    document.querySelectorAll('.o-view-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const viewName = btn ? (btn.dataset.view || 'list') : 'list';
    
    // Ocultar todas las acciones/vistas internas
    const views = ['list-inner', 'kanban', 'pivot', 'graph'];
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) {
            el.style.display = (v === viewName || (v === 'list-inner' && viewName === 'list')) ? 'flex' : 'none';
        }
    });

    // Disparar evento personalizado para que appFactura.js lo detecte y cargue los datos
    document.dispatchEvent(new CustomEvent('odooViewChanged', { detail: { view: viewName } }));
}

// ══════════════════════════════════════════════════════════
//  NAV DROPDOWN (Top section menus)
// ══════════════════════════════════════════════════════════
function toggleDropMenu(el, id) {
    const menu = document.getElementById(id);
    if (!menu) return;
    const isOpen = menu.classList.contains('open');
    document.querySelectorAll('.o-dropdown-menu').forEach(m => m.classList.remove('open'));
    if (!isOpen) menu.classList.add('open');
}

document.addEventListener('click', e => {
    // Cerrar dropdowns de nav sections si se hace clic fuera
    if (!e.target.closest('.o-nav-section') && !e.target.closest('.o-breadcrumb-gear')) {
        document.querySelectorAll('.o-dropdown-menu').forEach(m => m.classList.remove('open'));
    }
});

// ══════════════════════════════════════════════════════════
//  APPS MENU (Home menu grid)
// ══════════════════════════════════════════════════════════
function toggleAppsMenu() {
    const menu = document.getElementById('apps-menu');
    const overlay = document.getElementById('apps-overlay');
    const btn = document.getElementById('apps-btn');
    if (!menu || !overlay || !btn) return;
    
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
        menu.classList.remove('open'); 
        overlay.classList.remove('open');
        btn.setAttribute('aria-expanded','false'); 
        btn.style.background='';
    } else {
        document.querySelectorAll('.o-dropdown-menu').forEach(m => m.classList.remove('open'));
        menu.classList.add('open'); 
        overlay.classList.add('open');
        btn.setAttribute('aria-expanded','true'); 
        btn.style.background='rgba(255,255,255,0.2)';
    }
}

function closeAppsMenu() {
    const menu = document.getElementById('apps-menu');
    const overlay = document.getElementById('apps-overlay');
    const btn = document.getElementById('apps-btn');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (btn) {
        btn.setAttribute('aria-expanded','false'); 
        btn.style.background='';
    }
}

function selectApp(name) {
    document.querySelectorAll('.o-apps-item').forEach(el => {
        // Normalizar texto para la comparación (ignorar iconos internos)
        const text = el.textContent.trim();
        el.classList.toggle('active', text === name);
    });
    const brand = document.querySelector('.o-nav-brand');
    if (brand) brand.textContent = name;
    closeAppsMenu();

    // Actualizar URL hash (Routing)
    const newHash = '#app=' + name.toLowerCase();
    if (window.location.hash !== newHash) {
        // Al usar history.pushState en lugar de window.location.hash, evitamos disparar el evento hashchange innecesariamente
        history.pushState(null, '', newHash);
    }

    // Disparar evento para que otras partes de la app reaccionen
    const event = new CustomEvent('appChanged', { detail: { appName: name } });
    window.dispatchEvent(event);
}

// ══════════════════════════════════════════════════════════
//  HASH ROUTER (Soporte Atrás/Adelante del navegador)
// ══════════════════════════════════════════════════════════
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#app=')) {
        let appName = hash.split('=')[1];
        // Capitalizar primera letra (ventas -> Ventas, compras -> Compras)
        appName = appName.charAt(0).toUpperCase() + appName.slice(1);
        
        const brand = document.querySelector('.o-nav-brand');
        if (brand && brand.textContent.trim() !== appName) {
            selectApp(appName);
        }
    }
});

// ══════════════════════════════════════════════════════════
//  NOTEBOOK TABS (Inside form view)
// ══════════════════════════════════════════════════════════
function nbTab(panelId, el) {
    document.querySelectorAll('.o-nb-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.o-nb-panel').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    const panel = document.getElementById('nb-' + panelId);
    if (panel) panel.classList.add('active');
}

// ══════════════════════════════════════════════════════════
//  LIST / FORM VIEW TOGGLE
// ══════════════════════════════════════════════════════════
function openFormView() {
    // Al usar Action Manager, cada vista tiene su propio Control Panel.
    // Solo necesitamos alternar la visibilidad de los contenedores padre.
    
    // Ocultar el multi-view
    const multiEl = document.getElementById('action-multi-view');
    if (multiEl) {
        multiEl.style.display = 'none';
    }

    // Mostrar form
    const formEl = document.getElementById('view-form');
    if (formEl) {
        formEl.style.display = 'flex';
        const formContent = document.getElementById('form-view-container');
        if (formContent) formContent.scrollTop = 0;
    }
}

function closeFormView(pushState = true) {
    // Ocultar form
    const formEl = document.getElementById('view-form');
    if (formEl) {
        formEl.style.display = 'none';
    }

    // Mostrar multi-view
    const multiEl = document.getElementById('action-multi-view');
    if (multiEl) {
        multiEl.style.display = 'flex';
    }

    // Refresh global pager to match list view state
    if (window.facturaList && window.facturaList.dataTable && window.facturaList.dataTable.lastPagination) {
        window.facturaList.dataTable.updatePager(window.facturaList.dataTable.lastPagination);
    }
    
    if (pushState) {
        // Volver a la URL base de la lista preservando el hash actual
        const basePath = window.location.pathname.includes('/facturas/') ? '../factura.html' : './factura.html';
        const currentHash = window.location.hash;
        history.pushState({ view: 'list' }, '', basePath + currentHash);
    }
}

// Exportar funciones si se usa en módulos, o hacerlas disponibles globalmente
window.uiOdoo = {
    switchView,
    toggleDropMenu,
    toggleAppsMenu,
    closeAppsMenu,
    selectApp,
    nbTab,
    openFormView,
    closeFormView
};
