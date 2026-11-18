// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — PAISAGISMO BOTÂNICO E ILUMINAÇÃO PAISAGÍSTICA
// Constrói com fidelidade 100% às Pranchas 1, 2, 3 e 4 todas as espécies do
// Catálogo de Paisagismo e os Balizadores Luminosos Quentes (Bollard Lights):
//  1. Árvore de Sombra — Pau-Ferro (Caesalpinia ferrea)
//  2. Palmeira Imperial (Roystonea oleracea)
//  3. Ipê Rosa (Handroanthus heptaphyllus) — Tronco/galhos tortuosos, copa
//     botânica em camadas aéreas e canteiro orgânico com casca escura e pedras
//  4. Arbustos, Maciços e Gramíneas: Hibisco, Ixora, Cordiline (Dracena),
//     Muréia (Jasmim-laranja), Pingo-de-Ouro, Grama-Amendoim e Capim Ornamental
//  5. Balizadores Arquitetônicos Bronze Escuro com Aletas e Halo Âmbar Sutil
// ==========================================================================

import * as THREE from 'three';
import { BASE_Y, CASAS_CONFIG, TOWERS_CONFIG } from './data.js';

// --------------------------------------------------------------------------
// RUÍDO DETERMINÍSTICO & GEOMETRIAS BOTÂNICAS ORGÂNICAS (CRIADAS 1X)
// --------------------------------------------------------------------------

function hash3(x, y, z, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

// Ruído trigonométrico contínuo dependente exclusivamente da posição (sem costuras)
function fbm3(x, y, z, seed = 0) {
  const p = seed * 1.37;
  const n1 =
    Math.sin(x * 2.9 + p) * Math.cos(y * 3.1 - p * 0.7) +
    Math.sin(y * 3.7 + z * 2.6 + p * 0.5) * 0.7 +
    Math.cos(z * 3.3 - x * 2.4 + p * 1.1) * 0.65;
  const n2 =
    Math.sin(x * 7.1 - z * 5.9 + p * 1.9) * 0.42 +
    Math.cos(y * 6.7 + x * 6.1 - p * 1.3) * 0.38;
  return (n1 * 0.43 + n2 * 0.35) * 0.5; // intervalo aproximado [-0.8, +0.8]
}

// Cria geometria foliar/floral orgânica deslocada por ruído + vertex AO interno
function createOrganicFoliageGeo(
  radius = 0.5,
  detail = 1,
  seed = 1,
  amp = 0.24,
  scaleX = 1.0,
  scaleY = 1.0,
  scaleZ = 1.0,
  aoMin = 0.72,
  aoMax = 1.04
) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;

    // Quantiza direção para garantir zero fissuras entre vértices coincidentes
    const qx = Math.round(nx * 1000) * 0.001;
    const qy = Math.round(ny * 1000) * 0.001;
    const qz = Math.round(nz * 1000) * 0.001;
    const disp = 1.0 + amp * fbm3(qx * 1.8, qy * 1.8, qz * 1.8, seed);

    const dx = vx * disp * scaleX;
    const dy = vy * disp * scaleY;
    const dz = vz * disp * scaleZ;
    pos.setXYZ(i, dx, dy, dz);

    // Sombreamento ambiente (AO): base/interior mais escuro, topo/pontas iluminadas
    const upT = THREE.MathUtils.clamp((ny + 1.0) * 0.5, 0, 1);
    const tipT = THREE.MathUtils.clamp((disp - (1.0 - amp)) / Math.max(0.001, 2 * amp), 0, 1);
    const shade = THREE.MathUtils.lerp(aoMin, aoMax, upT * 0.68 + tipT * 0.32);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }

  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

// Combina múltiplos sub-tufos irregulares num único raminho botânico aéreo (spray)
function createCompoundSprayGeo(subSpecs, seed = 10, amp = 0.28, aoMin = 0.72, aoMax = 1.04) {
  const parts = subSpecs.map(([ox, oy, oz, r, sx, sy, sz], idx) => {
    const sub = new THREE.IcosahedronGeometry(r, 1);
    const p = sub.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i);
      const vy = p.getY(i);
      const vz = p.getZ(i);
      const len = Math.hypot(vx, vy, vz) || 1;
      const qx = Math.round((vx / len) * 1000) * 0.001;
      const qy = Math.round((vy / len) * 1000) * 0.001;
      const qz = Math.round((vz / len) * 1000) * 0.001;
      const disp = 1.0 + amp * fbm3(qx * 2.1, qy * 2.1, qz * 2.1, seed + idx * 7.3);
      p.setXYZ(i, vx * disp * sx + ox, vy * disp * sy + oy, vz * disp * sz + oz);
    }
    sub.computeVertexNormals();
    return sub;
  });

  let totalVerts = 0;
  for (const part of parts) totalVerts += part.attributes.position.count;

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const uvArr = new Float32Array(totalVerts * 2);
  const colArr = new Float32Array(totalVerts * 3);

  let vOffset = 0;
  for (const part of parts) {
    const p = part.attributes.position;
    const n = part.attributes.normal;
    const u = part.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const idx3 = (vOffset + i) * 3;
      const idx2 = (vOffset + i) * 2;
      const px = p.getX(i);
      const py = p.getY(i);
      const pz = p.getZ(i);
      posArr[idx3] = px;
      posArr[idx3 + 1] = py;
      posArr[idx3 + 2] = pz;

      normArr[idx3] = n.getX(i);
      normArr[idx3 + 1] = n.getY(i);
      normArr[idx3 + 2] = n.getZ(i);

      if (u) {
        uvArr[idx2] = u.getX(i);
        uvArr[idx2 + 1] = u.getY(i);
      }

      const radial = Math.min(1, Math.hypot(px, py, pz) / 0.72);
      const upT = THREE.MathUtils.clamp((py + 0.35) / 0.70, 0, 1);
      const shade = THREE.MathUtils.lerp(aoMin, aoMax, upT * 0.58 + radial * 0.42);
      colArr[idx3] = shade;
      colArr[idx3 + 1] = shade;
      colArr[idx3 + 2] = shade;
    }
    vOffset += p.count;
    part.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  out.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  return out;
}

