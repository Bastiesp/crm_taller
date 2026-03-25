const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const mongoose = require('mongoose');

const app  = express();

// ── MONGODB CONNECTION ────────────────────────────────────────────────
// Usar variable de entorno de Vercel
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI no está definida');
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── SCHEMAS ───────────────────────────────────────────────────────────
const ItemSchema = new mongoose.Schema({
  descripcion: String,
  tipo:        { type: String, enum: ['mano_obra','repuesto'] },
  valor:       { type: Number, default: 0 }
});

const PresupuestoSchema = new mongoose.Schema({
  numero:    { type: Number },
  cliente:   String,
  telefono:  String,
  marca:     String,
  modelo:    String,
  anio:      String,
  patente:   String,
  km:        String,
  notas:     String,
  items:     [ItemSchema],
  fecha:     { type: Date, default: Date.now }
});

const ReparacionSchema = new mongoose.Schema({
  cliente:      String,
  telefono:     String,
  marca:        String,
  modelo:       String,
  anio:         String,
  patente:      String,
  km:           String,
  tipo:         String,
  descripcion:  String,
  notas:        String,
  estado:       { type: String, default: 'en_reparacion', enum: ['en_reparacion','presupuesto_enviado','entregado'] },
  fechaEntrega: Date,
  items:        [ItemSchema],
  fechaIngreso: { type: Date, default: Date.now }
});

// Auto-incrementar número de presupuesto
PresupuestoSchema.pre('save', async function(next) {
  if (this.isNew) {
    const last = await Presupuesto.findOne().sort({ numero: -1 });
    this.numero = last ? last.numero + 1 : 1;
  }
  next();
});

const Presupuesto = mongoose.model('Presupuesto', PresupuestoSchema);
const Reparacion  = mongoose.model('Reparacion',  ReparacionSchema);

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── PRESUPUESTOS ──────────────────────────────────────────────────────
app.get('/api/presupuestos', async (_, res) => {
  try {
    const data = await Presupuesto.find().sort({ fecha: -1 });
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/presupuestos/:id', async (req, res) => {
  try {
    const p = await Presupuesto.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/presupuestos', async (req, res) => {
  try {
    const p = await new Presupuesto(req.body).save();
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/presupuestos/:id', async (req, res) => {
  try {
    const p = await Presupuesto.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p)
