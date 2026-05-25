const { calcFit, allocateSkus, buildPallets, buildPalletsMixed } = require('./palletizer');

function computeWeights(alloc, totPallets, totCargo, config) {
  const { tare, palletLcm, palletWcm, palletHcm, divisor } = config;

  const extraWt = totPallets * tare;
  const afterWt = totCargo + extraWt;

  const volPerPallet = (palletLcm * palletWcm * palletHcm) / divisor;
  const palletVolWt = volPerPallet * totPallets;
  const hubChargeable = Math.max(afterWt, palletVolWt);
  const hubChargeNote = afterWt >= palletVolWt ? 'actual+tare wins' : 'pallet vol wins';

  const boxVolWt = alloc.reduce((s, r) => s + r.skuBoxVolWt, 0);
  const cfsChargeable = Math.max(totCargo, boxVolWt);
  const cfsChargeNote = totCargo >= boxVolWt ? 'actual wt wins' : 'box vol wins';

  return {
    extraWt,
    afterWt,
    afterLbs: afterWt * 2.2046,
    volPerPallet,
    palletVolWt,
    hubChargeable,
    hubChargeNote,
    boxVolWt,
    cfsChargeable,
    cfsChargeNote,
  };
}

function computeHubCosts(weights, totPallets, config) {
  const { airFreight, sellPrice, hPack, hFork, hIspm, hLtl, hDocs, hMisc, tare } = config;
  const { hubChargeable, extraWt } = weights;
  const totCargo = hubChargeable - extraWt > 0 ? hubChargeable - extraWt : weights.afterWt - extraWt;

  const hubExtraAFwt = Math.max(0, weights.hubChargeable - (weights.afterWt - weights.extraWt));
  const hubExtraAF = airFreight * hubExtraAFwt;
  const hAdditional = sellPrice * extraWt;
  const hPacking = hPack * totPallets;
  const hForklift = hFork * totPallets;
  const hIspmCost = hIspm * totPallets;
  const hubFixed = hAdditional + hPacking + hForklift + hIspmCost + hLtl + hDocs + hMisc;
  const hubTotal = hubExtraAF + hubFixed;

  return {
    hubExtraAFwt,
    hubExtraAF,
    hAdditional,
    hPacking,
    hForklift,
    hIspmCost,
    hLtl,
    hDocs,
    hMisc,
    hubFixed,
    hubTotal,
  };
}

function computeCfsCosts(weights, totPallets, totBoxes, totCargo, config) {
  const { airFreight, cRecov, cSort, cPall, cLtl, cDocs, cMisc, usdRate } = config;

  const cfsExtraAFwt = Math.max(0, weights.cfsChargeable - totCargo);
  const cfsExtraAF = airFreight * cfsExtraAFwt;

  const cR = cRecov * totCargo;
  const cS = cSort * totBoxes;
  const cP = cPall * totPallets;
  const cL = cLtl;
  const cD = cDocs;
  const cM = cMisc;
  const cfsTotalUSD = cR + cS + cP + cL + cD + cM;
  const cfsFixed_inr = cfsTotalUSD * usdRate;
  const cfsTotal = cfsExtraAF + cfsFixed_inr;

  return {
    cfsExtraAFwt,
    cfsExtraAF,
    cR, cS, cP, cL, cD, cM,
    cfsTotalUSD,
    cfsFixed_inr,
    cfsTotal,
  };
}

function computeBreakEven(hubCosts, cfsCosts) {
  const afWtDelta = hubCosts.hubExtraAFwt - cfsCosts.cfsExtraAFwt;
  const fixedDelta = cfsCosts.cfsFixed_inr - hubCosts.hubFixed;

  let beRate = null;
  let beValid = false;
  let beMessage = '';

  if (Math.abs(afWtDelta) < 0.01) {
    beMessage = 'No air freight weight difference between routes. Decision based on fixed costs only.';
    if (hubCosts.hubFixed < cfsCosts.cfsFixed_inr) {
      beMessage += ` Hub is always cheaper by ₹${Math.round(cfsCosts.cfsFixed_inr - hubCosts.hubFixed)}.`;
    } else if (hubCosts.hubFixed > cfsCosts.cfsFixed_inr) {
      beMessage += ` CFS is always cheaper by ₹${Math.round(hubCosts.hubFixed - cfsCosts.cfsFixed_inr)}.`;
    }
  } else {
    beRate = fixedDelta / afWtDelta;
    beValid = beRate >= 0;
    if (!beValid) {
      const winner = hubCosts.hubTotal < cfsCosts.cfsTotal ? 'Hub' : 'CFS';
      beMessage = `Break-even at negative AF rate — ${winner} always wins.`;
    }
  }

  return { afWtDelta, fixedDelta, beRate, beValid, beMessage };
}

function computeSensitivity(hubCosts, cfsCosts, weights, totCargo, airFreight, sensMin, sensMax) {
  const step = Math.max(50, Math.round((sensMax - sensMin) / 7 / 50) * 50);
  const rates = [];
  for (let r = sensMin; r <= sensMax; r += step) rates.push(r);
  if (!rates.includes(airFreight) && airFreight >= sensMin && airFreight <= sensMax) rates.push(airFreight);
  rates.sort((a, b) => a - b);

  return rates.map(af => {
    const hubExtraAF = af * hubCosts.hubExtraAFwt;
    const cfsExtraAF = af * cfsCosts.cfsExtraAFwt;
    const hubTotal = hubExtraAF + hubCosts.hubFixed;
    const cfsTotal = cfsExtraAF + cfsCosts.cfsFixed_inr;
    const delta = hubTotal - cfsTotal;
    const winner = delta < -100 ? 'HUB' : delta > 100 ? 'CFS' : 'TIE';
    return {
      afRate: af,
      isCurrent: Math.abs(af - airFreight) < 0.01,
      hubExtraAF,
      hubFixed: hubCosts.hubFixed,
      hubTotal,
      cfsExtraAF,
      cfsFixed: cfsCosts.cfsFixed_inr,
      cfsTotal,
      delta,
      saving: Math.abs(delta),
      winner,
    };
  });
}

