// ============================================================
// app.js — Gestión Financiera Warecloud
// Organizado en módulos: Auth · Nav · Data · UI · Modales
// ============================================================

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── ESTADO GLOBAL ────────────────────────────────────────────
let movimientos = [], empresas = [], cuentas = [], inversiones = [], asientos = [], cuentasCorrientes = [];
let editId = null, editAsientoId = null, editInvId = null;
let filtrosEmpresas = [];
let compLineas = [];

// ============================================================
// MÓDULO: UTILIDADES
// ============================================================

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtSigned(n, tipo) {
  const v = Number(n) || 0;
  const esEg = tipo === 'Egreso' || tipo === 'Tarjeta de crédito';
  return `<span class="${esEg ? 'neg-text' : 'pos-text'}">${esEg ? '-' : ''}$ ${fmt(Math.abs(v))}</span>`;
}

function badgeClass(tipo) {
  const map = {
    'Ingreso': 'b-ing', 'Egreso': 'b-eg', 'Inversión': 'b-inv',
    'Préstamo': 'b-inv', 'Tarjeta de crédito': 'b-tar', 'Banco': 'b-ban'
  };
  return 'badge ' + (map[tipo] || 'b-ing');
}

function getEl(id) { return document.getElementById(id); }
function setVal(id, val) { const el = getEl(id); if (el) el.value = val ?? ''; }
function getVal(id) { return getEl(id)?.value ?? ''; }

function initAutocomplete() {
  const input = getEl('f-empresa-input');
  const dropdown = getEl('f-empresa-lista');

  if (!input || !dropdown) return;

  setupEmpresaAutocomplete(input, dropdown);
}
// ============================================================
// MÓDULO: TOAST / NOTIFICACIONES
// ============================================================

function showToast(msg, type = 'success') {
  const colors = {
    success: { bg: 'var(--green-bg)', color: 'var(--green)', border: '#a8d5b5' },
    error: { bg: '#fff1f0', color: '#c0392b', border: '#f5c6c6' },
    info: { bg: 'var(--surface)', color: 'var(--text)', border: 'var(--border)' },
  };
  const c = colors[type] || colors.info;
  const existing = document.querySelectorAll('.gf-toast');
  const topOffset = 1 + existing.length * 3.5;
  const b = document.createElement('div');
  b.className = 'gf-toast';
  b.style.cssText = `position:fixed;top:${topOffset}rem;left:50%;transform:translateX(-50%) translateY(-8px);
    background:${c.bg};color:${c.color};border:1px solid ${c.border};border-radius:8px;
    padding:10px 20px;font-size:13px;font-weight:500;z-index:9999;
    box-shadow:0 4px 16px rgba(0,0,0,0.12);opacity:0;
    transition:opacity 0.2s ease, transform 0.2s ease;white-space:nowrap`;
  b.textContent = msg;
  document.body.appendChild(b);
  requestAnimationFrame(() => {
    b.style.opacity = '1';
    b.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    b.style.opacity = '0';
    b.style.transform = 'translateX(-50%) translateY(-8px)';
    setTimeout(() => b.remove(), 200);
  }, 3500);
}

function showSuccessBanner(msg) { showToast(msg, 'success'); }

// ============================================================
// MÓDULO: AUTH
// ============================================================

async function checkSession() {
  const hash = window.location.hash;
  if (hash?.includes('type=signup')) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      showApp(session.user);
      showSuccessBanner('✓ Cuenta confirmada. ¡Bienvenido!');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp(session.user); else showLogin();
}

function showLogin() {
  getEl('login-screen').classList.remove('hidden');
  getEl('app').classList.add('hidden');
}

function showApp(user) {
  getEl('login-screen').classList.add('hidden');
  getEl('app').classList.remove('hidden');
  getEl('user-email-display').textContent = user.email;

  initAutocomplete()

  loadAll();
}

getEl('btn-login').addEventListener('click', async () => {
  const email = getVal('login-email').trim();
  const pass = getVal('login-password');
  const err = getEl('login-error');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Completá email y contraseña.'; return; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { err.textContent = error.message; return; }
  showApp(data.user);
});

getEl('btn-register').addEventListener('click', async () => {
  const email = getVal('login-email').trim();
  const pass = getVal('login-password');
  const err = getEl('login-error');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Completá email y contraseña.'; return; }
  if (pass.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
  const { error } = await sb.auth.signUp({ email, password: pass });
  if (error) { err.textContent = error.message; return; }
  err.style.color = 'var(--green)';
  err.textContent = 'Cuenta creada. Revisá tu email para confirmar.';
});

getEl('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  showLogin();
});

// ============================================================
// MÓDULO: CARGA DE DATOS
// ============================================================

async function loadAll() {
  await Promise.all([loadMovimientos(), loadEmpresas(), loadCuentas(), loadCuentasCorrientes()]);
}

async function loadMovimientos() {
  const { data } = await sb.from('movimientos').select('*').order('fecha', { ascending: false });
  movimientos = data || [];
  renderAll();
}

async function loadEmpresas() {
  const { data } = await sb.from('empresas').select('*').order('nombre');
  empresas = data || [];
  populateEmpresaSelect();
}

async function loadCuentas() {
  const { data } = await sb.from('cuentas').select('*').order('codigo');
  cuentas = data || [];
}

async function loadCuentasCorrientes() {
  const { data } = await sb.from('cuentas_corrientes').select('*').order('fecha', { ascending: false });
  cuentasCorrientes = data || [];
  renderEmpresas();
}

async function loadAsientos() {
  const { data } = await sb.from('asientos').select('*, asiento_lineas(*)').order('fecha', { ascending: false });
  asientos = data || [];
  renderAsientos();
}

async function loadInversiones() {
  const { data } = await sb.from('inversiones')
    .select('*, inversion_movimientos(*)')
    .order('fecha_inicio', { ascending: false });
  inversiones = data || [];
  renderInversiones();
}

async function reconstruirCuentasCorrientes() {

  await sb.from('cuentas_corrientes').delete().neq('id',0);

  const { data: movs } = await sb
    .from('movimientos')
    .select('*');

  for (const m of movs) {

    if (!m.empresa_id) continue;

    const debe = m.tipo === 'Ingreso' ? m.monto : 0;
    const haber = m.tipo === 'Egreso' ? m.monto : 0;

    await sb.from('cuentas_corrientes').insert({
      empresa_id: m.empresa_id,
      fecha: m.fecha,
      detalle: m.detalle,
      debe,
      haber
    });
  }

  await loadCuentasCorrientes();}

async function reconstruirSistema(){

  showToast('Reconstruyendo sistema...', 'info')

  await sb.from('cuentas_corrientes').delete().neq('id',0)
  await sb.from('asientos').delete().neq('id',0)
  await sb.from('asiento_lineas').delete().neq('id',0)

  const {data:movs} = await sb
  .from('movimientos')
  .select('*')

  for(const m of movs){

    await generarAsientoComprobanteDesdeMovimiento(m)

  }

  await loadAll()

  showToast('Sistema reconstruido correctamente','success')

}

async function reconstruirSaldos() {
  showToast('Reconstruyendo saldos...', 'info');

  // Limpiar todas las cuentas corrientes
  await sb.from('cuentas_corrientes').delete();

  // Limpiar todos los asientos
  await sb.from('asiento_lineas').delete();
  await sb.from('asientos').delete();

  // Reconstruir desde movimientos
  const { data: movimientos } = await sb.from('movimientos').select('*');

  for (const m of movimientos) {
    await generarAsientoDesdeMovimiento(m);
  }

  await loadAll(); // refrescar datos en UI
  showToast('Saldos reconstruidos correctamente', 'success');
}

// ⚠️ IMPORTANTE: Ejecutar solo una vez y respaldar la base de datos antes
async function reconstruirTodo() {
  showToast('Iniciando reconstrucción de saldos...', 'info');

  // 1️⃣ Limpiar tablas críticas
  await sb.from('cuentas_corrientes').delete();
  await sb.from('asiento_lineas').delete();
  await sb.from('asientos').delete();

  showToast('Tablas críticas limpias', 'success');

  // 2️⃣ Obtener todos los movimientos
  const { data: movimientos, error } = await sb.from('movimientos').select('*');
  if (error) {
    showToast('Error cargando movimientos: ' + error.message, 'error');
    return;
  }

  // 3️⃣ Generar asientos y cuentas corrientes desde movimientos
  for (const mov of movimientos) {
    await generarAsientoDesdeMovimiento(mov);
  }

  showToast('Todos los asientos y cuentas reconstruidos', 'success');

  // 4️⃣ Refrescar UI
  await loadAll();
  showToast('Reconstrucción completa ✅', 'success');
}

async function generarAsientoDesdeMovimiento(mov) {
  const { data: { user } } = await sb.auth.getUser();

  // Crear asiento
  const { data: asiento } = await sb.from('asientos')
    .insert({
      fecha: mov.fecha,
      detalle: mov.detalle,
      user_id: user.id
    })
    .select()
    .single();

  const debe = mov.tipo === 'Ingreso' ? mov.monto : 0;
  const haber = mov.tipo === 'Egreso' ? mov.monto : 0;

  // Insertar líneas contables
  await sb.from('asiento_lineas').insert([
    { asiento_id: asiento.id, cuenta: 'Clientes', debe, haber: 0 },
    { asiento_id: asiento.id, cuenta: 'Ingresos', debe: 0, haber }
  ]);

  // Insertar en cuentas corrientes solo si hay empresa
  if (mov.empresa_id) {
    await sb.from('cuentas_corrientes').insert({
      empresa_id: mov.empresa_id,
      fecha: mov.fecha,
      detalle: mov.detalle,
      debe,
      haber
    });
  }
}

async function generarAsientoDesdeMovimiento(mov) {
  const { data: { user } } = await sb.auth.getUser();

  // Crear asiento
  const { data: asiento } = await sb.from('asientos')
    .insert({
      fecha: mov.fecha,
      detalle: mov.detalle,
      user_id: user.id
    })
    .select()
    .single();

  const debe = mov.tipo === 'Ingreso' ? mov.monto : 0;
  const haber = mov.tipo === 'Egreso' ? mov.monto : 0;

  // Líneas contables
  await sb.from('asiento_lineas').insert([
    { asiento_id: asiento.id, cuenta: 'Clientes', debe, haber: 0 },
    { asiento_id: asiento.id, cuenta: 'Ingresos', debe: 0, haber }
  ]);

  // Actualizar cuentas corrientes solo si hay empresa
  if (mov.empresa_id) {
    await sb.from('cuentas_corrientes').insert({
      empresa_id: mov.empresa_id,
      fecha: mov.fecha,
      detalle: mov.detalle,
      debe,
      haber
    });
  }
}

// ============================================================
// MÓDULO: NAVEGACIÓN
// ============================================================

const PAGE_TITLES = {
  movimientos: 'Movimientos', er: 'Estado de resultados', flujo: 'Flujo de fondos',
  empresas: 'Empresas', cuentas: 'Plan de cuentas', asientos: 'Asientos contables',
  saldos: 'Saldos por cuenta', inversiones: 'Inversiones'
};

const BTN_NUEVO_LABELS = {
  empresas: '+ Nueva empresa', cuentas: '+ Nueva cuenta',
  asientos: '+ Nuevo asiento', inversiones: '+ Nueva inversión'
};

