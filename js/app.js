const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let movimientos = [], empresas = [], cuentas = [], editId = null;

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function checkSession() {
  const hash = window.location.hash;
  if (hash && hash.includes('type=signup')) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { showApp(session.user); showSuccessBanner('✓ Cuenta confirmada. ¡Bienvenido!'); window.history.replaceState(null, '', window.location.pathname); return; }
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp(session.user); else showLogin();
}

function showSuccessBanner(msg) { showToast(msg, 'success'); }

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

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email-display').textContent = user.email;
  loadAll().then(async () => {
    // await initCuentasPredefinidas();
    // await agregarCuentasIVASiFaltan();
  });
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Completá email y contraseña.'; return; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { err.textContent = error.message; return; }
  showApp(data.user);
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Completá email y contraseña.'; return; }
  if (pass.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
  const { error } = await sb.auth.signUp({ email, password: pass });
  if (error) { err.textContent = error.message; return; }
  err.style.color = 'var(--green)'; err.textContent = 'Cuenta creada. Revisá tu email para confirmar.';
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut(); showLogin();
});

// ── NAV ───────────────────────────────────────────────────────────────────────
const titles = { movimientos: 'Movimientos', er: 'Estado de resultados', flujo: 'Flujo de fondos', empresas: 'Empresas', cuentas: 'Plan de cuentas', asientos: 'Asientos contables', saldos: 'Saldos por cuenta', inversiones: 'Inversiones' };

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('page-title').textContent = titles[page];
    const btnNuevo = document.getElementById('btn-nuevo');
    btnNuevo.textContent = page === 'empresas' ? '+ Nueva empresa' : page === 'cuentas' ? '+ Nueva cuenta' : page === 'asientos' ? '+ Nuevo asiento' : page === 'inversiones' ? '+ Nueva inversión' : '+ Nuevo movimiento'; btnNuevo.dataset.context = page;
    if (page === 'er') renderER();
    if (page === 'flujo') renderFlujo();
    if (page === 'empresas') renderEmpresas();
    if (page === 'cuentas') renderCuentas();
    if (page === 'asientos') loadAsientos();
    if (page === 'saldos') renderSaldos();
    if (page === 'inversiones') loadInversiones();
  });
});

document.getElementById('btn-nuevo').addEventListener('click', () => {
  const ctx = document.getElementById('btn-nuevo').dataset.context || 'movimientos';
  if (ctx === 'empresas') openModalEmpresa();
  else if (ctx === 'cuentas') openModalCuenta();
  else if (ctx === 'asientos') openModalAsiento();
  else if (ctx === 'inversiones') openModalInversion();
  else openModal();
});

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadMovimientos(), loadEmpresas(), loadCuentas(), loadCuentasCorrientes()]);
}

async function loadMovimientos() {
  const { data } = await sb.from('movimientos').select('*').order('fecha', { ascending: false });
  movimientos = data || []; renderAll();
}

async function loadEmpresas() {
  const { data } = await sb.from('empresas').select('*').order('nombre');
  empresas = data || []; populateEmpresaSelect();
}

async function loadCuentas() {
  const { data } = await sb.from('cuentas').select('*').order('codigo');
  cuentas = data || [];
}

function populateEmpresaSelect() {
  const sel = document.getElementById('f-empresa-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Sin empresa</option>';
  empresas.forEach(e => { sel.innerHTML += `<option value="${e.id}">${e.nombre}${e.cuit ? ' — ' + e.cuit : ''}</option>`; });
  sel.value = cur;
}

function populateCuentaSelect() {
  const sel = document.getElementById('f-cuenta');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Sin clasificar</option>';
  cuentas.forEach(c => {
    sel.innerHTML += `<option value="${c.codigo} ${c.nombre}">${c.codigo} — ${c.nombre}</option>`;
  });
  sel.value = cur;
}

// ── FORMAT ────────────────────────────────────────────────────────────────────
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
  const map = { 'Ingreso': 'b-ing', 'Egreso': 'b-eg', 'Inversión': 'b-inv', 'Préstamo': 'b-inv', 'Tarjeta de crédito': 'b-tar', 'Banco': 'b-ban' };
  return 'badge ' + (map[tipo] || 'b-ing');
}

// ── MODAL MOVIMIENTO ──────────────────────────────────────────────────────────
// ── MODAL COMPROBANTE ─────────────────────────────────────────────────────────
let compLineas = [];

async function openModal(id) {
  if (!empresas.length) {
  await loadEmpresas();
}
  
  editId = id || null;
  compLineas = [];
  document.getElementById('modal-title').textContent = editId ? 'Editar comprobante' : 'Nuevo comprobante';


  document.getElementById('form-error').textContent = '';
  clearForm();
  populateEmpresaSelect();
  populateCuentaSelect();
  populateCancelacionSelect();




  if (editId) {
    const m = movimientos.find(x => x.id === editId);
    if (m) fillForm(m);

  } else {
    document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('f-tipo').value = 'Ingreso';
    actualizarConceptoSegunTipo();
    renderCompLineas([{ cuenta_id: '', cuenta_nombre: '', descripcion: '', monto_neto: 0, iva_porcentaje: 21, iva_monto: 0, total: 0 }]);
  }
  document.getElementById('modal-overlay').classList.remove('hidden');

setTimeout(() => {
  const input = document.getElementById('mov-empresa-input');
  const dropdown = document.getElementById('mov-empresa-dropdown');
  setupEmpresaAutocomplete(input, dropdown);
}, 0);
}


function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

function populateCancelacionSelect() {
  const sel = document.getElementById('f-cancelacion');
  if (!sel) return;
  sel.innerHTML = '<option value="">Queda pendiente (cta. a pagar/cobrar)</option>';
  cuentas.filter(c => c.tipo === 'Activo').forEach(c => {
    sel.innerHTML += `<option value="${c.id}|${c.nombre}">${c.codigo} — ${c.nombre}</option>`;
  });
}

function renderCompLineas(lineas) {
  compLineas = lineas;
  const cont = document.getElementById('comp-lineas');
  if (!cont) return;

  cont.innerHTML = lineas.map((l, i) => `
    <div class="linea-row comp-linea-row" data-i="${i}">

      <!-- CUENTA AUTOCOMPLETE -->
      <div style="position:relative;flex:2">
        <input class="cl-cuenta-input" 
               placeholder="Cuenta" 
               value="${l.cuenta_nombre || ''}">
        <div class="cl-cuenta-dropdown dropdown"></div>
      </div>

      <!-- DESCRIPCION -->
      <input type="text" 
             class="cl-desc" 
             placeholder="Descripción" 
             value="${l.descripcion || ''}" 
             style="flex:1.5;min-width:100px" 
             oninput="updateLinea(${i})">

      <!-- NETO -->
      <input type="number" 
             class="cl-neto" 
             placeholder="Neto" 
             value="${l.monto_neto || ''}" 
             step="0.01" 
             style="flex:1;min-width:80px" 
             oninput="calcularLinea(${i})">

      <!-- IVA -->
      <input type="number" 
             class="cl-iva" 
             placeholder="IVA%" 
             value="${l.iva_porcentaje || 0}" 
             step="0.01" 
             style="flex:0.6;min-width:60px" 
             oninput="calcularLinea(${i})">

      <!-- TOTAL -->
      <input type="number" 
             class="cl-total" 
             placeholder="Total" 
             value="${l.total || ''}" 
             step="0.01" 
             readonly 
             style="flex:1;min-width:80px;background:var(--bg)">

      <button class="btn btn-sm btn-del" onclick="eliminarCompLinea(${i})">✕</button>
    </div>
  `).join('');

  // 🔥 ACTIVAR AUTOCOMPLETE CUENTAS
  cont.querySelectorAll('.comp-linea-row').forEach(row => {
    const input = row.querySelector('.cl-cuenta-input');
    const dropdown = row.querySelector('.cl-cuenta-dropdown');

    if (!input || !dropdown) return;

    const index = parseInt(row.dataset.i); // 🔥 CLAVE

    input.addEventListener('input', () => {
      const val = input.value.toLowerCase();

      const results = cuentas.filter(c =>
        (c.tipo === 'Ingreso' || c.tipo === 'Egreso') &&
        (`${c.codigo} ${c.nombre}`).toLowerCase().includes(val)
      );

      dropdown.innerHTML = results.slice(0, 8).map(c =>
        `<div class="dropdown-item" data-id="${c.id}" data-nombre="${c.nombre}">
        ${c.codigo} — ${c.nombre}
      </div>`
      ).join('');

      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.onclick = () => {
          input.value = item.textContent;
          input.dataset.id = item.dataset.id;
          input.dataset.nombre = item.dataset.nombre;
          dropdown.innerHTML = '';

          updateLineaCuenta(index, input); // 🔥 ahora sí correcto
        };
      });
    });
  });

  actualizarTotalesComp();
}

function updateLineaCuenta(i, input) {
  const id = input.dataset.id;
  const nombre = input.dataset.nombre;

  if (!id) return;

  compLineas[i].cuenta_id = id;
  compLineas[i].cuenta_nombre = nombre;
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

  compLineas[i].monto_neto = neto;
  compLineas[i].iva_porcentaje = ivaPct;
  compLineas[i].iva_monto = ivaMonto;
  compLineas[i].total = total;

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
  const el = document.getElementById('comp-total');
  if (el) el.innerHTML = `
    <span class="muted-text">Neto: <strong>$ ${fmt(totalNeto)}</strong></span>
    <span class="muted-text">IVA: <strong>$ ${fmt(totalIva)}</strong></span>
    <span>Total: <strong style="font-size:15px">$ ${fmt(total)}</strong></span>
  `;
}

