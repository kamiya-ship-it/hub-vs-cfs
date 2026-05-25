const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { fullAnalysis } = require('./calculator');
const { parsePdf } = require('./pdfParser');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', 'data', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  },
});

const SHIPMENTS_FILE = path.join(__dirname, '..', 'data', 'shipments.json');

function readShipments() {
  if (!fs.existsSync(SHIPMENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SHIPMENTS_FILE, 'utf8'));
}

function writeShipments(data) {
  fs.writeFileSync(SHIPMENTS_FILE, JSON.stringify(data, null, 2));
}

// POST /api/calculate — run full hub vs CFS analysis
router.post('/calculate', (req, res) => {
  try {
    const result = fullAnalysis(req.body);
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/parse-pdf — upload and extract SKU data from invoice PDF
router.post('/parse-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No PDF file uploaded.' });
  try {
    const skus = await parsePdf(req.file.path);
    res.json({ ok: true, skus });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// GET /api/shipments — list all saved shipments
router.get('/shipments', (req, res) => {
  const shipments = readShipments().map(s => ({
    id: s.id, name: s.name, invoice: s.invoice, createdAt: s.createdAt, totBoxes: s.totBoxes,
  }));
  res.json({ ok: true, shipments });
});

// GET /api/shipments/:id — get a saved shipment
router.get('/shipments/:id', (req, res) => {
  const shipments = readShipments();
  const s = shipments.find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ ok: false, error: 'Shipment not found.' });
  res.json({ ok: true, shipment: s });
});

// POST /api/shipments — save a shipment configuration
router.post('/shipments', (req, res) => {
  const shipments = readShipments();
  const shipment = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...req.body,
  };
  shipments.push(shipment);
  writeShipments(shipments);
  res.json({ ok: true, id: shipment.id });
});

// PUT /api/shipments/:id — update a saved shipment
router.put('/shipments/:id', (req, res) => {
  const shipments = readShipments();
  const idx = shipments.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Shipment not found.' });
  shipments[idx] = { ...shipments[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeShipments(shipments);
  res.json({ ok: true });
});

// DELETE /api/shipments/:id — delete a saved shipment
router.delete('/shipments/:id', (req, res) => {
  let shipments = readShipments();
  const before = shipments.length;
  shipments = shipments.filter(s => s.id !== req.params.id);
  if (shipments.length === before) return res.status(404).json({ ok: false, error: 'Shipment not found.' });
  writeShipments(shipments);
  res.json({ ok: true });
});

module.exports = router;
