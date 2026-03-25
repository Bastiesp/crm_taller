<script>
// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE API Y UTILIDADES
// ═══════════════════════════════════════════════════════════════════════

const API = ''; // Usar rutas relativas (mismo servidor)

// Helper para fetch con manejo de errores mejorado
async function apiRequest(url, options = {}) {
  try {
    // Configurar headers solo si hay body o es POST/PUT/PATCH
    const config = {
      ...options,
      headers: {}
    };
    
    // Solo agregar Content-Type si hay body y es string (JSON)
    if (options.body && typeof options.body === 'string') {
      config.headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || 'Error desconocido'}`);
    }
    
    // Verificar si hay contenido antes de parsear JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    // Si no es JSON, retornar texto o null
    const text = await response.text();
    return text ? JSON.parse(text) : null;
    
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Verificar que jsPDF esté cargado
function checkJSPDF() {
  if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
    toast('Error: Librería PDF no cargada. Recarga la página.', false);
    return false;
  }
  return true;
}

// ── CREDENCIALES ────────────────────────────────────────────────────────
const USUARIOS = [
  { usuario: 'bastian',  clave: 'Bgarage2024', nombre: 'Bastian Espinoza' },
  { usuario: 'admin',    clave: 'admin123',    nombre: 'Administrador'     }
];

// ── LOGIN ──────────────────────────────────────────────────────────────
let currentUser = null;

function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const found = USUARIOS.find(x => x.usuario === u && x.clave === p);
  if(!found) {
    const err = document.getElementById('login-error');
    err.textContent = 'Usuario o contraseña incorrectos';
    err.style.display = 'block';
    return;
  }
  currentUser = found;
  sessionStorage.setItem('bgarage_user', JSON.stringify(found));
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';
  document.getElementById('user-badge').textContent = '👤 ' + found.nombre;
  loadPresupuestos();
}

function doLogout() {
  currentUser = null;
  sessionStorage.removeItem('bgarage_user');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// Restaurar sesión
(function() {
  const saved = sessionStorage.getItem('bgarage_user');
  if(saved) {
    currentUser = JSON.parse(saved);
    document.getElementById('login-screen').style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'flex';
    document.getElementById('user-badge').textContent = '👤 ' + currentUser.nombre;
    // Cargar datos inmediatamente al restaurar sesión
    setTimeout(() => loadPresupuestos(), 100);
  }
})();

// Enter en login
document.addEventListener('keydown', e => {
  if(e.key==='Enter' && document.getElementById('login-screen').style.display!=='none') doLogin();
});

// ── UTILS ──────────────────────────────────────────────────────────────
const fmt     = n => '$' + Math.round(n||0).toLocaleString('es-CL');
const fmtDate = s => s ? new Date(s).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

function toast(msg, ok=true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = ok ? 'rgba(0,151,167,.3)' : 'rgba(192,57,43,.3)';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2400);
}

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  btn.classList.add('active');
  if(name==='presupuestos') loadPresupuestos();
  if(name==='reparaciones') loadReparaciones();
}

function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

// ── ITEMS ──────────────────────────────────────────────────────────────
function agregarItem(containerId, tipo, desc='', valor='') {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'item-row';
  const esMO = tipo === 'mano_obra';
  const placeholder = esMO ? 'Describa el trabajo realizado...' : 'Nombre del repuesto';
  const inputField = esMO
    ? `<textarea class="item-desc" placeholder="${placeholder}" rows="2" oninput="calcularTotal('${containerId}')">${desc}</textarea>`
    : `<input class="item-desc" type="text" placeholder="${placeholder}" value="${desc}">`;
  div.innerHTML = `
    ${inputField}
    <div class="item-tipo-label" style="background:${esMO?'#e0f4f7':'#eaf4ff'};color:${esMO?'#0097a7':'#2980b9'};">${esMO?'Mano obra':'Repuesto'}</div>
    <input class="item-valor-input" type="number" placeholder="0" value="${valor}" min="0" oninput="calcularTotal('${containerId}')" style="text-align:right">
    <button class="remove-item" onclick="this.parentElement.remove();calcularTotal('${containerId}')">✕</button>
  `;
  container.appendChild(div);
  calcularTotal(containerId);
}

function calcularTotal(containerId) {
  const vals  = document.getElementById(containerId).querySelectorAll('.item-valor-input');
  const total = Array.from(vals).reduce((s,v)=>s+parseFloat(v.value||0),0);
  const prefix = containerId==='presup-items'?'presup':'rep';
  document.getElementById(prefix+'-total').textContent = fmt(total);
}

function getItems(containerId) {
  return Array.from(document.getElementById(containerId).querySelectorAll('.item-row')).map(r => {
    const desc  = r.querySelector('.item-desc');
    const valor = r.querySelector('.item-valor-input');
    const tipo  = r.querySelector('.item-tipo-label').textContent.includes('obra') ? 'mano_obra' : 'repuesto';
    return { descripcion: (desc.value||desc.textContent||'').trim(), tipo, valor: parseFloat(valor.value||0) };
  }).filter(i=>i.descripcion);
}

function calcularTotalItems(items) { return (items||[]).reduce((s,i)=>s+(i.valor||0),0); }

// ── PRESUPUESTOS ────────────────────────────────────────────────────────
async function loadPresupuestos() {
  try {
    const data = await apiRequest('/api/presupuestos');
    const list = document.getElementById('presupuestos-list');
    document.getElementById('presup-count').textContent = `(${data.length})`;
    if(!data.length) {
      list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📋</div><div class="empty-title">Sin presupuestos aún</div></div>`;
      return;
    }
    list.innerHTML = data.map(p => {
      const id = p._id || p.id;
      const total = calcularTotalItems(p.items);
      return `<div class="card">
        <div class="card-header">
          <div>
            <div class="card-num">N° ${String(p.numero||0).padStart(4,'0')} · ${fmtDate(p.fecha)}</div>
            <div class="card-title">${p.cliente||'Sin nombre'}</div>
            <div class="card-sub">${[p.marca,p.modelo,p.anio].filter(Boolean).join(' ')}${p.patente?' · '+p.patente.toUpperCase():''}</div>
          </div>
          <div class="card-actions">
            <button class="btn btn-icon btn-secondary" onclick="editarPresupuesto('${id}')" title="Editar">✏️</button>
            <button class="btn btn-icon btn-secondary" onclick="descargarPresupuestoPDF('${id}')" title="PDF">📄</button>
            <button class="btn btn-icon btn-danger" onclick="eliminarPresupuesto('${id}')" title="Eliminar">🗑</button>
          </div>
        </div>
        <div style="font-size:.8rem;color:var(--text3)">${(p.items||[]).length} ítem(s)</div>
        <div class="card-footer"><span class="card-total">${fmt(total)}</span><span class="card-date">${p.notas?p.notas.substring(0,40)+'…':''}</span></div>
      </div>`;
    }).join('');
  } catch(e) { 
    console.error('Error cargando presupuestos:', e);
    toast('Error cargando presupuestos: ' + e.message, false); 
  }
}

