const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

const app = express();

// ⚠️ IMPORTANTE PARA VERCEL
app.use(cors());
app.use(express.json());

// ── CONFIG ─────────────────────────
const JWT_SECRET = "supersecreto"; // luego lo puedes mover a env

// ── MONGODB ────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── MODELOS ────────────────────────

// USUARIOS
const UserSchema = new mongoose.Schema({
  email: String,
  password: String
});
const User = mongoose.model('User', UserSchema);

// ITEMS
const ItemSchema = new mongoose.Schema({
  descripcion: String,
  tipo: { type: String, enum: ['mano_obra','repuesto'] },
  valor: { type: Number, default: 0 }
});

// PRESUPUESTOS
const PresupuestoSchema = new mongoose.Schema({
  numero: Number,
  cliente: String,
  telefono: String,
  marca: String,
  modelo: String,
  anio: String,
  patente: String,
  km: String,
  notas: String,
  items: [ItemSchema],
  fecha: { type: Date, default: Date.now }
});

const Presupuesto = mongoose.model('Presupuesto', PresupuestoSchema);

// ── AUTH MIDDLEWARE ────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ── AUTH ROUTES ────────────────────

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const hashed = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      email: req.body.email,
      password: hashed
    });

    await user.save();

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no existe' });
    }

    const valid = await bcrypt.compare(req.body.password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PRESUPUESTOS (PROTEGIDOS) ──────

app.get('/api/presupuestos', authMiddleware, async (_, res) => {
  const data = await Presupuesto.find().sort({ fecha: -1 });
  res.json(data);
});

app.post('/api/presupuestos', authMiddleware, async (req, res) => {
  const p = await new Presupuesto(req.body).save();
  res.json(p);
});

// ── EXPORT PARA VERCEL ─────────────
module.exports = app;
