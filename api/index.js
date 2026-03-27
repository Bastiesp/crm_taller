const express = require('express');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const path    = require('path');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'bgarage_jwt_2024_xK9!mL';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── USUARIOS ─────────────────────────────────────────────────────────────
// Las contraseñas se guardan como hash SHA-256, nunca en texto plano
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const USUARIOS = [
  {
    id: 1,
    usuario: 'bastian',
    hash: sha256('Bgarage2024'),   // ← cambia la contraseña aquí
    nombre: 'Bastian Espinoza',
    rol: 'admin'
  },
  {
    id: 2,
    usuario: 'admin',
    hash: sha256('admin123'),      // ← cambia la contraseña aquí
    nombre: 'Administrador',
    rol: 'viewer'
  }
];

// ── IN-MEMORY STORE ───────────────────────────────────────────────────────
// Reemplaza con MongoDB Atlas cuando quieras persistencia real
let presupuestos = [];
let reparaciones = [];
let presupCounter = 1;
let repCounter    = 1;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── MIDDLEWARE AUTH JWT ───────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado — falta token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch (e) {
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
app.get('/api/presupuestos', auth, (req, res) => {
  res.json([...presupuestos].reverse());
});

app.post('/api/presupuestos', auth, (req, res) => {
  const p = {
    _id: genId(),
    numero: presupCounter++,
    fecha: new Date().toISOString(),
    ...req.body
  };
  presupuestos.push(p);
  res.status(201).json(p);
});

app.get('/api/presupuestos/:id', auth, (req, res) => {
  const p = presupuestos.find(x => x._id === req.params.id);
  p ? res.json(p) : res.status(404).json({ error: 'No encontrado' });
});

app.put('/api/presupuestos/:id', auth, (req, res) => {
  const idx = presupuestos.findIndex(x => x._id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
  presupuestos[idx] = { ...presupuestos[idx], ...req.body };
  res.json(presupuestos[idx]);          // devuelve el objeto COMPLETO con numero y fecha
});

app.delete('/api/presupuestos/:id', auth, (req, res) => {
  presupuestos = presupuestos.filter(x => x._id !== req.params.id);
  res.json({ ok: true });
});

// ── REPARACIONES ──────────────────────────────────────────────────────────
app.get('/api/reparaciones', auth, (req, res) => {
  res.json(reparaciones);
});

app.post('/api/reparaciones', auth, (req, res) => {
  const r = {
    _id: genId(),
    numero: repCounter++,
    fechaIngreso: new Date().toISOString(),
    ...req.body
  };
  reparaciones.push(r);
  res.status(201).json(r);
});

app.get('/api/reparaciones/:id', auth, (req, res) => {
  const r = reparaciones.find(x => x._id === req.params.id);
  r ? res.json(r) : res.status(404).json({ error: 'No encontrado' });
});

app.put('/api/reparaciones/:id', auth, (req, res) => {
  const idx = reparaciones.findIndex(x => x._id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
  reparaciones[idx] = { ...reparaciones[idx], ...req.body };
  res.json(reparaciones[idx]);
});

app.delete('/api/reparaciones/:id', auth, (req, res) => {
  reparaciones = reparaciones.filter(x => x._id !== req.params.id);
  res.json({ ok: true });
});

// ── FALLBACK SPA ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () =>
  console.log(`✅  BGarage CRM corriendo en http://localhost:${PORT}`)
);
