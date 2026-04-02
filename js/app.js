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

function showSuccessBanner(msg) {
  const b = document.createElement('div');
  b.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);background:var(--green-bg);color:var(--green);border:1px solid #a8d5b5;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,0.1)';
  b.textContent = msg; document.body.appendChild(b); setTimeout(() => b.remove(), 5000);
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email-display').textContent = user.email;
  loadAll().then(() => initCuentasPredefinidas());
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
const titles = { movimientos: 'Movimientos', er: 'Estado de resultados', flujo: 'Flujo de fondos', empresas: 'Empresas', cuentas: 'Plan de cuentas', asientos: 'Asientos contables', saldos: 'Saldos por cuenta' };

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('page-title').textContent = titles[page];
    const btnNuevo = document.getElementById('btn-nuevo');
    btnNuevo.textContent = page === 'empresas' ? '+ Nueva empresa' : page === 'cuentas' ? '+ Nueva cuenta' : page === 'asientos' ? '+ Nuevo asiento' : '+ Nuevo movimiento';
    btnNuevo.dataset.context = page;
    if (page === 'er') renderER();
    if (page === 'flujo') renderFlujo();
    if (page === 'empresas') renderEmpresas();
    if (page === 'cuentas') renderCuentas();
    if (page === 'asientos') loadAsientos();
    if (page === 'saldos') renderSaldos();
  });
});

document.getElementById('btn-nuevo').addEventListener('click', () => {
  const ctx = document.getElementById('btn-nuevo').dataset.context || 'movimientos';
  if (ctx === 'empresas') openModalEmpresa();
  else if (ctx === 'cuentas') openModalCuenta();
  else if (ctx === 'asientos') openModalAsiento();
  else openModal();
});

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadMovimientos(), loadEmpresas(), loadCuentas()]);
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
  const map = { 'Ingreso': 'b-ing', 'Egreso': 'b-eg', 'Inversión': 'b-inv', 'Préstamo': 'b-inv', 'Tarjeta de crédito': 'b-tar', 'Banco / Transferencia': 'b-ban' };
  return 'badge ' + (map[tipo] || 'b-ing');
}

// ── MODAL MOVIMIENTO ──────────────────────────────────────────────────────────
function openModal(id) {
  editId = id || null;
  document.getElementById('modal-title').textContent = editId ? 'Editar movimiento' : 'Nuevo movimiento';
  document.getElementById('form-error').textContent = '';
  clearForm();
  populateEmpresaSelect();
  if (editId) { const m = movimientos.find(x => x.id === editId); if (m) fillForm(m); }
  else document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

function populateEmpresaSelect() {
  const sel = document.getElementById('f-empresa-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Sin empresa</option>';
  empresas.forEach(e => { sel.innerHTML += `<option value="${e.id}">${e.nombre}${e.cuit ? ' — ' + e.cuit : ''}</option>`; });
  sel.value = cur;
}

function clearForm() {
  ['fecha', 'detalle', 'monto', 'neto', 'tc', 'usd', 'cuenta', 'doc', 'obs'].forEach(f => {
    const el = document.getElementById('f-' + f); if (el) el.value = '';
  });
  document.getElementById('f-tipo').value = 'Ingreso';
  const sel = document.getElementById('f-empresa-select'); if (sel) sel.value = '';
}

function fillForm(m) {
  document.getElementById('f-fecha').value = m.fecha || '';
  document.getElementById('f-tipo').value = m.tipo || 'Ingreso';
  document.getElementById('f-detalle').value = m.detalle || '';
  document.getElementById('f-monto').value = m.monto || '';
  document.getElementById('f-neto').value = m.monto_neto || '';
  document.getElementById('f-tc').value = m.tipo_cambio || '';
  document.getElementById('f-usd').value = m.usd || '';
  document.getElementById('f-cuenta').value = m.clasificacion || '';
  document.getElementById('f-doc').value = m.documento || '';
  document.getElementById('f-obs').value = m.observaciones || '';
  const sel = document.getElementById('f-empresa-select');
  if (sel) sel.value = m.empresa_id || '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancelar').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  const fecha = document.getElementById('f-fecha').value;
  const detalle = document.getElementById('f-detalle').value.trim();
  const monto = document.getElementById('f-monto').value;
  if (!fecha || !detalle || !monto) { errEl.textContent = 'Completá los campos obligatorios: Fecha, Detalle y Monto.'; return; }
  const empresaId = document.getElementById('f-empresa-select').value || null;
  const empresaObj = empresaId ? empresas.find(e => e.id === empresaId) : null;
  const mov = {
    fecha, tipo: document.getElementById('f-tipo').value, detalle,
    empresa: empresaObj ? empresaObj.nombre : null,
    empresa_id: empresaId,
    cuit: empresaObj ? empresaObj.cuit : null,
    monto: parseFloat(monto) || 0,
    monto_neto: parseFloat(document.getElementById('f-neto').value) || null,
    tipo_cambio: parseFloat(document.getElementById('f-tc').value) || null,
    usd: parseFloat(document.getElementById('f-usd').value) || null,
    clasificacion: document.getElementById('f-cuenta').value || null,
    documento: document.getElementById('f-doc').value || null,
    observaciones: document.getElementById('f-obs').value || null,
  };
  try {
    if (editId) await sb.from('movimientos').update(mov).eq('id', editId);
    else { const { data: { user } } = await sb.auth.getUser(); await sb.from('movimientos').insert({ ...mov, user_id: user.id }); }
    closeModal(); await loadMovimientos();
  } catch (e) { errEl.textContent = 'Error al guardar: ' + e.message; }
});

