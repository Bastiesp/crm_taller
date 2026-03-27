const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

// ⚠️ VARIABLES
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

// ── DB ─────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── USER MODEL ─────────────────────
const UserSchema = new mongoose.Schema({
  email: String,
  password: String
});

const User = mongoose.model('User', UserSchema);

// ── AUTH ───────────────────────────

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
      { id: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error en login' });
  }
});

// ── TEST ───────────────────────────
app.get('/api/test', (_, res) => {
  res.json({ ok: true });
});

// ⚠️ EXPORT (SIN app.listen)
module.exports = app;
