// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — ORQUESTRADOR DA MAQUETE ARQUITETÔNICA 3D
// Integra em alta precisão os 3 módulos especializados da maquete:
//  1. amenitiesBuilder.js  -> Base, Gramado, Alamedas, Portaria (1),
//                             Piscina Central WebGL Water (2), Quadra (3),
//                             Academia ao Ar Livre & Pergolado (4), Salão de
//                             Festas (5) e 6 Casas Térreas para Aluguel (6)
//  2. towersBuilder.js     -> 5 Torres Residenciais em H (A, B, C, D, E) (7)
//                             e Planta Humanizada 3D em H (createHShapedFloorPlan3D)
//  3. landscapingBuilder.js -> Catálogo Botânico Fiel (Pau-Ferro, Palmeira
//                             Imperial, Ipê Rosa + 6 Arbustos/Maciços) e
//                             Iluminação Paisagística Quente (Balizadores)
// ==========================================================================

import * as THREE from 'three';
import { TOWERS_CONFIG } from './data.js';
import { buildTowers3D, createHShapedFloorPlan3D } from './towersBuilder.js';
import { buildBaseAndAmenities3D } from './amenitiesBuilder.js';
import { buildLandscaping3D } from './landscapingBuilder.js';
import { mergeStatic, mergeAcrossFloors } from './mergeStatic.js';

export { createHShapedFloorPlan3D };

// --------------------------------------------------------------------------
// UTILITÁRIOS DETERMINÍSTICOS PARA TEXTURAS PBR PROCEDURAIS SEM EMENDAS
// (Geram apenas `map` e `roughnessMap` — compatível 100% com mergeStatic.js)
// --------------------------------------------------------------------------

function hash2D(ix, iy, seed) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function periodicNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix0 = Math.floor(x);
  const iy0 = Math.floor(y);
  const fx = smoothstep(x - ix0);
  const fy = smoothstep(y - iy0);

  const x0 = ((ix0 % period) + period) % period;
  const y0 = ((iy0 % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x1, y0, seed);
  const n01 = hash2D(x0, y1, seed);
  const n11 = hash2D(x1, y1, seed);

  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fy;
}

function fbmPeriodic(u, v, basePeriod, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodicNoise(u, v, freq, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function makeCanvasTexture(canvas, { srgb = true, repeatX = 1, repeatY = 1, maxAniso = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function clampByte(v) {
  return v < 0 ? 0 : (v > 255 ? 255 : v | 0);
}

// --------------------------------------------------------------------------
// GERADORES DE MAPAS PBR PROCEDURAIS (ALBEDO + ROUGHNESS)
// --------------------------------------------------------------------------

/**
 * Gera pares { map, roughnessMap } de estuque/concreto arquitetônico fino e
 * sem direção predominante, para escalar limpo em pilares, paredes e lajes.
 */
function createArchitecturalStuccoPBR({
  size = 512,
  seed = 11,
  baseLuma = 248,
  lumaAmp = 12,
  speckleAmp = 7,
  roughMin = 178,
  roughMax = 246,
  repeat = 3,
  maxAniso = 4
} = {}) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const macro = fbmPeriodic(u, v, 6, 3, seed);
      const grain = hash2D(x, y, seed + 503);
      const micro = fbmPeriodic(u, v, 32, 2, seed + 211);

      const val = baseLuma + (macro - 0.5) * lumaAmp + (micro - 0.5) * (lumaAmp * 0.6) + (grain - 0.5) * speckleAmp;
      const rVal = clampByte(val + 1);
      const gVal = clampByte(val);
      const bVal = clampByte(val - 2);

      const roughT = 0.55 * (1 - macro) + 0.30 * grain + 0.15 * micro;
      const roughByte = clampByte(roughMin + roughT * (roughMax - roughMin));

      const idx = (y * size + x) * 4;
      dM[idx] = rVal;
      dM[idx + 1] = gVal;
      dM[idx + 2] = bVal;
      dM[idx + 3] = 255;

      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: repeat, repeatY: repeat, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: repeat, repeatY: repeat, maxAniso })
  };
}

/**
 * Gera gramado orgânico não repetitivo com micro-lâminas e variação natural de solo/sol.
 */