function clearForm() {
  ['fecha', 'detalle', 'doc', 'obs'].forEach(f => {
    const el = document.getElementById('f-' + f); if (el) el.value = '';
  });
  document.getElementById('f-tipo').value = 'Ingreso';
  const inp = document.getElementById('f-empresa-input');
  if (inp) {
    inp.value = '';
    delete inp.dataset.id;
  } const selC = document.getElementById('f-cancelacion'); if (selC) selC.value = '';
  compLineas = [];
}

function fillForm(m) {
  document.getElementById('f-fecha').value = m.fecha || '';
  document.getElementById('f-tipo').value = m.tipo || 'Ingreso';
  document.getElementById('f-detalle').value = m.detalle || '';
  document.getElementById('f-doc').value = m.documento || '';
  document.getElementById('f-obs').value = m.observaciones || '';
  const sel = document.getElementById('f-empresa-select');
  if (sel) sel.value = m.empresa_id || '';
  actualizarConceptoSegunTipo();
  const selConcepto = document.getElementById('f-concepto');
  if (selConcepto) selConcepto.value = m.concepto || '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancelar').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
document.getElementById('f-tipo').addEventListener('change', actualizarConceptoSegunTipo);
document.getElementById('comp-add-linea')?.addEventListener('click', () => {
  compLineas.push({ cuenta_id: '', cuenta_nombre: '', descripcion: '', monto_neto: 0, iva_porcentaje: 21, iva_monto: 0, total: 0 });
  renderCompLineas(compLineas);
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  const fecha = document.getElementById('f-fecha').value;
  const detalle = document.getElementById('f-detalle').value.trim();
  const tipo = document.getElementById('f-tipo').value;
  if (!fecha || !detalle) { errEl.textContent = 'Fecha y detalle son obligatorios.'; return; }
  const lineasValidas = compLineas.filter(l => l.monto_neto > 0);
  if (!lineasValidas.length) { errEl.textContent = 'Agregá al menos una línea con monto.'; return; }
  const empresaObj = empresaId ? empresas.find(e => e.id === empresaId) : null;
  const concepto = document.getElementById('f-concepto')?.value || null;
  const cancelVal = document.getElementById('f-cancelacion')?.value || '';
  const [cancelId, cancelNombre] = cancelVal ? cancelVal.split('|') : [null, null];

  const totalNeto = lineasValidas.reduce((s, l) => s + (l.monto_neto || 0), 0);
  const totalIva = lineasValidas.reduce((s, l) => s + (l.iva_monto || 0), 0);
  const total = lineasValidas.reduce((s, l) => s + (l.total || 0), 0);

  try {
    const { data: { user } } = await sb.auth.getUser();

    // Guardar en movimientos (para compatibilidad con tabla existente)
    const movData = {
      fecha, tipo, detalle,
      empresa: empresaObj?.nombre || null,
      empresa_id: empresaId,
      cuit: empresaObj?.cuit || null,
      monto: total,
      monto_neto: totalNeto,
      clasificacion: lineasValidas.map(l => l.cuenta_nombre).join(', '),
      documento: document.getElementById('f-doc').value || null,
      observaciones: document.getElementById('f-obs').value || null,
      concepto,
    };

    let movId;
    if (editId) {
      await sb.from('movimientos').update(movData).eq('id', editId);
      movId = editId;
    } else {
      const { data: newMov } = await sb.from('movimientos')
        .insert({ ...movData, user_id: user.id }).select().single();
      movId = newMov.id;
    }

    // Generar asiento automático con partida doble completa
    await generarAsientoComprobante({
      userId: user.id, movId, fecha, detalle, tipo, concepto,
      lineas: lineasValidas, totalNeto, totalIva, total,
      empresaObj, cancelId, cancelNombre,
    });

    closeModal();
    await loadMovimientos();
    await loadCuentasCorrientes();
    showSuccessBanner('✓ Comprobante registrado correctamente.');
  } catch (e) { errEl.textContent = 'Error al guardar: ' + e.message; }
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  const fecha = document.getElementById('f-fecha').value;
  const detalle = document.getElementById('f-detalle').value.trim();
  const monto = document.getElementById('f-monto').value;
  if (!fecha || !detalle || !monto) { errEl.textContent = 'Completá los campos obligatorios: Fecha, Detalle y Monto.'; return; }
  const empresaId = document.getElementById('f-empresa-select').value || null;
  const empresaObj = empresaId ? empresas.find(e => e.id === empresaId) : null;
  const tipo = document.getElementById('f-tipo').value;
  const montoNum = parseFloat(monto) || 0;

  const concepto = document.getElementById('f-concepto').value;
  const tipoReal = (concepto === 'cobro_efectivo' || concepto === 'pago_realizado')
    ? 'Banco'
    : tipo;

  const mov = {
    fecha, tipo: tipoReal, detalle,
    empresa: empresaObj ? empresaObj.nombre : null,
    empresa_id: empresaId,
    cuit: empresaObj ? empresaObj.cuit : null,
    monto: montoNum,
    monto_neto: parseFloat(document.getElementById('f-neto').value) || null,
    tipo_cambio: parseFloat(document.getElementById('f-tc').value) || null,
    usd: parseFloat(document.getElementById('f-usd').value) || null,
    clasificacion: document.getElementById('f-cuenta').value || null,
    documento: document.getElementById('f-doc').value || null,
    observaciones: document.getElementById('f-obs').value || null,
  };

  try {
    const { data: { user } } = await sb.auth.getUser();

    let movId;
    if (editId) {
      await sb.from('movimientos').update(mov).eq('id', editId);
      movId = editId;
    } else {
      const { data: newMov } = await sb.from('movimientos')
        .insert({ ...mov, user_id: user.id }).select().single();
      movId = newMov.id;

      // Generar asiento automático si tiene empresa
      if (empresaId && concepto) {
        const { data: { user } } = await sb.auth.getUser();
        await generarAsientoAutomatico({ movId, fecha, detalle, tipo, montoNum, empresaObj, userId: user.id, concepto });
      }
    }

    closeModal();
    await loadMovimientos();
    await loadCuentasCorrientes();
    showSuccessBanner('✓ Movimiento registrado correctamente.');

  } catch (e) { errEl.textContent = 'Error al guardar: ' + e.message; }
});

function actualizarConceptoSegunTipo() {
  const tipo = document.getElementById('f-tipo')?.value;
  const sel = document.getElementById('f-concepto');
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
    Cobro: [
      { value: 'cobro_efectivo', label: 'Cobro (cancela deuda del cliente)' },
    ],
    Pago: [
      { value: 'pago_realizado', label: 'Pago (cancela nuestra deuda con proveedor)' },
    ],
  };

  const lista = opciones[tipo] || [];
  sel.innerHTML = '<option value="">Sin impacto en cuenta corriente</option>';
  lista.forEach(o => { sel.innerHTML += `<option value="${o.value}">${o.label}</option>`; });

  // Para Cobro y Pago preseleccionar automáticamente
  if (tipo === 'Cobro') sel.value = 'cobro_efectivo';
  if (tipo === 'Pago') sel.value = 'pago_realizado';

  // Mostrar/ocultar sección de líneas según tipo
  const secLineas = document.getElementById('comp-lineas')?.closest('div[style]');
  const esCancelacion = tipo === 'Cobro' || tipo === 'Pago';
  if (secLineas) secLineas.style.display = esCancelacion ? 'none' : 'block';
}

document.getElementById('f-tipo').addEventListener('change', actualizarConceptoSegunTipo);

// ── MODAL EMPRESA ─────────────────────────────────────────────────────────────
const IVA_OPTS = ['', 'Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final'];

