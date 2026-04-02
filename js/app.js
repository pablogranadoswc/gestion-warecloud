const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let movimientos = [], empresas = [], cuentas = [], editId = null;

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function checkSession() {
  const hash = window.location.hash;
  if (hash && hash.includes('type=signup')) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { showApp(session.user); showSuccessBanner('✓ Cuenta confirmada. ¡Bienvenido!'); window.history.replaceState(null,'',window.location.pathname); return; }
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
  loadAll();
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const err   = document.getElementById('login-error');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Completá email y contraseña.'; return; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { err.textContent = error.message; return; }
  showApp(data.user);
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const err   = document.getElementById('login-error');
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
const titles = { movimientos:'Movimientos', er:'Estado de resultados', flujo:'Flujo de fondos', empresas:'Empresas', cuentas:'Plan de cuentas' };

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('page-title').textContent = titles[page];
    const btnNuevo = document.getElementById('btn-nuevo');
    btnNuevo.textContent = page === 'empresas' ? '+ Nueva empresa' : page === 'cuentas' ? '+ Nueva cuenta' : '+ Nuevo movimiento';
    btnNuevo.dataset.context = page;
    if (page === 'er') renderER();
    if (page === 'flujo') renderFlujo();
    if (page === 'empresas') renderEmpresas();
    if (page === 'cuentas') renderCuentas();
  });
});

document.getElementById('btn-nuevo').addEventListener('click', () => {
  const ctx = document.getElementById('btn-nuevo').dataset.context || 'movimientos';
  if (ctx === 'empresas') openModalEmpresa();
  else if (ctx === 'cuentas') openModalCuenta();
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
  const map = { 'Ingreso':'b-ing','Egreso':'b-eg','Inversión':'b-inv','Préstamo':'b-inv','Tarjeta de crédito':'b-tar','Banco / Transferencia':'b-ban' };
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
  empresas.forEach(e => { sel.innerHTML += `<option value="${e.id}">${e.nombre}${e.cuit ? ' — '+e.cuit : ''}</option>`; });
  sel.value = cur;
}

function clearForm() {
  ['fecha','detalle','monto','neto','tc','usd','cuenta','doc','obs'].forEach(f => {
    const el = document.getElementById('f-'+f); if(el) el.value = '';
  });
  document.getElementById('f-tipo').value = 'Ingreso';
  const sel = document.getElementById('f-empresa-select'); if(sel) sel.value = '';
}

function fillForm(m) {
  document.getElementById('f-fecha').value   = m.fecha || '';
  document.getElementById('f-tipo').value    = m.tipo || 'Ingreso';
  document.getElementById('f-detalle').value = m.detalle || '';
  document.getElementById('f-monto').value   = m.monto || '';
  document.getElementById('f-neto').value    = m.monto_neto || '';
  document.getElementById('f-tc').value      = m.tipo_cambio || '';
  document.getElementById('f-usd').value     = m.usd || '';
  document.getElementById('f-cuenta').value  = m.clasificacion || '';
  document.getElementById('f-doc').value     = m.documento || '';
  document.getElementById('f-obs').value     = m.observaciones || '';
  const sel = document.getElementById('f-empresa-select');
  if (sel) sel.value = m.empresa_id || '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancelar').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  const fecha   = document.getElementById('f-fecha').value;
  const detalle = document.getElementById('f-detalle').value.trim();
  const monto   = document.getElementById('f-monto').value;
  if (!fecha || !detalle || !monto) { errEl.textContent = 'Completá los campos obligatorios: Fecha, Detalle y Monto.'; return; }
  const empresaId = document.getElementById('f-empresa-select').value || null;
  const empresaObj = empresaId ? empresas.find(e => e.id === empresaId) : null;
  const mov = {
    fecha, tipo: document.getElementById('f-tipo').value, detalle,
    empresa: empresaObj ? empresaObj.nombre : null,
    empresa_id: empresaId,
    cuit: empresaObj ? empresaObj.cuit : null,
    monto: parseFloat(monto) || 0,
    monto_neto:  parseFloat(document.getElementById('f-neto').value) || null,
    tipo_cambio: parseFloat(document.getElementById('f-tc').value) || null,
    usd:         parseFloat(document.getElementById('f-usd').value) || null,
    clasificacion: document.getElementById('f-cuenta').value || null,
    documento:   document.getElementById('f-doc').value || null,
    observaciones: document.getElementById('f-obs').value || null,
  };
  try {
    if (editId) await sb.from('movimientos').update(mov).eq('id', editId);
    else { const { data: { user } } = await sb.auth.getUser(); await sb.from('movimientos').insert({ ...mov, user_id: user.id }); }
    closeModal(); await loadMovimientos();
  } catch(e) { errEl.textContent = 'Error al guardar: ' + e.message; }
});

