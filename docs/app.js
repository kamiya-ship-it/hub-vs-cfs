// ─── SUPABASE ───
const SUPA_URL = 'https://ytgjlgyexqadipiblvnk.supabase.co';
const SUPA_KEY = 'sb_publishable_JIzY13hBRr8WRb58b-WY4Q_rHXegYWp';
const sb = supabase.createClient(SUPA_URL, SUPA_KEY);
let currentUser = null;

const $ = id => document.getElementById(id);
const gv = id => parseFloat($(id)?.value) || 0;
const esc = s => String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fmtN = (v, d = 2) => (+v).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtKg = v => fmtN(v, 2) + ' kg';
const fmtINR = v => '₹' + Math.round(v).toLocaleString('en-IN');
const fmtUSD = v => '$' + (+v).toFixed(2);
function fc(inr) {
  return $('displayCurrency').value === 'USD' ? fmtUSD(inr / gv('usdRate')) : fmtINR(inr);
}

// ─── LAST ANALYSIS + ROUTE STATE ───
let lastAnalysisData = null;
let selectedRoute = 'hub';

function selectRoute(r) {
  selectedRoute = r;
  const hBtn = $('btnSelectHub'), cBtn = $('btnSelectCfs');
  if (hBtn) { hBtn.classList.toggle('active', r === 'hub'); }
  if (cBtn) { cBtn.classList.toggle('active', r === 'cfs'); }
}