function generateRecommendation(hubCosts, cfsCosts, hubTat, cfsTat) {
  const hubCheap = hubCosts.hubTotal <= cfsCosts.cfsTotal;
  const hubFast = hubTat <= cfsTat;
  const saving = Math.abs(hubCosts.hubTotal - cfsCosts.cfsTotal);
  const tatDiff = Math.abs(hubTat - cfsTat);

  let text, winner;
  if (hubCheap && hubFast) {
    text = `Hub + LTL recommended — saves ₹${Math.round(saving)} and is ${tatDiff} hrs faster`;
    winner = 'hub';
  } else if (!hubCheap && !hubFast) {
    text = `CFS + LTL recommended — saves ₹${Math.round(saving)} and is ${tatDiff} hrs faster`;
    winner = 'cfs';
  } else if (hubCheap && !hubFast) {
    text = `Hub cheaper by ₹${Math.round(saving)}, but CFS is ${tatDiff} hrs faster — pick based on priority`;
    winner = 'hub';
  } else {
    text = `CFS cheaper by ₹${Math.round(saving)}, but Hub is ${tatDiff} hrs faster — pick based on priority`;
    winner = 'cfs';
  }

  return { text, winner, saving, tatDiff, hubCheap, hubFast };
}

function fullAnalysis(input) {
  const {
    skus, palletL, palletW, palletH, maxKg, tare, fallback, divisor,
    airFreight, sellPrice,
    hPack, hFork, hIspm, hLtl, hDocs, hMisc,
    cRecov, cSort, cPall, cLtl, cDocs, cMisc, usdRate,
    hubTat, cfsTat,
    sensMin, sensMax,
    palletMode,
  } = input;

  const mixed = palletMode === 'mixed';
  const pLcm = palletL * 2.54;
  const pWcm = palletW * 2.54;
  const pHcm = palletH * 2.54;

  const valid = skus.filter(r => r.boxes > 0 && r.kg > 0);
  if (!valid.length) throw new Error('Add at least one SKU with boxes > 0 and gross kg > 0.');

  const alloc = allocateSkus(valid, pLcm, pWcm, pHcm, maxKg, fallback || 40, divisor || 6000);
  const totBoxes = alloc.reduce((s, r) => s + r.boxes, 0);
  const totCargo = alloc.reduce((s, r) => s + r.boxes * r.kg, 0);

  const config = {
    tare, airFreight, sellPrice: sellPrice || 0,
    hPack: hPack || 0, hFork: hFork || 0, hIspm: hIspm || 0,
    hLtl: hLtl || 0, hDocs: hDocs || 0, hMisc: hMisc || 0,
    cRecov: cRecov || 0, cSort: cSort || 0, cPall: cPall || 0,
    cLtl: cLtl || 0, cDocs: cDocs || 0, cMisc: cMisc || 0,
    usdRate: usdRate || 93.88,
    palletLcm: pLcm, palletWcm: pWcm, palletHcm: pHcm,
    divisor: divisor || 6000,
  };

  const volPerPallet = (pLcm * pWcm * pHcm) / (divisor || 6000);
  const pallets = mixed
    ? buildPalletsMixed(alloc, maxKg, tare, volPerPallet)
    : buildPallets(alloc, maxKg, tare, volPerPallet);

  const totPallets = pallets.length;

  const weights = computeWeights(alloc, totPallets, totCargo, config);
  const hubCosts = computeHubCosts(weights, totPallets, config);
  const cfsCosts = computeCfsCosts(weights, totPallets, totBoxes, totCargo, config);
  const breakEven = computeBreakEven(hubCosts, cfsCosts);
  const sensitivity = computeSensitivity(hubCosts, cfsCosts, weights, totCargo, airFreight, sensMin || 100, sensMax || 700);
  const recommendation = generateRecommendation(hubCosts, cfsCosts, hubTat || 8, cfsTat || 36);

  const separatePallets = alloc.reduce((s, r) => s + r.pallets, 0);

  const perUnit = {
    hubPerBox: totBoxes > 0 ? hubCosts.hubTotal / totBoxes : 0,
    cfsPerBox: totBoxes > 0 ? cfsCosts.cfsTotal / totBoxes : 0,
    hubPerKg: totCargo > 0 ? hubCosts.hubTotal / totCargo : 0,
    cfsPerKg: totCargo > 0 ? cfsCosts.cfsTotal / totCargo : 0,
    hubPerPallet: totPallets > 0 ? hubCosts.hubTotal / totPallets : 0,
    cfsPerPallet: totPallets > 0 ? cfsCosts.cfsTotal / totPallets : 0,
  };

  return {
    summary: { totPallets, totBoxes, totCargo },
    weights,
    hubCosts,
    cfsCosts,
    breakEven,
    sensitivity,
    recommendation,
    pallets,
    allocation: alloc,
    perUnit,
    palletMode: mixed ? 'mixed' : 'separate',
    separatePallets,
    config: { palletL, palletW, palletH, tare, hubTat: hubTat || 8, cfsTat: cfsTat || 36 },
  };
}

module.exports = { fullAnalysis };