// Constrói galho/tronco curvo e afunilado ao longo de curva quadrática de Bézier
function createCurvedLimbGeo(p0, pCtrl, p1, r0, r1, lenSegs = 6, radSegs = 7, seed = 1) {
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= lenSegs; i++) {
    const t = i / lenSegs;
    const it = 1 - t;
    const pt = new THREE.Vector3()
      .addScaledVector(p0, it * it)
      .addScaledVector(pCtrl, 2 * it * t)
      .addScaledVector(p1, t * t);
    pts.push(pt);

    const tan = new THREE.Vector3()
      .addScaledVector(new THREE.Vector3().subVectors(pCtrl, p0), 2 * it)
      .addScaledVector(new THREE.Vector3().subVectors(p1, pCtrl), 2 * t);
    if (tan.lengthSq() < 1e-6) tan.set(0, 1, 0);
    tangents.push(tan.normalize());
  }

  // Transporte paralelo do referencial ortonormal ao longo do galho
  const upRef = Math.abs(tangents[0].y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let N = new THREE.Vector3().crossVectors(upRef, tangents[0]).normalize();
  let B = new THREE.Vector3().crossVectors(tangents[0], N).normalize();

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringVerts = radSegs + 1;

  for (let i = 0; i <= lenSegs; i++) {
    const t = i / lenSegs;
    const T = tangents[i];
    if (i > 0) {
      const prevT = tangents[i - 1];
      const axis = new THREE.Vector3().crossVectors(prevT, T);
      const axisLen = axis.length();
      if (axisLen > 1e-5) {
        axis.divideScalar(axisLen);
        const angle = Math.acos(THREE.MathUtils.clamp(prevT.dot(T), -1, 1));
        N.applyAxisAngle(axis, angle).normalize();
        B.crossVectors(T, N).normalize();
      }
    }

    const rBase = THREE.MathUtils.lerp(r0, r1, t);
    for (let j = 0; j <= radSegs; j++) {
      const theta = (j / radSegs) * Math.PI * 2;
      const seamJ = j === radSegs ? 0 : j;
      const barkRipple = 1.0 + 0.08 * Math.sin(seamJ * 2.3 + i * 1.9 + seed);
      const r = rBase * barkRipple;

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const vx = pts[i].x + (N.x * cosT + B.x * sinT) * r;
      const vy = pts[i].y + (N.y * cosT + B.y * sinT) * r;
      const vz = pts[i].z + (N.z * cosT + B.z * sinT) * r;

      positions.push(vx, vy, vz);
      uvs.push(j / radSegs, t * 2.0);
    }
  }

  for (let i = 0; i < lenSegs; i++) {
    const rA = i * ringVerts;
    const rB = (i + 1) * ringVerts;
    for (let j = 0; j < radSegs; j++) {
      const v00 = rA + j;
      const v01 = rA + j + 1;
      const v10 = rB + j;
      const v11 = rB + j + 1;
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  // Tampa da ponta do galho
  const tipCenterIdx = positions.length / 3;
  const lastPt = pts[lenSegs];
  const tipAdvance = tangents[lenSegs].clone().multiplyScalar(r1 * 0.45);
  positions.push(lastPt.x + tipAdvance.x, lastPt.y + tipAdvance.y, lastPt.z + tipAdvance.z);
  uvs.push(0.5, 2.0);

  const lastRingStart = lenSegs * ringVerts;
  for (let j = 0; j < radSegs; j++) {
    indices.push(tipCenterIdx, lastRingStart + j, lastRingStart + j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Pedra natural arredondada para borda de canteiro orgânico
function createStoneCobbleGeo(radius = 0.16, seed = 1) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const vz = p.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const qx = Math.round((vx / len) * 1000) * 0.001;
    const qy = Math.round((vy / len) * 1000) * 0.001;
    const qz = Math.round((vz / len) * 1000) * 0.001;
    const disp = 1.0 + 0.18 * fbm3(qx * 2.2, qy * 2.2, qz * 2.2, seed);
    p.setXYZ(i, vx * disp * 1.18, vy * disp * 0.62, vz * disp * 0.94);
  }
  g.computeVertexNormals();
  return g;
}

// Folha lanceolada arqueada para Cordiline (Dracena)
function createArchedBladeGeo(width = 0.14, height = 0.88, archRad = 0.45, segs = 4) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const profileW = width * Math.sin(Math.pow(t, 0.72) * Math.PI * 0.92 + 0.08) * (1 - t * 0.35);
    const angle = t * archRad;
    const y = Math.sin(Math.PI * 0.5 - angle * 0.55) * t * height;
    const z = (1 - Math.cos(angle)) * height * 0.72;

    positions.push(-profileW * 0.5, y, z);
    positions.push(0, y, z - profileW * 0.08);
    positions.push(profileW * 0.5, y, z);

    uvs.push(0, t, 0.5, t, 1, t);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
    indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Touceira compartilhada de capim ornamental arqueado (1 geometria -> 1 chamada de desenho)
function createOrnamentalGrassTuftGeo(bladeCount = 22, seed = 41) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  for (let b = 0; b < bladeCount; b++) {
    const ring = b < 8 ? 0 : 1;
    const yaw = (b / bladeCount) * Math.PI * 2 + hash3(b, seed, 1) * 0.45;
    const h = (ring === 0 ? 0.54 : 0.42) + hash3(b, seed, 2) * 0.24;
    const w = 0.045 + hash3(b, seed, 3) * 0.02;
    const tiltOut = (ring === 0 ? 0.36 : 0.72) + hash3(b, seed, 4) * 0.28;
    const radOffset = (ring === 0 ? 0.04 : 0.11) + hash3(b, seed, 5) * 0.05;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const segs = 3;
    const baseVertex = positions.length / 3;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const bw = w * (1 - t * 0.88);
      const localR = radOffset + Math.pow(t, 1.35) * tiltOut * h;
      const localY = Math.sin(t * Math.PI * 0.58) * h * (1 - t * 0.14);

      const cx = cosY * localR;
      const cz = sinY * localR;
      const px = -sinY * bw * 0.5;
      const pz = cosY * bw * 0.5;

      const shade = THREE.MathUtils.lerp(0.66, 1.06, t);
      positions.push(cx - px, localY, cz - pz);
      positions.push(cx + px, localY, cz + pz);
      uvs.push(0, t, 1, t);
      colors.push(shade, shade, shade, shade, shade, shade);
    }

    for (let s = 0; s < segs; s++) {
      const v0 = baseVertex + s * 2;
      indices.push(v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Disco orgânico levemente ondulado para canteiros de casca escura e forrações
function createOrganicPadGeo(radius = 1.0, height = 0.06, segs = 18, wobble = 0.09, seed = 7) {
  const g = new THREE.CylinderGeometry(radius * 0.94, radius, height, segs, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const vz = p.getZ(i);
    const r = Math.hypot(vx, vz);
    if (r > 0.01) {
      const ang = Math.atan2(vz, vx);
      const w = 1.0 + wobble * (Math.sin(ang * 3 + seed) * 0.6 + Math.cos(ang * 5 - seed * 1.4) * 0.4);
      const crownLift = vy > 0 ? 0.018 * (1 - Math.min(1, r / radius)) : 0;
      p.setXYZ(i, vx * w, vy + crownLift, vz * w);
    } else if (vy > 0) {
      p.setY(i, vy + 0.022);
    }
  }
  g.computeVertexNormals();
  return g;
}

// --------------------------------------------------------------------------
// GERADORES DE TEXTURAS BOTÂNICAS PROCEDURAIS (CANVAS 2D -> WEBGL)
// --------------------------------------------------------------------------

function createBarkTexture(baseHex = '#4a3525', darkHex = '#2b1d12', lightHex = '#6e5239') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, c.width, c.height);

  // Fissuras, sulcos e placas verticais orgânicas de casca
  for (let i = 0; i < 240; i++) {
    const x = (i * 37 + (i % 5) * 11) % c.width;
    const y = (i * 73 + (i % 7) * 19) % c.height;
    const w = 2 + (i % 5) * 2;
    const h = 24 + (i % 8) * 14;
    ctx.fillStyle = i % 3 === 0 ? darkHex : lightHex;
    ctx.globalAlpha = 0.28 + (i % 4) * 0.11;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPalmEstipeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, c.width, 0);
  g.addColorStop(0.0, '#78736a');
  g.addColorStop(0.3, '#9e988e');
  g.addColorStop(0.5, '#aba59b');
  g.addColorStop(0.7, '#969086');
  g.addColorStop(1.0, '#736e65');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let y = 0; y < c.height; y += 12) {
    ctx.fillStyle = y % 24 === 0 ? 'rgba(58, 53, 46, 0.55)' : 'rgba(214, 209, 200, 0.32)';
    ctx.fillRect(0, y, c.width, 3);
    ctx.fillStyle = 'rgba(40, 36, 32, 0.25)';
    ctx.fillRect(0, y + 3, c.width, 1);
  }

  ctx.fillStyle = 'rgba(60, 56, 50, 0.10)';
  for (let x = 0; x < c.width; x += 8) {
    ctx.fillRect(x, 0, 2, c.height);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGramaAmendoimTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#335314';
  ctx.fillRect(0, 0, 256, 256);

  const greens = ['#2a4810', '#385e16', '#467014', '#527e1c'];
  for (let i = 0; i < 720; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    ctx.fillStyle = greens[i % greens.length];
    ctx.beginPath();
    ctx.arc(x, y, 3.5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Pontos sutis de floração amarela natural (Arachis repens)
  for (let i = 0; i < 78; i++) {
    const x = (i * 79 + 17) % 256;
    const y = (i * 113 + 29) % 256;
    ctx.fillStyle = i % 2 === 0 ? '#eab308' : '#facc15';
    ctx.beginPath();
    ctx.arc(x, y, 2.2 + (i % 2) * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Textura orgânica de terra/casca de pinus escura, com opção de pétalas caídas integradas ao solo
function createMulchTexture(withFallenPetals = false) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#261a12';
  ctx.fillRect(0, 0, 256, 256);

  const barkChips = ['#1c130d', '#312116', '#3d2a1c', '#2b1d14', '#473222'];
  for (let i = 0; i < 950; i++) {
    const x = (i * 67 + (i % 13) * 17) % 256;
    const y = (i * 113 + (i % 11) * 23) % 256;
    const rw = 3 + (i % 5) * 1.4;
    const rh = 1.6 + (i % 3) * 0.9;
    const rot = ((i * 29) % 180) * (Math.PI / 180);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = barkChips[i % barkChips.length];
    ctx.fillRect(-rw * 0.5, -rh * 0.5, rw, rh);
    ctx.restore();
  }

  if (withFallenPetals) {
    // Pétalas caídas naturais e sutis concentradas em bolsões orgânicos sobre a casca escura
    const petalTones = ['#831843', '#9d174d', '#c24178', '#db6195', '#f3a6c8', '#fbe2ee'];
    for (let i = 0; i < 240; i++) {
      const ang = i * 2.39996 + Math.sin(i * 0.4) * 0.5;
      const radialT = Math.sqrt((i + 0.5) / 240);
      const drift = 0.82 + 0.25 * Math.sin(ang * 2.7);
      const dist = Math.min(112, (16 + radialT * 94) * drift);
      const x = 128 + Math.cos(ang) * dist;
      const y = 128 + Math.sin(ang) * dist;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang * 1.7);
      ctx.globalAlpha = 0.72 - radialT * 0.28;
      ctx.fillStyle = petalTones[(i * 7 + (i % 3)) % petalTones.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.8 + (i % 2) * 0.9, 1.5 + (i % 2) * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRadialGlowTexture(
  colorInner = 'rgba(255, 214, 130, 0.38)',
  colorMid = 'rgba(234, 152, 42, 0.14)'
) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0.0, colorInner);
  g.addColorStop(0.38, colorMid);
  g.addColorStop(0.75, 'rgba(234, 152, 42, 0.03)');
  g.addColorStop(1.0, 'rgba(234, 152, 42, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --------------------------------------------------------------------------
// CONSTRUTOR PRINCIPAL DE PAISAGISMO E ILUMINAÇÃO PAISAGÍSTICA 3D
// --------------------------------------------------------------------------

export function buildLandscaping3D(root, renderer, mats = {}, nightLightObjects = []) {
  const landscapingGroup = new THREE.Group();
  landscapingGroup.name = 'Landscaping3D';
  root.add(landscapingGroup);

  // Árvores e plantas REAIS (modelos 3D de assets/arvores, desenhados por instâncias em src/arvores.js).
  // Aqui só se registra onde cada uma entra; se os arquivos não carregarem, `arvoresProcedurais`
  // guarda o desenho procedural de fallback.
  const arvoresReais = { folhosa: [], palmeira: [], tropical1: [], tropical2: [], ipe: [] };
  const arvoresProcedurais = [];
  root.userData.arvores = arvoresReais;
  root.userData.arvoresProcedurais = arvoresProcedurais;

  const barkTex = createBarkTexture('#4e3624', '#2b1b10', '#6f5038');
  const ipeBarkTex = createBarkTexture('#34261c', '#1b130d', '#4c392b');
  const palmEstipeTex = createPalmEstipeTexture();
  const gramaAmendoimTex = createGramaAmendoimTexture();
  const mulchTex = createMulchTexture(false);
  const ipeMulchPetalsTex = createMulchTexture(true);
  const bollardHaloTex = createRadialGlowTexture();

  if (renderer && renderer.capabilities) {
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    barkTex.anisotropy = maxAniso;
    ipeBarkTex.anisotropy = maxAniso;
    palmEstipeTex.anisotropy = maxAniso;
    gramaAmendoimTex.anisotropy = maxAniso;
    mulchTex.anisotropy = maxAniso;
    ipeMulchPetalsTex.anisotropy = maxAniso;
  }

  // Materiais compartilhados com fallback seguro
  const curbMat = mats.curb || new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 });
  const lawnRichMat = mats.lawnRich || new THREE.MeshStandardMaterial({ color: 0x386623, roughness: 0.88 });

  // Materiais Arquitetônicos dos Balizadores (Bronze escuro/antracite + âmbar sutil)
  const bollardBronzeMat = new THREE.MeshStandardMaterial({
    color: 0x262320,
    roughness: 0.42,
    metalness: 0.68,
    envMapIntensity: 1.1
  });
  const bollardDiffuserMat = new THREE.MeshStandardMaterial({
    color: 0xffefc8,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.58,
    roughness: 0.36
  });
  const bollardHaloMat = new THREE.MeshBasicMaterial({
    map: bollardHaloTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  // Materiais de Solo Orgânico, Pedra Natural e Forrações
  const mulchMat = new THREE.MeshStandardMaterial({ map: mulchTex, roughness: 0.94 });
  const ipeMulchPetalsMat = new THREE.MeshStandardMaterial({ map: ipeMulchPetalsTex, roughness: 0.94 });
  const stoneEdgeMatA = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.88 });
  const stoneEdgeMatB = new THREE.MeshStandardMaterial({ color: 0x585c61, roughness: 0.90 });

  // Materiais Botânicos Específicos (Prancha 2)
  const pauFerroBarkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.88 });
  const ipeBarkMat = new THREE.MeshStandardMaterial({ map: ipeBarkTex, roughness: 0.92 });
  const palmTrunkMat = new THREE.MeshStandardMaterial({ map: palmEstipeTex, roughness: 0.78 });
  const palmCrownshaftMat = new THREE.MeshStandardMaterial({ color: 0x4d8c30, roughness: 0.52 });
  const palmFruitMat = new THREE.MeshStandardMaterial({ color: 0xa3b828, roughness: 0.65 });
  const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x3f7c27, roughness: 0.64, side: THREE.DoubleSide });
  const palmFrondLightMat = new THREE.MeshStandardMaterial({ color: 0x589938, roughness: 0.62, side: THREE.DoubleSide });

  // Pau-Ferro fallback
  const pauFerroDarkMat = new THREE.MeshStandardMaterial({ color: 0x264e18, roughness: 0.84, vertexColors: true });
  const pauFerroMidMat = new THREE.MeshStandardMaterial({ color: 0x3b7024, roughness: 0.80, vertexColors: true });
  const pauFerroBrightMat = new THREE.MeshStandardMaterial({ color: 0x558f36, roughness: 0.78, vertexColors: true });
  const pauFerroBlossomMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.72, vertexColors: true });

  // 4 Tons naturais e foscos de pétalas do Ipê Rosa (ZERO emissive neon, alta rugosidade!)
  const ipePlumMat = new THREE.MeshStandardMaterial({
    color: 0x9d174d,
    roughness: 0.86,
    metalness: 0.0,
    vertexColors: true
  });
  const ipeSakuraMat = new THREE.MeshStandardMaterial({
    color: 0xdb6195,
    roughness: 0.86,
    metalness: 0.0,
    vertexColors: true
  });
  const ipeBlushMat = new THREE.MeshStandardMaterial({
    color: 0xf3a6c8,
    roughness: 0.86,
    metalness: 0.0,
    vertexColors: true
  });
  const ipeCreamMat = new THREE.MeshStandardMaterial({
    color: 0xfbe2ee,
    roughness: 0.86,
    metalness: 0.0,
    vertexColors: true
  });

  // Materiais dos Arbustos, Sebes, Gramíneas Ornamentais e Forração (vertexColors para AO)
  const gramaAmendoimMat = new THREE.MeshStandardMaterial({
    map: gramaAmendoimTex,
    roughness: 0.88
  });
  const gramaAmendoimFlowerMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.74,
    vertexColors: true
  });

  const hibiscoFoliageMat = new THREE.MeshStandardMaterial({ color: 0x1e4720, roughness: 0.80, vertexColors: true });
  const hibiscoFoliageLightMat = new THREE.MeshStandardMaterial({ color: 0x2b5d28, roughness: 0.78, vertexColors: true });
  const hibiscoFlowerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.66, vertexColors: true });

  const ixoraFoliageMat = new THREE.MeshStandardMaterial({ color: 0x274f16, roughness: 0.82, vertexColors: true });
  const ixoraFlowerMat = new THREE.MeshStandardMaterial({ color: 0xe85a1c, roughness: 0.68, vertexColors: true });
  const ixoraCoralMat = new THREE.MeshStandardMaterial({ color: 0xf47a38, roughness: 0.68, vertexColors: true });
  const ixoraRedMat = new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.70, vertexColors: true });
  const ixoraRedBrightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.70, vertexColors: true });

  // 4 Tons naturais e foscos para floração amarela pontual (Ipê Amarelo — zero emissive)
  const ipeGoldDeepMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.86, vertexColors: true });
  const ipeGoldMidMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.86, vertexColors: true });
  const ipeGoldBrightMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.86, vertexColors: true });
  const ipeGoldLightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.86, vertexColors: true });

  const cordilineDarkMat = new THREE.MeshStandardMaterial({ color: 0x5c1026, roughness: 0.66, side: THREE.DoubleSide });
  const cordilineCrimsonMat = new THREE.MeshStandardMaterial({ color: 0x8e1539, roughness: 0.62, side: THREE.DoubleSide });
  const cordilineBrightMat = new THREE.MeshStandardMaterial({ color: 0xc22251, roughness: 0.60, side: THREE.DoubleSide });

  const mureiaFoliageMat = new THREE.MeshStandardMaterial({ color: 0x285422, roughness: 0.78, vertexColors: true });
  const mureiaFoliageLightMat = new THREE.MeshStandardMaterial({ color: 0x376d2e, roughness: 0.76, vertexColors: true });
  const mureiaFlowerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.68, vertexColors: true });

  const pingoOuroBaseMat = new THREE.MeshStandardMaterial({ color: 0x588c11, roughness: 0.80, vertexColors: true });
  const pingoOuroLimeMat = new THREE.MeshStandardMaterial({ color: 0x7cb31c, roughness: 0.78, vertexColors: true });
  const pingoOuroGoldMat = new THREE.MeshStandardMaterial({ color: 0xd4ba28, roughness: 0.74, vertexColors: true });

  const grassLeafMat = new THREE.MeshStandardMaterial({
    color: 0x457326,
    roughness: 0.82,
    side: THREE.DoubleSide,
    vertexColors: true
  });
  const grassVariegatedMat = new THREE.MeshStandardMaterial({
    color: 0x6b9438,
    roughness: 0.80,
    side: THREE.DoubleSide,
    vertexColors: true
  });
  const grassPlumeMat = new THREE.MeshStandardMaterial({
    color: 0xdfd3be,
    roughness: 0.88,
    vertexColors: true
  });

  // --------------------------------------------------------------------------
  // GEOMETRIAS BOTÂNICAS COMPARTILHADAS (GERADAS 1X NA INICIALIZAÇÃO)
  // --------------------------------------------------------------------------

  // Sprays florais irregulares compostos para a copa aérea do Ipê Rosa
  const ipeSprayGeos = [
    createCompoundSprayGeo(
      [
        [0.0, 0.0, 0.0, 0.25, 1.12, 0.66, 1.04],
        [0.21, 0.07, 0.14, 0.18, 1.05, 0.62, 1.0],
        [-0.19, -0.04, -0.12, 0.18, 1.0, 0.62, 1.05]
      ],
      11,
      0.32,
      0.68,
      0.96
    ),
    createCompoundSprayGeo(
      [
        [0.0, 0.0, 0.0, 0.23, 1.06, 0.64, 1.12],
        [-0.18, 0.08, 0.16, 0.18, 1.0, 0.62, 0.96],
        [0.17, -0.04, -0.16, 0.17, 1.02, 0.60, 1.02]
      ],
      27,
      0.33,
      0.68,
      0.96
    ),
    createCompoundSprayGeo(
      [
        [0.0, 0.03, 0.0, 0.22, 1.04, 0.62, 1.04],
        [0.16, -0.03, -0.14, 0.16, 1.0, 0.60, 1.0],
        [-0.15, 0.05, 0.14, 0.16, 0.98, 0.60, 0.98]
      ],
      43,
      0.31,
      0.70,
      0.96
    )
  ];
  const ipeTipGeo = createOrganicFoliageGeo(0.20, 1, 59, 0.30, 1.10, 0.60, 1.02, 0.72, 0.96);

  // Geometrias orgânicas de tufos foliares e corimbos para arbustos e sebes
  const shrubLeafGeos = [
    createOrganicFoliageGeo(0.56, 1, 101, 0.24, 1.06, 0.76, 1.0, 0.70, 1.04),
    createOrganicFoliageGeo(0.48, 1, 117, 0.26, 1.0, 0.74, 1.08, 0.70, 1.04),
    createOrganicFoliageGeo(0.38, 1, 131, 0.25, 1.04, 0.72, 0.98, 0.72, 1.04)
  ];
  const blossomClusterGeo = createCompoundSprayGeo(
    [
      [0.0, 0.0, 0.0, 0.11, 1.05, 0.75, 1.05],
      [0.07, 0.02, 0.05, 0.075, 1.0, 0.75, 1.0],
      [-0.06, 0.01, -0.05, 0.075, 1.0, 0.75, 1.0]
    ],
    149,
    0.22,
    0.78,
    1.04
  );
  const singleFlowerGeo = createOrganicFoliageGeo(0.095, 0, 163, 0.25, 1.15, 0.58, 1.15, 0.82, 1.05);

  // Pedras naturais para borda dos canteiros de Ipê Rosa
  const stoneCobbleGeos = [
    createStoneCobbleGeo(0.16, 201),
    createStoneCobbleGeo(0.14, 217),
    createStoneCobbleGeo(0.17, 233)
  ];

  // Lâmina arqueada de Cordiline, touceira de capim ornamental e anel de terra orgânica
  const cordilineBladeGeo = createArchedBladeGeo(0.15, 0.86, 0.54, 4);
  const grassTuftGeoA = createOrnamentalGrassTuftGeo(22, 301);
  const grassTuftGeoB = createOrnamentalGrassTuftGeo(18, 317);
  const grassPlumeGeo = createOrganicFoliageGeo(0.055, 0, 331, 0.22, 0.7, 2.2, 0.7, 0.84, 1.04);
  const mulchDiscGeo = createOrganicPadGeo(0.72, 0.05, 14, 0.08, 401);
  const gramaAmendoimUnitGeo = createOrganicPadGeo(1.0, 0.16, 18, 0.07, 419);

  // Núcleo unitário para sebes com vertex AO (compatível com materiais vertexColors: true)
  const hedgeCoreGeo = new THREE.BoxGeometry(1, 1, 1);
  {
    const p = hedgeCoreGeo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const shade = p.getY(i) > 0 ? 0.98 : 0.76;
      cols[i * 3] = shade;
      cols[i * 3 + 1] = shade;
      cols[i * 3 + 2] = shade;
    }
    hedgeCoreGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }

  // Geometrias dos Balizadores Arquitetônicos (sleek bronze/anthracite post + subtle halo 1.45 x 1.45)
  const bollardPlinthGeo = new THREE.CylinderGeometry(0.095, 0.115, 0.05, 12);
  const bollardShaftGeo = new THREE.CylinderGeometry(0.066, 0.072, 0.52, 12);
  const bollardCoreGeo = new THREE.CylinderGeometry(0.050, 0.050, 0.14, 12);
  const bollardLouverGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.015, 12);
  const bollardRibGeo = new THREE.BoxGeometry(0.018, 0.18, 0.018);
  const bollardHoodGeo = new THREE.CylinderGeometry(0.070, 0.092, 0.055, 12);
  const haloPlaneGeo = new THREE.PlaneGeometry(1.45, 1.45);
  haloPlaneGeo.rotateX(-Math.PI / 2);

  // ==========================================================================
  // 1. BALIZADORES ARQUITETÔNICOS BRONZE ESCURO (HALO ÂMBAR SUTIL 1.45 x 1.45)
  // ==========================================================================
  function addBollardLight(x, z, haloScale = 1.0, yOffset = BASE_Y) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);

    const plinth = new THREE.Mesh(bollardPlinthGeo, bollardBronzeMat);
    plinth.position.y = 0.025;
    plinth.receiveShadow = true;
    g.add(plinth);

    const shaft = new THREE.Mesh(bollardShaftGeo, bollardBronzeMat);
    shaft.position.y = 0.30;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    g.add(shaft);

    const diffuser = new THREE.Mesh(bollardCoreGeo, bollardDiffuserMat);
    diffuser.position.y = 0.63;
    g.add(diffuser);

    // 3 aletas horizontais anti-ofuscamento + 2 hastes laterais do cabeçote
    for (const ly of [0.575, 0.625, 0.675]) {
      const louver = new THREE.Mesh(bollardLouverGeo, bollardBronzeMat);
      louver.position.y = ly;
      g.add(louver);
    }
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(bollardRibGeo, bollardBronzeMat);
      rib.position.set(side * 0.068, 0.63, 0);
      g.add(rib);
    }

    const hood = new THREE.Mesh(bollardHoodGeo, bollardBronzeMat);
    hood.position.y = 0.725;
    hood.castShadow = true;
    g.add(hood);

    const halo = new THREE.Mesh(haloPlaneGeo, bollardHaloMat);
    halo.position.y = 0.045;
    halo.scale.setScalar(haloScale);
    g.add(halo);

    landscapingGroup.add(g);
    nightLightObjects.push(diffuser, halo);
  }

  // Helper de canteiro orgânico com casca escura sob arbustos
  function addMulchRing(parent, radius = 0.75, y = 0.025) {
    const m = new THREE.Mesh(mulchDiscGeo, mulchMat);
    m.position.y = y;
    m.scale.set(radius / 0.72, 1.0, radius / 0.72);
    m.receiveShadow = true;
    parent.add(m);
  }

  // ==========================================================================
  // 2. ARBUSTOS, MACIÇOS E GRAMÍNEAS ORNAMENTAIS (SILHUETA BOTÂNICA ORGÂNICA)
  // ==========================================================================

  // (A) Hibisco (Hibiscus rosa-sinensis): folhagem orgânica verde-escura + flores vermelhas
  function addHibisco(x, z, scale = 1.0, withMulch = true, yOffset = BASE_Y) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);
    g.scale.setScalar(scale);

    if (withMulch) addMulchRing(g, 0.72);

    const mounds = [
      [0.0, 0.42, 0.0, 1.05, 0.92, 0, hibiscoFoliageMat],
      [-0.28, 0.34, 0.22, 0.76, 0.88, 1, hibiscoFoliageLightMat],
      [0.30, 0.35, -0.18, 0.78, 0.86, 2, hibiscoFoliageMat],
      [0.18, 0.32, 0.28, 0.72, 0.85, 0, hibiscoFoliageLightMat],
      [-0.22, 0.48, -0.22, 0.68, 0.82, 1, hibiscoFoliageLightMat]
    ];
    for (const [mx, my, mz, mr, sy, geoIdx, mat] of mounds) {
      const m = new THREE.Mesh(shrubLeafGeos[geoIdx], mat);
      m.position.set(mx, my, mz);
      m.scale.set(mr, mr * sy, mr);
      m.rotation.y = mx * 2.1 + mz * 1.4;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    const flowerCoords = [
      [0.04, 0.82, 0.14],
      [-0.36, 0.62, 0.34],
      [0.38, 0.64, 0.24],
      [-0.26, 0.68, -0.30],
      [0.32, 0.62, -0.28],
      [0.04, 0.70, -0.40],
      [-0.46, 0.48, -0.05],
      [0.46, 0.50, 0.04]
    ];
    flowerCoords.forEach(([fx, fy, fz], idx) => {
      const fl = new THREE.Mesh(singleFlowerGeo, hibiscoFlowerMat);
      fl.position.set(fx, fy, fz);
      fl.rotation.set(0.25 * Math.sin(idx), idx * 0.9, 0.2 * Math.cos(idx));
      fl.scale.set(1.15, 0.9, 1.15);
      g.add(fl);
    });

    landscapingGroup.add(g);
  }

  // (B) Ixora (Ixora coccinea): moita compacta texturizada + corimbos laranja-coral ou vermelhos
  function addIxora(x, z, scale = 1.0, withMulch = true, yOffset = BASE_Y, isRed = false) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);
    g.scale.setScalar(scale);

    if (withMulch) addMulchRing(g, 0.68);

    const lobes = [
      [0.0, 0.36, 0.0, 1.08, 0.78, 1],
      [-0.22, 0.32, 0.18, 0.72, 0.75, 0],
      [0.24, 0.32, -0.18, 0.72, 0.75, 2]
    ];
    for (const [lx, ly, lz, lr, sy, geoIdx] of lobes) {
      const m = new THREE.Mesh(shrubLeafGeos[geoIdx], ixoraFoliageMat);
      m.position.set(lx, ly, lz);
      m.scale.set(lr, lr * sy, lr);
      m.rotation.y = lx * 3.1;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    const flMatA = isRed ? ixoraRedMat : ixoraFlowerMat;
    const flMatB = isRed ? ixoraRedBrightMat : ixoraCoralMat;
    const corymbs = [
      [0.0, 0.72, 0.0, 1.25, flMatA],
      [-0.30, 0.60, 0.24, 1.08, flMatB],
      [0.32, 0.58, 0.22, 1.12, flMatA],
      [-0.28, 0.58, -0.26, 1.06, flMatA],
      [0.30, 0.60, -0.24, 1.02, flMatB],
      [0.02, 0.56, 0.40, 1.04, flMatA],
      [-0.02, 0.56, -0.40, 0.98, flMatB],
      [-0.42, 0.48, 0.02, 0.96, flMatA],
      [0.42, 0.48, -0.02, 0.96, flMatB]
    ];
    corymbs.forEach(([cx, cy, cz, cs, mat], idx) => {
      const c = new THREE.Mesh(blossomClusterGeo, mat);
      c.position.set(cx, cy, cz);
      c.scale.set(cs, cs * 0.85, cs);
      c.rotation.y = idx * 1.1;
      c.castShadow = true;
      g.add(c);
    });

    landscapingGroup.add(g);
  }

  // (C) Cordiline / Dracena (Cordyline fruticosa): roseta de lâminas arqueadas bordô/carmim
  function addCordiline(x, z, scale = 1.0, parent = landscapingGroup, yOffset = BASE_Y) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);
    g.scale.setScalar(scale);

    if (parent === landscapingGroup) {
      addMulchRing(g, 0.56);
    }

    const rings = [
      { count: 5, tilt: 0.20, len: 1.04, mat: cordilineBrightMat },
      { count: 7, tilt: 0.48, len: 0.96, mat: cordilineCrimsonMat },
      { count: 9, tilt: 0.80, len: 0.84, mat: cordilineDarkMat }
    ];

    rings.forEach((ring, rIdx) => {
      for (let i = 0; i < ring.count; i++) {
        const yaw = (i / ring.count) * Math.PI * 2 + rIdx * 0.45;
        const pivot = new THREE.Group();
        pivot.rotation.y = yaw;

        const blade = new THREE.Mesh(cordilineBladeGeo, ring.mat);
        blade.rotation.x = ring.tilt;
        blade.scale.set(1.0, ring.len, 1.0);
        blade.castShadow = true;
        blade.receiveShadow = true;
        pivot.add(blade);
        g.add(pivot);
      }
    });

    parent.add(g);
  }

  // (D) Muréia / Jasmim-laranja (Murraya paniculata): folhagem em camadas + buquês brancos
  function addMureia(x, z, scale = 1.0, withMulch = true, yOffset = BASE_Y) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);
    g.scale.setScalar(scale);

    if (withMulch) addMulchRing(g, 0.70);

    const lobes = [
      [0.0, 0.44, 0.0, 1.04, 0, mureiaFoliageMat],
      [-0.26, 0.36, 0.22, 0.78, 1, mureiaFoliageLightMat],
      [0.28, 0.38, -0.22, 0.78, 2, mureiaFoliageMat],
      [-0.22, 0.34, -0.24, 0.72, 1, mureiaFoliageLightMat],
      [0.18, 0.48, 0.20, 0.66, 2, mureiaFoliageLightMat]
    ];
    for (const [lx, ly, lz, lr, geoIdx, mat] of lobes) {
      const m = new THREE.Mesh(shrubLeafGeos[geoIdx], mat);
      m.position.set(lx, ly, lz);
      m.scale.set(lr, lr * 0.84, lr);
      m.rotation.y = lx * 2.5 + lz;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    const whiteBlossoms = [
      [0.05, 0.84, 0.08],
      [-0.30, 0.68, 0.28],
      [0.34, 0.66, 0.20],
      [-0.28, 0.66, -0.26],
      [0.26, 0.68, -0.28],
      [0.0, 0.62, 0.44],
      [-0.44, 0.54, 0.04],
      [0.44, 0.56, -0.05]
    ];
    whiteBlossoms.forEach(([bx, by, bz], idx) => {
      const b = new THREE.Mesh(blossomClusterGeo, mureiaFlowerMat);
      b.position.set(bx, by, bz);
      b.scale.setScalar(0.75);
      b.rotation.y = idx * 0.85;
      g.add(b);
    });

    landscapingGroup.add(g);
  }

  // (E) Pingo-de-Ouro (Duranta erecta): folhagem orgânica verde-limão / dourado natural
  function addPingoDeOuro(x, z, scale = 1.0, withMulch = true, yOffset = BASE_Y) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);
    g.scale.setScalar(scale);

    if (withMulch) addMulchRing(g, 0.68);

    const core = new THREE.Mesh(shrubLeafGeos[0], pingoOuroBaseMat);
    core.position.y = 0.34;
    core.scale.set(1.02, 0.78, 1.02);
    core.castShadow = true;
    core.receiveShadow = true;
    g.add(core);

    const puffs = [
      [0.0, 0.54, 0.0, 0.72, 1, pingoOuroGoldMat],
      [-0.25, 0.44, 0.20, 0.60, 2, pingoOuroLimeMat],
      [0.25, 0.44, -0.20, 0.60, 1, pingoOuroLimeMat],
      [0.20, 0.46, 0.22, 0.56, 2, pingoOuroGoldMat],
      [-0.22, 0.44, -0.20, 0.56, 0, pingoOuroGoldMat]
    ];
    for (const [px, py, pz, pr, geoIdx, mat] of puffs) {
      const p = new THREE.Mesh(shrubLeafGeos[geoIdx], mat);
      p.position.set(px, py, pz);
      p.scale.set(pr, pr * 0.76, pr);
      p.rotation.y = px * 3.0 - pz * 2.0;
      p.castShadow = true;
      p.receiveShadow = true;
      g.add(p);
    }

    landscapingGroup.add(g);
  }

  // Capim Ornamental / Gramínea de borda (Pennisetum / Liriope) para decks, pergolado e casas
  function addOrnamentalGrass(x, z, scale = 1.0, withPlumes = false, withMulch = true, yOffset = BASE_Y) {
    const g = new THREE.Group();
    g.position.set(x, yOffset, z);
    g.scale.setScalar(scale);

    if (withMulch) addMulchRing(g, 0.46);

    const useAlt = (Math.round((x + z) * 10) & 1) === 0;
    const tuft = new THREE.Mesh(
      useAlt ? grassTuftGeoA : grassTuftGeoB,
      useAlt ? grassLeafMat : grassVariegatedMat
    );
    tuft.position.y = 0.03;
    tuft.rotation.y = ((x * 0.73 + z * 1.31) % (Math.PI * 2));
    tuft.castShadow = true;
    tuft.receiveShadow = true;
    g.add(tuft);

    if (withPlumes) {
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        const plume = new THREE.Mesh(grassPlumeGeo, grassPlumeMat);
        plume.position.set(Math.cos(ang) * 0.16, 0.52 + (i % 2) * 0.06, Math.sin(ang) * 0.16);
        plume.rotation.set(Math.sin(ang) * 0.32, ang, -Math.cos(ang) * 0.32);
        g.add(plume);
      }
    }

    landscapingGroup.add(g);
  }

  // Sebe aparada em camadas botânicas (base de casca escura + volume foliado orgânico uniforme)
  function addManicuredHedge(x, z, w, d, h = 0.52, isGolden = true) {
    const hg = new THREE.Group();
    hg.position.set(x, BASE_Y, z);

    // Leito de terra/casca escura na base da sebe
    const mulchBed = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.045, d + 0.14), mulchMat);
    mulchBed.position.y = 0.022;
    mulchBed.receiveShadow = true;
    hg.add(mulchBed);

    const baseMat = isGolden ? pingoOuroBaseMat : mureiaFoliageMat;
    const midMat = isGolden ? pingoOuroLimeMat : mureiaFoliageLightMat;

    const alongX = w >= d;
    const span = alongX ? w : d;
    const thick = alongX ? d : w;

    // Núcleo interno compacto totalmente envolvido pelos tufos foliares (evita frestas na base)
    const innerCore = new THREE.Mesh(hedgeCoreGeo, baseMat);
    innerCore.scale.set(alongX ? w * 0.72 : w * 0.40, h * 0.44, alongX ? d * 0.40 : d * 0.72);
    innerCore.position.y = h * 0.27;
    innerCore.castShadow = true;
    innerCore.receiveShadow = true;
    hg.add(innerCore);

    // Revestimento botânico denso e contínuo ao longo de todo o comprimento, topo e laterais
    const baseRadii = [0.56, 0.48, 0.38];
    const baseYRadii = [0.4256, 0.3552, 0.2736];
    const halfThickTarget = Math.max(0.26, thick * 0.54);
    const halfHeightTarget = h * 0.50;
    const count = Math.max(5, Math.round(span / (halfThickTarget * 0.85)));

    for (let i = 0; i < count; i++) {
      const geoIdx = i % shrubLeafGeos.length;
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
      const offset = t * Math.max(0.05, span - halfThickTarget * 1.45);
      const mat = i % 3 === 0 ? baseMat : midMat;
      const tuft = new THREE.Mesh(shrubLeafGeos[geoIdx], mat);
      const jitter = (hash3(i, x, z) - 0.5) * thick * 0.12;
      const hVar = 0.94 + (i % 3) * 0.05;
      tuft.position.set(
        alongX ? offset : jitter,
        h * 0.50 + (i % 2) * 0.015,
        alongX ? jitter : offset
      );
      const sRad = halfThickTarget / baseRadii[geoIdx];
      const sH = (halfHeightTarget * hVar) / baseYRadii[geoIdx];
      tuft.scale.set(sRad, sH, sRad);
      tuft.rotation.y = i * 1.15 + hash3(i, z, x);
      tuft.castShadow = true;
      tuft.receiveShadow = true;
      hg.add(tuft);
    }

    landscapingGroup.add(hg);
  }

  // (F) Grama-Amendoim (Arachis repens): borda orgânica de solo + forração densa texturizada
  function addGramaAmendoimPatch(x, z, radiusX = 1.4, radiusZ = 1.4, parent = landscapingGroup, yOffset = BASE_Y) {
    const pg = new THREE.Group();
    pg.position.set(x, yOffset, z);

    // Borda sutil de solo escuro sob a forração
    const soilRim = new THREE.Mesh(gramaAmendoimUnitGeo, mulchMat);
    soilRim.position.y = 0.03;
    soilRim.scale.set(radiusX * 1.04, 0.45, radiusZ * 1.04);
    soilRim.receiveShadow = true;
    pg.add(soilRim);

    const cushion = new THREE.Mesh(gramaAmendoimUnitGeo, gramaAmendoimMat);
    cushion.position.y = 0.09;
    cushion.scale.set(radiusX, 1.0, radiusZ);
    cushion.receiveShadow = true;
    pg.add(cushion);

    // Pequenas flores amarelas orgânicas sobre o tapete
    const dotCount = Math.min(12, Math.max(4, Math.round(radiusX * radiusZ * 2.5)));
    for (let i = 0; i < dotCount; i++) {
      const ang = (i / dotCount) * Math.PI * 2 + (i % 3) * 0.4;
      const r = (0.28 + ((i * 37) % 60) / 100) * 0.82;
      const dot = new THREE.Mesh(singleFlowerGeo, gramaAmendoimFlowerMat);
      dot.position.set(Math.cos(ang) * r * radiusX, 0.175, Math.sin(ang) * r * radiusZ);
      dot.scale.set(0.7, 0.48, 0.7);
      dot.rotation.y = ang;
      pg.add(dot);
    }

    parent.add(pg);
  }

  // ==========================================================================
  // 3. ÁRVORE DE SOMBRA — PAU-FERRO (Caesalpinia ferrea) — FIEL À PRANCHA 2
  // ==========================================================================
  function addPauFerroTree(x, z, scale = 1.0, withPlanterRing = true, withFlankingBollards = false) {
    const tg = new THREE.Group();
    tg.position.set(x, BASE_Y, z);
    tg.scale.setScalar(scale);

    if (withPlanterRing) {
      const ringOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.70, 0.24, 20), curbMat);
      ringOuter.position.y = 0.12;
      ringOuter.castShadow = true;
      ringOuter.receiveShadow = true;
      tg.add(ringOuter);

      addGramaAmendoimPatch(0, 0, 1.48, 1.48, tg, 0.08);
    } else {
      addGramaAmendoimPatch(0, 0, 1.15, 1.15, tg, 0.02);
    }

    // Plano B procedural caso os modelos GLB reais não carreguem
    arvoresProcedurais.push(() => {
      const mainTrunk = new THREE.Mesh(
        createCurvedLimbGeo(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.06, 0.9, -0.04),
          new THREE.Vector3(0.02, 1.75, 0.03),
          0.34,
          0.19,
          5,
          8,
          17
        ),
        pauFerroBarkMat
      );
      mainTrunk.castShadow = true;
      mainTrunk.receiveShadow = true;
      tg.add(mainTrunk);

      const branchSpecs = [
        [new THREE.Vector3(0.02, 1.65, 0.02), new THREE.Vector3(0.55, 2.25, 0.35), new THREE.Vector3(1.15, 2.75, 0.68), 0.15, 0.07],
        [new THREE.Vector3(0.0, 1.70, 0.0), new THREE.Vector3(-0.55, 2.30, 0.30), new THREE.Vector3(-1.12, 2.78, 0.62), 0.15, 0.07],
        [new THREE.Vector3(0.02, 1.68, 0.0), new THREE.Vector3(0.45, 2.28, -0.52), new THREE.Vector3(1.02, 2.82, -0.92), 0.14, 0.065],
        [new THREE.Vector3(0.0, 1.72, 0.0), new THREE.Vector3(-0.48, 2.32, -0.48), new THREE.Vector3(-1.05, 2.84, -0.88), 0.14, 0.065],
        [new THREE.Vector3(0.02, 1.75, 0.02), new THREE.Vector3(0.08, 2.55, 0.05), new THREE.Vector3(0.15, 3.35, -0.08), 0.13, 0.06]
      ];
      branchSpecs.forEach(([p0, pc, p1, r0, r1], bIdx) => {
        const br = new THREE.Mesh(createCurvedLimbGeo(p0, pc, p1, r0, r1, 4, 6, 30 + bIdx), pauFerroBarkMat);
        br.castShadow = true;
        tg.add(br);
      });

      const canopyClusters = [
        [0.0, 3.35, 0.0, 2.55, 0.72, pauFerroMidMat],
        [-1.25, 2.85, 0.72, 1.88, 0.72, pauFerroDarkMat],
        [1.25, 2.88, -0.68, 1.90, 0.72, pauFerroDarkMat],
        [0.85, 2.95, 1.05, 1.82, 0.74, pauFerroBrightMat],
        [-0.95, 2.92, -0.95, 1.85, 0.74, pauFerroMidMat],
        [-1.45, 2.75, -0.15, 1.65, 0.70, pauFerroDarkMat],
        [1.42, 2.78, 0.25, 1.68, 0.70, pauFerroMidMat],
        [0.15, 2.85, -1.38, 1.70, 0.72, pauFerroDarkMat],
        [-0.18, 2.88, 1.35, 1.70, 0.72, pauFerroMidMat],
        [-0.65, 3.72, 0.45, 1.75, 0.68, pauFerroBrightMat],
        [0.68, 3.75, -0.38, 1.72, 0.68, pauFerroBrightMat],
        [0.0, 4.05, 0.0, 1.92, 0.66, pauFerroBrightMat]
      ];
      canopyClusters.forEach(([cx, cy, cz, cs, sy, mat], idx) => {
        const m = new THREE.Mesh(shrubLeafGeos[idx % shrubLeafGeos.length], mat);
        m.position.set(cx, cy, cz);
        m.scale.set(cs, cs * sy, cs);
        m.rotation.set(idx * 0.4, idx * 0.7, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        tg.add(m);
      });

      const blossomSpots = [
        [0.45, 4.42, 0.35],
        [-0.55, 4.35, -0.28],
        [0.95, 3.78, 0.65],
        [-1.05, 3.68, 0.55],
        [0.82, 3.72, -0.82],
        [-0.75, 3.85, -0.75],
        [0.0, 4.55, -0.15]
      ];
      for (const [bx, by, bz] of blossomSpots) {
        const sp = new THREE.Mesh(blossomClusterGeo, pauFerroBlossomMat);
        sp.position.set(bx, by, bz);
        sp.scale.set(1.15, 0.75, 1.15);
        tg.add(sp);
      }
    });
    arvoresReais.folhosa.push({ x, y: BASE_Y + (withPlanterRing ? 0.2 : 0.02) * scale, z, altura: 4.4 * scale });

    landscapingGroup.add(tg);

    if (withFlankingBollards) {
      addBollardLight(x - 1.75 * scale, z + 0.5 * scale, 0.85 * scale);
      addBollardLight(x + 1.75 * scale, z + 0.5 * scale, 0.85 * scale);
    }
  }

  // ==========================================================================
  // 4. PALMEIRA IMPERIAL (Roystonea oleracea) — FIEL À PRANCHA 2, 3 E 4
  // ==========================================================================
  function addPalmeiraImperial(x, z, heightScale = 1.0, withBaseBollard = true, withPlanterRing = true, yBase = BASE_Y) {
    const pg = new THREE.Group();
    pg.position.set(x, yBase, z);
    pg.scale.setScalar(heightScale);

    if (withPlanterRing) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.40, 0.22, 18), curbMat);
      ring.position.y = 0.11;
      ring.castShadow = true;
      ring.receiveShadow = true;
      pg.add(ring);

      addGramaAmendoimPatch(0, 0, 1.20, 1.20, pg, 0.06);

      for (let c = 0; c < 3; c++) {
        const ang = (c / 3) * Math.PI * 2 + 0.3;
        addCordiline(Math.cos(ang) * 0.55, Math.sin(ang) * 0.55, 0.78, pg, 0.18);
      }
    } else {
      // Ilha floreira elevada (ex.: Piscina Infantil): bromélias e samambaias compactas na base
      for (let c = 0; c < 3; c++) {
        const ang = (c / 3) * Math.PI * 2 + 0.35;
        addCordiline(Math.cos(ang) * 0.24, Math.sin(ang) * 0.24, 0.56, pg, 0.0);
      }
      for (let f = 0; f < 4; f++) {
        const ang = (f / 4) * Math.PI * 2 + 0.8;
        const fern = new THREE.Mesh(grassTuftGeoB, f % 2 === 0 ? grassLeafMat : grassVariegatedMat);
        fern.position.set(Math.cos(ang) * 0.30, 0.0, Math.sin(ang) * 0.30);
        fern.scale.setScalar(0.56);
        fern.rotation.y = ang;
        fern.castShadow = true;
        fern.receiveShadow = true;
        pg.add(fern);
      }
    }

    // Plano B procedural caso os modelos GLB reais não carreguem
    arvoresProcedurais.push(() => {
      const estipeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 2.4, 12), palmTrunkMat);
      estipeLower.position.y = 1.20;
      estipeLower.castShadow = true;
      estipeLower.receiveShadow = true;
      pg.add(estipeLower);

      const estipeUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.3, 12), palmTrunkMat);
      estipeUpper.position.y = 3.55;
      estipeUpper.castShadow = true;
      estipeUpper.receiveShadow = true;
      pg.add(estipeUpper);

      const crownShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.20, 1.15, 12), palmCrownshaftMat);
      crownShaft.position.y = 5.18;
      crownShaft.castShadow = true;
      pg.add(crownShaft);

      for (const side of [-1, 1]) {
        const fruitCluster = new THREE.Mesh(blossomClusterGeo, palmFruitMat);
        fruitCluster.position.set(side * 0.22, 4.62, 0.08);
        fruitCluster.scale.set(1.4, 1.8, 1.4);
        pg.add(fruitCluster);
      }

      const totalFronds = 16;
      for (let i = 0; i < totalFronds; i++) {
        const tier = i % 3;
        const yaw = (i / totalFronds) * Math.PI * 2 + tier * 0.12;
        const frondGroup = new THREE.Group();
        frondGroup.position.y = 5.68 + (tier === 0 ? 0.10 : (tier === 1 ? 0.02 : -0.06));
        frondGroup.rotation.y = yaw;

        const fMat = tier === 0 ? palmFrondLightMat : palmFrondMat;
        const basePitch = tier === 0 ? -0.28 : (tier === 1 ? -0.04 : 0.18);

        const seg1 = new THREE.Group();
        seg1.rotation.x = basePitch;
        const blade1L = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.98), fMat);
        blade1L.rotation.x = Math.PI * 0.5;
        blade1L.rotation.y = 0.28;
        blade1L.position.set(-0.13, 0, 0.48);
        seg1.add(blade1L);

        const blade1R = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.98), fMat);
        blade1R.rotation.x = Math.PI * 0.5;
        blade1R.rotation.y = -0.28;
        blade1R.position.set(0.13, 0, 0.48);
        seg1.add(blade1R);

        const seg2 = new THREE.Group();
        seg2.position.set(0, 0, 0.94);
        seg2.rotation.x = 0.42 + tier * 0.10;

        const blade2L = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 1.05), fMat);
        blade2L.rotation.x = Math.PI * 0.5;
        blade2L.rotation.y = 0.32;
        blade2L.position.set(-0.14, 0, 0.50);
        blade2L.castShadow = true;
        seg2.add(blade2L);

        const blade2R = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 1.05), fMat);
        blade2R.rotation.x = Math.PI * 0.5;
        blade2R.rotation.y = -0.32;
        blade2R.position.set(0.14, 0, 0.50);
        blade2R.castShadow = true;
        seg2.add(blade2R);

        const seg3 = new THREE.Group();
        seg3.position.set(0, 0, 1.00);
        seg3.rotation.x = 0.52 + tier * 0.12;

        const tipCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 4), fMat);
        tipCone.rotation.x = Math.PI * 0.5;
        tipCone.scale.set(1.15, 1.0, 0.25);
        tipCone.position.set(0, 0, 0.46);
        seg3.add(tipCone);

        seg2.add(seg3);
        seg1.add(seg2);
        frondGroup.add(seg1);
        pg.add(frondGroup);
      }
    });
    arvoresReais.palmeira.push({
      x,
      y: withPlanterRing ? BASE_Y + 0.1 * heightScale : yBase,
      z,
      altura: 6.3 * heightScale
    });

    landscapingGroup.add(pg);

    if (withBaseBollard) {
      addBollardLight(x, z + 1.15 * heightScale, 0.92 * heightScale);
    }
  }

  // ==========================================================================
  // 5. IPÊ ROSA (Handroanthus heptaphyllus) — COPA BOTÂNICA ESCULPIDA EM
  //    CAMADAS AÉREAS + GALHOS TORTUOSOS + CANTEIRO ORGÂNICO COM PEDRAS
  // ==========================================================================
  function addIpeRosaSquareGarden(x, z, bedW = 7.0, bedD = 7.0, treeScale = 1.05, seed = 1) {
    const ig = new THREE.Group();
    ig.position.set(x, BASE_Y, z);

    // Mureta/meio-fio branco contornando o canteiro quadrado + gramado rico
    const curbBorder = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.28, 0.16, bedD + 0.28), curbMat);
    curbBorder.position.y = 0.08;
    curbBorder.receiveShadow = true;
    ig.add(curbBorder);

    const lawnBed = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.20, bedD), lawnRichMat);
    lawnBed.position.y = 0.10;
    lawnBed.receiveShadow = true;
    ig.add(lawnBed);

    // Canteiro circular orgânico de terra/casca escura com pétalas sutis integradas ao leito
    const bedRadius = 2.08;
    const mulchBedGeo = createOrganicPadGeo(bedRadius, 0.12, 28, 0.04, 500 + seed * 13);
    const mulchBed = new THREE.Mesh(mulchBedGeo, ipeMulchPetalsMat);
    mulchBed.position.y = 0.19;
    mulchBed.receiveShadow = true;
    ig.add(mulchBed);

    // Borda orgânica de pedras naturais ao redor do leito de casca escura
    const stoneCount = 30;
    for (let s = 0; s < stoneCount; s++) {
      const ang = (s / stoneCount) * Math.PI * 2 + (hash3(s, seed, 1) - 0.5) * 0.07;
      const rad = bedRadius * (0.98 + 0.04 * (Math.sin(ang * 3 + 500 + seed * 13) * 0.6 + Math.cos(ang * 5 - (500 + seed * 13) * 1.4) * 0.4));
      const stone = new THREE.Mesh(
        stoneCobbleGeos[s % stoneCobbleGeos.length],
        s % 2 === 0 ? stoneEdgeMatA : stoneEdgeMatB
      );
      stone.position.set(Math.cos(ang) * rad, 0.22, Math.sin(ang) * rad);
      stone.rotation.set(
        (hash3(s, seed, 2) - 0.5) * 0.25,
        ang + hash3(s, seed, 3) * 1.4,
        (hash3(s, seed, 4) - 0.5) * 0.25
      );
      const sc = 0.78 + hash3(s, seed, 5) * 0.55;
      stone.scale.set(sc * 1.15, sc * 0.88, sc);
      stone.castShadow = true;
      stone.receiveShadow = true;
      ig.add(stone);
    }

    // Pétalas 3D discretas espalhadas organicamente sobre a casca escura (foscas, zero brilho)
    const petalMats = [ipePlumMat, ipeSakuraMat, ipeBlushMat, ipeCreamMat];
    for (let p = 0; p < 34; p++) {
      const pocket = p % 5;
      const baseAng = pocket * 1.25 + seed * 0.7 + (hash3(p, seed, 10) - 0.5) * 0.85;
      const rad = 0.42 + hash3(p, seed, 11) * 1.38;
      const mulchSurfaceY = 0.25 + 0.018 * (1 - Math.min(1, rad / bedRadius));
      const petalTuft = new THREE.Mesh(ipeTipGeo, petalMats[(p + seed) % petalMats.length]);
      petalTuft.position.set(Math.cos(baseAng) * rad, mulchSurfaceY + 0.012, Math.sin(baseAng) * rad);
      petalTuft.rotation.y = hash3(p, seed, 12) * Math.PI * 2;
      const pSc = 0.22 + hash3(p, seed, 13) * 0.16;
      petalTuft.scale.set(pSc * 1.2, 0.08, pSc);
      petalTuft.receiveShadow = true;
      ig.add(petalTuft);
    }

    // Árvore real (assets/arvores/ipe.glb, desenhada por instâncias em src/arvores.js) no centro
    // do canteiro. Altura ~4.8 m (copa ~5.3 m de largura) na escala `treeScale` do canteiro.
    arvoresReais.ipe.push({ x, y: BASE_Y + 0.24, z, altura: 4.8 * treeScale });

    // Plano B procedural (Ipê Rosa escultural) — só desenha se os modelos GLB não carregarem
    arvoresProcedurais.push(() => {
    const treeGroup = new THREE.Group();
    treeGroup.position.y = 0.24;
    treeGroup.rotation.y = seed * 1.18;
    treeGroup.scale.setScalar(treeScale);

    // Raízes tabulares na base do tronco
    for (let r = 0; r < 5; r++) {
      const rAng = (r / 5) * Math.PI * 2 + hash3(r, seed, 20) * 0.4;
      const rootGeo = createCurvedLimbGeo(
        new THREE.Vector3(Math.cos(rAng) * 0.16, 0.36, Math.sin(rAng) * 0.16),
        new THREE.Vector3(Math.cos(rAng) * 0.34, 0.14, Math.sin(rAng) * 0.34),
        new THREE.Vector3(Math.cos(rAng) * 0.56, -0.02, Math.sin(rAng) * 0.56),
        0.13,
        0.035,
        3,
        6,
        seed * 10 + r
      );
      const rootMesh = new THREE.Mesh(rootGeo, ipeBarkMat);
      rootMesh.castShadow = true;
      rootMesh.receiveShadow = true;
      treeGroup.add(rootMesh);
    }

    // Tronco principal tortuoso e afunilado com leve sinuosidade
    const trunkTop = new THREE.Vector3(
      (hash3(1, seed, 21) - 0.5) * 0.18,
      1.78,
      (hash3(2, seed, 22) - 0.5) * 0.18
    );
    const trunkMid = new THREE.Vector3(
      trunkTop.x * 0.45 + 0.09,
      0.92,
      trunkTop.z * 0.45 - 0.07
    );
    const trunkMesh = new THREE.Mesh(
      createCurvedLimbGeo(new THREE.Vector3(0, -0.04, 0), trunkMid, trunkTop, 0.32, 0.18, 6, 9, seed * 31),
      ipeBarkMat
    );
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // 5 Galhos primários + 15 secundários + 22 raminhos terciários suportando a copa
    const canopyAnchors = [];
    const primaryCount = 5;
    for (let b = 0; b < primaryCount; b++) {
      const yaw = (b / primaryCount) * Math.PI * 2 + (hash3(b, seed, 30) - 0.5) * 0.35;
      const spread = 1.05 + hash3(b, seed, 31) * 0.35;
      const height = 2.65 + hash3(b, seed, 32) * 0.42;

      const p0 = trunkTop.clone().add(new THREE.Vector3(0, -0.14 + (b % 2) * 0.08, 0));
      const p1 = new THREE.Vector3(Math.cos(yaw) * spread, height, Math.sin(yaw) * spread);
      const pCtrl = new THREE.Vector3()
        .addVectors(p0, p1)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(Math.sin(yaw) * 0.18, 0.24, -Math.cos(yaw) * 0.18));

      const pMesh = new THREE.Mesh(
        createCurvedLimbGeo(p0, pCtrl, p1, 0.145, 0.078, 5, 7, seed * 40 + b),
        ipeBarkMat
      );
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      treeGroup.add(pMesh);

      // 3 Galhos secundários por galho primário
      const secCount = 3;
      for (let s = 0; s < secCount; s++) {
        const sYaw = yaw + (s - 1) * 0.62 + (hash3(b * 5 + s, seed, 40) - 0.5) * 0.22;
        const sLen = 0.88 + hash3(b * 5 + s, seed, 41) * 0.45;
        const sLift = 0.62 + (s === 1 ? 0.48 : 0.15) + hash3(b * 5 + s, seed, 42) * 0.28;

        const s0 = s === 1 ? p1.clone() : new THREE.Vector3().lerpVectors(p0, p1, 0.68 + s * 0.14);
        const s1 = s0.clone().add(new THREE.Vector3(Math.cos(sYaw) * sLen, sLift, Math.sin(sYaw) * sLen));
        const sCtrl = new THREE.Vector3()
          .addVectors(s0, s1)
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(0, 0.18, 0));

        const sMesh = new THREE.Mesh(
          createCurvedLimbGeo(s0, sCtrl, s1, 0.074, 0.036, 4, 6, seed * 55 + b * 7 + s),
          ipeBarkMat
        );
        sMesh.castShadow = true;
        treeGroup.add(sMesh);
        canopyAnchors.push({ pos: s1.clone(), tier: s === 1 ? 2 : 1 });

        // 1 a 2 raminhos terciários estendendo o galho secundário até as pontas floridas
        const twigCount = s === 1 ? 2 : 1;
        for (let tw = 0; tw < twigCount; tw++) {
          const twYaw = sYaw + (tw === 0 ? -0.42 : 0.44) + (hash3(b * 11 + s * 3 + tw, seed, 50) - 0.5) * 0.2;
          const twLen = 0.52 + hash3(b * 11 + tw, seed, 51) * 0.26;
          const twLift = 0.34 + hash3(s * 7 + tw, seed, 52) * 0.25;
          const t1 = s1.clone().add(new THREE.Vector3(Math.cos(twYaw) * twLen, twLift, Math.sin(twYaw) * twLen));
          const tCtrl = new THREE.Vector3().addVectors(s1, t1).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.08, 0));

          const twMesh = new THREE.Mesh(
            createCurvedLimbGeo(s1, tCtrl, t1, 0.034, 0.016, 3, 5, seed * 71 + b * 9 + tw),
            ipeBarkMat
          );
          twMesh.castShadow = true;
          treeGroup.add(twMesh);
          canopyAnchors.push({ pos: t1.clone(), tier: 3 });
        }
      }
    }

    // Galho central elevado para estruturar o topo da copa
    const crownP1 = trunkTop.clone().add(new THREE.Vector3(0.06, 1.75, -0.05));
    const crownCtrl = trunkTop.clone().add(new THREE.Vector3(-0.14, 0.92, 0.12));
    const crownLimb = new THREE.Mesh(
      createCurvedLimbGeo(trunkTop, crownCtrl, crownP1, 0.12, 0.045, 4, 6, seed * 89),
      ipeBarkMat
    );
    crownLimb.castShadow = true;
    treeGroup.add(crownLimb);
    canopyAnchors.push({ pos: crownP1.clone(), tier: 3 });
    for (let ct = 0; ct < 4; ct++) {
      const cAng = (ct / 4) * Math.PI * 2 + 0.4;
      const cTip = crownP1.clone().add(new THREE.Vector3(Math.cos(cAng) * 0.72, 0.42 + (ct % 2) * 0.16, Math.sin(cAng) * 0.72));
      const cTw = new THREE.Mesh(
        createCurvedLimbGeo(crownP1, crownP1.clone().lerp(cTip, 0.5).add(new THREE.Vector3(0, 0.1, 0)), cTip, 0.042, 0.018, 3, 5, seed * 97 + ct),
        ipeBarkMat
      );
      cTw.castShadow = true;
      treeGroup.add(cTw);
      canopyAnchors.push({ pos: cTip, tier: 3 });
    }

    // Copa exuberante composta por ~78 sprays florais irregulares em camadas arejadas
    // (Profundidade sombreada no interior + camadas médias + pontas claras iluminadas pelo sol)
    let sprayIdx = 0;
    for (const anchor of canopyAnchors) {
      const subClusters = anchor.tier >= 3 ? 2 : 2;
      for (let k = 0; k < subClusters; k++) {
        const sAng = hash3(sprayIdx, seed, 60) * Math.PI * 2;
        const sDist = 0.14 + hash3(sprayIdx, seed, 61) * 0.42;
        const dy = (hash3(sprayIdx, seed, 62) - 0.35) * 0.34 + (k === 1 ? 0.18 : -0.05);

        const cx = anchor.pos.x + Math.cos(sAng) * sDist;
        const cy = anchor.pos.y + dy;
        const cz = anchor.pos.z + Math.sin(sAng) * sDist;

        // Seleção botânica de tom pela altura & distância radial (sombra interna -> luz externa)
        const radNorm = Math.hypot(cx, cz) / 2.6;
        const heightNorm = THREE.MathUtils.clamp((cy - 2.4) / 2.2, 0, 1);
        const lightScore = heightNorm * 0.65 + radNorm * 0.25 + (hash3(sprayIdx, seed, 63) - 0.5) * 0.25;

        let mat;
        if (lightScore < 0.34) mat = ipePlumMat;        // #9d174d — sombra interna profunda
        else if (lightScore < 0.64) mat = ipeSakuraMat; // #db6195 — rosa sakura natural
        else if (lightScore < 0.87) mat = ipeBlushMat;  // #f3a6c8 — blush suave
        else mat = ipeCreamMat;                         // #fbe2ee — pontas creme-rosa ao sol

        const geo =
          k === 1 && anchor.tier >= 3
            ? ipeTipGeo
            : ipeSprayGeos[sprayIdx % ipeSprayGeos.length];

        const spray = new THREE.Mesh(geo, mat);
        spray.position.set(cx, cy, cz);

        const baseScale = k === 1 && anchor.tier >= 3
          ? (1.02 + hash3(sprayIdx, seed, 64) * 0.36)
          : (0.88 + hash3(sprayIdx, seed, 64) * 0.34);
        spray.scale.set(
          baseScale * (0.92 + hash3(sprayIdx, seed, 65) * 0.22),
          baseScale * (0.82 + hash3(sprayIdx, seed, 66) * 0.20),
          baseScale * (0.92 + hash3(sprayIdx, seed, 67) * 0.22)
        );
        spray.rotation.set(
          (hash3(sprayIdx, seed, 68) - 0.5) * 0.45,
          hash3(sprayIdx, seed, 69) * Math.PI * 2,
          (hash3(sprayIdx, seed, 70) - 0.5) * 0.45
        );
        spray.castShadow = true;
        spray.receiveShadow = true;
        treeGroup.add(spray);
        sprayIdx++;
      }
    }

    // Sprays adicionais de preenchimento interno sombreado para dar volume sem virar bola
    for (let inner = 0; inner < 10; inner++) {
      const iAng = (inner / 10) * Math.PI * 2 + seed * 0.5;
      const iRad = 0.55 + hash3(inner, seed, 80) * 0.75;
      const iy = 2.65 + hash3(inner, seed, 81) * 0.72;
      const mat = inner % 3 === 0 ? ipeSakuraMat : ipePlumMat;
      const innerSpray = new THREE.Mesh(ipeSprayGeos[inner % ipeSprayGeos.length], mat);
      innerSpray.position.set(Math.cos(iAng) * iRad, iy, Math.sin(iAng) * iRad);
      const sc = 0.86 + hash3(inner, seed, 82) * 0.28;
      innerSpray.scale.set(sc, sc * 0.85, sc);
      innerSpray.rotation.y = iAng + 0.9;
      innerSpray.castShadow = true;
      innerSpray.receiveShadow = true;
      treeGroup.add(innerSpray);
    }

    ig.add(treeGroup);
    });
    landscapingGroup.add(ig);

    // Arbustos complementares nos 4 cantos do canteiro do Ipê Rosa + 4 Balizadores Luminosos
    const cxOff = bedW * 0.36;
    const czOff = bedD * 0.36;
    const bedSurfaceY = BASE_Y + 0.19;
    addIxora(x - cxOff, z + czOff, 0.82, true, bedSurfaceY);
    addHibisco(x + cxOff, z + czOff, 0.82, true, bedSurfaceY);
    addPingoDeOuro(x - cxOff, z - czOff, 0.85, true, bedSurfaceY);
    addMureia(x + cxOff, z - czOff, 0.82, true, bedSurfaceY);
    addCordiline(x - cxOff * 0.55, z + czOff * 0.85, 0.80, landscapingGroup, bedSurfaceY);
    addCordiline(x + cxOff * 0.55, z + czOff * 0.85, 0.80, landscapingGroup, bedSurfaceY);

    // 4 Balizadores arquitetônicos nos cantos da praça do Ipê Rosa
    const lxOff = bedW * 0.44;
    const lzOff = bedD * 0.44;
    addBollardLight(x - lxOff, z - lzOff, 0.95, bedSurfaceY);
    addBollardLight(x + lxOff, z - lzOff, 0.95, bedSurfaceY);
    addBollardLight(x - lxOff, z + lzOff, 0.95, bedSurfaceY);
    addBollardLight(x + lxOff, z + lzOff, 0.95, bedSurfaceY);
  }

  // ==========================================================================
  // 5B. TREPADEIRAS & BUGANVÍLIAS NO PERGOLADO, ÁRVORE COMPACTA DAS CASAS
  //     E TOQUES PONTUAIS DE FLORAÇÃO AMARELA (IPÊ AMARELO)
  // ==========================================================================

  // Trepadeiras verdes e cachos de buganvília rosa-magenta sobre vigas e caibros do Pergolado
  function addPergolaBougainvillea() {
    const pg = new THREE.Group();
    const cx = -27.6;
    const cz = 16.4;
    const postHalfX = 2.16; // x ∈ [-29.76, -25.44]
    const beamHalfZ = 2.65; // z ∈ [13.75, 19.05]
    const rafterTopY = BASE_Y + 3.28;
    const beamY = BASE_Y + 3.06;

    // Ramos lenhosos trepando pelos pilares das extremidades até as vigas e caibros
    for (const sx of [-1, 1]) {
      const px = cx + sx * postHalfX;
      for (const sz of [-1, 1]) {
        const pz = cz + sz * 2.42;
        const stem = new THREE.Mesh(
          createCurvedLimbGeo(
            new THREE.Vector3(px + sx * 0.14, BASE_Y + 0.14, pz + sz * 0.12),
            new THREE.Vector3(px + sx * 0.22, BASE_Y + 1.65, pz - sz * 0.15),
            new THREE.Vector3(px, beamY + 0.10, pz),
            0.055,
            0.028,
            5,
            5,
            700 + sx * 3 + sz
          ),
          ipeBarkMat
        );
        stem.castShadow = true;
        pg.add(stem);

        // Tufos foliares escalando o pilar
        for (let h = 0; h < 4; h++) {
          const t = (h + 1) / 4;
          const lf = new THREE.Mesh(
            shrubLeafGeos[(h + (sx > 0 ? 1 : 0)) % shrubLeafGeos.length],
            h % 2 === 0 ? mureiaFoliageMat : mureiaFoliageLightMat
          );
          lf.position.set(
            px + sx * (0.14 + Math.sin(h) * 0.06),
            BASE_Y + 0.65 + t * 2.15,
            pz + sz * 0.10
          );
          lf.scale.setScalar(0.38 + (h % 2) * 0.08);
          lf.rotation.y = h * 1.4 + sx;
          lf.castShadow = true;
          pg.add(lf);
        }
      }

      // Ramos horizontais correndo ao longo das vigas laterais
      const runner = new THREE.Mesh(
        createCurvedLimbGeo(
          new THREE.Vector3(px, beamY + 0.06, cz - beamHalfZ),
          new THREE.Vector3(px - sx * 0.16, beamY + 0.22, cz),
          new THREE.Vector3(px, beamY + 0.08, cz + beamHalfZ),
          0.036,
          0.026,
          6,
          5,
          720 + sx
        ),
        ipeBarkMat
      );
      runner.castShadow = true;
      pg.add(runner);
    }

    // Arcos cruzados sobre os caibros superiores (x ∈ [-30.0, -25.2], y ≈ BASE_Y + 3.28)
    for (const [rz, seed] of [[-2.35, 1], [-1.35, 2], [0.15, 3], [1.45, 4], [2.40, 5]]) {
      const zWorld = cz + rz;
      const arch = new THREE.Mesh(
        createCurvedLimbGeo(
          new THREE.Vector3(cx - 2.38, rafterTopY - 0.06, zWorld),
          new THREE.Vector3(cx + Math.sin(seed) * 0.35, rafterTopY + 0.16, zWorld + 0.15),
          new THREE.Vector3(cx + 2.38, rafterTopY - 0.06, zWorld),
          0.030,
          0.022,
          5,
          5,
          740 + seed
        ),
        ipeBarkMat
      );
      pg.add(arch);

      // Folhagem verde + cachos de buganvília sobre os caibros (deixando o miolo arejado)
      const xSpots = seed === 3 ? [-2.25, -1.55, 1.55, 2.25] : [-2.30, -1.45, -0.55, 0.65, 1.55, 2.30];
      xSpots.forEach((dx, idx) => {
        const px = cx + dx;
        const py = rafterTopY + (Math.abs(dx) > 2.0 ? -0.10 : 0.06);
        const pz = zWorld + (hash3(idx, seed, 1) - 0.5) * 0.36;

        const leaf = new THREE.Mesh(
          shrubLeafGeos[(idx + seed) % shrubLeafGeos.length],
          (idx + seed) % 2 === 0 ? mureiaFoliageMat : mureiaFoliageLightMat
        );
        leaf.position.set(px, py, pz);
        leaf.scale.set(0.68, 0.38, 0.68);
        leaf.rotation.y = idx * 1.1 + seed;
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        pg.add(leaf);

        // Cachos florais densos de buganvília (magenta / rosa-sakura / blush)
        const bMat = (idx + seed) % 3 === 0 ? ipePlumMat : ((idx + seed) % 2 === 0 ? ipeSakuraMat : ipeBlushMat);
        const bloom = new THREE.Mesh(ipeSprayGeos[(idx + seed) % ipeSprayGeos.length], bMat);
        bloom.position.set(px + (hash3(idx, seed, 2) - 0.5) * 0.24, py + 0.08, pz + (hash3(idx, seed, 3) - 0.5) * 0.24);
        const bScale = Math.abs(dx) > 2.0 ? 0.88 : 0.74;
        bloom.scale.set(bScale, bScale * 0.72, bScale);
        bloom.rotation.set(0.18 * (idx % 2), idx * 0.95, 0.15);
        bloom.castShadow = true;
        bloom.receiveShadow = true;
        pg.add(bloom);

        // Cachos pendentes nas pontas externas das vigas e caibros
        if (Math.abs(dx) > 2.0) {
          const hang = new THREE.Mesh(ipeTipGeo, (idx + seed) % 2 === 0 ? ipePlumMat : ipeSakuraMat);
          hang.position.set(px + Math.sign(dx) * 0.16, py - 0.26, pz);
          hang.scale.set(0.95, 1.35, 0.95);
          hang.castShadow = true;
          pg.add(hang);
        }
      });
    }

    landscapingGroup.add(pg);
  }

  // Pequena árvore ornamental florida compacta (~2.2m altura) para os jardins das 6 Casas
  function addCompactCourtyardTree(x, z, seed = 1) {
    const cg = new THREE.Group();
    cg.position.set(x, BASE_Y, z);

    addMulchRing(cg, 0.52);

    const trunkTop = new THREE.Vector3((hash3(1, seed, 1) - 0.5) * 0.08, 0.96, (hash3(2, seed, 1) - 0.5) * 0.08);
    const trunk = new THREE.Mesh(
      createCurvedLimbGeo(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.04, 0.48, -0.03),
        trunkTop,
        0.085,
        0.048,
        4,
        7,
        800 + seed
      ),
      ipeBarkMat
    );
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    cg.add(trunk);

    const branchCount = 4;
    for (let b = 0; b < branchCount; b++) {
      const ang = (b / branchCount) * Math.PI * 2 + seed * 0.65;
      const tip = new THREE.Vector3(Math.cos(ang) * 0.46, 1.56 + (b % 2) * 0.14, Math.sin(ang) * 0.46);
      const mid = trunkTop.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.1, 0));
      const br = new THREE.Mesh(createCurvedLimbGeo(trunkTop, mid, tip, 0.042, 0.018, 3, 5, 820 + seed * 5 + b), ipeBarkMat);
      br.castShadow = true;
      cg.add(br);

      const leafCluster = new THREE.Mesh(
        shrubLeafGeos[(b + seed) % shrubLeafGeos.length],
        b % 2 === 0 ? mureiaFoliageMat : mureiaFoliageLightMat
      );
      leafCluster.position.copy(tip).add(new THREE.Vector3(0, 0.10, 0));
      leafCluster.scale.set(0.86, 0.68, 0.86);
      leafCluster.rotation.y = ang;
      leafCluster.castShadow = true;
      leafCluster.receiveShadow = true;
      cg.add(leafCluster);

      // Florzinhas brancas / creme ornamentais na copa
      for (let f = 0; f < 3; f++) {
        const fAng = ang + (f - 1) * 0.55;
        const fl = new THREE.Mesh(blossomClusterGeo, mureiaFlowerMat);
        fl.position.set(
          tip.x + Math.cos(fAng) * 0.22,
          tip.y + 0.22 + (f === 1 ? 0.12 : 0.02),
          tip.z + Math.sin(fAng) * 0.22
        );
        fl.scale.setScalar(0.82);
        cg.add(fl);
      }
    }

    // Copa central de coroamento (altura total ~2.20m)
    const crownTop = new THREE.Mesh(shrubLeafGeos[seed % shrubLeafGeos.length], mureiaFoliageLightMat);
    crownTop.position.set(0, 1.88, 0);
    crownTop.scale.set(0.92, 0.72, 0.92);
    crownTop.castShadow = true;
    crownTop.receiveShadow = true;
    cg.add(crownTop);

    for (let tf = 0; tf < 4; tf++) {
      const tAng = (tf / 4) * Math.PI * 2 + 0.4;
      const tFl = new THREE.Mesh(blossomClusterGeo, mureiaFlowerMat);
      tFl.position.set(Math.cos(tAng) * 0.24, 2.08 + (tf % 2) * 0.08, Math.sin(tAng) * 0.24);
      tFl.scale.setScalar(0.80);
      cg.add(tFl);
    }

    landscapingGroup.add(cg);
  }

  // Toque pontual de floração amarela (Ipê Amarelo escultural em canteiros periféricos)
  function addIpeAmareloAccent(x, z, treeScale = 0.92, seed = 10) {
    const yg = new THREE.Group();
    yg.position.set(x, BASE_Y, z);

    const bedRadius = 1.65;
    const mulchBed = new THREE.Mesh(createOrganicPadGeo(bedRadius, 0.10, 22, 0.05, 900 + seed), mulchMat);
    mulchBed.position.y = 0.05;
    mulchBed.receiveShadow = true;
    yg.add(mulchBed);

    for (let s = 0; s < 22; s++) {
      const ang = (s / 22) * Math.PI * 2;
      const stone = new THREE.Mesh(
        stoneCobbleGeos[s % stoneCobbleGeos.length],
        s % 2 === 0 ? stoneEdgeMatA : stoneEdgeMatB
      );
      stone.position.set(Math.cos(ang) * bedRadius, 0.08, Math.sin(ang) * bedRadius);
      stone.rotation.y = ang + 0.5;
      stone.scale.setScalar(0.85);
      stone.castShadow = true;
      stone.receiveShadow = true;
      yg.add(stone);
    }

    // Árvore real (assets/arvores/ipe.glb) no centro do canteiro; altura ~4.4 m na escala do canteiro
    arvoresReais.ipe.push({ x, y: BASE_Y + 0.08, z, altura: 4.8 * treeScale });

    // Plano B procedural (Ipê Amarelo escultural) — só desenha se os modelos GLB não carregarem
    arvoresProcedurais.push(() => {
    const tg = new THREE.Group();
    tg.position.y = 0.08;
    tg.rotation.y = seed * 0.95;
    tg.scale.setScalar(treeScale);

    const trunkTop = new THREE.Vector3(0.06, 1.72, -0.05);
    const trunk = new THREE.Mesh(
      createCurvedLimbGeo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.08, 0.88, 0.06), trunkTop, 0.28, 0.16, 5, 8, 910 + seed),
      ipeBarkMat
    );
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tg.add(trunk);

    const goldMats = [ipeGoldDeepMat, ipeGoldMidMat, ipeGoldBrightMat, ipeGoldLightMat];
    const anchors = [];
    for (let b = 0; b < 5; b++) {
      const yaw = (b / 5) * Math.PI * 2 + 0.2;
      const p1 = new THREE.Vector3(Math.cos(yaw) * 1.12, 2.70 + (b % 2) * 0.22, Math.sin(yaw) * 1.12);
      const pc = trunkTop.clone().lerp(p1, 0.5).add(new THREE.Vector3(0, 0.20, 0));
      const br = new THREE.Mesh(createCurvedLimbGeo(trunkTop, pc, p1, 0.13, 0.065, 4, 6, 920 + b), ipeBarkMat);
      br.castShadow = true;
      tg.add(br);

      for (let s = 0; s < 3; s++) {
        const sYaw = yaw + (s - 1) * 0.6;
        const s1 = p1.clone().add(new THREE.Vector3(Math.cos(sYaw) * 0.85, 0.55 + (s === 1 ? 0.35 : 0.10), Math.sin(sYaw) * 0.85));
        const sb = new THREE.Mesh(
          createCurvedLimbGeo(p1, p1.clone().lerp(s1, 0.5).add(new THREE.Vector3(0, 0.12, 0)), s1, 0.06, 0.025, 3, 5, 940 + b * 3 + s),
          ipeBarkMat
        );
        sb.castShadow = true;
        tg.add(sb);
        anchors.push(s1);
      }
    }

    anchors.forEach((anch, aIdx) => {
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2 + aIdx * 0.7;
        const dist = 0.16 + hash3(aIdx * 3 + k, seed, 5) * 0.36;
        const cx = anch.x + Math.cos(ang) * dist;
        const cy = anch.y + (k === 1 ? 0.22 : -0.04);
        const cz = anch.z + Math.sin(ang) * dist;
        const score = THREE.MathUtils.clamp((cy - 2.6) / 1.8, 0, 1);
        const mIdx = score < 0.3 ? 0 : (score < 0.6 ? 1 : (score < 0.85 ? 2 : 3));
        const sp = new THREE.Mesh(
          k === 1 ? ipeTipGeo : ipeSprayGeos[(aIdx + k) % ipeSprayGeos.length],
          goldMats[mIdx]
        );
        sp.position.set(cx, cy, cz);
        const sc = 0.86 + hash3(aIdx + k, seed, 7) * 0.34;
        sp.scale.set(sc, sc * 0.78, sc);
        sp.rotation.y = ang;
        sp.castShadow = true;
        sp.receiveShadow = true;
        tg.add(sp);
      }
    });

    yg.add(tg);
    });
    landscapingGroup.add(yg);
  }

  // ==========================================================================
  // 6. DISTRIBUIÇÃO FIEL À PLANTA BAIXA GERAL (PRANCHA 1), ELEVAÇÃO (PRANCHA 3)
  //    E VISTA AÉREA 3D (PRANCHA 4)
  // ==========================================================================

  // A. Cinturão Perimetral Oeste (x = -46.8) e Leste (x = +46.8) de Pau-Ferro + Balizadores
  const perimeterZ = [-30.5, -19.5, -8.5, 2.5, 13.5, 22.8];
  for (const zPos of perimeterZ) {
    addPauFerroTree(-46.8, zPos, 0.96, true, false);
    addPauFerroTree(46.8, zPos, 0.96, true, false);

    addBollardLight(-46.2, zPos + 4.8, 0.92);
    addBollardLight(46.2, zPos + 4.8, 0.92);
  }
  addBollardLight(-46.2, -33.2, 0.88);
  addBollardLight(46.2, -33.2, 0.88);

  // Maciços arbustivos ao longo dos muros laterais entre as árvores Pau-Ferro
  for (let i = 0; i < perimeterZ.length - 1; i++) {
    const midZ = (perimeterZ[i] + perimeterZ[i + 1]) * 0.5;
    addPingoDeOuro(-47.2, midZ - 1.1, 0.85);
    addMureia(-47.2, midZ + 1.1, 0.85);
    addPingoDeOuro(47.2, midZ - 1.1, 0.85);
    addMureia(47.2, midZ + 1.1, 0.85);
  }

  // B. Cinturão Perimetral Norte (z = -32.2) e Jardins Norte entre Torres A–B e B–C
  const northPerimeterX = [-39.5, -19.2, -10.2, 0.0, 10.2, 19.2, 39.5];
  for (const xPos of northPerimeterX) {
    addPauFerroTree(xPos, -32.2, 0.94, true, false);
  }
  for (const lx of [-43.5, -34.5, -24.0, -14.5, -5.0, 5.0, 14.5, 24.0, 34.5, 43.5]) {
    addBollardLight(lx, -31.8, 0.90);
  }

  // Bosques gramados ao Norte entre Torres A-B (x = -14.5) e Torres B-C (x = +14.5)
  for (const bx of [-14.5, 14.5]) {
    addGramaAmendoimPatch(bx, -30.5, 3.2, 1.8);
    addHibisco(bx - 2.4, -30.2, 0.88, false, BASE_Y + 0.08);
    addIxora(bx + 2.4, -30.2, 0.88, false, BASE_Y + 0.08);
    addPingoDeOuro(bx, -29.2, 0.92, false, BASE_Y + 0.08);
  }

  // C. Árvores de Sombra Pau-Ferro de Destaque na Elevação Frontal (Prancha 3)
  addPauFerroTree(-39.5, -9.8, 1.05, true, false);
  addPauFerroTree(39.5, -9.8, 1.05, true, false);

  // D. Alamedas Duplas (Boulevards) entre Torres A–B (x = -14.5) e Torres B–C (x = +14.5)
  for (const bx of [-14.5, 14.5]) {
    addPalmeiraImperial(bx - 4.2, -16.2, 1.02, true);
    addPalmeiraImperial(bx + 4.2, -16.2, 1.02, true);
    addPalmeiraImperial(bx - 4.2, -25.2, 1.06, true);
    addPalmeiraImperial(bx + 4.2, -25.2, 1.06, true);

    addGramaAmendoimPatch(bx, -21.5, 1.1, 6.5);
    addCordiline(bx, -18.2, 0.85, landscapingGroup, BASE_Y + 0.12);
    addPingoDeOuro(bx, -21.5, 0.85, false, BASE_Y + 0.08);
    addCordiline(bx, -24.8, 0.85, landscapingGroup, BASE_Y + 0.12);

    addBollardLight(bx, -14.8, 0.92);
    addBollardLight(bx, -20.0, 0.92);
    addBollardLight(bx, -23.2, 0.92);
    addBollardLight(bx, -28.0, 0.92);

    for (const side of [-1, 1]) {
      const sx = bx + side * 4.3;
      addIxora(sx, -19.2, 0.82);
      addMureia(sx, -20.8, 0.85);
      addPingoDeOuro(sx, -22.5, 0.82);
    }
  }

  // Jardins nas bordas Sul e Norte das Torres A, B e C
  for (const tCfg of TOWERS_CONFIG.slice(0, 3)) {
    for (const sideX of [-1, 1]) {
      const gx = tCfg.x + sideX * 6.2;
      addManicuredHedge(gx, tCfg.z + 9.2, 4.6, 0.85, 0.50, true);
      addHibisco(gx + sideX * 2.6, tCfg.z + 9.2, 0.82);
      addBollardLight(gx, tCfg.z + 9.8, 0.90);
    }
  }

  // E. Entorno da Piscina Central (Setor ②) e Torres Médias D e E
  addPalmeiraImperial(-5.8, -7.2, 1.04, true);
  addPalmeiraImperial(5.8, -7.2, 1.04, true);
  addPalmeiraImperial(-6.8, -1.6, 1.06, true);
  addPalmeiraImperial(6.8, -1.6, 1.06, true);
  addPalmeiraImperial(-6.8, 10.6, 1.06, true);
  // Palmeira nascendo na ilha floreira elevada da Piscina Infantil Leste (sem anel branco no solo e sem balizador na água)
  addPalmeiraImperial(6.55, 10.9, 1.0, false, false, BASE_Y + 0.43);

  addPalmeiraImperial(-6.4, 17.6, 0.84, true);
  addPalmeiraImperial(6.4, 17.6, 0.84, true);

  // Canteiros longitudinais entre o deck da Piscina (x = ±6.9) e os passeios (x = ±7.1..9.3)
  // No lado Leste (side === 1), preserva o vão z ∈ [7.8, 14.3] ocupado pela Piscina Infantil
  for (const side of [-1, 1]) {
    const px = side * 6.8;
    const isEast = side === 1;
    if (isEast) {
      addGramaAmendoimPatch(px, 0.1, 0.95, 7.2);
      addGramaAmendoimPatch(px, 15.6, 0.95, 1.1);
    } else {
      addGramaAmendoimPatch(px, 4.2, 0.95, 11.5);
    }

    addHibisco(px, -4.5, 0.82, false, BASE_Y + 0.08);
    addPingoDeOuro(px, 1.2, 0.85, false, BASE_Y + 0.08);
    addIxora(px, 4.2, 0.85, false, BASE_Y + 0.08);
    addPingoDeOuro(px, 7.2, 0.85, false, BASE_Y + 0.08);
    if (isEast) {
      addMureia(px, 14.8, 0.85, false, BASE_Y + 0.08);
    } else {
      addMureia(px, 13.8, 0.85, false, BASE_Y + 0.08);
    }
    addCordiline(px, 15.8, 0.85, landscapingGroup, BASE_Y + 0.12);

    // Enriquecimento com capins ornamentais e folhagens de borda ao longo do deck da piscina
    for (const [gz, gScale, hasPlume] of [
      [-3.1, 0.92, true],
      [-0.1, 0.86, false],
      [2.7, 0.94, true],
      [5.7, 0.88, false],
      [8.4, 0.92, true],
      [12.3, 0.90, false],
      [14.7, 0.88, true]
    ]) {
      if (isEast && gz >= 7.8 && gz <= 14.3) continue;
      addOrnamentalGrass(side * 6.76, gz, gScale, hasPlume, false, BASE_Y + 0.12);
    }

    // Cantos externos ao sul dos ombrelones da piscina (sem obstruir passeio sul z = 17.4..19.6)
    addOrnamentalGrass(side * 4.75, 16.65, 0.95, true, true);

    for (const lz of [-8.8, -4.8, 0.5, 5.5, 10.2, 14.8, 18.6]) {
      if (isEast && lz >= 7.8 && lz <= 14.3) continue;
      addBollardLight(side * 7.2, lz, 0.90);
    }
  }

  // Jardins ao Norte das Torres D e E (z = -7.0)
  for (const tx of [-16.6, 16.6]) {
    addManicuredHedge(tx - 4.8, -7.0, 4.8, 0.9, 0.52, true);
    addManicuredHedge(tx + 4.8, -7.0, 4.8, 0.9, 0.52, true);
    addCordiline(tx - 8.0, -7.0, 0.88);
    addCordiline(tx + 8.0, -7.0, 0.88);
  }

  // F. Caminhos Sinuosos (S-Curves) ao lado da Quadra (Oeste) e do Salão de Festas (Leste)
  addPalmeiraImperial(-26.8, -4.5, 0.98, true);
  addPalmeiraImperial(-27.2, 3.8, 0.98, true);
  addHibisco(-27.5, -0.5, 0.88);
  addPingoDeOuro(-27.5, 7.2, 0.85);

  // Canteiro florido junto à Academia ao Ar Livre e borda Leste do Pergolado (fora do piso x = -29.45..-24.15)
  addIxora(-25.2, 9.5, 0.88);
  addHibisco(-23.6, 12.2, 0.86);
  addOrnamentalGrass(-23.4, 13.7, 0.98, true, true);
  addCordiline(-23.4, 15.1, 0.86);
  addOrnamentalGrass(-23.4, 16.6, 1.02, true, true);
  addPingoDeOuro(-23.6, 18.0, 0.84);
  addBollardLight(-24.2, 11.2, 0.90);
  addBollardLight(-24.0, 15.8, 0.90);
  addBollardLight(-24.2, 19.0, 0.90);

  // Canteiro sul da Quadra Poliesportiva e frente da Academia ao Ar Livre (z = 16.5..18.2)
  addManicuredHedge(-38.5, 16.5, 7.5, 1.1, 0.52, false);
  addIxora(-41.5, 17.2, 0.85, true, BASE_Y, true);
  addPingoDeOuro(-38.5, 17.2, 0.85);
  addHibisco(-35.5, 17.2, 0.85);
  addOrnamentalGrass(-43.0, 17.6, 0.95, true, true);
  addOrnamentalGrass(-40.0, 17.9, 0.92, false, true);
  addOrnamentalGrass(-37.0, 17.9, 0.92, true, true);
  addBollardLight(-41.8, 18.2, 0.90);
  addBollardLight(-36.2, 18.2, 0.90);

  // Faixas densas de Ixora vermelha na borda Oeste da Quadra Poliesportiva (COMUM-QUADRA.png)
  for (const qz of [-6.0, -3.5, -1.0, 1.5, 4.0, 6.5, 9.0, 11.5, 14.0]) {
    addIxora(-45.1, qz, 0.86, true, BASE_Y, true);
  }

  // Trepadeiras verdes e buganvílias rosa-magenta sobre o Pergolado (COMUM-PERGOLADO.png)
  addPergolaBougainvillea();

  // 2 Toques pontuais de floração amarela (Ipê Amarelo) em canteiros periféricos
  addIpeAmareloAccent(-42.2, -15.2, 0.92, 11);
  addIpeAmareloAccent(42.2, -15.2, 0.92, 12);

  // Leste (entre Torre E e o Salão de Festas / Terraço Gourmet):
  addPalmeiraImperial(26.6, -5.0, 0.98, true);
  addIxora(28.8, -3.2, 0.90);
  addHibisco(30.2, -1.5, 0.88);
  addCordiline(29.2, 0.2, 0.85);
  addPingoDeOuro(27.8, -1.8, 0.85);
  addOrnamentalGrass(25.1, -2.7, 0.96, true, true);
  addOrnamentalGrass(27.6, -2.8, 0.94, false, true);

  // Canteiro sul do Terraço do Salão de Festas (x = 28.8, z = 14.5 a 18.5 — livre do caminho S-Curve)
  addGramaAmendoimPatch(28.8, 16.2, 2.2, 1.8);
  addHibisco(27.8, 15.5, 0.88, false, BASE_Y + 0.08);
  addIxora(29.8, 15.8, 0.88, false, BASE_Y + 0.08);
  addPingoDeOuro(28.6, 17.4, 0.85, false, BASE_Y + 0.08);
  addCordiline(30.4, 17.2, 0.85, landscapingGroup, BASE_Y + 0.12);

  // Borda ajardinada ao longo da fachada Sul e Leste do Salão de Festas (z = 17.3, x = 32..42)
  for (const sx of [32.4, 34.9, 37.5, 40.1, 42.3]) {
    addOrnamentalGrass(sx, 17.2, 0.98, sx % 2 === 0, true);
  }
  addMureia(33.6, 17.3, 0.78);
  addPingoDeOuro(38.8, 17.3, 0.78);
  addCordiline(41.2, 17.3, 0.82);
  for (const ez of [-2.8, 2.2, 7.2, 12.2]) {
    addOrnamentalGrass(43.8, ez, 0.95, ez > 0, true);
  }

  addBollardLight(27.2, 14.5, 0.90);
  addBollardLight(27.2, 18.5, 0.90);
  addBollardLight(33.5, 18.5, 0.90);
  addBollardLight(39.5, 18.5, 0.90);

  // G. OS 3 CANTEIROS QUADRADOS ICÔNICOS DE IPÊ ROSA AO SUL DAS TORRES D e E
  //    1 ao Sul da Torre D (x = -16.6, z = 14.8) e 2 ao Sul da Torre E (x = 12.6 e x = 20.6, z = 14.8)
  addIpeRosaSquareGarden(-16.6, 14.8, 7.4, 6.8, 1.06, 1);
  addIpeRosaSquareGarden(12.6, 14.8, 6.4, 6.8, 1.02, 2);
  addIpeRosaSquareGarden(20.6, 14.8, 6.4, 6.8, 1.02, 3);

  // H. JARDIM DA PORTARIA MONUMENTAL (SETOR ①) E EIXO CENTRAL DE BOAS-VINDAS
  addPalmeiraImperial(0.0, 24.5, 0.94, true);

  for (const side of [-1, 1]) {
    const ix = side * 5.2;
    addPingoDeOuro(ix - 0.8, 25.2, 0.78);
    addIxora(ix, 25.2, 0.82);
    addCordiline(ix + 0.8, 25.2, 0.78);
    addBollardLight(ix, 24.0, 0.90);
  }

  // Canteiro Central Principal da Portaria (x = 0, z = 30.8 a 36.8)
  addGramaAmendoimPatch(0, 33.4, 1.65, 3.6);
  addCordiline(0, 31.8, 0.95, landscapingGroup, BASE_Y + 0.12);
  addCordiline(-0.95, 32.8, 0.82, landscapingGroup, BASE_Y + 0.12);
  addCordiline(0.95, 32.8, 0.82, landscapingGroup, BASE_Y + 0.12);
  addMureia(-0.95, 34.0, 0.82, false, BASE_Y + 0.08);
  addPingoDeOuro(0.95, 34.0, 0.85, false, BASE_Y + 0.08);
  addIxora(-0.85, 35.2, 0.88, false, BASE_Y + 0.08);
  addHibisco(0.85, 35.2, 0.88, false, BASE_Y + 0.08);
  addHibisco(0, 36.0, 0.92, false, BASE_Y + 0.08);
  addPingoDeOuro(0, 33.5, 0.82, false, BASE_Y + 0.08);

  addBollardLight(0, 31.4, 1.02);
  addBollardLight(-1.35, 34.4, 0.95);
  addBollardLight(1.35, 34.4, 0.95);
  addBollardLight(0, 36.6, 1.05);

  // I. JARDINS DAS 6 CASAS PARA ALUGUEL (SETOR ⑥ — FACHADA FRONTAL E QUINTAIS LATERAIS)
  const houseGardenGapsX = [-35.8, -25.0, -13.2, 13.2, 25.0, 35.8];
  for (const gx of houseGardenGapsX) {
    addPauFerroTree(gx, 23.6, 0.76, false, false);
    addPauFerroTree(gx, 28.4, 0.64, false, false);

    addGramaAmendoimPatch(gx, 26.2, 1.15, 3.4);
    addCordiline(gx, 25.8, 0.82, landscapingGroup, BASE_Y + 0.12);
    addOrnamentalGrass(gx - 0.75, 24.6, 0.88, false, false, BASE_Y + 0.12);
    addOrnamentalGrass(gx + 0.75, 27.1, 0.88, true, false, BASE_Y + 0.12);
    addHibisco(gx - 0.85, 29.8, 0.78);
    addIxora(gx + 0.85, 29.8, 0.78);
    addPingoDeOuro(gx, 30.8, 0.82);

    addManicuredHedge(gx, 32.0, 2.1, 0.62, 0.48, true);

    addBollardLight(gx, 22.2, 0.90);
    addBollardLight(gx, 30.4, 0.90);
  }

  for (const side of [-1, 1]) {
    const ex = side * 46.5;
    addPauFerroTree(ex, 28.2, 0.68, false, false);
    addMureia(ex, 30.8, 0.85);
    addPingoDeOuro(ex, 32.4, 0.85);
    addOrnamentalGrass(ex, 26.2, 0.94, true, true);
    addBollardLight(ex, 30.2, 0.88);
  }

  // Jardins privativos frontais e fundos de cada uma das 6 Casas (sem obstruir portas/caminhos)
  CASAS_CONFIG.forEach((casa, idx) => {
    const ds = casa.doorSide;
    // Pequena árvore ornamental florida compacta (~2.2m) no canto frontal externo do quintal
    addCompactCourtyardTree(casa.x - ds * 2.68, casa.z + 4.55, idx + 1);

    // Jardim frontal sob a janela (lado oposto à passarela de entrada em ds * 1.95)
    if (idx % 2 === 0) {
      addIxora(casa.x - ds * 1.65, casa.z + 4.45, 0.80, false, BASE_Y + 0.08);
      addOrnamentalGrass(casa.x - ds * 0.55, casa.z + 4.55, 0.84, false, false, BASE_Y + 0.12);
      addPingoDeOuro(casa.x + ds * 3.18, casa.z + 4.55, 0.72, true);
    } else {
      addHibisco(casa.x - ds * 1.65, casa.z + 4.45, 0.80, false, BASE_Y + 0.08);
      addOrnamentalGrass(casa.x - ds * 0.55, casa.z + 4.55, 0.84, true, false, BASE_Y + 0.12);
      addMureia(casa.x + ds * 3.18, casa.z + 4.55, 0.74, true);
    }
    addGramaAmendoimPatch(casa.x - ds * 1.35, casa.z + 4.45, 1.45, 0.72);

    // Borda posterior discreta junto ao quintal norte da casa (fora da alameda z = 20.8 ± 1.6)
    addOrnamentalGrass(casa.x - 2.3, casa.z - 4.45, 0.86, false, true);
    addOrnamentalGrass(casa.x + 2.3, casa.z - 4.45, 0.86, true, true);
  });

  // J. CORDÃO LUMINOSO DE BALIZADORES AO LONGO DOS BOULEVARDS TRANSVERSAIS
  for (const lx of [-42, -32, -21, -11, 11, 21, 32, 42]) {
    addBollardLight(lx, 19.4, 0.92);
    addBollardLight(lx, -9.0, 0.92);
  }

  // K. PLANTAS TROPICAIS REAIS (modelos 3D): moita verde alta nos canteiros e bromélia em vaso nos acessos.
  const moitas = [
    [0.0, 32.6, 1.7], [-1.6, 34.9, 1.5], [1.6, 34.9, 1.5],
    [-14.5, -27.0, 1.7], [14.5, -27.0, 1.7], [-14.5, -16.2, 1.7], [14.5, -16.2, 1.7],
    [-14.5, -31.0, 1.6], [14.5, -31.0, 1.6],
    [-6.8, 9.6, 1.5], [6.8, 6.4, 1.5], [-6.8, -6.0, 1.5], [6.8, -6.0, 1.5],
    [-27.5, 1.6, 1.6], [28.4, -0.8, 1.6], [29.4, 16.4, 1.5]
  ];
  for (const [mx, mz, mh] of moitas) arvoresReais.tropical1.push({ x: mx, y: BASE_Y, z: mz, altura: mh });

  const vasos = [
    [-2.3, 31.2, 0.95], [2.3, 31.2, 0.95], [-2.0, 36.2, 0.9], [2.0, 36.2, 0.9],
    [-5.2, 26.6, 0.9], [5.2, 26.6, 0.9],
    [-25.2, 12.9, 0.9], [29.6, 13.6, 0.9]
  ];
  for (const [vx, vz, vh] of vasos) arvoresReais.tropical2.push({ x: vx, y: BASE_Y, z: vz, altura: vh });

  return landscapingGroup;
}