function createLawnTurfPBR({
  size = 512,
  seed = 31,
  brightBoost = 0,
  repeat = 5,
  maxAniso = 4
} = {}) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const patch = fbmPeriodic(u, v, 5, 3, seed);
      const blade = fbmPeriodic(u, v, 24, 2, seed + 131);
      const jitter = hash2D(x, y, seed + 997);

      const t = Math.min(1, Math.max(0, 0.58 * patch + 0.27 * blade + 0.15 * jitter));
      const r = clampByte(32 + t * 44 + brightBoost);
      const g = clampByte(66 + t * 58 + brightBoost * 1.25);
      const b = clampByte(18 + t * 22 + brightBoost * 0.4);

      const roughByte = clampByte(205 + (1 - t) * 44 + (jitter - 0.5) * 14);
      const idx = (y * size + x) * 4;
      dM[idx] = r;
      dM[idx + 1] = g;
      dM[idx + 2] = b;
      dM[idx + 3] = 255;

      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  // Micro-traços orgânicos multidirecionais de folhas de grama (sem listras mecânicas)
  for (let i = 0; i < 4800; i++) {
    const px = hash2D(i, 1, seed + 7) * size;
    const py = hash2D(i, 2, seed + 19) * size;
    const ang = hash2D(i, 3, seed + 41) * Math.PI * 2;
    const len = 2.0 + hash2D(i, 4, seed + 61) * 3.5;
    const isLight = i % 3 === 0;
    ctxM.strokeStyle = isLight ? 'rgba(134, 189, 58, 0.18)' : 'rgba(18, 42, 12, 0.16)';
    ctxM.lineWidth = 1.1;
    ctxM.beginPath();
    ctxM.moveTo(px, py);
    ctxM.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    ctxM.stroke();
  }

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: repeat, repeatY: repeat, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: repeat, repeatY: repeat, maxAniso })
  };
}

/**
 * Gera textura mineral de pedra natural / travertino / concreto escovado para calçadas e passeios.
 */
function createNaturalStonePBR({
  size = 512,
  seed = 73,
  baseRgb = [206, 211, 217],
  variation = 18,
  repeat = 4,
  maxAniso = 4
} = {}) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const vein = fbmPeriodic(u, v, 6, 3, seed);
      const mineral = fbmPeriodic(u, v, 20, 2, seed + 251);
      const fleck = hash2D(x, y, seed + 601);

      let delta = (vein - 0.5) * variation + (mineral - 0.5) * (variation * 0.55);
      if (fleck > 0.94) delta += 14; // grãos claros de quartzo
      else if (fleck < 0.05) delta -= 14; // micro-poros minerais

      const idx = (y * size + x) * 4;
      dM[idx] = clampByte(baseRgb[0] + delta + 1);
      dM[idx + 1] = clampByte(baseRgb[1] + delta);
      dM[idx + 2] = clampByte(baseRgb[2] + delta - 1);
      dM[idx + 3] = 255;

      const roughByte = clampByte(172 + (1 - vein) * 55 + (fleck < 0.05 ? 24 : 0));
      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: repeat, repeatY: repeat, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: repeat, repeatY: repeat, maxAniso })
  };
}

/**
 * Gera asfalto realista com agregado mineral e micro-desgaste sutil.
 */
function createAsphaltPBR(size = 512, maxAniso = 4) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wear = fbmPeriodic(u, v, 5, 3, 19);
      const grit = hash2D(x, y, 401);
      let luma = 55 + (wear - 0.5) * 14 + (grit - 0.5) * 16;
      if (grit > 0.96) luma += 18;

      const idx = (y * size + x) * 4;
      dM[idx] = clampByte(luma);
      dM[idx + 1] = clampByte(luma + 3);
      dM[idx + 2] = clampByte(luma + 8);
      dM[idx + 3] = 255;

      const roughByte = clampByte(grit > 0.96 ? 178 : 210 + (1 - wear) * 35);
      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: 8, repeatY: 2, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: 8, repeatY: 2, maxAniso })
  };
}

/**
 * Gera deck de madeira Ipê com veios fibrosos contínuos, variação entre réguas,
 * topos desencontrados e juntas escuras, além de roughnessMap acompanhando os veios.
 */