function abrirModalPresupuesto() {
  document.getElementById('presup-id').value='';
  document.getElementById('modal-presup-title').textContent='Nuevo presupuesto';
  ['cliente','telefono','marca','modelo','anio','patente','km','notas'].forEach(f=>document.getElementById('presup-'+f).value='');
  document.getElementById('presup-items').innerHTML='';
  document.getElementById('presup-total').textContent='$0';
  agregarItem('presup-items','mano_obra');
  document.getElementById('modal-presupuesto').classList.add('open');
}

async function editarPresupuesto(id) {
  try {
    const p = await apiRequest('/api/presupuestos/' + id);
    document.getElementById('presup-id').value = p._id || p.id;
    document.getElementById('modal-presup-title').textContent=`Editar N° ${String(p.numero||0).padStart(4,'0')}`;
    ['cliente','telefono','marca','modelo','anio','patente','km','notas'].forEach(f=>document.getElementById('presup-'+f).value=p[f]||'');
    document.getElementById('presup-items').innerHTML='';
    (p.items||[]).forEach(i=>agregarItem('presup-items',i.tipo,i.descripcion,i.valor));
    if(!(p.items||[]).length) agregarItem('presup-items','mano_obra');
    document.getElementById('modal-presupuesto').classList.add('open');
  } catch(e) {
    console.error('Error cargando presupuesto:', e);
    toast('Error cargando presupuesto: ' + e.message, false);
  }
}