function renderEmpresaFilas(filas) {
  const cont = document.getElementById('me-filas');
  cont.innerHTML = filas.map((f, i) => `
    <div class="linea-row" data-i="${i}" style="display:grid;grid-template-columns:2fr 1.2fr 1.2fr 1.5fr 1fr 1.5fr 28px;gap:6px;align-items:center">
      <input type="text" class="me-f-nombre" placeholder="Nombre / Razón social *" value="${f.nombre || ''}" style="min-width:0">
      <input type="text" class="me-f-cuit" placeholder="XX-XXXXXXXX-X" value="${f.cuit || ''}" style="min-width:0">
      <select class="me-f-iva" style="min-width:0">
        ${IVA_OPTS.map(o => `<option value="${o}" ${f.iva === o ? 'selected' : ''}>${o || '—'}</option>`).join('')}
      </select>
      <input type="email" class="me-f-email" placeholder="email@..." value="${f.email || ''}" style="min-width:0">
      <input type="text" class="me-f-tel" placeholder="Tel." value="${f.tel || ''}" style="min-width:0">
      <input type="text" class="me-f-obs" placeholder="Observaciones" value="${f.obs || ''}" style="min-width:0">
      <button class="btn btn-sm btn-del" onclick="eliminarFilaEmpresa(${i})" ${filas.length <= 1 ? 'disabled' : ''}>✕</button>
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
  document.getElementById('me-title').textContent = esEdicion ? 'Editar empresa' : 'Nueva empresa';
  document.getElementById('me-error').textContent = '';
  document.getElementById('me-id').value = emp ? emp.id : '';

  // Mostrar el modo correcto
  document.getElementById('me-form-single').style.display = esEdicion ? '' : 'none';
  document.getElementById('me-form-multi').style.display = esEdicion ? 'none' : '';
  document.getElementById('me-guardar').textContent = esEdicion ? 'Guardar empresa' : 'Guardar empresas';

  if (esEdicion) {
    document.getElementById('me-nombre').value = emp.nombre || '';
    document.getElementById('me-cuit').value = emp.cuit || '';
    document.getElementById('me-iva').value = emp.condicion_iva || '';
    document.getElementById('me-email').value = emp.email || '';
    document.getElementById('me-tel').value = emp.telefono || '';
    document.getElementById('me-dir').value = emp.direccion || '';
    document.getElementById('me-obs').value = emp.observaciones || '';
  } else {
    renderEmpresaFilas([{ nombre: '', cuit: '', iva: '', email: '', tel: '' }]);
  }
  document.getElementById('modal-empresa').classList.remove('hidden');
}

document.getElementById('me-add-fila').addEventListener('click', () => {
  const filas = getEmpresaFilas();
  filas.push({ nombre: '', cuit: '', iva: '', email: '', tel: '', obs: '' });
  renderEmpresaFilas(filas);
  const rows = document.querySelectorAll('#me-filas .linea-row');
  rows[rows.length - 1]?.querySelector('.me-f-nombre')?.focus();
});

document.getElementById('me-csv-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return;

    // Detectar encabezado
    const COLS = ['nombre', 'cuit', 'condicion_iva', 'email', 'telefono', 'observaciones'];
    const firstLow = lines[0].toLowerCase().replace(/\s/g, '');
    const tieneHeader = COLS.some(c => firstLow.includes(c));
    const dataLines = tieneHeader ? lines.slice(1) : lines;

    // Mapear columnas si hay header
    let colIdx = { nombre: 0, cuit: 1, condicion_iva: 2, email: 3, telefono: 4, observaciones: 5 };
    if (tieneHeader) {
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s/g, '_'));
      colIdx = { nombre: -1, cuit: -1, condicion_iva: -1, email: -1, telefono: -1, observaciones: -1 };
      headers.forEach((h, i) => { if (colIdx.hasOwnProperty(h)) colIdx[h] = i; });
    }

    const filas = dataLines.map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const get = (key) => colIdx[key] >= 0 ? (cols[colIdx[key]] || '') : '';
      return {
        nombre: get('nombre'),
        cuit: get('cuit'),
        iva: get('condicion_iva'),
        email: get('email'),
        tel: get('telefono'),
        obs: get('observaciones'),
      };
    }).filter(f => f.nombre);

    if (!filas.length) {
      document.getElementById('me-error').textContent = 'El CSV no contiene filas válidas (ninguna tiene nombre).';
      return;
    }

    // Mostrar hint de columnas la primera vez
    document.getElementById('me-csv-hint').style.display = 'block';
    renderEmpresaFilas(filas);
    showToast(`↑ ${filas.length} fila${filas.length > 1 ? 's' : ''} importada${filas.length > 1 ? 's' : ''} del CSV.`, 'info');
    e.target.value = ''; // reset input para permitir reimportar el mismo archivo
  };
  reader.readAsText(file);
});

function closeModalEmpresa() { document.getElementById('modal-empresa').classList.add('hidden'); }
document.getElementById('me-close').addEventListener('click', closeModalEmpresa);
document.getElementById('me-cancelar').addEventListener('click', closeModalEmpresa);

document.getElementById('me-guardar').addEventListener('click', async () => {
  const err = document.getElementById('me-error');
  err.textContent = '';
  const id = document.getElementById('me-id').value;
  const { data: { user } } = await sb.auth.getUser();

  try {
    if (id) {
      // Modo edición — igual que antes
      const nombre = document.getElementById('me-nombre').value.trim();
      if (!nombre) { err.textContent = 'El nombre es obligatorio.'; return; }
      const data = {
        nombre,
        cuit: document.getElementById('me-cuit').value || null,
        condicion_iva: document.getElementById('me-iva').value || null,
        email: document.getElementById('me-email').value || null,
        telefono: document.getElementById('me-tel').value || null,
        direccion: document.getElementById('me-dir').value || null,
        observaciones: document.getElementById('me-obs').value || null,
      };
      await sb.from('empresas').update(data).eq('id', id);
      showToast('✓ Empresa actualizada.');
    } else {
      // Modo creación múltiple
      const filas = getEmpresaFilas();
      const invalidas = filas.filter(f => !f.nombre);
      if (invalidas.length) { err.textContent = 'Todas las filas deben tener al menos un nombre.'; return; }
      const rows = filas.map(f => ({
        nombre: f.nombre,
        cuit: f.cuit || null,
        condicion_iva: f.iva || null,
        email: f.email || null,
        telefono: f.tel || null,
        observaciones: f.obs || null,
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
  await loadEmpresas(); renderEmpresas();
  showToast('✓ Empresa eliminada.', 'info');
}

// ── MODAL CUENTA ──────────────────────────────────────────────────────────────
function openModalCuenta(id) {
  const c = id ? cuentas.find(x => x.id === id) : null;
  document.getElementById('mc-title').textContent = c ? 'Editar cuenta' : 'Nueva cuenta';
  document.getElementById('mc-error').textContent = '';
  document.getElementById('mc-id').value = c ? c.id : '';
  document.getElementById('mc-codigo').value = c ? c.codigo : '';
  document.getElementById('mc-nombre').value = c ? c.nombre : '';
  document.getElementById('mc-tipo').value = c ? c.tipo : 'Activo';
  document.getElementById('modal-cuenta').classList.remove('hidden');
}

function closeModalCuenta() { document.getElementById('modal-cuenta').classList.add('hidden'); }
document.getElementById('mc-close').addEventListener('click', closeModalCuenta);
document.getElementById('mc-cancelar').addEventListener('click', closeModalCuenta);

document.getElementById('mc-guardar').addEventListener('click', async () => {
  const err = document.getElementById('mc-error');
  err.textContent = '';

  const codigo = document.getElementById('mc-codigo').value.trim();
  const nombre = document.getElementById('mc-nombre').value.trim();

  if (!codigo || !nombre) {
    err.textContent = 'Código y nombre son obligatorios.';
    return;
  }

  const id = document.getElementById('mc-id').value;

  const data = {
    codigo,
    nombre,
    tipo: document.getElementById('mc-tipo').value
  };

  try {
    if (id) {
      await sb.from('cuentas').update(data).eq('id', id);

    } else {
      const { data: { user } } = await sb.auth.getUser();

      // 🔍 Buscar duplicado
      const { data: existente } = await sb
        .from('cuentas')
        .select('*')
        .eq('user_id', user.id)
        .eq('codigo', data.codigo)
        .maybeSingle();

      if (existente) {
        const confirmar = await mostrarConfirmacion(
          'Ya existe una cuenta con ese código.\n¿Desea reemplazarla?'
        );

        if (!confirmar) return;

        // 🔁 Reemplazar
        const { error } = await sb
          .from('cuentas')
          .update({
            nombre: data.nombre,
            tipo: data.tipo
          })
          .eq('id', existente.id);

        if (error) throw error;

      } else {
        // 🆕 Insert normal
        const { error } = await sb
          .from('cuentas')
          .insert({
            ...data,
            user_id: user.id,
            origen: 'usuario'
          });

        if (error) throw error;
      }
    }

    closeModalCuenta();
    await loadCuentas();
    renderCuentas();
    showToast(id ? '✓ Cuenta actualizada.' : '✓ Cuenta creada.');

  } catch (e) {
    err.textContent = 'Error: ' + e.message;
  }
});

function mostrarConfirmacion(mensaje) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm');
    const texto = document.getElementById('mc-texto');
    const btnOk = document.getElementById('mc-confirmar');
    const btnCancel = document.getElementById('mc-cancelar-confirm');

    texto.innerHTML = mensaje;
    modal.classList.remove('hidden');

    const limpiar = () => {
      modal.classList.add('hidden');
      btnOk.onclick = null;
      btnCancel.onclick = null;
    };

    btnOk.onclick = () => {
      limpiar();
      resolve(true);
    };

    btnCancel.onclick = () => {
      limpiar();
      resolve(false);
    };
  });
}

async function eliminarCuenta(id) {
  const ok = await confirmarEliminar('¿Eliminar esta cuenta? Esta acción no se puede deshacer.');
  if (!ok) return;
  await sb.from('cuentas').delete().eq('id', id);
  await loadCuentas(); renderCuentas();
  showToast('✓ Cuenta eliminada.', 'info');
}

// ── RENDER MOVIMIENTOS ────────────────────────────────────────────────────────
function renderAll() { renderStats(); renderTable(); populateMesFilter(); populateTipoFilter(); }

function renderStats() {
  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const egresos = movimientos.filter(m => m.tipo === 'Egreso' || m.tipo === 'Tarjeta de crédito').reduce((s, m) => s + (m.monto || 0), 0);
  const resultado = ingresos - egresos;
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos totales</div><div class="stat-value pos">$ ${fmt(ingresos)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos totales</div><div class="stat-value neg">$ ${fmt(egresos)}</div></div>
    <div class="stat-card"><div class="stat-label">Resultado</div><div class="stat-value ${resultado >= 0 ? 'pos' : 'neg'}">$ ${fmt(resultado)}</div></div>
    <div class="stat-card"><div class="stat-label">Movimientos</div><div class="stat-value">${movimientos.length}</div></div>
  `;
}

function populateTipoFilter() {
  const tipos = ['Ingreso', 'Egreso', 'Inversión', 'Préstamo', 'Tarjeta de crédito', 'Banco'];
  const cont = document.getElementById('filter-tipo-options');
  if (!cont) return;
  cont.innerHTML = tipos.map(t => `
    <label class="chk-option">
      <span>${t}</span>
      <input type="checkbox" value="${t}">
    </label>`).join('');
  cont.querySelectorAll('input').forEach(i => i.addEventListener('change', renderTable));
}

function populateMesFilter() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0, 7) : '').filter(Boolean))].sort().reverse();
  const cont = document.getElementById('filter-mes-options');
  if (!cont) return;
  cont.innerHTML = meses.map(m => {
    const [y, mo] = m.split('-');
    const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `<label class="chk-option"><span>${nom[parseInt(mo) - 1]} ${y}</span><input type="checkbox" value="${m}"></label>`;
  }).join('');
  cont.querySelectorAll('input').forEach(i => i.addEventListener('change', renderTable));
}

function getSelectedCheckboxes(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i => i.value);
}

document.getElementById('search').addEventListener('input', renderTable);