// ── MODAL EMPRESA ─────────────────────────────────────────────────────────────
function openModalEmpresa(id) {
  const emp = id ? empresas.find(e => e.id === id) : null;
  document.getElementById('me-title').textContent = emp ? 'Editar empresa' : 'Nueva empresa';
  document.getElementById('me-error').textContent = '';
  document.getElementById('me-id').value     = emp ? emp.id : '';
  document.getElementById('me-nombre').value = emp ? emp.nombre : '';
  document.getElementById('me-cuit').value   = emp ? emp.cuit || '' : '';
  document.getElementById('me-iva').value    = emp ? emp.condicion_iva || '' : '';
  document.getElementById('me-email').value  = emp ? emp.email || '' : '';
  document.getElementById('me-tel').value    = emp ? emp.telefono || '' : '';
  document.getElementById('me-dir').value    = emp ? emp.direccion || '' : '';
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
  } catch(e) { err.textContent = 'Error: ' + e.message; }
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
  document.getElementById('mc-id').value     = c ? c.id : '';
  document.getElementById('mc-codigo').value = c ? c.codigo : '';
  document.getElementById('mc-nombre').value = c ? c.nombre : '';
  document.getElementById('mc-tipo').value   = c ? c.tipo : 'Activo';
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
  } catch(e) { err.textContent = 'Error: ' + e.message; }
});

async function eliminarCuenta(id) {
  if (!confirm('¿Eliminar esta cuenta?')) return;
  await sb.from('cuentas').delete().eq('id', id);
  await loadCuentas(); renderCuentas();
}

// ── RENDER MOVIMIENTOS ────────────────────────────────────────────────────────
function renderAll() { renderStats(); renderTable(); populateMesFilter(); populateTipoFilter(); }