function createRecord() {
  if (!lastAnalysisData) return;
  const d = lastAnalysisData;
  const route = selectedRoute;
  const isHub = route === 'hub';
  const costs = isHub ? d.hubCosts : d.cfsCosts;
  const totalINR = isHub ? d.hubCosts.hubTotal : d.cfsCosts.cfsTotal;
  const usdRate = d.cfsCosts.cfsTotalUSD > 0 ? d.cfsCosts.cfsFixed_inr / d.cfsCosts.cfsTotalUSD : 93.88;

  const exporter   = $('infoExporter')?.textContent || '—';
  const consignee  = $('infoConsignee')?.textContent || '—';
  const invoice    = $('infoInvoice')?.textContent || '—';
  const routeStr   = $('infoRoute')?.textContent || '—';
  const modeStr    = $('infoMode')?.textContent || '—';
  const pickup     = $('pickup')?.value || '—';
  const dest       = $('dest')?.value || '—';
  const today      = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const airFreight = gv('airFreight');
  const palletDim  = `${gv('pL')}×${gv('pW')}×${gv('pH')} ${getDimUnit()}`;
  const palletMode = d.palletMode === 'mixed' ? 'Mixed SKUs' : 'Separate SKUs';

  const fINR = v => '₹' + Math.round(v).toLocaleString('en-IN');
  const fUSD = v => '$' + (+v).toFixed(2);
  const fKg  = v => (+v).toFixed(2) + ' kg';

  // Build pallet rows
  const palletRows = d.pallets.map(p => `
    <tr>
      <td>Pallet ${p.n}</td>
      <td>${p.boxes}</td>
      <td>${p.skuMix}</td>
      <td>${fKg(p.cargo)}</td>
      <td>${fKg(p.total)}</td>
      <td>${p.lbs.toFixed(1)} lbs</td>
      <td>${fKg(p.charge)}</td>
    </tr>`).join('');

  // Build SKU rows
  const skuRows = d.allocation.map(r => `
    <tr>
      <td>${r.sku || '—'}</td>
      <td>${r.boxes}</td>
      <td>${r.kg} kg/box</td>
      <td>${r.eff}</td>
      <td>${r.pallets}</td>
      <td>${r.gl}</td>
      <td>${r.reason}</td>
    </tr>`).join('');

  // Cost breakdown section
  let costSection = '';
  if (isHub) {
    costSection = `
      <table class="cost-table">
        <tr><th colspan="2">Hub Palletize + LTL — Cost Breakdown</th></tr>
        <tr><td>Extra air freight (${d.hubCosts.hubExtraAFwt.toFixed(1)} kg @ ₹${airFreight}/kg)</td><td>${fINR(d.hubCosts.hubExtraAF)}</td></tr>
        <tr><td>Packing charges</td><td>${fINR(d.hubCosts.hPacking)}</td></tr>
        <tr><td>Forklift</td><td>${fINR(d.hubCosts.hForklift)}</td></tr>
        <tr><td>ISPM-15</td><td>${fINR(d.hubCosts.hIspmCost)}</td></tr>
        ${d.hubCosts.hAdditional > 0 ? `<tr><td>Forwarder margin on extra wt</td><td>${fINR(d.hubCosts.hAdditional)}</td></tr>` : ''}
        <tr><td>LTL carrier</td><td>${fINR(d.hubCosts.hLtl)}</td></tr>
        <tr><td>Documentation</td><td>${fINR(d.hubCosts.hDocs)}</td></tr>
        <tr><td>Miscellaneous</td><td>${fINR(d.hubCosts.hMisc)}</td></tr>
        <tr class="total-row"><td><strong>Total (Hub + LTL)</strong></td><td><strong>${fINR(totalINR)}</strong></td></tr>
      </table>`;
  } else {
    const r = d.cfsCosts;
    costSection = `
      <table class="cost-table">
        <tr><th colspan="2">CFS Palletize + LTL — Cost Breakdown</th></tr>
        <tr><td>Extra air freight (${r.cfsExtraAFwt.toFixed(1)} kg @ ₹${airFreight}/kg)</td><td>${fINR(r.cfsExtraAF)}</td></tr>
        <tr><td>Recovery (${fUSD(r.cR)} → ${fINR(r.cR * usdRate)})</td><td>${fINR(r.cR * usdRate)}</td></tr>
        <tr><td>Sorting/box (${fUSD(r.cS)} → ${fINR(r.cS * usdRate)})</td><td>${fINR(r.cS * usdRate)}</td></tr>
        <tr><td>Palletization (${fUSD(r.cP)} → ${fINR(r.cP * usdRate)})</td><td>${fINR(r.cP * usdRate)}</td></tr>
        <tr><td>LTL carrier (${fUSD(r.cL)})</td><td>${fINR(r.cL * usdRate)}</td></tr>
        <tr><td>Documentation (${fUSD(r.cD)})</td><td>${fINR(r.cD * usdRate)}</td></tr>
        <tr><td>Miscellaneous (${fUSD(r.cM)})</td><td>${fINR(r.cM * usdRate)}</td></tr>
        <tr><td>CFS sub-total (USD)</td><td>${fUSD(r.cfsTotalUSD)}</td></tr>
        <tr class="total-row"><td><strong>Total (CFS + LTL)</strong></td><td><strong>${fINR(totalINR)}</strong></td></tr>
      </table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipment Record — ${invoice}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#0f172a;background:#fff;padding:24px}
    h1{font-size:18px;font-weight:700;margin-bottom:4px}
    .sub{font-size:11px;color:#64748b;margin-bottom:18px}
    .route-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
    .route-badge.hub{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
    .route-badge.cfs{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
    .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
    .info-cell span{display:block;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
    .info-cell b{font-size:12px;color:#0f172a}
    .metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:16px}
    .metric{background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #e2e8f0;text-align:center}
    .metric .lbl{font-size:8px;color:#64748b;text-transform:uppercase;margin-bottom:3px}
    .metric .val{font-size:14px;font-weight:700;color:#0f172a}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#475569;margin:16px 0 6px;padding-bottom:4px;border-bottom:2px solid #e2e8f0}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px}
    th{background:#f8fafc;padding:6px 8px;text-align:left;font-size:9px;font-weight:600;color:#475569;text-transform:uppercase;border:1px solid #e2e8f0}
    td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:middle}
    tr:nth-child(even) td{background:#fafafa}
    .total-row td{background:#eff6ff!important;font-weight:600;font-size:12px}
    .cost-table{max-width:480px}
    .cost-table th{background:#1d4ed8;color:#fff}
    .cost-table.cfs th{background:#b45309}
    .rec-box{padding:10px 14px;border-radius:6px;font-size:13px;font-weight:500;margin-bottom:14px;text-align:center}
    .rec-box.hub{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
    .rec-box.cfs{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
    .per-unit{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px}
    .pu-card{padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc}
    .pu-card .lbl{font-size:9px;color:#64748b;margin-bottom:4px}
    .pu-card .val{font-size:14px;font-weight:700;color:${isHub ? '#1d4ed8' : '#b45309'}}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
    @media print{body{padding:12px}button{display:none}}
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
    <div>
      <h1>Shipment Record — ${invoice}</h1>
      <div class="sub">Generated on ${today} · Air freight @ ₹${airFreight}/kg · Pallets: ${palletDim} · Mode: ${palletMode}</div>
    </div>
    <button onclick="window.print()" style="padding:6px 16px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">🖨 Print / Save PDF</button>
  </div>

  <div class="route-badge ${route}">Selected route: ${isHub ? '📦 Hub Palletize + LTL' : '🏭 CFS Palletize + LTL'}</div>

  <div class="rec-box ${d.recommendation.winner}">${d.recommendation.text}</div>

  <div class="info-grid">
    <div class="info-cell"><span>Exporter</span><b>${exporter}</b></div>
    <div class="info-cell"><span>Consignee</span><b>${consignee}</b></div>
    <div class="info-cell"><span>Invoice</span><b>${invoice}</b></div>
    <div class="info-cell"><span>Origin</span><b>${pickup}</b></div>
    <div class="info-cell"><span>Destination</span><b>${dest}</b></div>
    <div class="info-cell"><span>Mode</span><b>${modeStr}</b></div>
  </div>

  <div class="metrics">
    <div class="metric"><div class="lbl">Pallets</div><div class="val">${d.summary.totPallets}</div></div>
    <div class="metric"><div class="lbl">Boxes</div><div class="val">${d.summary.totBoxes}</div></div>
    <div class="metric"><div class="lbl">Cargo wt</div><div class="val">${fKg(d.summary.totCargo)}</div></div>
    <div class="metric"><div class="lbl">Hub chargeable</div><div class="val">${fKg(d.weights.hubChargeable)}</div></div>
    <div class="metric"><div class="lbl">CFS chargeable</div><div class="val">${fKg(d.weights.cfsChargeable)}</div></div>
    <div class="metric"><div class="lbl">Total cost</div><div class="val" style="color:${isHub?'#1d4ed8':'#b45309'}">${fINR(totalINR)}</div></div>
  </div>

  <div class="section-title">Cost Breakdown (${isHub ? 'Hub + LTL' : 'CFS + LTL'})</div>
  ${costSection}

  <div class="section-title">Per-Unit Economics</div>
  <div class="per-unit">
    <div class="pu-card"><div class="lbl">Cost per box</div><div class="val">${fINR(isHub ? d.perUnit.hubPerBox : d.perUnit.cfsPerBox)}</div></div>
    <div class="pu-card"><div class="lbl">Cost per kg cargo</div><div class="val">${fINR(isHub ? d.perUnit.hubPerKg : d.perUnit.cfsPerKg)}</div></div>
    <div class="pu-card"><div class="lbl">Cost per pallet</div><div class="val">${fINR(isHub ? d.perUnit.hubPerPallet : d.perUnit.cfsPerPallet)}</div></div>
  </div>

  <div class="section-title">Pallet Detail</div>
  <table>
    <thead><tr>
      <th>Pallet</th><th>Boxes</th><th>SKU Mix</th><th>Cargo wt</th>
      <th>Total wt (+ tare)</th><th>Total lbs</th><th>Chargeable kg</th>
    </tr></thead>
    <tbody>${palletRows}</tbody>
  </table>

  <div class="section-title">SKU Allocation</div>
  <table>
    <thead><tr>
      <th>SKU / Product</th><th>Boxes</th><th>Gross wt</th><th>Boxes/pallet</th>
      <th>Pallets</th><th>Grid × Layers</th><th>Limit by</th>
    </tr></thead>
    <tbody>${skuRows}</tbody>
  </table>

  <div class="footer">
    <span>Hub vs CFS Calculator · ${invoice} · ${today}</span>
    <span>Route: ${isHub ? 'Hub Palletize + LTL' : 'CFS Palletize + LTL'} · AF ₹${airFreight}/kg</span>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    alert('Pop-up blocked. Please allow pop-ups for this site to create a record.');
  }
}

// ─── UNIT CONVERSION HELPERS ───
const IN_TO_CM = 2.54;
const CM_TO_IN = 1 / 2.54;
const round2 = v => Math.round(v * 100) / 100;

function getDimUnit() { return $('dimUnit').value; } // 'in' or 'cm'
function getHubCur() { return $('hubCurrency').value; } // 'INR' or 'USD'
function getCfsCur() { return $('cfsCurrency').value; } // 'USD' or 'INR'

// Convert pallet dims (always stored as inches internally for backend)
// Returns values in inches regardless of current display unit
function getPalletInches() {
  const u = getDimUnit();
  const pL = gv('pL'), pW = gv('pW'), pH = gv('pH');
  if (u === 'cm') return { pL: pL * CM_TO_IN, pW: pW * CM_TO_IN, pH: pH * CM_TO_IN };
  return { pL, pW, pH };
}

// Convert box dims from display unit to cm (backend expects cm)
function getBoxCm(r) {
  const u = getDimUnit();
  if (u === 'in') return { lcm: r.lcm * IN_TO_CM, wcm: r.wcm * IN_TO_CM, hcm: r.hcm * IN_TO_CM };
  return { lcm: r.lcm, wcm: r.wcm, hcm: r.hcm };
}

// Convert hub cost fields to INR (backend expects INR)
function getHubInr(fieldId) {
  const v = gv(fieldId);
  if (getHubCur() === 'USD') return v * gv('usdRate');
  return v;
}

// Convert CFS cost fields to USD (backend expects USD)
function getCfsUsd(fieldId) {
  const v = gv(fieldId);
  if (getCfsCur() === 'INR') return v / gv('usdRate');
  return v;
}

// ─── DIMENSION UNIT TOGGLE ───
function onDimUnitChange(oldUnit, newUnit) {
  const factor = (oldUnit === 'in' && newUnit === 'cm') ? IN_TO_CM : CM_TO_IN;
  const suffix = newUnit === 'cm' ? 'cm' : 'in';
  // Convert pallet dims
  ['pL', 'pW', 'pH'].forEach(id => { $(id).value = round2(gv(id) * factor); });
  // Convert box dims in rows
  rows.forEach(r => {
    r.lcm = round2(r.lcm * factor);
    r.wcm = round2(r.wcm * factor);
    r.hcm = round2(r.hcm * factor);
  });
  renderTable();
  // Update labels
  $('pL_lbl').childNodes[0].textContent = `L (${suffix})`;
  $('pW_lbl').childNodes[0].textContent = `W (${suffix})`;
  $('pH_lbl').childNodes[0].textContent = `H (${suffix})`;
  $('th_lcm').textContent = `L ${suffix}`;
  $('th_wcm').textContent = `W ${suffix}`;
  $('th_hcm').textContent = `H ${suffix}`;
}

// ─── HUB CURRENCY TOGGLE ───
function onHubCurrencyChange(oldCur, newCur) {
  const rate = gv('usdRate');
  const factor = (oldCur === 'INR' && newCur === 'USD') ? (1 / rate) : rate;
  const sym = newCur === 'USD' ? '$' : '₹';
  ['hPack', 'hFork', 'hIspm', 'hLtl', 'hDocs', 'hMisc'].forEach(id => {
    $(id).value = round2(gv(id) * factor);
  });
  // sellPrice is per-kg
  $('sellPrice').value = round2(gv('sellPrice') * factor);
  // Update labels
  ['hPack_lbl', 'hFork_lbl', 'hIspm_lbl', 'hLtl_lbl', 'hDocs_lbl', 'hMisc_lbl'].forEach(id => {
    const el = $(id);
    if (el) el.childNodes[0].textContent = el.childNodes[0].textContent.replace(/[₹$]/g, sym);
  });
  $('sell_lbl').childNodes[0].textContent = `Forwarder sell rate (${sym}/kg)`;
  // AF rate label
  $('af_lbl').childNodes[0].textContent = `Air freight (${sym}/kg chargeable)`;
  $('airFreight').value = round2(gv('airFreight') * factor);
  // Sensitivity range
  $('sensMin').value = round2(gv('sensMin') * factor);
  $('sensMax').value = round2(gv('sensMax') * factor);
  const sensSym = newCur === 'USD' ? '$' : '₹';
  $('sensMin_lbl').childNodes[0].textContent = `AF min (${sensSym}/kg)`;
  $('sensMax_lbl').childNodes[0].textContent = `AF max (${sensSym}/kg)`;
}

// ─── CFS CURRENCY TOGGLE ───
function onCfsCurrencyChange(oldCur, newCur) {
  const rate = gv('usdRate');
  const factor = (oldCur === 'USD' && newCur === 'INR') ? rate : (1 / rate);
  ['cRecov', 'cSort', 'cPall', 'cLtl', 'cDocs', 'cMisc'].forEach(id => {
    $(id).value = round2(gv(id) * factor);
  });
}

// ─── SKU ROWS ───
let rows = [];
let _id = 0;
const nxt = () => ++_id;

const PRELOAD = [
  { sku: 'Kapiva Moringa Powder 227G USA', hs: '30049011', pcs: 1296, boxes: 27, kg: 14.52, lcm: 49, wcm: 35, hcm: 41.5 },
  { sku: 'Kapiva Triphala Powder 397G USA', hs: '30049011', pcs: 1488, boxes: 62, kg: 12.96, lcm: 56, wcm: 45, hcm: 34 },
  { sku: 'Kapiva Amla Powder 227G USA', hs: '30049011', pcs: 1296, boxes: 27, kg: 14.58, lcm: 49, wcm: 35, hcm: 41.5 },
  { sku: 'Kapiva Shilajit Energy Sips', hs: '30049011', pcs: 1216, boxes: 19, kg: 6.91, lcm: 39, wcm: 31, hcm: 30.5 },
];

function init() {
  rows = PRELOAD.map(d => ({ id: nxt(), ...d }));
  // PRELOAD dims are in cm — convert to current display unit if needed
  if (getDimUnit() === 'in') {
    rows.forEach(r => {
      r.lcm = round2(r.lcm * CM_TO_IN);
      r.wcm = round2(r.wcm * CM_TO_IN);
      r.hcm = round2(r.hcm * CM_TO_IN);
    });
  }
  syncDimLabels();
  renderTable();
  updateInfoStrip();
}

function syncDimLabels() {
  const suffix = getDimUnit() === 'cm' ? 'cm' : 'in';
  $('pL_lbl').childNodes[0].textContent = `L (${suffix})`;
  $('pW_lbl').childNodes[0].textContent = `W (${suffix})`;
  $('pH_lbl').childNodes[0].textContent = `H (${suffix})`;
  $('th_lcm').textContent = `L ${suffix}`;
  $('th_wcm').textContent = `W ${suffix}`;
  $('th_hcm').textContent = `H ${suffix}`;
}

function addRow() {
  rows.push({ id: nxt(), sku: '', hs: '', pcs: 0, boxes: 0, kg: 0, lcm: 0, wcm: 0, hcm: 0 });
  renderTable();
}

function clearRows() {
  if (rows.length && !confirm(`Clear all ${rows.length} SKU row${rows.length > 1 ? 's' : ''}?`)) return;
  rows = [];
  renderTable();
  // Reset sidebar shipment fields
  $('pickup').value = ''; $('dest').value = ''; $('inv').value = ''; $('saveName').value = '';
  // Reset info strip
  $('infoExporter').textContent = '—'; $('infoConsignee').textContent = '—';
  $('infoInvoice').textContent = '—'; $('infoRoute').textContent = '—';
  $('infoMode').textContent = '—'; $('infoBoxes').textContent = '—';
  $('infoDistance').textContent = '—';
  $('titleText').textContent = 'Hub vs CFS Calculator';
  // Reset metrics
  ['mPallets','mBoxes','mCargo','mHubCharge','mCfsCharge','mAfDiff'].forEach(id => { $(id).textContent = '—'; });
  ['mHubChargeNote','mCfsChargeNote','mAfDiffSub'].forEach(id => { $(id).textContent = ''; });
  // Hide all result sections
  lastAnalysisData = null;
  ['recDiv','routeSelectorDiv','costSections','afSection','beSection','tatSection','perUnitSection','sensSection','qualSection','palletSection','allocSection'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  $('statusBadge').textContent = 'Enter SKUs';
}

function delRow(id) {
  rows = rows.filter(r => r.id !== id);
  renderTable();
}

function renderTable() {
  $('skuBody').innerHTML = rows.map(r => `<tr data-id="${r.id}">
    <td><input class="f-sku" value="${esc(r.sku)}" placeholder="Product name" style="min-width:140px"/></td>
    <td><input class="f-hs" value="${esc(r.hs)}" style="width:72px"/></td>
    <td><input class="f-pcs" type="number" value="${r.pcs}" min="0" style="width:55px"/></td>
    <td><input class="f-bx" type="number" value="${r.boxes}" min="0" style="width:50px"/></td>
    <td><input class="f-kg" type="number" value="${r.kg}" min="0" step="0.01" style="width:58px"/></td>
    <td><input class="f-lcm" type="number" value="${r.lcm}" min="0" step="0.1" style="width:48px"/></td>
    <td><input class="f-wcm" type="number" value="${r.wcm}" min="0" step="0.1" style="width:48px"/></td>
    <td><input class="f-hcm" type="number" value="${r.hcm}" min="0" step="0.1" style="width:48px"/></td>
    <td><button class="del" data-id="${r.id}">✕</button></td>
  </tr>`).join('');

  $('skuBody').querySelectorAll('tr').forEach(tr => {
    const id = +tr.dataset.id;
    const row = rows.find(r => r.id === id);
    if (!row) return;
    tr.querySelector('.f-sku').addEventListener('input', e => { row.sku = e.target.value; });
    tr.querySelector('.f-hs').addEventListener('input', e => { row.hs = e.target.value; });
    tr.querySelector('.f-pcs').addEventListener('input', e => { row.pcs = +e.target.value; autoCalc(); });
    tr.querySelector('.f-bx').addEventListener('input', e => { row.boxes = +e.target.value; updateInfoStrip(); autoCalc(); });
    tr.querySelector('.f-kg').addEventListener('input', e => { row.kg = +e.target.value; updateInfoStrip(); autoCalc(); });
    tr.querySelector('.f-lcm').addEventListener('input', e => { row.lcm = +e.target.value; autoCalc(); });
    tr.querySelector('.f-wcm').addEventListener('input', e => { row.wcm = +e.target.value; autoCalc(); });
    tr.querySelector('.f-hcm').addEventListener('input', e => { row.hcm = +e.target.value; autoCalc(); });
    tr.querySelector('.del').addEventListener('click', e => { delRow(+e.target.dataset.id); autoCalc(); });
  });
  updateInfoStrip();
}

function updateInfoStrip() {
  const totBoxes = rows.reduce((s, r) => s + (+r.boxes || 0), 0);
  const totKg = rows.reduce((s, r) => s + (+r.boxes || 0) * (+r.kg || 0), 0);
  $('infoBoxes').textContent = totBoxes > 0 ? `${totBoxes} · ${fmtN(totKg)} kg gross` : '—';
  $('infoInvoice').textContent = $('inv').value || '—';
  $('infoRoute').textContent = `${$('pickup').value || '?'} → ${$('dest').value || '?'}`;
}

// ─── AIR DISTANCE ───
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function geoClean(q) {
  // Strip warehouse/3PL/company prefix — keep last 2-3 geographic parts
  // e.g. "IUSR-AWD 3PL, Cowpens SC, US" → "Cowpens SC, US"
  const parts = q.split(',').map(s => s.trim()).filter(Boolean);
  const geo = parts.filter(p => !/3pl|awd|warehouse|pvt|ltd|inc|corp|llc|fulfil/i.test(p));
  return (geo.length >= 2 ? geo.slice(-2) : geo).join(', ') || q;
}

async function geocode(query) {
  const clean = geoClean(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error('Not found: ' + clean);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

let _distTimer = null;
async function updateDistance() {
  const pickup = $('pickup').value.trim();
  const dest = $('dest').value.trim();
  if (!pickup || !dest) { $('infoDistance').textContent = '—'; return; }
  $('infoDistance').textContent = '…';
  try {
    const [a, b] = await Promise.all([geocode(pickup), geocode(dest)]);
    const km = Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon));
    const miles = Math.round(km * 0.621371);
    $('infoDistance').textContent = `${km.toLocaleString()} km · ${miles.toLocaleString()} mi`;
  } catch {
    $('infoDistance').textContent = '—';
  }
}

function scheduleDistanceUpdate() {
  clearTimeout(_distTimer);
  _distTimer = setTimeout(updateDistance, 800);
}

// ─── PDF UPLOAD ───
const drop = $('pdfDrop');
const fileInput = $('pdfFileInput');
const statusEl = $('pdfStatus');

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') uploadPdf(f);
  else showStatus('err', 'Please drop a PDF file.');
});
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (f) uploadPdf(f);
  fileInput.value = '';
});

function showStatus(type, msg) {
  statusEl.className = `pdf-status ${type}`;
  statusEl.textContent = msg;
}

async function uploadPdf(file) {
  showStatus('loading', 'Reading PDF...');
  try {
    const result = await parsePdfLocal(file);
    const skus = result.skus;
    const meta = result.meta;
    rows = skus.map(d => ({ id: nxt(), ...d }));
    if (getDimUnit() === 'in') {
      rows.forEach(r => {
        r.lcm = round2(r.lcm * CM_TO_IN);
        r.wcm = round2(r.wcm * CM_TO_IN);
        r.hcm = round2(r.hcm * CM_TO_IN);
      });
    }
    renderTable();
    if (meta.invoice) { $('inv').value = meta.invoice; $('saveName').value = meta.invoice; }
    if (meta.pickup) $('pickup').value = meta.pickup;
    if (meta.destination) $('dest').value = meta.destination;
    if (meta.exporter) $('infoExporter').textContent = meta.exporter;
    if (meta.consignee) $('infoConsignee').textContent = meta.consignee;
    if (meta.mode) $('infoMode').textContent = meta.mode;
    updateInfoStrip();
    showStatus('ok', `Imported ${rows.length} SKU${rows.length > 1 ? 's' : ''} from PDF — review & edit if needed`);
    $('statusBadge').textContent = 'PDF imported';
    $('titleText').textContent = meta.invoice || 'Hub vs CFS Calculator';
    autoCalc();
  } catch (e) {
    showStatus('err', 'PDF parse failed: ' + e.message);
  }
}

async function parsePdfLocal(file) {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  console.log('PDF pages:', pdf.numPages);

  const items = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const t = it.str.trim();
      if (t) items.push({ t, x: it.transform[4], y: it.transform[5], p });
    }
  }
  console.log('Text items extracted:', items.length);
  if (items.length === 0) throw new Error('No text found in PDF — it may be a scanned image. Use a PDF with selectable text, or enter data manually.');
  console.log('First 30 items:', items.slice(0, 30).map(i => i.t));

  items.sort((a, b) => a.p - b.p || b.y - a.y || a.x - b.x);
  const tableRows = [];
  let cr = [], ly = null, lp = null;
  for (const it of items) {
    if (lp !== it.p || ly === null || Math.abs(it.y - ly) > 4) {
      if (cr.length) tableRows.push(cr.sort((a, b) => a.x - b.x));
      cr = [it]; ly = it.y; lp = it.p;
    } else { cr.push(it); }
  }
  if (cr.length) tableRows.push(cr.sort((a, b) => a.x - b.x));

  const DIM_RE = /(\d+\.?\d*)\s*[×xX*]\s*(\d+\.?\d*)\s*[×xX*]\s*(\d+\.?\d*)/;

  // 1. Scan for global dimension line (e.g. "DIMENSION 42*40*20 cm")
  let globalDims = null;
  for (const row of tableRows) {
    const full = row.map(it => it.t).join(' ');
    if (/dimension/i.test(full)) {
      const m = DIM_RE.exec(full);
      if (m) { globalDims = { lcm: parseFloat(m[1]), wcm: parseFloat(m[2]), hcm: parseFloat(m[3]) }; break; }
    }
  }
  console.log('Global dims:', globalDims);

  // 2. Find header row — merge 2-3 consecutive rows to handle wrapped headers
  const HDR_KW = [/box|carton/i, /piece|pcs|qty|units/i, /hsn?|tariff/i, /wt|weight/i];
  const COL_RULES = [
    { f: 'sku', re: /content|product|description|item\s*name|variant|sku/i },
    { f: 'hs', re: /hsn?\s*code|tariff|hts/i },
    { f: 'pcs', re: /piece|pcs|units|qty|no\s*of/i },
    { f: 'boxes', re: /^box|carton|ctn|case/i },
    { f: 'kgBox', re: /avg|wt.*box|per\s*box/i },
    { f: 'grossWt', re: /gross/i },
    { f: 'netWt', re: /net/i },
    { f: 'dims', re: /dim|size|l.*w.*h|measurement/i },
  ];

  let hdrIdx = -1;
  const fieldXMap = {};

  for (let i = 0; i < tableRows.length; i++) {
    // Merge this row with next 1-2 rows to handle multi-line headers
    const merged = [];
    for (let j = i; j < Math.min(i + 3, tableRows.length); j++) merged.push(...tableRows[j]);
    const joinedText = merged.map(it => it.t).join(' ').toLowerCase();
    const hits = HDR_KW.filter(re => re.test(joinedText)).length;
    if (hits >= 3) {
      hdrIdx = i;
      // Map columns using X positions from all merged header rows
      for (const it of merged) {
        for (const c of COL_RULES) {
          if (c.re.test(it.t) && !fieldXMap[c.f]) { fieldXMap[c.f] = it.x; break; }
        }
      }
      // Skip past the merged header rows for data start
      break;
    }
  }
  console.log('Header at row:', hdrIdx, 'Columns:', fieldXMap);

  // Determine data start (skip multi-line header)
  let dataStart = hdrIdx >= 0 ? hdrIdx + 1 : 0;
  if (hdrIdx >= 0) {
    const hdrY = tableRows[hdrIdx][0]?.y;
    for (let j = hdrIdx + 1; j < Math.min(hdrIdx + 4, tableRows.length); j++) {
      const rowText = tableRows[j].map(it => it.t).join(' ').toLowerCase();
      if (HDR_KW.filter(re => re.test(rowText)).length >= 1 && !/^\d+\s/.test(rowText.trim())) {
        dataStart = j + 1;
      } else break;
    }
  }

  // Build column zones: each column owns the range from midpoint-to-left-neighbor to midpoint-to-right-neighbor
  const sortedCols = Object.entries(fieldXMap).sort((a, b) => a[1] - b[1]);
  const colZones = sortedCols.map(([f, fx], idx) => {
    const left = idx > 0 ? (fx + sortedCols[idx - 1][1]) / 2 : fx - 80;
    const right = idx < sortedCols.length - 1 ? (fx + sortedCols[idx + 1][1]) / 2 : fx + 80;
    return { f, fx, left, right };
  });

  function nearestField(x) {
    for (const z of colZones) {
      if (x >= z.left && x <= z.right) return z.f;
    }
    let best = null, bd = 120;
    for (const [f, fx] of sortedCols) {
      const d = Math.abs(x - fx);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  // 3. Parse data rows
  const skus = [];

  for (let ri = dataStart; ri < tableRows.length; ri++) {
    const row = tableRows[ri];
    const full = row.map(it => it.t).join(' ');

    // Skip total/summary/dimension rows
    if (/total|grand|sub\s*total|dimension|declaration|we\s*declare/i.test(full)) continue;

    // Check for per-row dimensions first
    const dimMatch = DIM_RE.exec(full);
    let lcm, wcm, hcm;
    if (dimMatch) {
      lcm = parseFloat(dimMatch[1]); wcm = parseFloat(dimMatch[2]); hcm = parseFloat(dimMatch[3]);
    } else if (globalDims) {
      lcm = globalDims.lcm; wcm = globalDims.wcm; hcm = globalDims.hcm;
    } else {
      lcm = 0; wcm = 0; hcm = 0;
    }

    // A data row needs: an HS code (6-8 digit) OR a serial number + enough numbers
    const hasHs = /\b\d{6,8}\b/.test(full);
    const numCells = row.filter(it => /^[\d,.]+$/.test(it.t.trim())).length;
    if (!hasHs && numCells < 3) continue;

    let sku = '', hs = '', pcs = 0, boxes = 0, kg = 0, grossWt = 0;

    // Column-based mapping
    if (Object.keys(fieldXMap).length >= 3) {
      for (const it of row) {
        let f = nearestField(it.x);
        const nv = parseFloat(it.t.replace(/,/g, ''));
        // Disambiguate boxes vs kgBox for borderline cells: integers → boxes, decimals → kgBox
        if ((f === 'kgBox' || f === 'boxes') && !isNaN(nv) && fieldXMap.boxes !== undefined && fieldXMap.kgBox !== undefined) {
          const isInt = /^\d[\d,]*$/.test(it.t.trim());
          const dBox = Math.abs(it.x - fieldXMap.boxes);
          const dKg = Math.abs(it.x - fieldXMap.kgBox);
          if (dBox < 30 && dKg < 30) f = isInt ? 'boxes' : 'kgBox';
        }
        if (f === 'sku' && it.t.length > 3 && !/^\d{6,}$/.test(it.t.replace(/,/g, ''))) {
          sku = sku ? sku + ' ' + it.t : it.t;
        }
        else if (f === 'hs') { const m = it.t.match(/\d{6,8}/); if (m) hs = m[0]; }
        else if (f === 'pcs' && !isNaN(nv)) pcs = nv;
        else if (f === 'boxes' && !isNaN(nv) && nv < 10000) boxes = nv;
        else if (f === 'kgBox' && !isNaN(nv)) kg = nv;
        else if (f === 'grossWt' && !isNaN(nv)) grossWt = nv;
      }
    }

    // Fallback: heuristic
    if (!sku) {
      const tc = row.filter(it => it.t.length > 5 && !/^\d/.test(it.t) && !DIM_RE.test(it.t) && !/onesto|pvt|ltd/i.test(it.t));
      sku = tc.sort((a, b) => b.t.length - a.t.length)[0]?.t || '';
    }
    if (!hs) { const m = full.match(/\b(\d{8})\b/); if (m) hs = m[1]; }
    if (!kg && grossWt > 0 && boxes > 0) kg = Math.round((grossWt / boxes) * 100) / 100;

    if (!boxes || !pcs) {
      const nums = row
        .filter(it => /^[\d,.]+$/.test(it.t.trim()))
        .map(it => parseFloat(it.t.replace(/,/g, '')))
        .filter(v => !isNaN(v) && v > 0 && v !== parseInt(hs) && v !== lcm && v !== wcm && v !== hcm);
      for (const n of nums) {
        if (!pcs && n >= 100 && n === Math.round(n) && n > (boxes || 0)) { pcs = n; continue; }
        if (!boxes && n >= 1 && n <= 999 && n === Math.round(n)) { boxes = n; continue; }
        if (!kg && n > 0 && n < 100 && n !== pcs && n !== boxes) { kg = n; continue; }
      }
    }

    if (boxes > 0 && sku) {
      skus.push({ sku: sku || 'Unknown SKU', hs: hs || '', pcs: Math.round(pcs), boxes: Math.round(boxes), kg: +kg.toFixed(2), lcm, wcm, hcm });
    }
  }

  if (!skus.length) {
    const sample = tableRows.slice(0, 25).map((r, i) => `[${i}] ${r.map(it => it.t).join(' | ')}`).join('\n');
    console.log('PDF extracted rows:\n' + sample);
    console.log('Total rows:', tableRows.length);
    throw new Error('No SKU rows found. Check browser console (F12) for extracted text.');
  }

  const meta = extractPdfMeta(tableRows);
  console.log('Parsed SKUs:', skus, 'Meta:', meta);
  return { skus, meta };
}

function extractPdfMeta(tableRows) {
  const meta = {};
  const LABEL_RE = /^(port|loading|discharge|destination|final|country|origin|vessel|flight|pre.?carriage|place|receipt|marks|container|no\s*of|avg|weight|gross|net|hsn|code|content|variant|made|pieces|boxes|kgs|s\s*no)\b/i;
  const SKIP_RE = /port|loading|discharge|destination|final|country|origin|vessel|flight|pre.?carriage|place|receipt|marks|container|invoice|awb|gst|iec|date|manufacturer|exporter|consignee|ship\s*to|declaration/i;

  for (let i = 0; i < Math.min(tableRows.length, 40); i++) {
    const cells = tableRows[i].map(it => it.t);
    const row = cells.join(' ');

    // Invoice number
    if (/invoice\s*no/i.test(row) && !meta.invoice) {
      for (let j = i; j < Math.min(i + 2, tableRows.length); j++) {
        for (const it of tableRows[j]) {
          const m = it.t.match(/([A-Z]{1,5}[\d/.-]+[\dA-Z]*)/);
          if (m && m[1].length > 4) { meta.invoice = m[1]; break; }
        }
        if (meta.invoice) break;
      }
    }

    // Exporter
    if (/manufacturer|exporter/i.test(row) && !meta.exporter) {
      for (let j = i; j < Math.min(i + 5, tableRows.length); j++) {
        const t = tableRows[j].map(it => it.t).join(' ');
        const comp = t.match(/([\w\s]+(Private\s*Limited|Pvt\s*Ltd|Inc|Corp|LLC|Ltd)\.?)/i);
        if (comp) { meta.exporter = comp[1].trim().replace(/\s+/g, ' '); break; }
      }
    }

    // Consignee (Ship to) — extract both consignee name AND full destination address
    if (/consignee|ship\s*to/i.test(row) && !meta.consignee) {
      const consigneeLines = [];
      for (let j = i + 1; j < Math.min(i + 10, tableRows.length); j++) {
        const t = tableRows[j].map(it => it.t).join(' ').trim();
        if (!t) continue;
        if (/pre.?carriage|vessel|port\s*of|marks|s\s*no|hsn|country\s*of|invoice\s*no|exporter/i.test(t)) break;
        consigneeLines.push(t);
      }

      // Company name — first line with Inc/LLC/Ltd/Corp/AWD/Amazon
      for (const t of consigneeLines) {
        const comp = t.match(/([\w\s]+(Private\s*Limited|Pvt\s*Ltd|Inc|Corp|LLC|Ltd|AWD|Amazon)[\w\s.]*)/i);
        if (comp) {
          const name = comp[1].trim().replace(/\s+/g, ' ');
          if (name !== meta.exporter) { meta.consignee = name; break; }
        }
        const co = t.match(/c\/o\s+(.+)/i);
        if (co) { meta.consignee = co[0].trim(); break; }
      }

      // Destination — grab zip + state + country from the Ship to address block
      if (!meta.destination) {
        let zip = '', state = '', country = '';
        for (const t of consigneeLines) {
          const US_STATES = /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
          // ZIP code (5 digits)
          if (!zip) { const m = t.match(/\b(\d{5})\b/); if (m) zip = m[1]; }
          // State code — must match known US state abbreviation
          if (!state) { const m = t.match(/\b([A-Z]{2})\b/); if (m && US_STATES.test(m[1])) state = m[1]; }
          // Country
          if (!country) { const m = t.match(/\b(United\s*States|USA|U\.S\.A\.?|US)\b/i); if (m) country = 'US'; }
        }
        const parts = [zip, state, country].filter(Boolean);
        if (parts.length) meta.destination = parts.join(', ');
      }
    }

    // Pickup from "Port Of Loading" — value is typically on the next row
    if (/port\s*of\s*loading/i.test(row) && !meta.pickup) {
      for (let j = i; j < Math.min(i + 3, tableRows.length); j++) {
        for (const it of tableRows[j]) {
          if (SKIP_RE.test(it.t)) continue;
          if (it.t.length >= 3 && /^[A-Z]/.test(it.t) && !/^\d/.test(it.t)) { meta.pickup = it.t.trim(); break; }
        }
        if (meta.pickup) break;
      }
    }

    // Destination from "Final Destination" or "Port Of Discharge"
    if ((/final\s*destination/i.test(row) || /port\s*of\s*discharge/i.test(row)) && !meta.destination) {
      for (let j = i; j < Math.min(i + 3, tableRows.length); j++) {
        for (const it of tableRows[j]) {
          if (SKIP_RE.test(it.t)) continue;
          if (it.t.length >= 2 && /^[A-Z]/.test(it.t) && !/^\d/.test(it.t)) { meta.destination = it.t.trim(); break; }
        }
        if (meta.destination) break;
      }
    }

    // Mode
    if (/pre.?carriage|by\s*air|by\s*sea/i.test(row) && !meta.mode) {
      if (/air/i.test(row)) meta.mode = 'By Air · DDP';
      else if (/sea|ocean/i.test(row)) meta.mode = 'By Sea';
    }
  }
  console.log('Extracted meta:', JSON.stringify(meta));
  return meta;
}

// ─── CALCULATION (runs fully in browser) ───
function runCalculation() {
  const valid = rows.filter(r => r.boxes > 0 && r.kg > 0);
  if (!valid.length) { alert('Add at least one SKU with boxes > 0 and gross kg > 0.'); return; }

  const palIn = getPalletInches();
  const rate = gv('usdRate') || 93.88;
  const hubToInr = getHubCur() === 'USD' ? rate : 1;
  const cfsToUsd = getCfsCur() === 'INR' ? (1 / rate) : 1;
  const afToInr = getHubCur() === 'USD' ? rate : 1;
  const sensToInr = afToInr;

  const payload = {
    skus: rows.map(r => {
      const b = getBoxCm(r);
      return { sku: r.sku, hs: r.hs, pcs: r.pcs, boxes: r.boxes, kg: r.kg, lcm: b.lcm, wcm: b.wcm, hcm: b.hcm };
    }),
    palletL: palIn.pL, palletW: palIn.pW, palletH: palIn.pH,
    maxKg: gv('maxKg'), tare: gv('tare'), fallback: gv('fallback'), divisor: +$('divisor').value,
    airFreight: gv('airFreight') * afToInr,
    sellPrice: gv('sellPrice') * hubToInr,
    hPack: gv('hPack') * hubToInr, hFork: gv('hFork') * hubToInr, hIspm: gv('hIspm') * hubToInr,
    hLtl: gv('hLtl') * hubToInr, hDocs: gv('hDocs') * hubToInr, hMisc: gv('hMisc') * hubToInr,
    cRecov: gv('cRecov') * cfsToUsd, cSort: gv('cSort') * cfsToUsd, cPall: gv('cPall') * cfsToUsd,
    cLtl: gv('cLtl') * cfsToUsd, cDocs: gv('cDocs') * cfsToUsd, cMisc: gv('cMisc') * cfsToUsd,
    usdRate: rate,
    hubTat: gv('hubTat'), cfsTat: gv('cfsTat'),
    sensMin: gv('sensMin') * sensToInr, sensMax: gv('sensMax') * sensToInr,
    palletMode: $('palletMode').value,
    boxRotation: $('boxRotation').value,
  };

  $('loadingOverlay').classList.add('show');
  try {
    const data = fullAnalysis(payload);
    renderResults(data);
    $('statusBadge').textContent = 'Calculated';
  } catch (e) {
    alert('Calculation error: ' + e.message);
  } finally {
    $('loadingOverlay').classList.remove('show');
  }
}

function applyUtilColumns() {
  const show = $('showUtilization')?.checked;
  document.querySelectorAll('.util-col').forEach(el => {
    el.style.display = show ? '' : 'none';
  });
}

function renderResults(d) {
  lastAnalysisData = d;
  const { summary, weights, hubCosts, cfsCosts, breakEven, sensitivity, recommendation, pallets, allocation, perUnit, config } = d;
  const airFreight = gv('airFreight');
  const usdRate = gv('usdRate') || 93.88;

  // ─── METRICS ───
  $('mPallets').textContent = summary.totPallets;
  $('mBoxes').textContent = summary.totBoxes;
  $('mCargo').textContent = fmtKg(summary.totCargo);
  $('mHubCharge').textContent = fmtKg(weights.hubChargeable);
  $('mHubChargeNote').textContent = weights.hubChargeNote;
  $('mCfsCharge').textContent = fmtKg(weights.cfsChargeable);
  $('mCfsChargeNote').textContent = weights.cfsChargeNote;
  const afWtDiff = weights.hubChargeable - weights.cfsChargeable;
  $('mAfDiff').textContent = (afWtDiff >= 0 ? '+' : '') + fmtN(afWtDiff, 1) + ' kg';
  $('mAfDiffSub').textContent = afWtDiff >= 0 ? 'hub pays more AF' : 'CFS pays more AF';

  // ─── RECOMMENDATION ───
  const rd = $('recDiv');
  rd.textContent = recommendation.text;
  rd.className = `rec ${recommendation.winner}`;
  rd.style.display = 'block';

  // ─── COST CARDS ───
  $('hubTotal').textContent = fc(hubCosts.hubTotal);
  $('h_af_label').textContent = `Extra AF (${hubCosts.hubExtraAFwt > 0 ? fmtN(hubCosts.hubExtraAFwt, 1) + ' kg extra' : 'no extra wt'})`;
  $('h_airfreight').textContent = fmtINR(hubCosts.hubExtraAF);
  $('h_packing').textContent = fmtINR(hubCosts.hPacking);
  $('h_forklift').textContent = fmtINR(hubCosts.hForklift);
  $('h_ispm').textContent = fmtINR(hubCosts.hIspmCost);
  $('h_additional').textContent = fmtINR(hubCosts.hAdditional);
  $('h_additional_row').style.display = hubCosts.hAdditional > 0 ? 'flex' : 'none';
  $('h_ltl').textContent = fmtINR(hubCosts.hLtl);
  $('h_docs').textContent = fmtINR(hubCosts.hDocs);
  $('h_misc').textContent = fmtINR(hubCosts.hMisc);
  $('h_grand').textContent = fc(hubCosts.hubTotal);

  $('cfsTotal').textContent = fc(cfsCosts.cfsTotal);
  $('c_airfreight').textContent = cfsCosts.cfsExtraAF > 0 ? fmtINR(cfsCosts.cfsExtraAF) : '₹0 (actual wt wins)';
  $('c_recov').textContent = `${fmtUSD(cfsCosts.cR)} (${fmtINR(cfsCosts.cR * usdRate)})`;
  $('c_sort').textContent = `${fmtUSD(cfsCosts.cS)} (${fmtINR(cfsCosts.cS * usdRate)})`;
  $('c_pall').textContent = `${fmtUSD(cfsCosts.cP)} (${fmtINR(cfsCosts.cP * usdRate)})`;
  $('c_ltl').textContent = `${fmtUSD(cfsCosts.cL)} (${fmtINR(cfsCosts.cL * usdRate)})`;
  $('c_docs').textContent = `${fmtUSD(cfsCosts.cD)} (${fmtINR(cfsCosts.cD * usdRate)})`;
  $('c_misc').textContent = `${fmtUSD(cfsCosts.cM)} (${fmtINR(cfsCosts.cM * usdRate)})`;
  $('c_usd').textContent = fmtUSD(cfsCosts.cfsTotalUSD);
  $('c_grand').textContent = fc(cfsCosts.cfsTotal);

  $('hubWinBadge').style.display = recommendation.hubCheap ? 'inline' : 'none';
  $('cfsWinBadge').style.display = !recommendation.hubCheap ? 'inline' : 'none';

  // ─── AF ANALYSIS ───
  $('af_h_cargo').textContent = fmtKg(summary.totCargo);
  $('af_h_tare').textContent = `+${fmtKg(weights.extraWt)} (${summary.totPallets}p × ${config.tare} kg)`;
  $('af_h_actual_tare').textContent = fmtKg(weights.afterWt);
  $('af_h_vol').textContent = fmtKg(weights.palletVolWt) + ` (${summary.totPallets}p × ${fmtN(weights.volPerPallet, 1)} kg/p)`;
  $('af_h_charge').textContent = fmtKg(weights.hubChargeable) + ` [${weights.hubChargeNote}]`;
  $('af_h_extra').textContent = hubCosts.hubExtraAFwt > 0 ? `+${fmtN(hubCosts.hubExtraAFwt, 1)} kg` : '0 kg';
  $('af_h_cost').textContent = fmtINR(hubCosts.hubExtraAF);

  $('af_c_cargo').textContent = fmtKg(summary.totCargo);
  $('af_c_vol').textContent = fmtKg(weights.boxVolWt);
  $('af_c_charge').textContent = fmtKg(weights.cfsChargeable) + ` [${weights.cfsChargeNote}]`;
  $('af_c_extra').textContent = cfsCosts.cfsExtraAFwt > 0 ? `+${fmtN(cfsCosts.cfsExtraAFwt, 1)} kg` : '0 kg';
  $('af_c_cost').textContent = cfsCosts.cfsExtraAF > 0 ? fmtINR(cfsCosts.cfsExtraAF) : '₹0';

  const afCostDiff = hubCosts.hubExtraAF - cfsCosts.cfsExtraAF;
  $('af_diff_wt').textContent = afWtDiff > 0 ? `${fmtN(afWtDiff, 1)} kg (hub heavier)` : afWtDiff < 0 ? `${fmtN(-afWtDiff, 1)} kg (CFS heavier)` : 'Equal';
  const afDiffEl = $('af_diff_cost');
  afDiffEl.textContent = afCostDiff > 0 ? fmtINR(afCostDiff) + ' (hub pays more)' : afCostDiff < 0 ? fmtINR(-afCostDiff) + ' (CFS pays more)' : 'Equal';
  afDiffEl.className = afCostDiff > 0 ? 'green' : 'red';

  // ─── BREAK-EVEN ───
  const beRateEl = $('beRate');
  if (breakEven.beRate !== null && breakEven.beValid) {
    beRateEl.textContent = `₹${Math.round(breakEven.beRate)}/kg`;
    beRateEl.className = 'be-rate';
    const bv = $('beVerdict');
    if (airFreight < breakEven.beRate) {
      $('beSub').textContent = `Current ₹${airFreight}/kg is BELOW break-even. Hub cheaper. Switch to CFS above ₹${Math.round(breakEven.beRate)}/kg.`;
      bv.textContent = `At ₹${airFreight}/kg: Hub cheaper by ${fmtINR(recommendation.saving)}`;
      bv.className = 'be-verdict hub';
    } else if (airFreight > breakEven.beRate) {
      $('beSub').textContent = `Current ₹${airFreight}/kg is ABOVE break-even. CFS cheaper. Switch to Hub below ₹${Math.round(breakEven.beRate)}/kg.`;
      bv.textContent = `At ₹${airFreight}/kg: CFS cheaper by ${fmtINR(recommendation.saving)}`;
      bv.className = 'be-verdict cfs';
    } else {
      $('beSub').textContent = 'Current rate equals break-even — both routes cost the same.';
      bv.textContent = 'Tied — decide on TAT or qualitative factors';
      bv.className = 'be-verdict neutral';
    }
  } else {
    beRateEl.textContent = 'N/A';
    beRateEl.className = 'be-rate na';
    $('beSub').textContent = breakEven.beMessage;
    const bv = $('beVerdict');
    const always = hubCosts.hubTotal < cfsCosts.cfsTotal ? 'Hub' : 'CFS';
    bv.textContent = `${always} wins at all realistic AF rates`;
    bv.className = `be-verdict ${always.toLowerCase()}`;
  }

  $('be_hfixed').textContent = fmtINR(hubCosts.hubFixed);
  $('be_cfixed').textContent = fmtINR(cfsCosts.cfsFixed_inr);
  const fAdv = cfsCosts.cfsFixed_inr - hubCosts.hubFixed;
  $('be_fixed_adv').textContent = fAdv > 0 ? `${fmtINR(fAdv)} → Hub fixed lower` : fAdv < 0 ? `${fmtINR(-fAdv)} → CFS fixed lower` : 'Equal';
  $('be_h_af_wt').textContent = fmtN(hubCosts.hubExtraAFwt, 1) + ' kg';
  $('be_c_af_wt').textContent = fmtN(cfsCosts.cfsExtraAFwt, 1) + ' kg';
  const beAfWtDelta = hubCosts.hubExtraAFwt - cfsCosts.cfsExtraAFwt;
  $('be_af_adv').textContent = beAfWtDelta > 0 ? `${fmtN(beAfWtDelta, 1)} kg → CFS lighter` : beAfWtDelta < 0 ? `${fmtN(-beAfWtDelta, 1)} kg → Hub lighter` : 'Equal';
  $('be_cur_rate').textContent = `₹${airFreight}/kg`;
  $('be_af_cost_adv').textContent = afCostDiff > 0 ? `${fmtINR(afCostDiff)} → CFS saves on AF` : afCostDiff < 0 ? `${fmtINR(-afCostDiff)} → Hub saves on AF` : 'Equal';

  // ─── TAT ───
  const hubTat = config.hubTat, cfsTat = config.cfsTat;
  const maxT = Math.max(hubTat, cfsTat) || 1;
  const hubFast = hubTat <= cfsTat;
  const tatDiff = Math.abs(hubTat - cfsTat);
  $('hubTatLbl').textContent = hubTat + ' hrs';
  $('cfsTatLbl').textContent = cfsTat + ' hrs';
  $('hubTatBar').style.cssText = `width:${Math.round(hubTat / maxT * 100)}%;background:${hubFast ? '#bfdbfe' : '#e5e7eb'}`;
  $('cfsTatBar').style.cssText = `width:${Math.round(cfsTat / maxT * 100)}%;background:${!hubFast ? '#fde68a' : '#e5e7eb'}`;
  $('tatNote').textContent = `Hub is ${hubFast ? tatDiff + ' hrs faster' : 'slower by ' + tatDiff + ' hrs'} than CFS.`;

  $('w_cargo').textContent = fmtKg(summary.totCargo);
  $('w_tare').textContent = `+${fmtKg(weights.extraWt)} (${summary.totPallets}p × ${config.tare}kg)`;
  $('w_hub_charge').textContent = fmtKg(weights.hubChargeable) + ` [${weights.hubChargeNote}]`;
  $('w_box_vol').textContent = fmtKg(weights.boxVolWt);
  $('w_cfs_charge').textContent = fmtKg(weights.cfsChargeable) + ` [${weights.cfsChargeNote}]`;

  // ─── PER-UNIT ───
  $('pu_hub_box').textContent = fc(perUnit.hubPerBox) + '/box';
  $('pu_cfs_box').textContent = fc(perUnit.cfsPerBox) + '/box';
  $('pu_hub_kg').textContent = fc(perUnit.hubPerKg) + '/kg';
  $('pu_cfs_kg').textContent = fc(perUnit.cfsPerKg) + '/kg';
  $('pu_hub_pallet').textContent = fc(perUnit.hubPerPallet) + '/plt';
  $('pu_cfs_pallet').textContent = fc(perUnit.cfsPerPallet) + '/plt';

  // ─── SENSITIVITY ───
  $('sensBody').innerHTML = sensitivity.map(s => {
    const cls = s.isCurrent ? ' class="cur"' : '';
    const winnerHtml = s.winner === 'HUB' ? '<span class="sens-win-hub">HUB</span>'
      : s.winner === 'CFS' ? '<span class="sens-win-cfs">CFS</span>'
      : '<span class="sens-win-tie">~Tie</span>';
    const savingTxt = s.saving < 100 ? '~equal' : s.delta < 0 ? fmtINR(s.saving) + ' → Hub' : fmtINR(s.saving) + ' → CFS';
    return `<tr${cls}><td><b>₹${s.afRate}/kg${s.isCurrent ? ' ◀' : ''}</b></td>
      <td>${fmtINR(s.hubExtraAF)}</td><td>${fmtINR(s.hubFixed)}</td><td>${fmtINR(s.hubTotal)}</td>
      <td>${s.cfsExtraAF > 0 ? fmtINR(s.cfsExtraAF) : '₹0'}</td><td>${fmtINR(s.cfsFixed)}</td><td>${fmtINR(s.cfsTotal)}</td>
      <td>${savingTxt}</td><td>${winnerHtml}</td></tr>`;
  }).join('');

  // ─── PALLETS ───
  const pLin = gv('pL'), pWin = gv('pW'), pHin = gv('pH');
  const dimIsIn = getDimUnit() === 'in';
  const isMixed = d.palletMode === 'mixed';
  let tB = 0, tC = 0, tW = 0, tLb = 0;
  pallets.forEach(p => { tB += p.boxes; tC += p.cargo; tW += p.total; tLb += p.lbs; });
  const mixNote = isMixed && d.separatePallets > pallets.length
    ? ` <span style="font-size:10px;color:var(--green);font-weight:500">(saved ${d.separatePallets - pallets.length} pallets vs separate)</span>` : '';

  function utilBar(pct, cls) {
    const w = Math.min(pct, 100);
    const barCls = pct > 99 ? 'util-over' : cls;
    return `<span style="font-size:11px;font-weight:600;color:${pct>99?'#ef4444':pct>79?'#047857':'#475569'}">${pct}%</span>`
      + `<span class="util-bar ${barCls}" style="width:${w*0.4}px"></span>`;
  }
  function floorAreaPct(p) {
    const pLcm = config.palletLcm, pWcm = config.palletWcm;
    if (!p.floorLcm || !p.floorWcm || !pLcm || !pWcm) return 0;
    return Math.round(p.floorLcm * p.floorWcm / (pLcm * pWcm) * 100);
  }
  function floorStr(p) {
    if (!p.floorLcm || !p.floorWcm) return '—';
    if (dimIsIn) {
      const fL = round2(p.floorLcm * CM_TO_IN), fW = round2(p.floorWcm * CM_TO_IN);
      return `<span class="util-floor">${fL}×${fW}"</span>`;
    }
    return `<span class="util-floor">${p.floorLcm}×${p.floorWcm}cm</span>`;
  }

  $('palletBody').innerHTML = [
    ...pallets.map(p => {
      const actH = p.actualHeightCm > 0
        ? round2(dimIsIn ? p.actualHeightCm * CM_TO_IN : p.actualHeightCm)
        : pHin;
      const dimStr = `${pLin}×${pWin}×${actH}${dimIsIn ? '"' : 'cm'}`;
      const layerNote = p.layers ? ` <span style="font-size:8px;color:var(--text3)">(${p.layers}L)</span>` : '';
      const skuTd = p.skuCount > 1
        ? `<td style="font-size:9px;color:var(--text2);max-width:160px;white-space:normal;line-height:1.3">${esc(p.skuMix)}</td>`
        : `<td style="font-size:9px;color:var(--text3)">${esc(p.skuMix)}</td>`;
      return `<tr>
      <td><b>Pallet ${p.n}</b></td><td>${dimStr}${layerNote}</td>
      <td>${p.boxes}</td>${skuTd}<td>${fmtN(p.cargo)}</td><td>+${config.tare}</td>
      <td><b>${fmtN(p.total)}</b></td><td><b>${fmtN(p.lbs, 1)}</b></td>
      <td>${fmtN(p.vol)}</td><td><b>${fmtN(p.charge)}</b></td>
      <td class="util-col" style="display:none;white-space:nowrap">${utilBar(p.weightUtil,'util-wt')}</td>
      <td class="util-col" style="display:none;white-space:nowrap">${utilBar(p.dimUtil,'util-dim')}</td>
      <td class="util-col" style="display:none;white-space:nowrap">${utilBar(floorAreaPct(p),'util-dim')}</td>
      <td class="util-col" style="display:none">${floorStr(p)}</td>
    </tr>`;
    }),
    `<tr class="tr"><td colspan="2"><b>Total (${pallets.length} pallets)${mixNote}</b></td>
      <td><b>${tB}</b></td><td>—</td><td><b>${fmtN(tC)}</b></td><td>—</td>
      <td><b>${fmtN(tW)}</b></td><td><b>${fmtN(tLb, 1)}</b></td><td>—</td><td>—</td>
      <td class="util-col" style="display:none"></td>
      <td class="util-col" style="display:none"></td>
      <td class="util-col" style="display:none"></td>
      <td class="util-col" style="display:none"></td></tr>`
  ].join('');
  applyUtilColumns();

  // ─── ALLOCATION ───
  $('allocBody').innerHTML = allocation.map(r => `<tr>
    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.sku)}</td>
    <td>${r.boxes}</td>
    <td>${fmtN(r.skuBoxVolWt, 1)} kg</td>
    <td>${r.eff}</td><td><b>${r.pallets}</b></td>
    <td><span class="pill ${r.reason === 'dimension' ? 'pill-d' : r.reason === 'weight' ? 'pill-w' : 'pill-f'}">${r.reason}</span></td>
    <td style="font-size:10px;color:var(--text3)">${r.gl}</td>
  </tr>`).join('');

  // Show route selector and auto-select recommended route
  const routeSel = $('routeSelectorDiv');
  if (routeSel) {
    routeSel.style.display = 'flex';
    selectRoute(recommendation.winner === 'hub' ? 'hub' : 'cfs');
  }

  // Show all sections
  ['costSections', 'afSection', 'beSection', 'tatSection', 'perUnitSection', 'sensSection', 'qualSection', 'palletSection', 'allocSection'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = (id === 'costSections' || id === 'tatSection') ? 'grid' : 'block';
  });
}