function renderTable() {
  const search = document.getElementById('search').value.toLowerCase();
  const tipos = getSelectedCheckboxes('filter-tipo-options');
  const meses = getSelectedCheckboxes('filter-mes-options');

  let list = movimientos.filter(m => {
    if (search && !((m.detalle || '').toLowerCase().includes(search) || (m.empresa || '').toLowerCase().includes(search) || (m.cuit || '').includes(search))) return false;
    if (tipos.length && !tipos.includes(m.tipo)) return false;
    if (meses.length && !meses.some(mes => (m.fecha || '').startsWith(mes))) return false;
    return true;
  });

  const tbody = document.getElementById('tabla-body');
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

// ── RENDER EMPRESAS ───────────────────────────────────────────────────────────
function renderEmpresas() {
  const tbody = document.getElementById('empresas-body');
  if (!tbody) return;
  if (!empresas.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Sin empresas.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = empresas.map(e => {
    const saldo = getSaldoEmpresa(e.id);
    const saldoLabel = saldo === 0
      ? '<span class="muted-text">$ 0</span>'
      : saldo > 0
        ? `<span class="pos-text" style="font-weight:500">Nos debe $ ${fmt(saldo)}</span>`
        : `<span class="neg-text" style="font-weight:500">Debemos $ ${fmt(Math.abs(saldo))}</span>`;
    const btnSaldo = saldo !== 0
      ? `<button class="btn btn-sm" onclick="openModalCobrarPagar('${e.id}')">${saldo > 0 ? 'Cobrar' : 'Pagar'}</button>`
      : '';
    return `<tr>
      <td style="font-weight:500">${e.nombre}</td>
      <td class="muted-text" style="font-family:var(--mono);font-size:12px">${e.cuit || '—'}</td>
      <td class="muted-text">${e.condicion_iva || '—'}</td>
      <td class="muted-text">${e.email || '—'}</td>
      <td class="muted-text">${e.telefono || '—'}</td>
      <td class="muted-text" style="font-size:12px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${e.observaciones || ''}">${e.observaciones || '—'}</td>
      <td class="r">${saldoLabel}</td>
      <td style="text-align:right;white-space:nowrap">
        ${btnSaldo}
        <button class="btn btn-sm" onclick="openModalEmpresa('${e.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarEmpresa('${e.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

// ── RENDER CUENTAS ────────────────────────────────────────────────────────────
function renderCuentas() {
  const tbody = document.getElementById('cuentas-body');
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

// ── ESTADO DE RESULTADOS ──────────────────────────────────────────────────────
function renderER() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0, 7) : '').filter(Boolean))].sort();
  if (!meses.length) { document.getElementById('er-table').innerHTML = `<tr><td><div class="empty-state">Sin datos.</div></td></tr>`; return; }
  const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const getTotal = (tipo, mes) => movimientos
    .filter(m => m.tipo === tipo && (m.fecha || '').startsWith(mes))
    .reduce((s, m) => s + (m.monto_neto || m.monto || 0), 0);

  let html = '<thead><tr><th>Rubro</th>';
  meses.forEach(m => { const [y, mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo) - 1]} ${y}</th>`; });
  html += '<th class="r">Total</th></tr></thead><tbody>';

  // ── Ingresos
  html += `<tr style="background:var(--bg)"><td colspan="${meses.length + 2}" style="font-size:11px;font-weight:500;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.06em;padding:10px 14px 4px">Ingresos</td></tr>`;
  let totalIngresos = {};
  meses.forEach(m => { totalIngresos[m] = getTotal('Ingreso', m); });
  html += `<tr><td style="padding-left:24px">Ingresos operativos</td>`;
  let rowTotalIng = 0;
  meses.forEach(m => { rowTotalIng += totalIngresos[m]; html += `<td class="r pos-text">$ ${fmt(totalIngresos[m])}</td>`; });
  html += `<td class="r pos-text" style="font-weight:500">$ ${fmt(rowTotalIng)}</td></tr>`;

  // ── Subtotal ingresos
  html += `<tr class="er-subtotal"><td>Total ingresos</td>`;
  let grandIng = 0;
  meses.forEach(m => { grandIng += totalIngresos[m]; html += `<td class="r">$ ${fmt(totalIngresos[m])}</td>`; });
  html += `<td class="r">$ ${fmt(grandIng)}</td></tr>`;

  // ── Egresos
  html += `<tr style="background:var(--bg)"><td colspan="${meses.length + 2}" style="font-size:11px;font-weight:500;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.06em;padding:10px 14px 4px">Egresos</td></tr>`;
  let totalEgresos = {};
  meses.forEach(m => { totalEgresos[m] = getTotal('Egreso', m); });
  html += `<tr><td style="padding-left:24px">Egresos operativos</td>`;
  let rowTotalEg = 0;
  meses.forEach(m => { rowTotalEg += totalEgresos[m]; html += `<td class="r neg-text">$ ${fmt(totalEgresos[m])}</td>`; });
  html += `<td class="r neg-text" style="font-weight:500">$ ${fmt(rowTotalEg)}</td></tr>`;

  // ── Subtotal egresos
  html += `<tr class="er-subtotal"><td>Total egresos</td>`;
  let grandEg = 0;
  meses.forEach(m => { grandEg += totalEgresos[m]; html += `<td class="r">$ ${fmt(totalEgresos[m])}</td>`; });
  html += `<td class="r">$ ${fmt(grandEg)}</td></tr>`;

  // ── Resultado bruto
  html += `<tr class="er-total"><td>Resultado bruto</td>`;
  let grandBruto = 0;
  meses.forEach(m => {
    const v = totalIngresos[m] - totalEgresos[m]; grandBruto += v;
    html += `<td class="r ${v >= 0 ? 'pos-text' : 'neg-text'}">$ ${fmt(v)}</td>`;
  });
  html += `<td class="r ${grandBruto >= 0 ? 'pos-text' : 'neg-text'}">$ ${fmt(grandBruto)}</td></tr>`;

  // ── Contribución marginal (resultado bruto / ingresos)
  html += `<tr><td style="color:var(--text-muted);font-size:12px">Contribución marginal</td>`;
  meses.forEach(m => {
    const ing = totalIngresos[m]; const eg = totalEgresos[m];
    const cm = ing > 0 ? ((ing - eg) / ing * 100) : 0;
    html += `<td class="r" style="color:var(--text-muted);font-size:12px">${cm.toFixed(1)}%</td>`;
  });
  const cmTotal = grandIng > 0 ? ((grandIng - grandEg) / grandIng * 100) : 0;
  html += `<td class="r" style="color:var(--text-muted);font-size:12px">${cmTotal.toFixed(1)}%</td></tr>`;

  // ── Tabla separada: otros movimientos
  html += `</tbody>`;
  document.getElementById('er-table').innerHTML = html;

  // Segunda tabla
  const otros = [
    { label: 'Tarjetas de crédito', tipo: 'Tarjeta de crédito', sign: -1 },
    { label: 'Bancos / Transferencias', tipo: 'Banco', sign: 1 },
    { label: 'Inversiones', tipo: 'Inversión', sign: 1 },
    { label: 'Préstamos', tipo: 'Préstamo', sign: 1 },
  ];
  let html2 = '<thead><tr><th>Otros movimientos</th>';
  meses.forEach(m => { const [y, mo] = m.split('-'); html2 += `<th class="r">${nom[parseInt(mo) - 1]} ${y}</th>`; });
  html2 += '<th class="r">Total</th></tr></thead><tbody>';
  otros.forEach(cat => {
    html2 += `<tr><td>${cat.label}</td>`;
    let rowT = 0;
    meses.forEach(m => {
      const v = getTotal(cat.tipo, m) * cat.sign; rowT += v;
      html2 += `<td class="r ${v < 0 ? 'neg-text' : v > 0 ? 'pos-text' : 'muted-text'}">$ ${fmt(Math.abs(v))}</td>`;
    });
    html2 += `<td class="r" style="font-weight:500">$ ${fmt(Math.abs(rowT))}</td></tr>`;
  });
  html2 += '</tbody>';
  document.getElementById('er-table-otros').innerHTML = html2;
}

// ── FLUJO DE FONDOS ───────────────────────────────────────────────────────────

function renderFlujo() {
  const desde = document.getElementById('flujo-desde')?.value || '';
  const hasta = document.getElementById('flujo-hasta')?.value || '';

  let movsFiltrados = movimientos;
  if (desde) movsFiltrados = movsFiltrados.filter(m => (m.fecha || '') >= desde);
  if (hasta) movsFiltrados = movsFiltrados.filter(m => (m.fecha || '') <= hasta);

  const meses = [...new Set(movsFiltrados.map(m => m.fecha ? m.fecha.substring(0, 7) : '').filter(Boolean))].sort();
  if (!meses.length) {
    document.getElementById('flujo-stats').innerHTML = '';
    document.getElementById('flujo-table').innerHTML = `<tr><td><div class="empty-state">Sin datos para el período seleccionado.</div></td></tr>`;
    return;
  }
  const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const getSum = (tipos, mes) => movsFiltrados.filter(m => tipos.includes(m.tipo) && (m.fecha || '').startsWith(mes)).reduce((s, m) => s + (m.monto || 0), 0);
  const filas = [
    { label: 'Ingresos', tipos: ['Ingreso'], sign: 1 },
    { label: 'Egresos', tipos: ['Egreso'], sign: -1 },
    { label: 'Tarjetas', tipos: ['Tarjeta de crédito'], sign: -1 },
    { label: 'Bancos / Transf.', tipos: ['Banco'], sign: 1 },
    { label: 'Inversiones', tipos: ['Inversión'], sign: 1 },
    { label: 'Préstamos', tipos: ['Préstamo'], sign: 1 },
  ];
  let html = '<thead><tr><th>Concepto</th>';
  meses.forEach(m => { const [y, mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo) - 1]} ${y}</th>`; });
  html += '</tr></thead><tbody>';
  filas.forEach(f => {
    html += `<tr><td>${f.label}</td>`;
    meses.forEach(mes => { const v = getSum(f.tipos, mes) * f.sign; html += `<td class="r ${v < 0 ? 'neg-text' : 'muted-text'}">$ ${fmt(Math.abs(v))}</td>`; });
    html += '</tr>';
  });
  const flujos = meses.map(mes => getSum(['Ingreso'], mes) - getSum(['Egreso', 'Tarjeta de crédito'], mes));
  html += '<tr class="er-subtotal"><td>Flujo neto del mes</td>';
  flujos.forEach(v => { html += `<td class="r ${v < 0 ? 'neg-text' : 'pos-text'}">$ ${fmt(v)}</td>`; });
  html += '</tr><tr class="er-total"><td>Saldo acumulado</td>';
  let acum = 0;
  flujos.forEach(v => { acum += v; html += `<td class="r">$ ${fmt(acum)}</td>`; });
  html += '</tr></tbody>';
  document.getElementById('flujo-table').innerHTML = html;
  const totalIng = movsFiltrados.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const totalEg = movsFiltrados.filter(m => m.tipo === 'Egreso' || m.tipo === 'Tarjeta de crédito').reduce((s, m) => s + (m.monto || 0), 0);
  document.getElementById('flujo-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos acum.</div><div class="stat-value pos">$ ${fmt(totalIng)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos acum.</div><div class="stat-value neg">$ ${fmt(totalEg)}</div></div>
    <div class="stat-card"><div class="stat-label">Posición neta</div><div class="stat-value ${acum >= 0 ? 'pos' : 'neg'}">$ ${fmt(acum)}</div></div>
    <div class="stat-card"><div class="stat-label">Meses analizados</div><div class="stat-value">${meses.length}</div></div>
  `;
}

checkSession();

// ── DROPDOWNS ─────────────────────────────────────────────────────────────────
document.getElementById('btn-filter-tipo').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('filter-tipo-panel').style.display =
    document.getElementById('filter-tipo-panel').style.display === 'block' ? 'none' : 'block';
  document.getElementById('filter-mes-panel').style.display = 'none';
});