function renderStats() {
  const ingresos  = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s,m) => s+(m.monto||0), 0);
  const egresos   = movimientos.filter(m => m.tipo === 'Egreso' || m.tipo === 'Tarjeta de crédito').reduce((s,m) => s+(m.monto||0), 0);
  const resultado = ingresos - egresos;
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos totales</div><div class="stat-value pos">$ ${fmt(ingresos)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos totales</div><div class="stat-value neg">$ ${fmt(egresos)}</div></div>
    <div class="stat-card"><div class="stat-label">Resultado</div><div class="stat-value ${resultado >= 0 ? 'pos' : 'neg'}">$ ${fmt(resultado)}</div></div>
    <div class="stat-card"><div class="stat-label">Movimientos</div><div class="stat-value">${movimientos.length}</div></div>
  `;
}

function populateMesFilter() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0,7) : '').filter(Boolean))].sort().reverse();
  const cont = document.getElementById('filter-mes-options');
  if (!cont) return;
  cont.innerHTML = meses.map(m => {
    const [y,mo] = m.split('-');
    const nom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `<label class="chk-option"><input type="checkbox" value="${m}"> ${nom[parseInt(mo)-1]} ${y}</label>`;
  }).join('');
  cont.querySelectorAll('input').forEach(i => i.addEventListener('change', renderTable));
}

function populateTipoFilter() {
  const tipos = ['Ingreso','Egreso','Inversión','Préstamo','Tarjeta de crédito','Banco / Transferencia'];
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
  const tipos  = getSelectedCheckboxes('filter-tipo-options');
  const meses  = getSelectedCheckboxes('filter-mes-options');

  let list = movimientos.filter(m => {
    if (search && !((m.detalle||'').toLowerCase().includes(search) || (m.empresa||'').toLowerCase().includes(search) || (m.cuit||'').includes(search))) return false;
    if (tipos.length && !tipos.includes(m.tipo)) return false;
    if (meses.length && !meses.some(mes => (m.fecha||'').startsWith(mes))) return false;
    return true;
  });

  const tbody = document.getElementById('tabla-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Sin movimientos.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => `
    <tr>
      <td style="white-space:nowrap;font-family:var(--mono);font-size:12px;color:var(--text-muted)">${m.fecha||''}</td>
      <td>${m.detalle}</td>
      <td class="muted-text">${m.empresa||'—'}</td>
      <td class="muted-text" style="font-size:12px;font-family:var(--mono)">${m.clasificacion||'—'}</td>
      <td><span class="${badgeClass(m.tipo)}">${m.tipo}</span></td>
      <td class="r">${fmtSigned(m.monto, m.tipo)}</td>
      <td class="r muted-text">${m.monto_neto ? '$ '+fmt(m.monto_neto) : '—'}</td>
      <td class="r muted-text">${m.usd ? 'U$S '+fmt(m.usd) : '—'}</td>
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
      <td class="muted-text" style="font-family:var(--mono);font-size:12px">${e.cuit||'—'}</td>
      <td class="muted-text">${e.condicion_iva||'—'}</td>
      <td class="muted-text">${e.email||'—'}</td>
      <td class="muted-text">${e.telefono||'—'}</td>
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
  const tipoColor = { Activo:'b-ing', Pasivo:'b-eg', Patrimonio:'b-inv', Ingreso:'b-ban', Egreso:'b-tar' };
  tbody.innerHTML = cuentas.map(c => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${c.codigo}</td>
      <td style="font-weight:500">${c.nombre}</td>
      <td><span class="badge ${tipoColor[c.tipo]||'b-ing'}">${c.tipo}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-sm" onclick="openModalCuenta('${c.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="eliminarCuenta('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ── ESTADO DE RESULTADOS ──────────────────────────────────────────────────────
function renderER() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0,7) : '').filter(Boolean))].sort();
  if (!meses.length) { document.getElementById('er-table').innerHTML = `<tr><td><div class="empty-state">Sin datos.</div></td></tr>`; return; }
  const nom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const getTotal = (tipo, mes) => movimientos.filter(m => m.tipo === tipo && (m.fecha||'').startsWith(mes)).reduce((s,m) => s+(m.monto||0), 0);
  const categorias = [
    { label:'Ingresos',             tipo:'Ingreso',              sign: 1 },
    { label:'Egresos',              tipo:'Egreso',               sign:-1 },
    { label:'Tarjetas de crédito',  tipo:'Tarjeta de crédito',   sign:-1 },
    { label:'Bancos / Transferencias',tipo:'Banco / Transferencia',sign:1 },
    { label:'Inversiones',          tipo:'Inversión',            sign: 1 },
    { label:'Préstamos',            tipo:'Préstamo',             sign: 1 },
  ];
  let html = '<thead><tr><th>Rubro</th>';
  meses.forEach(m => { const [y,mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo)-1]} ${y}</th>`; });
  html += '<th class="r">Total</th></tr></thead><tbody>';
  categorias.forEach(cat => {
    html += `<tr><td>${cat.label}</td>`;
    let rowTotal = 0;
    meses.forEach(mes => {
      const v = getTotal(cat.tipo, mes) * cat.sign; rowTotal += v;
      html += `<td class="r ${v<0?'neg-text':v>0?'pos-text':'muted-text'}">$ ${fmt(Math.abs(v))}</td>`;
    });
    html += `<td class="r ${rowTotal<0?'neg-text':'pos-text'}" style="font-weight:500">$ ${fmt(Math.abs(rowTotal))}</td></tr>`;
  });
  html += '<tr class="er-total"><td>Resultado neto</td>';
  let grand = 0;
  meses.forEach(mes => {
    const res = getTotal('Ingreso',mes) - getTotal('Egreso',mes) - getTotal('Tarjeta de crédito',mes);
    grand += res; html += `<td class="r">$ ${fmt(res)}</td>`;
  });
  html += `<td class="r">$ ${fmt(grand)}</td></tr></tbody>`;
  document.getElementById('er-table').innerHTML = html;
}

// ── FLUJO DE FONDOS ───────────────────────────────────────────────────────────
function renderFlujo() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0,7) : '').filter(Boolean))].sort();
  if (!meses.length) { document.getElementById('flujo-stats').innerHTML=''; document.getElementById('flujo-table').innerHTML=`<tr><td><div class="empty-state">Sin datos.</div></td></tr>`; return; }
  const nom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const getSum = (tipos, mes) => movimientos.filter(m => tipos.includes(m.tipo) && (m.fecha||'').startsWith(mes)).reduce((s,m) => s+(m.monto||0), 0);
  const filas = [
    { label:'Ingresos',         tipos:['Ingreso'],                           sign: 1 },
    { label:'Egresos',          tipos:['Egreso'],                            sign:-1 },
    { label:'Tarjetas',         tipos:['Tarjeta de crédito'],                sign:-1 },
    { label:'Bancos / Transf.', tipos:['Banco / Transferencia'],             sign: 1 },
    { label:'Inversiones',      tipos:['Inversión'],                         sign: 1 },
    { label:'Préstamos',        tipos:['Préstamo'],                          sign: 1 },
  ];
  let html = '<thead><tr><th>Concepto</th>';
  meses.forEach(m => { const [y,mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo)-1]} ${y}</th>`; });
  html += '</tr></thead><tbody>';
  filas.forEach(f => {
    html += `<tr><td>${f.label}</td>`;
    meses.forEach(mes => { const v = getSum(f.tipos, mes)*f.sign; html += `<td class="r ${v<0?'neg-text':'muted-text'}">$ ${fmt(Math.abs(v))}</td>`; });
    html += '</tr>';
  });
  const flujos = meses.map(mes => getSum(['Ingreso'],mes) - getSum(['Egreso','Tarjeta de crédito'],mes));
  html += '<tr class="er-subtotal"><td>Flujo neto del mes</td>';
  flujos.forEach(v => { html += `<td class="r ${v<0?'neg-text':'pos-text'}">$ ${fmt(v)}</td>`; });
  html += '</tr><tr class="er-total"><td>Saldo acumulado</td>';
  let acum = 0;
  flujos.forEach(v => { acum += v; html += `<td class="r">$ ${fmt(acum)}</td>`; });
  html += '</tr></tbody>';
  document.getElementById('flujo-table').innerHTML = html;
  const totalIng = movimientos.filter(m => m.tipo==='Ingreso').reduce((s,m)=>s+(m.monto||0),0);
  const totalEg  = movimientos.filter(m => m.tipo==='Egreso'||m.tipo==='Tarjeta de crédito').reduce((s,m)=>s+(m.monto||0),0);
  document.getElementById('flujo-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos acum.</div><div class="stat-value pos">$ ${fmt(totalIng)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos acum.</div><div class="stat-value neg">$ ${fmt(totalEg)}</div></div>
    <div class="stat-card"><div class="stat-label">Posición neta</div><div class="stat-value ${acum>=0?'pos':'neg'}">$ ${fmt(acum)}</div></div>
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