function createWoodDeckPBR(size = 512, maxAniso = 4) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  const plankCount = 16;
  const plankH = size / plankCount;
  const plankTones = [
    [136, 84, 46],
    [152, 96, 54],
    [122, 74, 40],
    [144, 90, 50],
    [160, 104, 60],
    [128, 79, 43]
  ];

  for (let y = 0; y < size; y++) {
    const plankIdx = Math.floor(y / plankH);
    const localY = y - plankIdx * plankH;
    const isRowGap = localY >= plankH - 2;
    const staggerX = ((plankIdx * 173) % size);
    const v = y / size;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = (y * size + x) * 4;
      const sx = (x + staggerX) % size;
      const segIdx = Math.floor(sx / 256);
      const isButtJoint = (sx % 256) < 2;

      if (isRowGap || isButtJoint) {
        dM[idx] = 44;
        dM[idx + 1] = 24;
        dM[idx + 2] = 11;
        dM[idx + 3] = 255;
        dR[idx] = 248;
        dR[idx + 1] = 248;
        dR[idx + 2] = 248;
        dR[idx + 3] = 255;
        continue;
      }

      const tone = plankTones[(plankIdx + segIdx * 3) % plankTones.length];
      // Veio longitudinal orgânico de madeira nobre
      const warp = fbmPeriodic(u, v * 4.0, 4, 2, 71 + plankIdx);
      const fiber = Math.sin((localY / plankH) * Math.PI * 7.0 + warp * 5.2 + u * 6.28318);
      const micro = hash2D(x, y, 811) - 0.5;
      const edgeShade = localY < 2 ? -10 : (localY > plankH - 4 ? -12 : 0);

      const grainShift = fiber * 11 + (warp - 0.5) * 18 + micro * 7 + edgeShade;
      dM[idx] = clampByte(tone[0] + grainShift);
      dM[idx + 1] = clampByte(tone[1] + grainShift * 0.72);
      dM[idx + 2] = clampByte(tone[2] + grainShift * 0.45);
      dM[idx + 3] = 255;

      const roughByte = clampByte(152 - fiber * 22 + (1 - warp) * 28 + micro * 12);
      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: 4, repeatY: 8, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: 4, repeatY: 8, maxAniso })
  };
}

/**
 * Gera madeira nobre contínua (pergolado, mobiliário, colunas) e ripado arquitetônico.
 */
function createWoodNoblePBR({
  size = 512,
  baseRgb = [166, 98, 50],
  slatted = false,
  repeat = 2,
  maxAniso = 4
} = {}) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbmPeriodic(u * 2.0, v * 0.5, 4, 3, 53);
      const rings = Math.sin(u * Math.PI * 16 + warp * 6.0);
      const fine = hash2D(x, y, 307) - 0.5;
      let shift = rings * 14 + (warp - 0.5) * 20 + fine * 6;
      let slatGroove = 0;

      if (slatted) {
        const modX = x % 32;
        if (modX < 5) slatGroove = -62;
        else if (modX < 8 || modX > 29) slatGroove = -18;
      }

      const idx = (y * size + x) * 4;
      dM[idx] = clampByte(baseRgb[0] + shift + slatGroove);
      dM[idx + 1] = clampByte(baseRgb[1] + shift * 0.75 + slatGroove * 0.78);
      dM[idx + 2] = clampByte(baseRgb[2] + shift * 0.48 + slatGroove * 0.52);
      dM[idx + 3] = 255;

      const roughByte = clampByte(slatGroove < -40 ? 236 : 138 - rings * 20 + (1 - warp) * 28);
      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: repeat, repeatY: repeat, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: repeat, repeatY: repeat, maxAniso })
  };
}

/**
 * Gera alumínio anodizado escuro escovado (micro-estrias direcionais e variação especular).
 */
function createBrushedMetalPBR(size = 256, maxAniso = 4) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    const rowStreak = hash2D(0, y, 709);
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const brush = fbmPeriodic(u * 0.5, v * 8.0, 8, 2, 193);
      const micro = hash2D(x, y, 919);
      const val = clampByte(226 + (rowStreak - 0.5) * 18 + (brush - 0.5) * 16 + (micro - 0.5) * 8);
      const roughByte = clampByte(88 + (1 - rowStreak) * 34 + (brush - 0.5) * 26);

      const idx = (y * size + x) * 4;
      dM[idx] = val;
      dM[idx + 1] = val;
      dM[idx + 2] = clampByte(val + 4);
      dM[idx + 3] = 255;

      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: 2, repeatY: 2, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: 2, repeatY: 2, maxAniso })
  };
}

/**
 * Gera trama de lona náutica para ombrelones e tecidos externos.
 */
