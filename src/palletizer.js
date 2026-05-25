function calcFit(bL, bW, bH, pL, pW, pH) {
  if (!bL || !bW || !bH) return null;
  const o1 = Math.floor(pL / bL) * Math.floor(pW / bW);
  const o2 = Math.floor(pL / bW) * Math.floor(pW / bL);
  const perLayer = Math.max(o1, o2);
  const grid = o1 >= o2
    ? `${Math.floor(pL / bL)}×${Math.floor(pW / bW)}`
    : `${Math.floor(pL / bW)}×${Math.floor(pW / bL)}`;
  const layers = Math.floor(pH / bH);
  return { perLayer, grid, layers, maxByDim: perLayer * layers };
}

function allocateSkus(skus, pLcm, pWcm, pHcm, maxKg, fallback, divisor) {
  return skus.map(r => {
    const fit = calcFit(r.lcm, r.wcm, r.hcm, pLcm, pWcm, pHcm);
    const maxDim = fit ? fit.maxByDim : fallback;
    const maxWt = r.kg > 0 ? Math.floor(maxKg / r.kg) : 9999;
    const eff = Math.max(1, Math.min(maxDim, maxWt));
    const pallets = Math.max(1, Math.ceil(r.boxes / eff));
    const reason = !fit ? 'fallback' : maxDim <= maxWt ? 'dimension' : 'weight';
    const gl = fit ? `${fit.grid} × ${fit.layers}L` : '—';
    const boxVolPerUnit = (r.lcm * r.wcm * r.hcm) / divisor;
    const skuBoxVolWt = r.boxes * boxVolPerUnit;
    return { ...r, fit, eff, pallets, reason, gl, boxVolPerUnit, skuBoxVolWt };
  });
}

function makeItems(alloc) {
  const items = [];
  alloc.forEach(r => {
    const perLayer = r.fit ? r.fit.perLayer : Math.max(1, r.eff);
    let rem = r.boxes;
    while (rem > 0) {
      const n = Math.min(rem, r.eff);
      items.push({ sku: r.sku, n, cargo: n * r.kg, eff: r.eff, perLayer, hcm: r.hcm });
      rem -= n;
    }
  });
  return items;
}

function newPallet(item) {
  return {
    boxes: item.n, cargo: item.cargo, space: item.n / item.eff,
    skuMap: { [item.sku]: item.n },
    dims: [{ perLayer: item.perLayer, hcm: item.hcm, n: item.n }],
  };
}

function addToPallet(p, item) {
  p.boxes += item.n;
  p.cargo += item.cargo;
  p.space += item.n / item.eff;
  p.skuMap[item.sku] = (p.skuMap[item.sku] || 0) + item.n;
  p.dims.push({ perLayer: item.perLayer, hcm: item.hcm, n: item.n });
}

function canFit(p, item, maxKg) {
  return p.cargo + item.cargo <= maxKg && p.space + item.n / item.eff <= 1.001;
}

function computeHeights(pallets) {
  for (const p of pallets) {
    const minPerLayer = Math.min(...p.dims.map(d => d.perLayer));
    const maxHcm = Math.max(...p.dims.map(d => d.hcm));
    p.layers = Math.ceil(p.boxes / minPerLayer);
    p.actualHeightCm = p.layers * maxHcm;
  }
}

function buildPallets(alloc, maxKg, tare, volPerPallet) {
  const items = makeItems(alloc);
  const merged = [];
  let cur = null;
  for (const it of items) {
    if (!cur) { cur = newPallet(it); continue; }
    if (canFit(cur, it, maxKg)) { addToPallet(cur, it); }
    else { merged.push(cur); cur = newPallet(it); }
  }
  if (cur?.boxes > 0) merged.push(cur);
  computeHeights(merged);
  return formatPallets(merged, tare, volPerPallet);
}

function buildPalletsMixed(alloc, maxKg, tare, volPerPallet) {
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
  computeHeights(pallets);
  return formatPallets(pallets, tare, volPerPallet);
}

function formatPallets(pallets, tare, volPerPallet) {
  return pallets.map((p, i) => {
    const total = +(p.cargo + tare).toFixed(2);
    const lbs = +(total * 2.2046).toFixed(1);
    const vol = +volPerPallet.toFixed(2);
    const skuMix = Object.entries(p.skuMap).map(([sku, count]) => `${count}× ${sku}`).join(', ');
    const skuCount = Object.keys(p.skuMap).length;
    return {
      n: i + 1,
      boxes: p.boxes,
      cargo: +p.cargo.toFixed(2),
      total,
      lbs,
      vol,
      charge: +Math.max(total, vol).toFixed(2),
      skuMix,
      skuCount,
      skuMap: p.skuMap,
      layers: p.layers || 0,
      actualHeightCm: p.actualHeightCm || 0,
    };
  });
}

module.exports = { calcFit, allocateSkus, buildPallets, buildPalletsMixed };
