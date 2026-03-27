const express  = require('express');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const path     = require('path');
const mongoose = require('mongoose');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'bgarage_jwt_2024_xK9!mL';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CONEXIÓN MONGODB ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅  MongoDB conectado'))
  .catch(err => { console.error('❌  MongoDB error:', err.message); process.exit(1); });

// ── SCHEMAS ───────────────────────────────────────────────────────────────
const itemSchema = new mongoose.Schema({
  descripcion: { type: String, default: '' },
  tipo:        { type: String, enum: ['mano_obra', 'repuesto'], default: 'mano_obra' },
  valor:       { type: Number, default: 0 }
}, { _id: false });

const presupuestoSchema = new mongoose.Schema({
  numero:   { type: Number },
  fecha:    { type: Date, default: Date.now },
  cliente:  { type: String, required: true, trim: true },
  telefono: { type: String, trim: true, default: '' },
  marca:    { type: String, trim: true, default: '' },
  modelo:   { type: String, trim: true, default: '' },
  anio:     { type: String, trim: true, default: '' },
  patente:  { type: String, trim: true, uppercase: true, default: '' },
  km:       { type: String, trim: true, default: '' },
  notas:    { type: String, default: '' },
  items:    [itemSchema]
}, { timestamps: true });

const reparacionSchema = new mongoose.Schema({
  numero:       { type: Number },
  fechaIngreso: { type: Date, default: Date.now },
  cliente:      { type: String, required: true, trim: true },
  telefono:     { type: String, trim: true, default: '' },
  marca:        { type: String, trim: true, default: '' },
  modelo:       { type: String, trim: true, default: '' },
  anio:         { type: String, trim: true, default: '' },
  patente:      { type: String, trim: true, uppercase: true, default: '' },
  km:           { type: String, trim: true, default: '' },
  tipo:         { type: String, required: true, trim: true },
  descripcion:  { type: String, default: '' },
  estado:       { type: String, enum: ['en_reparacion', 'presupuesto_enviado', 'entregado'], default: 'en_reparacion' },
  fechaEntrega: { type: Date, default: null },
  notas:        { type: String, default: '' },
  items:        [itemSchema]
}, { timestamps: true });

// Auto-incremento de número
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

async function nextNumero(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

const Presupuesto = mongoose.model('Presupuesto', presupuestoSchema);
const Reparacion  = mongoose.model('Reparacion',  reparacionSchema);

// ── USUARIOS ──────────────────────────────────────────────────────────────
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Para cambiar contraseñas edita aquí. Nunca pongas texto plano en producción.
const USUARIOS = [
  { id: 1, usuario: 'bastian', hash: sha256('Bgarage2024'), nombre: 'Bastian Espinoza', rol: 'admin' },
  { id: 2, usuario: 'admin',   hash: sha256('admin123'),   nombre: 'Administrador',    rol: 'viewer' }
];

// ── MIDDLEWARE AUTH JWT ───────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No autorizado — falta token' });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ── LOGIN ─────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { usuario, clave } = req.body || {};
  if (!usuario || !clave) return res.status(400).json({ error: 'Datos incompletos' });

  const user = USUARIOS.find(
    u => u.usuario === usuario.trim().toLowerCase() && u.hash === sha256(clave)
  );
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol },
    SECRET,
    { expiresIn: '10h' }
  );
  res.json({ token, nombre: user.nombre });
});

// ── PRESUPUESTOS ──────────────────────────────────────────────────────────
app.get('/api/presupuestos', auth, async (req, res) => {
  try {
    const data = await Presupuesto.find().sort({ numero: -1 }).lean();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/presupuestos', auth, async (req, res) => {
  try {
    const numero = await nextNumero('presupuesto');
    const p = await Presupuesto.create({ ...req.body, numero });
    res.status(201).json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/presupuestos/:id', auth, async (req, res) => {
  try {
    const p = await Presupuesto.findById(req.params.id).lean();
    p ? res.json(p) : res.status(404).json({ error: 'No encontrado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/presupuestos/:id', auth, async (req, res) => {
  try {
    const p = await Presupuesto.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    p ? res.json(p) : res.status(404).json({ error: 'No encontrado' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/presupuestos/:id', auth, async (req, res) => {
  try {
    await Presupuesto.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── REPARACIONES ──────────────────────────────────────────────────────────
app.get('/api/reparaciones', auth, async (req, res) => {
  try {
    const data = await Reparacion.find().sort({ createdAt: -1 }).lean();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reparaciones', auth, async (req, res) => {
  try {
    const numero = await nextNumero('reparacion');
    const r = await Reparacion.create({ ...req.body, numero });
    res.status(201).json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/reparaciones/:id', auth, async (req, res) => {
  try {
    const r = await Reparacion.findById(req.params.id).lean();
    r ? res.json(r) : res.status(404).json({ error: 'No encontrado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/reparaciones/:id', auth, async (req, res) => {
  try {
    const r = await Reparacion.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    r ? res.json(r) : res.status(404).json({ error: 'No encontrado' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/reparaciones/:id', auth, async (req, res) => {
  try {
    await Reparacion.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FALLBACK SPA ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () =>
  console.log(`✅  BGarage CRM corriendo en http://localhost:${PORT}`)
);