document.getElementById('btn-filter-mes').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('filter-mes-panel').style.display =
    document.getElementById('filter-mes-panel').style.display === 'block' ? 'none' : 'block';
  document.getElementById('filter-tipo-panel').style.display = 'none';
});

document.addEventListener('click', () => {
  document.getElementById('filter-tipo-panel').style.display = 'none';
  document.getElementById('filter-mes-panel').style.display = 'none';
});

// ── ASIENTOS (PARTIDA DOBLE) ──────────────────────────────────────────────────
let asientos = [], asientoLineas = [], editAsientoId = null;

async function initCuentasPredefinidas() {
  const { data: { user } } = await sb.auth.getUser();

  if (!user) return;

  // 🔥 CLAVE: preguntar a la DB, no a la variable local
  const { data: existentes } = await sb
    .from('cuentas')
    .select('id')
    .eq('user_id', user.id);

  if (existentes && existentes.length > 0) {
    console.log('Ya tiene cuentas, no insertar');
    return;
  }

  const { data: base } = await sb
    .from('cuentas_base')
    .select('*');

  const { error } = await sb
    .from('cuentas')
    .insert(
      base.map(c => ({
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        user_id: user.id,
        origen: 'base'
      }))
    );

  console.log('INSERT ERROR:', error);

  await loadCuentas();
}

// async function initCuentasPredefinidas() {
//   if (cuentas.length > 0) return;
//   const { data: { user } } = await sb.auth.getUser();
//   const predefinidas = [
//     { codigo: '01.01', nombre: 'Efectivo ARS',         tipo: 'Activo' },
//     { codigo: '01.02', nombre: 'Efectivo USD',         tipo: 'Activo' },
//     { codigo: '01.03', nombre: 'Banco Galicia',        tipo: 'Activo' },
//     { codigo: '01.06', nombre: 'Mercado Pago',         tipo: 'Activo' },
//     { codigo: '01.99', nombre: 'Cuentas a cobrar',     tipo: 'Activo' },
//     { codigo: '02.01', nombre: 'Cuentas a pagar',      tipo: 'Pasivo' },
//     { codigo: '03.01', nombre: 'HotDesk Interno',      tipo: 'Ingreso' },
//     { codigo: '03.02', nombre: 'HotDesk Externo',      tipo: 'Ingreso' },
//     { codigo: '03.03', nombre: 'Almuerzos y Desayunos',tipo: 'Ingreso' },
//     { codigo: '03.04', nombre: 'Capital Humano',               tipo: 'Ingreso' },
//     { codigo: '03.05', nombre: 'Sostenibilidad',               tipo: 'Ingreso' },
//     { codigo: '03.06', nombre: 'Alquiler',               tipo: 'Ingreso' },
//     { codigo: '03.07', nombre: 'Monotributos',               tipo: 'Ingreso' },
//     { codigo: '03.08', nombre: 'Workshop',               tipo: 'Ingreso' },
//     { codigo: '03.09', nombre: 'Otros Ingresos',               tipo: 'Ingreso' },
//     { codigo: '04.01', nombre: 'Compras',              tipo: 'Egreso' },
//     { codigo: '04.02', nombre: 'Sueldos',              tipo: 'Egreso' },
//     { codigo: '02.04', nombre: 'IVA Crédito Fiscal',   tipo: 'Activo' },
//     { codigo: '02.03', nombre: 'IVA Débito Fiscal',    tipo: 'Pasivo' },
//     { codigo: '04.03', nombre: 'Impuestos',            tipo: 'Egreso' },
//     { codigo: '04.04', nombre: 'Gastos generales',     tipo: 'Egreso' },
//   ];
//   await sb.from('cuentas').insert(predefinidas.map(c => ({ ...c, user_id: user.id })));
//   await loadCuentas();
//   renderCuentas();
//}
// async function agregarCuentasIVASiFaltan() {
//   const tieneDebito  = cuentas.find(c => c.nombre === 'IVA Débito Fiscal');
//   const tieneCredito = cuentas.find(c => c.nombre === 'IVA Crédito Fiscal');
//   if (tieneDebito && tieneCredito) return;
//   const { data: { user } } = await sb.auth.getUser();
//   const nuevas = [];
//   if (!tieneDebito)  nuevas.push({ codigo: '02.03', nombre: 'IVA Débito Fiscal',  tipo: 'Pasivo', user_id: user.id });
//   if (!tieneCredito) nuevas.push({ codigo: '02.04', nombre: 'IVA Crédito Fiscal', tipo: 'Activo', user_id: user.id });
//   if (nuevas.length) { await sb.from('cuentas').insert(nuevas); await loadCuentas(); }
// }

async function loadAsientos() {
  const { data } = await sb.from('asientos').select('*, asiento_lineas(*)').order('fecha', { ascending: false });
  asientos = data || [];
  renderAsientos();
}

