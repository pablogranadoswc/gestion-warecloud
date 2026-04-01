// ── INIT ──────────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let movimientos = [];
let editId = null;

// ── AUTH ───────────────────────────────────────────────────────────────────────
async function checkSession() {
  // Detectar si viene del link de confirmación de email
  const hash = window.location.hash;
  if (hash && hash.includes('type=signup')) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      showApp(session.user);
      showSuccessBanner('✓ Cuenta confirmada correctamente. ¡Bienvenido!');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp(session.user);
  else showLogin();
}

function showSuccessBanner(msg) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 1rem; left: 50%; transform: translateX(-50%);
    background: var(--green-bg); color: var(--green);
    border: 1px solid #a8d5b5; border-radius: 8px;
    padding: 12px 24px; font-size: 14px; font-weight: 500;
    z-index: 9999; box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    animation: fadeIn 0.3s ease;
  `;
  banner.textContent = msg;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email-display').textContent = user.email;
  loadMovimientos();
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
  if (pass.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
  const { error } = await sb.auth.signUp({ email, password: pass });
  if (error) { err.textContent = error.message; return; }
  err.style.color = 'var(--green)';
  err.textContent = 'Cuenta creada. Revisá tu email para confirmar.';
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  showLogin();
});

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const titles = { movimientos: 'Movimientos', er: 'Estado de resultados', flujo: 'Flujo de fondos' };

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('page-title').textContent = titles[page];
    if (page === 'er') renderER();
    if (page === 'flujo') renderFlujo();
  });
});

// ── SUPABASE DATA ─────────────────────────────────────────────────────────────
async function loadMovimientos() {
  const { data, error } = await sb
    .from('movimientos')
    .select('*')
    .order('fecha', { ascending: false });
  if (error) { console.error(error); return; }
  movimientos = data || [];
  renderAll();
}

async function upsertMovimiento(mov) {
  if (editId) {
    const { error } = await sb.from('movimientos').update(mov).eq('id', editId);
    if (error) throw error;
  } else {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('movimientos').insert({ ...mov, user_id: user.id });
    if (error) throw error;
  }
}

async function deleteMovimiento(id) {
  const { error } = await sb.from('movimientos').delete().eq('id', id);
  if (error) throw error;
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(id) {
  editId = id || null;
  document.getElementById('modal-title').textContent = editId ? 'Editar movimiento' : 'Nuevo movimiento';
  document.getElementById('form-error').textContent = '';
  clearForm();
  if (editId) {
    const m = movimientos.find(x => x.id === editId);
    if (m) fillForm(m);
  } else {
    document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
  }
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function clearForm() {
  ['fecha','detalle','empresa','cuit','monto','neto','tc','usd','cuenta','doc','obs'].forEach(f => {
    document.getElementById('f-' + f).value = '';
  });
  document.getElementById('f-tipo').value = 'Ingreso operativo';
}

function fillForm(m) {
  document.getElementById('f-fecha').value   = m.fecha || '';
  document.getElementById('f-tipo').value    = m.tipo || 'Ingreso operativo';
  document.getElementById('f-detalle').value = m.detalle || '';
  document.getElementById('f-empresa').value = m.empresa || '';
  document.getElementById('f-cuit').value    = m.cuit || '';
  document.getElementById('f-monto').value   = m.monto || '';
  document.getElementById('f-neto').value    = m.monto_neto || '';
  document.getElementById('f-tc').value      = m.tipo_cambio || '';
  document.getElementById('f-usd').value     = m.usd || '';
  document.getElementById('f-cuenta').value  = m.clasificacion || '';
  document.getElementById('f-doc').value     = m.documento || '';
  document.getElementById('f-obs').value     = m.observaciones || '';
}

document.getElementById('btn-nuevo').addEventListener('click', () => openModal());
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancelar').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const errEl = document.getElementById('form-error');
  errEl.textContent = '';
  const fecha   = document.getElementById('f-fecha').value;
  const detalle = document.getElementById('f-detalle').value.trim();
  const monto   = document.getElementById('f-monto').value;
  if (!fecha || !detalle || !monto) { errEl.textContent = 'Completá los campos obligatorios: Fecha, Detalle y Monto.'; return; }

  const mov = {
    fecha,
    tipo:          document.getElementById('f-tipo').value,
    detalle,
    empresa:       document.getElementById('f-empresa').value || null,
    cuit:          document.getElementById('f-cuit').value || null,
    monto:         parseFloat(monto) || 0,
    monto_neto:    parseFloat(document.getElementById('f-neto').value) || null,
    tipo_cambio:   parseFloat(document.getElementById('f-tc').value) || null,
    usd:           parseFloat(document.getElementById('f-usd').value) || null,
    clasificacion: document.getElementById('f-cuenta').value || null,
    documento:     document.getElementById('f-doc').value || null,
    observaciones: document.getElementById('f-obs').value || null,
  };

  try {
    await upsertMovimiento(mov);
    closeModal();
    await loadMovimientos();
  } catch (e) {
    errEl.textContent = 'Error al guardar: ' + e.message;
  }
});

// ── RENDER ────────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtSigned(n, tipo) {
  const v = Number(n) || 0;
  const esEg = tipo === 'Egreso operativo' || tipo === 'Tarjeta de crédito';
  const cls = esEg ? 'neg-text' : 'pos-text';
  const pre = esEg ? '-' : '';
  return `<span class="${cls}">${pre}$ ${fmt(Math.abs(v))}</span>`;
}

function badgeClass(tipo) {
  const map = {
    'Ingreso operativo':   'b-ing',
    'Egreso operativo':    'b-eg',
    'Inversión / Préstamo':'b-inv',
    'Tarjeta de crédito':  'b-tar',
    'Banco / Transferencia':'b-ban',
  };
  return 'badge ' + (map[tipo] || 'b-ing');
}

function renderAll() {
  renderStats();
  renderTable();
  populateMesFilter();
}

function renderStats() {
  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso operativo').reduce((s,m) => s+(m.monto||0), 0);
  const egresos  = movimientos.filter(m => m.tipo === 'Egreso operativo' || m.tipo === 'Tarjeta de crédito').reduce((s,m) => s+(m.monto||0), 0);
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
  const sel = document.getElementById('filter-mes');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los meses</option>';
  const nom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  meses.forEach(m => {
    const [y,mo] = m.split('-');
    sel.innerHTML += `<option value="${m}">${nom[parseInt(mo)-1]} ${y}</option>`;
  });
  sel.value = cur;
}

document.getElementById('search').addEventListener('input', renderTable);
document.getElementById('filter-tipo').addEventListener('change', renderTable);
document.getElementById('filter-mes').addEventListener('change', renderTable);

function renderTable() {
  const search = document.getElementById('search').value.toLowerCase();
  const tipo   = document.getElementById('filter-tipo').value;
  const mes    = document.getElementById('filter-mes').value;

  let list = movimientos.filter(m => {
    if (search && !((m.detalle||'').toLowerCase().includes(search) || (m.empresa||'').toLowerCase().includes(search) || (m.cuit||'').includes(search))) return false;
    if (tipo && m.tipo !== tipo) return false;
    if (mes && !(m.fecha||'').startsWith(mes)) return false;
    return true;
  });

  const tbody = document.getElementById('tabla-body');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Sin movimientos. Hacé clic en "+ Nuevo movimiento" para agregar.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => `
    <tr>
      <td style="white-space:nowrap; font-family:var(--mono); font-size:12px; color:var(--text-muted)">${m.fecha||''}</td>
      <td>${m.detalle}</td>
      <td class="muted-text">${m.empresa||'—'}</td>
      <td class="muted-text" style="font-size:12px; font-family:var(--mono)">${m.clasificacion||'—'}</td>
      <td><span class="${badgeClass(m.tipo)}">${m.tipo}</span></td>
      <td class="r">${fmtSigned(m.monto, m.tipo)}</td>
      <td class="r muted-text">${m.monto_neto ? '$ '+fmt(m.monto_neto) : '—'}</td>
      <td class="r muted-text">${m.usd ? 'U$S '+fmt(m.usd) : '—'}</td>
      <td style="white-space:nowrap; text-align:right">
        <button class="btn btn-sm" onclick="openModal('${m.id}')">Editar</button>
        <button class="btn btn-sm btn-del" onclick="confirmarEliminar('${m.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function confirmarEliminar(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await deleteMovimiento(id);
    await loadMovimientos();
  } catch(e) {
    alert('Error al eliminar: ' + e.message);
  }
}

