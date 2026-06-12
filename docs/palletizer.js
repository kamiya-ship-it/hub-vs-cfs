// rotation: 'auto' (best L×W, H vertical), 'standard', 'rotated' (swap L↔W, H vertical)
//           'best' — tries all 3 principal orientations (incl. tipping) and picks max boxes
function calcFit(bL, bW, bH, pL, pW, pH, rotation) {
  if (!bL || !bW || !bH) return null;

  // Core: given floor dims fL×fW and vertical fH, return best fit (auto picks best L↔W)
  function tryOrientation(fL, fW, fH, forceAuto) {
    const layers = Math.floor(pH / fH);
    if (layers < 1) return null;
    const r1s = Math.floor(pL / fL), r2s = Math.floor(pW / fW);
    const r1r = Math.floor(pL / fW), r2r = Math.floor(pW / fL);
    const o1 = r1s * r2s, o2 = r1r * r2r;
    const useRot = forceAuto ? o2 > o1
      : rotation === 'rotated' || (rotation !== 'standard' && o2 > o1);
    const r1 = useRot ? r1r : r1s;
    const r2 = useRot ? r2r : r2s;
    if (r1 * r2 < 1) return null;
    const bpL = useRot ? fW : fL, bpW = useRot ? fL : fW;
    return {
      perLayer: r1 * r2, grid: `${r1}×${r2}`, layers,
      maxByDim: r1 * r2 * layers, hcm: fH,
      floorLcm: r1 * bpL, floorWcm: r2 * bpW,
    };
  }

  if (rotation === 'best') {
    // Try all 3 principal orientations (which dimension is vertical), pick most boxes
    const candidates = [
      tryOrientation(bL, bW, bH, true),  // upright (H vertical)
      tryOrientation(bL, bH, bW, true),  // tipped: W vertical
      tryOrientation(bW, bH, bL, true),  // tipped: L vertical
    ].filter(Boolean);
    return candidates.sort((a, b) => b.maxByDim - a.maxByDim)[0] || null;
  }

  return tryOrientation(bL, bW, bH, false);
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
        hcm: r.fit ? r.fit.hcm : r.hcm,  // use actual vertical dim (may differ when tipped)
        dimMax: r.dimMax || r.eff,
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