// ── MODAL EMPRESA ─────────────────────────────────────────────────────────────
function openModalEmpresa(id) {
  const emp = id ? empresas.find(e => e.id === id) : null;
  document.getElementById('me-title').textContent = emp ? 'Editar empresa' : 'Nueva empresa';
  document.getElementById('me-error').textContent = '';
  document.getElementById('me-id').value = emp ? emp.id : '';
  document.getElementById('me-nombre').value = emp ? emp.nombre : '';
  document.getElementById('me-cuit').value = emp ? emp.cuit || '' : '';
  document.getElementById('me-iva').value = emp ? emp.condicion_iva || '' : '';
  document.getElementById('me-email').value = emp ? emp.email || '' : '';
  document.getElementById('me-tel').value = emp ? emp.telefono || '' : '';
  document.getElementById('me-dir').value = emp ? emp.direccion || '' : '';
  document.getElementById('modal-empresa').classList.remove('hidden');
}

function closeModalEmpresa() { document.getElementById('modal-empresa').classList.add('hidden'); }
document.getElementById('me-close').addEventListener('click', closeModalEmpresa);
document.getElementById('me-cancelar').addEventListener('click', closeModalEmpresa);

document.getElementById('me-guardar').addEventListener('click', async () => {
  const err = document.getElementById('me-error');
  err.textContent = '';
  const nombre = document.getElementById('me-nombre').value.trim();
  if (!nombre) { err.textContent = 'El nombre es obligatorio.'; return; }
  const id = document.getElementById('me-id').value;
  const data = {
    nombre, cuit: document.getElementById('me-cuit').value || null,
    condicion_iva: document.getElementById('me-iva').value || null,
    email: document.getElementById('me-email').value || null,
    telefono: document.getElementById('me-tel').value || null,
    direccion: document.getElementById('me-dir').value || null,
  };
  try {
    if (id) { await sb.from('empresas').update(data).eq('id', id); }
    else { const { data: { user } } = await sb.auth.getUser(); await sb.from('empresas').insert({ ...data, user_id: user.id }); }
    closeModalEmpresa(); await loadEmpresas(); renderEmpresas();
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

async function eliminarEmpresa(id) {
  if (!confirm('¿Eliminar esta empresa?')) return;
  await sb.from('empresas').delete().eq('id', id);
  await loadEmpresas(); renderEmpresas();
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
  if (!codigo || !nombre) { err.textContent = 'Código y nombre son obligatorios.'; return; }
  const id = document.getElementById('mc-id').value;
  const data = { codigo, nombre, tipo: document.getElementById('mc-tipo').value };
  try {
    if (id) { await sb.from('cuentas').update(data).eq('id', id); }
    else { const { data: { user } } = await sb.auth.getUser(); await sb.from('cuentas').insert({ ...data, user_id: user.id }); }
    closeModalCuenta(); await loadCuentas(); renderCuentas();
  } catch (e) { err.textContent = 'Error: ' + e.message; }
});

async function eliminarCuenta(id) {
  if (!confirm('¿Eliminar esta cuenta?')) return;
  await sb.from('cuentas').delete().eq('id', id);
  await loadCuentas(); renderCuentas();
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

function populateMesFilter() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0, 7) : '').filter(Boolean))].sort().reverse();
  const cont = document.getElementById('filter-mes-options');
  if (!cont) return;
  cont.innerHTML = meses.map(m => {
    const [y, mo] = m.split('-');
    const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `<label class="chk-option"><input type="checkbox" value="${m}"> ${nom[parseInt(mo) - 1]} ${y}</label>`;
  }).join('');
  cont.querySelectorAll('input').forEach(i => i.addEventListener('change', renderTable));
}