function getAllCuentas() {
  return cuentas.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function cuentaOptions(selectedId) {
  return getAllCuentas().map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.codigo} — ${c.nombre}</option>`
  ).join('');
}

// ── MODAL ASIENTO ─────────────────────────────────────────────────────────────
async function openModalAsiento(id) {
   if (!empresas.length) {
    await loadEmpresas(); // 🔥 clave
  }

  editAsientoId = id || null;
  document.getElementById('mas-title').textContent = editAsientoId ? 'Editar asiento' : 'Nuevo asiento';
  document.getElementById('mas-error').textContent = '';

 


  if (editAsientoId) {
    const a = asientos.find(x => x.id === editAsientoId);
    document.getElementById('mas-fecha').value = a.fecha || '';
    document.getElementById('mas-desc').value = a.descripcion || '';
    document.getElementById('mas-doc').value = a.documento || '';
    document.getElementById('mas-obs').value = a.observaciones || '';
    const emp = empresas.find(e => e.id === a.empresa_id);

    setTimeout(() => {
      const input = document.getElementById('mov-empresa-input');
      const dropdown = document.getElementById('mov-empresa-dropdown');
      setupEmpresaAutocomplete(input, dropdown);
    }, 0);

    renderLineas(a.asiento_lineas || []);
  } else {
    document.getElementById('mas-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('mas-desc').value = '';
    document.getElementById('mas-doc').value = '';
    document.getElementById('mas-obs').value = '';

    setTimeout(() => {
      const input = document.getElementById('mas-empresa-input');
      if (input) input.value = '';
    }, 0);

    renderLineas([
      { cuenta_id: '', debe: '', haber: '' },
      { cuenta_id: '', debe: '', haber: '' },
    ]);
  }
  populateEmpresasDatalist();
  document.getElementById('modal-asiento').classList.remove('hidden');

  setTimeout(() => {
    const input = document.getElementById('mas-empresa-input');
    const dropdown = document.getElementById('empresa-dropdown');
    setupEmpresaAutocomplete(input, dropdown);
  }, 0);
}

function closeModalAsiento() { document.getElementById('modal-asiento').classList.add('hidden'); }
document.getElementById('mas-close').addEventListener('click', closeModalAsiento);
document.getElementById('mas-cancelar').addEventListener('click', closeModalAsiento);
document.getElementById('mas-add-linea').addEventListener('click', () => {
  const lineas = getLineasActuales();
  lineas.push({ cuenta_id: '', debe: '', haber: '' });
  renderLineas(lineas);
});

function populateEmpresasDatalist() {
  const dl = document.getElementById('empresas-list');
  if (!dl) return;

  dl.innerHTML = empresas.map(e =>
    `<option value="${e.nombre}"></option>`
  ).join('');
}

function renderLineas(lineas) {
  const cont = document.getElementById('mas-lineas');

  cont.innerHTML = lineas.map((l, i) => `
    <div class="linea-row" data-i="${i}" style="display:flex;gap:8px;margin-bottom:6px">

      <div style="position:relative;flex:2">
        <input 
          type="text" 
          class="linea-cuenta-input" 
          placeholder="Buscar cuenta..." 
          value="${l.cuenta_nombre || ''}"
          autocomplete="off"
          style="width:100%"
        >
        <div class="cuenta-dropdown dropdown"></div>
      </div>

      <input 
        type="number" 
        class="linea-debe" 
        placeholder="Debe" 
        value="${l.debe || ''}" 
        step="0.01"
        style="flex:1"
      >

      <input 
        type="number" 
        class="linea-haber" 
        placeholder="Haber" 
        value="${l.haber || ''}" 
        step="0.01"
        style="flex:1"
      >

      <button onclick="eliminarLinea(${i})">✕</button>
    </div>
  `).join('');

  // 🔥 activar autocomplete en cada fila
  cont.querySelectorAll('.linea-row').forEach(row => {
    setupCuentaAutocomplete(row);
  });

  // recalcular totales
  cont.querySelectorAll('input').forEach(i =>
    i.addEventListener('input', updateTotales)
  );

  updateTotales();
}

function setupCuentaAutocomplete(row) {
  const input = row.querySelector('.linea-cuenta-input');
  const dropdown = row.querySelector('.cuenta-dropdown');

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();

    const results = cuentas.filter(c =>
      (`${c.codigo} ${c.nombre}`).toLowerCase().includes(val)
    );

    dropdown.innerHTML = results.slice(0, 5).map(c =>
      `<div class="dropdown-item" data-id="${c.id}">
        ${c.codigo} - ${c.nombre}
      </div>`
    ).join('');

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.textContent;
        input.dataset.id = item.dataset.id;
        dropdown.innerHTML = '';
        updateTotales();
      });
    });
  });
}

function setupEmpresaAutocomplete(input, dropdown) {
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();

    if (!val) {
      dropdown.innerHTML = '';
      return;
    }

    const results = empresas.filter(e =>
      (e.nombre || '').toLowerCase().includes(val)
    );

    dropdown.innerHTML = results.slice(0, 8).map(e =>
      `<div class="dropdown-item" data-id="${e.id}">
        ${e.nombre}
      </div>`
    ).join('');

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.onclick = () => {
        input.value = item.textContent;
        input.dataset.id = item.dataset.id;
        dropdown.innerHTML = '';
      };
    });
  });
}

function eliminarLinea(i) {
  const lineas = getLineasActuales();
  if (lineas.length <= 2) return;
  lineas.splice(i, 1);
  renderLineas(lineas);
}

function getLineasActuales() {
  const cont = document.getElementById('mas-lineas');

  return [...cont.querySelectorAll('.linea-row')].map(row => {
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
  document.getElementById('mas-total-debe').textContent = '$ ' + fmt(totalDebe);
  document.getElementById('mas-total-haber').textContent = '$ ' + fmt(totalHaber);
  const el = document.getElementById('mas-balance');
  el.textContent = cuadra ? '✓ Cuadra' : '✗ No cuadra';
  el.className = cuadra ? 'balance-ok' : 'balance-err';
}

document.getElementById('mas-guardar').addEventListener('click', async () => {
  const err = document.getElementById('mas-error');
  err.textContent = '';
  const fecha = document.getElementById('mas-fecha').value;
  const desc = document.getElementById('mas-desc').value.trim();
  if (!fecha || !desc) { err.textContent = 'Fecha y descripción son obligatorios.'; return; }
  const lineas = getLineasActuales().filter(l => l.cuenta_id);
  if (lineas.length < 2) { err.textContent = 'Necesitás al menos 2 líneas con cuenta seleccionada.'; return; }
  const totalDebe = lineas.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
  if (Math.abs(totalDebe - totalHaber) >= 0.01) { err.textContent = 'El asiento no cuadra. Debe = Haber.'; return; }

  try {
    const { data: { user } } = await sb.auth.getUser();

    // 👇 Obtener nombre escrito
    const empresaNombre = document.getElementById('mas-empresa-input').value;

    // 👇 Buscar el objeto empresa
    const empresaObj = empresas.find(e =>
      e.nombre.toLowerCase() === empresaNombre.toLowerCase()
    );

    // 👇 Obtener ID real
    const empresa_id = empresaObj ? empresaObj.id : null;

    const asientoData = {
      fecha,
      descripcion: desc,
      empresa_id: empresa_id,
      documento: document.getElementById('mas-doc').value || null,
      observaciones: document.getElementById('mas-obs').value || null,
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

// ── RENDER ASIENTOS ───────────────────────────────────────────────────────────
function renderAsientos() {
  const tbody = document.getElementById('asientos-body');
  if (!tbody) return;
  if (!asientos.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Sin asientos. Hacé clic en "+ Nuevo asiento".</div></td></tr>`;
    return;
  }
  tbody.innerHTML = asientos.map(a => {
    const totalDebe = (a.asiento_lineas || []).reduce((s, l) => s + (l.debe || 0), 0);
    const empresa = empresas.find(e => e.id === a.empresa_id);
    return `
      <tr>
        <td style="white-space:nowrap;font-family:var(--mono);font-size:12px;color:var(--text-muted)">${a.fecha || ''}</td>
        <td style="font-weight:500">${a.descripcion}</td>
        <td class="muted-text">${empresa ? empresa.nombre : '—'}</td>
        <td class="r" style="font-family:var(--mono)">$ ${fmt(totalDebe)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" onclick="verAsiento('${a.id}')">Ver</button>
          <button class="btn btn-sm" onclick="openModalAsiento('${a.id}')">Editar</button>
          <button class="btn btn-sm btn-del" onclick="eliminarAsiento('${a.id}')">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

function verAsiento(id) {
  const a = asientos.find(x => x.id === id);
  if (!a) return;
  const lineas = (a.asiento_lineas || []);
  const empresa = empresas.find(e => e.id === a.empresa_id);
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
    </tbody>
  </table>`;
  document.getElementById('detalle-content').innerHTML = html;
  document.getElementById('modal-detalle').classList.remove('hidden');
}

async function eliminarAsiento(id) {
  const ok = await confirmarEliminar('¿Eliminar este asiento y todas sus líneas? Esta acción no se puede deshacer.');
  if (!ok) return;
  await sb.from('asientos').delete().eq('id', id);
  await loadAsientos();
  showToast('✓ Asiento eliminado.', 'info');
}

document.getElementById('detalle-close').addEventListener('click', () => {
  document.getElementById('modal-detalle').classList.add('hidden');
});

// ── SALDOS POR CUENTA ─────────────────────────────────────────────────────────
async function renderSaldos() {
  await loadAsientos();
  const tbody = document.getElementById('saldos-body');
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
    const saldo = v.debe - v.haber;
    return { nombre, codigo: cuenta?.codigo || '', tipo: cuenta?.tipo || '', debe: v.debe, haber: v.haber, saldo };
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

// ── INVERSIONES ───────────────────────────────────────────────────────────────
let inversiones = [], editInvId = null;

async function loadInversiones() {
  const { data } = await sb.from('inversiones')
    .select('*, inversion_movimientos(*)')
    .order('fecha_inicio', { ascending: false });
  inversiones = data || [];
  renderInversiones();
}

function calcularSaldoConIntereses(inv) {
  if (!inv.tna || inv.estado !== 'Activa') return inv.saldo_actual;
  const hoy = new Date();
  const inicio = new Date(inv.fecha_inicio);
  const dias = Math.max(0, Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24)));
  const tnaDecimal = inv.tna / 100;
  const interes = inv.saldo_actual * tnaDecimal * (dias / 365);
  return inv.saldo_actual + interes;
}

function calcularInteresesAcumulados(inv) {
  return calcularSaldoConIntereses(inv) - inv.saldo_actual;
}

// ── MODAL INVERSION ───────────────────────────────────────────────────────────
function openModalInversion(id) {
  editInvId = id || null;
  document.getElementById('mi-title').textContent = editInvId ? 'Editar inversión' : 'Nueva inversión';
  document.getElementById('mi-error').textContent = '';

  if (editInvId) {
    const inv = inversiones.find(x => x.id === editInvId);
    document.getElementById('mi-nombre').value = inv.nombre || '';
    document.getElementById('mi-tipo').value = inv.tipo || 'FCI';
    document.getElementById('mi-entidad').value = inv.entidad || '';
    document.getElementById('mi-moneda').value = inv.moneda || 'ARS';
    document.getElementById('mi-tna').value = inv.tna || '';
    document.getElementById('mi-inicio').value = inv.fecha_inicio || '';
    document.getElementById('mi-venc').value = inv.fecha_vencimiento || '';
    document.getElementById('mi-monto').value = inv.monto_inicial || '';
    document.getElementById('mi-saldo').value = inv.saldo_actual || '';
    document.getElementById('mi-estado').value = inv.estado || 'Activa';
    document.getElementById('mi-obs').value = inv.observaciones || '';
  } else {
    ['nombre', 'entidad', 'tna', 'venc', 'obs'].forEach(f => { document.getElementById('mi-' + f).value = ''; });
    document.getElementById('mi-tipo').value = 'FCI';
    document.getElementById('mi-moneda').value = 'ARS';
    document.getElementById('mi-estado').value = 'Activa';
    document.getElementById('mi-inicio').value = new Date().toISOString().split('T')[0];
    document.getElementById('mi-monto').value = '';
    document.getElementById('mi-saldo').value = '';
  }
  document.getElementById('modal-inversion').classList.remove('hidden');
}

function closeModalInversion() { document.getElementById('modal-inversion').classList.add('hidden'); }
document.getElementById('mi-close').addEventListener('click', closeModalInversion);
document.getElementById('mi-cancelar').addEventListener('click', closeModalInversion);

