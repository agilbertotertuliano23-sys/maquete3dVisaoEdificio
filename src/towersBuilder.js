// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — CONSTRUTOR DAS 5 TORRES EM "H" E PLANTAS 3D
// Arquitetura Fotorrealista de Alta Precisão:
//  - Vidros arquitetônicos físicos (MeshPhysicalMaterial) recuados em caixilhos
//    de alumínio anodizado, com interiores variados (cortinas sombreadas e
//    ambientes suavemente iluminados em 2700K)
//  - Relevo de fachada profundo: pingadeiras de laje, frisos de sombra,
//    pilastras verticais escalonadas, brises horizontais técnicos e texturas
//    procedurais de concreto/reboco e painéis grafite (apenas map/roughnessMap)
//  - Varandas Gourmet aprofundadas com forro ripado amadeirado, guarda-corpo
//    em vidro laminado, corrimão escovado, floreiras rítmicas e portas recuadas
//  - Térreo / Pilotis com lobby envidraçado monumental, marquise arquitetônica
//    e parede destaque em travertino e madeira ripada
//  - Coroamento das coberturas com pérgolas perimetrais, floreiras lineares,
//    brises de fechamento técnico/barrilete e cornijas escalonadas
// ==========================================================================

import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { TOWERS_CONFIG, FLOOR_H, BASE_Y } from './data.js';

// --------------------------------------------------------------------------
// GERADORES PROCEDURAIS DETERMINÍSTICOS & TEXTURAS PBR (ONLY map / roughnessMap)
// --------------------------------------------------------------------------

const textureCache = new Map();

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getConcreteStuccoTextures(tone = 'pier', maxAniso = 8) {
  const key = `concrete_stucco_${tone}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const size = 512;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d');

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rCtx = cRough.getContext('2d');

  const isPier = tone === 'pier';
  const baseR = isPier ? 238 : 225;
  const baseG = isPier ? 234 : 219;
  const baseB = isPier ? 226 : 210;

  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = isPier ? 'rgb(142,142,142)' : 'rgb(158,158,158)';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(isPier ? 104729 : 224737);

  // Microvariação mineral sutil de massa/concreto desempenado
  for (let i = 0; i < 4800; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const w = 1 + Math.floor(rand() * 4);
    const h = 1 + Math.floor(rand() * 3);
    const delta = Math.floor((rand() - 0.5) * 14);
    ctx.fillStyle = `rgb(${baseR + delta},${baseG + delta},${baseB + delta - 1})`;
    ctx.fillRect(x, y, w, h);

    const rv = (isPier ? 142 : 158) + Math.floor((rand() - 0.5) * 26);
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.fillRect(x, y, w, h);
  }

  // Juntas sutis de paginação arquitetônica (frisos horizontais e verticais)
  ctx.fillStyle = 'rgba(42, 38, 34, 0.055)';
  rCtx.fillStyle = 'rgb(205,205,205)';
  for (let y = 0; y < size; y += 64) {
    ctx.fillRect(0, y, size, 1);
    rCtx.fillRect(0, y, size, 1);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let y = 1; y < size; y += 64) {
    ctx.fillRect(0, y, size, 1);
  }
  ctx.fillStyle = 'rgba(42, 38, 34, 0.04)';
  for (let x = 0; x < size; x += 128) {
    ctx.fillRect(x, 0, 1, size);
  }

  const map = new THREE.CanvasTexture(cMap);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;

  const res = { map, roughnessMap };
  textureCache.set(key, res);
  return res;
}

function getGraphitePanelTextures(maxAniso = 8) {
  const key = 'graphite_panel';
  if (textureCache.has(key)) return textureCache.get(key);

  const size = 256;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d');

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rCtx = cRough.getContext('2d');

  ctx.fillStyle = '#363b45';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(126,126,126)';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(881923);
  const panelTones = ['#333842', '#3a404b', '#353a44', '#3d434f'];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const px = col * 128;
      const py = row * 64;
      ctx.fillStyle = panelTones[(row * 2 + col) % panelTones.length];
      ctx.fillRect(px + 2, py + 2, 124, 60);

      // Juntas sombreadas e discreto brilho superior do painel metálico/cimentício
      ctx.fillStyle = 'rgba(18, 20, 26, 0.55)';
      ctx.fillRect(px, py, 128, 2);
      ctx.fillRect(px, py, 2, 64);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(px + 2, py + 2, 124, 1);

      const rv = 118 + Math.floor(rand() * 20);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(px + 2, py + 2, 124, 60);
      rCtx.fillStyle = 'rgb(195,195,195)';
      rCtx.fillRect(px, py, 128, 2);
      rCtx.fillRect(px, py, 2, 64);
    }
  }

  for (let i = 0; i < 1800; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, y, 2, 1);
  }

  const map = new THREE.CanvasTexture(cMap);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;

  const res = { map, roughnessMap };
  textureCache.set(key, res);
  return res;
}

function getWoodSlatTextures(orientation = 'horizontal', maxAniso = 8) {
  const key = `wood_slats_${orientation}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const size = 256;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d');

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rCtx = cRough.getContext('2d');

  ctx.fillStyle = '#331c0d';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(215,215,215)';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(orientation === 'vertical' ? 51923 : 91827);
  const tones = ['#9d6336', '#8f572c', '#aa6e40', '#865027', '#965c31'];
  const step = 16;

  for (let i = 0; i < size / step; i++) {
    const p = i * step;
    ctx.fillStyle = tones[i % tones.length];
    if (orientation === 'vertical') {
      ctx.fillRect(p + 2, 0, step - 3, size);
      ctx.fillStyle = 'rgba(255, 224, 192, 0.08)';
      ctx.fillRect(p + 3, 0, 2, size);
      rCtx.fillStyle = `rgb(${115 + Math.floor(rand() * 24)},125,125)`;
      rCtx.fillRect(p + 2, 0, step - 3, size);
    } else {
      ctx.fillRect(0, p + 2, size, step - 3);
      ctx.fillStyle = 'rgba(255, 224, 192, 0.08)';
      ctx.fillRect(0, p + 3, size, 2);
      rCtx.fillStyle = `rgb(${115 + Math.floor(rand() * 24)},125,125)`;
      rCtx.fillRect(0, p + 2, size, step - 3);
    }
  }

  for (let i = 0; i < 600; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = rand() > 0.5 ? 'rgba(40,18,6,0.12)' : 'rgba(255,215,175,0.06)';
    if (orientation === 'vertical') ctx.fillRect(x, y, 1, 18);
    else ctx.fillRect(x, y, 18, 1);
  }

  const map = new THREE.CanvasTexture(cMap);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;

  const res = { map, roughnessMap };
  textureCache.set(key, res);
  return res;
}

function getTravertineStoneTextures(maxAniso = 8) {
  const key = 'travertine_stone';
  if (textureCache.has(key)) return textureCache.get(key);

  const size = 256;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d');

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rCtx = cRough.getContext('2d');

  ctx.fillStyle = '#d8cfc0';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(108,108,108)';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(40499);
  for (let y = 0; y < size; y += 4) {
    const d = Math.floor((rand() - 0.5) * 18);
    ctx.fillStyle = `rgb(${214 + d},${205 + d},${190 + d})`;
    ctx.fillRect(0, y, size, 4);
  }
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = 'rgba(130, 114, 94, 0.20)';
    ctx.fillRect(x, y, 6 + Math.floor(rand() * 14), 2);
  }
  ctx.fillStyle = 'rgba(72, 62, 50, 0.25)';
  rCtx.fillStyle = 'rgb(175,175,175)';
  for (let y = 0; y < size; y += 64) {
    ctx.fillRect(0, y, size, 2);
    rCtx.fillRect(0, y, size, 2);
  }
  for (let r = 0; r < 4; r++) {
    const ox = (r % 2) * 64;
    for (let x = ox; x < size; x += 128) {
      ctx.fillRect(x, r * 64, 2, 64);
      rCtx.fillRect(x, r * 64, 2, 64);
    }
  }

  const map = new THREE.CanvasTexture(cMap);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;

  const res = { map, roughnessMap };
  textureCache.set(key, res);
  return res;
}

function getRoofDeckTextures(maxAniso = 8) {
  const key = 'roof_paver_deck';
  if (textureCache.has(key)) return textureCache.get(key);

  const size = 512;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d');

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rCtx = cRough.getContext('2d');

  ctx.fillStyle = '#6f747d';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(192,192,192)';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(71821);
  const paverTones = ['#6b7078', '#747982', '#666b73', '#787d86'];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = paverTones[(r * 3 + c) % paverTones.length];
      ctx.fillRect(c * 64 + 1, r * 64 + 1, 62, 62);
      const rv = 182 + Math.floor(rand() * 24);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(c * 64 + 1, r * 64 + 1, 62, 62);
    }
  }
  ctx.fillStyle = 'rgba(28, 32, 38, 0.34)';
  for (let i = 0; i < size; i += 64) {
    ctx.fillRect(i, 0, 2, size);
    ctx.fillRect(0, i, size, 2);
  }

  const map = new THREE.CanvasTexture(cMap);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;

  const res = { map, roughnessMap };
  textureCache.set(key, res);
  return res;
}

// Interiores sombreados realistas (~68% das unidades: cortinas, persianas e profundidade)
function getShadedInteriorTexture(variantIdx = 0, maxAniso = 8) {
  const key = `shaded_int_${variantIdx}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  const palettes = [
    { top: '#354154', mid: '#232c3a', bot: '#151a24', curt: '#445063', fold: '#2a3342' },
    { top: '#2f3a4a', mid: '#1f2733', bot: '#121720', curt: '#3d4757', fold: '#252d3a' },
    { top: '#3a3842', mid: '#26252c', bot: '#17171c', curt: '#4a4752', fold: '#2f2d36' },
    { top: '#2d3748', mid: '#1c2330', bot: '#11161e', curt: '#3c485c', fold: '#232b38' }
  ];
  const pal = palettes[variantIdx % palettes.length];

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0.0, pal.top);
  bg.addColorStop(0.45, pal.mid);
  bg.addColorStop(1.0, pal.bot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (variantIdx % 4 === 1) {
    // Persiana arquitetônica parcialmente fechada no topo
    ctx.fillStyle = pal.curt;
    ctx.fillRect(0, 0, w, h * 0.44);
    ctx.fillStyle = 'rgba(15, 20, 28, 0.35)';
    for (let y = 6; y < h * 0.44; y += 7) ctx.fillRect(0, y, w, 2);
  } else {
    // Cortinas de linho sombreadas com pregas verticais suaves
    const leftW = variantIdx % 4 === 3 ? w * 0.42 : w * 0.28;
    const rightW = variantIdx % 4 === 2 ? w * 0.40 : w * 0.28;
    ctx.fillStyle = pal.curt;
    ctx.fillRect(0, 0, leftW, h);
    ctx.fillRect(w - rightW, 0, rightW, h);
    ctx.fillStyle = pal.fold;
    for (let x = 6; x < leftW; x += 10) ctx.fillRect(x, 0, 4, h);
    for (let x = w - rightW + 4; x < w; x += 10) ctx.fillRect(x, 0, 4, h);
  }

  // Sombra suave da laje/forro e silhueta discreta de mobiliário escuro
  const topShade = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  topShade.addColorStop(0, 'rgba(10, 14, 22, 0.45)');
  topShade.addColorStop(1, 'rgba(10, 14, 22, 0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, w, h * 0.22);

  ctx.fillStyle = 'rgba(12, 16, 22, 0.55)';
  ctx.fillRect(w * 0.16, h * 0.70, w * 0.68, h * 0.30);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  textureCache.set(key, tex);
  return tex;
}

// Interiores suavemente iluminados em tons neutros/quentes contidos (~32% das unidades, sem neon!)
function getWarmInteriorTexture(variantIdx = 0, maxAniso = 8) {
  const key = `warm_int_${variantIdx}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  const palettes = [
    { top: '#d6c4aa', mid: '#ab8d68', bot: '#3d3023', halo: 'rgba(255, 240, 214, 0.55)', curt: '#9a846b' },
    { top: '#cec0ab', mid: '#9e8362', bot: '#362b20', halo: 'rgba(252, 234, 204, 0.50)', curt: '#8e7a64' },
    { top: '#dccbb3', mid: '#b5946d', bot: '#423325', halo: 'rgba(255, 243, 220, 0.52)', curt: '#a38b70' }
  ];
  const pal = palettes[variantIdx % palettes.length];

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0.0, pal.top);
  bg.addColorStop(0.32, pal.mid);
  bg.addColorStop(0.75, '#6e563d');
  bg.addColorStop(1.0, pal.bot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Sanca discreta no teto e halo difuso suave de ambiente residencial
  ctx.fillStyle = 'rgba(255, 248, 235, 0.42)';
  ctx.fillRect(w * 0.10, h * 0.05, w * 0.80, h * 0.05);

  const lx = w * (0.44 + (variantIdx % 3) * 0.06);
  const glow = ctx.createRadialGradient(lx, h * 0.24, 6, lx, h * 0.36, w * 0.48);
  glow.addColorStop(0.0, pal.halo);
  glow.addColorStop(0.55, 'rgba(235, 205, 165, 0.22)');
  glow.addColorStop(1.0, 'rgba(180, 140, 95, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Cortinas laterais de linho natural
  ctx.fillStyle = pal.curt;
  ctx.fillRect(0, 0, w * 0.22, h);
  ctx.fillRect(w * 0.78, 0, w * 0.22, h);
  ctx.fillStyle = 'rgba(65, 48, 32, 0.22)';
  for (let x = 6; x < w * 0.22; x += 9) ctx.fillRect(x, 0, 3, h);
  for (let x = w * 0.78 + 4; x < w; x += 9) ctx.fillRect(x, 0, 3, h);

  // Silhueta de mobiliário interno (sofá / aparador)
  ctx.fillStyle = 'rgba(38, 28, 20, 0.52)';
  ctx.fillRect(w * 0.22, h * 0.70, w * 0.56, h * 0.30);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  textureCache.set(key, tex);
  return tex;
}

function getWoodPlankFloorTexture() {
  const key = 'wood_plank_floor';
  if (textureCache.has(key)) return textureCache.get(key);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a679';
  ctx.fillRect(0, 0, 256, 256);

  const tones = ['#c39e70', '#cfa97e', '#bd9668', '#d4b085'];
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = tones[(y / 16) % tones.length];
    ctx.fillRect(0, y, 256, 14);
    ctx.fillStyle = 'rgba(92, 58, 28, 0.28)';
    ctx.fillRect(0, y + 14, 256, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

// Cria BoxGeometry com UVs proporcionais às dimensões em mundo (evita esticar texturas)
function createArchitecturalBoxGeo(w, h, d, uvScale = 0.22) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (pos && norm && uv) {
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (nx > 0.5) {
        uv.setXY(i, u * d * uvScale, v * h * uvScale);
      } else if (ny > 0.5) {
        uv.setXY(i, u * w * uvScale, v * d * uvScale);
      } else {
        uv.setXY(i, u * w * uvScale, v * h * uvScale);
      }
    }
    uv.needsUpdate = true;
  }
  return geo;
}

// O recuo nas pontas dá às sacadas uma frente convexa, contida no
// volume selecionável de cada apartamento.
function balconySetback(x, width, inset) {
  const u = Math.min(1, Math.abs(2 * x / width));
  return inset * u * u;
}

function balconyEdgeGeometry(width, height, depth, inset, fixedBack = false) {
  const geo = new THREE.BoxGeometry(width, height, depth, inset ? 8 : 1);
  if (!inset) return geo;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (!fixedBack || z > 0) pos.setZ(i, z - balconySetback(pos.getX(i), width, inset));
  }
  geo.computeVertexNormals();
  return geo;
}