function populateTipoFilter() {
  const tipos = ['Ingreso', 'Egreso', 'Inversión', 'Préstamo', 'Tarjeta de crédito', 'Banco / Transferencia'];
  const cont = document.getElementById('filter-tipo-options');
  if (!cont) return;
  cont.innerHTML = tipos.map(t => `<label class="chk-option"><input type="checkbox" value="${t}"> ${t}</label>`).join('');
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
        <button class="btn btn-sm btn-del" onclick="confirmarEliminar('${m.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function confirmarEliminar(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  await sb.from('movimientos').delete().eq('id', id);
  await loadMovimientos();
}

// ── RENDER EMPRESAS ───────────────────────────────────────────────────────────
function renderEmpresas() {
  const tbody = document.getElementById('empresas-body');
  if (!tbody) return;
  if (!empresas.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Sin empresas. Hacé clic en "+ Nueva empresa".</div></td></tr>`;
    return;
  }
  tbody.innerHTML = empresas.map(e => `
    <tr>
      <td style="font-weight:500">${e.nombre}</td>
      <td class="muted-text" style="font-family:var(--mono);font-size:12px">${e.cuit || '—'}</td>
      <td class="muted-text">${e.condicion_iva || '—'}</td>
      <td class="muted-text">${e.email || '—'}</td>
      <td class="muted-text">${e.telefono || '—'}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm" onclick="openModalEmpresa('${e.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarEmpresa('${e.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ── RENDER CUENTAS ────────────────────────────────────────────────────────────
function renderCuentas() {
  const tbody = document.getElementById('cuentas-body');
  if (!tbody) return;
  if (!cuentas.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Sin cuentas. Hacé clic en "+ Nueva cuenta".</div></td></tr>`;
    return;
  }
  const tipoColor = { Activo: 'b-ing', Pasivo: 'b-eg', Patrimonio: 'b-inv', Ingreso: 'b-ban', Egreso: 'b-tar' };
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
  const getTotal = (tipo, mes) => movimientos.filter(m => m.tipo === tipo && (m.fecha || '').startsWith(mes)).reduce((s, m) => s + (m.monto || 0), 0);
  const categorias = [
    { label: 'Ingresos', tipo: 'Ingreso', sign: 1 },
    { label: 'Egresos', tipo: 'Egreso', sign: -1 },
    { label: 'Tarjetas de crédito', tipo: 'Tarjeta de crédito', sign: -1 },
    { label: 'Bancos / Transferencias', tipo: 'Banco / Transferencia', sign: 1 },
    { label: 'Inversiones', tipo: 'Inversión', sign: 1 },
    { label: 'Préstamos', tipo: 'Préstamo', sign: 1 },
  ];
  let html = '<thead><tr><th>Rubro</th>';
  meses.forEach(m => { const [y, mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo) - 1]} ${y}</th>`; });
  html += '<th class="r">Total</th></tr></thead><tbody>';
  categorias.forEach(cat => {
    html += `<tr><td>${cat.label}</td>`;
    let rowTotal = 0;
    meses.forEach(mes => {
      const v = getTotal(cat.tipo, mes) * cat.sign; rowTotal += v;
      html += `<td class="r ${v < 0 ? 'neg-text' : v > 0 ? 'pos-text' : 'muted-text'}">$ ${fmt(Math.abs(v))}</td>`;
    });
    html += `<td class="r ${rowTotal < 0 ? 'neg-text' : 'pos-text'}" style="font-weight:500">$ ${fmt(Math.abs(rowTotal))}</td></tr>`;
  });
  html += '<tr class="er-total"><td>Resultado neto</td>';
  let grand = 0;
  meses.forEach(mes => {
    const res = getTotal('Ingreso', mes) - getTotal('Egreso', mes) - getTotal('Tarjeta de crédito', mes);
    grand += res; html += `<td class="r">$ ${fmt(res)}</td>`;
  });
  html += `<td class="r">$ ${fmt(grand)}</td></tr></tbody>`;
  document.getElementById('er-table').innerHTML = html;
}

// ── FLUJO DE FONDOS ───────────────────────────────────────────────────────────
function renderFlujo() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0, 7) : '').filter(Boolean))].sort();
  if (!meses.length) { document.getElementById('flujo-stats').innerHTML = ''; document.getElementById('flujo-table').innerHTML = `<tr><td><div class="empty-state">Sin datos.</div></td></tr>`; return; }
  const nom = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const getSum = (tipos, mes) => movimientos.filter(m => tipos.includes(m.tipo) && (m.fecha || '').startsWith(mes)).reduce((s, m) => s + (m.monto || 0), 0);
  const filas = [
    { label: 'Ingresos', tipos: ['Ingreso'], sign: 1 },
    { label: 'Egresos', tipos: ['Egreso'], sign: -1 },
    { label: 'Tarjetas', tipos: ['Tarjeta de crédito'], sign: -1 },
    { label: 'Bancos / Transf.', tipos: ['Banco / Transferencia'], sign: 1 },
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
  const totalIng = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const totalEg = movimientos.filter(m => m.tipo === 'Egreso' || m.tipo === 'Tarjeta de crédito').reduce((s, m) => s + (m.monto || 0), 0);
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
  document.querySelector('.filter-dropdown:nth-child(2)').classList.toggle('open');
  document.querySelector('.filter-dropdown:nth-child(3)').classList.remove('open');
});