function createCanvasWeavePBR(size = 256, maxAniso = 4) {
  const cMap = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cRough.width = size;
  cMap.height = cRough.height = size;

  const ctxM = cMap.getContext('2d');
  const ctxR = cRough.getContext('2d');
  const imgM = ctxM.createImageData(size, size);
  const imgR = ctxR.createImageData(size, size);
  const dM = imgM.data;
  const dR = imgR.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin((x / size) * Math.PI * 64);
      const weft = Math.sin((y / size) * Math.PI * 64);
      const weave = 0.5 * (warp + weft);
      const val = clampByte(244 + weave * 8);
      const roughByte = clampByte(192 - weave * 20);

      const idx = (y * size + x) * 4;
      dM[idx] = val;
      dM[idx + 1] = clampByte(val - 2);
      dM[idx + 2] = clampByte(val - 6);
      dM[idx + 3] = 255;

      dR[idx] = roughByte;
      dR[idx + 1] = roughByte;
      dR[idx + 2] = roughByte;
      dR[idx + 3] = 255;
    }
  }

  ctxM.putImageData(imgM, 0, 0);
  ctxR.putImageData(imgR, 0, 0);

  return {
    map: makeCanvasTexture(cMap, { srgb: true, repeatX: 4, repeatY: 4, maxAniso }),
    roughnessMap: makeCanvasTexture(cRough, { srgb: false, repeatX: 4, repeatY: 4, maxAniso })
  };
}