// ── ESTADO DE RESULTADOS ──────────────────────────────────────────────────────
function renderER() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0,7) : '').filter(Boolean))].sort();
  if (!meses.length) {
    document.getElementById('er-table').innerHTML = `<tr><td><div class="empty-state">Sin datos todavía.</div></td></tr>`;
    return;
  }
  const nom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const getTotal = (tipo, mes) => movimientos.filter(m => m.tipo === tipo && (m.fecha||'').startsWith(mes)).reduce((s,m) => s+(m.monto||0), 0);

  const categorias = [
    { label: 'Ingresos operativos',    tipo: 'Ingreso operativo',    sign:  1 },
    { label: 'Egresos operativos',     tipo: 'Egreso operativo',     sign: -1 },
    { label: 'Tarjetas de crédito',    tipo: 'Tarjeta de crédito',   sign: -1 },
    { label: 'Bancos / Transferencias',tipo: 'Banco / Transferencia',sign:  1 },
    { label: 'Inversiones / Préstamos',tipo: 'Inversión / Préstamo', sign:  1 },
  ];

  let html = '<thead><tr><th>Rubro</th>';
  meses.forEach(m => { const [y,mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo)-1]} ${y}</th>`; });
  html += '<th class="r">Total</th></tr></thead><tbody>';

  categorias.forEach(cat => {
    html += `<tr><td>${cat.label}</td>`;
    let rowTotal = 0;
    meses.forEach(mes => {
      const v = getTotal(cat.tipo, mes) * cat.sign;
      rowTotal += v;
      html += `<td class="r ${v < 0 ? 'neg-text' : v > 0 ? 'pos-text' : 'muted-text'}">$ ${fmt(Math.abs(v))}</td>`;
    });
    html += `<td class="r ${rowTotal < 0 ? 'neg-text' : 'pos-text'}" style="font-weight:500">$ ${fmt(Math.abs(rowTotal))}</td></tr>`;
  });

  html += '<tr class="er-total"><td>Resultado neto</td>';
  let grand = 0;
  meses.forEach(mes => {
    const ing = getTotal('Ingreso operativo', mes);
    const eg  = getTotal('Egreso operativo', mes) + getTotal('Tarjeta de crédito', mes);
    const res = ing - eg;
    grand += res;
    html += `<td class="r">$ ${fmt(res)}</td>`;
  });
  html += `<td class="r">$ ${fmt(grand)}</td></tr></tbody>`;
  document.getElementById('er-table').innerHTML = html;
}

// ── FLUJO DE FONDOS ───────────────────────────────────────────────────────────
function renderFlujo() {
  const meses = [...new Set(movimientos.map(m => m.fecha ? m.fecha.substring(0,7) : '').filter(Boolean))].sort();
  if (!meses.length) {
    document.getElementById('flujo-stats').innerHTML = '';
    document.getElementById('flujo-table').innerHTML = `<tr><td><div class="empty-state">Sin datos todavía.</div></td></tr>`;
    return;
  }
  const nom = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const getSum = (tipos, mes) => movimientos.filter(m => tipos.includes(m.tipo) && (m.fecha||'').startsWith(mes)).reduce((s,m) => s+(m.monto||0), 0);

  const filas = [
    { label: 'Ingresos',          tipos: ['Ingreso operativo'],                    sign:  1 },
    { label: 'Egresos operativos',tipos: ['Egreso operativo'],                     sign: -1 },
    { label: 'Tarjetas',          tipos: ['Tarjeta de crédito'],                   sign: -1 },
    { label: 'Bancos / Transf.',  tipos: ['Banco / Transferencia'],                sign:  1 },
    { label: 'Inversiones',       tipos: ['Inversión / Préstamo'],                 sign:  1 },
  ];

  let html = '<thead><tr><th>Concepto</th>';
  meses.forEach(m => { const [y,mo] = m.split('-'); html += `<th class="r">${nom[parseInt(mo)-1]} ${y}</th>`; });
  html += '</tr></thead><tbody>';

  filas.forEach(f => {
    html += `<tr><td>${f.label}</td>`;
    meses.forEach(mes => {
      const v = getSum(f.tipos, mes) * f.sign;
      html += `<td class="r ${v < 0 ? 'neg-text' : 'muted-text'}">$ ${fmt(Math.abs(v))}</td>`;
    });
    html += '</tr>';
  });

  const flujos = meses.map(mes => getSum(['Ingreso operativo'], mes) - getSum(['Egreso operativo','Tarjeta de crédito'], mes));

  html += '<tr class="er-subtotal"><td>Flujo neto del mes</td>';
  flujos.forEach(v => { html += `<td class="r ${v < 0 ? 'neg-text' : 'pos-text'}">$ ${fmt(v)}</td>`; });
  html += '</tr>';

  html += '<tr class="er-total"><td>Saldo acumulado</td>';
  let acum = 0;
  flujos.forEach(v => { acum += v; html += `<td class="r">$ ${fmt(acum)}</td>`; });
  html += '</tr></tbody>';

  document.getElementById('flujo-table').innerHTML = html;

  const totalIng = movimientos.filter(m => m.tipo === 'Ingreso operativo').reduce((s,m) => s+(m.monto||0), 0);
  const totalEg  = movimientos.filter(m => m.tipo === 'Egreso operativo' || m.tipo === 'Tarjeta de crédito').reduce((s,m) => s+(m.monto||0), 0);
  document.getElementById('flujo-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ingresos acum.</div><div class="stat-value pos">$ ${fmt(totalIng)}</div></div>
    <div class="stat-card"><div class="stat-label">Egresos acum.</div><div class="stat-value neg">$ ${fmt(totalEg)}</div></div>
    <div class="stat-card"><div class="stat-label">Posición neta</div><div class="stat-value ${acum>=0?'pos':'neg'}">$ ${fmt(acum)}</div></div>
    <div class="stat-card"><div class="stat-label">Meses analizados</div><div class="stat-value">${meses.length}</div></div>
  `;
}

// ── START ─────────────────────────────────────────────────────────────────────
checkSession();