// ─── AUTH ───
async function doSignIn() {
  const email = $('authEmail').value.trim();
  const pw = $('authPassword').value;
  $('authErr').textContent = ''; $('authErr').className = 'auth-err';
  if (!email || !pw) { $('authErr').textContent = 'Enter email and password.'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) $('authErr').textContent = error.message;
}

async function doSignUp() {
  const email = $('authEmail').value.trim();
  const pw = $('authPassword').value;
  $('authErr').textContent = ''; $('authErr').className = 'auth-err';
  if (!email || !pw) { $('authErr').textContent = 'Enter email and password.'; return; }
  if (pw.length < 6) { $('authErr').textContent = 'Password must be at least 6 characters.'; return; }
  const { error } = await sb.auth.signUp({ email, password: pw });
  if (error) { $('authErr').textContent = error.message; return; }
  $('authErr').textContent = '✓ Account created! Check your email to confirm, then sign in.';
  $('authErr').className = 'auth-err ok';
}

async function doSignOut() {
  await sb.auth.signOut();
}

sb.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    $('authOverlay').style.display = 'none';
    $('userBadge').style.display = 'flex';
    $('userEmail').textContent = currentUser.email;
    loadShipmentList();
  } else {
    $('authOverlay').style.display = 'flex';
    $('userBadge').style.display = 'none';
    $('savedList').innerHTML = '';
  }
});