const PAGE_LOADERS = {
  er: renderER, flujo: renderFlujo, empresas: renderEmpresas,
  cuentas: renderCuentas, asientos: loadAsientos, saldos: renderSaldos, inversiones: loadInversiones
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    getEl('page-' + page).classList.add('active');
    getEl('page-title').textContent = PAGE_TITLES[page] || page;

    const btnNuevo = getEl('btn-nuevo-movimiento');
    btnNuevo.textContent = BTN_NUEVO_LABELS[page] || '+ Nuevo movimiento';
    btnNuevo.dataset.context = page;

    PAGE_LOADERS[page]?.();
  });
});

// ── Botón nuevo: un solo listener, usa dataset.context ──
getEl('btn-nuevo-movimiento').addEventListener('click', () => {
  const ctx = getEl('btn-nuevo-movimiento').dataset.context || 'movimientos';
  const actions = {
    empresas: () => openModalEmpresa(),
    cuentas: () => openModalCuenta(),
    asientos: () => openModalAsiento(),
    inversiones: () => openModalInversion(),
  };
  (actions[ctx] || (() => { clearForm(); openModal(); }))();
});

// ============================================================
// MÓDULO: AUTOCOMPLETE GENÉRICO
// ============================================================

/**
 * Configura autocomplete en un input con dropdown.
 * @param {HTMLElement} input
 * @param {HTMLElement} dropdown
 * @param {Function} getItems - recibe el valor del input, devuelve array de {label, id, extra}
 * @param {Function} onSelect - recibe el item seleccionado
 */
function setupAutocomplete(input, dropdown, getItems, onSelect) {
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();
    if (!val) { dropdown.innerHTML = ''; return; }

    const results = getItems(val).slice(0, 8);
    dropdown.innerHTML = results.map(item => `
      <div class="dropdown-item" data-id="${item.id}">
        ${item.label}
        ${item.extra ? `<span style="font-size:11px;color:var(--text-faint)"> ${item.extra}</span>` : ''}
      </div>
    `).join('');

    dropdown.querySelectorAll('.dropdown-item').forEach(el => {
      el.onclick = () => {
        const item = results.find(r => r.id == el.dataset.id);
        onSelect(item);
        dropdown.innerHTML = '';
      };
    });
  });
  

  // Cerrar al hacer click fuera
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.innerHTML = '';
    }
  }, { capture: true });
}

function setupEmpresaAutocomplete(input, dropdown) {
  setupAutocomplete(
    input, dropdown,
    (val) => empresas
      .filter(e => (e.nombre || '').toLowerCase().includes(val))
      .map(e => ({ id: e.id, label: e.nombre, extra: e.cuit || '' })),
    (item) => {
      input.value = item.label;
      input.dataset.id = item.id;

      setVal('f-empresa-id', item.id); // 👈 guardar empresa_id

    }
  );
}