document.getElementById('btn-filter-mes').addEventListener('click', e => {
  e.stopPropagation();
  document.querySelector('.filter-dropdown:nth-child(3)').classList.toggle('open');
  document.querySelector('.filter-dropdown:nth-child(2)').classList.remove('open');
});

document.addEventListener('click', () => {
  document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
});

// ── ASIENTOS (PARTIDA DOBLE) ──────────────────────────────────────────────────
let asientos = [], asientoLineas = [], editAsientoId = null;

const CUENTAS_PREDEFINIDAS = [
  { codigo: '01.01', nombre: 'Efectivo ARS', tipo: 'Activo' },
  { codigo: '01.02', nombre: 'Efectivo USD', tipo: 'Activo' },
  { codigo: '01.03', nombre: 'Banco Galicia', tipo: 'Activo' },
  { codigo: '01.04', nombre: 'Banco Nación', tipo: 'Activo' },
  { codigo: '01.05', nombre: 'Banco BBVA', tipo: 'Activo' },
  { codigo: '01.06', nombre: 'Mercado Pago', tipo: 'Activo' },
  { codigo: '02.01', nombre: 'Cuentas a pagar', tipo: 'Pasivo' },
  { codigo: '02.02', nombre: 'Cuentas a cobrar', tipo: 'Activo' },
  { codigo: '02.03', nombre: 'Tarjeta de crédito', tipo: 'Pasivo' },
  { codigo: '03.01', nombre: 'Ventas', tipo: 'Ingreso' },
  { codigo: '03.02', nombre: 'Otros ingresos', tipo: 'Ingreso' },
  { codigo: '04.01', nombre: 'Compras', tipo: 'Egreso' },
  { codigo: '04.02', nombre: 'Sueldos', tipo: 'Egreso' },
  { codigo: '04.03', nombre: 'Impuestos', tipo: 'Egreso' },
  { codigo: '04.04', nombre: 'Gastos generales', tipo: 'Egreso' },
];