// ─── SAVE / LOAD SHIPMENTS (Supabase) ───
function buildShipmentPayload(name) {
  return {
    name,
    invoice: $('inv').value,
    tot_boxes: rows.reduce((s, r) => s + (+r.boxes || 0), 0),
    data: {
      skus: rows.map(r => ({ sku: r.sku, hs: r.hs, pcs: r.pcs, boxes: r.boxes, kg: r.kg, lcm: r.lcm, wcm: r.wcm, hcm: r.hcm })),
      config: {
        pickup: $('pickup').value, dest: $('dest').value, inv: $('inv').value,
        pL: gv('pL'), pW: gv('pW'), pH: gv('pH'), maxKg: gv('maxKg'), tare: gv('tare'), fallback: gv('fallback'),
        divisor: $('divisor').value, displayCurrency: $('displayCurrency').value,
        dimUnit: getDimUnit(), hubCurrency: getHubCur(), cfsCurrency: getCfsCur(),
        palletMode: $('palletMode').value, boxRotation: $('boxRotation').value,
        airFreight: gv('airFreight'), sellPrice: gv('sellPrice'),
        hPack: gv('hPack'), hFork: gv('hFork'), hIspm: gv('hIspm'), hLtl: gv('hLtl'), hDocs: gv('hDocs'), hMisc: gv('hMisc'),
        cRecov: gv('cRecov'), cSort: gv('cSort'), cPall: gv('cPall'), cLtl: gv('cLtl'), cDocs: gv('cDocs'), cMisc: gv('cMisc'),
        usdRate: gv('usdRate'), hubTat: gv('hubTat'), cfsTat: gv('cfsTat'), sensMin: gv('sensMin'), sensMax: gv('sensMax'),
      }
    }
  };
}

