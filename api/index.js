const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── IN-MEMORY STORE ───────────────────────────────────────────────────
const DB = {
  presupuestos: [],
  reparaciones: []
};

// ── PRESUPUESTOS ──────────────────────────────────────────────────────
app.get('/api/presupuestos', (_, res) => {
  res.json(DB.presupuestos.sort((a,b) => b.fecha > a.fecha ? 1 : -1));
});

app.get('/api/presupuestos/:id', (req, res) => {
  const p = DB.presupuestos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

app.post('/api/presupuestos', (req, res) => {
  const p = {
    id:         uuidv4(),
    numero:     DB.presupuestos.length + 1,
    fecha:      new Date().toISOString(),
    ...req.body
  };
  DB.presupuestos.push(p);
  res.json(p);
});

app.put('/api/presupuestos/:id', (req, res) => {
  const i = DB.presupuestos.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'No encontrado' });
  DB.presupuestos[i] = { ...DB.presupuestos[i], ...req.body, id: req.params.id };
  res.json(DB.presupuestos[i]);
});

app.delete('/api/presupuestos/:id', (req, res) => {
  DB.presupuestos = DB.presupuestos.filter(x => x.id !== req.params.id);
  res.json({ ok: true });
});

// ── REPARACIONES ──────────────────────────────────────────────────────
app.get('/api/reparaciones', (_, res) => {
  res.json(DB.reparaciones.sort((a,b) => b.fechaIngreso > a.fechaIngreso ? 1 : -1));
});

app.get('/api/reparaciones/:id', (req, res) => {
  const r = DB.reparaciones.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  res.json(r);
});

app.post('/api/reparaciones', (req, res) => {
  const r = {
    id:           uuidv4(),
    fechaIngreso: new Date().toISOString(),
    estado:       'en_reparacion',
    ...req.body
  };
  DB.reparaciones.push(r);
  res.json(r);
});

app.put('/api/reparaciones/:id', (req, res) => {
  const i = DB.reparaciones.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'No encontrado' });
  DB.reparaciones[i] = { ...DB.reparaciones[i], ...req.body, id: req.params.id };
  res.json(DB.reparaciones[i]);
});

app.delete('/api/reparaciones/:id', (req, res) => {
  DB.reparaciones = DB.reparaciones.filter(x => x.id !== req.params.id);
  res.json({ ok: true });
});

// ── FALLBACK ──────────────────────────────────────────────────────────
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`BGarage running on :${PORT}`));
module.exports = app;