async function guardarPresupuesto(generarPDF) {
  const id = document.getElementById('presup-id').value;
  const payload = {
    cliente: document.getElementById('presup-cliente').value.trim(),
    telefono: document.getElementById('presup-telefono').value.trim(),
    marca: document.getElementById('presup-marca').value.trim(),
    modelo: document.getElementById('presup-modelo').value.trim(),
    anio: document.getElementById('presup-anio').value.trim(),
    patente: document.getElementById('presup-patente').value.trim().toUpperCase(),
    km: document.getElementById('presup-km').value.trim(),
    notas: document.getElementById('presup-notas').value.trim(),
    items: getItems('presup-items')
  };
  
  if(!payload.cliente) return toast('Ingresa el nombre del cliente', false);
  
  try {
    const url = id ? '/api/presupuestos/' + id : '/api/presupuestos';
    const method = id ? 'PUT' : 'POST';
    const saved = await apiRequest(url, {
      method: method,
      body: JSON.stringify(payload)
    });
    
    cerrarModal('modal-presupuesto');
    toast('Presupuesto guardado ✓');
    loadPresupuestos();
    if(generarPDF) {
      if(!checkJSPDF()) return;
      setTimeout(() => generarPDFPresupuesto(saved), 400);
    }
  } catch(e) {
    console.error('Error guardando presupuesto:', e);
    toast('Error guardando: ' + e.message, false);
  }
}

async function eliminarPresupuesto(id) {
  if(!confirm('¿Eliminar este presupuesto?')) return;
  try {
    await apiRequest('/api/presupuestos/' + id, { method: 'DELETE' });
    toast('Eliminado');
    loadPresupuestos();
  } catch(e) {
    toast('Error eliminando: ' + e.message, false);
  }
}

async function descargarPresupuestoPDF(id) {
  if(!checkJSPDF()) return;
  try {
    const p = await apiRequest('/api/presupuestos/' + id);
    generarPDFPresupuesto(p);
  } catch(e) {
    toast('Error generando PDF: ' + e.message, false);
  }
}

// ── ENGRANE PDF (logo) ─────────────────────────────────────────────────
function dibujarEngranePDF(doc, cx, cy, r, color) {
  const [R,G,B] = color;
  const dientes = 8;
  const rInt = r * 0.62;
  const rDiente = r * 1.28;
  const rAgujero = r * 0.28;

  doc.setFillColor(R,G,B);
  doc.circle(cx, cy, r, 'F');

  for(let i = 0; i < dientes; i++) {
    const ang = (i / dientes) * 2 * Math.PI;
    const angW = Math.PI / dientes * 0.7;
    const x1 = cx + rInt * Math.cos(ang - angW);
    const y1 = cy + rInt * Math.sin(ang - angW);
    const x2 = cx + rInt * Math.cos(ang + angW);
    const y2 = cy + rInt * Math.sin(ang + angW);
    const x3 = cx + rDiente * Math.cos(ang + angW * 0.6);
    const y3 = cy + rDiente * Math.sin(ang + angW * 0.6);
    const x4 = cx + rDiente * Math.cos(ang - angW * 0.6);
    const y4 = cy + rDiente * Math.sin(ang - angW * 0.6);

    doc.setFillColor(R,G,B);
    doc.triangle(x1,y1, x2,y2, x4,y4, 'F');
    doc.triangle(x2,y2, x3,y3, x4,y4, 'F');
  }

  doc.setFillColor(255,255,255);
  doc.circle(cx, cy, rAgujero, 'F');

  doc.setFillColor(R,G,B);
  const cr = rAgujero * 0.55;
  doc.rect(cx - cr, cy - r*0.18, cr*2, r*0.36, 'F');
  doc.rect(cx - r*0.18, cy - cr, r*0.36, cr*2, 'F');

  doc.setFillColor(255,255,255);
  doc.circle(cx, cy, rAgujero*0.55, 'F');
}