function createLitWindowTexture(variant = 'balcony') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  // Interior arquitetônico acolhedor e realista (sem estourar em laranja neon)
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0.0, '#f7f1e3');
  bg.addColorStop(0.28, '#e8d2ab');
  bg.addColorStop(0.72, '#b98d59');
  bg.addColorStop(1.0, '#5a3d24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.24, 6, w * 0.5, h * 0.38, w * 0.52);
  glow.addColorStop(0.0, 'rgba(255, 250, 238, 0.88)');
  glow.addColorStop(0.5, 'rgba(248, 224, 175, 0.44)');
  glow.addColorStop(1.0, 'rgba(180, 130, 72, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Cortinas de linho nas laterais
  ctx.fillStyle = 'rgba(248, 245, 238, 0.42)';
  ctx.fillRect(12, 0, 64, h);
  ctx.fillRect(w - 76, 0, 64, h);
  ctx.fillStyle = 'rgba(72, 52, 34, 0.20)';
  for (let x = 18; x < 72; x += 10) ctx.fillRect(x, 0, 3, h);
  for (let x = w - 70; x < w - 16; x += 10) ctx.fillRect(x, 0, 3, h);

  // Silhueta sutil de mobiliário interno
  ctx.fillStyle = 'rgba(42, 32, 24, 0.34)';
  ctx.fillRect(w * 0.22, h * 0.68, w * 0.54, h * 0.32);

  // Esquadrias de alumínio anodizado preto
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = variant === 'balcony' ? 10 : 12;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  const panels = variant === 'balcony' ? 4 : 2;
  ctx.lineWidth = 6;
  for (let i = 1; i < panels; i++) {
    const px = (w / panels) * i;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRadialGlowTexture(colorInner = 'rgba(255, 226, 152, 0.42)', colorMid = 'rgba(245, 172, 62, 0.16)') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0.0, colorInner);
  g.addColorStop(0.45, colorMid);
  g.addColorStop(1.0, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSconceConeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(64, 12, 64, 248);
  g.addColorStop(0.0, 'rgba(255, 244, 206, 0.56)');
  g.addColorStop(0.28, 'rgba(253, 218, 118, 0.34)');
  g.addColorStop(0.72, 'rgba(245, 168, 56, 0.12)');
  g.addColorStop(1.0, 'rgba(245, 158, 11, 0)');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(120, 250);
  ctx.lineTo(8, 250);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --------------------------------------------------------------------------
// CONSTRUTOR PRINCIPAL DA MAQUETE 3D
// --------------------------------------------------------------------------

export function buildArchitecturalMaquete3D(renderer) {
  const root = new THREE.Group();
  root.name = 'MaqueteCondominioRoot';
  const nightLightObjects = [];

  const maxAniso = (renderer && renderer.capabilities)
    ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
    : 4;

  // Texturas PBR compartilhadas (somente `map` e `roughnessMap`)
  const stuccoPurePBR = createArchitecturalStuccoPBR({
    size: 256, seed: 11, baseLuma: 249, lumaAmp: 10, speckleAmp: 5, roughMin: 185, roughMax: 244, repeat: 4, maxAniso
  });
  const stuccoWarmPBR = createArchitecturalStuccoPBR({
    size: 256, seed: 23, baseLuma: 246, lumaAmp: 13, speckleAmp: 7, roughMin: 192, roughMax: 248, repeat: 4, maxAniso
  });
  const concreteCharcoalPBR = createArchitecturalStuccoPBR({
    size: 256, seed: 47, baseLuma: 242, lumaAmp: 16, speckleAmp: 9, roughMin: 175, roughMax: 242, repeat: 4, maxAniso
  });
  const roofMembranePBR = createArchitecturalStuccoPBR({
    size: 256, seed: 89, baseLuma: 240, lumaAmp: 20, speckleAmp: 10, roughMin: 200, roughMax: 252, repeat: 5, maxAniso
  });

  const lawnMainPBR = createLawnTurfPBR({ size: 512, seed: 31, brightBoost: 0, repeat: 6, maxAniso });
  const lawnRichPBR = createLawnTurfPBR({ size: 256, seed: 59, brightBoost: 12, repeat: 3, maxAniso });
  const stoneSidewalkPBR = createNaturalStonePBR({
    size: 512, seed: 73, baseRgb: [208, 212, 218], variation: 18, repeat: 4, maxAniso
  });
  const stoneCurbPBR = createNaturalStonePBR({
    size: 256, seed: 101, baseRgb: [228, 232, 238], variation: 12, repeat: 3, maxAniso
  });
  const stonePathPBR = createNaturalStonePBR({
    size: 256, seed: 127, baseRgb: [164, 170, 178], variation: 20, repeat: 4, maxAniso
  });
  const asphaltPBR = createAsphaltPBR(256, maxAniso);
  const woodDeckPBR = createWoodDeckPBR(512, maxAniso);
  const woodNoblePBR = createWoodNoblePBR({ size: 256, baseRgb: [164, 98, 52], slatted: false, repeat: 2, maxAniso });
  const woodSlatsPBR = createWoodNoblePBR({ size: 256, baseRgb: [198, 128, 66], slatted: true, repeat: 2, maxAniso });
  const metalBlackPBR = createBrushedMetalPBR(256, maxAniso);
  const canvasWeavePBR = createCanvasWeavePBR(256, maxAniso);

  const balconyWinTex = createLitWindowTexture('balcony');
  const roomWinTex = createLitWindowTexture('window');
  const glowFloorTex = createRadialGlowTexture();
  const sconceConeTex = createSconceConeTexture();
  balconyWinTex.anisotropy = maxAniso;
  roomWinTex.anisotropy = maxAniso;

  // Biblioteca de Materiais PBR Arquitetônicos Compartilhados (Pranchas 1 a 5)
  // Regra crítica: NÃO usar bumpMap, aoMap, lightMap, alphaMap ou displacementMap
  // para garantir fusão completa via mergeStatic.js.
  const mats = {
    plinthDark: new THREE.MeshStandardMaterial({
      color: 0x1b2028,
      map: concreteCharcoalPBR.map,
      roughnessMap: concreteCharcoalPBR.roughnessMap,
      roughness: 0.84,
      metalness: 0.08,
      envMapIntensity: 0.75
    }),
    asphalt: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltPBR.map,
      roughnessMap: asphaltPBR.roughnessMap,
      roughness: 0.90,
      metalness: 0.02,
      envMapIntensity: 0.55
    }),
    roadLine: new THREE.MeshBasicMaterial({ color: 0xeef2f6 }),
    sidewalk: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stoneSidewalkPBR.map,
      roughnessMap: stoneSidewalkPBR.roughnessMap,
      roughness: 0.76,
      metalness: 0.02,
      envMapIntensity: 0.78
    }),
    curb: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stoneCurbPBR.map,
      roughnessMap: stoneCurbPBR.roughnessMap,
      roughness: 0.68,
      metalness: 0.03,
      envMapIntensity: 0.76
    }),
    lawn: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: lawnMainPBR.map,
      roughnessMap: lawnMainPBR.roughnessMap,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.42
    }),
    lawnRich: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: lawnRichPBR.map,
      roughnessMap: lawnRichPBR.roughnessMap,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.46
    }),
    pathway: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stonePathPBR.map,
      roughnessMap: stonePathPBR.roughnessMap,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.72
    }),
    pathwayBorder: new THREE.MeshStandardMaterial({
      color: 0xd9dde3,
      map: stoneCurbPBR.map,
      roughnessMap: stoneCurbPBR.roughnessMap,
      roughness: 0.70,
      metalness: 0.02,
      envMapIntensity: 0.75
    }),
    wallWhite: new THREE.MeshStandardMaterial({
      color: 0xe3dfd7,
      map: stuccoWarmPBR.map,
      roughnessMap: stuccoWarmPBR.roughnessMap,
      roughness: 0.54,
      metalness: 0.02,
      envMapIntensity: 0.85
    }),
    wallPureWhite: new THREE.MeshStandardMaterial({
      color: 0xf3f0ea,
      map: stuccoPurePBR.map,
      roughnessMap: stuccoPurePBR.roughnessMap,
      roughness: 0.46,
      metalness: 0.03,
      envMapIntensity: 0.92
    }),
    wallCharcoal: new THREE.MeshStandardMaterial({
      color: 0x343942,
      map: concreteCharcoalPBR.map,
      roughnessMap: concreteCharcoalPBR.roughnessMap,
      roughness: 0.50,
      metalness: 0.10,
      envMapIntensity: 1.05
    }),
    wallDarkSlate: new THREE.MeshStandardMaterial({
      color: 0x22262f,
      map: concreteCharcoalPBR.map,
      roughnessMap: concreteCharcoalPBR.roughnessMap,
      roughness: 0.48,
      metalness: 0.12,
      envMapIntensity: 1.08
    }),
    roofSlabGrey: new THREE.MeshStandardMaterial({
      color: 0x6c717a,
      map: roofMembranePBR.map,
      roughnessMap: roofMembranePBR.roughnessMap,
      roughness: 0.70,
      metalness: 0.04,
      envMapIntensity: 0.80
    }),
    woodNoble: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodNoblePBR.map,
      roughnessMap: woodNoblePBR.roughnessMap,
      roughness: 0.52,
      metalness: 0.04,
      envMapIntensity: 0.90
    }),
    woodSlatsLit: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodSlatsPBR.map,
      roughnessMap: woodSlatsPBR.roughnessMap,
      emissive: 0x8a4410,
      emissiveIntensity: 0.34,
      roughness: 0.48,
      metalness: 0.03,
      envMapIntensity: 0.85
    }),
    woodDeck: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodDeckPBR.map,
      roughnessMap: woodDeckPBR.roughnessMap,
      roughness: 0.58,
      metalness: 0.03,
      envMapIntensity: 0.92
    }),
    glassBalcony: new THREE.MeshPhysicalMaterial({
      color: 0xa5d8f3,
      transparent: true,
      opacity: 0.42,
      roughness: 0.05,
      metalness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      ior: 1.52,
      reflectivity: 0.96,
      envMapIntensity: 1.85,
      depthWrite: false
    }),
    glassPavilion: new THREE.MeshPhysicalMaterial({
      color: 0xe6eff6,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.46,
      roughness: 0.06,
      metalness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      ior: 1.52,
      reflectivity: 0.95,
      envMapIntensity: 1.75,
      depthWrite: false
    }),
    litBalconyDoor: new THREE.MeshBasicMaterial({ map: balconyWinTex }),
    litWindow: new THREE.MeshBasicMaterial({ map: roomWinTex }),
    warmGlowCore: new THREE.MeshBasicMaterial({ color: 0xfff3d1 }),
    warmAmberGlow: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    floorLightHalo: new THREE.MeshBasicMaterial({
      map: glowFloorTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    sconceCone: new THREE.MeshBasicMaterial({
      map: sconceConeTex,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }),
    poolWater: new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.36,
      roughness: 0.08,
      metalness: 0.16,
      envMapIntensity: 1.60
    }),
    parasolFabric: new THREE.MeshStandardMaterial({
      color: 0xf7f2e7,
      map: canvasWeavePBR.map,
      roughnessMap: canvasWeavePBR.roughnessMap,
      emissive: 0xfde68a,
      emissiveIntensity: 0.07,
      roughness: 0.78,
      envMapIntensity: 0.70,
      side: THREE.DoubleSide
    }),
    metalBlack: new THREE.MeshStandardMaterial({
      color: 0x1f222a,
      map: metalBlackPBR.map,
      roughnessMap: metalBlackPBR.roughnessMap,
      roughness: 0.32,
      metalness: 0.80,
      envMapIntensity: 1.50
    })
  };

  // 1. Constrói Embasamento, Gramado, Alamedas, Portaria (1), Piscina WebGL Water (2),
  //    Quadra (3), Academia ao Ar Livre (4), Salão de Festas (5) e 6 Casas (6)
  const {
    casaRoofGroups,
    salaoRoofGroups,
    poolWaterMesh,
    waterUniforms
  } = buildBaseAndAmenities3D(root, renderer, mats, nightLightObjects);

  // 2. Constrói as 5 Torres Residenciais em Formato "H" (Setor 7: A, B, C, D, E)
  const towersMap = buildTowers3D(root, renderer, mats, nightLightObjects);

  // 3. Constrói todo o Paisagismo Botânico Fiel (Prancha 2) e Balizadores Luminosos
  buildLandscaping3D(root, renderer, mats, nightLightObjects);

  // 4. Ativa sombras arquitetônicas suaves em todos os volumes opacos da maquete
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mat = obj.material;
    if (
      mat.isShaderMaterial ||
      mat.blending === THREE.AdditiveBlending ||
      mat.isMeshBasicMaterial ||
      (mat.transparent && mat.opacity < 0.75)
    ) {
      return;
    }
    if (obj.position.y > 0.18 || obj.parent !== root) {
      obj.castShadow = true;
    }
    obj.receiveShadow = true;
  });

  // 5. Funde as malhas opacas e paradas por material (de ~17 mil objetos para algumas centenas).
  //    Protegidos = o que o app liga/desliga (andares, coberturas); ignorado = a água da piscina (shader animado).
  const cortes = new Map(); // id da torre -> { value }: último andar visível, lido pelo shader
  const ignorarAndares = poolWaterMesh ? [poolWaterMesh] : [];
  for (const [id, entry] of towersMap) {
    const r = mergeAcrossFloors(entry.group, entry.floorMeshes, { ignorar: ignorarAndares });
    if (r) cortes.set(id, r.uCut);
  }
  const protegidos = [...casaRoofGroups, ...salaoRoofGroups];
  for (const entry of towersMap.values()) protegidos.push(...entry.floorMeshes, entry.roofGroup);
  const ignorar = []; // nightLightObjects não é alternado em lugar nenhum: pode fundir
  if (poolWaterMesh) ignorar.push(poolWaterMesh);
  root.userData.mergeStats = mergeStatic(root, { protegidos, ignorar });

  // Controle de corte de pavimentos por torre (Modo Desmonte & Planta Baixa Geral)
  function setTowerCut(towerIndex, cutFloorVal) {
    const cfg = TOWERS_CONFIG[towerIndex];
    if (!cfg) return;
    const tEntry = towersMap.get(cfg.id);
    if (!tEntry) return;

    const rawCut = Number.isFinite(cutFloorVal) ? cutFloorVal : cfg.floors + 1;
    const effFloors = Math.max(0, Math.min(cfg.floors, Math.floor(rawCut)));
    tEntry.floorMeshes.forEach((fm, idx) => {
      const visible = (idx + 1) <= effFloors;
      if (fm.visible !== visible) fm.visible = visible;
    });
    const uCut = cortes.get(cfg.id); // malhas fundidas entre andares: o shader esconde os andares acima do corte
    if (uCut) uCut.value = effFloors;
    if (tEntry.roofGroup) {
      tEntry.roofGroup.visible = rawCut > cfg.floors;
    }
  }

  // Controle de visibilidade das coberturas térreas (6 Casas + Salão de Festas) para Planta Baixa Geral
  function setLowRiseRoofsVisible(visible) {
    const vis = !!visible;
    for (const r of casaRoofGroups) r.visible = vis;
    for (const r of salaoRoofGroups) r.visible = vis;
  }

  // 6. A maquete nunca se move (só liga/desliga grupos): congela as matrizes e poupa o recálculo de ~3,7 mil objetos por quadro
  root.updateMatrixWorld(true);
  root.traverse((o) => { o.matrixAutoUpdate = false; });

  return {
    group: root,
    towersMap,
    setTowerCut,
    setLowRiseRoofsVisible,
    nightLightObjects,
    poolWaterMesh,
    waterUniforms
  };
}