// Funde geometrias transparentes por pavimento para reduzir centenas de draw calls a 1 por material/andar
function mergeGlassBatch(items, mat, renderOrder = 1) {
  if (!items.length) return null;
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  const geos = items.map((it) => {
    const g = it.geo.clone();
    for (const attr of Object.keys(g.attributes)) {
      if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
        g.deleteAttribute(attr);
      }
    }
    euler.set(0, it.rotY || 0, 0);
    quat.setFromEuler(euler);
    pos.set(it.x, it.y, it.z);
    scl.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    mat4.compose(pos, quat, scl);
    g.applyMatrix4(mat4);
    return g;
  });

  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return null;

  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = renderOrder;
  return mesh;
}

function unitHash(tIdx, floor, sx, sz) {
  let h = (tIdx + 1) * 73856093;
  h ^= floor * 19349663;
  h ^= (sx > 0 ? 3 : 1) * 83492791;
  h ^= (sz > 0 ? 5 : 2) * 2971215073;
  return h >>> 0;
}

// --------------------------------------------------------------------------
// 1. CONSTRUTOR DAS 5 TORRES RESIDENCIAIS EM FORMATO "H" (A, B, C, D, E)
// --------------------------------------------------------------------------

export function buildTowers3D(root, renderer, mats = {}, nightLightObjects = []) {
  const towersMap = new Map();
  const maxAniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;

  // Texturas procedurais compartilhadas (apenas map e roughnessMap -> 100% compatível com mergeStatic)
  const concretePierTex = getConcreteStuccoTextures('pier', maxAniso);
  const concreteBodyTex = getConcreteStuccoTextures('body', maxAniso);
  const graphiteTex = getGraphitePanelTextures(maxAniso);
  const woodHorizTex = getWoodSlatTextures('horizontal', maxAniso);
  const woodVertTex = getWoodSlatTextures('vertical', maxAniso);
  const travertineTex = getTravertineStoneTextures(maxAniso);
  const roofDeckTex = getRoofDeckTextures(maxAniso);

  // Materiais arquitetônicos PBR
  const pierMat = new THREE.MeshStandardMaterial({
    map: concretePierTex.map,
    roughnessMap: concretePierTex.roughnessMap,
    roughness: 0.86,
    metalness: 0.03
  });
  const wallBodyMat = new THREE.MeshStandardMaterial({
    map: concreteBodyTex.map,
    roughnessMap: concreteBodyTex.roughnessMap,
    roughness: 0.90,
    metalness: 0.02
  });
  const graphiteMat = new THREE.MeshStandardMaterial({
    map: graphiteTex.map,
    roughnessMap: graphiteTex.roughnessMap,
    roughness: 0.88,
    metalness: 0.14
  });
  const clayMat = new THREE.MeshStandardMaterial({
    map: concreteBodyTex.map,
    roughnessMap: concreteBodyTex.roughnessMap,
    color: 0xc28d77,
    roughness: 0.84
  });
  const revealDarkMat = new THREE.MeshStandardMaterial({
    color: 0x20242c,
    roughness: 0.74,
    metalness: 0.12
  });
  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x9fa9b8,
    roughness: 0.26,
    metalness: 0.78,
    envMapIntensity: 1.32
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x252a33,
    roughness: 0.34,
    metalness: 0.74,
    envMapIntensity: 1.18
  });
  const railMetalMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.22,
    metalness: 0.82,
    envMapIntensity: 1.36
  });
  const woodSoffitMat = new THREE.MeshStandardMaterial({
    map: woodHorizTex.map,
    roughnessMap: woodHorizTex.roughnessMap,
    roughness: 0.72,
    metalness: 0.04
  });
  const woodVertMat = new THREE.MeshStandardMaterial({
    map: woodVertTex.map,
    roughnessMap: woodVertTex.roughnessMap,
    roughness: 0.72,
    metalness: 0.04
  });
  const travertineMat = new THREE.MeshStandardMaterial({
    map: travertineTex.map,
    roughnessMap: travertineTex.roughnessMap,
    roughness: 0.68,
    metalness: 0.03
  });
  const balconyTileMat = new THREE.MeshStandardMaterial({
    color: 0xcac1b3,
    roughness: 0.64,
    metalness: 0.02
  });
  const roofSlabMat = new THREE.MeshStandardMaterial({
    map: roofDeckTex.map,
    roughnessMap: roofDeckTex.roughnessMap,
    roughness: 0.92,
    metalness: 0.04
  });
  const roofPenthouseMat = new THREE.MeshStandardMaterial({
    map: graphiteTex.map,
    roughnessMap: graphiteTex.roughnessMap,
    color: 0xa2a9b4,
    roughness: 0.84,
    metalness: 0.16
  });
  const skylightGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a293d,
    roughness: 0.06,
    metalness: 0.22,
    clearcoat: 0.92,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95,
    envMapIntensity: 1.45
  });
  const planterSoilMat = new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 0.95 });
  const foliageDarkMat = new THREE.MeshStandardMaterial({ color: 0x2f5a22, roughness: 0.84 });
  const foliageLightMat = new THREE.MeshStandardMaterial({ color: 0x4b7d31, roughness: 0.80 });
  const downlightBezelMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: 0xffd599,
    emissiveIntensity: 0.55,
    roughness: 0.35
  });
  const balconyFurnMat = new THREE.MeshStandardMaterial({ color: 0x4b3526, roughness: 0.68 });

  // Interiores variados: ~68% sombreados neutros/cortinas, ~32% aquecidos com suavidade
  const shadedIntMats = [0, 1, 2, 3].map(
    i => new THREE.MeshStandardMaterial({ map: getShadedInteriorTexture(i, maxAniso), roughness: 0.82 })
  );
  const warmIntMats = [0, 1, 2].map(
    i => new THREE.MeshStandardMaterial({
      map: getWarmInteriorTexture(i, maxAniso),
      emissive: 0xd4a46a,
      emissiveIntensity: 0.22,
      roughness: 0.78
    })
  );

  // Vidros externos refletivos PBR (MeshPhysicalMaterial)
  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e2d42,
    roughness: 0.06,
    metalness: 0.15,
    clearcoat: 0.9,
    clearcoatRoughness: 0.06,
    reflectivity: 0.95,
    envMapIntensity: 1.45,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const glassBalcony = new THREE.MeshPhysicalMaterial({
    color: 0x73979e,
    roughness: 0.07,
    metalness: 0.15,
    clearcoat: 0.9,
    clearcoatRoughness: 0.06,
    reflectivity: 0.95,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.36,
    depthWrite: false
  });
  const lobbyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x263a52,
    roughness: 0.05,
    metalness: 0.15,
    clearcoat: 0.92,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.46,
    depthWrite: false
  });

  // Geometrias unitárias reutilizáveis (escala positiva sempre -> mergeStatic compatível)
  const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
  const shrubGeoA = new THREE.DodecahedronGeometry(0.16, 0);
  const shrubGeoB = new THREE.IcosahedronGeometry(0.14, 0);
  const downlightGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.014, 6);
  const lobbyRingGeo = new THREE.TorusGeometry(0.30, 0.022, 6, 18);
  lobbyRingGeo.rotateX(Math.PI * 0.5);
  const haloPlaneGeo = new THREE.PlaneGeometry(2.1, 1.4);
  haloPlaneGeo.rotateX(-Math.PI / 2);

  // Helper: adiciona uma caixa escalada positivamente ao grupo (sem scale negativo!)
  function addScaledBox(parent, x, y, z, bw, bh, bd, mat, rotY = 0) {
    const m = new THREE.Mesh(unitBoxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(bw, bh, bd);
    if (rotY) m.rotation.y = rotY;
    parent.add(m);
    return m;
  }

  // Helper: janela arquitetônica recuada com interior, caixilho metálico, vidro PBR e pingadeira
  function addRecessedWindow(fg, glassItems, {
    cx, cy, cz,
    winW, winH,
    facing, // 'N' | 'S' | 'E' | 'W'
    recessDepth = 0.14,
    glassOffset = 0.06,
    panesX = 2,
    transomFrac = 0, // fração da altura a partir da base (0 = sem travessa horizontal)
    interiorMat,
    withSill = true,
    frameMat = mullionMat
  }) {
    const rotY = facing === 'N' ? Math.PI
      : facing === 'E' ? Math.PI * 0.5
      : facing === 'W' ? -Math.PI * 0.5
      : 0;
    const nx = facing === 'E' ? 1 : facing === 'W' ? -1 : 0;
    const nz = facing === 'S' ? 1 : facing === 'N' ? -1 : 0;
    const isZ = nz !== 0;

    // 1. Plano de fundo do interior recuado (opaco, voltado para fora)
    const backPlane = new THREE.Mesh(unitPlaneGeo, interiorMat);
    backPlane.position.set(cx - nx * recessDepth, cy, cz - nz * recessDepth);
    backPlane.scale.set(winW - 0.02, winH - 0.02, 1);
    backPlane.rotation.y = rotY;
    fg.add(backPlane);

    // 2. Lâmina externa de vidro refletivo PBR (coletada para fusão por pavimento)
    glassItems.push({
      geo: unitPlaneGeo,
      x: cx - nx * glassOffset,
      y: cy,
      z: cz - nz * glassOffset,
      rotY,
      sx: winW - 0.04,
      sy: winH - 0.04,
      sz: 1
    });

    // 3. Requadro profundo + Esquadria / Montantes / Travessas de alumínio anodizado
    const tx = isZ ? 1 : 0;
    const tz = isZ ? 0 : 1;
    const fFront = glassOffset - 0.02;
    const fProf = Math.max(0.06, recessDepth - fFront);
    const fCenter = fFront + fProf * 0.5;
    const fx = cx - nx * fCenter;
    const fz = cz - nz * fCenter;
    const fBar = 0.032;

    // Moldura perimetral profunda (funciona como ombreira de recuo + batente metálico)
    addScaledBox(fg, fx, cy + winH * 0.5 - fBar * 0.5, fz, isZ ? winW : fProf, fBar, isZ ? fProf : winW, frameMat);
    addScaledBox(fg, fx, cy - winH * 0.5 + fBar * 0.5, fz, isZ ? winW : fProf, fBar, isZ ? fProf : winW, frameMat);
    for (const side of [-1, 1]) {
      addScaledBox(
        fg,
        fx + tx * side * (winW * 0.5 - fBar * 0.5),
        cy,
        fz + tz * side * (winW * 0.5 - fBar * 0.5),
        isZ ? fBar : fProf, winH - fBar * 2, isZ ? fProf : fBar,
        frameMat
      );
    }

    // Montantes verticais internos e travessa horizontal à frente do vidro
    const mx = cx - nx * (glassOffset - 0.014);
    const mz = cz - nz * (glassOffset - 0.014);
    const mProf = 0.036;
    const mulBar = 0.024;
    for (let i = 1; i < panesX; i++) {
      const offset = -winW * 0.5 + (winW / panesX) * i;
      addScaledBox(
        fg,
        mx + tx * offset,
        cy,
        mz + tz * offset,
        isZ ? mulBar : mProf, winH - fBar * 2, isZ ? mProf : mulBar,
        frameMat
      );
    }

    if (transomFrac > 0 && transomFrac < 1) {
      const ty = cy - winH * 0.5 + winH * transomFrac;
      addScaledBox(
        fg, mx, ty, mz,
        isZ ? winW - fBar * 2 : mProf, 0.024, isZ ? mProf : winW - fBar * 2,
        frameMat
      );
    }

    // 4. Pingadeira de peitoril saliente
    if (withSill) {
      addScaledBox(
        fg,
        cx + nx * 0.025,
        cy - winH * 0.5 - 0.018,
        cz + nz * 0.025,
        isZ ? winW + 0.07 : 0.14, 0.036, isZ ? 0.14 : winW + 0.07,
        pierMat
      );
    }
  }

  // Helper: grade de brise horizontal (veneziana de ar-condicionado / shaft técnico)
  function addBriseGrille(parent, { cx, cy, cz, w: bw, h: bh, facing, slats = 4, depth = 0.10 }) {
    const nx = facing === 'E' ? 1 : facing === 'W' ? -1 : 0;
    const nz = facing === 'S' ? 1 : facing === 'N' ? -1 : 0;
    const isZ = nz !== 0;

    // Caixa escura recuada de fundo
    addScaledBox(
      parent,
      cx - nx * (depth * 0.55), cy, cz - nz * (depth * 0.55),
      isZ ? bw : depth, bh, isZ ? depth : bw,
      revealDarkMat
    );

    // Montantes laterais da moldura em metal grafite
    const bar = 0.032;
    const fx = cx - nx * 0.016;
    const fz = cz - nz * 0.016;
    const tx = isZ ? 1 : 0;
    const tz = isZ ? 0 : 1;
    for (const side of [-1, 1]) {
      addScaledBox(
        parent,
        fx + tx * side * (bw * 0.5 - bar * 0.5),
        cy,
        fz + tz * side * (bw * 0.5 - bar * 0.5),
        isZ ? bar : 0.045, bh, isZ ? 0.045 : bar,
        darkMetalMat
      );
    }

    // Lâminas horizontais do brise
    for (let i = 1; i <= slats; i++) {
      const sy = cy - bh * 0.5 + (bh / (slats + 1)) * i;
      addScaledBox(
        parent,
        cx - nx * 0.022, sy, cz - nz * 0.022,
        isZ ? bw - 0.04 : 0.052, 0.022, isZ ? 0.052 : bw - 0.04,
        mullionMat
      );
    }
  }

  // Helper: floreira linear com arbustos verdes esculpidos
  function addPlanterStrip(parent, x, y, z, pw, pd, ph = 0.24, alongZ = false, seedBase = 1) {
    addScaledBox(parent, x, y + ph * 0.5, z, pw, ph, pd, pierMat);
    addScaledBox(parent, x, y + ph - 0.015, z, Math.max(0.08, pw - 0.08), 0.04, Math.max(0.08, pd - 0.08), planterSoilMat);

    const span = alongZ ? pd - 0.18 : pw - 0.18;
    const count = Math.max(2, Math.round(span / 0.34));
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * span;
      const j = ((seedBase + i * 37) % 10) * 0.006 - 0.03;
      const sx = x + (alongZ ? j : t);
      const sz = z + (alongZ ? t : j);
      const m = new THREE.Mesh((i + seedBase) % 2 === 0 ? shrubGeoA : shrubGeoB, i % 3 === 0 ? foliageDarkMat : foliageLightMat);
      m.position.set(sx, y + ph + 0.07, sz);
      const sc = 0.85 + ((seedBase + i * 19) % 5) * 0.10;
      m.scale.set(sc * 1.15, sc * 0.78, sc * 1.10);
      parent.add(m);
    }
  }

  for (let tIdx = 0; tIdx < TOWERS_CONFIG.length; tIdx++) {
    const cfg = TOWERS_CONFIG[tIdx];
    const tGroup = new THREE.Group();
    tGroup.position.set(cfg.x, 0, cfg.z);
    root.add(tGroup);

    // O reel distingue as torres altas de bordas marfim e painéis terracota
    // das duas torres baixas com molduras grafite em frente ao boulevard.
    const boulevard = cfg.id === 'D' || cfg.id === 'E';
    const frameMat = boulevard ? graphiteMat : pierMat;
    const insetPanelMat = boulevard ? travertineMat : clayMat;
    const balconyInset = boulevard ? 0 : 0.40;

    const w = cfg.width;
    const d = cfg.depth;
    const wingW = w * 0.41;
    const coreW = w - wingW * 2;
    const coreD = d * 0.64;
    const wingX = (w - wingW) * 0.5;
    const zFront = d * 0.5;

    // ----------------------------------------------------------------------
    // BASE SOLEIRA FINA EM TRAVERTINO (Abaixo de BASE_Y + 0.04 -> não colide c/ Planta Baixa)
    // ----------------------------------------------------------------------
    const plinthPad = new THREE.Group();
    plinthPad.position.y = BASE_Y;
    const padWingGeo = createArchitecturalBoxGeo(wingW + 0.46, 0.03, d + 0.46, 0.25);
    const padL = new THREE.Mesh(padWingGeo, travertineMat);
    padL.position.set(-wingX, 0.015, 0);
    plinthPad.add(padL);
    const padR = new THREE.Mesh(padWingGeo, travertineMat);
    padR.position.set(wingX, 0.015, 0);
    plinthPad.add(padR);
    const padC = new THREE.Mesh(createArchitecturalBoxGeo(coreW + 0.68, 0.03, coreD + 0.90, 0.25), travertineMat);
    padC.position.set(0, 0.015, 0);
    plinthPad.add(padC);
    tGroup.add(plinthPad);

    // ----------------------------------------------------------------------
    // GEOMETRIAS PROPORCIONAIS COMPARTILHADAS DESTA TORRE
    // ----------------------------------------------------------------------
    const slabH = 0.22;
    const wallBodyH = FLOOR_H - slabH; // 1.23
    const balW = wingW * 0.46;
    const baySpanW = wingW * 0.148;
    const bayCenterOff = wingW * 0.360;
    const balPierOff = wingW * 0.258;
    const balPierW = wingW * 0.056;
    const cornerPierOff = wingW * 0.467;
    const cornerPierW = wingW * 0.066;

    // Lajes + Cornijas Pingadeira + Friso de Sombra
    const wingSlabGeo = createArchitecturalBoxGeo(wingW + 0.24, slabH, d + 0.20, 0.22);
    const wingCorniceLipGeo = createArchitecturalBoxGeo(wingW + 0.40, 0.075, d + 0.34, 0.22);
    const wingRevealBandGeo = new THREE.BoxGeometry(wingW + 0.20, 0.04, d + 0.16);

    const coreSlabGeo = createArchitecturalBoxGeo(coreW + 0.20, slabH, coreD + 0.20, 0.22);
    const coreCorniceLipGeo = createArchitecturalBoxGeo(coreW + 0.32, 0.075, coreD + 0.32, 0.22);
    const coreRevealBandGeo = new THREE.BoxGeometry(coreW + 0.16, 0.04, coreD + 0.14);

    const northBayD = d * 0.15;
    const northCoreBaySlabGeo = createArchitecturalBoxGeo(coreW * 0.80, slabH, northBayD + 0.12, 0.22);
    const northCoreCorniceGeo = createArchitecturalBoxGeo(coreW * 0.88, 0.075, northBayD + 0.20, 0.22);

    // Miolo estrutural recuado das asas e núcleo (deixa folga real para os nichos das janelas!)
    const wingCoreGeo = createArchitecturalBoxGeo(wingW - 0.36, wallBodyH, d - 1.66, 0.22);
    const centerBridgeGeo = createArchitecturalBoxGeo(coreW + 0.10, wallBodyH, coreD - 0.46, 0.24);
    const northStairShaftGeo = createArchitecturalBoxGeo(coreW * 0.76 - 0.24, wallBodyH, northBayD - 0.14, 0.22);

    // Pilastras verticais escalonadas
    const balPierGeo = createArchitecturalBoxGeo(balPierW, FLOOR_H, 0.82, 0.22);
    const balPierFinGeo = createArchitecturalBoxGeo(balPierW * 0.56, FLOOR_H, 0.90, 0.22);
    const cornerPierGeo = createArchitecturalBoxGeo(cornerPierW, FLOOR_H, 0.82, 0.22);
    const cornerPierFinGeo = createArchitecturalBoxGeo(cornerPierW * 0.56, FLOOR_H, 0.90, 0.22);
    const centerSpineFinGeo = createArchitecturalBoxGeo(0.36, FLOOR_H, coreD + 0.36, 0.22);
    const centerSpineStepGeo = createArchitecturalBoxGeo(0.18, FLOOR_H, coreD + 0.44, 0.22);

    // Faixas arquitetônicas em grafite texturizado para os vãos das janelas N/S
    const bayBackW = baySpanW + 0.06;
    const sillH = 0.28;
    const lintelH = wallBodyH - 1.08; // 0.15
    const winOpenH = 1.08 - sillH; // 0.80
    const baySpandrelBotGeo = createArchitecturalBoxGeo(bayBackW, sillH, 0.68, 0.28);
    const baySpandrelTopGeo = createArchitecturalBoxGeo(bayBackW, lintelH, 0.68, 0.28);
    const bayInnerFillGeo = createArchitecturalBoxGeo(bayBackW, winOpenH, 0.52, 0.28);

    // Varanda Gourmet aprofundada
    const balTileGeo = balconyEdgeGeometry(balW, 0.06, 0.82, balconyInset, true);
    const balFasciaGeo = balconyEdgeGeometry(balW + 0.08, 0.22, 0.16, balconyInset);
    const balFasciaLipGeo = balconyEdgeGeometry(balW + 0.12, 0.06, 0.24, balconyInset);
    const balGrooveGeo = balconyEdgeGeometry(balW + 0.04, 0.032, 0.17, balconyInset);
    const balSoffitGeo = createArchitecturalBoxGeo(balW - 0.04, 0.07, 0.74, 0.38);
    const glassRailBoxGeo = balconyEdgeGeometry(balW - 0.02, FLOOR_H * 0.41, 0.045, balconyInset);
    const handrailTopGeo = balconyEdgeGeometry(balW + 0.04, 0.04, 0.08, balconyInset);
    const railShoeGeo = balconyEdgeGeometry(balW, 0.04, 0.055, balconyInset);
    const railPostGeo = new THREE.BoxGeometry(0.032, FLOOR_H * 0.42, 0.065);

    // Empenas laterais (±X): pilastras escalonadas + vãos recuados de dormitório e banho/brise
    const sideSpan = zFront - 0.82;
    const sidePilGeo = createArchitecturalBoxGeo(0.24, FLOOR_H, 0.42, 0.22);
    const sidePilFinGeo = createArchitecturalBoxGeo(0.32, FLOOR_H, 0.22, 0.22);
    const sideBayCenterZ = sideSpan * 0.57;
    const sideWinW = Math.min(2.25, sideSpan * 0.34);
    const sideBayTotalW = sideSpan * 0.48;
    const sideSpandrelBotGeo = createArchitecturalBoxGeo(0.22, sillH, sideBayTotalW, 0.28);
    const sideSpandrelTopGeo = createArchitecturalBoxGeo(0.22, lintelH, sideBayTotalW, 0.28);

    const floorMeshes = [];

    for (let f = 1; f <= cfg.floors; f++) {
      const fg = new THREE.Group();
      fg.position.y = BASE_Y + (f - 1) * FLOOR_H;

      const windowGlassItems = [];
      const balconyGlassItems = [];
      const lobbyGlassItems = [];

      // 1. Lajes + Cornijas de pingadeira saliente + Frisos escuros de sombra
      for (const sx of [-1, 1]) {
        const wx = sx * wingX;
        const slab = new THREE.Mesh(wingSlabGeo, frameMat);
        slab.position.set(wx, FLOOR_H - slabH * 0.5, 0);
        fg.add(slab);

        const lip = new THREE.Mesh(wingCorniceLipGeo, frameMat);
        lip.position.set(wx, FLOOR_H - 0.0375, 0);
        fg.add(lip);

        const rev = new THREE.Mesh(wingRevealBandGeo, revealDarkMat);
        rev.position.set(wx, FLOOR_H - 0.095, 0);
        fg.add(rev);
      }

      const slabC = new THREE.Mesh(coreSlabGeo, frameMat);
      slabC.position.set(0, FLOOR_H - slabH * 0.5, 0);
      fg.add(slabC);

      const lipC = new THREE.Mesh(coreCorniceLipGeo, frameMat);
      lipC.position.set(0, FLOOR_H - 0.0375, 0);
      fg.add(lipC);

      const revC = new THREE.Mesh(coreRevealBandGeo, revealDarkMat);
      revC.position.set(0, FLOOR_H - 0.095, 0);
      fg.add(revC);

      const slabNorthBay = new THREE.Mesh(northCoreBaySlabGeo, pierMat);
      slabNorthBay.position.set(0, FLOOR_H - slabH * 0.5, -coreD * 0.5 - northBayD * 0.5);
      fg.add(slabNorthBay);

      const lipNorthBay = new THREE.Mesh(northCoreCorniceGeo, frameMat);
      lipNorthBay.position.set(0, FLOOR_H - 0.0375, -coreD * 0.5 - northBayD * 0.5);
      fg.add(lipNorthBay);

      // ====================================================================
      // PAVIMENTO TÉRREO / PILOTIS (f === 1): LOBBY ENVIDRAÇADO MONUMENTAL
      // ====================================================================
      if (f === 1) {
        // Pódio/Soleira de acesso em travertino sob o lobby central
        addScaledBox(fg, 0, 0.03, 0, coreW + 1.1, 0.06, d + 0.5, travertineMat);

        for (const sx of [-1, 1]) {
          const wx = sx * wingX;

          // Núcleo interno do lobby recuado revestido em travertino e madeira ripada vertical
          const innerCoreW = wingW - 1.15;
          const innerCoreD = d - 1.70;
          const lobbyCore = new THREE.Mesh(
            createArchitecturalBoxGeo(innerCoreW, wallBodyH, innerCoreD, 0.25),
            travertineMat
          );
          lobbyCore.position.set(wx, wallBodyH * 0.5, 0);
          fg.add(lobbyCore);

          // Painéis de madeira ripada vertical + sanca suave nas faces visíveis atrás do vidro
          for (const sz of [-1, 1]) {
            const wallZ = sz * (innerCoreD * 0.5 + 0.02);
            const ripPanel = new THREE.Mesh(
              createArchitecturalBoxGeo(innerCoreW * 0.62, wallBodyH * 0.88, 0.04, 0.45),
              woodVertMat
            );
            ripPanel.position.set(wx, wallBodyH * 0.46, wallZ);
            fg.add(ripPanel);

            // Sanca linear arquitetônica suave no topo da parede de destaque
            addScaledBox(fg, wx, wallBodyH - 0.08, wallZ + sz * 0.025, innerCoreW * 0.58, 0.04, 0.03, downlightBezelMat);
          }

          // Pele de vidro piso-teto (Curtain Wall) nas faces Sul, Norte e laterais externas
          const curtainH = wallBodyH - 0.06;
          const curtainY = wallBodyH * 0.5 + 0.01;
          for (const sz of [-1, 1]) {
            const cz = sz * (zFront - 0.40);
            const cW = wingW - 0.32;
            lobbyGlassItems.push({
              geo: unitPlaneGeo,
              x: wx, y: curtainY, z: cz,
              rotY: sz > 0 ? 0 : Math.PI,
              sx: cW, sy: curtainH, sz: 1
            });
            // Montantes verticais finos e travessa superior em alumínio escuro
            addScaledBox(fg, wx, curtainY + curtainH * 0.25, cz - sz * 0.01, cW, 0.032, 0.04, darkMetalMat);
            addScaledBox(fg, wx, 0.04, cz - sz * 0.01, cW, 0.045, 0.06, darkMetalMat);
            for (let mi = -3; mi <= 3; mi++) {
              addScaledBox(fg, wx + (cW / 7) * mi, curtainY, cz - sz * 0.01, 0.036, curtainH, 0.048, darkMetalMat);
            }
          }

          // Cortina de vidro nas laterais externas (±X) do térreo
          const sideCurZ = d - 0.80;
          const sideCurX = sx * (w * 0.5 - 0.14);
          lobbyGlassItems.push({
            geo: unitPlaneGeo,
            x: sideCurX, y: curtainY, z: 0,
            rotY: sx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
            sx: sideCurZ, sy: curtainH, sz: 1
          });
          addScaledBox(fg, sideCurX - sx * 0.01, curtainY + curtainH * 0.25, 0, 0.04, 0.032, sideCurZ, darkMetalMat);
          addScaledBox(fg, sideCurX - sx * 0.01, 0.04, 0, 0.06, 0.045, sideCurZ, darkMetalMat);
          for (let mi = -4; mi <= 4; mi++) {
            addScaledBox(fg, sideCurX - sx * 0.01, curtainY, (sideCurZ / 9) * mi, 0.048, curtainH, 0.036, darkMetalMat);
          }

          // Retorno envidraçado do lobby voltado ao pátio central do H
          const innerCurStart = coreD * 0.5 - 0.05;
          const innerCurEnd = zFront - 0.40;
          const innerCurLen = innerCurEnd - innerCurStart;
          if (innerCurLen > 0.4) {
            const innerCurX = wx - sx * (wingW * 0.5 - 0.16);
            for (const sz of [-1, 1]) {
              const icz = sz * (innerCurStart + innerCurLen * 0.5);
              lobbyGlassItems.push({
                geo: unitPlaneGeo,
                x: innerCurX, y: curtainY, z: icz,
                rotY: sx > 0 ? -Math.PI * 0.5 : Math.PI * 0.5,
                sx: innerCurLen, sy: curtainH, sz: 1
              });
              addScaledBox(fg, innerCurX + sx * 0.01, curtainY + curtainH * 0.25, icz, 0.04, 0.032, innerCurLen, darkMetalMat);
              for (const mz of [-innerCurLen * 0.25, innerCurLen * 0.25]) {
                addScaledBox(fg, innerCurX + sx * 0.01, curtainY, icz + mz, 0.045, curtainH, 0.036, darkMetalMat);
              }
            }
          }

          // Pilares esbeltos do pilotis em travertino com base em bronze e capitel com friso de sombra
          for (const sz of [-1, 1]) {
            const pz = sz * (zFront - 0.34);
            for (const pu of [-cornerPierOff, -balPierOff, balPierOff, cornerPierOff]) {
              const px = wx + sx * pu;
              const isCorner = Math.abs(pu) === cornerPierOff;
              addScaledBox(fg, px, 0.07, pz, 0.38, 0.14, 0.38, darkMetalMat);
              addScaledBox(fg, px, 0.14 + (wallBodyH - 0.18) * 0.5, pz, 0.32, wallBodyH - 0.18, 0.32, travertineMat);
              if (isCorner) {
                // Friso vertical em madeira ripada quente nos pilares de quina do térreo
                addScaledBox(fg, px + sx * (pu > 0 ? 0.17 : -0.17), 0.14 + (wallBodyH - 0.18) * 0.5, pz, 0.04, wallBodyH - 0.22, 0.24, woodVertMat);
              }
              addScaledBox(fg, px, wallBodyH - 0.02, pz, 0.26, 0.04, 0.26, revealDarkMat);
            }
          }
        }

        // Hall Social Central: parede destaque em madeira ripada + travertino + vidro piso-teto
        addScaledBox(fg, 0, wallBodyH * 0.5, 0, coreW * 0.72, wallBodyH, coreD * 0.34, travertineMat);
        addScaledBox(fg, 0, wallBodyH * 0.48, coreD * 0.18, coreW * 0.58, wallBodyH * 0.88, 0.06, woodVertMat);
        addScaledBox(fg, 0, wallBodyH * 0.48, -coreD * 0.18, coreW * 0.58, wallBodyH * 0.88, 0.06, woodVertMat);
        addScaledBox(fg, 0, wallBodyH - 0.07, coreD * 0.21, coreW * 0.54, 0.035, 0.03, downlightBezelMat);

        // Balcão de recepção/concierge e lustre pendente em anel visíveis dentro do lobby
        addScaledBox(fg, 0, 0.22, coreD * 0.32, coreW * 0.42, 0.44, 0.34, travertineMat);
        addScaledBox(fg, 0, 0.45, coreD * 0.32, coreW * 0.44, 0.03, 0.38, woodSoffitMat);
        const lobbyRing = new THREE.Mesh(lobbyRingGeo, downlightBezelMat);
        lobbyRing.position.set(0, wallBodyH - 0.16, coreD * 0.30);
        fg.add(lobbyRing);

        // Cortinas de vidro do lobby central (Sul e Norte) com portas duplas pivotantes
        for (const sz of [-1, 1]) {
          const cz = sz * (coreD * 0.5 - 0.05);
          lobbyGlassItems.push({
            geo: unitPlaneGeo,
            x: 0, y: wallBodyH * 0.5, z: cz,
            rotY: sz > 0 ? 0 : Math.PI,
            sx: coreW - 0.12, sy: wallBodyH - 0.04, sz: 1
          });
          // Montantes das portas pivotantes e travessa
          addScaledBox(fg, 0, wallBodyH * 0.74, cz - sz * 0.01, coreW - 0.10, 0.035, 0.045, darkMetalMat);
          for (const mx of [-coreW * 0.42, -coreW * 0.18, coreW * 0.18, coreW * 0.42]) {
            addScaledBox(fg, mx, wallBodyH * 0.5, cz - sz * 0.01, 0.038, wallBodyH - 0.04, 0.05, darkMetalMat);
          }
          // Puxadores verticais metálicos escovados na porta central
          for (const hx of [-0.07, 0.07]) {
            addScaledBox(fg, hx, 0.48, cz + sz * 0.025, 0.022, 0.42, 0.03, railMetalMat);
          }
        }

        // Marquise Arquitetônica Monumental com Forro em Madeira Quente e Pilares Travertino
        for (const sz of [-1, 1]) {
          const isSouth = sz > 0;
          const startZ = coreD * 0.5 - 0.06;
          const endZ = isSouth ? (zFront + 0.50) : (zFront - 0.22);
          const canopyD = endZ - startZ;
          const canopyZ = sz * (startZ + canopyD * 0.5);
          const canopyW = coreW + 0.14;
          const canopyY = 1.13;

          // Estrutura em travertino/concreto + friso bronze escuro + forro ripado quente + 4 spots LED
          addScaledBox(fg, 0, canopyY, canopyZ, canopyW, 0.11, canopyD, pierMat);
          addScaledBox(fg, 0, canopyY + 0.06, canopyZ, canopyW + 0.04, 0.028, canopyD + 0.06, darkMetalMat);
          addScaledBox(fg, 0, canopyY - 0.058, canopyZ, canopyW - 0.18, 0.036, canopyD - 0.16, woodSoffitMat);

          for (const lx of [-coreW * 0.34, -coreW * 0.11, coreW * 0.11, coreW * 0.34]) {
            const spot = new THREE.Mesh(downlightGeo, downlightBezelMat);
            spot.position.set(lx, canopyY - 0.078, canopyZ);
            fg.add(spot);
          }

          // Pilares portais em travertino claro ladeando a entrada com arandela vertical linear
          for (const pxSide of [-1, 1]) {
            const portX = pxSide * (coreW * 0.5 - 0.04);
            const portZ = sz * (coreD * 0.5 + 0.22);
            addScaledBox(fg, portX, wallBodyH * 0.5, portZ, 0.34, wallBodyH, 0.38, travertineMat);
            addScaledBox(fg, portX, wallBodyH * 0.52, portZ + sz * 0.20, 0.055, 0.44, 0.02, darkMetalMat);
            addScaledBox(fg, portX, wallBodyH * 0.52, portZ + sz * 0.215, 0.024, 0.36, 0.02, downlightBezelMat);
          }

          // Tirantes metálicos finos conectando a marquise à viga do pilotis
          if (isSouth) {
            for (const tx of [-coreW * 0.36, coreW * 0.36]) {
              addScaledBox(fg, tx, canopyY + 0.09, sz * (endZ - 0.35), 0.03, 0.12, 0.03, darkMetalMat);
            }
          }
        }

        // Aleta estrutural central em travertino nas extremidades do hall
        const cSpine = new THREE.Mesh(centerSpineFinGeo, pierMat);
        cSpine.position.set(0, FLOOR_H * 0.5, 0);
        fg.add(cSpine);

        // Halo discreto sob a marquise principal (suave, sem vazar para os gramados)
        if (mats.floorLightHalo) {
          const lobbyHalo = new THREE.Mesh(haloPlaneGeo, mats.floorLightHalo);
          lobbyHalo.position.set(0, 0.065, zFront - 0.75);
          fg.add(lobbyHalo);
          nightLightObjects.push(lobbyHalo);
        }
      } else {
        // ==================================================================
        // PAVIMENTOS TIPO (f >= 2): FACHADAS DE ALTA DEFINIÇÃO
        // ==================================================================
        for (const sx of [-1, 1]) {
          const wx = sx * wingX;
          const body = new THREE.Mesh(wingCoreGeo, wallBodyMat);
          body.position.set(wx, wallBodyH * 0.5, 0);
          fg.add(body);

          // Fachadas Norte (-1) e Sul (+1) de cada Asa
          for (const sz of [-1, 1]) {
            const facingNS = sz > 0 ? 'S' : 'N';
            const pierZ = sz * (zFront - 0.39);
            const finZ = sz * (zFront - 0.38);

            // Determinismo coerente por unidade: ~30% suavemente aquecidos, ~70% sombreados
            const uHash = unitHash(tIdx, f, sx, sz);
            const isUnitLit = (uHash % 10) < 3;
            const livingMat = isUnitLit
              ? warmIntMats[uHash % warmIntMats.length]
              : shadedIntMats[uHash % shadedIntMats.length];
            const bed1Mat = isUnitLit
              ? warmIntMats[(uHash + 1) % warmIntMats.length]
              : shadedIntMats[(uHash + 1) % shadedIntMats.length];
            const bed2Mat = (isUnitLit && ((uHash >> 4) % 4) !== 0)
              ? warmIntMats[(uHash + 2) % warmIntMats.length]
              : shadedIntMats[(uHash + 2) % shadedIntMats.length];

            // 1. Pilastras das Varandas Gourmet com revestimento vertical em travertino claro
            for (const side of [-1, 1]) {
              const bx = wx + side * balPierOff;
              const bp = new THREE.Mesh(balPierGeo, frameMat);
              bp.position.set(bx, FLOOR_H * 0.5, pierZ);
              fg.add(bp);

              const bpFin = new THREE.Mesh(balPierFinGeo, frameMat);
              bpFin.position.set(bx, FLOOR_H * 0.5, finZ + sz * 0.05);
              fg.add(bpFin);
            }

            // 2. Pilastras de quina (externa e interna ao pátio) com painéis verticais em madeira ripada quente
            for (const pu of [cornerPierOff, -cornerPierOff]) {
              const px = wx + sx * pu;
              const cp = new THREE.Mesh(cornerPierGeo, frameMat);
              cp.position.set(px, FLOOR_H * 0.5, pierZ);
              fg.add(cp);

              const cpFin = new THREE.Mesh(cornerPierFinGeo, boulevard ? graphiteMat : travertineMat);
              cpFin.position.set(px, FLOOR_H * 0.5, finZ + sz * 0.05);
              fg.add(cpFin);
            }

            // 3. Vãos arquitetônicos recuados em grafite (Suíte Externa e Dormitório Interno)
            const outerBayX = wx + sx * bayCenterOff;
            const innerBayX = wx - sx * bayCenterOff;
            const spandrelZ = sz * (zFront - 0.44);
            const winFaceZ = sz * (zFront - 0.11);

            for (const [bx, wMat, transom] of [
              [outerBayX, bed1Mat, 0.24],
              [innerBayX, bed2Mat, 0.28]
            ]) {
              const spBot = new THREE.Mesh(baySpandrelBotGeo, insetPanelMat);
              spBot.position.set(bx, sillH * 0.5, spandrelZ);
              fg.add(spBot);

              const spTop = new THREE.Mesh(baySpandrelTopGeo, insetPanelMat);
              spTop.position.set(bx, wallBodyH - lintelH * 0.5, spandrelZ);
              fg.add(spTop);

              const spFill = new THREE.Mesh(bayInnerFillGeo, graphiteMat);
              spFill.position.set(bx, sillH + winOpenH * 0.5, sz * (zFront - 0.56));
              fg.add(spFill);

              addRecessedWindow(fg, windowGlassItems, {
                cx: bx,
                cy: sillH + winOpenH * 0.5,
                cz: winFaceZ,
                winW: baySpanW - 0.06,
                winH: winOpenH - 0.02,
                facing: facingNS,
                recessDepth: 0.16,
                glassOffset: 0.06,
                panesX: 2,
                transomFrac: transom,
                interiorMat: wMat,
                withSill: true
              });
            }

            // 4. Varanda Gourmet aprofundada (Loggia c/ piso, viga, forro ripado, spots, guarda-corpo e porta)
            const balconyRotation = sz > 0 ? 0 : Math.PI;
            const balTile = new THREE.Mesh(balTileGeo, balconyTileMat);
            balTile.position.set(wx, 0.21, sz * (zFront - 0.37));
            balTile.rotation.y = balconyRotation;
            fg.add(balTile);

            const balZ = sz * (zFront - 0.02);
            const fascia = new THREE.Mesh(balFasciaGeo, pierMat);
            fascia.position.set(wx, 0.11, balZ);
            fascia.rotation.y = balconyRotation;
            fg.add(fascia);

            const fasciaLip = new THREE.Mesh(balFasciaLipGeo, pierMat);
            fasciaLip.position.set(wx, 0.19, sz * (zFront + 0.02));
            fasciaLip.rotation.y = balconyRotation;
            fg.add(fasciaLip);

            const groove = new THREE.Mesh(balGrooveGeo, revealDarkMat);
            groove.position.set(wx, 0.145, balZ + sz * 0.01);
            groove.rotation.y = balconyRotation;
            fg.add(groove);

            const soffit = new THREE.Mesh(balSoffitGeo, woodSoffitMat);
            soffit.position.set(wx, wallBodyH - 0.035, sz * (zFront - 0.36));
            fg.add(soffit);

            // Dois spots embutidos sutis no forro de madeira
            for (const lx of [-balW * 0.24, balW * 0.24]) {
              const spot = new THREE.Mesh(downlightGeo, downlightBezelMat);
              spot.position.set(wx + lx, wallBodyH - 0.072, sz * (zFront - 0.32));
              fg.add(spot);
            }

            // Guarda-corpo em vidro laminado + sapata metálica + corrimão escovado + montantes
            const railZ = sz * (zFront + 0.03);
            const railY = 0.24 + FLOOR_H * 0.205;

            const shoe = new THREE.Mesh(railShoeGeo, darkMetalMat);
            shoe.position.set(wx, 0.24, railZ);
            shoe.rotation.y = balconyRotation;
            fg.add(shoe);

            balconyGlassItems.push({
              geo: glassRailBoxGeo,
              x: wx, y: railY, z: railZ,
              rotY: balconyRotation, sx: 1, sy: 1, sz: 1
            });

            const handrail = new THREE.Mesh(handrailTopGeo, railMetalMat);
            handrail.position.set(wx, 0.24 + FLOOR_H * 0.415, railZ);
            handrail.rotation.y = balconyRotation;
            fg.add(handrail);

            for (const rpx of [-balW * 0.34, 0, balW * 0.34]) {
              const rPost = new THREE.Mesh(railPostGeo, darkMetalMat);
              rPost.position.set(wx + rpx, railY, railZ - sz * balconySetback(rpx, balW, balconyInset));
              fg.add(rPost);
            }

            // Porta-janela panorâmica de 4 folhas recuada no fundo da Varanda Gourmet
            addRecessedWindow(fg, windowGlassItems, {
              cx: wx,
              cy: 0.24 + (wallBodyH - 0.28) * 0.5,
              cz: sz * (zFront - 0.68),
              winW: balW - 0.08,
              winH: wallBodyH - 0.30,
              facing: facingNS,
              recessDepth: 0.10,
              glassOffset: 0.03,
              panesX: 4,
              transomFrac: 0,
              interiorMat: livingMat,
              withSill: false
            });

            // Floreira linear na varanda em andares rítmicos + mobiliário de estar externo
            if (f % 3 === 0) {
              addPlanterStrip(
                fg,
                wx + sx * (balW * 0.27),
                0.24,
                sz * (zFront - 0.35),
                balW * 0.36,
                0.22,
                0.20,
                false,
                tIdx * 11 + f
              );
              addScaledBox(fg, wx - sx * (balW * 0.24), 0.38, sz * (zFront - 0.34), 0.46, 0.28, 0.36, balconyFurnMat);
            } else {
              addScaledBox(fg, wx + sx * (balW * 0.22), 0.38, sz * (zFront - 0.34), 0.48, 0.28, 0.38, balconyFurnMat);
            }
          }

          // ----------------------------------------------------------------
          // EMPENAS LATERAIS EXTERNAS (±X): PILASTRAS + 2 VÃOS DE SUÍTE + BANHO/BRISE
          // ----------------------------------------------------------------
          const sideFaceX = sx * (w * 0.5 + 0.03);
          const spandrelMidX = sx * (w * 0.5 - 0.07);
          const facingEW = sx > 0 ? 'E' : 'W';

          // 4 pilastras verticais escalonadas ao longo da empena lateral (quinas em ripado + centrais em travertino)
          for (const pz of [-(sideSpan - 0.16), -1.16, 1.16, sideSpan - 0.16]) {
            const isOuterPil = Math.abs(pz) > 2.0;
            const sp = new THREE.Mesh(sidePilGeo, isOuterPil ? frameMat : insetPanelMat);
            sp.position.set(sx * (w * 0.5 + 0.02), FLOOR_H * 0.5, pz);
            fg.add(sp);

            const spf = new THREE.Mesh(sidePilFinGeo, isOuterPil ? frameMat : insetPanelMat);
            spf.position.set(sx * (w * 0.5 + 0.06), FLOOR_H * 0.5, pz);
            fg.add(spf);
          }

          // 2 vãos amplos de janela de suíte/dormitório (±Z) coerentes com o apto Norte/Sul
          for (const wz of [-sideBayCenterZ, sideBayCenterZ]) {
            const sBot = new THREE.Mesh(sideSpandrelBotGeo, graphiteMat);
            sBot.position.set(spandrelMidX, sillH * 0.5, wz);
            fg.add(sBot);

            const sTop = new THREE.Mesh(sideSpandrelTopGeo, graphiteMat);
            sTop.position.set(spandrelMidX, wallBodyH - lintelH * 0.5, wz);
            fg.add(sTop);

            // Ombreiras laterais do vão grafite deixando o nicho da janela aberto até wingCore
            const flankHalfSpan = Math.max(0.12, (sideBayTotalW - sideWinW) * 0.5);
            for (const fzSide of [-1, 1]) {
              addScaledBox(
                fg,
                spandrelMidX,
                sillH + winOpenH * 0.5,
                wz + fzSide * (sideWinW * 0.5 + flankHalfSpan * 0.5),
                0.22, winOpenH, flankHalfSpan,
                graphiteMat
              );
            }

            const aptSideHash = unitHash(tIdx, f, sx, wz > 0 ? 1 : -1);
            const aptSideLit = (aptSideHash % 10) < 3;
            const sInt = aptSideLit
              ? warmIntMats[(aptSideHash + 1) % warmIntMats.length]
              : shadedIntMats[(aptSideHash + 2) % shadedIntMats.length];

            addRecessedWindow(fg, windowGlassItems, {
              cx: sideFaceX,
              cy: sillH + winOpenH * 0.5,
              cz: wz,
              winW: sideWinW,
              winH: winOpenH - 0.02,
              facing: facingEW,
              recessDepth: 0.14,
              glassOffset: 0.055,
              panesX: 3,
              transomFrac: 0.25,
              interiorMat: sInt,
              withSill: true
            });
          }

          // Preenchimentos brancos laterais entre o vão central e os vãos de dormitório
          const gapInnerZ = (1.37 + (sideBayCenterZ - sideBayTotalW * 0.5)) * 0.5;
          const gapInnerLen = Math.max(0.15, (sideBayCenterZ - sideBayTotalW * 0.5) - 1.37);
          const gapOuterZ = ((sideBayCenterZ + sideBayTotalW * 0.5) + (sideSpan - 0.37)) * 0.5;
          const gapOuterLen = Math.max(0.15, (sideSpan - 0.37) - (sideBayCenterZ + sideBayTotalW * 0.5));
          for (const sz of [-1, 1]) {
            addScaledBox(fg, spandrelMidX, wallBodyH * 0.5, sz * gapInnerZ, 0.20, wallBodyH, gapInnerLen, wallBodyMat);
            addScaledBox(fg, spandrelMidX, wallBodyH * 0.5, sz * gapOuterZ, 0.20, wallBodyH, gapOuterLen, wallBodyMat);
          }

          // Faixa de revestimento que acompanha a prumada de serviço.
          const serviceJambW = 0.52;
          for (const sign of [-1, 1]) {
            addScaledBox(fg, sx * (w * 0.5 + 0.035), FLOOR_H * 0.5,
              sign * (0.98 + serviceJambW * 0.5), 0.10, FLOOR_H, serviceJambW, insetPanelMat);
          }

          // Vão central da empena lateral: spandrels + janela superior do banheiro + brise inferior de AC
          addScaledBox(fg, spandrelMidX, 0.10, 0, 0.22, 0.20, 1.90, insetPanelMat);
          addScaledBox(fg, spandrelMidX, 0.625, 0, 0.22, 0.13, 1.90, insetPanelMat);
          addScaledBox(fg, spandrelMidX, 1.17, 0, 0.22, 0.12, 1.90, insetPanelMat);
          for (const jz of [-0.79, 0.79]) {
            addScaledBox(fg, spandrelMidX, 0.655, jz, 0.22, 0.91, 0.33, insetPanelMat);
          }

          addRecessedWindow(fg, windowGlassItems, {
            cx: sideFaceX,
            cy: 0.90,
            cz: 0,
            winW: 1.24,
            winH: 0.42,
            facing: facingEW,
            recessDepth: 0.14,
            glassOffset: 0.055,
            panesX: 2,
            transomFrac: 0,
            interiorMat: shadedIntMats[(f + tIdx) % shadedIntMats.length],
            withSill: true
          });

          addBriseGrille(fg, {
            cx: sideFaceX,
            cy: 0.38,
            cz: 0,
            w: 1.24,
            h: 0.36,
            facing: facingEW,
            slats: 4,
            depth: 0.12
          });

          // ----------------------------------------------------------------
          // PAREDES INTERNAS DO RECUO H (Serviço/Cozinha + Brise de Condensadora)
          // ----------------------------------------------------------------
          const innerWallX = wx - sx * (wingW * 0.5 - 0.04);
          const facingCourtyard = sx > 0 ? 'W' : 'E';
          const recessMidZ = coreD * 0.5 + (zFront - 0.82 - coreD * 0.5) * 0.5;
          if (zFront - 0.82 - coreD * 0.5 > 1.5) {
            for (const sz of [-1, 1]) {
              const briseZ = sz * (coreD * 0.5 + 0.54);
              const servZ = sz * (recessMidZ + 0.52);
              const innerJambX = wx - sx * (wingW * 0.5 - 0.11);

              // Arremates delimitando os nichos de brise e janela de serviço sem oclusão
              addScaledBox(fg, innerJambX, 0.165, briseZ, 0.14, 0.33, 0.88, graphiteMat);
              addScaledBox(fg, innerJambX, 1.09, briseZ, 0.14, 0.28, 0.88, graphiteMat);
              addScaledBox(fg, innerJambX, 0.225, servZ, 0.14, 0.45, 0.88, wallBodyMat);
              addScaledBox(fg, innerJambX, 1.11, servZ, 0.14, 0.24, 0.88, wallBodyMat);

              addBriseGrille(fg, {
                cx: innerWallX,
                cy: 0.64,
                cz: briseZ,
                w: 0.78,
                h: 0.62,
                facing: facingCourtyard,
                slats: 5,
                depth: 0.09
              });
              const servHash = unitHash(tIdx, f, sx, sz);
              const servLit = (servHash % 10) < 3 && ((servHash >> 5) % 2) === 0;
              addRecessedWindow(fg, windowGlassItems, {
                cx: innerWallX,
                cy: 0.72,
                cz: servZ,
                winW: 0.78,
                winH: 0.54,
                facing: facingCourtyard,
                recessDepth: 0.10,
                glassOffset: 0.04,
                panesX: 2,
                transomFrac: 0,
                interiorMat: servLit
                  ? warmIntMats[servHash % warmIntMats.length]
                  : shadedIntMats[(f + (sz > 0 ? 1 : 0)) % shadedIntMats.length],
                withSill: true
              });
            }
          }
        }

        // ------------------------------------------------------------------
        // NÚCLEO CENTRAL EM GRAFITE + ALETA ESPINHAL + HALL / ESCADA / BRISES
        // ------------------------------------------------------------------
        const cBridge = new THREE.Mesh(centerBridgeGeo, graphiteMat);
        cBridge.position.set(0, wallBodyH * 0.5, 0);
        fg.add(cBridge);

        const nShaft = new THREE.Mesh(northStairShaftGeo, wallBodyMat);
        nShaft.position.set(0, wallBodyH * 0.5, -coreD * 0.5 - (northBayD - 0.14) * 0.5);
        fg.add(nShaft);

        const cSpine = new THREE.Mesh(centerSpineFinGeo, pierMat);
        cSpine.position.set(0, FLOOR_H * 0.5, 0);
        fg.add(cSpine);

        const cSpineStep = new THREE.Mesh(centerSpineStepGeo, pierMat);
        cSpineStep.position.set(0, FLOOR_H * 0.5, 0);
        fg.add(cSpineStep);

        // Janelas recuadas do hall social (face Sul do núcleo) com peitoril/verga/ombreiras em grafite
        const hallFaceZ = coreD * 0.5 - 0.06;
        const hallWinH = wallBodyH * 0.62;
        const hallWinY = 0.68;
        const hallSpandrelZ = coreD * 0.5 - 0.15;
        const hallWinW = coreW * 0.26;
        const hallCenterOff = coreW * 0.27;
        addScaledBox(fg, 0, (hallWinY - hallWinH * 0.5) * 0.5, hallSpandrelZ, coreW + 0.06, hallWinY - hallWinH * 0.5, 0.18, graphiteMat);
        addScaledBox(fg, 0, (wallBodyH + hallWinY + hallWinH * 0.5) * 0.5, hallSpandrelZ, coreW + 0.06, wallBodyH - (hallWinY + hallWinH * 0.5), 0.18, graphiteMat);
        // Ombreiras entre a aleta central e as janelas, e entre as janelas e as asas
        const innerPierX = (0.18 + (hallCenterOff - hallWinW * 0.5)) * 0.5;
        const innerPierW = Math.max(0.08, (hallCenterOff - hallWinW * 0.5) - 0.18);
        const outerCorePierX = ((hallCenterOff + hallWinW * 0.5) + coreW * 0.5) * 0.5;
        const outerCorePierW = Math.max(0.08, coreW * 0.5 - (hallCenterOff + hallWinW * 0.5));
        for (const sx of [-1, 1]) {
          addScaledBox(fg, sx * innerPierX, hallWinY, hallSpandrelZ, innerPierW, hallWinH, 0.18, graphiteMat);
          addScaledBox(fg, sx * outerCorePierX, hallWinY, hallSpandrelZ, outerCorePierW, hallWinH, 0.18, graphiteMat);
          // Fechamento lateral do núcleo na face Norte fora do poço da escada
          addScaledBox(fg, sx * (coreW * 0.44), wallBodyH * 0.5, -coreD * 0.5 + 0.14, coreW * 0.14, wallBodyH, 0.18, graphiteMat);
        }
        for (const cx of [-hallCenterOff, hallCenterOff]) {
          addRecessedWindow(fg, windowGlassItems, {
            cx,
            cy: hallWinY,
            cz: hallFaceZ,
            winW: hallWinW,
            winH: hallWinH,
            facing: 'S',
            recessDepth: 0.12,
            glassOffset: 0.045,
            panesX: 2,
            transomFrac: 0.30,
            interiorMat: (f % 3 === 0) ? warmIntMats[f % warmIntMats.length] : shadedIntMats[(f + 1) % shadedIntMats.length],
            withSill: true
          });
        }

        // Emolduramento da escadaria Norte + janela recuada + brises laterais do poço técnico
        const northFaceZ = -coreD * 0.5 - northBayD + 0.02;
        const nWinH = wallBodyH * 0.44;
        const nWinW = coreW * 0.46;
        const nWinY = 0.72;
        addScaledBox(fg, 0, (nWinY - nWinH * 0.5) * 0.5, northFaceZ + 0.06, coreW * 0.76, nWinY - nWinH * 0.5, 0.14, wallBodyMat);
        addScaledBox(fg, 0, (wallBodyH + nWinY + nWinH * 0.5) * 0.5, northFaceZ + 0.06, coreW * 0.76, wallBodyH - (nWinY + nWinH * 0.5), 0.14, wallBodyMat);
        for (const side of [-1, 1]) {
          const jambW = (coreW * 0.76 - nWinW) * 0.5;
          addScaledBox(fg, side * (nWinW * 0.5 + jambW * 0.5), nWinY, northFaceZ + 0.06, jambW, nWinH, 0.14, wallBodyMat);
        }

        addRecessedWindow(fg, windowGlassItems, {
          cx: 0,
          cy: nWinY,
          cz: northFaceZ,
          winW: nWinW,
          winH: nWinH,
          facing: 'N',
          recessDepth: 0.10,
          glassOffset: 0.04,
          panesX: 3,
          transomFrac: 0,
          interiorMat: shadedIntMats[f % shadedIntMats.length],
          withSill: true
        });
        for (const bx of [-1, 1]) {
          addBriseGrille(fg, {
            cx: bx * (coreW * 0.38 - 0.01),
            cy: 0.68,
            cz: -coreD * 0.5 - northBayD * 0.48,
            w: northBayD * 0.66,
            h: 0.54,
            facing: bx > 0 ? 'E' : 'W',
            slats: 4,
            depth: 0.09
          });
        }
      }

      // Funde todas as lâminas de vidro deste pavimento (1 draw call por material/andar)
      const mergedWinGlass = mergeGlassBatch(windowGlassItems, windowGlassMat, 1);
      if (mergedWinGlass) fg.add(mergedWinGlass);

      const mergedLobbyGlass = mergeGlassBatch(lobbyGlassItems, lobbyGlassMat, 1);
      if (mergedLobbyGlass) fg.add(mergedLobbyGlass);

      const mergedBalGlass = mergeGlassBatch(balconyGlassItems, glassBalcony, 2);
      if (mergedBalGlass) fg.add(mergedBalGlass);

      tGroup.add(fg);
      floorMeshes.push(fg);
    }

    // ----------------------------------------------------------------------
    // COBERTURA DA TORRE (CORNIJAS ESCALONADAS, PÉRGOLAS, FLOREIRAS E BRISES TÉCNICOS)
    // ----------------------------------------------------------------------
    const roofGroup = new THREE.Group();
    roofGroup.position.y = BASE_Y + cfg.floors * FLOOR_H;

    // 1. Lajes em placas de concreto arquitetônico nas duas asas e núcleo
    const rWingGeo = createArchitecturalBoxGeo(wingW, 0.26, d, 0.20);
    const rLeft = new THREE.Mesh(rWingGeo, roofSlabMat);
    rLeft.position.set(-wingX, 0.13, 0);
    roofGroup.add(rLeft);

    const rRight = new THREE.Mesh(rWingGeo, roofSlabMat);
    rRight.position.set(wingX, 0.13, 0);
    roofGroup.add(rRight);

    const rCore = new THREE.Mesh(createArchitecturalBoxGeo(coreW + 0.34, 0.26, coreD + 0.44, 0.20), roofSlabMat);
    rCore.position.set(0, 0.13, 0);
    roofGroup.add(rCore);

    const rNorthCap = new THREE.Mesh(createArchitecturalBoxGeo(coreW * 0.80, 0.26, northBayD + 0.1, 0.20), roofSlabMat);
    rNorthCap.position.set(0, 0.13, -coreD * 0.5 - northBayD * 0.5);
    roofGroup.add(rNorthCap);

    // 2. Platibandas perimetrais brancas em H com friso escuro + cornija superior saliente
    const paraH = 0.88;
    const paraThick = 0.28;
    const recessDepth = (d - coreD) * 0.5;

    for (const sx of [-1, 1]) {
      const wx = sx * wingX;

      // Muretas Norte e Sul da Asa com cornija escalonada
      for (const sz of [-1, 1]) {
        const pz = sz * zFront;
        addScaledBox(roofGroup, wx, paraH * 0.5, pz, wingW + 0.22, paraH, paraThick, frameMat);
        addScaledBox(roofGroup, wx, paraH - 0.04, pz, wingW + 0.24, 0.045, paraThick + 0.02, revealDarkMat);
        addScaledBox(roofGroup, wx, paraH + 0.05, pz, wingW + 0.38, 0.10, paraThick + 0.14, pierMat);
      }

      // Mureta Lateral Externa (±X)
      const ox = sx * (w * 0.5);
      addScaledBox(roofGroup, ox, paraH * 0.5, 0, paraThick, paraH, d + 0.22, frameMat);
      addScaledBox(roofGroup, ox, paraH - 0.04, 0, paraThick + 0.02, 0.045, d + 0.24, revealDarkMat);
      addScaledBox(roofGroup, ox, paraH + 0.05, 0, paraThick + 0.14, 0.10, d + 0.38, pierMat);

      // Pilares de remate elevados nos 4 cantos externos do H
      for (const sz of [-1, 1]) {
        addScaledBox(roofGroup, ox, paraH * 0.5 + 0.08, sz * zFront, 0.44, paraH + 0.24, 0.44, pierMat);
      }

      // Muretas Internas do Recuo H (Norte e Sul)
      for (const sz of [-1, 1]) {
        const iz = sz * (coreD * 0.5 + recessDepth * 0.5);
        const ix = wx - sx * (wingW * 0.5);
        addScaledBox(roofGroup, ix, paraH * 0.5, iz, paraThick, paraH, recessDepth + 0.22, pierMat);
        addScaledBox(roofGroup, ix, paraH + 0.04, iz, paraThick + 0.10, 0.08, recessDepth + 0.28, pierMat);
      }

      // 3. Claraboias técnicas nos cantos internos Norte de cada asa (alinhadas fora do barrilete)
      const gridW = wingW * 0.28;
      const gridD = d * 0.13;
      const gridX = sx * (wingX + wingW * 0.10);
      const gridZ = -d * 0.34;
      addScaledBox(roofGroup, gridX, 0.24, gridZ, gridW, 0.36, gridD, pierMat);
      addScaledBox(roofGroup, gridX, 0.38, gridZ, gridW - 0.16, 0.10, gridD - 0.16, skylightGlassMat);
      for (let gx = -1; gx <= 1; gx++) {
        addScaledBox(roofGroup, gridX + gx * (gridW * 0.24), 0.43, gridZ, 0.05, 0.04, gridD - 0.14, darkMetalMat);
      }

      // 4. Pérgolas arquitetônicas e Terraços ajardinados na Cobertura (Norte e Sul)
      // Deck amadeirado do terraço Sul da cobertura
      const deckW = wingW * 0.64;
      const deckD = d * 0.21;
      const deckZ = d * 0.30;
      const roofDeck = new THREE.Mesh(
        createArchitecturalBoxGeo(deckW, 0.05, deckD, 0.35),
        woodSoffitMat
      );
      roofDeck.position.set(wx, 0.28, deckZ);
      roofGroup.add(roofDeck);

      // Pérgola Sul: vigas laterais + pilares + 10 aletas (fins) paralelas de sombreamento
      const pergW = wingW * 0.72;
      const pergD = d * 0.22;
      const pergZ = d * 0.31;
      const pergY = paraH + 0.30;
      for (const pzSide of [-1, 1]) {
        addScaledBox(roofGroup, wx, pergY, pergZ + pzSide * (pergD * 0.46), pergW, 0.12, 0.14, pierMat);
        for (const pxSide of [-1, 1]) {
          addScaledBox(
            roofGroup,
            wx + pxSide * (pergW * 0.46),
            0.26 + (pergY - 0.26) * 0.5,
            pergZ + pzSide * (pergD * 0.46),
            0.14, pergY - 0.26, 0.14,
            pierMat
          );
        }
      }
      const finCount = 10;
      for (let fi = 0; fi < finCount; fi++) {
        const fx = wx - pergW * 0.42 + (pergW * 0.84 * fi) / (finCount - 1);
        addScaledBox(roofGroup, fx, pergY + 0.02, pergZ, 0.065, 0.15, pergD, woodSoffitMat);
      }

      // Pérgola compacta no bordo Norte externo (fora da claraboia)
      const nPergW = wingW * 0.36;
      const nPergX = sx * (wingX + wingW * 0.22);
      const nPergZ = -d * 0.43;
      for (const pzSide of [-1, 1]) {
        addScaledBox(roofGroup, nPergX, pergY, nPergZ + pzSide * 0.55, nPergW, 0.10, 0.12, pierMat);
        for (const pxSide of [-1, 1]) {
          addScaledBox(
            roofGroup,
            nPergX + pxSide * (nPergW * 0.44),
            0.26 + (pergY - 0.26) * 0.5,
            nPergZ + pzSide * 0.55,
            0.12, pergY - 0.26, 0.12,
            pierMat
          );
        }
      }
      for (let fi = 0; fi < 5; fi++) {
        const fx = nPergX - nPergW * 0.40 + (nPergW * 0.80 * fi) / 4;
        addScaledBox(roofGroup, fx, pergY + 0.01, nPergZ, 0.06, 0.13, 1.22, darkMetalMat);
      }

      // Floreiras lineares paisagísticas na cobertura (borda Sul, lateral externa e recuo H)
      addPlanterStrip(roofGroup, wx, 0.26, zFront - 0.40, wingW * 0.72, 0.44, 0.32, false, tIdx * 31 + sx * 5);
      addPlanterStrip(roofGroup, sx * (w * 0.5 - 0.44), 0.26, d * 0.04, 0.44, d * 0.24, 0.32, true, tIdx * 43 + sx * 7);
    }

    // Ponte de pérgola central conectando os terraços das duas asas sobre o núcleo Sul
    const bridgePergW = coreW + 0.4;
    const bridgePergZ = coreD * 0.36;
    const bridgePergY = paraH + 0.30;
    for (const pzSide of [-1, 1]) {
      addScaledBox(roofGroup, 0, bridgePergY, bridgePergZ + pzSide * 0.75, bridgePergW, 0.12, 0.14, pierMat);
      for (const pxSide of [-1, 1]) {
        addScaledBox(
          roofGroup,
          pxSide * (bridgePergW * 0.46),
          0.26 + (bridgePergY - 0.26) * 0.5,
          bridgePergZ + pzSide * 0.75,
          0.12, bridgePergY - 0.26, 0.12,
          pierMat
        );
      }
    }
    for (let fi = 0; fi < 6; fi++) {
      const fx = -bridgePergW * 0.42 + (bridgePergW * 0.84 * fi) / 5;
      addScaledBox(roofGroup, fx, bridgePergY + 0.02, bridgePergZ, 0.065, 0.15, 1.62, woodSoffitMat);
    }
    addPlanterStrip(roofGroup, 0, 0.26, coreD * 0.46, coreW * 0.82, 0.42, 0.30, false, tIdx * 17);

    // 5. Volume Central Escalonado com Fechamento em Brises Técnicos (Barrilete + Reservatório)
    const outerPentW = w * 0.44;
    const outerPentD = d * 0.48;
    const outerPentH = 1.46;
    const outerPentZ = -d * 0.09;

    // Núcleo escuro recuado + pilares de canto brancos + cornija superior
    addScaledBox(roofGroup, 0, outerPentH * 0.5, outerPentZ, outerPentW - 0.24, outerPentH, outerPentD - 0.24, revealDarkMat);
    for (const cx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        addScaledBox(
          roofGroup,
          cx * (outerPentW * 0.5 - 0.22),
          outerPentH * 0.5,
          outerPentZ + cz * (outerPentD * 0.5 - 0.22),
          0.44, outerPentH, 0.44,
          pierMat
        );
      }
    }
    // Laje/cornija superior do barrilete com pingadeira e friso de sombra
    addScaledBox(roofGroup, 0, outerPentH - 0.05, outerPentZ, outerPentW + 0.08, 0.06, outerPentD + 0.08, revealDarkMat);
    addScaledBox(roofGroup, 0, outerPentH + 0.04, outerPentZ, outerPentW + 0.24, 0.12, outerPentD + 0.24, pierMat);

    // Fechamento perimetral em brises horizontais ao redor do barrilete (4 faces)
    const louverSpanX = outerPentW - 0.88;
    const louverSpanZ = outerPentD - 0.88;
    for (let si = 0; si < 5; si++) {
      const ly = 0.26 + si * 0.22;
      for (const sz of [-1, 1]) {
        addScaledBox(roofGroup, 0, ly, outerPentZ + sz * (outerPentD * 0.5 - 0.08), louverSpanX, 0.045, 0.08, mullionMat);
      }
      for (const sx of [-1, 1]) {
        addScaledBox(roofGroup, sx * (outerPentW * 0.5 - 0.08), ly, outerPentZ, 0.08, 0.045, louverSpanZ, mullionMat);
      }
    }

    // Volume superior central (Caixa d'Água / Casa de Máquinas) com pilastras e faixa de brises
    const topBoxW = w * 0.27;
    const topBoxD = d * 0.34;
    const topBoxH = 2.38;
    const topBoxZ = -d * 0.06;

    const mechTopBox = new THREE.Mesh(
      createArchitecturalBoxGeo(topBoxW, topBoxH, topBoxD, 0.25),
      roofPenthouseMat
    );
    mechTopBox.position.set(0, topBoxH * 0.5, topBoxZ);
    roofGroup.add(mechTopBox);

    // Pilastras brancas nos cantos e faixas de ventilação em brise no terço superior
    for (const cx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        addScaledBox(
          roofGroup,
          cx * (topBoxW * 0.5 - 0.12),
          topBoxH * 0.5,
          topBoxZ + cz * (topBoxD * 0.5 - 0.12),
          0.32, topBoxH, 0.32,
          pierMat
        );
      }
    }
    for (let si = 0; si < 4; si++) {
      const ly = topBoxH - 0.62 + si * 0.12;
      for (const sz of [-1, 1]) {
        addScaledBox(roofGroup, 0, ly, topBoxZ + sz * (topBoxD * 0.5 + 0.02), topBoxW * 0.68, 0.035, 0.06, darkMetalMat);
      }
      for (const sx of [-1, 1]) {
        addScaledBox(roofGroup, sx * (topBoxW * 0.5 + 0.02), ly, topBoxZ, 0.06, 0.035, topBoxD * 0.68, darkMetalMat);
      }
    }

    // Cornija superior do reservatório com friso escuro de sombra
    addScaledBox(roofGroup, 0, topBoxH - 0.03, topBoxZ, topBoxW + 0.10, 0.05, topBoxD + 0.10, revealDarkMat);
    addScaledBox(roofGroup, 0, topBoxH + 0.06, topBoxZ, topBoxW + 0.34, 0.13, topBoxD + 0.34, pierMat);

    tGroup.add(roofGroup);

    towersMap.set(cfg.id, {
      group: tGroup,
      floorMeshes,
      roofGroup
    });
  }

  return towersMap;
}