// ── PDF PRESUPUESTO ────────────────────────────────────────────────────
function generarPDFPresupuesto(p) {
  if(!checkJSPDF()) return;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W=210, M=18;
  const CAL=[0,151,167], CAL_DARK=[0,105,120];

  doc.setFillColor(255,255,255);
  doc.rect(0,0,W,60,'F');
  doc.setFillColor(...CAL);
  doc.rect(0,57,W,3,'F');

  dibujarEngranePDF(doc, M+14, 28, 12, CAL);

  doc.setFont('helvetica','bold');
  doc.setFontSize(26);
  doc.setTextColor(25,28,32);
  doc.text('BGarage', M+34, 24);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(107,114,128);
  doc.text('Taller Automotriz', M+34, 31);

  doc.setDrawColor(...CAL);
  doc.setLineWidth(0.8);
  doc.roundedRect(W-68, 10, 50, 13, 2, 2, 'D');
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(...CAL);
  doc.text('PRESUPUESTO', W-43, 19, {align:'center'});

  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.setTextColor(40,45,50);
  doc.text(`N° ${String(p.numero||0).padStart(4,'0')}`, W-43, 30, {align:'center'});
  doc.setFont('helvetica','normal');
  doc.setFontSize(8.5);
  doc.setTextColor(107,114,128);
  doc.text(`Fecha: ${fmtDate(p.fecha)}`, W-43, 37, {align:'center'});

  let y = 68;
  const colW = (W-2*M-8)/2;

  doc.setFillColor(248,252,253); doc.setDrawColor(224,244,247); doc.setLineWidth(0.5);
  doc.roundedRect(M, y, colW, 38, 3, 3, 'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CAL);
  doc.text('CLIENTE', M+6, y+8);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(25,28,32);
  doc.text(p.cliente||'—', M+6, y+17);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(107,114,128);
  if(p.telefono) doc.text(p.telefono, M+6, y+26);

  const cx = M+colW+8;
  doc.setFillColor(248,252,253);
  doc.roundedRect(cx, y, colW, 38, 3, 3, 'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CAL);
  doc.text('VEHÍCULO', cx+6, y+8);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(25,28,32);
  const nombreAuto = `${p.marca||''} ${p.modelo||''} ${p.anio||''}`.trim()||'—';
  doc.text(nombreAuto, cx+6, y+17);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(107,114,128);
  const linea2 = [p.patente?'Patente: '+p.patente:'', p.km?'KM: '+p.km:''].filter(Boolean).join('   ');
  if(linea2) doc.text(linea2, cx+6, y+26);
  y += 46;

  doc.setFillColor(25,28,32); doc.rect(M, y, W-2*M, 9, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CAL);
  doc.text('DESCRIPCIÓN', M+5, y+6);
  doc.text('TIPO', M+120, y+6);
  doc.text('VALOR', W-M-5, y+6, {align:'right'});
  y += 11;

  const items = p.items||[];
  if(!items.length) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(156,163,175);
    doc.text('Sin ítems registrados', M+5, y+7); y += 14;
  }

  items.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.descripcion||'', 100);
    const rowH = Math.max(descLines.length*5+6, 10);
    if(idx%2===0){ doc.setFillColor(248,252,253); doc.rect(M,y-1,W-2*M,rowH+2,'F'); }
    doc.setDrawColor(228,244,246); doc.setLineWidth(0.2);
    doc.line(M, y+rowH+1, W-M, y+rowH+1);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(25,28,32);
    doc.text(descLines, M+5, y+5.5);
    const esMO = item.tipo==='mano_obra';
    if(esMO){
      doc.setFillColor(224,244,247); doc.roundedRect(M+112,y+1,24,6,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...CAL_DARK);
      doc.text('MANO OBRA', M+124, y+5.2, {align:'center'});
    } else {
      doc.setFillColor(232,244,255); doc.roundedRect(M+112,y+1,24,6,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(41,128,185);
      doc.text('REPUESTO', M+124, y+5.2, {align:'center'});
    }
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(25,28,32);
    doc.text(fmt(item.valor), W-M-5, y+5.5, {align:'right'});
    y += rowH+3;
  });

  y += 2;
  doc.setFillColor(25,28,32); doc.rect(M,y,W-2*M,13,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
  doc.text('TOTAL', M+6, y+9);
  doc.setTextColor(...CAL);
  doc.text(fmt(calcularTotalItems(items)), W-M-5, y+9, {align:'right'});
  y += 19;

  if(p.notas) {
    const notasLines = doc.splitTextToSize(p.notas, W-2*M-16);
    const nh = notasLines.length*5+12;
    doc.setFillColor(248,252,253); doc.setDrawColor(224,244,247); doc.setLineWidth(0.4);
    doc.roundedRect(M,y,W-2*M,nh,2,2,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CAL);
    doc.text('OBSERVACIONES', M+6, y+7);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(80,80,90);
    doc.text(notasLines, M+6, y+13);
    y += nh+10;
  }

  y = Math.max(y, 248);
  doc.setDrawColor(...CAL); doc.setLineWidth(0.6);
  doc.line(M, y, M+72, y);
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(25,28,32);
  doc.text('Bastian Espinoza F.', M, y+8);
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(107,114,128);
  doc.text('+56 9 5935 5607', M, y+15);
  doc.text('BGarage — Taller Automotriz', M, y+21);

  doc.setFillColor(...CAL); doc.rect(0,285,W,12,'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text('BGarage — Taller Automotriz  ·  +56 9 5935 5607', W/2, 292, {align:'center'});

  doc.save(`presupuesto-${String(p.numero||0).padStart(4,'0')}-${(p.cliente||'cliente').replace(/\s+/g,'-').toLowerCase()}.pdf`);
  toast('PDF generado ✓');
}

// ── REPARACIONES ────────────────────────────────────────────────────────
async function loadReparaciones() {
  try {
    const data = await apiRequest('/api/reparaciones');
    document.getElementById('rep-count').textContent=`(${data.length})`;
    const cols={en_reparacion:[],presupuesto_enviado:[],entregado:[]};
    data.forEach(r=>{const k=r.estado||'en_reparacion';if(cols[k])cols[k].push(r);});
    const render=(key,bodyId,cntId)=>{
      const items=cols[key];
      document.getElementById(cntId).textContent=items.length;
      const body=document.getElementById(bodyId);
      if(!items.length){body.innerHTML='<div style="text-align:center;padding:20px;color:var(--text3);font-size:.8rem">Sin vehículos</div>';return;}
      body.innerHTML=items.map(r=>{
        const id = r._id || r.id;
        const total=calcularTotalItems(r.items);
        return `<div class="kanban-card" onclick="editarReparacion('${id}')">
          <div class="kc-patente">${r.patente||'—'}</div>
          <div class="kc-auto">${[r.marca,r.modelo,r.anio].filter(Boolean).join(' ')||'Vehículo'}</div>
          <div class="kc-tipo">${r.tipo||'Sin tipo'}</div>
          <div class="kc-owner">👤 ${r.cliente||'Sin propietario'}</div>
          ${r.fechaEntrega?`<div style="font-size:.72rem;color:var(--text3);margin-top:4px">📅 ${fmtDate(r.fechaEntrega)}</div>`:''}
          ${total>0?`<div style="font-size:.85rem;font-weight:700;color:var(--accent);margin-top:6px">${fmt(total)}</div>`:''}
          <div class="kc-actions" onclick="event.stopPropagation()">
            ${key==='en_reparacion'?`<button class="btn btn-sm btn-secondary" onclick="cambiarEstado('${id}','presupuesto_enviado')">→ Presup.</button>`:''}
            ${key==='presupuesto_enviado'?`<button class="btn btn-sm btn-secondary" onclick="cambiarEstado('${id}','entregado')">→ Entregar</button>`:''}
            ${key==='entregado'?`<button class="btn btn-sm btn-secondary" onclick="descargarInformePDF('${id}')">📄 Informe</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="eliminarReparacion('${id}')">🗑</button>
          </div>
        </div>`;
      }).join('');
    };
    render('en_reparacion','body-reparacion','cnt-reparacion');
    render('presupuesto_enviado','body-presupuesto','cnt-presupuesto');
    render('entregado','body-entregado','cnt-entregado');
  } catch(e) { 
    console.error('Error cargando reparaciones:', e);
    toast('Error cargando reparaciones: ' + e.message, false); 
  }
}

function abrirModalReparacion(){
  document.getElementById('rep-id').value='';
  document.getElementById('modal-rep-title').textContent='Nueva reparación';
  ['cliente','telefono','marca','modelo','anio','patente','km','tipo','descripcion','notas'].forEach(f=>document.getElementById('rep-'+f).value='');
  document.getElementById('rep-estado').value='en_reparacion';
  document.getElementById('rep-fecha-entrega').value='';
  document.getElementById('rep-items').innerHTML='';
  document.getElementById('rep-total').textContent='$0';
  agregarItem('rep-items','mano_obra');
  document.getElementById('modal-reparacion').classList.add('open');
}

async function editarReparacion(id){
  try{
    const r = await apiRequest('/api/reparaciones/' + id);
    document.getElementById('rep-id').value = r._id || r.id;
    document.getElementById('modal-rep-title').textContent=`Editar — ${r.marca||''} ${r.modelo||''}`;
    ['cliente','telefono','marca','modelo','anio','patente','km','tipo','descripcion','notas'].forEach(f=>document.getElementById('rep-'+f).value=r[f]||'');
    document.getElementById('rep-estado').value=r.estado||'en_reparacion';
    document.getElementById('rep-fecha-entrega').value=r.fechaEntrega?r.fechaEntrega.substring(0,10):'';
    document.getElementById('rep-items').innerHTML='';
    (r.items||[]).forEach(i=>agregarItem('rep-items',i.tipo,i.descripcion,i.valor));
    if(!(r.items||[]).length)agregarItem('rep-items','mano_obra');
    document.getElementById('modal-reparacion').classList.add('open');
  }catch(e){
    console.error('Error cargando reparación:', e);
    toast('Error cargando reparación: ' + e.message, false);
  }
}

async function guardarReparacion(){
  const id=document.getElementById('rep-id').value;
  const payload={
    cliente:document.getElementById('rep-cliente').value.trim(),
    telefono:document.getElementById('rep-telefono').value.trim(),
    marca:document.getElementById('rep-marca').value.trim(),
    modelo:document.getElementById('rep-modelo').value.trim(),
    anio:document.getElementById('rep-anio').value.trim(),
    patente:document.getElementById('rep-patente').value.trim().toUpperCase(),
    km:document.getElementById('rep-km').value.trim(),
    tipo:document.getElementById('rep-tipo').value.trim(),
    descripcion:document.getElementById('rep-descripcion').value.trim(),
    notas:document.getElementById('rep-notas').value.trim(),
    estado:document.getElementById('rep-estado').value,
    fechaEntrega:document.getElementById('rep-fecha-entrega').value||null,
    items:getItems('rep-items')
  };
  if(!payload.cliente)return toast('Ingresa el nombre del propietario',false);
  if(!payload.tipo)return toast('Ingresa el tipo de reparación',false);
  
  try{
    const url=id?'/api/reparaciones/'+id:'/api/reparaciones';
    const method=id?'PUT':'POST';
    await apiRequest(url, {
      method: method,
      body: JSON.stringify(payload)
    });
    cerrarModal('modal-reparacion');
    toast('Reparación guardada ✓');
    loadReparaciones();
  }catch(e){
    console.error('Error guardando reparación:', e);
    toast('Error guardando: ' + e.message, false);
  }
}

async function cambiarEstado(id,estado){
  try {
    await apiRequest('/api/reparaciones/' + id, {
      method: 'PUT',
      body: JSON.stringify({estado})
    });
    toast('Estado actualizado ✓');
    loadReparaciones();
  } catch(e) {
    toast('Error actualizando estado: ' + e.message, false);
  }
}

async function eliminarReparacion(id){
  if(!confirm('¿Eliminar esta reparación?'))return;
  try {
    await apiRequest('/api/reparaciones/' + id, { method: 'DELETE' });
    toast('Eliminado');
    loadReparaciones();
  } catch(e) {
    toast('Error eliminando: ' + e.message, false);
  }
}

// ── PDF INFORME ─────────────────────────────────────────────────────────
async function descargarInformePDF(id){
  if(!checkJSPDF()) return;
  try{
    const r = await apiRequest('/api/reparaciones/' + id);
    generarPDFInforme(r);
  }catch(e){
    toast('Error generando informe: ' + e.message, false);
  }
}

function generarPDFInforme(r){
  if(!checkJSPDF()) return;
  
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const W=210,M=18;
  const CAL=[0,151,167], CAL_DARK=[0,105,120];

  doc.setFillColor(255,255,255);
  doc.rect(0,0,W,60,'F');
  doc.setFillColor(...CAL);
  doc.rect(0,57,W,3,'F');

  dibujarEngranePDF(doc, M+14, 28, 12, CAL);

  doc.setFont('helvetica','bold'); doc.setFontSize(26); doc.setTextColor(25,28,32);
  doc.text('BGarage', M+34, 24);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(107,114,128);
  doc.text('Taller Automotriz', M+34, 31);

  doc.setDrawColor(...CAL); doc.setLineWidth(0.8);
  doc.roundedRect(W-68,10,50,13,2,2,'D');
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...CAL);
  doc.text('INFORME', W-43,19,{align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(107,114,128);
  doc.text('Reparación completada', W-43,29,{align:'center'});
  doc.text(`Fecha: ${fmtDate(new Date())}`, W-43,36,{align:'center'});

  let y=68;
  const colW=(W-2*M-8)/2;

  doc.setFillColor(248,252,253); doc.setDrawColor(224,244,247); doc.setLineWidth(0.5);
  doc.roundedRect(M,y,colW,44,3,3,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CAL);
  doc.text('PROPIETARIO', M+6, y+8);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(25,28,32);
  doc.text(r.cliente||'—', M+6, y+17);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(107,114,128);
  if(r.telefono) doc.text(r.telefono, M+6, y+25);

  const cx=M+colW+8;
  doc.roundedRect(cx,y,colW,44,3,3,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CAL);
  doc.text('VEHÍCULO', cx+6, y+8);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(25,28,32);
  const marcaModeloAnio = `${r.marca||''} ${r.modelo||''} ${r.anio||''}`.trim()||'—';
  doc.text(marcaModeloAnio, cx+6, y+17);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(107,114,128);
  const vi=[r.patente?'Pat: '+r.patente:'', r.km?'KM: '+r.km:''].filter(Boolean).join('   ');
  if(vi) doc.text(vi, cx+6, y+25);
  doc.text(`Ingreso: ${fmtDate(r.fechaIngreso)}`, cx+6, y+33);
  y+=52;

  doc.setFillColor(248,252,253);
  doc.roundedRect(M,y,W-2*M,22,3,3,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CAL);
  doc.text('TRABAJO REALIZADO', M+6, y+8);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(25,28,32);
  doc.text(r.tipo||'—', M+6, y+17);
  y+=28;

  if(r.descripcion){
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(107,114,128);
    const lines=doc.splitTextToSize(r.descripcion,W-2*M);
    doc.text(lines,M,y); y+=lines.length*5+8;
  }

  doc.setFillColor(25,28,32); doc.rect(M,y,W-2*M,9,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CAL);
  doc.text('DESCRIPCIÓN',M+5,y+6);
  doc.text('TIPO',M+120,y+6);
  doc.text('VALOR',W-M-5,y+6,{align:'right'});
  y+=11;

  const items=r.items||[];
  items.forEach((item,idx)=>{
    const descLines=doc.splitTextToSize(item.descripcion||'',100);
    const rowH=Math.max(descLines.length*5+6,10);
    if(idx%2===0){doc.setFillColor(248,252,253);doc.rect(M,y-1,W-2*M,rowH+2,'F');}
    doc.setDrawColor(228,244,246);doc.setLineWidth(0.2);
    doc.line(M,y+rowH+1,W-M,y+rowH+1);
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(25,28,32);
    doc.text(descLines,M+5,y+5.5);
    const esMO=item.tipo==='mano_obra';
    if(esMO){
      doc.setFillColor(224,244,247);doc.roundedRect(M+112,y+1,24,6,1,1,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...CAL_DARK);
      doc.text('MANO OBRA',M+124,y+5.2,{align:'center'});
    }else{
      doc.setFillColor(232,244,255);doc.roundedRect(M+112,y+1,24,6,1,1,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(41,128,185);
      doc.text('REPUESTO',M+124,y+5.2,{align:'center'});
    }
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(25,28,32);
    doc.text(fmt(item.valor),W-M-5,y+5.5,{align:'right'});
    y+=rowH+3;
  });

  y+=2;
  doc.setFillColor(25,28,32);doc.rect(M,y,W-2*M,13,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(255,255,255);
  doc.text('TOTAL',M+6,y+9);
  doc.setTextColor(...CAL);
  doc.text(fmt(calcularTotalItems(items)),W-M-5,y+9,{align:'right'});
  y+=19;

  if(r.notas){
    const lines=doc.splitTextToSize(r.notas,W-2*M-16);
    const h=lines.length*5+12;
    doc.setFillColor(248,252,253);doc.setDrawColor(224,244,247);doc.setLineWidth(0.4);
    doc.roundedRect(M,y,W-2*M,h,2,2,'FD');
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...CAL);
    doc.text('OBSERVACIONES',M+6,y+7);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(80,80,90);
    doc.text(lines,M+6,y+13);
    y+=h+10;
  }

  y=Math.max(y,248);
  doc.setDrawColor(...CAL);doc.setLineWidth(0.6);
  doc.line(M,y,M+72,y);
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(25,28,32);
  doc.text('Bastian Espinoza F.',M,y+8);
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(107,114,128);
  doc.text('+56 9 5935 5607',M,y+15);
  doc.text('BGarage — Taller Automotriz',M,y+21);

  doc.setFillColor(...CAL);doc.rect(0,285,W,12,'F');
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(255,255,255);
  doc.text('BGarage — Taller Automotriz  ·  +56 9 5935 5607',W/2,292,{align:'center'});

  doc.save(`informe-${(r.patente||'vehiculo').toLowerCase()}-${(r.cliente||'cliente').replace(/\s+/g,'-').toLowerCase()}.pdf`);
  toast('Informe PDF generado ✓');
}

// ── INIT ────────────────────────────────────────────────────────────────
if(currentUser) loadPresupuestos();
</script>
</body>
</html>