function setupCuentaAutocomplete(row) {
  const input = row.querySelector('.linea-cuenta-input');
  const dropdown = row.querySelector('.cuenta-dropdown');
  setupAutocomplete(
    input, dropdown,
    (val) => cuentas
      .filter(c => `${c.codigo} ${c.nombre}`.toLowerCase().includes(val))
      .map(c => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` })),
    (item) => {
      input.value = item.label;
      input.dataset.id = item.id;
      updateTotales();
    }
  );
}

// ============================================================
// MÓDULO: SELECTS HELPERS
// ============================================================

function populateEmpresaSelect() {
  const sel = getEl('f-empresa-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Sin empresa</option>';
  empresas.forEach(e => {
    sel.innerHTML += `<option value="${e.id}">${e.nombre}${e.cuit ? ' — ' + e.cuit : ''}</option>`;
  });
  sel.value = cur;
}

function populateCuentaSimpleSelect() {
  const sel = getEl('f-cuenta-simple');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar cuenta...</option>';
  cuentas.filter(c => c.tipo === 'Activo').forEach(c => {
    sel.innerHTML += `<option value="${c.id}|${c.nombre}">${c.codigo} — ${c.nombre}</option>`;
  });
}

function populateCancelacionSelect() {
  const sel = getEl('f-cancelacion');
  if (!sel) return;
  sel.innerHTML = '<option value="">Queda pendiente (cta. a pagar/cobrar)</option>';
  cuentas.filter(c => c.tipo === 'Activo').forEach(c => {
    sel.innerHTML += `<option value="${c.id}|${c.nombre}">${c.codigo} — ${c.nombre}</option>`;
  });
}

function populateCpCuentaSelect() {
  const sel = getEl('cp-cuenta');
  sel.innerHTML = '<option value="">Seleccionar cuenta...</option>';
  cuentas.filter(c => c.tipo === 'Activo').forEach(c => {
    sel.innerHTML += `<option value="${c.id}|${c.nombre}">${c.codigo} — ${c.nombre}</option>`;
  });
}

function populateEmpresasDatalist() {
  const dl = getEl('empresas-list');
  if (!dl) return;
  dl.innerHTML = empresas.map(e => `<option value="${e.nombre}"></option>`).join('');
}

// ============================================================
// MÓDULO: MODAL COMPROBANTE
// ============================================================

async function openModal(id) {
  if (!empresas.length) await loadEmpresas();

  editId = id || null;
  compLineas = [];
  getEl('modal-title').textContent = editId ? 'Editar comprobante' : 'Nuevo comprobante';
  getEl('form-error').textContent = '';

  clearForm();
  populateCuentaSimpleSelect();
  populateCancelacionSelect();

  if (editId) {
    const m = movimientos.find(x => x.id === editId);
    if (m) fillForm(m);
  } else {
    setVal('f-fecha', new Date().toISOString().split('T')[0]);
    setVal('f-tipo', 'Ingreso');
    actualizarConceptoSegunTipo();
    renderCompLineas([{ cuenta_id: '', cuenta_nombre: '', descripcion: '', monto_neto: 0, iva_porcentaje: 21, iva_monto: 0, total: 0 }]);
  }

  getEl('modal-overlay').classList.remove('hidden');

  const inputEmpresa = getEl('f-empresa-input');
  const dropdownEmpresa = getEl('f-empresa-lista');

  if (inputEmpresa && dropdownEmpresa) {
    setupEmpresaAutocomplete(inputEmpresa, dropdownEmpresa);
  }

  //getEl('modal-overlay').classList.remove('hidden');

  // Autocomplete empresa en el modal de comprobante
  // (() => {
  //  setupEmpresaAutocomplete(getEl('f-empresa-input'), getEl('f-empresa-lista'));
  // }, 0);
}

function closeModal() { getEl('modal-overlay').classList.add('hidden'); }

function clearForm() {
  ['f-detalle', 'f-doc', 'f-obs', 'f-concepto'].forEach(id => setVal(id, ''));
  ['f-monto', 'f-neto', 'f-usd', 'f-tc'].forEach(id => setVal(id, ''));
  setVal('f-fecha', '');
  setVal('f-tipo', 'Ingreso');

  const empInput = getEl('f-empresa-input');
  if (empInput) { empInput.value = ''; delete empInput.dataset.id; }
  setVal('f-empresa-id', '');

  compLineas = [];
  const cont = getEl('comp-lineas');
  if (cont) cont.innerHTML = '';

  const errEl = getEl('form-error');
  if (errEl) errEl.textContent = '';
}

function fillForm(m) {
  setVal('f-fecha', m.fecha || '');
  setVal('f-tipo', m.tipo || 'Ingreso');
  setVal('f-detalle', m.detalle || '');
  setVal('f-doc', m.documento || '');
  setVal('f-obs', m.observaciones || '');

  const emp = empresas.find(e => e.id === m.empresa_id);
  const empInput = getEl('f-empresa-input');
  if (empInput) empInput.value = emp ? emp.nombre : '';
  setVal('f-empresa-id', m.empresa_id || '');

  actualizarConceptoSegunTipo();
  setVal('f-concepto', m.concepto || '');

  // Renderizar líneas si existen
  if (m.comp_lineas?.length) {
    renderCompLineas(m.comp_lineas);
  }
}

async function recalcularSaldos() {

  const { data } = await sb
    .from('cuentas_corrientes')
    .select('*');

  cuentasCorrientes = data || [];

  renderEmpresas();

  showToast('Saldos recalculados', 'info');
}

function actualizarConceptoSegunTipo() {
  const tipo = getVal('f-tipo');
  const sel = getEl('f-concepto');
  if (!sel) return;

  const opciones = {
    Ingreso: [
      { value: 'factura_emitida', label: 'Venta / Factura emitida (cliente queda debiendo)' },
      { value: 'nota_debito_emitida', label: 'Nota de débito emitida (aumenta deuda del cliente)' },
      { value: 'nota_credito_emitida', label: 'Nota de crédito emitida (reduce ingreso)' },
    ],
    Egreso: [
      { value: 'factura_recibida', label: 'Compra / Factura recibida (quedamos debiendo)' },
      { value: 'nota_debito_recibida', label: 'Nota de débito recibida (aumenta nuestra deuda)' },
      { value: 'nota_credito_recibida', label: 'Nota de crédito recibida (reduce egreso)' },
    ],
    Cobro: [{ value: 'cobro_efectivo', label: 'Cobro (cancela deuda del cliente)' }],
    Pago: [{ value: 'pago_realizado', label: 'Pago (cancela nuestra deuda con proveedor)' }],
  };

  const lista = opciones[tipo] || [];
  sel.innerHTML = '<option value="">Sin impacto en cuenta corriente</option>';
  lista.forEach(o => { sel.innerHTML += `<option value="${o.value}">${o.label}</option>`; });
  if (tipo === 'Cobro') sel.value = 'cobro_efectivo';
  if (tipo === 'Pago') sel.value = 'pago_realizado';

  const esCancelacion = tipo === 'Cobro' || tipo === 'Pago';
  const secLineas = getEl('sec-lineas');
  const secSimple = getEl('sec-simple');
  if (secLineas) secLineas.style.display = esCancelacion ? 'none' : 'block';
  if (secSimple) secSimple.style.display = esCancelacion ? 'block' : 'none';
}

// ── Líneas de comprobante ──

function renderCompLineas(lineas) {
  compLineas = lineas;
  const cont = getEl('comp-lineas');
  if (!cont) return;

  cont.innerHTML = lineas.map((l, i) => `
    <div class="linea-row comp-linea-row" data-i="${i}">
      <div style="position:relative;flex:2">
        <input class="cl-cuenta-input" placeholder="Cuenta" value="${l.cuenta_nombre || ''}">
        <div class="cl-cuenta-dropdown dropdown"></div>
      </div>
      <input type="text" class="cl-desc" placeholder="Descripción" value="${l.descripcion || ''}"
             style="flex:1.5;min-width:100px" oninput="updateLinea(${i})">
      <input type="number" class="cl-neto" placeholder="Neto" value="${l.monto_neto || ''}"
             step="0.01" style="flex:1;min-width:80px" oninput="calcularLinea(${i})">
      <input type="number" class="cl-iva" placeholder="IVA%" value="${l.iva_porcentaje ?? 0}"
             step="0.01" style="flex:0.6;min-width:60px" oninput="calcularLinea(${i})">
      <input type="number" class="cl-total" placeholder="Total" value="${l.total || ''}"
             step="0.01" readonly style="flex:1;min-width:80px;background:var(--bg)">
      <button class="btn btn-sm btn-del" onclick="eliminarCompLinea(${i})">✕</button>
    </div>
  `).join('');

  // Autocomplete cuentas en cada línea
  cont.querySelectorAll('.comp-linea-row').forEach(row => {
    const input = row.querySelector('.cl-cuenta-input');
    const dropdown = row.querySelector('.cl-cuenta-dropdown');
    const index = parseInt(row.dataset.i);

    setupAutocomplete(
      input, dropdown,
      (val) => cuentas
        .filter(c => (c.tipo === 'Ingreso' || c.tipo === 'Egreso') &&
          `${c.codigo} ${c.nombre}`.toLowerCase().includes(val))
        .map(c => ({ id: c.id, label: `${c.codigo} — ${c.nombre}`, nombre: c.nombre })),
      (item) => {
        input.value = item.label;
        input.dataset.id = item.id;
        compLineas[index].cuenta_id = item.id;
        compLineas[index].cuenta_nombre = item.nombre;
      }
    );
  });

  actualizarTotalesComp();
}

function updateLinea(i) {
  const row = document.querySelector(`.comp-linea-row[data-i="${i}"]`);
  if (!row) return;
  compLineas[i].descripcion = row.querySelector('.cl-desc').value;
}

function calcularLinea(i) {
  const row = document.querySelector(`.comp-linea-row[data-i="${i}"]`);
  if (!row) return;

  const neto = parseFloat(row.querySelector('.cl-neto').value) || 0;
  const ivaPct = parseFloat(row.querySelector('.cl-iva').value) || 0;
  const ivaMonto = neto * ivaPct / 100;
  const total = neto + ivaMonto;

  row.querySelector('.cl-total').value = total.toFixed(2);
  compLineas[i] = { ...compLineas[i], monto_neto: neto, iva_porcentaje: ivaPct, iva_monto: ivaMonto, total };
  actualizarTotalesComp();
}

function eliminarCompLinea(i) {
  if (compLineas.length <= 1) return;
  compLineas.splice(i, 1);
  renderCompLineas(compLineas);
}

function actualizarTotalesComp() {
  const totalNeto = compLineas.reduce((s, l) => s + (l.monto_neto || 0), 0);
  const totalIva = compLineas.reduce((s, l) => s + (l.iva_monto || 0), 0);
  const total = compLineas.reduce((s, l) => s + (l.total || 0), 0);
  const el = getEl('comp-total');
  if (el) el.innerHTML = `
    <span class="muted-text">Neto: <strong>$ ${fmt(totalNeto)}</strong></span>
    <span class="muted-text">IVA: <strong>$ ${fmt(totalIva)}</strong></span>
    <span>Total: <strong style="font-size:15px">$ ${fmt(total)}</strong></span>
  `;
}

// ── Guardar comprobante ──

getEl('btn-guardar').addEventListener('click', async () => {
  const errEl = getEl('form-error');
  errEl.textContent = '';

  const fecha = getVal('f-fecha');
  const detalle = getVal('f-detalle').trim();
  const tipo = getVal('f-tipo');

  if (!fecha || !detalle) { 
    errEl.textContent = 'Fecha y detalle son obligatorios.'; 
    return; 
  }

  // --- Empresa ---
  const empresaInput = getEl('f-empresa-input');
  const empresaId = getVal('f-empresa-id') || null;
  const empresaObj = empresaId ? empresas.find(e => e.id === empresaId) : null;

  if (!empresaObj) {
    errEl.textContent = 'Seleccioná una empresa válida del listado.';
    return;
  }

  const concepto = getVal('f-concepto') || null;

  const esCancelacion = tipo === 'Cobro' || tipo === 'Pago';
  let lineasValidas, totalNeto, totalIva, total, cancelId, cancelNombre;

  if (esCancelacion) {
    const montoSimple = parseFloat(getVal('f-monto-simple')) || 0;
    const cuentaVal = getVal('f-cuenta-simple');
    if (!montoSimple) { errEl.textContent = 'El monto es obligatorio.'; return; }
    if (!cuentaVal) { errEl.textContent = 'Seleccioná una cuenta.'; return; }
    [cancelId, cancelNombre] = cuentaVal.split('|');
    lineasValidas = [{ cuenta_id: cancelId, cuenta_nombre: cancelNombre, monto_neto: montoSimple, iva_monto: 0, total: montoSimple }];
    totalNeto = montoSimple; totalIva = 0; total = montoSimple;
  } else {
    lineasValidas = compLineas.filter(l => l.monto_neto > 0);
    if (!lineasValidas.length) { errEl.textContent = 'Agregá al menos una línea con monto.'; return; }
    const cancelVal = getVal('f-cancelacion');
    [cancelId, cancelNombre] = cancelVal ? cancelVal.split('|') : [null, null];
    totalNeto = lineasValidas.reduce((s, l) => s + (l.monto_neto || 0), 0);
    totalIva = lineasValidas.reduce((s, l) => s + (l.iva_monto || 0), 0);
    total = lineasValidas.reduce((s, l) => s + (l.total || 0), 0);
  }

  try {
    const { data: { user } } = await sb.auth.getUser();
    const movData = {
      fecha,
      tipo,
      detalle,
      empresa: empresaObj.nombre,
      empresa_id: empresaObj.id,
      cuit: empresaObj.cuit,
      monto: total,
      monto_neto: totalNeto,
      clasificacion: lineasValidas.map(l => l.cuenta_nombre).join(', '),
      documento: getVal('f-doc') || null,
      observaciones: getVal('f-obs') || null,
      concepto,
    };

    let movId;
    if (editId) {
      await sb.from('movimientos').update(movData).eq('id', editId);
      movId = editId;
    } else {
      const { data: newMov, error } = await sb.from('movimientos')
        .insert({ ...movData, user_id: user.id }).select().single();

      if (error) throw error;
      movId = newMov.id;
    }

    await generarAsientoComprobante({
      userId: user.id,
      movId,
      fecha,
      detalle,
      tipo,
      concepto,
      lineas: lineasValidas,
      totalNeto,
      totalIva,
      total,
      empresaObj,
      cancelId,
      cancelNombre,
    });

    closeModal();
    await loadMovimientos();
    await loadCuentasCorrientes();
    showSuccessBanner('✓ Comprobante registrado correctamente.');
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Error al guardar: ' + e.message;
  }
});

// Función de recalculo de saldos
function recalcularSaldos() {
  empresas.forEach(e => {
    const movs = movimientos.filter(m => m.empresa_id === e.id);
    e.saldo = movs.reduce((s, m) => s + (m.monto || 0), 0);
  });
}

// ── Listeners del modal comprobante ──
getEl('modal-close').addEventListener('click', closeModal);
getEl('btn-cancelar').addEventListener('click', closeModal);
getEl('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
getEl('f-tipo').addEventListener('change', actualizarConceptoSegunTipo);
getEl('comp-add-linea')?.addEventListener('click', () => {
  compLineas.push({ cuenta_id: '', cuenta_nombre: '', descripcion: '', monto_neto: 0, iva_porcentaje: 21, iva_monto: 0, total: 0 });
  renderCompLineas(compLineas);
});

// ============================================================
// MÓDULO: RENDER MOVIMIENTOS
// ============================================================

function renderAll() { renderStats(); renderTable(); populateMesFilter(); populateTipoFilter(); }

function renderStats() {
  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const egresos = movimientos.filter(m => m.tipo === 'Egreso' || m.tipo === 'Tarjeta de crédito').reduce((s, m) => s + (m.monto || 0), 0);
  const resultado = ingresos - egresos;
  getEl('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos totales</div><div class="stat-value pos">$ ${fmt(ingresos)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos totales</div><div class="stat-value neg">$ ${fmt(egresos)}</div></div>
    <div class="stat-card"><div class="stat-label">Resultado</div><div class="stat-value ${resultado >= 0 ? 'pos' : 'neg'}">$ ${fmt(resultado)}</div></div>
    <div class="stat-card"><div class="stat-label">Movimientos</div><div class="stat-value">${movimientos.length}</div></div>
  `;
}

function populateTipoFilter() {
  const tipos = ['Ingreso', 'Egreso', 'Inversión', 'Préstamo', 'Tarjeta de crédito', 'Banco'];
  const cont = getEl('filter-tipo-options');
  if (!cont) return;
  cont.innerHTML = tipos.map(t => `
    <label class="chk-option"><span>${t}</span><input type="checkbox" value="${t}"></label>
  `).join('');
  cont.querySelectorAll('input').forEach(i => i.addEventListener('change', renderTable));
}

function populateMesFilter() {
  const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const meses = [...new Set(movimientos.map(m => m.fecha?.substring(0, 7)).filter(Boolean))].sort().reverse();
  const cont = getEl('filter-mes-options');
  if (!cont) return;
  cont.innerHTML = meses.map(m => {
    const [y, mo] = m.split('-');
    return `<label class="chk-option"><span>${nom[parseInt(mo) - 1]} ${y}</span><input type="checkbox" value="${m}"></label>`;
  }).join('');
  cont.querySelectorAll('input').forEach(i => i.addEventListener('change', renderTable));
}

function getSelectedCheckboxes(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i => i.value);
}

getEl('search').addEventListener('input', renderTable);

function renderTable() {
  const search = getVal('search').toLowerCase();
  const tipos = getSelectedCheckboxes('filter-tipo-options');
  const meses = getSelectedCheckboxes('filter-mes-options');

  const list = movimientos.filter(m => {
    if (search && !((m.detalle || '').toLowerCase().includes(search) ||
      (m.empresa || '').toLowerCase().includes(search) ||
      (m.cuit || '').includes(search))) return false;
    if (tipos.length && !tipos.includes(m.tipo)) return false;
    if (meses.length && !meses.some(mes => (m.fecha || '').startsWith(mes))) return false;
    return true;
  });

  const tbody = getEl('tabla-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Sin movimientos.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => `
    <tr>
      <td style="white-space:nowrap;font-family:var(--mono);font-size:12px;color:var(--text-muted)">${m.fecha || ''}</td>
      <td>${m.detalle}</td>
      <td class="muted-text">${m.empresa || '—'}</td>
      <td class="muted-text" style="font-size:12px;font-family:var(--mono)">${m.clasificacion || '—'}</td>
      <td><span class="${badgeClass(m.tipo)}">${m.tipo}</span></td>
      <td class="r">${fmtSigned(m.monto, m.tipo)}</td>
      <td class="r muted-text">${m.monto_neto ? '$ ' + fmt(m.monto_neto) : '—'}</td>
      <td class="r muted-text">${m.usd ? 'U$S ' + fmt(m.usd) : '—'}</td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn btn-sm" onclick="openModal('${m.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarMovimiento('${m.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function eliminarMovimiento(id) {
  const ok = await confirmarEliminar('¿Eliminar este movimiento? Esta acción no se puede deshacer.');
  if (!ok) return;
  await sb.from('movimientos').delete().eq('id', id);
  await loadMovimientos();
  showToast('✓ Movimiento eliminado.', 'info');
}

// ── Dropdowns filtro ──
getEl('btn-filter-tipo').addEventListener('click', e => {
  e.stopPropagation();
  const panel = getEl('filter-tipo-panel');
  const otroPanel = getEl('filter-mes-panel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  otroPanel.style.display = 'none';
});

getEl('btn-filter-mes').addEventListener('click', e => {
  e.stopPropagation();
  const panel = getEl('filter-mes-panel');
  const otroPanel = getEl('filter-tipo-panel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  otroPanel.style.display = 'none';
});

document.addEventListener('click', () => {
  getEl('filter-tipo-panel').style.display = 'none';
  getEl('filter-mes-panel').style.display = 'none';
});

// ============================================================
// MÓDULO: EMPRESAS
// ============================================================

// ── Búsqueda con chips (un solo listener para #empresas-search) ──
const inputEmpSearch = getEl('empresas-search');
const dropdownEmpSearch = getEl('empresas-autocomplete');

inputEmpSearch?.addEventListener('input', () => {
  const val = inputEmpSearch.value.toLowerCase().trim();
  if (!val) { dropdownEmpSearch.innerHTML = ''; return; }

  const resultados = empresas
    .filter(e => e.nombre.toLowerCase().includes(val) || (e.cuit || '').includes(val))
    .slice(0, 8);

  dropdownEmpSearch.innerHTML = resultados.map(e => `
    <div class="dropdown-item" data-nombre="${e.nombre.toLowerCase()}">
      ${e.nombre}
      ${e.cuit ? `<span style="font-size:11px;color:var(--text-faint)"> ${e.cuit}</span>` : ''}
    </div>
  `).join('');

  dropdownEmpSearch.querySelectorAll('.dropdown-item').forEach(item => {
    item.onclick = () => agregarFiltroEmpresa(item.dataset.nombre);
  });
});

inputEmpSearch?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const val = inputEmpSearch.value.trim().toLowerCase();
  if (val) agregarFiltroEmpresa(val);
});

function agregarFiltroEmpresa(val) {
  if (!filtrosEmpresas.includes(val)) filtrosEmpresas.push(val);
  inputEmpSearch.value = '';
  dropdownEmpSearch.innerHTML = '';
  renderEmpresas();
}

function removeFiltroEmpresa(f) {
  filtrosEmpresas = filtrosEmpresas.filter(x => x !== f);
  renderEmpresas();
}

function getSaldoEmpresa(empresaId) {
  return cuentasCorrientes
    .filter(c => c.empresa_id === empresaId)
    .reduce((s, c) => s + (c.debe || 0) - (c.haber || 0), 0);
}

async function saldoEmpresa(empresa_id) {
  const { data: movimientos } = await sb.from('cuentas_corrientes')
    .select('debe, haber')
    .eq('empresa_id', empresa_id);

  let saldo = 0;
  movimientos.forEach(m => saldo += (m.debe || 0) - (m.haber || 0));

  return saldo;
}

function renderEmpresas() {
  // Chips de filtros activos
  const filtrosDiv = getEl('empresas-filtros-activos');
  if (filtrosDiv) {
    filtrosDiv.innerHTML = filtrosEmpresas.map(f => `
      <span style="background:#eee;padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer"
            onclick="removeFiltroEmpresa('${f}')">
        ${f} ✕
      </span>
    `).join('');
  }

  const tbody = getEl('empresas-body');
  if (!tbody) return;

  const orden = getVal('empresas-orden');
  const tipoSaldo = getVal('empresas-tipo-saldo');

  let lista = empresas.map(e => ({ ...e, saldo: getSaldoEmpresa(e.id) }));

  // Filtro chips
  if (filtrosEmpresas.length) {
    lista = lista.filter(e => {
      const texto = `${e.nombre || ''} ${e.cuit || ''} ${e.email || ''} ${e.telefono || ''}`.toLowerCase();
      return filtrosEmpresas.some(f => texto.includes(f));
    });
  }

  // Filtro texto libre (sin Enter)
  const search = (getVal('empresas-search') || '').toLowerCase();
  if (search) {
    lista = lista.filter(e =>
      e.nombre.toLowerCase().includes(search) || (e.cuit || '').includes(search)
    );
  }

  // Filtro saldo
  if (tipoSaldo === 'a-cobrar') lista = lista.filter(e => e.saldo > 0);
  else if (tipoSaldo === 'a-pagar') lista = lista.filter(e => e.saldo < 0);

  // Orden
  if (orden === 'saldo-desc') lista.sort((a, b) => b.saldo - a.saldo);
  else if (orden === 'saldo-asc') lista.sort((a, b) => a.saldo - b.saldo);
  else if (orden === 'nombre') lista.sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Sin empresas.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(e => {
    const saldoLabel = e.saldo === 0
      ? '<span class="muted-text">$ 0</span>'
      : e.saldo > 0
        ? `<span class="pos-text" style="font-weight:500">Nos debe $ ${fmt(e.saldo)}</span>`
        : `<span class="neg-text" style="font-weight:500">Debemos $ ${fmt(Math.abs(e.saldo))}</span>`;

    const btnSaldo = e.saldo !== 0
      ? `<button class="btn btn-sm" onclick="openModalCobrarPagar('${e.id}')">${e.saldo > 0 ? 'Cobrar' : 'Pagar'}</button>`
      : '';

    return `<tr>
      <td style="font-weight:500">${e.nombre}</td>
      <td class="muted-text" style="font-family:var(--mono);font-size:12px">${e.cuit || '—'}</td>
      <td class="muted-text">${e.condicion_iva || '—'}</td>
      <td class="muted-text">${e.email || '—'}</td>
      <td class="muted-text">${e.telefono || '—'}</td>
      <td class="r">${saldoLabel}</td>
      <td style="text-align:right;white-space:nowrap">
        ${btnSaldo}
        <button class="btn btn-sm" onclick="openModalEmpresa('${e.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarEmpresa('${e.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Modal Empresa ──

function renderEmpresaFilas(filas) {
  const cont = getEl('me-filas');
  if (!cont) return;
  cont.innerHTML = filas.map((f, i) => `
    <div class="linea-row" style="display:grid;grid-template-columns:2fr 1.2fr 1.2fr 1.5fr 1fr 1.5fr 28px;gap:6px">
      <input class="me-f-nombre" placeholder="Nombre *" value="${f.nombre || ''}">
      <input class="me-f-cuit" placeholder="XX-XXXXXXXX-X" value="${f.cuit || ''}">
      <select class="me-f-iva">
        ${['', 'Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final']
      .map(o => `<option ${o === f.iva ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
      <button class="btn btn-sm btn-del" onclick="eliminarFilaEmpresa(${i})">✕</button>
    </div>
  `).join('');
}

function getEmpresaFilas() {
  return [...document.querySelectorAll('#me-filas .linea-row')].map(row => ({
    nombre: row.querySelector('.me-f-nombre').value.trim(),
    cuit: row.querySelector('.me-f-cuit').value.trim(),
    iva: row.querySelector('.me-f-iva').value,
    email: row.querySelector('.me-f-email').value.trim(),
    tel: row.querySelector('.me-f-tel').value.trim(),
    obs: row.querySelector('.me-f-obs').value.trim(),
  }));
}

function eliminarFilaEmpresa(i) {
  const filas = getEmpresaFilas();
  if (filas.length <= 1) return;
  filas.splice(i, 1);
  renderEmpresaFilas(filas);
}

function openModalEmpresa(id) {
  const emp = id ? empresas.find(e => e.id === id) : null;
  const esEdicion = !!emp;
  getEl('me-title').textContent = esEdicion ? 'Editar empresa' : 'Nueva empresa';
  getEl('me-error').textContent = '';
  setVal('me-id', emp ? emp.id : '');

  getEl('me-form-single').style.display = esEdicion ? '' : 'none';
  getEl('me-form-multi').style.display = esEdicion ? 'none' : '';
  getEl('me-guardar').textContent = esEdicion ? 'Guardar empresa' : 'Guardar empresas';

  if (esEdicion) {
    setVal('me-nombre', emp.nombre || '');
    setVal('me-cuit', emp.cuit || '');
    setVal('me-iva', emp.condicion_iva || '');
    setVal('me-email', emp.email || '');
    setVal('me-tel', emp.telefono || '');
    setVal('me-dir', emp.direccion || '');
    setVal('me-obs', emp.observaciones || '');
  } else {
    renderEmpresaFilas([{ nombre: '', cuit: '', iva: '', email: '', tel: '' }]);
  }
  getEl('modal-empresa').classList.remove('hidden');
}

function closeModalEmpresa() { getEl('modal-empresa').classList.add('hidden'); }
getEl('me-close').addEventListener('click', closeModalEmpresa);
getEl('me-cancelar').addEventListener('click', closeModalEmpresa);

getEl('me-add-fila').addEventListener('click', () => {
  const filas = getEmpresaFilas();
  filas.push({ nombre: '', cuit: '', iva: '', email: '', tel: '', obs: '' });
  renderEmpresaFilas(filas);
  document.querySelectorAll('#me-filas .linea-row')[filas.length - 1]?.querySelector('.me-f-nombre')?.focus();
});

getEl('me-csv-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return;

    const COLS = ['nombre', 'cuit', 'condicion_iva', 'email', 'telefono', 'observaciones'];
    const firstLow = lines[0].toLowerCase().replace(/\s/g, '');
    const tieneHeader = COLS.some(c => firstLow.includes(c));
    const dataLines = tieneHeader ? lines.slice(1) : lines;

    let colIdx = { nombre: 0, cuit: 1, condicion_iva: 2, email: 3, telefono: 4, observaciones: 5 };
    if (tieneHeader) {
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s/g, '_'));
      colIdx = Object.fromEntries(COLS.map(c => [c, -1]));
      headers.forEach((h, i) => { if (colIdx.hasOwnProperty(h)) colIdx[h] = i; });
    }

    const filas = dataLines.map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const get = key => colIdx[key] >= 0 ? (cols[colIdx[key]] || '') : '';
      return { nombre: get('nombre'), cuit: get('cuit'), iva: get('condicion_iva'), email: get('email'), tel: get('telefono'), obs: get('observaciones') };
    }).filter(f => f.nombre);

    if (!filas.length) { getEl('me-error').textContent = 'El CSV no contiene filas válidas.'; return; }

    getEl('me-csv-hint').style.display = 'block';
    renderEmpresaFilas(filas);
    showToast(`↑ ${filas.length} fila${filas.length > 1 ? 's' : ''} importada${filas.length > 1 ? 's' : ''} del CSV.`, 'info');
    e.target.value = '';
  };
  reader.readAsText(file);
});

getEl('me-guardar').addEventListener('click', async () => {
  const err = getEl('me-error');
  err.textContent = '';
  const id = getVal('me-id');
  const { data: { user } } = await sb.auth.getUser();

  try {
    if (id) {
      const nombre = getVal('me-nombre').trim();
      if (!nombre) { err.textContent = 'El nombre es obligatorio.'; return; }
      const data = {
        nombre, cuit: getVal('me-cuit') || null,
        condicion_iva: getVal('me-iva') || null,
        email: getVal('me-email') || null,
        telefono: getVal('me-tel') || null,
        direccion: getVal('me-dir') || null,
        observaciones: getVal('me-obs') || null,
      };
      await sb.from('empresas').update(data).eq('id', id);
      showToast('✓ Empresa actualizada.');
    } else {
      const filas = getEmpresaFilas();
      if (filas.some(f => !f.nombre)) { err.textContent = 'Todas las filas deben tener al menos un nombre.'; return; }
      const rows = filas.map(f => ({
        nombre: f.nombre, cuit: f.cuit || null, condicion_iva: f.iva || null,
        email: f.email || null, telefono: f.tel || null, observaciones: f.obs || null,
        user_id: user.id,
      }));
      await sb.from('empresas').insert(rows);
      showToast(rows.length === 1 ? '✓ Empresa creada.' : `✓ ${rows.length} empresas creadas.`);
    }
    closeModalEmpresa();
    await loadEmpresas();
    renderEmpresas();
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

async function eliminarEmpresa(id) {
  const ok = await confirmarEliminar('¿Eliminar esta empresa? Esta acción no se puede deshacer.');
  if (!ok) return;
  await sb.from('empresas').delete().eq('id', id);
  await loadEmpresas();
  renderEmpresas();
  showToast('✓ Empresa eliminada.', 'info');
}

// ============================================================
// MÓDULO: PLAN DE CUENTAS
// ============================================================

function openModalCuenta(id) {
  const c = id ? cuentas.find(x => x.id === id) : null;
  getEl('mc-title').textContent = c ? 'Editar cuenta' : 'Nueva cuenta';
  getEl('mc-error').textContent = '';
  setVal('mc-id', c ? c.id : '');
  setVal('mc-codigo', c ? c.codigo : '');
  setVal('mc-nombre', c ? c.nombre : '');
  setVal('mc-tipo', c ? c.tipo : 'Activo');
  getEl('modal-cuenta').classList.remove('hidden');
}

function closeModalCuenta() { getEl('modal-cuenta').classList.add('hidden'); }
getEl('mc-close').addEventListener('click', closeModalCuenta);
getEl('mc-cancelar').addEventListener('click', closeModalCuenta);

getEl('mc-guardar').addEventListener('click', async () => {
  const err = getEl('mc-error');
  err.textContent = '';
  const codigo = getVal('mc-codigo').trim();
  const nombre = getVal('mc-nombre').trim();
  if (!codigo || !nombre) { err.textContent = 'Código y nombre son obligatorios.'; return; }

  const id = getVal('mc-id');
  const data = { codigo, nombre, tipo: getVal('mc-tipo') };

  try {
    if (id) {
      await sb.from('cuentas').update(data).eq('id', id);
    } else {
      const { data: { user } } = await sb.auth.getUser();
      const { data: existente } = await sb.from('cuentas').select('*')
        .eq('user_id', user.id).eq('codigo', data.codigo).maybeSingle();

      if (existente) {
        const confirmar = await mostrarConfirmacion('Ya existe una cuenta con ese código.\n¿Desea reemplazarla?');
        if (!confirmar) return;
        await sb.from('cuentas').update({ nombre: data.nombre, tipo: data.tipo }).eq('id', existente.id);
      } else {
        await sb.from('cuentas').insert({ ...data, user_id: user.id, origen: 'usuario' });
      }
    }
    closeModalCuenta();
    await loadCuentas();
    renderCuentas();
    showToast(id ? '✓ Cuenta actualizada.' : '✓ Cuenta creada.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

async function eliminarCuenta(id) {
  const ok = await confirmarEliminar('¿Eliminar esta cuenta? Esta acción no se puede deshacer.');
  if (!ok) return;
  await sb.from('cuentas').delete().eq('id', id);
  await loadCuentas();
  renderCuentas();
  showToast('✓ Cuenta eliminada.', 'info');
}

function renderCuentas() {
  const tbody = getEl('cuentas-body');
  if (!tbody) return;
  if (!cuentas.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Sin cuentas. Hacé clic en "+ Nueva cuenta".</div></td></tr>`;
    return;
  }
  const tipoColor = { Activo: 'b-ing', Pasivo: 'b-eg', Patrimonio: 'b-inv', Ingreso: 'b-ban', Egreso: 'b-tar', Impuesto: 'b-imp' };
  tbody.innerHTML = cuentas.map(c => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${c.codigo}</td>
      <td style="font-weight:500">${c.nombre}</td>
      <td><span class="badge ${tipoColor[c.tipo] || 'b-ing'}">${c.tipo}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm" onclick="openModalCuenta('${c.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarCuenta('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// MÓDULO: ESTADO DE RESULTADOS
// ============================================================

function renderER() {
  const meses = [...new Set(movimientos.map(m => m.fecha?.substring(0, 7)).filter(Boolean))].sort();
  if (!meses.length) {
    getEl('er-table').innerHTML = `<tr><td><div class="empty-state">Sin datos.</div></td></tr>`;
    getEl('er-table-otros').innerHTML = '';
    return;
  }
  const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const getNetoXCuentaXMes = (cuentaNombre, tipoMov, mes) => movimientos
    .filter(m => m.tipo === tipoMov && (m.clasificacion || '').includes(cuentaNombre) && (m.fecha || '').startsWith(mes))
    .reduce((s, m) => s + (m.monto_neto || m.monto || 0), 0);

  const getTotalTipo = (tipo, mes) => movimientos
    .filter(m => m.tipo === tipo && (m.fecha || '').startsWith(mes))
    .reduce((s, m) => s + (m.monto_neto || m.monto || 0), 0);

  const ctasIngreso = cuentas.filter(c => c.tipo === 'Ingreso').sort((a, b) => a.codigo.localeCompare(b.codigo));
  const ctasEgreso = cuentas.filter(c => c.tipo === 'Egreso').sort((a, b) => a.codigo.localeCompare(b.codigo));

  const colHeaders = meses.map(m => {
    const [y, mo] = m.split('-');
    return `<th class="r">${nom[parseInt(mo) - 1]} ${y}</th>`;
  }).join('');

  let html = `<thead><tr><th>Cuenta</th>${colHeaders}<th class="r">Total</th></tr></thead><tbody>`;

  const sectionHeader = label => `<tr style="background:var(--bg)"><td colspan="${meses.length + 2}"
    style="font-size:11px;font-weight:500;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.06em;padding:10px 14px 4px">${label}</td></tr>`;

  // ── Ingresos ──
  html += sectionHeader('Ingresos');
  const totalIngMeses = Object.fromEntries(meses.map(m => [m, 0]));

  ctasIngreso.forEach(c => {
    let rowTotal = 0;
    html += `<tr><td style="padding-left:20px;color:var(--text-muted)">${c.codigo} — ${c.nombre}</td>`;
    meses.forEach(mes => {
      const v = getNetoXCuentaXMes(c.nombre, 'Ingreso', mes);
      totalIngMeses[mes] += v; rowTotal += v;
      html += `<td class="r ${v > 0 ? 'pos-text' : 'muted-text'}">$ ${fmt(v)}</td>`;
    });
    html += `<td class="r ${rowTotal > 0 ? 'pos-text' : 'muted-text'}" style="font-weight:500">$ ${fmt(rowTotal)}</td></tr>`;
  });

  // Sin clasificar (ingresos)
  let rowSinCtaIng = 0;
  const valSinCtaIng = meses.map(mes => {
    const totalClasif = ctasIngreso.reduce((s, c) => s + getNetoXCuentaXMes(c.nombre, 'Ingreso', mes), 0);
    const diff = getTotalTipo('Ingreso', mes) - totalClasif;
    totalIngMeses[mes] += diff; rowSinCtaIng += diff;
    return diff;
  });
  if (rowSinCtaIng > 0) {
    html += `<tr><td style="padding-left:20px;color:var(--text-faint);font-style:italic">Sin clasificar</td>`;
    valSinCtaIng.forEach(v => { html += `<td class="r muted-text">$ ${fmt(v)}</td>`; });
    html += `<td class="r muted-text">$ ${fmt(rowSinCtaIng)}</td></tr>`;
  }

  let grandIng = 0;
  html += `<tr class="er-subtotal"><td>Total ingresos</td>`;
  meses.forEach(m => { grandIng += totalIngMeses[m]; html += `<td class="r pos-text">$ ${fmt(totalIngMeses[m])}</td>`; });
  html += `<td class="r pos-text" style="font-weight:500">$ ${fmt(grandIng)}</td></tr>`;

  // ── Egresos ──
  html += sectionHeader('Egresos');
  const totalEgMeses = Object.fromEntries(meses.map(m => [m, 0]));

  ctasEgreso.forEach(c => {
    let rowTotal = 0;
    html += `<tr><td style="padding-left:20px;color:var(--text-muted)">${c.codigo} — ${c.nombre}</td>`;
    meses.forEach(mes => {
      const v = getNetoXCuentaXMes(c.nombre, 'Egreso', mes);
      totalEgMeses[mes] += v; rowTotal += v;
      html += `<td class="r ${v > 0 ? 'neg-text' : 'muted-text'}">$ ${fmt(v)}</td>`;
    });
    html += `<td class="r ${rowTotal > 0 ? 'neg-text' : 'muted-text'}" style="font-weight:500">$ ${fmt(rowTotal)}</td></tr>`;
  });

  let rowSinCtaEg = 0;
  const valSinCtaEg = meses.map(mes => {
    const totalClasif = ctasEgreso.reduce((s, c) => s + getNetoXCuentaXMes(c.nombre, 'Egreso', mes), 0);
    const diff = getTotalTipo('Egreso', mes) - totalClasif;
    totalEgMeses[mes] += diff; rowSinCtaEg += diff;
    return diff;
  });
  if (rowSinCtaEg > 0) {
    html += `<tr><td style="padding-left:20px;color:var(--text-faint);font-style:italic">Sin clasificar</td>`;
    valSinCtaEg.forEach(v => { html += `<td class="r muted-text">$ ${fmt(v)}</td>`; });
    html += `<td class="r muted-text">$ ${fmt(rowSinCtaEg)}</td></tr>`;
  }

  let grandEg = 0;
  html += `<tr class="er-subtotal"><td>Total egresos</td>`;
  meses.forEach(m => { grandEg += totalEgMeses[m]; html += `<td class="r neg-text">$ ${fmt(totalEgMeses[m])}</td>`; });
  html += `<td class="r neg-text" style="font-weight:500">$ ${fmt(grandEg)}</td></tr>`;

  // ── Resultado bruto y CM ──
  let grandBruto = 0;
  html += `<tr class="er-total"><td>Resultado bruto</td>`;
  meses.forEach(m => {
    const v = totalIngMeses[m] - totalEgMeses[m]; grandBruto += v;
    html += `<td class="r ${v >= 0 ? 'pos-text' : 'neg-text'}">$ ${fmt(v)}</td>`;
  });
  html += `<td class="r ${grandBruto >= 0 ? 'pos-text' : 'neg-text'}">$ ${fmt(grandBruto)}</td></tr>`;

  html += `<tr><td style="color:var(--text-muted);font-size:12px">Contribución marginal</td>`;
  meses.forEach(m => {
    const cm = totalIngMeses[m] > 0 ? ((totalIngMeses[m] - totalEgMeses[m]) / totalIngMeses[m] * 100) : 0;
    html += `<td class="r" style="color:var(--text-muted);font-size:12px">${cm.toFixed(1)}%</td>`;
  });
  const cmTotal = grandIng > 0 ? ((grandIng - grandEg) / grandIng * 100) : 0;
  html += `<td class="r" style="color:var(--text-muted);font-size:12px">${cmTotal.toFixed(1)}%</td></tr>`;

  html += '</tbody>';
  getEl('er-table').innerHTML = html;

  // ── Otros movimientos ──
  const otros = [
    { label: 'IVA Débito Fiscal', tipo: 'Ingreso' },
    { label: 'IVA Crédito Fiscal', tipo: 'Egreso' },
    { label: 'Tarjetas de crédito', tipo: 'Tarjeta de crédito' },
    { label: 'Bancos / Transferencias', tipo: 'Banco / Transferencia' },
    { label: 'Inversiones', tipo: 'Inversión' },
    { label: 'Préstamos', tipo: 'Préstamo' },
  ];

  let html2 = `<thead><tr><th>Otros</th>${colHeaders}<th class="r">Total</th></tr></thead><tbody>`;
  otros.forEach(cat => {
    let rowT = 0;
    html2 += `<tr><td>${cat.label}</td>`;
    meses.forEach(mes => {
      const v = getTotalTipo(cat.tipo, mes); rowT += v;
      html2 += `<td class="r muted-text">$ ${fmt(v)}</td>`;
    });
    html2 += `<td class="r" style="font-weight:500">$ ${fmt(rowT)}</td></tr>`;
  });
  html2 += '</tbody>';
  getEl('er-table-otros').innerHTML = html2;
}

// ============================================================
// MÓDULO: FLUJO DE FONDOS
// ============================================================

function renderFlujo() {
  const desde = getVal('flujo-desde');
  const hasta = getVal('flujo-hasta');

  let movsFiltrados = movimientos;
  if (desde) movsFiltrados = movsFiltrados.filter(m => (m.fecha || '') >= desde);
  if (hasta) movsFiltrados = movsFiltrados.filter(m => (m.fecha || '') <= hasta);

  const meses = [...new Set(movsFiltrados.map(m => m.fecha?.substring(0, 7)).filter(Boolean))].sort();
  if (!meses.length) {
    getEl('flujo-stats').innerHTML = '';
    getEl('flujo-table').innerHTML = `<tr><td><div class="empty-state">Sin datos para el período.</div></td></tr>`;
    return;
  }

  const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const getSum = (tipos, mes) => movsFiltrados
    .filter(m => tipos.includes(m.tipo) && (m.fecha || '').startsWith(mes))
    .reduce((s, m) => s + (m.monto || 0), 0);

  const filas = [
    { label: 'Ingresos', tipos: ['Ingreso'], sign: 1 },
    { label: 'Egresos', tipos: ['Egreso'], sign: -1 },
    { label: 'Tarjetas', tipos: ['Tarjeta de crédito'], sign: -1 },
    { label: 'Bancos / Transf.', tipos: ['Banco'], sign: 1 },
    { label: 'Inversiones', tipos: ['Inversión'], sign: 1 },
    { label: 'Préstamos', tipos: ['Préstamo'], sign: 1 },
  ];

  const colHeaders = meses.map(m => {
    const [y, mo] = m.split('-');
    return `<th class="r">${nom[parseInt(mo) - 1]} ${y}</th>`;
  }).join('');

  let html = `<thead><tr><th>Concepto</th>${colHeaders}</tr></thead><tbody>`;
  filas.forEach(f => {
    html += `<tr><td>${f.label}</td>`;
    meses.forEach(mes => {
      const v = getSum(f.tipos, mes) * f.sign;
      html += `<td class="r ${v < 0 ? 'neg-text' : 'muted-text'}">$ ${fmt(Math.abs(v))}</td>`;
    });
    html += '</tr>';
  });

  const flujos = meses.map(mes => getSum(['Ingreso'], mes) - getSum(['Egreso', 'Tarjeta de crédito'], mes));
  html += '<tr class="er-subtotal"><td>Flujo neto del mes</td>';
  flujos.forEach(v => { html += `<td class="r ${v < 0 ? 'neg-text' : 'pos-text'}">$ ${fmt(v)}</td>`; });
  html += '</tr><tr class="er-total"><td>Saldo acumulado</td>';
  let acum = 0;
  flujos.forEach(v => { acum += v; html += `<td class="r">$ ${fmt(acum)}</td>`; });
  html += '</tr></tbody>';
  getEl('flujo-table').innerHTML = html;

  const totalIng = movsFiltrados.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const totalEg = movsFiltrados.filter(m => m.tipo === 'Egreso' || m.tipo === 'Tarjeta de crédito').reduce((s, m) => s + (m.monto || 0), 0);
  getEl('flujo-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos acum.</div><div class="stat-value pos">$ ${fmt(totalIng)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos acum.</div><div class="stat-value neg">$ ${fmt(totalEg)}</div></div>
    <div class="stat-card"><div class="stat-label">Posición neta</div><div class="stat-value ${acum >= 0 ? 'pos' : 'neg'}">$ ${fmt(acum)}</div></div>
    <div class="stat-card"><div class="stat-label">Meses analizados</div><div class="stat-value">${meses.length}</div></div>
  `;
}

// ============================================================
// MÓDULO: ASIENTOS CONTABLES
// ============================================================

async function openModalAsiento(id) {
  if (!empresas.length) await loadEmpresas();

  editAsientoId = id || null;
  getEl('mas-title').textContent = editAsientoId ? 'Editar asiento' : 'Nuevo asiento';
  getEl('mas-error').textContent = '';

  if (editAsientoId) {
    const a = asientos.find(x => x.id === editAsientoId);
    setVal('mas-fecha', a.fecha || '');
    setVal('mas-desc', a.descripcion || '');
    setVal('mas-doc', a.documento || '');
    setVal('mas-obs', a.observaciones || '');
    renderLineas(a.asiento_lineas || []);
  } else {
    setVal('mas-fecha', new Date().toISOString().split('T')[0]);
    setVal('mas-desc', ''); setVal('mas-doc', ''); setVal('mas-obs', '');
    renderLineas([
      { cuenta_id: '', debe: '', haber: '' },
      { cuenta_id: '', debe: '', haber: '' },
    ]);
  }

  populateEmpresasDatalist();
  getEl('modal-asiento').classList.remove('hidden');

  setTimeout(() => {
    setupEmpresaAutocomplete(getEl('mas-empresa-input'), getEl('empresa-dropdown'));
  }, 0);
}

function closeModalAsiento() { getEl('modal-asiento').classList.add('hidden'); }
getEl('mas-close').addEventListener('click', closeModalAsiento);
getEl('mas-cancelar').addEventListener('click', closeModalAsiento);
getEl('mas-add-linea').addEventListener('click', () => {
  const lineas = getLineasActuales();
  lineas.push({ cuenta_id: '', debe: '', haber: '' });
  renderLineas(lineas);
});

function renderLineas(lineas) {
  const cont = getEl('mas-lineas');
  cont.innerHTML = lineas.map((l, i) => `
    <div class="linea-row" data-i="${i}" style="display:flex;gap:8px;margin-bottom:6px">
      <div style="position:relative;flex:2">
        <input type="text" class="linea-cuenta-input" placeholder="Buscar cuenta..."
               value="${l.cuenta_nombre || ''}" autocomplete="off" style="width:100%">
        <div class="cuenta-dropdown dropdown"></div>
      </div>
      <input type="number" class="linea-debe" placeholder="Debe" value="${l.debe || ''}" step="0.01" style="flex:1">
      <input type="number" class="linea-haber" placeholder="Haber" value="${l.haber || ''}" step="0.01" style="flex:1">
      <button onclick="eliminarLinea(${i})">✕</button>
    </div>
  `).join('');

  cont.querySelectorAll('.linea-row').forEach(row => {
    setupCuentaAutocomplete(row);
  });

  cont.querySelectorAll('input').forEach(i => i.addEventListener('input', updateTotales));
  updateTotales();
}

function eliminarLinea(i) {
  const lineas = getLineasActuales();
  if (lineas.length <= 2) return;
  lineas.splice(i, 1);
  renderLineas(lineas);
}

function getLineasActuales() {
  return [...getEl('mas-lineas').querySelectorAll('.linea-row')].map(row => {
    const cuentaInput = row.querySelector('.linea-cuenta-input');
    return {
      cuenta_id: cuentaInput?.dataset.id || '',
      cuenta_nombre: cuentaInput?.value || '',
      debe: parseFloat(row.querySelector('.linea-debe')?.value) || 0,
      haber: parseFloat(row.querySelector('.linea-haber')?.value) || 0,
    };
  });
}

function updateTotales() {
  const lineas = getLineasActuales();
  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;
  getEl('mas-total-debe').textContent = '$ ' + fmt(totalDebe);
  getEl('mas-total-haber').textContent = '$ ' + fmt(totalHaber);
  const el = getEl('mas-balance');
  el.textContent = cuadra ? '✓ Cuadra' : '✗ No cuadra';
  el.className = cuadra ? 'balance-ok' : 'balance-err';
}

getEl('mas-guardar').addEventListener('click', async () => {
  const err = getEl('mas-error');
  err.textContent = '';
  const fecha = getVal('mas-fecha');
  const desc = getVal('mas-desc').trim();
  if (!fecha || !desc) { err.textContent = 'Fecha y descripción son obligatorios.'; return; }

  const lineas = getLineasActuales().filter(l => l.cuenta_id);
  if (lineas.length < 2) { err.textContent = 'Necesitás al menos 2 líneas con cuenta seleccionada.'; return; }

  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
  if (Math.abs(totalDebe - totalHaber) >= 0.01) { err.textContent = 'El asiento no cuadra. Debe = Haber.'; return; }

  try {
    const { data: { user } } = await sb.auth.getUser();
    const empresaNombre = getEl('mas-empresa-input')?.value || '';
    const empresaObj = empresas.find(e => e.nombre.toLowerCase() === empresaNombre.toLowerCase());

    const asientoData = {
      fecha, descripcion: desc,
      empresa_id: empresaObj?.id || null,
      documento: getVal('mas-doc') || null,
      observaciones: getVal('mas-obs') || null,
    };

    let asientoId;
    if (editAsientoId) {
      await sb.from('asientos').update(asientoData).eq('id', editAsientoId);
      await sb.from('asiento_lineas').delete().eq('asiento_id', editAsientoId);
      asientoId = editAsientoId;
    } else {
      const { data } = await sb.from('asientos').insert({ ...asientoData, user_id: user.id }).select().single();
      asientoId = data.id;
    }

    await sb.from('asiento_lineas').insert(lineas.map(l => ({ asiento_id: asientoId, ...l })));
    closeModalAsiento();
    await loadAsientos();
    showToast(editAsientoId ? '✓ Asiento actualizado.' : '✓ Asiento registrado.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

function renderAsientos() {
  const tbody = getEl('asientos-body');
  if (!tbody) return;
  if (!asientos.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Sin asientos.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = asientos.map(a => {
    const totalDebe = (a.asiento_lineas || []).reduce((s, l) => s + (l.debe || 0), 0);
    const empresa = empresas.find(e => e.id === a.empresa_id);
    return `<tr>
      <td style="white-space:nowrap;font-family:var(--mono);font-size:12px;color:var(--text-muted)">${a.fecha || ''}</td>
      <td style="font-weight:500">${a.descripcion}</td>
      <td class="muted-text">${empresa?.nombre || '—'}</td>
      <td class="r" style="font-family:var(--mono)">$ ${fmt(totalDebe)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm" onclick="verAsiento('${a.id}')">Ver</button>
        <button class="btn btn-sm" onclick="openModalAsiento('${a.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarAsiento('${a.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

function verAsiento(id) {
  const a = asientos.find(x => x.id === id);
  if (!a) return;
  const empresa = empresas.find(e => e.id === a.empresa_id);
  const lineas = a.asiento_lineas || [];
  let html = `<strong>${a.fecha} — ${a.descripcion}</strong>`;
  if (empresa) html += ` <span class="muted-text">(${empresa.nombre})</span>`;
  html += `<table style="width:100%;margin-top:12px;font-size:13px">
    <thead><tr><th>Cuenta</th><th class="r">Debe</th><th class="r">Haber</th></tr></thead>
    <tbody>
    ${lineas.map(l => `<tr>
      <td>${l.cuenta_nombre}</td>
      <td class="r ${l.debe > 0 ? 'pos-text' : 'muted-text'}">${l.debe > 0 ? '$ ' + fmt(l.debe) : '—'}</td>
      <td class="r ${l.haber > 0 ? 'neg-text' : 'muted-text'}">${l.haber > 0 ? '$ ' + fmt(l.haber) : '—'}</td>
    </tr>`).join('')}
    </tbody></table>`;
  getEl('detalle-content').innerHTML = html;
  getEl('modal-detalle').classList.remove('hidden');
}

async function eliminarAsiento(id) {
  const ok = await confirmarEliminar('¿Eliminar este asiento y todas sus líneas?');
  if (!ok) return;
  await sb.from('asientos').delete().eq('id', id);
  await loadAsientos();
  showToast('✓ Asiento eliminado.', 'info');
}

getEl('detalle-close').addEventListener('click', () => {
  getEl('modal-detalle').classList.add('hidden');
});

// ============================================================
// MÓDULO: SALDOS POR CUENTA
// ============================================================

async function renderSaldos() {
  await loadAsientos();
  const tbody = getEl('saldos-body');
  if (!tbody) return;

  const saldoMap = {};
  asientos.forEach(a => {
    (a.asiento_lineas || []).forEach(l => {
      if (!saldoMap[l.cuenta_nombre]) saldoMap[l.cuenta_nombre] = { debe: 0, haber: 0, cuenta_id: l.cuenta_id };
      saldoMap[l.cuenta_nombre].debe += l.debe || 0;
      saldoMap[l.cuenta_nombre].haber += l.haber || 0;
    });
  });

  const rows = Object.entries(saldoMap).map(([nombre, v]) => {
    const cuenta = cuentas.find(c => c.id === v.cuenta_id);
    return { nombre, codigo: cuenta?.codigo || '', tipo: cuenta?.tipo || '', debe: v.debe, haber: v.haber, saldo: v.debe - v.haber };
  }).sort((a, b) => a.codigo.localeCompare(b.codigo));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Sin movimientos contables todavía.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${r.codigo}</td>
      <td style="font-weight:500">${r.nombre}</td>
      <td class="r muted-text">$ ${fmt(r.debe)}</td>
      <td class="r muted-text">$ ${fmt(r.haber)}</td>
      <td class="r" style="font-weight:500;font-family:var(--mono)">
        <span class="${r.saldo >= 0 ? 'pos-text' : 'neg-text'}">$ ${fmt(Math.abs(r.saldo))}</span>
      </td>
    </tr>
  `).join('');
}

// ============================================================
// MÓDULO: INVERSIONES
// ============================================================

function calcularSaldoConIntereses(inv) {
  if (!inv.tna || inv.estado !== 'Activa') return inv.saldo_actual;
  const hoy = new Date();
  const inicio = new Date(inv.fecha_inicio);
  const dias = Math.max(0, Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24)));
  return inv.saldo_actual + inv.saldo_actual * (inv.tna / 100) * (dias / 365);
}

function calcularInteresesAcumulados(inv) {
  return calcularSaldoConIntereses(inv) - inv.saldo_actual;
}

function openModalInversion(id) {
  editInvId = id || null;
  getEl('mi-title').textContent = editInvId ? 'Editar inversión' : 'Nueva inversión';
  getEl('mi-error').textContent = '';

  if (editInvId) {
    const inv = inversiones.find(x => x.id === editInvId);
    setVal('mi-nombre', inv.nombre || ''); setVal('mi-tipo', inv.tipo || 'FCI');
    setVal('mi-entidad', inv.entidad || ''); setVal('mi-moneda', inv.moneda || 'ARS');
    setVal('mi-tna', inv.tna || ''); setVal('mi-inicio', inv.fecha_inicio || '');
    setVal('mi-venc', inv.fecha_vencimiento || ''); setVal('mi-monto', inv.monto_inicial || '');
    setVal('mi-saldo', inv.saldo_actual || ''); setVal('mi-estado', inv.estado || 'Activa');
    setVal('mi-obs', inv.observaciones || '');
  } else {
    ['mi-nombre', 'mi-entidad', 'mi-tna', 'mi-venc', 'mi-obs', 'mi-monto', 'mi-saldo'].forEach(id => setVal(id, ''));
    setVal('mi-tipo', 'FCI'); setVal('mi-moneda', 'ARS'); setVal('mi-estado', 'Activa');
    setVal('mi-inicio', new Date().toISOString().split('T')[0]);
  }
  getEl('modal-inversion').classList.remove('hidden');
}

function closeModalInversion() { getEl('modal-inversion').classList.add('hidden'); }
getEl('mi-close').addEventListener('click', closeModalInversion);
getEl('mi-cancelar').addEventListener('click', closeModalInversion);

getEl('mi-guardar').addEventListener('click', async () => {
  const err = getEl('mi-error');
  err.textContent = '';
  const nombre = getVal('mi-nombre').trim();
  const inicio = getVal('mi-inicio');
  const monto = getVal('mi-monto');
  if (!nombre || !inicio || !monto) { err.textContent = 'Nombre, fecha de inicio y monto son obligatorios.'; return; }

  const montoNum = parseFloat(monto) || 0;
  const saldoNum = parseFloat(getVal('mi-saldo')) || montoNum;
  const data = {
    nombre, tipo: getVal('mi-tipo'), entidad: getVal('mi-entidad') || null,
    moneda: getVal('mi-moneda'), tna: parseFloat(getVal('mi-tna')) || null,
    fecha_inicio: inicio, fecha_vencimiento: getVal('mi-venc') || null,
    monto_inicial: montoNum, saldo_actual: saldoNum,
    estado: getVal('mi-estado'), observaciones: getVal('mi-obs') || null,
  };

  try {
    if (editInvId) {
      await sb.from('inversiones').update(data).eq('id', editInvId);
    } else {
      const { data: { user } } = await sb.auth.getUser();
      const { data: inv } = await sb.from('inversiones').insert({ ...data, user_id: user.id }).select().single();
      await sb.from('inversion_movimientos').insert({
        inversion_id: inv.id, fecha: inicio, tipo: 'Suscripción', monto: montoNum, saldo_post: montoNum,
      });
    }
    closeModalInversion();
    await loadInversiones();
    showToast(editInvId ? '✓ Inversión actualizada.' : '✓ Inversión registrada.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

function openModalMovInversion(invId) {
  setVal('mim-inv-id', invId);
  getEl('mim-error').textContent = '';
  setVal('mim-tipo', 'Suscripción'); setVal('mim-monto', '');
  setVal('mim-fecha', new Date().toISOString().split('T')[0]);
  setVal('mim-obs', '');
  getEl('modal-mov-inversion').classList.remove('hidden');
}

function closeModalMovInversion() { getEl('modal-mov-inversion').classList.add('hidden'); }
getEl('mim-close').addEventListener('click', closeModalMovInversion);
getEl('mim-cancelar').addEventListener('click', closeModalMovInversion);

getEl('mim-guardar').addEventListener('click', async () => {
  const err = getEl('mim-error');
  err.textContent = '';
  const invId = getVal('mim-inv-id');
  const tipo = getVal('mim-tipo');
  const monto = parseFloat(getVal('mim-monto')) || 0;
  const fecha = getVal('mim-fecha');
  if (!monto || !fecha) { err.textContent = 'Monto y fecha son obligatorios.'; return; }

  const inv = inversiones.find(x => x.id === invId);
  let nuevoSaldo = inv.saldo_actual;
  if (tipo === 'Suscripción') nuevoSaldo += monto;
  else if (tipo === 'Rescate') nuevoSaldo -= monto;
  else if (tipo === 'Actualización manual') nuevoSaldo = monto;
  if (nuevoSaldo < 0) { err.textContent = 'El rescate supera el saldo disponible.'; return; }

  try {
    await sb.from('inversion_movimientos').insert({
      inversion_id: invId, fecha, tipo, monto, saldo_post: nuevoSaldo,
      observaciones: getVal('mim-obs') || null,
    });
    await sb.from('inversiones').update({
      saldo_actual: nuevoSaldo, estado: nuevoSaldo <= 0 ? 'Rescatada' : 'Activa',
    }).eq('id', invId);
    closeModalMovInversion();
    await loadInversiones();
    showToast('✓ Movimiento registrado.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

function verInversion(id) {
  const inv = inversiones.find(x => x.id === id);
  if (!inv) return;
  const saldoConIntereses = calcularSaldoConIntereses(inv);
  const intereses = calcularInteresesAcumulados(inv);
  const moneda = inv.moneda === 'USD' ? 'U$S' : '$';
  const movs = (inv.inversion_movimientos || []).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.25rem">
      <div class="stat-card"><div class="stat-label">Saldo actual</div><div class="stat-value">${moneda} ${fmt(inv.saldo_actual)}</div></div>
      <div class="stat-card"><div class="stat-label">Intereses acumulados (est.)</div><div class="stat-value pos">+ ${moneda} ${fmt(intereses)}</div></div>
      <div class="stat-card"><div class="stat-label">Saldo + intereses</div><div class="stat-value pos">${moneda} ${fmt(saldoConIntereses)}</div></div>
      <div class="stat-card"><div class="stat-label">TNA</div><div class="stat-value">${inv.tna ? inv.tna + '%' : '—'}</div></div>
    </div>
    <table style="width:100%;font-size:13px">
      <thead><tr><th>Fecha</th><th>Tipo</th><th class="r">Monto</th><th class="r">Saldo post</th></tr></thead>
      <tbody>
        ${movs.map(m => `<tr>
          <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${m.fecha}</td>
          <td><span class="badge ${m.tipo === 'Rescate' ? 'b-eg' : 'b-ing'}">${m.tipo}</span></td>
          <td class="r" style="font-family:var(--mono)">${moneda} ${fmt(m.monto)}</td>
          <td class="r" style="font-family:var(--mono)">${moneda} ${fmt(m.saldo_post)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  getEl('detalle-content').innerHTML = html;
  getEl('modal-detalle').classList.remove('hidden');
}

function renderInversiones() {
  const tbody = getEl('inversiones-body');
  if (!tbody) return;

  const totalActivo = inversiones.filter(i => i.estado === 'Activa').reduce((s, i) => s + calcularSaldoConIntereses(i), 0);
  getEl('inv-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total invertido activo</div><div class="stat-value pos">$ ${fmt(totalActivo)}</div></div>
    <div class="stat-card"><div class="stat-label">Inversiones activas</div><div class="stat-value">${inversiones.filter(i => i.estado === 'Activa').length}</div></div>
    <div class="stat-card"><div class="stat-label">Total inversiones</div><div class="stat-value">${inversiones.length}</div></div>
  `;

  if (!inversiones.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Sin inversiones.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = inversiones.map(inv => {
    const saldoEst = calcularSaldoConIntereses(inv);
    const intereses = calcularInteresesAcumulados(inv);
    const moneda = inv.moneda === 'USD' ? 'U$S' : '$';
    const estadoBadge = inv.estado === 'Activa' ? 'b-ing' : inv.estado === 'Rescatada' ? 'b-eg' : 'b-tar';
    return `<tr>
      <td style="font-weight:500">${inv.nombre}</td>
      <td><span class="badge b-inv">${inv.tipo}</span></td>
      <td class="muted-text">${inv.entidad || '—'}</td>
      <td class="r" style="font-family:var(--mono)">${moneda} ${fmt(inv.saldo_actual)}</td>
      <td class="r pos-text" style="font-family:var(--mono)">${intereses > 0 ? '+ ' + moneda + ' ' + fmt(intereses) : '—'}</td>
      <td><span class="badge ${estadoBadge}">${inv.estado}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm" onclick="verInversion('${inv.id}')">Ver</button>
        <button class="btn btn-sm" onclick="openModalMovInversion('${inv.id}')">Movimiento</button>
        <button class="btn btn-sm" onclick="openModalInversion('${inv.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarInversion('${inv.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

async function eliminarInversion(id) {
  const ok = await confirmarEliminar('¿Eliminar esta inversión?');
  if (!ok) return;
  await sb.from('inversiones').delete().eq('id', id);
  await loadInversiones();
  showToast('✓ Inversión eliminada.', 'info');
}

// ============================================================
// MÓDULO: CUENTAS CORRIENTES & ASIENTO COMPROBANTE
// ============================================================

async function generarAsientoComprobante({ userId, movId, fecha, detalle, tipo, concepto, lineas, totalNeto, totalIva, total, empresaObj, cancelId, cancelNombre }) {
  const ctaACobrar = cuentas.find(c => c.nombre === 'Cuentas a cobrar');
  const ctaAPagar = cuentas.find(c => c.nombre === 'Cuentas a pagar');
  const ctaIvaDB = cuentas.find(c => c.nombre === 'IVA Débito Fiscal');
  const ctaIvaCR = cuentas.find(c => c.nombre === 'IVA Crédito Fiscal');

  let asientoLineas = [];

  if (tipo === 'Ingreso') {
    const cuentaDebe = cancelId ? { id: cancelId, nombre: cancelNombre } : { id: ctaACobrar?.id, nombre: 'Cuentas a cobrar' };
    asientoLineas.push({ cuenta_id: cuentaDebe.id || null, cuenta_nombre: cuentaDebe.nombre, debe: total, haber: 0 });
    lineas.forEach(l => asientoLineas.push({ cuenta_id: l.cuenta_id || null, cuenta_nombre: l.cuenta_nombre, debe: 0, haber: l.monto_neto }));
    if (totalIva > 0) asientoLineas.push({ cuenta_id: ctaIvaDB?.id || null, cuenta_nombre: 'IVA Débito Fiscal', debe: 0, haber: totalIva });
  } else if (tipo === 'Egreso') {
    lineas.forEach(l => asientoLineas.push({ cuenta_id: l.cuenta_id || null, cuenta_nombre: l.cuenta_nombre, debe: l.monto_neto, haber: 0 }));
    if (totalIva > 0) asientoLineas.push({ cuenta_id: ctaIvaCR?.id || null, cuenta_nombre: 'IVA Crédito Fiscal', debe: totalIva, haber: 0 });
    const cuentaHaber = cancelId ? { id: cancelId, nombre: cancelNombre } : { id: ctaAPagar?.id, nombre: 'Cuentas a pagar' };
    asientoLineas.push({ cuenta_id: cuentaHaber.id || null, cuenta_nombre: cuentaHaber.nombre, debe: 0, haber: total });
  }

  const { data: asiento } = await sb.from('asientos').insert({
    user_id: userId, fecha,
    descripcion: `${tipo} — ${detalle}${empresaObj ? ' (' + empresaObj.nombre + ')' : ''}`,
    empresa_id: empresaObj?.id || null,
  }).select().single();

  await sb.from('asiento_lineas').insert(asientoLineas.map(l => ({ ...l, asiento_id: asiento.id })));
  await sb.from('movimientos').update({ asiento_id: asiento.id }).eq('id', movId);

  // Cuenta corriente
  if (empresaObj) {
    const ccMovs = cuentasCorrientes.filter(c => c.empresa_id === empresaObj.id);
    const saldoAnterior = ccMovs.reduce((s, c) => s + (c.debe || 0) - (c.haber || 0), 0);

    let debe = 0, haber = 0;
    if (tipo === 'Ingreso') {
      if (!concepto || concepto === 'factura_emitida' || concepto === 'nota_debito_emitida') debe = total;
      else if (concepto === 'nota_credito_emitida') haber = total;
    } else if (tipo === 'Egreso') {
      if (!concepto || concepto === 'factura_recibida' || concepto === 'nota_debito_recibida') haber = total;
      else if (concepto === 'nota_credito_recibida') debe = total;
    } else if (tipo === 'Cobro') {
      haber = total;
    } else if (tipo === 'Pago') {
      debe = total;
    }

    if (debe > 0 || haber > 0) {
      await sb.from('cuentas_corrientes').insert({
        user_id: userId, empresa_id: empresaObj.id, movimiento_id: movId,
        fecha, descripcion: detalle, debe, haber, saldo: saldoAnterior + debe - haber,
      });
    }
  }
}

// ── Cobrar / Pagar ──

function openModalCobrarPagar(empresaId) {
  const emp = empresas.find(e => e.id === empresaId);
  const saldo = getSaldoEmpresa(empresaId);
  setVal('cp-empresa-id', empresaId);
  getEl('cp-empresa-nombre').textContent = emp?.nombre || '';
  getEl('cp-saldo-actual').textContent = (saldo >= 0 ? 'Nos debe: $ ' : 'Les debemos: $ ') + fmt(Math.abs(saldo));
  getEl('cp-saldo-actual').className = saldo >= 0 ? 'pos-text' : 'neg-text';
  setVal('cp-tipo', saldo >= 0 ? 'Cobro' : 'Pago');
  setVal('cp-monto', fmt(Math.abs(saldo)).replace(/\./g, ''));
  setVal('cp-fecha', new Date().toISOString().split('T')[0]);
  setVal('cp-cuenta', ''); setVal('cp-obs', '');
  getEl('cp-error').textContent = '';
  populateCpCuentaSelect();
  getEl('modal-cobrar-pagar').classList.remove('hidden');
}

function closeModalCobrarPagar() { getEl('modal-cobrar-pagar').classList.add('hidden'); }
getEl('cp-close').addEventListener('click', closeModalCobrarPagar);
getEl('cp-cancelar').addEventListener('click', closeModalCobrarPagar);

getEl('cp-guardar').addEventListener('click', async () => {
  const err = getEl('cp-error');
  err.textContent = '';
  const empresaId = getVal('cp-empresa-id');
  const tipo = getVal('cp-tipo');
  const monto = parseFloat(getVal('cp-monto')) || 0;
  const fecha = getVal('cp-fecha');
  const cuentaVal = getVal('cp-cuenta');
  if (!monto || !fecha || !cuentaVal) { err.textContent = 'Completá todos los campos.'; return; }

  const [cuentaId, cuentaNombre] = cuentaVal.split('|');
  const emp = empresas.find(e => e.id === empresaId);
  const saldoActual = getSaldoEmpresa(empresaId);
  const ctaACobrar = cuentas.find(c => c.nombre === 'Cuentas a cobrar');
  const ctaAPagar = cuentas.find(c => c.nombre === 'Cuentas a pagar');

  const lineas = tipo === 'Cobro'
    ? [{ cuenta_id: cuentaId, cuenta_nombre: cuentaNombre, debe: monto, haber: 0 },
    { cuenta_id: ctaACobrar?.id || null, cuenta_nombre: 'Cuentas a cobrar', debe: 0, haber: monto }]
    : [{ cuenta_id: ctaAPagar?.id || null, cuenta_nombre: 'Cuentas a pagar', debe: monto, haber: 0 },
    { cuenta_id: cuentaId, cuenta_nombre: cuentaNombre, debe: 0, haber: monto }];

  try {
    const { data: { user } } = await sb.auth.getUser();
    const desc = `${tipo} — ${emp?.nombre || ''} — $ ${fmt(monto)}`;
    const { data: asiento } = await sb.from('asientos').insert({
      user_id: user.id, fecha, descripcion: desc, empresa_id: empresaId,
      observaciones: getVal('cp-obs') || null,
    }).select().single();

    await sb.from('asiento_lineas').insert(lineas.map(l => ({ ...l, asiento_id: asiento.id })));

    const debe = tipo === 'Pago' ? monto : 0;
    const haber = tipo === 'Cobro' ? monto : 0;
    await sb.from('cuentas_corrientes').insert({
      user_id: user.id, empresa_id: empresaId, fecha, descripcion: desc,
      debe, haber, saldo: saldoActual - haber + debe,
    });

    await sb.from('movimientos').insert({
      user_id: user.id, fecha,
      tipo: tipo === 'Cobro' ? 'Ingreso' : 'Egreso',
      detalle: desc, empresa: emp?.nombre || null,
      empresa_id: empresaId, monto, asiento_id: asiento.id,
    });

    closeModalCobrarPagar();
    await loadMovimientos();
    await loadCuentasCorrientes();
    await loadAsientos();
    showToast('✓ Cobro/pago registrado.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

// ============================================================
// MÓDULO: UX GLOBAL (MODALES, ESC, SCROLL, AUTOFOCUS)
// ============================================================

function mostrarConfirmacion(mensaje) {
  return new Promise(resolve => {
    const modal = getEl('modal-confirm');
    getEl('mc-texto').innerHTML = mensaje;
    modal.classList.remove('hidden');

    const limpiar = () => {
      modal.classList.add('hidden');
      getEl('mc-confirmar').onclick = null;
      getEl('mc-cancelar-confirm').onclick = null;
    };
    getEl('mc-confirmar').onclick = () => { limpiar(); resolve(true); };
    getEl('mc-cancelar-confirm').onclick = () => { limpiar(); resolve(false); };
  });
}

async function confirmarEliminar(mensaje) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;z-index:10000`;
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
        width:360px;max-width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.15);overflow:hidden">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border)">
          <p style="font-size:15px;font-weight:500;color:var(--text)">Confirmar eliminación</p>
        </div>
        <div style="padding:1rem 1.5rem">
          <p style="font-size:13px;color:var(--text-muted);line-height:1.5">${mensaje}</p>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:1rem 1.5rem;border-top:1px solid var(--border)">
          <button class="btn btn-ghost" id="_del-cancel">Cancelar</button>
          <button class="btn btn-primary" id="_del-ok" style="background:#e74c3c">Eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = result => { overlay.remove(); resolve(result); };
    overlay.querySelector('#_del-ok').onclick = () => cleanup(true);
    overlay.querySelector('#_del-cancel').onclick = () => cleanup(false);
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); cleanup(false); }
    });
  });
}

// Mapa de modales
const MODALES = [
  { id: 'modal-overlay', close: closeModal },
  { id: 'modal-empresa', close: closeModalEmpresa },
  { id: 'modal-cuenta', close: closeModalCuenta },
  { id: 'modal-asiento', close: closeModalAsiento },
  { id: 'modal-detalle', close: () => getEl('modal-detalle').classList.add('hidden') },
  { id: 'modal-inversion', close: closeModalInversion },
  { id: 'modal-mov-inversion', close: closeModalMovInversion },
  { id: 'modal-cobrar-pagar', close: closeModalCobrarPagar },
  { id: 'modal-confirm', close: () => getEl('modal-confirm').classList.add('hidden') },
];

// Click fuera del modal
MODALES.forEach(({ id, close }) => {
  const el = getEl(id);
  if (!el) return;
  el.addEventListener('click', e => { if (e.target === el) close(); });
});

// ESC cierra el último modal abierto
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const abierto = [...MODALES].reverse().find(({ id }) => {
    const el = getEl(id);
    return el && !el.classList.contains('hidden');
  });
  abierto?.close();
});

// Bloquear scroll cuando hay modal abierto
const scrollObserver = new MutationObserver(() => {
  const hayModal = MODALES.some(({ id }) => {
    const el = getEl(id);
    return el && !el.classList.contains('hidden');
  });
  document.body.style.overflow = hayModal ? 'hidden' : '';
});
MODALES.forEach(({ id }) => {
  const el = getEl(id);
  if (el) scrollObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});

// Autofocus al abrir modales
const autoFocusMap = {
  'modal-overlay': 'f-detalle',
  'modal-empresa': 'me-nombre',
  'modal-cuenta': 'mc-codigo',
  'modal-asiento': 'mas-desc',
  'modal-inversion': 'mi-nombre',
  'modal-mov-inversion': 'mim-monto',
  'modal-cobrar-pagar': 'cp-monto',
};

const focusObserver = new MutationObserver(mutations => {
  mutations.forEach(({ target }) => {
    const id = target.id;
    if (!target.classList.contains('hidden') && autoFocusMap[id]) {
      setTimeout(() => getEl(autoFocusMap[id])?.focus(), 50);
    }
  });
});
Object.keys(autoFocusMap).forEach(id => {
  const el = getEl(id);
  if (el) focusObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});

// ── INIT ──
checkSession();