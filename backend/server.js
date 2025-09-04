/* backend/server.js */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 4000;

/* Middleware */
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('frontend'));

/* Base de datos */
const adapter = new JSONFile('backend/db.json');
const db = new Low(adapter, {
  propiedades: [],
  inquilinos: [],
  notas: ''
});

/* Cargar DB antes de rutas */
async function initDB() {
  await db.read();
  if (!db.data) {
    db.data = { propiedades: [], inquilinos: [], notas: '' };
  }
  await db.write();
}

initDB();

/* -------- Rutas -------- */

// Portal del inquilino por DNI
app.get('/api/portal/:dni', async (req, res) => {
  await db.read();
  const inq = db.data.inquilinos.find(i => i.dni === req.params.dni);
  if (!inq) return res.status(404).json({ error: 'No encontrado' });
  res.json(inq);
});

// Panel admin: estadísticas y lista
app.get('/api/admin', async (req, res) => {
  await db.read();
  const totalInq = db.data.inquilinos.length;
  const deudaTotal = db.data.inquilinos.reduce((sum, i) => sum + i.deuda, 0);
  res.json({
    totalInq,
    deudaTotal,
    inquilinos: db.data.inquilinos,
    notas: db.data.notas
  });
});

// Agregar inquilino (admin)
app.post('/api/admin/inquilino', async (req, res) => {
  await db.read();
  const nuevo = { ...req.body };
  db.data.inquilinos.push(nuevo);
  await db.write();
  res.json(nuevo);
});

// Eliminar inquilino por DNI (admin)
app.delete('/api/admin/inquilino/:dni', async (req, res) => {
  await db.read();
  db.data.inquilinos = db.data.inquilinos.filter(i => i.dni !== req.params.dni);
  await db.write();
  res.sendStatus(204);
});

// Guardar anotaciones
app.post('/api/admin/notas', async (req, res) => {
  await db.read();
  db.data.notas = req.body.notas || '';
  await db.write();
  res.sendStatus(200);
});

/* Arrancar servidor */
app.listen(PORT, () =>
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
);
/* ----- SUBIR Y SERVIR IMAGEN QR ----- */
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, '..', 'frontend', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Configurar multer
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, _file, cb) => cb(null, 'qr.png') // siempre el mismo nombre
});
const upload = multer({ storage });

/* Ruta para subir imagen (admin) */
app.post('/api/admin/upload-qr', upload.single('qr'), (_req, res) => {
  res.json({ ok: true });
});

/* Ruta para servir imagen (portal) */
app.get('/api/qr', (_req, res) => {
  const filePath = path.join(uploadsDir, 'qr.png');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'QR no encontrado' });
  }
});