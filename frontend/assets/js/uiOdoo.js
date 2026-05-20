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
    
    // Ocultar todas las vistas principales
    const views = ['list', 'kanban', 'pivot', 'graph'];
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) {
            el.style.display = (v === viewName) ? 'block' : 'none';
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
    document.querySelectorAll('.o-apps-item').forEach(el => el.classList.toggle('active', el.textContent.trim()===name));
    const brand = document.querySelector('.o-nav-brand');
    if (brand) brand.textContent = name;
    closeAppsMenu();
}

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
    const listEl = document.getElementById('view-list');
    const formEl = document.getElementById('view-form');
    if (listEl) {
        listEl.classList.remove('active');
        listEl.style.display = 'none';
    }
    if (formEl) {
        formEl.style.display = 'flex';
        formEl.scrollTop = 0;
    }
}

function closeFormView(pushState = true) {
    const listEl = document.getElementById('view-list');
    const formEl = document.getElementById('view-form');
    if (formEl) {
        formEl.style.display = 'none';
    }
    if (listEl) {
        listEl.style.display = 'flex';
        listEl.classList.add('active');
    }
    
    if (pushState) {
        // Volver a la URL base de la lista
        const basePath = window.location.pathname.includes('/facturas/') ? '../factura.html' : './factura.html';
        history.pushState({ view: 'list' }, '', basePath);
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
