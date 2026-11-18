// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — MOTOR 3D WEBGL DE ALTA PRECISÃO (THREE.JS)
// Maquete 3D Arquitetônica Completa:
//  - 5 Torres em H (A, B, C, D, E) + 6 Casas para Aluguel + Portaria +
//    Piscina Central WebGL Water + Quadra Poliesportiva + Academia ao Ar Livre +
//    Salão de Festas / Espaço Gourmet + Paisagismo Botânico Fiel
//  - Domo Atmosférico Golden-Hour em GLSL + Environment Map PMREM +
//    Entorno Urbano Fotorealista 3D + Anéis de Distância & Rotas (Localização) +
//    Destaque Holográfico Translúcido & Bússola 3D
//  - Modos: Vista Aérea 3D, Fachada Frontal, Planta Baixa Geral (Corte Total),
//    Desmonte Interativo por Pavimento, Mapa de Localização, Street View 360°
//    e Disponibilidade Comercial 3D.
// ==========================================================================

import * as THREE from 'three';
import { TOWERS_CONFIG, CASAS_CONFIG, POIS_ENTORNO, SECTORS_LEGENDA, VISTAS_COMPLEMENTARES, FLOOR_H, BASE_Y } from './data.js';
import { buildArchitecturalMaquete3D, createHShapedFloorPlan3D } from './model.js';
import { plantaUrl, paredesUrl, plantaInfo } from './plantas.js';
import { mergeStatic } from './mergeStatic.js';
import { carregarModelosArvores, instalarArvores } from './arvores.js';

// Relevo das paredes da planta: a máscara das marcações brancas é empilhada em camadas,
// do piso (escuro, lateral da parede) ao topo (branco), como o pavimento cortado da referência.
const WALL_LAYERS = 14;
const WALL_HEIGHT_RATIO = 0.075; // altura da parede em fração do maior lado da planta
const WALL_SHADES = Array.from({ length: WALL_LAYERS }, (_, k) => {
  const t = k / (WALL_LAYERS - 1);
  const v = k === WALL_LAYERS - 1 ? 1 : 0.5 + 0.32 * t; // lateral cinza-quente, tampa branca
  return new THREE.Color(v, v * 0.985, v * 0.96);
});

// Paleta atmosférica Golden-Hour / Crepúsculo (referência Navigo Web) e Planta Baixa
const SKY_HORIZON_HEX = 0xc3dcef;
const PLANTA_BG_HEX = 0x0b1018;
const SHOWCASE_FOG_DENSITY = 0.00195;
const LOCATION_FOG_DENSITY = 0.00135;
const PLANTA_FOG_DENSITY = 0.0003;

// PRNG determinístico para texturas e paisagismo urbano consistentes
function createRng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------------------
// GERADORES PROCEDURAIS PARA ENTORNO URBANO, FACHADAS E MARCADORES 3D
// --------------------------------------------------------------------------

function createSatelliteTerrainTexture(maxAniso = 8) {
  const size = 2048;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rng = createRng(4091);

  // Converte coordenada mundo [-512..512] -> pixel [0..2048]
  const px = (wx) => ((wx + 512) / 1024) * size;
  const pz = (wz) => ((wz + 512) / 1024) * size;
  const sc = size / 1024;

  // Base de vegetação/solo urbano satélite
  ctx.fillStyle = '#2d3b23';
  ctx.fillRect(0, 0, size, size);

  // Manchas orgânicas de variação de solo e vegetação
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = (24 + rng() * 90) * sc;
    const tones = ['rgba(40,56,30,0.42)', 'rgba(56,70,40,0.34)', 'rgba(66,64,52,0.26)', 'rgba(31,46,24,0.40)'];
    ctx.fillStyle = tones[i % tones.length];
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Zonas de parque verde (Sudoeste Ibirapuera e Leste) com vegetação granulada natural
  const drawPark = (cx, cz, rx, rz, treeCount) => {
    for (let i = 0; i < treeCount; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng());
      const px0 = px(cx + Math.cos(a) * rx * d);
      const pz0 = pz(cz + Math.sin(a) * rz * d);
      const rad = (2.8 + rng() * 5.2) * sc;
      ctx.fillStyle = 'rgba(12, 18, 12, 0.28)';
      ctx.beginPath();
      ctx.arc(px0 + 2 * sc, pz0 + 2 * sc, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 3 === 0 ? '#24451b' : i % 3 === 1 ? '#2f5722' : '#396329';
      ctx.beginPath();
      ctx.arc(px0, pz0, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawPark(-220, 185, 130, 95, 220);
  drawPark(165, -95, 105, 75, 160);
  drawPark(-195, -185, 100, 85, 150);

  // Quadras e lotes urbanos entre as vias principais (excluindo o terreno do condomínio)
  const xLines = [-480, -370, -265, -172, -88, 92, 178, 268, 375, 480];
  const zLines = [-480, -365, -245, -158, -74, 40.2, 118, 204, 295, 395, 480];

  const roofPal = ['#5c5852', '#6a655e', '#4b4e54', '#7b6050', '#68594e', '#545b63', '#495246'];
  const lotPal = ['#42443c', '#4c4b44', '#394332', '#524e46', '#3d4835'];

  for (let xi = 0; xi < xLines.length - 1; xi++) {
    for (let zi = 0; zi < zLines.length - 1; zi++) {
      const x0 = xLines[xi] + 5;
      const x1 = xLines[xi + 1] - 5;
      const z0 = zLines[zi] + 5;
      const z1 = zLines[zi + 1] - 5;
      const cx = (x0 + x1) * 0.5;
      const cz = (z0 + z1) * 0.5;

      // Não desenha lotes urbanos dentro do perímetro do empreendimento
      if (cx > -68 && cx < 68 && cz > -52 && cz < 56) continue;
      // Preserva parques abertos
      if (cx < -130 && cx > -310 && cz > 105 && cz < 275) continue;

      // Calçamento da quadra
      ctx.fillStyle = lotPal[(xi + zi) % lotPal.length];
      ctx.fillRect(px(x0), pz(z0), (x1 - x0) * sc, (z1 - z0) * sc);

      // Subdivide a quadra em parcelas detalhadas com telhados, pátios e calçadas (escala de satélite)
      const cols = Math.max(3, Math.floor((x1 - x0) / 12));
      const rows = Math.max(3, Math.floor((z1 - z0) / 12));
      const pw = (x1 - x0) / cols;
      const pd = (z1 - z0) / rows;
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        for (let rIdx = 0; rIdx < rows; rIdx++) {
          const lx = x0 + cIdx * pw + 1.0;
          const lz = z0 + rIdx * pd + 1.0;
          const lw = pw - 2.0;
          const ld = pd - 2.0;

          if (rng() < 0.22) {
            // Quintal arborizado / jardim interno com textura de copa
            ctx.fillStyle = rng() > 0.5 ? '#29481f' : '#335626';
            ctx.fillRect(px(lx), pz(lz), lw * sc, ld * sc);
            ctx.fillStyle = '#1f3a17';
            ctx.beginPath();
            ctx.arc(px(lx + lw * 0.5), pz(lz + ld * 0.5), Math.min(lw, ld) * 0.34 * sc, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Sombra projetada + cobertura articulada da edificação no lote
            ctx.fillStyle = 'rgba(10, 14, 18, 0.44)';
            ctx.fillRect(px(lx + 1.8), pz(lz + 1.8), lw * 0.86 * sc, ld * 0.86 * sc);
            const roofCol = roofPal[Math.floor(rng() * roofPal.length)];
            ctx.fillStyle = roofCol;
            ctx.fillRect(px(lx + 0.5), pz(lz + 0.5), lw * 0.84 * sc, ld * 0.84 * sc);
            // Detalhe de cumeeira / caixa técnica de cobertura
            ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
            ctx.fillRect(px(lx + 1.4), pz(lz + 1.4), lw * 0.42 * sc, ld * 0.42 * sc);
            ctx.strokeStyle = 'rgba(20, 24, 30, 0.25)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px(lx + 0.5), pz(lz + 0.5), lw * 0.84 * sc, ld * 0.84 * sc);
          }
        }
      }
    }
  }

  // Malha viária secundária pintada na textura de satélite
  const drawRoadStroke = (pts, widthW, asphalt = '#343942', lineColor = 'rgba(226,232,240,0.34)') => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Calçada lateral
    ctx.strokeStyle = '#6c727a';
    ctx.lineWidth = (widthW + 2.8) * sc;
    ctx.beginPath();
    pts.forEach(([x, z], idx) => (idx === 0 ? ctx.moveTo(px(x), pz(z)) : ctx.lineTo(px(x), pz(z))));
    ctx.stroke();
    // Leito asfáltico
    ctx.strokeStyle = asphalt;
    ctx.lineWidth = widthW * sc;
    ctx.stroke();
    // Faixa central sutil
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.7 * sc;
    ctx.setLineDash([6 * sc, 6 * sc]);
    ctx.stroke();
    ctx.restore();
  };

  for (const x of xLines) {
    if (Math.abs(x) < 60) continue;
    drawRoadStroke([[x, -510], [x, 510]], 6.8);
  }
  for (const z of zLines) {
    if (Math.abs(z - 40.2) < 1) {
      drawRoadStroke([[-510, 40.2], [-52, 40.2]], 11.0);
      drawRoadStroke([[52, 40.2], [510, 40.2]], 11.0);
      continue;
    }
    if (z > -44 && z < 48) continue;
    drawRoadStroke([[-510, z], [510, z]], z === -74 ? 9.5 : 6.5);
  }
  // Avenida arterial diagonal oeste-noroeste (como na referência aérea)
  drawRoadStroke([[-235, 495], [-125, 220], [-88, 40.2], [-96, -74], [-155, -260], [-245, -505]], 10.8);

  // Copas de árvores de rua e parques vistas de satélite (com sombra direcional)
  for (let i = 0; i < 1600; i++) {
    const tx = (rng() - 0.5) * 1000;
    const tz = (rng() - 0.5) * 1000;
    if (tx > -62 && tx < 62 && tz > -48 && tz < 54) continue;
    const rad = (2.2 + rng() * 3.8) * sc;
    const xPx = px(tx);
    const zPx = pz(tz);
    ctx.fillStyle = 'rgba(10, 14, 14, 0.36)';
    ctx.beginPath();
    ctx.arc(xPx + 2.5 * sc, zPx + 2.5 * sc, rad, 0, Math.PI * 2);
    ctx.fill();

    const greens = ['#23421a', '#2d5221', '#386128', '#3f692d'];
    ctx.fillStyle = greens[i % greens.length];
    ctx.beginPath();
    ctx.arc(xPx, zPx, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createOuterTerrainTexture(maxAniso = 4) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const rng = createRng(8821);

  ctx.fillStyle = '#2d3b23';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 180; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 14 + rng() * 38;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(46, 62, 34, 0.45)' : i % 3 === 1 ? 'rgba(62, 60, 52, 0.30)' : 'rgba(28, 42, 21, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(60, 65, 74, 0.55)';
  ctx.lineWidth = 4;
  for (let g = 64; g < 512; g += 128) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, 512);
    ctx.moveTo(0, g);
    ctx.lineTo(512, g);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createRoadAsphaltTexture(maxAniso = 8) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const rng = createRng(5502);

  // Asfalto escuro realista
  ctx.fillStyle = '#2f343c';
  ctx.fillRect(0, 0, 512, 512);

  // Faixas longitudinais de rolagem dos pneus
  const trackX = [105, 195, 315, 405];
  for (const tx of trackX) {
    const g = ctx.createLinearGradient(tx - 26, 0, tx + 26, 0);
    g.addColorStop(0, 'rgba(18, 22, 26, 0)');
    g.addColorStop(0.5, 'rgba(18, 22, 26, 0.28)');
    g.addColorStop(1, 'rgba(18, 22, 26, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(tx - 26, 0, 52, 512);
  }

  // Micro-granulação do asfalto
  for (let i = 0; i < 3500; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rng() * 512, rng() * 512, 2, 2);
  }

  // Faixas contínuas brancas de borda
  ctx.fillStyle = 'rgba(241, 245, 249, 0.78)';
  ctx.fillRect(22, 0, 10, 512);
  ctx.fillRect(480, 0, 10, 512);

  // Faixa dupla amarela / canteiro central
  ctx.fillStyle = 'rgba(250, 204, 21, 0.72)';
  ctx.fillRect(247, 0, 6, 512);
  ctx.fillRect(259, 0, 6, 512);

  // Faixas tracejadas entre pistas
  ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(136, y, 7, 32);
    ctx.fillRect(369, y, 7, 32);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createUrbanFacadeTexture(variant = 'residential', maxAniso = 8) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const rng = createRng(variant === 'residential' ? 1019 : 2087);

  if (variant === 'residential') {
    // Alvenaria bege-cinza quente com faixas horizontais de laje e janelas sutis em escala urbana
    ctx.fillStyle = '#c4bcb4';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const cols = 12;
    const rh = 512 / rows;
    const cw = 512 / cols;

    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = '#d6d0c9';
      ctx.fillRect(0, r * rh, 512, 5);
      ctx.fillStyle = 'rgba(40, 38, 36, 0.12)';
      ctx.fillRect(0, r * rh + 5, 512, 2);

      for (let col = 0; col < cols; col++) {
        const x = col * cw + 7;
        const y = r * rh + 9;
        const w = cw - 14;
        const h = rh - 14;
        const lit = rng();
        if (lit < 0.22) {
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, '#fde68a');
          g.addColorStop(1, '#d97706');
          ctx.fillStyle = g;
        } else if (lit < 0.60) {
          ctx.fillStyle = '#3f4b5c';
        } else {
          ctx.fillStyle = '#526072';
        }
        ctx.fillRect(x, y, w, h);
      }
    }
  } else if (variant === 'lowrise') {
    // Fachada de edifícios baixos / sobrados urbanos (reboco creme/cinza, esquadrias e cornijas)
    ctx.fillStyle = '#cfc7bd';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 4;
    const cols = 6;
    const rh = 512 / rows;
    const cw = 512 / cols;

    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = '#ded8cf';
      ctx.fillRect(0, r * rh, 512, 12);
      ctx.fillStyle = 'rgba(40, 36, 32, 0.16)';
      ctx.fillRect(0, r * rh + 12, 512, 4);

      for (let col = 0; col < cols; col++) {
        const x = col * cw + 14;
        const y = r * rh + 24;
        const w = cw - 28;
        const h = rh - 38;
        const lit = rng();
        if (lit < 0.25) {
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, '#fde68a');
          g.addColorStop(1, '#d97706');
          ctx.fillStyle = g;
        } else if (lit < 0.65) {
          ctx.fillStyle = '#334155';
        } else {
          ctx.fillStyle = '#475569';
        }
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x - 3, y + h, w + 6, 6);
      }
    }
  } else {
    // Torre corporativa / mista com cortina de vidro refletiva e montantes metálicos
    ctx.fillStyle = '#4f5d6e';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 18;
    const cols = 14;
    const rh = 512 / rows;
    const cw = 512 / cols;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cw + 2;
        const y = r * rh + 3;
        const w = cw - 4;
        const h = rh - 6;
        const p = rng();
        if (p < 0.18) {
          ctx.fillStyle = '#f5d0a9';
        } else if (p < 0.55) {
          ctx.fillStyle = '#64748b';
        } else {
          ctx.fillStyle = '#334155';
        }
        ctx.fillRect(x, y, w, h);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, r * rh, 512, 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createCompassBadgeTexture(letter) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Sombra externa suave
  const shadow = ctx.createRadialGradient(128, 128, 74, 128, 128, 124);
  shadow.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  shadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  // Anel externo translúcido azul-gelo (efeito vidro)
  ctx.fillStyle = 'rgba(191, 219, 254, 0.34)';
  ctx.beginPath();
  ctx.arc(128, 128, 98, 0, Math.PI * 2);
  ctx.fill();

  // Disco central azul-royal profundo com gradiente vítreo
  const grad = ctx.createRadialGradient(104, 96, 12, 128, 128, 86);
  grad.addColorStop(0, '#1e40af');
  grad.addColorStop(0.65, '#172554');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 84, 0, Math.PI * 2);
  ctx.fill();

  // Reflexo especular superior no vidro
  const gloss = ctx.createLinearGradient(0, 44, 0, 128);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(128, 78, 56, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Borda luminosa nítida
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.90)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 84, 0, Math.PI * 2);
  ctx.stroke();

  // Letra cardinal branca centralizada
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 104px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 128, 134);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDistanceLabelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');

  // Pílula escura translúcida com borda verde-lima brilhante
  const r = 34;
  const x = 18, y = 14, w = 220, h = 68;
  ctx.fillStyle = 'rgba(10, 18, 16, 0.84)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = '#84ff3a';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ecfccb';
  ctx.font = '700 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 49);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Constrói uma faixa viária UV-mapeada ao longo de uma CatmullRomCurve3