// --------------------------------------------------------------------------
// 2. PLANTA HUMANIZADA 3D EM FORMATO "H" (4 APARTAMENTOS POR ANDAR + NÚCLEO)
// 100% Fiel à Prancha 1 ("Planta Baixa Geral" e quadro "Torres Planta Tipo")
// --------------------------------------------------------------------------

export function createHShapedFloorPlan3D(w, d, h) {
  const plan = new THREE.Group();
  const wallH = h * 0.72;
  const wingW = w * 0.41;
  const coreW = w - wingW * 2;
  const coreD = d * 0.64;
  const wingX = (w - wingW) * 0.5;

  // Cores exatas da Legenda "Torres (Planta Tipo)" da Prancha 1:
  // - Suíte / Dormitório: #c9a679
  // - Banheiro Social / Suíte: #b8c7d1
  // - Sala de Estar/Jantar: #dfd3c3
  // - Cozinha/Serviço: #c7beb5
  // - Varanda Gourmet: #e5dec9
  const suiteWoodMat = new THREE.MeshStandardMaterial({
    map: getWoodPlankFloorTexture(),
    color: 0xd8b88c,
    roughness: 0.52
  });
  const bathTileMat = new THREE.MeshStandardMaterial({ color: 0xb8c7d1, roughness: 0.35 });
  const livingPorcMat = new THREE.MeshStandardMaterial({ color: 0xdfd3c3, roughness: 0.42 });
  const kitchenMat = new THREE.MeshStandardMaterial({ color: 0xc7beb5, roughness: 0.48 });
  const balconyMat = new THREE.MeshStandardMaterial({ color: 0xe5dec9, roughness: 0.50 });
  const hallCoreMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.55 });
  const northTerraceMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 });

  // Paredes brancas com topo cinza-chumbo (#18181b) idênticas ao corte técnico da Prancha 1
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const wallCapMat = new THREE.MeshBasicMaterial({ color: 0x18181b });

  // Materiais de mobiliário 3D detalhado
  const bedSheetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.40 });
  const blanketSuiteMat = new THREE.MeshStandardMaterial({ color: 0xb4845c, roughness: 0.58 });
  const blanketDormMat = new THREE.MeshStandardMaterial({ color: 0xc2956e, roughness: 0.58 });
  const woodFurnMat = new THREE.MeshStandardMaterial({ color: 0x8c5832, roughness: 0.48 });
  const darkCounterMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.42 });
  const applianceMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.30, metalness: 0.45 });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.62 });
  const rugMat = new THREE.MeshStandardMaterial({ color: 0xebe3d8, roughness: 0.80 });
  const porcelainWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22 });
  const foliageGreenMat = new THREE.MeshStandardMaterial({ color: 0x3f7428, roughness: 0.78 });
  const glassRailMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.50,
    roughness: 0.15
  });

  const addCutWall = (wx, wz, ww, wd, customH = wallH) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, customH, wd), wallMat);
    m.position.set(wx, customH * 0.5, wz);
    plan.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.03, 0.06, wd + 0.03), wallCapMat);
    cap.position.set(wx, customH + 0.03, wz);
    plan.add(cap);
  };

  // ==========================================================================
  // 1. NÚCLEO CENTRAL DE CIRCULAÇÃO VERTICAL (ELEVADORES, ESCADA E HALL)
  // ==========================================================================
  const coreFloor = new THREE.Mesh(new THREE.BoxGeometry(coreW + 0.24, 0.12, coreD), hallCoreMat);
  coreFloor.position.y = 0.06;
  plan.add(coreFloor);

  // Terraço/Volume Norte do Núcleo (visível no topo de cada torre na Prancha 1)
  const northBayD = d * 0.16;
  const northBayFloor = new THREE.Mesh(
    new THREE.BoxGeometry(coreW * 0.84, 0.12, northBayD),
    northTerraceMat
  );
  northBayFloor.position.set(0, 0.06, -coreD * 0.5 - northBayD * 0.5);
  plan.add(northBayFloor);

  addCutWall(0, -coreD * 0.5 - northBayD, coreW * 0.84, 0.16, wallH * 0.65);
  addCutWall(-coreW * 0.42, -coreD * 0.5 - northBayD * 0.5, 0.16, northBayD, wallH * 0.65);
  addCutWall(coreW * 0.42, -coreD * 0.5 - northBayD * 0.5, 0.16, northBayD, wallH * 0.65);

  // Paredes Norte e Sul do Núcleo Central
  addCutWall(0, -coreD * 0.48, coreW + 0.2, 0.18);
  addCutWall(0, coreD * 0.48, coreW + 0.2, 0.18);

  // Escada enclausurada de duplo lance na metade Norte do núcleo (como na Prancha 1)
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.52 });
  for (let s = 0; s < 6; s++) {
    const stepZ = -coreD * 0.36 + s * 0.34;
    const stepH = 0.14 + s * 0.05;
    const stepL = new THREE.Mesh(new THREE.BoxGeometry(coreW * 0.34, stepH, 0.28), stairMat);
    stepL.position.set(-coreW * 0.20, stepH * 0.5 + 0.06, stepZ);
    plan.add(stepL);

    const stepR = new THREE.Mesh(new THREE.BoxGeometry(coreW * 0.34, stepH, 0.28), stairMat);
    stepR.position.set(coreW * 0.20, stepH * 0.5 + 0.06, stepZ);
    plan.add(stepR);
  }
  // Corrimão / divisória central da escada
  addCutWall(0, -coreD * 0.18, 0.10, coreD * 0.42, wallH * 0.65);

  // Poço dos 2 Elevadores na metade Sul do núcleo central
  addCutWall(0, coreD * 0.16, coreW * 0.76, 0.14);
  addCutWall(-coreW * 0.36, coreD * 0.31, 0.14, coreD * 0.30);
  addCutWall(coreW * 0.36, coreD * 0.31, 0.14, coreD * 0.30);
  addCutWall(0, coreD * 0.31, 0.12, coreD * 0.30);

  const elevShaftMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  for (const ex of [-coreW * 0.18, coreW * 0.18]) {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(coreW * 0.30, 0.16, coreD * 0.24), elevShaftMat);
    shaft.position.set(ex, 0.08, coreD * 0.31);
    plan.add(shaft);
  }

  // ==========================================================================
  // 2. ASAS OESTE (-1) E LESTE (+1) — 4 APARTAMENTOS HUMANIZADOS POR ANDAR
  // ==========================================================================
  const coreChildCount = plan.children.length; // tudo que vier depois é das asas (substituível pelas plantas em imagem)
  for (const sx of [-1, 1]) {
    const wx = sx * wingX;

    // Paredes perimetrais externas da Asa e divisória central entre aptos Norte e Sul (z = 0)
    addCutWall(wx + sx * (wingW * 0.48), 0, 0.20, d * 0.96);
    addCutWall(wx - sx * (wingW * 0.48), 0, 0.18, d * 0.92);
    addCutWall(wx, 0, wingW * 0.96, 0.20);

    // Paredes externas Norte e Sul na faixa dos dormitórios
    const dormStripX = wx + sx * (wingW * 0.24);
    const livStripX = wx - sx * (wingW * 0.24);
    addCutWall(dormStripX, -d * 0.48, wingW * 0.48, 0.20);
    addCutWall(dormStripX, d * 0.48, wingW * 0.48, 0.20);

    for (const sz of [-1, 1]) {
      const aptZ = sz * (d * 0.24);
      const aptD = d * 0.46;

      // ----------------------------------------------------------------------
      // PISOS SETORIZADOS POR AMBIENTE (IDÊNTICOS AO QUADRO "TORRES PLANTA TIPO")
      // ----------------------------------------------------------------------
      // A. Faixa Externa: Suíte Master + Banheiros + 2º Dormitório
      const dormFloor = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.47, 0.12, aptD), suiteWoodMat);
      dormFloor.position.set(dormStripX, 0.06, aptZ);
      plan.add(dormFloor);

      // Piso cerâmico azulado (#b8c7d1) dos Banheiros (Suíte + Social)
      const bathZ = aptZ - sz * (aptD * 0.04);
      const bathD = aptD * 0.24;
      const bathFloor = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.46, 0.135, bathD), bathTileMat);
      bathFloor.position.set(dormStripX, 0.068, bathZ);
      plan.add(bathFloor);

      // B. Faixa Interna: Cozinha/Serviço + Sala de Estar/Jantar + Varanda Gourmet
      const kitD = aptD * 0.27;
      const kitZ = sz * (kitD * 0.5 + 0.08);
      const kitFloor = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.47, 0.13, kitD), kitchenMat);
      kitFloor.position.set(livStripX, 0.065, kitZ);
      plan.add(kitFloor);

      const livD = aptD * 0.49;
      const livZ = sz * (kitD + livD * 0.5 + 0.06);
      const livFloor = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.47, 0.125, livD), livingPorcMat);
      livFloor.position.set(livStripX, 0.062, livZ);
      plan.add(livFloor);

      const balD = aptD * 0.22;
      const balZ = sz * (d * 0.48 - balD * 0.5);
      const balFloor = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.48, 0.13, balD), balconyMat);
      balFloor.position.set(livStripX, 0.065, balZ);
      plan.add(balFloor);

      // ----------------------------------------------------------------------
      // PAREDES INTERNAS DE DIVISÃO DOS AMBIENTES
      // ----------------------------------------------------------------------
      // Parede longitudinal separando área íntima (quartos/banheiros) do living/cozinha
      addCutWall(wx, aptZ - sz * (aptD * 0.08), 0.14, aptD * 0.78);

      // Paredes transversais dos banheiros
      addCutWall(dormStripX, bathZ + sz * (bathD * 0.5), wingW * 0.46, 0.12);
      addCutWall(dormStripX, bathZ - sz * (bathD * 0.5), wingW * 0.46, 0.12);
      // Divisória interna entre Banheiro da Suíte e Banheiro Social
      addCutWall(dormStripX, bathZ, 0.10, bathD);

      // Divisória parcial entre Cozinha e Sala de Jantar
      addCutWall(livStripX - sx * (wingW * 0.10), sz * (kitD + 0.06), wingW * 0.26, 0.12);

      // Divisória entre Sala de Estar e Varanda Gourmet
      addCutWall(livStripX, sz * (d * 0.48 - balD), wingW * 0.46, 0.12, wallH * 0.45);

      // Guarda-corpo frontal da Varanda Gourmet
      const balRail = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.46, wallH * 0.48, 0.08), glassRailMat);
      balRail.position.set(livStripX, wallH * 0.24 + 0.08, sz * (d * 0.485));
      plan.add(balRail);

      // ----------------------------------------------------------------------
      // MOBILIÁRIO 3D HUMANIZADO COMPLETO (FIEL À PRANCHA 1)
      // ----------------------------------------------------------------------

      // 1. SUÍTE MASTER (Cama de casal com cabeceira, travesseiros, manta, criados-mudos e armário)
      const suiteBedZ = aptZ + sz * (aptD * 0.30);
      const suiteBedX = dormStripX + sx * (wingW * 0.06);
      const bed1 = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.32, 1.42), bedSheetMat);
      bed1.position.set(suiteBedX, 0.22, suiteBedZ);
      plan.add(bed1);

      const blk1 = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.34, 0.52), blanketSuiteMat);
      blk1.position.set(suiteBedX - sx * 0.22, 0.23, suiteBedZ);
      plan.add(blk1);

      for (const pz of [-0.34, 0.34]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.48), pillowMat);
        pil.position.set(suiteBedX + sx * 0.46, 0.26, suiteBedZ + pz);
        plan.add(pil);
      }

      // Guarda-roupa da Suíte
      const ward1 = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.36, wallH * 0.78, 0.36), woodFurnMat);
      ward1.position.set(dormStripX, wallH * 0.39 + 0.08, aptZ + sz * (aptD * 0.45));
      plan.add(ward1);

      // 2. SEGUNDO DORMITÓRIO (Cama de casal/solteiro, travesseiros, manta e armário)
      const dorm2Z = aptZ - sz * (aptD * 0.32);
      const bed2 = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.30, 1.32), bedSheetMat);
      bed2.position.set(suiteBedX, 0.21, dorm2Z);
      plan.add(bed2);

      const blk2 = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.32, 0.48), blanketDormMat);
      blk2.position.set(suiteBedX - sx * 0.20, 0.22, dorm2Z);
      plan.add(blk2);

      for (const pz of [-0.30, 0.30]) {
        const pil2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.44), pillowMat);
        pil2.position.set(suiteBedX + sx * 0.42, 0.25, dorm2Z + pz);
        plan.add(pil2);
      }

      // 3. BANHEIROS (Bancadas brancas com cuba e vasos sanitários)
      for (const bSide of [-1, 1]) {
        const vanity = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.32), porcelainWhiteMat);
        vanity.position.set(dormStripX + bSide * (wingW * 0.11), 0.24, bathZ + sz * (bathD * 0.26));
        plan.add(vanity);

        const toilet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.36), porcelainWhiteMat);
        toilet.position.set(dormStripX + bSide * (wingW * 0.12), 0.20, bathZ - sz * (bathD * 0.24));
        plan.add(toilet);
      }

      // 4. COZINHA / SERVIÇO (Bancada em L cinza-escuro, pia inox, cooktop e geladeira)
      const counterMain = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, kitD * 0.82), darkCounterMat);
      counterMain.position.set(livStripX - sx * (wingW * 0.16), 0.25, kitZ);
      plan.add(counterMain);

      const sink = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.40, 0.56), applianceMat);
      sink.position.set(livStripX - sx * (wingW * 0.16), 0.26, kitZ);
      plan.add(sink);

      const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.52, wallH * 0.72, 0.52), applianceMat);
      fridge.position.set(livStripX + sx * (wingW * 0.14), wallH * 0.36 + 0.08, sz * 0.42);
      plan.add(fridge);

      // 5. SALA DE JANTAR & ESTAR INTEGRADA (Mesa de 6 lugares + Sofá em L + Tapete + Rack TV)
      const diningZ = livZ - sz * (livD * 0.24);
      const diningX = livStripX + sx * (wingW * 0.04);
      const dTable = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.32, 1.32), woodFurnMat);
      dTable.position.set(diningX, 0.22, diningZ);
      plan.add(dTable);

      // 6 Cadeiras de jantar (3 de cada lado)
      for (const cx of [-0.52, 0.52]) {
        for (const cz of [-0.42, 0, 0.42]) {
          const chair = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.30, 0.24), blanketSuiteMat);
          chair.position.set(diningX + cx, 0.20, diningZ + cz);
          plan.add(chair);
        }
      }

      // Sala de Estar: Tapete + Sofá em L + Mesa de Centro + Painel de TV
      const sofaZ = livZ + sz * (livD * 0.22);
      const rug = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.38, 0.14, livD * 0.42), rugMat);
      rug.position.set(livStripX, 0.07, sofaZ);
      plan.add(rug);

      const sofaMain = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 1.48), sofaMat);
      sofaMain.position.set(livStripX + sx * (wingW * 0.11), 0.24, sofaZ);
      plan.add(sofaMain);

      const sofaChaise = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.32, 0.56), sofaMat);
      sofaChaise.position.set(livStripX + sx * (wingW * 0.04), 0.23, sofaZ - sz * 0.46);
      plan.add(sofaChaise);

      const tvUnit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 1.25), woodFurnMat);
      tvUnit.position.set(livStripX - sx * (wingW * 0.18), 0.24, sofaZ);
      plan.add(tvUnit);

      // 6. VARANDA GOURMET (Mesa redonda + Cadeiras + Floreira Verde na borda da fachada)
      const balTable = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.30, 12), woodFurnMat);
      balTable.position.set(livStripX - sx * (wingW * 0.08), 0.22, balZ);
      plan.add(balTable);

      // Floreira verde na borda da Varanda Gourmet (idêntica ao quadro "Torres Planta Tipo" da Prancha 1!)
      const planterBox = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.22, 0.24, 0.28), wallMat);
      planterBox.position.set(livStripX + sx * (wingW * 0.10), 0.18, sz * (d * 0.465));
      plan.add(planterBox);

      const planterFoliage = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.20, 0.28, 0.24), foliageGreenMat);
      planterFoliage.position.set(livStripX + sx * (wingW * 0.10), 0.24, sz * (d * 0.465));
      plan.add(planterFoliage);
    }
  }

  // Separa as asas procedurais do núcleo: o app esconde as asas e mostra a imagem da planta de cada apartamento
  const wingsGroup = new THREE.Group();
  for (const child of plan.children.slice(coreChildCount)) wingsGroup.add(child);
  plan.add(wingsGroup);
  plan.userData.wingsGroup = wingsGroup;
  // Área de cada quadrante (apto 1..4 = QUADS em scene3d.js): centro (cx, cz) e tamanho (w, d)
  const quadW = wingW * 0.96;
  const quadD = d * 0.48 * 0.98;
  plan.userData.quadSlots = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => ({
    cx: sx * wingX,
    cz: sz * (d * 0.25),
    w: quadW,
    d: quadD
  }));

  return plan;
}