async function saveShipment() {
  if (!currentUser) return;
  const name = $('saveName').value.trim();
  if (!name) { alert('Enter a name for this shipment.'); return; }
  const payload = buildShipmentPayload(name);
  // Update if name exists, otherwise insert
  const { data: existing } = await sb.from('shipments').select('id').eq('name', name).maybeSingle();
  if (existing) {
    await sb.from('shipments').update(payload).eq('id', existing.id);
  } else {
    await sb.from('shipments').insert(payload);
  }
  loadShipmentList();
}

async function loadShipmentList() {
  if (!currentUser) return;
  const { data, error } = await sb.from('shipments')
    .select('id, name, invoice, tot_boxes, created_at')
    .order('created_at', { ascending: false });
  if (error) return;
  $('savedList').innerHTML = data.length
    ? data.map(s =>
        `<div class="saved-item">
          <span class="name" onclick="loadShipment('${s.id}')">${esc(s.name)} <small style="color:#94a3b8">${s.tot_boxes || '?'} boxes</small></span>
          <button class="del" onclick="deleteShipment('${s.id}')">✕</button>
        </div>`).join('')
    : '<div style="font-size:10px;color:#94a3b8;padding:4px">No saved shipments</div>';
}

async function loadShipment(id) {
  const { data: s, error } = await sb.from('shipments').select('*').eq('id', id).single();
  if (error || !s) { alert('Shipment not found.'); return; }
  const d = s.data || {};
  rows = (d.skus || []).map(r => ({ id: nxt(), ...r }));
  renderTable();
  if (d.config) {
    const c = d.config;
    const fields = {
      pickup: c.pickup, dest: c.dest, inv: c.inv,
      pL: c.pL, pW: c.pW, pH: c.pH, maxKg: c.maxKg, tare: c.tare, fallback: c.fallback,
      airFreight: c.airFreight, sellPrice: c.sellPrice,
      hPack: c.hPack, hFork: c.hFork, hIspm: c.hIspm, hLtl: c.hLtl, hDocs: c.hDocs, hMisc: c.hMisc,
      cRecov: c.cRecov, cSort: c.cSort, cPall: c.cPall, cLtl: c.cLtl, cDocs: c.cDocs, cMisc: c.cMisc,
      usdRate: c.usdRate, hubTat: c.hubTat, cfsTat: c.cfsTat, sensMin: c.sensMin, sensMax: c.sensMax,
    };
    Object.entries(fields).forEach(([k, v]) => { if ($(k) && v !== undefined) $(k).value = v; });
    if (c.divisor) $('divisor').value = c.divisor;
    if (c.displayCurrency) $('displayCurrency').value = c.displayCurrency;
    if (c.dimUnit) $('dimUnit').value = c.dimUnit;
    if (c.hubCurrency) $('hubCurrency').value = c.hubCurrency;
    if (c.cfsCurrency) $('cfsCurrency').value = c.cfsCurrency;
    if (c.palletMode) $('palletMode').value = c.palletMode;
    if (c.boxRotation) $('boxRotation').value = c.boxRotation;
  }
  $('saveName').value = s.name || '';
  $('statusBadge').textContent = 'Loaded';
  $('titleText').textContent = s.name || 'Hub vs CFS Calculator';
  updateInfoStrip();
  autoCalc();
}