document.getElementById('mi-guardar').addEventListener('click', async () => {
  const err = document.getElementById('mi-error');
  err.textContent = '';
  const nombre = document.getElementById('mi-nombre').value.trim();
  const inicio = document.getElementById('mi-inicio').value;
  const monto = document.getElementById('mi-monto').value;
  if (!nombre || !inicio || !monto) { err.textContent = 'Nombre, fecha de inicio y monto son obligatorios.'; return; }
  const montoNum = parseFloat(monto) || 0;
  const saldoNum = parseFloat(document.getElementById('mi-saldo').value) || montoNum;
  const data = {
    nombre, tipo: document.getElementById('mi-tipo').value,
    entidad: document.getElementById('mi-entidad').value || null,
    moneda: document.getElementById('mi-moneda').value,
    tna: parseFloat(document.getElementById('mi-tna').value) || null,
    fecha_inicio: inicio,
    fecha_vencimiento: document.getElementById('mi-venc').value || null,
    monto_inicial: montoNum,
    saldo_actual: saldoNum,
    estado: document.getElementById('mi-estado').value,
    observaciones: document.getElementById('mi-obs').value || null,
  };
  try {
    if (editInvId) {
      await sb.from('inversiones').update(data).eq('id', editInvId);
    } else {
      const { data: { user } } = await sb.auth.getUser();
      const { data: inv } = await sb.from('inversiones').insert({ ...data, user_id: user.id }).select().single();
      await sb.from('inversion_movimientos').insert({
        inversion_id: inv.id, fecha: inicio, tipo: 'Suscripción',
        monto: montoNum, saldo_post: montoNum,
      });
    }
    closeModalInversion();
    await loadInversiones();
    showToast(editInvId ? '✓ Inversión actualizada.' : '✓ Inversión registrada.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

// ── MODAL MOVIMIENTO INVERSION ────────────────────────────────────────────────
function openModalMovInversion(invId) {
  document.getElementById('mim-inv-id').value = invId;
  document.getElementById('mim-error').textContent = '';
  document.getElementById('mim-tipo').value = 'Suscripción';
  document.getElementById('mim-monto').value = '';
  document.getElementById('mim-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('mim-obs').value = '';
  document.getElementById('modal-mov-inversion').classList.remove('hidden');
}

function closeModalMovInversion() { document.getElementById('modal-mov-inversion').classList.add('hidden'); }
document.getElementById('mim-close').addEventListener('click', closeModalMovInversion);
document.getElementById('mim-cancelar').addEventListener('click', closeModalMovInversion);

document.getElementById('mim-guardar').addEventListener('click', async () => {
  const err = document.getElementById('mim-error');
  err.textContent = '';
  const invId = document.getElementById('mim-inv-id').value;
  const tipo = document.getElementById('mim-tipo').value;
  const monto = parseFloat(document.getElementById('mim-monto').value) || 0;
  const fecha = document.getElementById('mim-fecha').value;
  if (!monto || !fecha) { err.textContent = 'Monto y fecha son obligatorios.'; return; }
  const inv = inversiones.find(x => x.id === invId);
  let nuevoSaldo = inv.saldo_actual;
  if (tipo === 'Suscripción') nuevoSaldo += monto;
  else if (tipo === 'Rescate') nuevoSaldo -= monto;
  else if (tipo === 'Actualización manual') nuevoSaldo = monto;
  if (nuevoSaldo < 0) { err.textContent = 'El rescate supera el saldo disponible.'; return; }
  try {
    await sb.from('inversion_movimientos').insert({
      inversion_id: invId, fecha, tipo, monto,
      saldo_post: nuevoSaldo,
      observaciones: document.getElementById('mim-obs').value || null,
    });
    await sb.from('inversiones').update({
      saldo_actual: nuevoSaldo,
      estado: nuevoSaldo <= 0 ? 'Rescatada' : 'Activa',
    }).eq('id', invId);
    closeModalMovInversion();
    await loadInversiones();
    showToast('✓ Movimiento registrado.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

// ── VER DETALLE INVERSION ─────────────────────────────────────────────────────
function verInversion(id) {
  const inv = inversiones.find(x => x.id === id);
  if (!inv) return;
  const saldoConIntereses = calcularSaldoConIntereses(inv);
  const intereses = calcularInteresesAcumulados(inv);
  const movs = (inv.inversion_movimientos || []).sort((a, b) => b.fecha.localeCompare(a.fecha));
  let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.25rem">
      <div class="stat-card"><div class="stat-label">Saldo actual</div><div class="stat-value">${inv.moneda === 'USD' ? 'U$S' : '$'} ${fmt(inv.saldo_actual)}</div></div>
      <div class="stat-card"><div class="stat-label">Intereses acumulados (est.)</div><div class="stat-value pos">+ ${inv.moneda === 'USD' ? 'U$S' : '$'} ${fmt(intereses)}</div></div>
      <div class="stat-card"><div class="stat-label">Saldo + intereses</div><div class="stat-value pos">${inv.moneda === 'USD' ? 'U$S' : '$'} ${fmt(saldoConIntereses)}</div></div>
      <div class="stat-card"><div class="stat-label">TNA</div><div class="stat-value">${inv.tna ? inv.tna + '%' : '—'}</div></div>
    </div>
    <table style="width:100%;font-size:13px">
      <thead><tr><th>Fecha</th><th>Tipo</th><th class="r">Monto</th><th class="r">Saldo post</th></tr></thead>
      <tbody>
      ${movs.map(m => `<tr>
        <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${m.fecha}</td>
        <td><span class="badge ${m.tipo === 'Rescate' ? 'b-eg' : 'b-ing'}">${m.tipo}</span></td>
        <td class="r" style="font-family:var(--mono)">${inv.moneda === 'USD' ? 'U$S' : '$'} ${fmt(m.monto)}</td>
        <td class="r" style="font-family:var(--mono)">${inv.moneda === 'USD' ? 'U$S' : '$'} ${fmt(m.saldo_post)}</td>
      </tr>`).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('detalle-content').innerHTML = html;
  document.getElementById('modal-detalle').classList.remove('hidden');
}

// ── RENDER INVERSIONES ────────────────────────────────────────────────────────
function renderInversiones() {
  const tbody = document.getElementById('inversiones-body');
  if (!tbody) return;

  const totalActivo = inversiones.filter(i => i.estado === 'Activa').reduce((s, i) => s + calcularSaldoConIntereses(i), 0);
  document.getElementById('inv-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total invertido activo</div><div class="stat-value pos">$ ${fmt(totalActivo)}</div></div>
    <div class="stat-card"><div class="stat-label">Inversiones activas</div><div class="stat-value">${inversiones.filter(i => i.estado === 'Activa').length}</div></div>
    <div class="stat-card"><div class="stat-label">Total inversiones</div><div class="stat-value">${inversiones.length}</div></div>
  `;

  if (!inversiones.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Sin inversiones. Hacé clic en "+ Nueva inversión".</div></td></tr>`;
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
  const ok = await confirmarEliminar('¿Eliminar esta inversión? Esta acción no se puede deshacer.');
  if (!ok) return;
  await sb.from('inversiones').delete().eq('id', id);
  await loadInversiones();
  showToast('✓ Inversión eliminada.', 'info');
}

// ── CUENTAS CORRIENTES ────────────────────────────────────────────────────────
let cuentasCorrientes = [];

async function loadCuentasCorrientes() {
  const { data } = await sb.from('cuentas_corrientes')
    .select('*').order('fecha', { ascending: false });
  cuentasCorrientes = data || [];
  renderEmpresas();
}

function getSaldoEmpresa(empresaId) {
  const movs = cuentasCorrientes.filter(c => c.empresa_id === empresaId);
  return movs.reduce((s, c) => s + (c.debe || 0) - (c.haber || 0), 0);
}

async function generarAsientoComprobante({ userId, movId, fecha, detalle, tipo, concepto, lineas, totalNeto, totalIva, total, empresaObj, cancelId, cancelNombre }) {
  const ctaACobrar = cuentas.find(c => c.nombre === 'Cuentas a cobrar');
  const ctaAPagar = cuentas.find(c => c.nombre === 'Cuentas a pagar');
  const ctaIvaDB = cuentas.find(c => c.nombre === 'IVA Débito Fiscal');
  const ctaIvaCR = cuentas.find(c => c.nombre === 'IVA Crédito Fiscal');

  let asientoLineas = [];

  if (tipo === 'Ingreso') {
    // DEBE: Cuentas a cobrar (o cuenta de cancelación) por el total
    const cuentaDebe = cancelId
      ? { id: cancelId, nombre: cancelNombre }
      : { id: ctaACobrar?.id, nombre: 'Cuentas a cobrar' };
    asientoLineas.push({ cuenta_id: cuentaDebe.id || null, cuenta_nombre: cuentaDebe.nombre, debe: total, haber: 0 });

    // HABER: cada línea de ingreso por su neto
    lineas.forEach(l => {
      asientoLineas.push({ cuenta_id: l.cuenta_id || null, cuenta_nombre: l.cuenta_nombre, debe: 0, haber: l.monto_neto });
    });

    // HABER: IVA Débito Fiscal si hay IVA
    if (totalIva > 0) {
      asientoLineas.push({ cuenta_id: ctaIvaDB?.id || null, cuenta_nombre: 'IVA Débito Fiscal', debe: 0, haber: totalIva });
    }

  } else if (tipo === 'Egreso') {
    // DEBE: cada línea de egreso por su neto
    lineas.forEach(l => {
      asientoLineas.push({ cuenta_id: l.cuenta_id || null, cuenta_nombre: l.cuenta_nombre, debe: l.monto_neto, haber: 0 });
    });

    // DEBE: IVA Crédito Fiscal si hay IVA
    if (totalIva > 0) {
      asientoLineas.push({ cuenta_id: ctaIvaCR?.id || null, cuenta_nombre: 'IVA Crédito Fiscal', debe: totalIva, haber: 0 });
    }

    // HABER: Cuentas a pagar (o cuenta de cancelación) por el total
    const cuentaHaber = cancelId
      ? { id: cancelId, nombre: cancelNombre }
      : { id: ctaAPagar?.id, nombre: 'Cuentas a pagar' };
    asientoLineas.push({ cuenta_id: cuentaHaber.id || null, cuenta_nombre: cuentaHaber.nombre, debe: 0, haber: total });
  }

  // Crear asiento
  const { data: asiento } = await sb.from('asientos').insert({
    user_id: userId, fecha,
    descripcion: `${tipo} — ${detalle}${empresaObj ? ' (' + empresaObj.nombre + ')' : ''}`,
    empresa_id: empresaObj?.id || null,
  }).select().single();

  await sb.from('asiento_lineas').insert(asientoLineas.map(l => ({ ...l, asiento_id: asiento.id })));
  await sb.from('movimientos').update({ asiento_id: asiento.id }).eq('id', movId);

  // Cuenta corriente empresa
  if (empresaObj && concepto) {
    const ccMovs = cuentasCorrientes.filter(c => c.empresa_id === empresaObj.id);
    const saldoAnterior = ccMovs.reduce((s, c) => s + (c.debe || 0) - (c.haber || 0), 0);
    const conceptosQueDebian = ['factura_emitida', 'nota_debito_emitida'];
    const conceptosQueAcreditan = ['nota_credito_emitida', 'cobro_efectivo'];
    const conceptosQueDebo = ['factura_recibida', 'nota_debito_recibida'];
    const conceptosQueCancelo = ['nota_credito_recibida', 'pago_realizado'];
    let debe = 0, haber = 0;
    if (conceptosQueDebian.includes(concepto)) debe = total;
    else if (conceptosQueAcreditan.includes(concepto)) haber = total;
    else if (conceptosQueDebo.includes(concepto)) haber = total;
    else if (conceptosQueCancelo.includes(concepto)) debe = total;
    if (debe > 0 || haber > 0) {
      await sb.from('cuentas_corrientes').insert({
        user_id: userId, empresa_id: empresaObj.id, movimiento_id: movId,
        fecha, descripcion: detalle, debe, haber,
        saldo: saldoAnterior + debe - haber,
      });
    }
  }
}

// ── COBRAR / PAGAR EMPRESA ────────────────────────────────────────────────────
function openModalCobrarPagar(empresaId) {
  const emp = empresas.find(e => e.id === empresaId);
  const saldo = getSaldoEmpresa(empresaId);
  document.getElementById('cp-empresa-id').value = empresaId;
  document.getElementById('cp-empresa-nombre').textContent = emp?.nombre || '';
  document.getElementById('cp-saldo-actual').textContent = (saldo >= 0 ? 'Nos debe: $ ' : 'Les debemos: $ ') + fmt(Math.abs(saldo));
  document.getElementById('cp-saldo-actual').className = saldo >= 0 ? 'pos-text' : 'neg-text';
  document.getElementById('cp-tipo').value = saldo >= 0 ? 'Cobro' : 'Pago';
  document.getElementById('cp-monto').value = fmt(Math.abs(saldo)).replace(/\./g, '');
  document.getElementById('cp-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('cp-cuenta').value = '';
  document.getElementById('cp-obs').value = '';
  document.getElementById('cp-error').textContent = '';
  populateCpCuentaSelect();
  document.getElementById('modal-cobrar-pagar').classList.remove('hidden');
}

function populateCpCuentaSelect() {
  const sel = document.getElementById('cp-cuenta');
  sel.innerHTML = '<option value="">Seleccionar cuenta...</option>';
  cuentas.filter(c => c.tipo === 'Activo').forEach(c => {
    sel.innerHTML += `<option value="${c.id}|${c.nombre}">${c.codigo} — ${c.nombre}</option>`;
  });
}

function closeModalCobrarPagar() { document.getElementById('modal-cobrar-pagar').classList.add('hidden'); }
document.getElementById('cp-close').addEventListener('click', closeModalCobrarPagar);
document.getElementById('cp-cancelar').addEventListener('click', closeModalCobrarPagar);

document.getElementById('cp-guardar').addEventListener('click', async () => {
  const err = document.getElementById('cp-error');
  err.textContent = '';
  const empresaId = document.getElementById('cp-empresa-id').value;
  const tipo = document.getElementById('cp-tipo').value;
  const monto = parseFloat(document.getElementById('cp-monto').value) || 0;
  const fecha = document.getElementById('cp-fecha').value;
  const cuentaVal = document.getElementById('cp-cuenta').value;
  if (!monto || !fecha || !cuentaVal) { err.textContent = 'Completá todos los campos.'; return; }

  const [cuentaId, cuentaNombre] = cuentaVal.split('|');
  const emp = empresas.find(e => e.id === empresaId);
  const saldoActual = getSaldoEmpresa(empresaId);

  try {
    const { data: { user } } = await sb.auth.getUser();

    // Asiento de cancelación
    const ctaACobrar = cuentas.find(c => c.nombre === 'Cuentas a cobrar');
    const ctaAPagar = cuentas.find(c => c.nombre === 'Cuentas a pagar');

    let lineas = [];
    if (tipo === 'Cobro') {
      lineas = [
        { cuenta_id: cuentaId, cuenta_nombre: cuentaNombre, debe: monto, haber: 0 },
        { cuenta_id: ctaACobrar?.id || null, cuenta_nombre: 'Cuentas a cobrar', debe: 0, haber: monto },
      ];
    } else {
      lineas = [
        { cuenta_id: ctaAPagar?.id || null, cuenta_nombre: 'Cuentas a pagar', debe: monto, haber: 0 },
        { cuenta_id: cuentaId, cuenta_nombre: cuentaNombre, debe: 0, haber: monto },
      ];
    }

    const desc = `${tipo} — ${emp?.nombre || ''} — $ ${fmt(monto)}`;
    const { data: asiento } = await sb.from('asientos').insert({
      user_id: user.id, fecha, descripcion: desc, empresa_id: empresaId,
      observaciones: document.getElementById('cp-obs').value || null,
    }).select().single();

    await sb.from('asiento_lineas').insert(lineas.map(l => ({ ...l, asiento_id: asiento.id })));

    // Registrar en cuenta corriente (cancelación)
    const debe = tipo === 'Pago' ? monto : 0;
    const haber = tipo === 'Cobro' ? monto : 0;
    await sb.from('cuentas_corrientes').insert({
      user_id: user.id, empresa_id: empresaId, fecha,
      descripcion: desc,
      debe, haber,
      saldo: saldoActual - haber + debe,
    });

    // Registrar movimiento
    await sb.from('movimientos').insert({
      user_id: user.id, fecha,
      tipo: tipo === 'Cobro' ? 'Ingreso' : 'Egreso',
      detalle: desc,
      empresa: emp?.nombre || null,
      empresa_id: empresaId,
      monto,
      asiento_id: asiento.id,
    });

    closeModalCobrarPagar();
    await loadMovimientos();
    await loadCuentasCorrientes();
    await loadAsientos();
    showToast('✓ Cobro/pago registrado.');
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

// ── UX GLOBAL ─────────────────────────────────────────────────────────────────

// Mapa de todos los modales con su función de cierre
const MODALES = [
  { id: 'modal-overlay', close: () => closeModal() },
  { id: 'modal-empresa', close: () => closeModalEmpresa() },
  { id: 'modal-cuenta', close: () => closeModalCuenta() },
  { id: 'modal-asiento', close: () => closeModalAsiento() },
  { id: 'modal-detalle', close: () => document.getElementById('modal-detalle').classList.add('hidden') },
  { id: 'modal-inversion', close: () => closeModalInversion() },
  { id: 'modal-mov-inversion', close: () => closeModalMovInversion() },
  { id: 'modal-cobrar-pagar', close: () => closeModalCobrarPagar() },
  { id: 'modal-confirm', close: () => document.getElementById('modal-confirm').classList.add('hidden') },
];

// Cierre al hacer click fuera del modal (en el overlay)
MODALES.forEach(({ id, close }) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => {
    if (e.target === el) close();
  });
});

// Cierre con ESC — cierra el último modal abierto
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  // Busca el último modal visible (de atrás hacia adelante)
  const abierto = [...MODALES].reverse().find(({ id }) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
  if (abierto) abierto.close();
});

// Bloquear scroll del body cuando hay un modal abierto
const scrollObserver = new MutationObserver(() => {
  const hayModalAbierto = MODALES.some(({ id }) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
  document.body.style.overflow = hayModalAbierto ? 'hidden' : '';
});
MODALES.forEach(({ id }) => {
  const el = document.getElementById(id);
  if (el) scrollObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});

// Confirmaciones de eliminación con toast en lugar de confirm() nativo
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
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#_del-ok').onclick = () => cleanup(true);
    overlay.querySelector('#_del-cancel').onclick = () => cleanup(false);
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); cleanup(false); }
    });
  });
}

// Auto-focus al primer input de cada modal al abrirse
const autoFocusMap = {
  'modal-overlay': 'f-detalle',
  'modal-empresa': 'me-nombre',
  'modal-cuenta': 'mc-codigo',
  'modal-asiento': 'mas-desc',
  'modal-inversion': 'mi-nombre',
  'modal-mov-inversion': 'mim-monto',
  'modal-cobrar-pagar': 'cp-monto',
};

const focusObserver = new MutationObserver((mutations) => {
  mutations.forEach(({ target }) => {
    const id = target.id;
    if (!target.classList.contains('hidden') && autoFocusMap[id]) {
      setTimeout(() => {
        const input = document.getElementById(autoFocusMap[id]);
        if (input) input.focus();
      }, 50);
    }
  });
});
Object.keys(autoFocusMap).forEach(id => {
  const el = document.getElementById(id);
  if (el) focusObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});