async function initCuentasPredefinidas() {
  if (cuentas.length > 0) return;
  const { data: { user } } = await sb.auth.getUser();
  const rows = CUENTAS_PREDEFINIDAS.map(c => ({ ...c, user_id: user.id }));
  await sb.from('cuentas').insert(rows);
  await loadCuentas();
  renderCuentas();
}

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
function openModalAsiento(id) {
  editAsientoId = id || null;
  document.getElementById('mas-title').textContent = editAsientoId ? 'Editar asiento' : 'Nuevo asiento';
  document.getElementById('mas-error').textContent = '';

  if (editAsientoId) {
    const a = asientos.find(x => x.id === editAsientoId);
    document.getElementById('mas-fecha').value = a.fecha || '';
    document.getElementById('mas-desc').value = a.descripcion || '';
    document.getElementById('mas-doc').value = a.documento || '';
    document.getElementById('mas-obs').value = a.observaciones || '';
    document.getElementById('mas-empresa').value = a.empresa_id || '';
    renderLineas(a.asiento_lineas || []);
  } else {
    document.getElementById('mas-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('mas-desc').value = '';
    document.getElementById('mas-doc').value = '';
    document.getElementById('mas-obs').value = '';
    document.getElementById('mas-empresa').value = '';
    renderLineas([
      { cuenta_id: '', debe: '', haber: '' },
      { cuenta_id: '', debe: '', haber: '' },
    ]);
  }
  populateMasEmpresa();
  document.getElementById('modal-asiento').classList.remove('hidden');
}

function closeModalAsiento() { document.getElementById('modal-asiento').classList.add('hidden'); }
document.getElementById('mas-close').addEventListener('click', closeModalAsiento);
document.getElementById('mas-cancelar').addEventListener('click', closeModalAsiento);
document.getElementById('mas-add-linea').addEventListener('click', () => {
  const lineas = getLineasActuales();
  lineas.push({ cuenta_id: '', debe: '', haber: '' });
  renderLineas(lineas);
});

function populateMasEmpresa() {
  const sel = document.getElementById('mas-empresa');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Sin empresa</option>';
  empresas.forEach(e => { sel.innerHTML += `<option value="${e.id}">${e.nombre}</option>`; });
  sel.value = cur;
}

function renderLineas(lineas) {
  const cont = document.getElementById('mas-lineas');
  cont.innerHTML = lineas.map((l, i) => `
    <div class="linea-row" data-i="${i}">
      <select class="linea-cuenta" style="flex:2">
        <option value="">Seleccionar cuenta...</option>
        ${cuentaOptions(l.cuenta_id)}
      </select>
      <input type="number" class="linea-debe" placeholder="Debe" value="${l.debe || ''}" step="0.01" style="flex:1;min-width:90px">
      <input type="number" class="linea-haber" placeholder="Haber" value="${l.haber || ''}" step="0.01" style="flex:1;min-width:90px">
      <button class="btn btn-sm btn-del" onclick="eliminarLinea(${i})" style="flex-shrink:0">✕</button>
    </div>
  `).join('');
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
  return [...document.querySelectorAll('.linea-row')].map(row => ({
    cuenta_id: row.querySelector('.linea-cuenta').value,
    cuenta_nombre: row.querySelector('.linea-cuenta').selectedOptions[0]?.text || '',
    debe: parseFloat(row.querySelector('.linea-debe').value) || 0,
    haber: parseFloat(row.querySelector('.linea-haber').value) || 0,
  }));
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
    const asientoData = {
      fecha, descripcion: desc,
      empresa_id: document.getElementById('mas-empresa').value || null,
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
  if (!confirm('¿Eliminar este asiento?')) return;
  await sb.from('asientos').delete().eq('id', id);
  await loadAsientos();
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