async function deleteShipment(id) {
  if (!confirm('Delete this saved shipment?')) return;
  await sb.from('shipments').delete().eq('id', id);
  loadShipmentList();
}

// ─── AUTO-CALCULATE ON ANY INPUT CHANGE ───
let _calcTimer = null;
function autoCalc() {
  clearTimeout(_calcTimer);
  _calcTimer = setTimeout(() => {
    const valid = rows.filter(r => r.boxes > 0 && r.kg > 0);
    if (valid.length) runCalculation();
  }, 400);
}

function attachSidebarListeners() {
  const ids = [
    'pL', 'pW', 'pH', 'maxKg', 'tare', 'fallback',
    'airFreight', 'sellPrice',
    'hPack', 'hFork', 'hIspm', 'hLtl', 'hDocs', 'hMisc',
    'cRecov', 'cSort', 'cPall', 'cLtl', 'cDocs', 'cMisc', 'usdRate',
    'hubTat', 'cfsTat', 'sensMin', 'sensMax',
  ];
  ids.forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', autoCalc);
  });
  // selects fire 'change'
  ['divisor', 'displayCurrency', 'palletMode', 'boxRotation'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', autoCalc);
  });

  // Utilization toggle — show/hide columns instantly, no recalc needed
  const utilCb = $('showUtilization');
  if (utilCb) utilCb.addEventListener('change', applyUtilColumns);

  // Dimension unit toggle — convert values + recalc
  let prevDimUnit = getDimUnit();
  $('dimUnit').addEventListener('change', () => {
    const newUnit = getDimUnit();
    if (newUnit !== prevDimUnit) {
      onDimUnitChange(prevDimUnit, newUnit);
      prevDimUnit = newUnit;
      autoCalc();
    }
  });

  // Hub currency toggle — convert values + recalc
  let prevHubCur = getHubCur();
  $('hubCurrency').addEventListener('change', () => {
    const newCur = getHubCur();
    if (newCur !== prevHubCur) {
      onHubCurrencyChange(prevHubCur, newCur);
      prevHubCur = newCur;
      autoCalc();
    }
  });

  // CFS currency toggle — convert values + recalc
  let prevCfsCur = getCfsCur();
  $('cfsCurrency').addEventListener('change', () => {
    const newCur = getCfsCur();
    if (newCur !== prevCfsCur) {
      onCfsCurrencyChange(prevCfsCur, newCur);
      prevCfsCur = newCur;
      autoCalc();
    }
  });
}

// ─── INIT ───
init();
attachSidebarListeners();
autoCalc();
updateDistance();

$('pickup').addEventListener('input', () => { updateInfoStrip(); scheduleDistanceUpdate(); });
$('dest').addEventListener('input', () => { updateInfoStrip(); scheduleDistanceUpdate(); });