function buildRibbonGeometry(curve, width, segments = 48, vRepeatScale = 0.045) {
  const pts = curve.getSpacedPoints(segments);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const halfW = width * 0.5;
  let accumLen = 0;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0) accumLen += p.distanceTo(pts[i - 1]);
    const tan = curve.getTangentAt(i / segments).normalize();
    const sideX = -tan.z;
    const sideZ = tan.x;
    positions.push(
      p.x - sideX * halfW, p.y, p.z - sideZ * halfW,
      p.x + sideX * halfW, p.y, p.z + sideZ * halfW
    );
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, accumLen * vRepeatScale, 1, accumLen * vRepeatScale);
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Constrói 4 retângulos ao redor de um recorte central (evita z-fighting e preserva a bacia da piscina)
function buildCutoutGroundGeometry(outerHalf, cutMinX, cutMaxX, cutMinZ, cutMaxZ, uvHalf, yLevel, tiledUvRepeat = 0) {
  const rects = [
    [-outerHalf, outerHalf, -outerHalf, cutMinZ], // Norte
    [-outerHalf, outerHalf, cutMaxZ, outerHalf],  // Sul
    [-outerHalf, cutMinX, cutMinZ, cutMaxZ],      // Oeste
    [cutMaxX, outerHalf, cutMinZ, cutMaxZ]        // Leste
  ];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  rects.forEach(([x0, x1, z0, z1], idx) => {
    const base = idx * 4;
    positions.push(
      x0, yLevel, z0,
      x1, yLevel, z0,
      x1, yLevel, z1,
      x0, yLevel, z1
    );
    for (let k = 0; k < 4; k++) normals.push(0, 1, 0);

    const mapUV = (wx, wz) => {
      if (tiledUvRepeat > 0) {
        return [(wx / (outerHalf * 2)) * tiledUvRepeat, (wz / (outerHalf * 2)) * tiledUvRepeat];
      }
      return [(wx + uvHalf) / (uvHalf * 2), 1 - (wz + uvHalf) / (uvHalf * 2)];
    };
    const [u00, v00] = mapUV(x0, z0);
    const [u10, v10] = mapUV(x1, z0);
    const [u11, v11] = mapUV(x1, z1);
    const [u01, v01] = mapUV(x0, z1);
    uvs.push(u00, v00, u10, v10, u11, v11, u01, v01);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export class MaqueteScene3D {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.mode = 'desmonte'; // 'filme' | 'desmonte' | 'planta' | 'localizacao' | 'unidades'
    this.selectedTowerId = 'ALL';
    this.cutFloor = 19; // > max floors (18) = 100% montado

    this.towerObjects = new Map();
    this.unitMeshes = [];
    this.pickMeshes = [];
    this.unitMeshById = new Map();
    this.hoveredUnitMesh = null;
    this.selectedUnitId = null;
    this.poolWaterMesh = null;
    this.waterUniforms = null;
    this.nightLightObjects = [];
    this._lastPoolRippleMs = 0;

    this._startTimeMs = performance.now();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDownPos = new THREE.Vector2();

    // O desmonte abre com a quina do lote à frente e a piscina visível entre as torres.
    this.camState = {
      target: new THREE.Vector3(),
      spherical: new THREE.Spherical(),
      goalTarget: new THREE.Vector3(),
      goalSpherical: new THREE.Spherical(),
      isDragging: false,
      isPanning: false,
      lastX: 0,
      lastY: 0,
      autoRotate: false
    };

    this._frameModel();
    this.camState.target.copy(this.camState.goalTarget);
    this.camState.spherical.copy(this.camState.goalSpherical);
    this._initEngine();
    this._initSkyDome();
    this._initEnvironmentMap();
    this._initLights();
    this._buildTowersAndMaquete();
    this._initUnitOutlinesAndCompass();
    this._buildSurroundingsMap();
    this._buildLocationOverlay();
    this._showIsolatedModel();
    this._bindEvents();
    ['pointermove', 'pointerdown', 'wheel', 'keydown'].forEach((t) =>
      this.renderer.domElement.addEventListener(t, () => { this._lastActivity = performance.now(); }, { passive: true })
    );
    this._animate();
  }

  // Árvores e plantas reais (assets/arvores): carrega os 4 modelos e desenha por instâncias nas posições
  // registradas pelo paisagismo. Se algum arquivo falhar, volta ao desenho procedural antigo.
  _instalarArvoresReais(grupo) {
    carregarModelosArvores()
      .then((modelos) => {
        instalarArvores(grupo, modelos, grupo.userData.arvores || {});
        this._markShadowsDirty(60);
      })
      .catch((err) => {
        console.warn('Árvores reais indisponíveis; usando o desenho procedural.', err);
        (grupo.userData.arvoresProcedurais || []).forEach((desenhar) => desenhar());
        this._markShadowsDirty(60);
      });
  }

  // Resolução adaptativa: se a GPU não dá conta (quadros > ~40 ms) enquanto a câmera se mexe, baixa a
  // resolução aos poucos; assim que a câmera para, volta à resolução máxima e a imagem fica nítida.
  _ajustarResolucao(nowMs, ativo) {
    const dt = nowMs - this._ultimoAnimMs;
    this._ultimoAnimMs = nowMs;
    if (!ativo) {
      if (this._dpr < this._dprMax && nowMs - this._lastActivity > 350) this._setDpr(this._dprMax);
      this._dprLento = 0;
      this._dprRapido = 0;
      return;
    }
    if (dt > 40) { this._dprLento++; this._dprRapido = 0; }
    else if (dt < 24) { this._dprRapido++; this._dprLento = 0; }
    else { this._dprLento = 0; this._dprRapido = 0; }

    if (this._dprLento >= 3 && this._dpr > 0.7) {
      this._setDpr(Math.max(0.7, this._dpr * 0.8));
      this._dprLento = 0;
    } else if (this._dprRapido >= 45 && this._dpr < this._dprMax) {
      this._setDpr(Math.min(this._dprMax, this._dpr * 1.15));
      this._dprRapido = 0;
    }
  }

  _setDpr(v) {
    this._dpr = v;
    this.renderer.setPixelRatio(v);
  }

  _markShadowsDirty(frames = 30) {
    this._shadowFrames = Math.max(this._shadowFrames, frames);
  }

  _initEngine() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || (window.innerHeight - 54);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_HORIZON_HEX);
    this.scene.fog = new THREE.FogExp2(SKY_HORIZON_HEX, SHOWCASE_FOG_DENSITY);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 2800);
    this._applyCameraTransform();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this._dprMax = Math.min(window.devicePixelRatio, 1.5); // 2x custa 78% mais pixels sem ganho visível na maquete
    this._dpr = this._dprMax;
    this._dprLento = 0;
    this._dprRapido = 0;
    this._ultimoAnimMs = performance.now();
    this.renderer.setPixelRatio(this._dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;

    // Sombras direcionais suaves de alta definição (2048x2048)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Cena estática: o mapa de sombras só é redesenhado quando algo muda (corte de andar, modo, carregamento)
    this.renderer.shadowMap.autoUpdate = false;
    this._shadowFrames = 90;
    this._lastActivity = performance.now();
    this._lastRender = 0;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
  }

  // Céu diurno com a mesma cor de horizonte usada na névoa do entorno.
  _initSkyDome() {
    const tmpColor = new THREE.Color(SKY_HORIZON_HEX);
    const srgb = { r: 0, g: 0, b: 0 };
    tmpColor.getRGB(srgb, THREE.SRGBColorSpace);
    const horizonVec = new THREE.Vector3(srgb.r, srgb.g, srgb.b);

    this.skyUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(50, 102, 70) },
      uHorizonColor: { value: horizonVec }
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uHorizonColor;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += amp * noise2D(p);
            p = rot * p * 2.04 + vec2(17.3, 9.2);
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);

          vec3 sky = mix(uHorizonColor, vec3(0.36, 0.64, 0.87), smoothstep(0.0, 0.32, h));
          sky = mix(sky, vec3(0.14, 0.38, 0.69), smoothstep(0.24, 1.0, h));
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          sky += vec3(0.26, 0.24, 0.19) * pow(sunDot, 16.0);
          sky = mix(sky, vec3(1.0, 0.99, 0.92), smoothstep(0.9993, 0.99985, sunDot));

          if (dir.y > 0.015) {
            vec2 cloudUV = dir.xz / (dir.y + 0.16);
            vec2 drift = vec2(uTime * 0.005, uTime * 0.002);
            float warp = fbm(cloudUV * 0.65 + drift);
            float density = fbm(cloudUV * 1.15 + vec2(warp * 1.35) - drift * 1.4);
            float wisps = smoothstep(0.47, 0.78, density);
            float horizonFade = smoothstep(0.025, 0.22, dir.y) * (1.0 - smoothstep(0.75, 0.99, dir.y));
            float cloudAlpha = wisps * horizonFade * 0.71;

            vec3 cloudLit = mix(vec3(0.96, 0.98, 1.0), vec3(1.0, 0.99, 0.95), pow(sunDot, 2.0));
            vec3 cloudShade = vec3(0.65, 0.76, 0.86);
            vec3 cloudCol = mix(cloudShade, cloudLit, smoothstep(0.42, 0.78, warp));
            sky = mix(sky, cloudCol, cloudAlpha);
          }

          // Mistura exata na linha do horizonte com a cor da neblina da cena para transição invisível
          float horizonLock = smoothstep(-0.02, 0.09, dir.y);
          sky = mix(uHorizonColor, sky, horizonLock);

          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });

    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 32), skyMat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);
  }

  _syncSkyHorizonColor(hex) {
    if (this.skyUniforms && this.skyUniforms.uHorizonColor) {
      const tmp = new THREE.Color(hex);
      const srgb = { r: 0, g: 0, b: 0 };
      tmp.getRGB(srgb, THREE.SRGBColorSpace);
      this.skyUniforms.uHorizonColor.value.set(srgb.r, srgb.g, srgb.b);
    }
  }

  // A mesma vista 360° do boulevard fornece o céu, a vegetação e as fachadas
  // aos reflexos dos vidros e metais. O renderer gera os níveis de rugosidade.
  _initEnvironmentMap() {
    const panorama = new URL('../assets/reflexo-boulevard.webp', import.meta.url);
    new THREE.TextureLoader().load(panorama.href, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
      this.scene.environmentIntensity = 0.78;
      this._lastActivity = performance.now();
    }, undefined, () => {
      console.warn('Panorama de reflexão indisponível. A iluminação direta continua ativa.');
    });
  }

  _initLights() {
    this.hemiLight = new THREE.HemisphereLight(0xd8eaff, 0x615644, 0.98);
    this.hemiLight.position.set(0, 140, 0);
    this.scene.add(this.hemiLight);

    // Luz solar alta e ligeiramente quente; a mesma direção posiciona o sol no céu.
    this.dirLight = new THREE.DirectionalLight(0xfff4e6, 1.68);
    this.dirLight.position.set(50, 102, 70);
    this.skyUniforms.uSunDir.value = this.dirLight.position;
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 260;
    this.dirLight.shadow.camera.left = -55;
    this.dirLight.shadow.camera.right = 55;
    this.dirLight.shadow.camera.top = 42;
    this.dirLight.shadow.camera.bottom = -42;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    // Rebote de céu nas faces opostas ao sol.
    this.fillLight = new THREE.DirectionalLight(0xb6d3f1, 0.33);
    this.fillLight.position.set(-65, 68, -55);
    this.scene.add(this.fillLight);

    // Luzes pontuais quentes realçando a Piscina Central, Portaria e Salão de Festas
    this.warmBoulevardLight = new THREE.PointLight(0xfbbf24, 1.85, 88, 1.35);
    this.warmBoulevardLight.position.set(0, 14, 8);
    this.scene.add(this.warmBoulevardLight);

    this.warmPortariaLight = new THREE.PointLight(0xfde68a, 1.35, 55, 1.4);
    this.warmPortariaLight.position.set(0, 8, 30);
    this.scene.add(this.warmPortariaLight);
  }

  _buildTowersAndMaquete() {
    this.towersRoot = new THREE.Group();
    this.scene.add(this.towersRoot);

    // Materiais translúcidos elegantes (deixam a arquitetura da fachada aparecer através dos volumes)
    this.availMatDisponivel = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x15803d,
      emissiveIntensity: 0.42,
      roughness: 0.16,
      metalness: 0.10,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    this.availMatReservado = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.36,
      roughness: 0.16,
      metalness: 0.10,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });
    this.availMatVendido = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0x334155,
      emissiveIntensity: 0.14,
      roughness: 0.28,
      metalness: 0.10,
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    });
    this.availMatHover = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.78,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    this.availMatSelected = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x4f46e5,
      emissiveIntensity: 1.25,
      roughness: 0.10,
      metalness: 0.18,
      transparent: true,
      opacity: 0.50,
      depthWrite: false
    });

    this.pickMeshes = [];
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });

    // Constrói a Maquete 3D de Alta Precisão (Base + Lazer + Piscina WebGL Water + 5 Torres em H + Paisagismo)
    const built = buildArchitecturalMaquete3D(this.renderer);
    this.maqueteGroup = built.group;
    this.setTowerCutFn = built.setTowerCut;
    this.setLowRiseRoofsVisibleFn = built.setLowRiseRoofsVisible;
    this.poolWaterMesh = built.poolWaterMesh || null;
    this.waterUniforms =
      built.waterUniforms ||
      (this.poolWaterMesh && this.poolWaterMesh.userData && this.poolWaterMesh.userData.waterUniforms) ||
      (this.maqueteGroup && this.maqueteGroup.userData && this.maqueteGroup.userData.waterUniforms) ||
      null;
    this.nightLightObjects = built.nightLightObjects || [];
    this.scene.add(this.maqueteGroup);
    this._instalarArvoresReais(this.maqueteGroup);

    TOWERS_CONFIG.forEach((cfg, index) => {
      const totalH = cfg.floors * FLOOR_H;
      const floorsList = [];

      for (let f = 1; f <= cfg.floors; f++) {
        const fGroup = new THREE.Group();
        fGroup.position.set(cfg.x, BASE_Y + (f - 1) * FLOOR_H, cfg.z);
        this.towersRoot.add(fGroup);

        const availGroup = new THREE.Group();
        availGroup.visible = false;
        fGroup.add(availGroup);

        floorsList.push({ floor: f, group: fGroup, availGroup });
      }

      const pick = new THREE.Mesh(new THREE.BoxGeometry(cfg.width, totalH, cfg.depth), pickMat);
      pick.position.set(cfg.x, BASE_Y + totalH / 2, cfg.z);
      pick.userData = { towerId: cfg.id };
      this.towersRoot.add(pick);
      this.pickMeshes.push(pick);

      // Planta Humanizada 3D em formato "H" idêntica à Prancha 1 e Prancha 5
      const plan = createHShapedFloorPlan3D(cfg.width, cfg.depth, FLOOR_H);
      plan.position.set(cfg.x, BASE_Y, cfg.z);
      plan.visible = false;
      plan.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      this._buildPlantaSlots(plan);
      this.towersRoot.add(plan);

      const maxF = cfg.floors + 1;
      this.towerObjects.set(cfg.id, {
        index,
        config: cfg,
        floors: floorsList,
        plan,
        maxF,
        cutFloorNow: maxF,
        cutFloorGoal: maxF,
        planAtY: BASE_Y,
        planWanted: false
      });
    });

    // Grupo de disponibilidade para as 6 Casas para Aluguel
    this.casasAvailGroup = new THREE.Group();
    this.casasAvailGroup.visible = false;
    this.towersRoot.add(this.casasAvailGroup);

    if (this.callbacks.onModelReady) {
      setTimeout(() => this.callbacks.onModelReady(), 30);
    }
  }

  // Contornos holográficos reutilizáveis (hover/seleção de unidade) + Marcadores Cardinais N/S/E/W em Sprites 3D
  _initUnitOutlinesAndCompass() {
    const unitEdgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this._hoverUnitEdges = new THREE.LineSegments(
      unitEdgesGeo,
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.92 })
    );
    this._hoverUnitEdges.visible = false;
    this._hoverUnitEdges.renderOrder = 4;
    this.scene.add(this._hoverUnitEdges);

    this._selectedUnitEdges = new THREE.LineSegments(
      unitEdgesGeo,
      new THREE.LineBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.98 })
    );
    this._selectedUnitEdges.visible = false;
    this._selectedUnitEdges.renderOrder = 7;
    this.scene.add(this._selectedUnitEdges);

    this._selectedUnitGlowEdges = new THREE.LineSegments(
      unitEdgesGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 })
    );
    this._selectedUnitGlowEdges.visible = false;
    this._selectedUnitGlowEdges.renderOrder = 7;
    this.scene.add(this._selectedUnitGlowEdges);

    // Marcadores Cardinais Flutuantes 3D (N, S, E, W em discos azul-vidro)
    this.compassGroup = new THREE.Group();
    this.compassGroup.visible = false;
    this.scene.add(this.compassGroup);

    const dirs = [
      { key: 'N', dx: 0, dz: -1 },
      { key: 'S', dx: 0, dz: 1 },
      { key: 'E', dx: 1, dz: 0 },
      { key: 'W', dx: -1, dz: 0 }
    ];
    this._compassSprites = dirs.map((d) => {
      const spriteMat = new THREE.SpriteMaterial({
        map: createCompassBadgeTexture(d.key),
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        depthTest: false
      });
      const sp = new THREE.Sprite(spriteMat);
      sp.scale.set(3.2, 3.2, 1);
      sp.renderOrder = 20;
      sp.userData = { dx: d.dx, dz: d.dz };
      this.compassGroup.add(sp);
      return sp;
    });
  }

  _updateCompassMarkers(cx, y, cz, radius) {
    if (!this.compassGroup || !this._compassSprites) return;
    for (const sp of this._compassSprites) {
      sp.position.set(cx + sp.userData.dx * radius, y, cz + sp.userData.dz * radius);
    }
    this.compassGroup.visible = true;
  }

  _hideCompassMarkers() {
    if (this.compassGroup) this.compassGroup.visible = false;
  }

  _positionEdgeOutline(edgeObj, mesh) {
    if (!edgeObj || !mesh) return;
    const worldPos = this._tmpEdgePos || (this._tmpEdgePos = new THREE.Vector3());
    mesh.getWorldPosition(worldPos);
    const p = mesh.geometry.parameters;
    edgeObj.position.copy(worldPos);
    edgeObj.scale.set(p.width + 0.04, p.height + 0.04, p.depth + 0.04);
    edgeObj.visible = true;
  }

  _applyUnitMeshState(mesh) {
    if (!mesh || !mesh.userData || !mesh.userData.unit) return;
    const u = mesh.userData.unit;
    if (u.id === this.selectedUnitId) {
      mesh.material = this.availMatSelected;
      mesh.renderOrder = 6;
    } else if (mesh === this.hoveredUnitMesh) {
      mesh.material = this.availMatHover;
      mesh.renderOrder = 5;
    } else {
      mesh.material = this._getAvailMaterial(u.status);
      mesh.renderOrder = 3;
    }
  }

  // --------------------------------------------------------------------------
  // PLANTAS EM IMAGEM NO PAVIMENTO CORTADO (uma variação por apartamento)
  // --------------------------------------------------------------------------
  _buildPlantaSlots(plan) {
    plan.userData.wingsGroup.visible = false; // as asas procedurais dão lugar às plantas humanizadas
    const baseMat = new THREE.MeshBasicMaterial({ color: 0xe9e4da });
    const baseGeo = new THREE.BoxGeometry(1, 0.1, 1);
    plan.userData.slots = plan.userData.quadSlots.map((q, i) => {
      const base = new THREE.Mesh(baseGeo, baseMat.clone());
      base.scale.set(q.w, 1, q.d);
      base.position.set(q.cx, 0.05, q.cz);
      plan.add(base);

      const holder = new THREE.Group();
      holder.position.set(q.cx, 0.13, q.cz);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, toneMapped: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      holder.add(mesh);
      plan.add(holder);
      mesh.userData.aptIdx = i + 1;

      // camada de paredes em relevo (empilhada sobre a planta, no mesmo encaixe da imagem)
      const walls = new THREE.Group();
      walls.visible = false;
      const wallGeo = new THREE.PlaneGeometry(1, 1);
      const layers = WALL_SHADES.map((color) => {
        const m = new THREE.Mesh(
          wallGeo,
          new THREE.MeshBasicMaterial({ color, alphaTest: 0.5, toneMapped: false })
        );
        m.rotation.x = -Math.PI / 2;
        walls.add(m);
        return m;
      });
      holder.add(walls);
      return { q, base, holder, mesh, walls, layers, plantaId: null };
    });
  }

  _loadParedesTexture(id, cb) {
    this._paredesTex = this._paredesTex || new Map();
    let e = this._paredesTex.get(id);
    if (!e) {
      e = { tex: null, waiting: [] };
      this._paredesTex.set(id, e);
      new THREE.TextureLoader().load(
        paredesUrl(id),
        (tex) => {
          tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
          e.tex = tex;
          e.waiting.splice(0).forEach((fn) => fn(tex));
        },
        undefined,
        () => { e.tex = null; e.waiting.length = 0; } // planta sem máscara: fica só a imagem
      );
    }
    if (e.tex) cb(e.tex); else e.waiting.push(cb);
  }

  // Aplica a máscara e as alturas das camadas ao tamanho (fw × fd) da planta no pavimento
  _applyWalls(slot, tex, sc, info) {
    const H = WALL_HEIGHT_RATIO * Math.max(info.w, info.h) * sc;
    slot.layers.forEach((m, k) => {
      if (m.material.map !== tex) { m.material.map = tex; m.material.needsUpdate = true; }
      m.scale.set(info.w * sc, info.h * sc, 1);
      m.position.y = 0.02 + (H * (k + 1)) / WALL_LAYERS;
    });
    slot.walls.visible = true;
  }

  _loadPlantaTexture(id, cb) {
    this._plantaTex = this._plantaTex || new Map();
    let e = this._plantaTex.get(id);
    if (!e) {
      e = { tex: null, waiting: [] };
      this._plantaTex.set(id, e);
      new THREE.TextureLoader().load(plantaUrl(id), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy()); // plantas nítidas em ângulo
        e.tex = tex;
        e.waiting.splice(0).forEach((fn) => fn(tex));
      });
    }
    if (e.tex) cb(e.tex); else e.waiting.push(cb);
  }

  // Preenche os 4 apartamentos do andar `floor` da torre com a planta de cada unidade
  _refreshPlantaSlots(tObj, floor) {
    const slots = tObj.plan.userData.slots;
    if (!slots) return;
    for (const slot of slots) {
      const unit = this.unitByApt && this.unitByApt.get(`${tObj.config.id}-${floor}-${slot.mesh.userData.aptIdx}`);
      slot.unit = unit || null;
      slot.mesh.userData.unit = slot.unit;
      if (!unit) { slot.mesh.visible = false; slot.walls.visible = false; continue; }
      const id = unit.planta;
      slot.plantaId = id;
      slot.walls.visible = false;
      this._loadPlantaTexture(id, (tex) => {
        if (slot.plantaId !== id) return; // o andar mudou enquanto carregava
        const info = plantaInfo(id) || { w: tex.image.width, h: tex.image.height };
        // encaixe "contain"; gira 90° se isso ampliar a planta em mais de 12%
        const fit = (w, h) => Math.min(slot.q.w / w, slot.q.d / h);
        const sNormal = fit(info.w, info.h);
        const sRot = fit(info.h, info.w);
        const rot = sRot > sNormal * 1.12;
        const sc = rot ? sRot : sNormal;
        slot.mesh.material.map = tex;
        slot.mesh.material.needsUpdate = true;
        slot.mesh.scale.set(info.w * sc, info.h * sc, 1);
        // varanda voltada para fora: apartamentos do lado norte giram 180°
        slot.holder.rotation.y = (rot ? Math.PI / 2 : 0) + (slot.q.cz < 0 ? Math.PI : 0);
        // base do apartamento acompanha o tamanho real da planta (com 0,4 de folga)
        const fw = (rot ? info.h : info.w) * sc;
        const fd = (rot ? info.w : info.h) * sc;
        slot.base.scale.set(fw + 0.4, 1, fd + 0.4);
        slot.mesh.visible = true;
        // o holder já aplica a rotação; as camadas usam o mesmo tamanho (info) da imagem
        this._loadParedesTexture(id, (wt) => {
          if (slot.plantaId === id) this._applyWalls(slot, wt, sc, info);
        });
      });
    }
  }

  // Destaca o apartamento escolhido (base ciano) e leva a câmera até ele
  setSelectedApartment(unit, fly = true) {
    this.selectedUnitId = unit ? unit.id : null;
    for (const [, tObj] of this.towerObjects) {
      for (const slot of tObj.plan.userData.slots || []) {
        const sel = !!unit && slot.unit && slot.unit.id === unit.id;
        slot.base.material.color.setHex(sel ? 0x38bdf8 : 0xe9e4da);
      }
    }
    if (unit && fly) {
      const tObj = this.towerObjects.get(unit.tower);
      const slot = tObj && tObj.plan.userData.slots.find((sl) => sl.unit && sl.unit.id === unit.id);
      if (slot) {
        const cfg = tObj.config;
        this.flyTo(
          new THREE.Vector3(cfg.x + slot.q.cx, tObj.planAtY, cfg.z + slot.q.cz),
          26,
          Math.PI * 0.2,
          Math.atan2(Math.sign(slot.q.cx) * 0.4, Math.sign(slot.q.cz))
        );
        this._updateCompassMarkers(cfg.x, tObj.planAtY + 3.4, cfg.z, Math.max(cfg.width, cfg.depth) * 0.82);
      }
    }
  }

  // Posições mundo (acima de cada apartamento) para os rótulos HTML do app
  getApartmentAnchors() {
    const out = [];
    for (const [, tObj] of this.towerObjects) {
      if (!tObj.plan.visible) continue;
      for (const slot of tObj.plan.userData.slots || []) {
        if (!slot.unit) continue;
        out.push({
          unit: slot.unit,
          x: tObj.config.x + slot.q.cx,
          y: tObj.plan.position.y + 1.6,
          z: tObj.config.z + slot.q.cz
        });
      }
    }
    return out;
  }

  // Cria as zonas 3D clicáveis para todas as unidades das 5 Torres em H e das 6 Casas Térreas
  bindUnitsData(units) {
    this.unitMeshes = [];
    this.unitMeshById.clear();
    this.unitByApt = new Map(units.filter((u) => u.tower !== 'CASA').map((u) => [`${u.tower}-${u.floor}-${u.aptIdx}`, u]));

    // Quadrantes dos 4 apartamentos da planta em H:
    // 1: Asa Leste Sul (+1, +1), 2: Asa Oeste Sul (-1, +1), 3: Asa Oeste Norte (-1, -1), 4: Asa Leste Norte (+1, -1)
    const QUADS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const zoneH = FLOOR_H * 0.90;

    for (const u of units) {
      if (u.tower === 'CASA') {
        const casaCfg = CASAS_CONFIG.find(c => c.id === u.id);
        if (!casaCfg) continue;
        const geo = new THREE.BoxGeometry(casaCfg.width * 0.98, 3.5, casaCfg.depth * 0.96);
        const mesh = new THREE.Mesh(geo, this._getAvailMaterial(u.status));
        mesh.position.set(casaCfg.x, BASE_Y + 1.8, casaCfg.z);
        mesh.renderOrder = 3;
        mesh.userData = { unit: u, quad: { sx: casaCfg.x > 0 ? 1 : -1, sz: 1 } };
        this.casasAvailGroup.add(mesh);
        this.unitMeshes.push(mesh);
        this.unitMeshById.set(u.id, mesh);
        continue;
      }

      const tObj = this.towerObjects.get(u.tower);
      if (!tObj) continue;
      const cfg = tObj.config;
      const floorEntry = tObj.floors[u.floor - 1];
      if (!floorEntry) continue;

      const [sx, sz] = QUADS[(u.aptIdx - 1) % QUADS.length];
      const wingW = cfg.width * 0.41;
      const wingX = (cfg.width - wingW) * 0.5;
      const halfD = cfg.depth * 0.50;

      const geo = new THREE.BoxGeometry(wingW + 0.28, zoneH, halfD + 0.22);
      const mesh = new THREE.Mesh(geo, this._getAvailMaterial(u.status));
      mesh.position.set(sx * wingX, FLOOR_H * 0.5, sz * (cfg.depth * 0.25 + 0.08));
      mesh.renderOrder = 3;
      mesh.userData = { unit: u, quad: { sx, sz } };

      floorEntry.availGroup.add(mesh);
      this.unitMeshes.push(mesh);
      this.unitMeshById.set(u.id, mesh);
    }
  }

  _getAvailMaterial(status) {
    if (status === 'disponivel') return this.availMatDisponivel;
    if (status === 'reservado') return this.availMatReservado;
    return this.availMatVendido;
  }

  // ==========================================================================
  // MAPA DE ENTORNO 3D FOTOREALISTA (VISÍVEL EM TODOS OS MODOS 3D EXCETO PLANTA)
  // ==========================================================================
  _buildSurroundingsMap() {
    this.surroundingsGroup = new THREE.Group();
    this.surroundingsGroup.visible = this.mode !== 'planta';
    this.scene.add(this.surroundingsGroup);

    const maxAniso = this.renderer && this.renderer.capabilities
      ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
      : 4;

    // 1. Terreno de satélite procedural de alta resolução ([-512..512] com recorte exato do embasamento)
    const satTex = createSatelliteTerrainTexture(maxAniso);
    const innerEarthGeo = buildCutoutGroundGeometry(512, -51.5, 51.5, -39.0, 47.0, 512, 0.16);
    const innerEarthMat = new THREE.MeshStandardMaterial({
      map: satTex,
      roughness: 0.94,
      metalness: 0.02
    });
    const innerEarth = new THREE.Mesh(innerEarthGeo, innerEarthMat);
    innerEarth.receiveShadow = true;
    this.surroundingsGroup.add(innerEarth);

    // Anel externo contínuo até o horizonte nebuloso ([-1350..1350] fora de [-512..512])
    const outerTex = createOuterTerrainTexture(maxAniso);
    const outerEarthGeo = buildCutoutGroundGeometry(1350, -512, 512, -512, 512, 1350, 0.15, 7);
    const outerEarthMat = new THREE.MeshStandardMaterial({
      map: outerTex,
      roughness: 0.96,
      metalness: 0.01
    });
    const outerEarth = new THREE.Mesh(outerEarthGeo, outerEarthMat);
    this.surroundingsGroup.add(outerEarth);

    // Lago ornamental do parque leste (como na imagem aérea de referência)
    const pondGeo = new THREE.CircleGeometry(28, 32);
    pondGeo.rotateX(-Math.PI / 2);
    const pondMat = new THREE.MeshStandardMaterial({
      color: 0x1b3b42,
      roughness: 0.12,
      metalness: 0.28,
      envMapIntensity: 1.4
    });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.position.set(165, 0.21, -96);
    pond.scale.set(1.45, 1, 0.85);
    this.surroundingsGroup.add(pond);

    // 2. Vias multi-faixas, avenidas arteriais e continuação da rua frontal
    const roadAsphaltMat = new THREE.MeshStandardMaterial({
      map: createRoadAsphaltTexture(maxAniso),
      roughness: 0.82,
      metalness: 0.04
    });
    const roadCurbMat = new THREE.MeshStandardMaterial({
      color: 0x949ba5,
      roughness: 0.72
    });

    const addRoadCurve = (points, width, segments = 48, withCurbs = true) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const roadMesh = new THREE.Mesh(buildRibbonGeometry(curve, width, segments, 0.045), roadAsphaltMat);
      this.surroundingsGroup.add(roadMesh);

      if (withCurbs) {
        const curbMesh = new THREE.Mesh(
          buildRibbonGeometry(
            new THREE.CatmullRomCurve3(points.map((pt) => new THREE.Vector3(pt.x, pt.y - 0.02, pt.z))),
            width + 2.2,
            segments,
            0.04
          ),
          roadCurbMat
        );
        this.surroundingsGroup.add(curbMesh);
      }
    };

    // Extensões Oeste e Leste da rua frontal da Portaria (z = 40.2, conectando o nível 0.54 ao nível urbano 0.24)
    addRoadCurve([
      new THREE.Vector3(-51.6, 0.54, 40.2),
      new THREE.Vector3(-72, 0.26, 40.2),
      new THREE.Vector3(-220, 0.24, 40.2),
      new THREE.Vector3(-480, 0.24, 40.2)
    ], 11.2, 24);

    addRoadCurve([
      new THREE.Vector3(51.6, 0.54, 40.2),
      new THREE.Vector3(72, 0.26, 40.2),
      new THREE.Vector3(220, 0.24, 40.2),
      new THREE.Vector3(480, 0.24, 40.2)
    ], 11.2, 24);

    // Avenida arterial curva a Oeste/Noroeste (fiel à referência aérea)
    addRoadCurve([
      new THREE.Vector3(-235, 0.25, 480),
      new THREE.Vector3(-125, 0.25, 220),
      new THREE.Vector3(-88, 0.25, 40.2),
      new THREE.Vector3(-96, 0.25, -74),
      new THREE.Vector3(-155, 0.25, -260),
      new THREE.Vector3(-245, 0.25, -480)
    ], 10.6, 60);

    // Avenida Norte e Avenida Leste
    addRoadCurve([
      new THREE.Vector3(-480, 0.24, -74),
      new THREE.Vector3(-120, 0.24, -74),
      new THREE.Vector3(120, 0.24, -74),
      new THREE.Vector3(480, 0.24, -74)
    ], 9.4, 32);

    addRoadCurve([
      new THREE.Vector3(92, 0.24, -480),
      new THREE.Vector3(92, 0.24, -140),
      new THREE.Vector3(92, 0.24, 40.2),
      new THREE.Vector3(108, 0.24, 240),
      new THREE.Vector3(128, 0.24, 480)
    ], 9.2, 36);

    // 3. Quadras com edifícios urbanos escalonados e texturizados (sem bumpMap/aoMap para mergeStatic limpo!)
    const urbanResMat = new THREE.MeshStandardMaterial({
      map: createUrbanFacadeTexture('residential', maxAniso),
      roughness: 0.62,
      metalness: 0.05
    });
    const urbanOfficeMat = new THREE.MeshStandardMaterial({
      map: createUrbanFacadeTexture('commercial', maxAniso),
      roughness: 0.32,
      metalness: 0.28,
      envMapIntensity: 1.1
    });
    const urbanLowMat = new THREE.MeshStandardMaterial({
      map: createUrbanFacadeTexture('lowrise', maxAniso),
      roughness: 0.72,
      metalness: 0.04
    });
    const urbanPodiumMat = new THREE.MeshStandardMaterial({
      color: 0xd0c9c0,
      roughness: 0.78
    });
    const urbanRoofDarkMat = new THREE.MeshStandardMaterial({
      color: 0x454a54,
      roughness: 0.72
    });
    const urbanRoofWarmMat = new THREE.MeshStandardMaterial({
      color: 0x8d6e63,
      roughness: 0.74
    });

    // Ajusta os UVs das fachadas laterais para escala realista de andares (compatível com mergeStatic)
    const makeFacadeBox = (w, h, d, repeatX, repeatY) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const uv = geo.attributes.uv;
      const nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const ny = Math.abs(nrm.getY(i));
        if (ny < 0.5) {
          const sx = Math.abs(nrm.getX(i)) > 0.5 ? (d / 10) : (w / 10);
          uv.setXY(i, uv.getX(i) * sx * repeatX, uv.getY(i) * repeatY);
        }
      }
      return geo;
    };

    const rng = createRng(2026);
    const addSteppedBuilding = (bx, bz, bw, bd, bh, style) => {
      const baseY = 0.16;
      const bodyMat = style === 0 ? urbanResMat : style === 1 ? urbanOfficeMat : urbanLowMat;
      const roofMat = style === 2 ? urbanRoofWarmMat : urbanRoofDarkMat;

      if (bh >= 8.5) {
        // Pódio + Corpo Principal + Cobertura/Barrilete Técnico
        const podH = 2.0;
        const pod = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.12, podH, bd * 1.12), urbanPodiumMat);
        pod.position.set(bx, baseY + podH * 0.5, bz);
        this.surroundingsGroup.add(pod);

        const shaftH = bh - podH;
        const shaft = new THREE.Mesh(
          makeFacadeBox(bw, shaftH, bd, 1.0, Math.max(0.45, shaftH / 16)),
          bodyMat
        );
        shaft.position.set(bx, baseY + podH + shaftH * 0.5, bz);
        this.surroundingsGroup.add(shaft);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, 0.35, bd + 0.3), roofMat);
        cap.position.set(bx, baseY + bh + 0.17, bz);
        this.surroundingsGroup.add(cap);

        const pentH = 1.2 + (bw % 1.4);
        const pent = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.44, pentH, bd * 0.44), roofMat);
        pent.position.set(bx, baseY + bh + 0.35 + pentH * 0.5, bz);
        this.surroundingsGroup.add(pent);
      } else {
        // Edificação baixa / média texturizada com janelas reais, platibanda clara e laje técnica
        const bodyGeo = makeFacadeBox(bw, bh, bd, 1.0, Math.max(0.35, bh / 6.0));
        const mesh = new THREE.Mesh(bodyGeo, bodyMat);
        mesh.position.set(bx, baseY + bh * 0.5, bz);
        this.surroundingsGroup.add(mesh);

        const parapet = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.24, 0.24, bd + 0.24), urbanPodiumMat);
        parapet.position.set(bx, baseY + bh + 0.12, bz);
        this.surroundingsGroup.add(parapet);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.86, 0.26, bd * 0.86), roofMat);
        roof.position.set(bx, baseY + bh + 0.15, bz);
        this.surroundingsGroup.add(roof);
      }
    };

    const gridCols = [-350, -295, -240, -195, -140, -70, 72, 128, 178, 228, 285, 345];
    const gridRows = [-355, -295, -240, -185, -130, -96, -50, -10, 22, 68, 110, 165, 225, 290];

    for (let xi = 0; xi < gridCols.length; xi++) {
      for (let zi = 0; zi < gridRows.length; zi++) {
        const cx = gridCols[xi] + (rng() - 0.5) * 14;
        const cz = gridRows[zi] + (rng() - 0.5) * 12;

        // Mantém zona livre ao redor do empreendimento e eixos rodoviários
        if (cx > -66 && cx < 66 && cz > -50 && cz < 56) continue;
        if (Math.abs(cz - 40.2) < 12 || Math.abs(cz + 74) < 11) continue;
        if (Math.abs(cx - 92) < 12 || Math.abs(cx + 90) < 12) continue;
        // Mantém frente sul baixa para nunca bloquear a câmera Frontal/Aérea
        const isSouthForeground = cz > 52 && Math.abs(cx) < 95;
        // Mantém parques abertos
        if (cx < -130 && cx > -310 && cz > 105 && cz < 275) continue;
        if (cx > 125 && cx < 215 && cz > -145 && cz < -55) continue;

        const dist = Math.hypot(cx, cz);
        const bw = 7.5 + rng() * 8.5;
        const bd = 7.0 + rng() * 8.0;
        let bh;
        if (isSouthForeground) {
          bh = 2.2 + rng() * 2.2;
        } else if (dist < 130) {
          bh = 2.8 + rng() * 5.2;
        } else if (rng() < 0.34) {
          bh = 10.5 + rng() * 14.5;
        } else {
          bh = 3.2 + rng() * 5.8;
        }
        const style = bh >= 8.5 ? (rng() < 0.65 ? 0 : 1) : 2;
        addSteppedBuilding(cx, cz, bw, bd, bh, style);
      }
    }

    // 4. Arborização urbana com tronco e copa em camadas (substitui esferas dodecaédricas soltas)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.9 });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2c4b21, roughness: 0.86 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3b612a, roughness: 0.84 });

    const plantUrbanTree = (tx, tz, scale, toneIdx) => {
      const trunkH = 1.6 * scale;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, trunkH, 6), trunkMat);
      trunk.position.set(tx, 0.16 + trunkH * 0.5, tz);
      this.surroundingsGroup.add(trunk);

      const leafMat = toneIdx % 2 === 0 ? leafMat1 : leafMat2;
      const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45 * scale, 1), leafMat);
      c1.position.set(tx, 0.16 + trunkH + 0.85 * scale, tz);
      c1.scale.set(1.1, 0.72, 1.1);
      this.surroundingsGroup.add(c1);

      const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05 * scale, 1), leafMat);
      c2.position.set(tx + 0.55 * scale, 0.16 + trunkH + 1.25 * scale, tz - 0.35 * scale);
      c2.scale.set(1.0, 0.75, 1.0);
      this.surroundingsGroup.add(c2);
    };

    // Arborização ao longo das vias próximas e perimetrais ao condomínio
    for (let x = -380; x <= 380; x += 18) {
      if (Math.abs(x) < 60) continue;
      plantUrbanTree(x, 32.5, 0.95 + rng() * 0.35, Math.abs(x));
      plantUrbanTree(x + 8, 48.2, 0.95 + rng() * 0.35, Math.abs(x) + 1);
      if (Math.abs(x) > 74) {
        plantUrbanTree(x + 4, -66.0, 0.9 + rng() * 0.4, Math.abs(x) + 2);
      }
    }
    for (let z = -340; z <= 340; z += 22) {
      if (z > -42 && z < 48) continue;
      plantUrbanTree(-80.0, z, 0.9 + rng() * 0.35, Math.abs(z));
      plantUrbanTree(84.0, z + 6, 0.9 + rng() * 0.35, Math.abs(z) + 1);
    }
    for (let i = 0; i < 180; i++) {
      const tx = i < 100
        ? -220 + (rng() - 0.5) * 150
        : 155 + (rng() - 0.5) * 145;
      const tz = i < 100
        ? 185 + (rng() - 0.5) * 120
        : -95 + (rng() - 0.5) * 110;
      if (Math.hypot(tx - 165, tz + 96) < 34) continue;
      plantUrbanTree(tx, tz, 1.1 + rng() * 0.65, i);
    }

    // Fusão estática de todo o entorno (centenas de prédios, árvores e vias em poucas chamadas WebGL)
    this.surroundingsGroup.userData.mergeStats = mergeStatic(this.surroundingsGroup);
  }

  // ==========================================================================
  // CAMADA 3D DO MODO LOCALIZAÇÃO (ANÉIS DE DISTÂNCIA E ROTAS PARA POIS)
  // ==========================================================================
  _buildLocationOverlay() {
    this.locationOverlayGroup = new THREE.Group();
    this.locationOverlayGroup.visible = false;
    this.scene.add(this.locationOverlayGroup);

    const centerX = 0;
    const centerZ = 2;
    const ringY = 0.76;

    // 1. Anéis concêntricos luminosos verde-lima (500m, 1km, 2km)
    const rings = [
      { r: 68, label: '500m', angle: 2.22 },
      { r: 108, label: '1 km', angle: 2.08 },
      { r: 156, label: '2 km', angle: 2.34 }
    ];

    const coreRingMat = new THREE.MeshBasicMaterial({
      color: 0x84ff3a,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    const glowRingMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          float dist = abs(vUv.y - 0.5) * 2.0;
          float glow = exp(-dist * dist * 5.2) * 0.55;
          gl_FragColor = vec4(0.45, 1.0, 0.25, glow);
        }
      `
    });

    for (const cfg of rings) {
      const coreGeo = new THREE.RingGeometry(cfg.r - 0.36, cfg.r + 0.36, 128);
      coreGeo.rotateX(-Math.PI / 2);
      const coreMesh = new THREE.Mesh(coreGeo, coreRingMat);
      coreMesh.position.set(centerX, ringY, centerZ);
      coreMesh.renderOrder = 3;
      this.locationOverlayGroup.add(coreMesh);

      // Anel halo aditivo com UV radial explícito
      const haloSegs = 128;
      const haloPos = [];
      const haloUv = [];
      const haloIdx = [];
      const rIn = cfg.r - 2.6;
      const rOut = cfg.r + 2.6;
      for (let i = 0; i <= haloSegs; i++) {
        const th = (i / haloSegs) * Math.PI * 2;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        haloPos.push(cs * rIn, ringY, sn * rIn, cs * rOut, ringY, sn * rOut);
        haloUv.push(i / haloSegs, 0, i / haloSegs, 1);
        if (i < haloSegs) {
          const a = i * 2;
          haloIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const haloGeo = new THREE.BufferGeometry();
      haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPos, 3));
      haloGeo.setAttribute('uv', new THREE.Float32BufferAttribute(haloUv, 2));
      haloGeo.setIndex(haloIdx);
      const haloMesh = new THREE.Mesh(haloGeo, glowRingMat);
      haloMesh.position.set(centerX, 0, centerZ);
      haloMesh.renderOrder = 2;
      this.locationOverlayGroup.add(haloMesh);

      const badgeSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createDistanceLabelTexture(cfg.label),
        transparent: true,
        depthWrite: false
      }));
      badgeSprite.scale.set(14, 5.2, 1);
      badgeSprite.position.set(
        centerX + Math.sin(cfg.angle) * cfg.r,
        ringY + 2.1,
        centerZ + Math.cos(cfg.angle) * cfg.r
      );
      badgeSprite.renderOrder = 6;
      this.locationOverlayGroup.add(badgeSprite);
    }

    // 2. Arcos de rota luminosos em 3D conectando o empreendimento aos principais POIs
    this._routeArcUniforms = { uTime: { value: 0 } };
    const routeCoreMat = new THREE.ShaderMaterial({
      uniforms: this._routeArcUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float pulse = pow(0.5 + 0.5 * cos((vUv.x - uTime * 0.35) * 12.566), 4.0);
          vec3 col = mix(vec3(0.22, 0.55, 1.0), vec3(0.75, 0.95, 1.0), pulse * 0.85);
          float alpha = 0.72 + pulse * 0.28;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
    const routeSheathMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const poiBeaconMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    const keyPoiIds = new Set([
      'ibirapuera', 'jabaquara', 'metro_vm', 'sh_santa_cruz',
      'paulista', 'hsp', 'sh_ibirapuera', 'aclimacao'
    ]);
    const keyPois = POIS_ENTORNO.filter((p) => keyPoiIds.has(p.id));

    for (const poi of keyPois) {
      // Origem na borda perimetral do condomínio na direção do POI, com arcos elevados visíveis acima das torres
      const dirX = poi.x;
      const dirZ = poi.z - 2;
      const dirLen = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / dirLen;
      const nz = dirZ / dirLen;
      const startX = Math.max(-49, Math.min(49, nx * 52));
      const startZ = Math.max(-36, Math.min(41, nz * 42 + 2));
      const start = new THREE.Vector3(startX, 1.4, startZ);
      const end = new THREE.Vector3(poi.x, 1.2, poi.z);
      const dist = start.distanceTo(end);
      const mid1 = new THREE.Vector3().lerpVectors(start, end, 0.35);
      const mid2 = new THREE.Vector3().lerpVectors(start, end, 0.70);
      // Desvio lateral sutil e elevação arqueada para visibilidade aérea clara
      const perpX = -(end.z - start.z) / Math.max(dist, 1);
      const perpZ = (end.x - start.x) / Math.max(dist, 1);
      mid1.x += perpX * 6.5;
      mid1.z += perpZ * 6.5;
      mid1.y = 8.5 + dist * 0.11;
      mid2.x += perpX * 4.5;
      mid2.z += perpZ * 4.5;
      mid2.y = 7.5 + dist * 0.095;

      const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
      const coreMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, 0.34, 8, false), routeCoreMat);
      coreMesh.renderOrder = 4;
      this.locationOverlayGroup.add(coreMesh);

      const sheathMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, 0.85, 8, false), routeSheathMat);
      sheathMesh.renderOrder = 3;
      this.locationOverlayGroup.add(sheathMesh);

      const beaconGeo = new THREE.RingGeometry(1.1, 1.85, 32);
      beaconGeo.rotateX(-Math.PI / 2);
      const beacon = new THREE.Mesh(beaconGeo, poiBeaconMat);
      beacon.position.set(poi.x, ringY + 0.04, poi.z);
      beacon.renderOrder = 4;
      this.locationOverlayGroup.add(beacon);
    }
  }

  // ==========================================================================
  // VISTAS DE CÂMERA E MODOS DO SISTEMA
  // ==========================================================================
  _frameModel() {
    this.flyTo(new THREE.Vector3(0, 2.5, 6), 142, 1.12, -0.48);
  }

  _showIsolatedModel() {
    this.camState.goalFov = 38;
    this.skyDome.visible = false;
    this.surroundingsGroup.visible = false;
    this.locationOverlayGroup.visible = false;
    this.scene.background.setHex(0x42454a);
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.density = 0;
  }

  _applyShowcaseAtmosphere(fogDensity = SHOWCASE_FOG_DENSITY) {
    this.scene.background.setHex(SKY_HORIZON_HEX);
    this.scene.fog.color.setHex(SKY_HORIZON_HEX);
    this.scene.fog.density = fogDensity;
    this._syncSkyHorizonColor(SKY_HORIZON_HEX);
    if (this.skyDome) this.skyDome.visible = true;
    if (this.surroundingsGroup) this.surroundingsGroup.visible = true;
  }

  setCameraPreset(presetName) {
    this._markShadowsDirty();
    this.camState.autoRotate = false;
    if (presetName === 'aerea') {
      this._applyShowcaseAtmosphere(SHOWCASE_FOG_DENSITY);
      if (this.locationOverlayGroup) this.locationOverlayGroup.visible = (this.mode === 'localizacao');
      this._hideCompassMarkers();
      this.hemiLight.intensity = 0.98;
      this.dirLight.intensity = 1.68;
      this.dirLight.position.set(50, 102, 70);
      if (this.setLowRiseRoofsVisibleFn) this.setLowRiseRoofsVisibleFn(true);
      this.setFloorCut('ALL', 19, false);
      this.flyTo(new THREE.Vector3(0, 7, 1), 145, 1.18, -0.59);
    } else if (presetName === 'frontal') {
      this._applyShowcaseAtmosphere(SHOWCASE_FOG_DENSITY);
      if (this.locationOverlayGroup) this.locationOverlayGroup.visible = (this.mode === 'localizacao');
      this._hideCompassMarkers();
      this.hemiLight.intensity = 1.04;
      this.dirLight.intensity = 1.72;
      this.dirLight.position.set(42, 88, 82);
      if (this.setLowRiseRoofsVisibleFn) this.setLowRiseRoofsVisibleFn(true);
      this.setFloorCut('ALL', 19, false);
      // Do outro lado da rua, enquadra o pórtico e as fachadas atrás dele.
      this.flyTo(new THREE.Vector3(0, 7.6, -4), 50, 1.65, 0.17);
    } else if (presetName === 'planta_baixa') {
      // Planta Baixa Geral: fundo escuro arquitetônico nítido e entorno oculto para máxima legibilidade
      if (this.skyDome) this.skyDome.visible = false;
      if (this.surroundingsGroup) this.surroundingsGroup.visible = false;
      if (this.locationOverlayGroup) this.locationOverlayGroup.visible = false;
      this._hideCompassMarkers();
      this.scene.background.setHex(PLANTA_BG_HEX);
      this.scene.fog.color.setHex(PLANTA_BG_HEX);
      this.scene.fog.density = PLANTA_FOG_DENSITY;
      this.hemiLight.intensity = 1.28;
      this.dirLight.intensity = 1.48;
      this.dirLight.position.set(28, 135, 35);
      if (this.setLowRiseRoofsVisibleFn) this.setLowRiseRoofsVisibleFn(false);
      this.setFloorCut('ALL', 1, false);
      for (const [, tObj] of this.towerObjects) {
        tObj.cutFloorNow = tObj.cutFloorGoal;
      }
      this._updateCuts();
      this.flyTo(new THREE.Vector3(0, 1.5, 4), 135, 0.035, 0.0);
    }
  }

  focusOnSector(sectorId, mirrorX = false) {
    const sec = SECTORS_LEGENDA.find(s => s.id === sectorId || s.num === Number(sectorId)) ||
      VISTAS_COMPLEMENTARES.find(s => s.id === sectorId);
    if (!sec) return;
    this.camState.autoRotate = false;
    if (this.mode === 'planta') {
      this.flyTo(new THREE.Vector3(sec.x ?? sec.camTarget.x, 1.5, sec.z ?? sec.camTarget.z), 65, 0.035, 0);
      return;
    }
    this._applyShowcaseAtmosphere();
    const side = mirrorX && sec.id === 'casas_aluguel' ? -1 : 1;
    this.flyTo(
      new THREE.Vector3(side * sec.camTarget.x, sec.camTarget.y, sec.camTarget.z),
      sec.camSpherical.radius,
      sec.camSpherical.phi,
      side * sec.camSpherical.theta,
      64
    );
  }

  setMode(mode) {
    this._markShadowsDirty();
    this.mode = mode;
    this.camState.autoRotate = mode === 'filme' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const showAvail = (mode === 'unidades');
    for (const [, tObj] of this.towerObjects) {
      for (const fEntry of tObj.floors) {
        fEntry.availGroup.visible = showAvail;
      }
    }
    if (this.casasAvailGroup) {
      this.casasAvailGroup.visible = showAvail;
    }

    if (!showAvail) {
      if (this._hoverUnitEdges) this._hoverUnitEdges.visible = false;
      if (this._selectedUnitEdges) this._selectedUnitEdges.visible = false;
      if (this._selectedUnitGlowEdges) this._selectedUnitGlowEdges.visible = false;
      if (this.hoveredUnitMesh) {
        const prev = this.hoveredUnitMesh;
        this.hoveredUnitMesh = null;
        this._applyUnitMeshState(prev);
      }
      if (mode !== 'desmonte') {
        this._hideCompassMarkers();
      }
    } else {
      this._hideCompassMarkers();
    }

    if (mode === 'planta') {
      this.setCameraPreset('planta_baixa');
      return;
    }

    const isLoc = mode === 'localizacao';
    if (mode === 'desmonte' || mode === 'unidades') this._showIsolatedModel();
    else this._applyShowcaseAtmosphere(isLoc ? LOCATION_FOG_DENSITY : SHOWCASE_FOG_DENSITY);
    this.locationOverlayGroup.visible = isLoc;

    this.hemiLight.intensity = 0.98;
    this.dirLight.intensity = 1.68;
    this.dirLight.position.set(50, 102, 70);

    if (this.setLowRiseRoofsVisibleFn) {
      this.setLowRiseRoofsVisibleFn(true);
    }

    if (mode !== 'desmonte') {
      this.setFloorCut('ALL', 19, false);
    }

    if (mode === 'filme') {
      this.flyTo(new THREE.Vector3(0, 8, 2), 143, 1.23, -0.56);
    } else if (mode === 'desmonte') {
      this._frameModel();
    } else if (mode === 'localizacao') {
      this.flyTo(new THREE.Vector3(-6, 6, -30), 178, Math.PI * 0.225, -0.06);
    } else if (mode === 'unidades') {
      this.flyTo(new THREE.Vector3(0, 9, -5), 119, 1.31, -0.25);
    }
  }

  // Corta os pavimentos acima de `floorNum` e exibe a Planta Humanizada 3D em H
  setFloorCut(towerId = 'ALL', floorNum = 19, animateCamera = true) {
    this._markShadowsDirty(45);
    if (this.mode === 'desmonte' && floorNum <= 18) this._showIsolatedModel();
    this.selectedTowerId = towerId;
    this.cutFloor = floorNum;

    // Se o usuário cortou todas as torres nos primeiros pavimentos, também abre os telhados térreos
    if (this.mode !== 'planta' && this.setLowRiseRoofsVisibleFn) {
      this.setLowRiseRoofsVisibleFn(!(towerId === 'ALL' && floorNum <= 2));
    }

    for (const [id, tObj] of this.towerObjects) {
      const maxF = tObj.config.floors;
      const applies = (towerId === 'ALL' || towerId === id);
      const eff = applies ? Math.min(floorNum, maxF) : maxF;
      const isSliced = applies && floorNum <= maxF;
      const floorBottom = BASE_Y + (eff - 1) * FLOOR_H;

      tObj.cutFloorGoal = isSliced ? eff - 1 : maxF + 1;
      tObj.planAtY = floorBottom + 0.05;
      tObj.planWanted = isSliced;
      if (!animateCamera) {
        tObj.cutFloorNow = tObj.cutFloorGoal;
      }
      if (!isSliced) tObj.plan.visible = false;
      else this._refreshPlantaSlots(tObj, eff);

      for (const fEntry of tObj.floors) {
        fEntry.group.visible = fEntry.floor <= eff;
      }
    }

    if (!animateCamera) {
      this._updateCuts();
    }

    if (towerId !== 'ALL') {
      const tObj = this.towerObjects.get(towerId);
      if (tObj) {
        const cfg = tObj.config;
        const cutY = BASE_Y + Math.min(floorNum, cfg.floors) * FLOOR_H;
        if (floorNum <= cfg.floors) {
          this._updateCompassMarkers(cfg.x, cutY + 2.4, cfg.z, Math.max(cfg.width, cfg.depth) * 0.62);
          if (animateCamera) {
            this.flyTo(new THREE.Vector3(cfg.x, cutY, cfg.z), 38, 0.48, -0.48);
          }
        } else {
          this._hideCompassMarkers();
          if (animateCamera) {
            this.flyTo(new THREE.Vector3(cfg.x, cutY * 0.55, cfg.z), 74, Math.PI * 0.34, -0.18);
          }
        }
      }
    } else if (this.mode === 'desmonte') {
      this._hideCompassMarkers();
    }
  }

  _updateCuts() {
    let anyAnimating = false;
    for (const [, t] of this.towerObjects) {
      const diff = t.cutFloorGoal - t.cutFloorNow;
      if (Math.abs(diff) > 0.15) {
        this._markShadowsDirty(2);
        t.cutFloorNow += diff * 0.34;
        anyAnimating = true;
      } else {
        if (t.cutFloorNow !== t.cutFloorGoal) {
          this._markShadowsDirty(4);
        }
        t.cutFloorNow = t.cutFloorGoal;
      }

      const roundedCut = Math.round(t.cutFloorNow);
      if (this.setTowerCutFn) {
        this.setTowerCutFn(t.index, roundedCut);
      }
      if (t.planWanted) {
        t.plan.position.y = t.planAtY;
        // Só exibe a planta humanizada quando a laje superior do andar cortado já foi ocultada
        t.plan.visible = roundedCut <= t.cutFloorGoal && Math.abs(t.cutFloorNow - t.cutFloorGoal) < 0.6;
      } else {
        t.plan.visible = false;
      }
    }
    if (anyAnimating) {
      this._lastActivity = performance.now();
    }
  }

  // Escolhe azimute e raio livres dentro do próprio quadrante da unidade para evitar obstrução por outras torres
  _pickUnobstructedUnitPose(unit, worldPos, defaultRadius, phi, defaultAzimuth) {
    if (!unit || unit.tower === 'CASA') return { azimuth: defaultAzimuth, radius: defaultRadius };

    const q = { sx: 1, sz: 1 };
    const mesh = this.unitMeshById.get(unit.id);
    if (mesh && mesh.userData && mesh.userData.quad) {
      q.sx = mesh.userData.quad.sx;
      q.sz = mesh.userData.quad.sz;
    }

    // Prioriza ângulos no mesmo quadrante (sx, sz) testando raios entre torres antes de recorrer a ângulos externos
    const quadrantCandidates = [
      { az: defaultAzimuth, radii: [defaultRadius, 40, 34] },
      { az: Math.atan2(q.sx * 0.85, q.sz * 0.55), radii: [42, 36, 32] },
      { az: Math.atan2(q.sx * 0.96, q.sz * 0.28), radii: [38, 34, 30] },
      { az: Math.atan2(q.sx * 0.42, q.sz * 0.90), radii: [42, 36, 32] },
      { az: Math.atan2(q.sx * 0.95, -q.sz * 0.22), radii: [38, 34] },
      { az: Math.atan2(q.sx * 0.55, 1.0), radii: [defaultRadius] },
      { az: 0.28, radii: [defaultRadius] },
      { az: -0.28, radii: [defaultRadius] }
    ];

    const otherBoxes = TOWERS_CONFIG
      .filter((t) => t.id !== unit.tower)
      .map((t) => new THREE.Box3(
        new THREE.Vector3(t.x - t.width * 0.54, BASE_Y, t.z - t.depth * 0.54),
        new THREE.Vector3(t.x + t.width * 0.54, t.roofTop + 0.5, t.z + t.depth * 0.54)
      ));

    // Evita também que a própria ala frontal da mesma torre encubra uma unidade voltada para o norte/sul
    const ownCfg = TOWERS_CONFIG.find((t) => t.id === unit.tower);
    const ownOppositeWingBox = ownCfg ? new THREE.Box3(
      new THREE.Vector3(
        ownCfg.x - ownCfg.width * 0.52,
        BASE_Y,
        ownCfg.z + (q.sz < 0 ? 0.4 : -ownCfg.depth * 0.52)
      ),
      new THREE.Vector3(
        ownCfg.x + ownCfg.width * 0.52,
        ownCfg.roofTop,
        ownCfg.z + (q.sz < 0 ? ownCfg.depth * 0.52 : -0.4)
      )
    ) : null;

    const sph = new THREE.Spherical(defaultRadius, phi, 0);
    const camCandidate = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    const ray = new THREE.Ray();
    const hitPt = new THREE.Vector3();

    for (const cand of quadrantCandidates) {
      for (const r of cand.radii) {
        sph.radius = r;
        sph.theta = cand.az;
        camCandidate.setFromSpherical(sph).add(worldPos);
        rayDir.subVectors(worldPos, camCandidate);
        const distToTarget = rayDir.length();
        rayDir.normalize();
        ray.set(camCandidate, rayDir);

        let blocked = false;
        for (const box of otherBoxes) {
          if (box.containsPoint(camCandidate) || (ray.intersectBox(box, hitPt) && hitPt.distanceTo(camCandidate) < distToTarget - 0.5)) {
            blocked = true;
            break;
          }
        }
        if (!blocked && ownOppositeWingBox) {
          if (ray.intersectBox(ownOppositeWingBox, hitPt) && hitPt.distanceTo(camCandidate) < distToTarget - 2.0) {
            blocked = true;
          }
        }
        if (!blocked) return { azimuth: cand.az, radius: r };
      }
    }
    return { azimuth: defaultAzimuth, radius: defaultRadius };
  }

  focusOnUnit(unitId) {
    const mesh = this.unitMeshById.get(unitId);
    if (!mesh) return;

    const prevId = this.selectedUnitId;
    this.selectedUnitId = unitId;
    if (prevId && prevId !== unitId) {
      const prevMesh = this.unitMeshById.get(prevId);
      if (prevMesh) this._applyUnitMeshState(prevMesh);
    }
    this._applyUnitMeshState(mesh);
    this._positionEdgeOutline(this._selectedUnitEdges, mesh);
    if (this._selectedUnitGlowEdges) {
      this._positionEdgeOutline(this._selectedUnitGlowEdges, mesh);
      const p = mesh.geometry.parameters;
      this._selectedUnitGlowEdges.scale.set(p.width + 0.11, p.height + 0.11, p.depth + 0.11);
    }

    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    const u = mesh.userData.unit;
    if (u && u.tower === 'CASA') {
      const casaCfg = CASAS_CONFIG.find((c) => c.id === u.id);
      if (casaCfg) {
        this._updateCompassMarkers(casaCfg.x, BASE_Y + 4.4, casaCfg.z, 7.2);
      }
    } else if (u) {
      const tObj = this.towerObjects.get(u.tower);
      if (tObj) {
        const cfg = tObj.config;
        const markerY = Math.min(cfg.roofTop + 2.4, worldPos.y + 6.2);
        this._updateCompassMarkers(cfg.x, markerY, cfg.z, Math.max(cfg.width, cfg.depth) * 0.56);
      }
    }

    const q = mesh.userData.quad || { sx: 0, sz: 1 };
    const defaultAz = Math.atan2(q.sx * 0.65, q.sz);
    const defaultRadius = u && u.tower === 'CASA' ? 36 : 48;
    const focusPhi = Math.PI * 0.35;
    const pose = this._pickUnobstructedUnitPose(u, worldPos, defaultRadius, focusPhi, defaultAz);
    this.flyTo(worldPos, pose.radius, focusPhi, pose.azimuth);
  }

  flyTo(targetVec, radius, phi, theta, fov = 38) {
    this.camState.goalTarget.set(targetVec.x, targetVec.y, targetVec.z);
    this.camState.goalSpherical.radius = Math.max(4, Math.min(260, radius));
    this.camState.goalSpherical.phi = Math.max(0.025, Math.min(Math.PI * 0.56, phi));
    const currentTheta = this.camState.spherical.theta;
    this.camState.goalSpherical.theta = currentTheta +
      THREE.MathUtils.euclideanModulo(theta - currentTheta + Math.PI, 2 * Math.PI) - Math.PI;
    this.camState.goalFov = fov;
  }

  _applyCameraTransform() {
    const offset = new THREE.Vector3().setFromSpherical(this.camState.spherical);
    this.camera.position.copy(this.camState.target).add(offset);
    this.camera.position.y = Math.max(1.3, this.camera.position.y);
    this.camera.lookAt(this.camState.target);
    if (this.skyDome) {
      this.skyDome.position.set(this.camera.position.x, 0, this.camera.position.z);
    }
  }

  projectToScreen(x, y, z) {
    const v = this._projV || (this._projV = new THREE.Vector3());
    v.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-(v.y * 0.5) + 0.5) * h
    };
  }

  // Arrasta o alvo da câmera no plano da tela (botão direito/Shift no mouse; dois dedos no toque)
  _panCamera(dx, dy) {
    const panSpeed = this.camState.spherical.radius * 0.0012;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    this.camera.getWorldDirection(right);
    right.cross(up).normalize();
    this.camState.goalTarget.addScaledVector(right, -dx * panSpeed);
    this.camState.goalTarget.y = Math.max(1, Math.min(45, this.camState.goalTarget.y + dy * panSpeed));
  }

  _bindEvents() {
    const dom = this.renderer.domElement;

    // Toque: um dedo gira, DOIS dedos fazem pinça (zoom) e arrasto (pan), como nos apps de mapa.
    // Antes só havia 1 ponteiro e `wheel`: no celular não existia zoom e o 2º dedo fazia a câmera pular.
    const toques = new Map(); // pointerId -> {x, y}
    let gesto = null;         // {dist, cx, cy} do par de dedos ativo
    let multitoque = false;   // houve 2 dedos nesta interação: o toque final não vale como clique

    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { dom.setPointerCapture(e.pointerId); } catch { /* alvo já removido */ }
        if (toques.size >= 2) {
          multitoque = true;
          this.camState.isDragging = false;
          const [a, b] = [...toques.values()];
          gesto = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
          return;
        }
        multitoque = false;
      }
      this.camState.isDragging = true;
      this.camState.isPanning = (e.button === 2 || e.shiftKey);
      this.camState.lastX = e.clientX;
      this.camState.lastY = e.clientY;
      this.pointerDownPos.set(e.clientX, e.clientY);
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && toques.has(e.pointerId)) {
        toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (toques.size >= 2 && gesto) {
          const [a, b] = [...toques.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          const goal = this.camState.goalSpherical;
          goal.radius = Math.max(4, Math.min(260, goal.radius * (gesto.dist / dist)));
          this._panCamera(cx - gesto.cx, cy - gesto.cy);
          gesto.dist = dist; gesto.cx = cx; gesto.cy = cy;
          return;
        }
      }
      if (this.camState.isDragging) {
        const dx = e.clientX - this.camState.lastX;
        const dy = e.clientY - this.camState.lastY;
        this.camState.lastX = e.clientX;
        this.camState.lastY = e.clientY;

        if (this.camState.isPanning) {
          const panSpeed = this.camState.spherical.radius * 0.0012;
          const right = new THREE.Vector3();
          const up = new THREE.Vector3(0, 1, 0);
          this.camera.getWorldDirection(right);
          right.cross(up).normalize();
          this.camState.goalTarget.addScaledVector(right, -dx * panSpeed);
          this.camState.goalTarget.y = Math.max(1, Math.min(45, this.camState.goalTarget.y + dy * panSpeed));
        } else {
          this.camState.goalSpherical.theta -= dx * 0.0065;
          this.camState.goalSpherical.phi = Math.max(
            0.025,
            Math.min(Math.PI * 0.56, this.camState.goalSpherical.phi - dy * 0.0055)
          );
        }
        return;
      }

      if (this.mode === 'unidades') {
        this._handleHoverRaycast(e);
      } else {
        this._handlePoolRippleRaycast(e, false);
      }
    });

    const soltar = (e, cancelado) => {
      if (e.pointerType === 'touch') {
        toques.delete(e.pointerId);
        if (toques.size < 2) gesto = null;
        if (toques.size === 1) {
          // sobrou um dedo: segue girando a partir da posição dele, sem pulo
          const [resto] = [...toques.values()];
          this.camState.isDragging = true;
          this.camState.isPanning = false;
          this.camState.lastX = resto.x;
          this.camState.lastY = resto.y;
          return;
        }
      }
      const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      this.camState.isDragging = false;
      const foiMultitoque = multitoque;
      if (toques.size === 0) multitoque = false;

      if (!cancelado && !foiMultitoque && moveDist < 5 && e.target === dom) {
        this._handleClickRaycast(e);
      }
    };
    window.addEventListener('pointerup', (e) => soltar(e, false));
    window.addEventListener('pointercancel', (e) => soltar(e, true));

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.09 : 0.91;
      this.camState.goalSpherical.radius = Math.max(
        4,
        Math.min(260, this.camState.goalSpherical.radius * factor)
      );
    }, { passive: false });

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // Leva em conta a coluna de controles no desktop e as folhas empilhadas no celular.
    // A mesma projeção deslocada atende WebGL, rótulos HTML e raycasting.
    const panels = ['desmonte-panel', 'availability-hud', 'planta-geral-sidebar', 'editorial-panel', 'apt-panel', 'bottom-pill-dock']
      .map(id => document.getElementById(id)).filter(Boolean);
    const frameViewport = () => {
      const viewport = this.container.getBoundingClientRect();
      const w = viewport.width, h = viewport.height;
      if (!w || !h) return;
      let left = 0, right = w, top = 0, bottom = h;
      for (const panel of panels) {
        const rect = panel.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (panel.id === 'bottom-pill-dock' || (rect.width > w * 0.6 && panel.id === 'apt-panel')) {
          bottom = Math.min(bottom, rect.top - viewport.top - 6);
        } else if (rect.width > w * 0.6) {
          top = Math.max(top, Math.min(h * 0.5, rect.bottom - viewport.top + 6));
        } else if (rect.left + rect.width / 2 > viewport.left + w / 2) {
          right = Math.min(right, rect.left - viewport.left - 8);
        } else {
          left = Math.max(left, rect.right - viewport.left + 8);
        }
      }
      this.camera.zoom = Math.max(0.18, Math.min((right - left) / (1.53 * h), (bottom - top) / h, 1));
      this.camera.setViewOffset(w, h, (w - left - right) / 2, (h - top - bottom) / 2, w, h);
      this.renderer.setSize(w, h);
    };
    const viewportObserver = new ResizeObserver(frameViewport);
    [this.container, ...panels].forEach(element => viewportObserver.observe(element));
    frameViewport();
  }

  _updatePointerCoords(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Dispara ondulações interativas (WebGL Water Ripples) ao passar ou clicar sobre a Piscina Central
  _handlePoolRippleRaycast(e, forceDrop = false) {
    if (!this.poolWaterMesh || !this.waterUniforms) return false;
    const nowMs = performance.now();
    if (!forceDrop && nowMs - this._lastPoolRippleMs < 95) return false;

    this._updatePointerCoords(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.poolWaterMesh, false);
    if (hits.length > 0) {
      const localPt = hits[0].point.clone();
      if (this.poolWaterMesh.parent) {
        this.poolWaterMesh.parent.worldToLocal(localPt);
      } else {
        this.poolWaterMesh.worldToLocal(localPt);
      }
      if (this.waterUniforms.uDropCenter && this.waterUniforms.uDropTime && this.waterUniforms.uTime) {
        this.waterUniforms.uDropCenter.value.set(localPt.x, localPt.z);
        this.waterUniforms.uDropTime.value = this.waterUniforms.uTime.value;
      }
      this._lastPoolRippleMs = nowMs;
      return true;
    }
    return false;
  }

  _handleHoverRaycast(e) {
    this._updatePointerCoords(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.unitMeshes, false);

    if (this.hoveredUnitMesh) {
      const prevMesh = this.hoveredUnitMesh;
      this.hoveredUnitMesh = null;
      this._applyUnitMeshState(prevMesh);
    }

    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      this.hoveredUnitMesh = hitMesh;
      this._applyUnitMeshState(hitMesh);
      this._positionEdgeOutline(this._hoverUnitEdges, hitMesh);
      this.container.style.cursor = 'pointer';
      if (this.callbacks.onUnitHover) {
        this.callbacks.onUnitHover(hitMesh.userData.unit, e.clientX, e.clientY);
      }
    } else {
      if (this._hoverUnitEdges) this._hoverUnitEdges.visible = false;
      this.container.style.cursor = 'grab';
      if (this.callbacks.onUnitHover) {
        this.callbacks.onUnitHover(null, 0, 0);
      }
    }
  }

  _handleClickRaycast(e) {
    // Se clicou diretamente sobre a Piscina Central, dispara uma ondulação WebGL Water
    if (this._handlePoolRippleRaycast(e, true) && this.mode !== 'unidades') {
      return;
    }

    this._updatePointerCoords(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (this.mode === 'unidades') {
      const hits = this.raycaster.intersectObjects(this.unitMeshes, false);
      if (hits.length > 0) {
        const unit = hits[0].object.userData.unit;
        this.focusOnUnit(unit.id);
        if (this.callbacks.onUnitClick) {
          this.callbacks.onUnitClick(unit);
        }
      }
    } else if (this.mode === 'desmonte') {
      const slotMeshes = [];
      for (const [, t] of this.towerObjects) {
        if (!t.plan.visible) continue;
        for (const sl of t.plan.userData.slots || []) if (sl.mesh.visible) slotMeshes.push(sl.mesh);
      }
      const aptHit = slotMeshes.length ? this.raycaster.intersectObjects(slotMeshes, false)[0] : null;
      if (aptHit && aptHit.object.userData.unit) {
        if (this.callbacks.onApartmentClick) this.callbacks.onApartmentClick(aptHit.object.userData.unit);
        return;
      }
      const hits = this.raycaster.intersectObjects(this.pickMeshes, false);
      if (hits.length > 0) {
        const towerId = hits[0].object.userData.towerId;
        const cfg = this.towerObjects.get(towerId).config;
        const floor = Math.max(1, Math.min(cfg.floors, Math.ceil((hits[0].point.y - BASE_Y) / FLOOR_H)));
        this.setFloorCut(towerId, floor, true);
        if (this.callbacks.onFloorSliceClick) {
          this.callbacks.onFloorSliceClick(towerId, floor);
        }
      }
    }
  }

  // Pausa o desenho enquanto o mapa real ou o Street View cobrem a tela inteira (poupa a GPU para eles)
  setPausado(pausado) {
    this.pausado = !!pausado;
    if (!pausado) { this._lastActivity = performance.now(); this._markShadowsDirty(); }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (this.pausado) return;

    // Parado há mais de 1,5 s: 30 fps bastam (a água continua animada) e poupa GPU/CPU
    const nowMs = performance.now();
    if (this.mode !== 'filme' && this.mode !== 'localizacao' && nowMs - this._lastActivity > 1500 && nowMs - this._lastRender < 30) return;
    const frameSeconds = Math.min((nowMs - this._lastRender) / 1000, 0.35);
    this._lastRender = nowMs;

    const elapsed = (nowMs - this._startTimeMs) * 0.001;

    if (this.skyUniforms && this.skyUniforms.uTime) {
      this.skyUniforms.uTime.value = elapsed;
    }
    if (this._routeArcUniforms && this._routeArcUniforms.uTime && this.mode === 'localizacao') {
      this._routeArcUniforms.uTime.value = elapsed;
    }

    // Atualiza em tempo real os uniforms do shader WebGL Water (ondas, refração e caustics subaquáticos)
    if (this.waterUniforms && this.waterUniforms.uTime) {
      this.waterUniforms.uTime.value = elapsed;
    } else if (this.poolWaterMesh && this.poolWaterMesh.material) {
      const poolMat = this.poolWaterMesh.material;
      if (poolMat.map) {
        poolMat.map.offset.x = Math.sin(elapsed * 0.45) * 0.015;
        poolMat.map.offset.y = (elapsed * 0.018) % 1.0;
      }
    }

    const damp = 1 - Math.exp(-5.4 * frameSeconds);
    const fovDelta = this.camState.goalFov - this.camera.fov;
    if (fovDelta !== 0) {
      this.camera.fov += Math.abs(fovDelta) < 0.02 ? fovDelta : fovDelta * damp;
      this.camera.updateProjectionMatrix();
    }
    this.camState.target.lerp(this.camState.goalTarget, damp);
    this.camState.spherical.radius += (this.camState.goalSpherical.radius - this.camState.spherical.radius) * damp;
    this.camState.spherical.phi += (this.camState.goalSpherical.phi - this.camState.spherical.phi) * damp;
    this.camState.spherical.theta += (this.camState.goalSpherical.theta - this.camState.spherical.theta) * damp;

    if (this.camState.autoRotate && !this.camState.isDragging) {
      this.camState.goalSpherical.theta += 0.048 * frameSeconds;
    }

    // movimento de câmera conta como atividade (voos automáticos, damping)
    const cs = this.camState;
    if (
      cs.target.distanceToSquared(cs.goalTarget) > 1e-4 ||
      Math.abs(cs.goalSpherical.radius - cs.spherical.radius) > 0.01 ||
      Math.abs(cs.goalSpherical.phi - cs.spherical.phi) > 1e-4 ||
      Math.abs(cs.goalSpherical.theta - cs.spherical.theta) > 1e-4
    ) {
      this._lastActivity = nowMs;
    }

    this._updateCuts();
    this._applyCameraTransform();
    if (this._shadowFrames > 0) {
      this.renderer.shadowMap.needsUpdate = true;
      this._shadowFrames--;
    }
    this.renderer.render(this.scene, this.camera);
    this._ajustarResolucao(nowMs, nowMs - this._lastActivity < 600);

    if (this.callbacks.onFrameUpdate) {
      this.callbacks.onFrameUpdate();
    }
  }
}
