// rotation: 'auto' (best L×W), 'standard' (as entered), 'rotated' (swap L↔W)
// H is always vertical — boxes stay upright.
function calcFit(bL, bW, bH, pL, pW, pH, rotation) {
  if (!bL || !bW || !bH) return null;
  const layers = Math.floor(pH / bH);
  if (layers < 1) return null;
  const r1s = Math.floor(pL / bL), r2s = Math.floor(pW / bW); // standard
  const r1r = Math.floor(pL / bW), r2r = Math.floor(pW / bL); // rotated L↔W
  const o1 = r1s * r2s, o2 = r1r * r2r;
  const useRotated = rotation === 'rotated' || (rotation !== 'standard' && o2 > o1);
  const r1 = useRotated ? r1r : r1s;
  const r2 = useRotated ? r2r : r2s;
  const perLayer = r1 * r2;
  const boxAlongL = useRotated ? bW : bL;
  const boxAlongW = useRotated ? bL : bW;
  return {
    perLayer, grid: `${r1}×${r2}`, layers,
    maxByDim: perLayer * layers, hcm: bH,
    floorLcm: r1 * boxAlongL,   // actual cm consumed along pallet L
    floorWcm: r2 * boxAlongW,   // actual cm consumed along pallet W
  };
}

function allocateSkus(skus, pLcm, pWcm, pHcm, maxKg, fallback, divisor, rotation) {
  return skus.map(r => {
    const fit = calcFit(r.lcm, r.wcm, r.hcm, pLcm, pWcm, pHcm, rotation || 'auto');
    const maxDim = fit ? fit.maxByDim : fallback;
    const maxWt = r.kg > 0 ? Math.floor(maxKg / r.kg) : 9999;
    const eff = Math.max(1, Math.min(maxDim, maxWt));
    const pallets = Math.max(1, Math.ceil(r.boxes / eff));
    const reason = !fit ? 'fallback' : maxDim <= maxWt ? 'dimension' : 'weight';
    const gl = fit ? `${fit.grid} × ${fit.layers}L` : '—';
    const boxVolPerUnit = (r.lcm * r.wcm * r.hcm) / divisor;
    const skuBoxVolWt = r.boxes * boxVolPerUnit;
    const dimMax = fit ? fit.maxByDim : fallback;
    const floorLcm = fit ? fit.floorLcm : 0;
    const floorWcm = fit ? fit.floorWcm : 0;
    return { ...r, fit, eff, pallets, reason, gl, boxVolPerUnit, skuBoxVolWt, dimMax, floorLcm, floorWcm };
  });
}

function makeItems(alloc) {
  const items = [];
  alloc.forEach(r => {
    const perLayer = r.fit ? r.fit.perLayer : Math.max(1, r.eff);
    let rem = r.boxes;
    while (rem > 0) {
      const n = Math.min(rem, r.eff);
      items.push({
        sku: r.sku, n, cargo: n * r.kg, eff: r.eff, perLayer,
        hcm: r.hcm, dimMax: r.dimMax || r.eff,
        floorLcm: r.floorLcm || 0, floorWcm: r.floorWcm || 0,
      });
      rem -= n;
    }
  });
  return items;
}

function newPallet(item) {
  return {
    boxes: item.n, cargo: item.cargo,
    space: item.n / (item.dimMax || item.eff),
    skuMap: { [item.sku]: item.n },
    dims: [{ perLayer: item.perLayer, hcm: item.hcm, n: item.n }],
    floorLcm: item.floorLcm || 0,
    floorWcm: item.floorWcm || 0,
  };
}

function addToPallet(p, item) {
  p.boxes += item.n;
  p.cargo += item.cargo;
  p.space += item.n / (item.dimMax || item.eff);
  p.skuMap[item.sku] = (p.skuMap[item.sku] || 0) + item.n;
  p.dims.push({ perLayer: item.perLayer, hcm: item.hcm, n: item.n });
  // Track largest footprint (mixed-SKU pallets: use the largest floor print seen)
  if ((item.floorLcm || 0) > p.floorLcm) p.floorLcm = item.floorLcm;
  if ((item.floorWcm || 0) > p.floorWcm) p.floorWcm = item.floorWcm;
}

function canFit(p, item, maxKg) {
  return p.cargo + item.cargo <= maxKg &&
         p.space + item.n / (item.dimMax || item.eff) <= 1.001;
}

function computeHeights(pallets, pHcm) {
  for (const p of pallets) {
    if (!p.dims.length) continue;
    const minPerLayer = Math.min(...p.dims.map(d => d.perLayer));
    const maxHcm = Math.max(...p.dims.map(d => d.hcm));
    const neededLayers = Math.ceil(p.boxes / Math.max(1, minPerLayer));
    const maxFitLayers = (pHcm > 0 && maxHcm > 0) ? Math.floor(pHcm / maxHcm) : neededLayers;
    p.layers = Math.min(neededLayers, maxFitLayers);
    p.actualHeightCm = maxHcm > 0
      ? Math.min(p.layers * maxHcm, pHcm || p.layers * maxHcm)
      : 0;
  }
}

function buildPallets(alloc, maxKg, tare, volPerPallet, pHcm) {
  const items = makeItems(alloc);
  const merged = [];
  let cur = null;
  for (const it of items) {
    if (!cur) { cur = newPallet(it); continue; }
    if (canFit(cur, it, maxKg)) { addToPallet(cur, it); }
    else { merged.push(cur); cur = newPallet(it); }
  }
  if (cur && cur.boxes > 0) merged.push(cur);
  computeHeights(merged, pHcm || 0);
  return formatPallets(merged, tare, volPerPallet, maxKg);
}

function buildPalletsMixed(alloc, maxKg, tare, volPerPallet, pHcm) {
  const items = makeItems(alloc);
  items.sort((a, b) => b.cargo - a.cargo);
  const pallets = [];
  for (const item of items) {
    let placed = false;
    for (const p of pallets) {
      if (canFit(p, item, maxKg)) { addToPallet(p, item); placed = true; break; }
    }
    if (!placed) pallets.push(newPallet(item));
  }
  computeHeights(pallets, pHcm || 0);
  return formatPallets(pallets, tare, volPerPallet, maxKg);
}

function formatPallets(pallets, tare, volPerPallet, maxKg) {
  return pallets.map((p, i) => {
    const total = +(p.cargo + tare).toFixed(2);
    const lbs = +(total * 2.2046).toFixed(1);
    const vol = +volPerPallet.toFixed(2);
    const skuMix = Object.entries(p.skuMap).map(([sku, count]) => `${count}× ${sku}`).join(', ');
    const skuCount = Object.keys(p.skuMap).length;
    const weightUtil = maxKg > 0 ? Math.round(p.cargo / maxKg * 100) : 0;
    const dimUtil = Math.round(Math.min(p.space, 1) * 100);
    return {
      n: i + 1,
      boxes: p.boxes,
      cargo: +p.cargo.toFixed(2),
      total, lbs, vol,
      charge: +Math.max(total, vol).toFixed(2),
      skuMix, skuCount, skuMap: p.skuMap,
      layers: p.layers || 0,
      actualHeightCm: p.actualHeightCm || 0,
      weightUtil, dimUtil,
      floorLcm: +(p.floorLcm || 0).toFixed(1),
      floorWcm: +(p.floorWcm || 0).toFixed(1),
    };
  });
}
