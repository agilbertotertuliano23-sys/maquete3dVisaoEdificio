// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — CONSTRUTOR DA BASE, PORTARIA, CASAS E LAZER
// Versão Showcase Arquitetônico Fotorrealista (Padrão Navigo Web / Pranchas):
//  - Base da Maquete, Gramado Aveludado com micro-relevo de rugosidade,
//    Muros Perimetrais articulados com pilastras e pingadeira, Alamedas em
//    Pedra Portuguesa / Travertino com guias em Granito, Rua Frontal Asfaltada
//    com sinalização viária e Calçadas táteis
//  - ① Portaria Monumental: Marquise escultural em balanço com forro ripado 3D,
//    pórtico em pedra natural e ripado, totem arquitetônico, pavimento
//    intertravado, cancelas motorizadas, gradil fino e guarita envidraçada
//    com MeshPhysicalMaterial e mobiliário interno detalhado
//  - ② Piscina Central (WebGL Water preservado): Prainha submersa (wet-deck)
//    com caustics analíticos e espreguiçadeiras na água, borda em travertino,
//    escadas e corrimão em aço inox, espreguiçadeiras multi-partes, ombrelones
//    com varas estruturais e vent-cap, ducha externa e floreiras
//  - ③ Quadra Poliesportiva: Alambrado em tela losangular metálica de alta
//    definição (padrão frame_023) com tubos de aço, tabelas em vidro temperado
//    físico com aro retrátil e rede, bancos de reserva e refletores LED
//  - ④ Academia ao Ar Livre & Pergolado: 6 estações fitness distintas multi-partes
//    em piso EPDM + pergolado de madeira com caibros arqueados e trepadeiras,
//    sofá em L com almofadas decorativas e iluminação quente sutil
//  - ⑤ Salão de Festas / Espaço Gourmet: Pavilhão em cortina de vidro física
//    com montantes anodizados, lustres pendentes internos visíveis pelo vidro,
//    paredes em pedra natural, bar gourmet com prateleira retroiluminada,
//    mesas de banquete/jantar, terraço em travertino e floreiras (salaoRoofGroups)
//  - ⑥ 6 Casas Térreas (CASAS_CONFIG): Fachada envidraçada em recuo real
//    (MeshPhysicalMaterial) olhando para o living 3D modelado, detalhes em
//    pedra e ripado 3D, marquise de entrada em balanço, degraus em travertino,
//    pilares de portão com arandelas arquitetônicas up/down (casaRoofGroups)
// ==========================================================================

import * as THREE from 'three';
import { CASAS_CONFIG, BASE_Y } from './data.js';
import { comodoUrl } from './plantas.js';

// --------------------------------------------------------------------------
// CENAS INTERNAS DOS CÔMODOS (visíveis no modo Planta Baixa com telhado aberto)
// --------------------------------------------------------------------------
const _sceneTexCache = new Map();

function addInteriorRoomPanel(parent, url, w, h, x, y, z, rotY = 0, frameMat) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04),
    frameMat
  );
  frame.position.z = -0.025;
  group.add(frame);

  const mat = new THREE.MeshStandardMaterial({ color: 0x3a404a, roughness: 0.72 });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  group.add(pic);
  parent.add(group);

  let entry = _sceneTexCache.get(url);
  if (!entry) {
    entry = { tex: null, waiting: [] };
    _sceneTexCache.set(url, entry);
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      entry.tex = t;
      entry.waiting.splice(0).forEach((fn) => fn(t));
    });
  }
  const apply = (base) => {
    const t = base.clone();
    const a = w / h;
    if (a >= 1) { t.repeat.set(1, 1 / a); t.offset.set(0, (1 - 1 / a) / 2); }
    else { t.repeat.set(a, 1); t.offset.set((1 - a) / 2, 0); }
    t.needsUpdate = true;
    mat.map = t;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
  };
  if (entry.tex) apply(entry.tex); else entry.waiting.push(apply);
  return group;
}

// --------------------------------------------------------------------------
// GERADORES DE TEXTURAS PROCEDURAIS PBR (DIFFUSE + ROUGHNESSMAP, SEM BUMP/AO)
// Regra mergeStatic.js: usar apenas `map` e `roughnessMap` em malhas estáticas.
// --------------------------------------------------------------------------

function createLawnTurfTextures() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 512;
  const rctx = rc.getContext('2d');

  // Ruído fino sobre um tom contínuo para que as emendas do gramado desapareçam na vista aérea.
  const lawn = ctx.createImageData(c.width, c.height);
  let seed = 731;
  for (let y = 0; y < c.height; y++) {
    const variationY = Math.cos(2 * Math.PI * y / c.height) * 1.1;
    for (let x = 0; x < c.width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = ((seed >>> 24) / 255 - 0.5) * 18 + variationY;
      const pixel = 4 * (y * c.width + x);
      lawn.data[pixel] = 78 + grain;
      lawn.data[pixel + 1] = 107 + grain;
      lawn.data[pixel + 2] = 51 + grain * 0.7;
      lawn.data[pixel + 3] = 255;
    }
  }
  ctx.putImageData(lawn, 0, 0);
  rctx.fillStyle = 'rgb(224,224,224)';
  rctx.fillRect(0, 0, 512, 512);

  // Tufos multi-escala determinísticos de folhas de grama
  for (let i = 0; i < 5500; i++) {
    const x = (i * 73 + (i % 13) * 19) % 512;
    const y = (i * 139 + (i % 17) * 23) % 512;
    const pick = i % 5;
    if (pick === 0) ctx.fillStyle = 'rgba(132, 196, 48, 0.10)';
    else if (pick === 1) ctx.fillStyle = 'rgba(22, 48, 12, 0.11)';
    else if (pick === 2) ctx.fillStyle = 'rgba(84, 148, 38, 0.08)';
    else ctx.fillStyle = 'rgba(42, 82, 24, 0.09)';
    ctx.fillRect(x, y, 2, 3);

    rctx.fillStyle = pick % 2 === 0 ? 'rgb(208,208,208)' : 'rgb(238,238,238)';
    rctx.fillRect(x, y, 2, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(18, 13);
  map.colorSpace = THREE.SRGBColorSpace;

  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(18, 13);

  return { map, rough };
}

function createTravertinePaverTextures(repeatX = 16, repeatY = 16) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 512;
  const rctx = rc.getContext('2d');

  // Rejunte mineral de pedra portuguesa / travertino
  ctx.fillStyle = '#8b8378';
  ctx.fillRect(0, 0, 512, 512);
  rctx.fillStyle = 'rgb(232,232,232)';
  rctx.fillRect(0, 0, 512, 512);

  const tones = [
    [221, 213, 199],
    [212, 203, 188],
    [228, 221, 208],
    [204, 195, 180],
    [217, 209, 194]
  ];
  const rows = 8;
  const cols = 4;
  const tileH = 512 / rows;
  const tileW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tileW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * tileW + offset;
      const y = r * tileH;
      const [cr, cg, cb] = tones[(r * 5 + col + 12) % tones.length];

      const grad = ctx.createLinearGradient(x, y, x + tileW, y + tileH);
      grad.addColorStop(0.0, `rgb(${cr + 5}, ${cg + 5}, ${cb + 4})`);
      grad.addColorStop(1.0, `rgb(${cr - 6}, ${cg - 6}, ${cb - 5})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);

      // Borda chanfrada iluminada
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 2, y + 2, tileW - 4, 2);
      ctx.fillRect(x + 2, y + 2, 2, tileH - 4);

      // Veios minerais sutis de travertino
      ctx.fillStyle = 'rgba(130, 118, 102, 0.10)';
      ctx.fillRect(x + 12, y + 18 + (r % 3) * 8, tileW * 0.55, 2);
      ctx.fillStyle = 'rgba(255, 250, 240, 0.14)';
      ctx.fillRect(x + 24, y + 36 - (col % 2) * 8, tileW * 0.42, 2);

      // Rugosidade honed do travertino (variando por placa)
      const rv = 128 + ((r * 7 + col * 11 + 20) % 34);
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
    }
  }

  for (let i = 0; i < 4200; i++) {
    const px = (i * 137) % 512;
    const py = (i * 263) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(60,50,40,0.04)';
    ctx.fillRect(px, py, 2, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.colorSpace = THREE.SRGBColorSpace;

  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(repeatX, repeatY);

  return { map, rough };
}

function createInterlockingPaverTextures() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 512;
  const rctx = rc.getContext('2d');

  ctx.fillStyle = '#363a42';
  ctx.fillRect(0, 0, 512, 512);
  rctx.fillStyle = 'rgb(236,236,236)';
  rctx.fillRect(0, 0, 512, 512);

  const tones = ['#4a505a', '#555b66', '#414650', '#5c626d', '#484e57'];
  const rows = 16;
  const cols = 8;
  const pw = 512 / cols;
  const ph = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const ox = (r % 2) * (pw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * pw + ox;
      const y = r * ph;
      ctx.fillStyle = tones[(r * 3 + col * 5 + 16) % tones.length];
      ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(x + 2, y + 2, pw - 4, 2);

      const rv = 152 + ((r * 13 + col * 7 + 30) % 36);
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
    }
  }

  for (let i = 0; i < 3600; i++) {
    const px = (i * 151) % 512;
    const py = (i * 227) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(px, py, 2, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 7);
  map.colorSpace = THREE.SRGBColorSpace;

  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(3, 7);

  return { map, rough };
}

function createGraniteCurbTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#d4d8de';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3200; i++) {
    const x = (i * 67) % 256;
    const y = (i * 131) % 256;
    const p = i % 4;
    ctx.fillStyle = p === 0
      ? 'rgba(30,36,44,0.16)'
      : (p === 1 ? 'rgba(255,255,255,0.22)' : 'rgba(110,118,128,0.15)');
    ctx.fillRect(x, y, 2, 2);
  }

  // Junta de dilatação sutil de meio-fio pré-moldado
  ctx.fillStyle = 'rgba(60,68,78,0.28)';
  ctx.fillRect(126, 0, 3, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createArchitecturalStoneTextures() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 512;
  const rctx = rc.getContext('2d');

  ctx.fillStyle = '#6f675b';
  ctx.fillRect(0, 0, 512, 512);
  rctx.fillStyle = 'rgb(225,225,225)';
  rctx.fillRect(0, 0, 512, 512);

  // Fiadas de pedra travertino / canjiquinha arquitetônica
  const tones = ['#bcae9b', '#c7baa8', '#a89a87', '#d1c5b3', '#9d8f7d'];
  const rowH = 32;
  for (let r = 0; r < 16; r++) {
    let x = -((r * 47) % 90);
    while (x < 512) {
      const w = 64 + ((r * 29 + Math.abs(x)) % 84);
      const y = r * rowH;
      const col = tones[(r * 3 + Math.abs(x)) % tones.length];
      ctx.fillStyle = col;
      ctx.fillRect(x + 2, y + 2, w - 3, rowH - 3);
      ctx.fillStyle = 'rgba(255,250,240,0.18)';
      ctx.fillRect(x + 2, y + 2, w - 3, 3);
      ctx.fillStyle = 'rgba(38,32,26,0.22)';
      ctx.fillRect(x + 2, y + rowH - 4, w - 3, 3);

      const rv = 165 + ((r * 17 + w) % 45);
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.fillRect(x + 2, y + 2, w - 3, rowH - 3);
      x += w;
    }
  }

  for (let i = 0; i < 3800; i++) {
    const px = (i * 113) % 512;
    const py = (i * 197) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(28,24,20,0.05)';
    ctx.fillRect(px, py, 2, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.colorSpace = THREE.SRGBColorSpace;

  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(2, 2);

  return { map, rough };
}

function createNobleTimberTextures() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 512;
  const rctx = rc.getContext('2d');

  ctx.fillStyle = '#92542b';
  ctx.fillRect(0, 0, 512, 512);
  rctx.fillStyle = 'rgb(122,122,122)';
  rctx.fillRect(0, 0, 512, 512);

  const woodTones = ['#8c4f27', '#9e5c31', '#7d4420', '#ab683b', '#874c25'];
  for (let i = 0; i < 32; i++) {
    const y = i * 16;
    ctx.fillStyle = woodTones[i % woodTones.length];
    ctx.fillRect(0, y, 512, 15);

    // Veios naturais da madeira Cumaru / Ipê
    ctx.fillStyle = 'rgba(255, 224, 189, 0.06)';
    ctx.fillRect((i * 83) % 340, y + 4, 170, 2);
    ctx.fillStyle = 'rgba(42, 20, 8, 0.14)';
    ctx.fillRect((i * 127) % 320, y + 9, 190, 2);
    ctx.fillStyle = 'rgba(32, 16, 6, 0.32)';
    ctx.fillRect(0, y + 15, 512, 1);

    const rv = 108 + (i % 5) * 10;
    rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rctx.fillRect(0, y, 512, 15);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.colorSpace = THREE.SRGBColorSpace;

  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(2, 2);

  return { map, rough };
}

function createAsphaltTextures() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const rc = document.createElement('canvas');
  rc.width = 512;
  rc.height = 512;
  const rctx = rc.getContext('2d');

  ctx.fillStyle = '#333840';
  ctx.fillRect(0, 0, 512, 512);
  rctx.fillStyle = 'rgb(218,218,218)';
  rctx.fillRect(0, 0, 512, 512);

  // Sutil desgaste de rodagem nas faixas de tráfego
  const wear = ctx.createLinearGradient(0, 0, 0, 512);
  wear.addColorStop(0.0, 'rgba(0,0,0,0.12)');
  wear.addColorStop(0.28, 'rgba(255,255,255,0.03)');
  wear.addColorStop(0.50, 'rgba(0,0,0,0.06)');
  wear.addColorStop(0.72, 'rgba(255,255,255,0.03)');
  wear.addColorStop(1.0, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = (i * 97 + (i % 11) * 17) % 512;
    const y = (i * 181 + (i % 13) * 23) % 512;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(12,14,18,0.07)';
    ctx.fillRect(x, y, 2, 2);
    rctx.fillStyle = i % 2 === 0 ? 'rgb(198,198,198)' : 'rgb(235,235,235)';
    rctx.fillRect(x, y, 2, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 3);
  map.colorSpace = THREE.SRGBColorSpace;

  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(14, 3);

  return { map, rough };
}

function createSportsCourtTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1536;
  const ctx = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  // Piso terracota com retângulo de duplas, corredores e caixas de saque.
  const left = w * 0.20;
  const top = h * 0.08;
  const width = w - 2 * left;
  const height = h - 2 * top;
  const alley = width / 8;
  const serviceY = h * 0.5 - height * (6.4 / 23.77);
  ctx.fillStyle = '#bb6c4d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ae5043';
  ctx.fillRect(left, top, width, height);

  let seed = 121;
  for (let i = 0; i < 16000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const gx = (seed >>> 16) % w;
    const gy = (seed & 65535) % h;
    ctx.fillStyle = i % 2 ? 'rgba(255,238,215,0.14)' : 'rgba(74,30,27,0.13)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Demarcação secundária sob as tabelas de basquete.
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d79672';
  for (const end of [1, -1]) {
    ctx.save();
    ctx.translate(w / 2, end === 1 ? top : h - top);
    ctx.scale(1, end);
    ctx.strokeRect(-width * 0.22, 0, width * 0.44, height * 0.15);
    ctx.beginPath();
    ctx.arc(0, height * 0.15, width * 0.12, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#f7efdd';
  ctx.strokeRect(left, top, width, height);
  ctx.strokeRect(left + alley, top, width - 2 * alley, height);
  ctx.beginPath();
  for (const y of [serviceY, h - serviceY]) {
    ctx.moveTo(left + alley, y);
    ctx.lineTo(w - left - alley, y);
  }
  ctx.moveTo(w * 0.5, serviceY);
  ctx.lineTo(w * 0.5, h - serviceY);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createTemperedBackboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 352;
  const ctx = c.getContext('2d');

  // Vidro temperado translúcido claro no centro
  ctx.fillStyle = 'rgba(218, 238, 255, 0.24)';
  ctx.fillRect(0, 0, 512, 352);

  // Reflexo diagonal sutil de vidro temperado
  const sheen = ctx.createLinearGradient(0, 0, 512, 352);
  sheen.addColorStop(0.0, 'rgba(255,255,255,0.28)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1.0, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 512, 352);

  // Borda branca oficial + quadrado vermelho do arremessador
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.94)';
  ctx.lineWidth = 18;
  ctx.strokeRect(10, 10, 492, 332);

  ctx.strokeStyle = 'rgba(220, 38, 38, 0.96)';
  ctx.lineWidth = 14;
  ctx.strokeRect(172, 148, 168, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDiamondFenceCanvas() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const step = 64; // 8x8 losangos por bloco -> fios bem definidos sem sumir em mipmaps
  ctx.lineCap = 'round';

  // Fio principal aço escuro anodizado + filete metálico de brilho (inspirado frame_023)
  for (const pass of [
    { stroke: 'rgba(18, 20, 26, 0.98)', width: 10 },
    { stroke: 'rgba(148, 163, 184, 0.40)', width: 3 }
  ]) {
    ctx.strokeStyle = pass.stroke;
    ctx.lineWidth = pass.width;
    for (let i = -512; i <= 1024; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i, 512);
      ctx.lineTo(i + 512, 0);
      ctx.stroke();
    }
  }
  return c;
}

function createSubtleGroundGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  g.addColorStop(0.0, 'rgba(255, 232, 175, 0.34)');
  g.addColorStop(0.45, 'rgba(251, 191, 36, 0.14)');
  g.addColorStop(1.0, 'rgba(251, 191, 36, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftWallWashTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 128, 6, 64, 128, 110);
  g.addColorStop(0.0, 'rgba(255, 240, 195, 0.36)');
  g.addColorStop(0.5, 'rgba(251, 191, 36, 0.12)');
  g.addColorStop(1.0, 'rgba(251, 191, 36, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --------------------------------------------------------------------------
// TEXTURA DE AZULEJOS CERÂMICOS (`tiles.jpg` DO MODELO WEBGL WATER)
// --------------------------------------------------------------------------

function createWebGLWaterTilesTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#6e7378';
  ctx.fillRect(0, 0, 1024, 1024);

  const grid = 14;
  const tileSize = 1024 / grid;
  const grout = 3;

  const baseTones = [
    [133, 199, 192],
    [120, 186, 180],
    [149, 205, 194],
    [131, 189, 183],
    [142, 201, 192],
    [153, 206, 199]
  ];

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x0 = gx * tileSize + grout * 0.5;
      const y0 = gy * tileSize + grout * 0.5;
      const w = tileSize - grout;
      const h = tileSize - grout;

      const idx = (gy * 7 + gx * 13 + (gx ^ gy) * 3) % baseTones.length;
      const [r, g, b] = baseTones[idx];

      const tGrad = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
      tGrad.addColorStop(0.0, `rgb(${r + 8}, ${g + 8}, ${b + 7})`);
      tGrad.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
      tGrad.addColorStop(1.0, `rgb(${r - 10}, ${g - 9}, ${b - 8})`);
      ctx.fillStyle = tGrad;
      ctx.fillRect(x0, y0, w, h);

      const cGlow = ctx.createRadialGradient(
        x0 + w * 0.42,
        y0 + h * 0.42,
        4,
        x0 + w * 0.5,
        y0 + h * 0.5,
        w * 0.65
      );
      cGlow.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      cGlow.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
      ctx.fillStyle = cGlow;
      ctx.fillRect(x0, y0, w, h);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fillRect(x0, y0, w, 3);
      ctx.fillRect(x0, y0, 3, h);

      ctx.fillStyle = 'rgba(55, 60, 66, 0.36)';
      ctx.fillRect(x0, y0 + h - 3, w, 3);
      ctx.fillRect(x0 + w - 3, y0, 3, h);
    }
  }

  for (let i = 0; i < 16000; i++) {
    const px = (i * 173 + (i % 7) * 29) % 1024;
    const py = (i * 311 + (i % 11) * 43) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.045)' : 'rgba(30, 35, 42, 0.055)';
    ctx.fillRect(px, py, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// --------------------------------------------------------------------------
// SHADERS GLSL DO MODELO WEBGL WATER (PRESERVADO + PRAINHA WET-DECK ANALÍTICA)
// --------------------------------------------------------------------------

const WEBGL_WATER_COMMON_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec2 uDropCenter;
  uniform float uDropTime;
  uniform vec3 uLightDir;
  uniform sampler2D uTileTex;

  const float IOR_AIR = 1.0;
  const float IOR_WATER = 1.333;
  const vec3 aboveWaterColor = vec3(0.65, 0.96, 1.0);
  const vec3 underwaterColor = vec3(0.78, 1.05, 0.93);

  // Dimensões exatas da bacia da Piscina Central em coordenadas locais do poolGroup
  const vec3 POOL_MIN = vec3(-4.12, -1.42, -9.42);
  const vec3 POOL_MAX = vec3( 4.12,  0.24,  9.42);
  const float WATER_Y = 0.08;

  vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {
    vec3 tMin = (cubeMin - origin) / ray;
    vec3 tMax = (cubeMax - origin) / ray;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    return vec2(tNear, tFar);
  }

  float evalWaterHeight(vec2 xz, float t) {
    float h = 0.0;
    h += sin(xz.x * 1.85 + xz.y * 1.15 + t * 2.15) * 0.013;
    h += sin(xz.x * 2.95 - xz.y * 2.25 + t * 2.65) * 0.009;
    h += cos(xz.x * 1.35 - xz.y * 3.10 - t * 1.85) * 0.008;
    h += sin(xz.x * 4.40 + xz.y * 3.70 + t * 3.40) * 0.0045;
    h += cos(xz.x * 3.60 - xz.y * 4.80 + t * 2.95) * 0.0035;

    float dropAge = t - uDropTime;
    if (uDropTime > 0.0 && dropAge >= 0.0 && dropAge < 6.0) {
      float d = length(xz - uDropCenter);
      float front = dropAge * 3.0;
      float env = exp(-pow(d - front, 2.0) * 2.0) * exp(-dropAge * 0.45);
      h += sin((d - front) * 16.0) * env * 0.038;
    }

    return h;
  }

  vec3 evalWaterNormal(vec2 xz, float t) {
    float eps = 0.045;
    float hc = evalWaterHeight(xz, t);
    float hx = evalWaterHeight(xz + vec2(eps, 0.0), t);
    float hz = evalWaterHeight(xz + vec2(0.0, eps), t);
    return normalize(vec3(hc - hx, eps, hc - hz));
  }

  float evalWebGLWaterCaustics(vec3 point, vec3 lightDir, float t) {
    float waterDepth = max(0.12, WATER_Y - point.y);
    vec2 surfXZ = point.xz + lightDir.xz * (waterDepth / max(0.25, lightDir.y));

    float eps = 0.065;
    vec3 n0 = evalWaterNormal(surfXZ, t);
    vec3 nx = evalWaterNormal(surfXZ + vec2(eps, 0.0), t);
    vec3 nz = evalWaterNormal(surfXZ + vec2(0.0, eps), t);

    vec3 r0 = refract(-lightDir, n0, IOR_AIR / IOR_WATER);
    vec3 rx = refract(-lightDir, nx, IOR_AIR / IOR_WATER);
    vec3 rz = refract(-lightDir, nz, IOR_AIR / IOR_WATER);

    float projDist = waterDepth * 1.35;
    vec2 p0 = surfXZ + r0.xz * projDist;
    vec2 px = (surfXZ + vec2(eps, 0.0)) + rx.xz * projDist;
    vec2 pz = (surfXZ + vec2(0.0, eps)) + rz.xz * projDist;

    float oldArea = eps * eps;
    float newArea = length(px - p0) * length(pz - p0);
    float ratio = oldArea / max(newArea, oldArea * 0.18);

    float caustic = pow(clamp(ratio, 0.30, 2.7), 1.18) * 0.49;
    return caustic;
  }

  vec3 getPoolWallColor(vec3 point, vec3 lightDir, float t) {
    vec3 p = point;
    vec2 tileUV;
    if (abs(p.x) > POOL_MAX.x - 0.03) {
      tileUV = vec2(p.z, p.y) * 0.36;
    } else if (
      abs(p.z) > POOL_MAX.z - 0.03 ||
      abs(p.z + 6.85) < 0.025 ||
      abs(p.z + 6.20) < 0.025 ||
      abs(p.z + 5.55) < 0.025
    ) {
      tileUV = vec2(p.x, p.y) * 0.36;
    } else {
      tileUV = p.xz * 0.36;
    }

    vec3 wallColor = texture2D(uTileTex, tileUV).rgb;

    vec3 normP = vec3(
      p.x / POOL_MAX.x,
      (p.y - (-0.59)) / 0.83,
      p.z / POOL_MAX.z
    );

    float scale = 0.68;
    float cx = clamp(normP.x * normP.x, 0.0, 1.0);
    float cy = clamp(normP.y * normP.y, 0.0, 1.0);
    float cz = clamp(normP.z * normP.z, 0.0, 1.0);
    float ao = 1.0 - 0.30 * (cx * cy + cy * cz + cx * cz);
    scale *= clamp(ao, 0.55, 1.0);

    vec3 refractedLight = -refract(-lightDir, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);
    vec2 entryXZ = p.xz + refractedLight.xz * (max(0.0, WATER_Y - p.y) / max(0.2, refractedLight.y));
    vec2 rimDist = abs(entryXZ) - vec2(POOL_MAX.x - 0.08, POOL_MAX.z - 0.08);
    float rimShadow = 1.0 - smoothstep(-0.35, 0.25, max(rimDist.x, rimDist.y));

    if (p.y < WATER_Y) {
      float caustic = evalWebGLWaterCaustics(p, lightDir, t);
      scale += caustic * rimShadow * 1.05;
      scale += 0.18 * rimShadow;

      float ledGlow = 0.0;
      for (int i = 0; i < 4; i++) {
        float lz = -6.8 + float(i) * 4.533;
        float dW = length(p - vec3(POOL_MIN.x, -0.35, lz));
        float dE = length(p - vec3(POOL_MAX.x, -0.35, lz));
        ledGlow += 0.12 / (1.0 + dW * dW * 0.65);
        ledGlow += 0.12 / (1.0 + dE * dE * 0.65);
      }
      scale += ledGlow;

      float depth = WATER_Y - p.y;
      vec3 transmission = exp(-depth * vec3(0.51, 0.12, 0.09));
      return wallColor * underwaterColor * transmission * scale + (1.0 - transmission) * vec3(0.03, 0.32, 0.34);
    } else {
      scale += 0.48 * rimShadow;
      return wallColor * scale;
    }
  }
`;

const POOL_BASIN_VERTEX_SHADER = /* glsl */ `
  varying vec3 vLocalPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vLocalPos = worldPos.xyz - vec3(0.0, ${BASE_Y.toFixed(2)}, 4.2);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const POOL_BASIN_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vLocalPos;
  ${WEBGL_WATER_COMMON_GLSL}

  void main() {
    vec3 lightDir = normalize(uLightDir);
    vec3 color = getPoolWallColor(vLocalPos, lightDir, uTime);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const WATER_SURFACE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uDropCenter;
  uniform float uDropTime;

  varying vec3 vLocalPos;

  float evalVertexWave(vec2 xz, float t) {
    float h = 0.0;
    h += sin(xz.x * 1.85 + xz.y * 1.15 + t * 2.15) * 0.013;
    h += sin(xz.x * 2.95 - xz.y * 2.25 + t * 2.65) * 0.009;
    h += cos(xz.x * 1.35 - xz.y * 3.10 - t * 1.85) * 0.008;
    float dropAge = t - uDropTime;
    if (uDropTime > 0.0 && dropAge >= 0.0 && dropAge < 6.0) {
      float d = length(xz - uDropCenter);
      float front = dropAge * 3.0;
      float env = exp(-pow(d - front, 2.0) * 2.0) * exp(-dropAge * 0.45);
      h += sin((d - front) * 16.0) * env * 0.038;
    }
    return h;
  }

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 localPos = worldPos.xyz - vec3(0.0, ${BASE_Y.toFixed(2)}, 4.2);
    float waveH = evalVertexWave(localPos.xz, uTime);
    localPos.y += waveH;
    worldPos.y += waveH;
    vLocalPos = localPos;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_SURFACE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uLocalCameraPos;
  varying vec3 vLocalPos;

  ${WEBGL_WATER_COMMON_GLSL}

  vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor, vec3 lightDir, float t) {
    vec3 color;
    if (ray.y < 0.0) {
      vec2 tHit = intersectCube(origin, ray, POOL_MIN, POOL_MAX);
      float bestT = tHit.y;
      vec3 hit = origin + ray * bestT;

      // Prainha submersa (wet-deck raso ao Norte: z in [-9.42, -6.85], y = -0.14)
      float tPrainha = (-0.14 - origin.y) / ray.y;
      if (tPrainha > 0.0 && tPrainha < bestT) {
        vec3 hp = origin + ray * tPrainha;
        if (hp.z >= POOL_MIN.z && hp.z <= -6.85 && abs(hp.x) <= POOL_MAX.x) {
          bestT = tPrainha;
          hit = hp;
        }
      }

      // Degrau 1 (z in [-6.85, -6.20], y = -0.48)
      float tStep1 = (-0.48 - origin.y) / ray.y;
      if (tStep1 > 0.0 && tStep1 < bestT) {
        vec3 hs1 = origin + ray * tStep1;
        if (hs1.z > -6.85 && hs1.z <= -6.20 && abs(hs1.x) <= POOL_MAX.x) {
          bestT = tStep1;
          hit = hs1;
        }
      }

      // Degrau 2 (z in [-6.20, -5.55], y = -0.82)
      float tStep2 = (-0.82 - origin.y) / ray.y;
      if (tStep2 > 0.0 && tStep2 < bestT) {
        vec3 hs2 = origin + ray * tStep2;
        if (hs2.z > -6.20 && hs2.z <= -5.55 && abs(hs2.x) <= POOL_MAX.x) {
          bestT = tStep2;
          hit = hs2;
        }
      }

      // Espelhos verticais da Prainha e degraus
      if (abs(ray.z) > 0.0001) {
        float tz0 = (-6.85 - origin.z) / ray.z;
        if (tz0 > 0.0 && tz0 < bestT) {
          vec3 hr0 = origin + ray * tz0;
          if (hr0.y <= -0.14 && hr0.y >= -0.48 && abs(hr0.x) <= POOL_MAX.x) {
            bestT = tz0;
            hit = hr0;
          }
        }
        float tz1 = (-6.20 - origin.z) / ray.z;
        if (tz1 > 0.0 && tz1 < bestT) {
          vec3 hr1 = origin + ray * tz1;
          if (hr1.y <= -0.48 && hr1.y >= -0.82 && abs(hr1.x) <= POOL_MAX.x) {
            bestT = tz1;
            hit = hr1;
          }
        }
        float tz2 = (-5.55 - origin.z) / ray.z;
        if (tz2 > 0.0 && tz2 < bestT) {
          vec3 hr2 = origin + ray * tz2;
          if (hr2.y <= -0.82 && hr2.y >= POOL_MIN.y && abs(hr2.x) <= POOL_MAX.x) {
            bestT = tz2;
            hit = hr2;
          }
        }
      }

      color = getPoolWallColor(hit, lightDir, t);
    } else {
      vec2 tHit = intersectCube(origin, ray, POOL_MIN, POOL_MAX);
      vec3 hit = origin + ray * tHit.y;
      if (hit.y < POOL_MAX.y - 0.01) {
        color = getPoolWallColor(hit, lightDir, t);
      } else {
        float skyGrad = clamp(ray.y, 0.0, 1.0);
        vec3 horizon = vec3(0.77, 0.86, 0.92);
        vec3 skyAzure = vec3(0.24, 0.48, 0.78);
        vec3 skyZenith = vec3(0.14, 0.28, 0.56);
        vec3 skyCol = mix(horizon, skyAzure, smoothstep(0.0, 0.35, skyGrad));
        skyCol = mix(skyCol, skyZenith, smoothstep(0.35, 1.0, skyGrad));
        color = skyCol;
        color += vec3(pow(clamp(dot(lightDir, ray), 0.0, 0.999), 220.0)) * vec3(5.0, 4.2, 3.2);
      }
    }
    if (ray.y < 0.0) {
      color *= waterColor;
    }
    return color;
  }

  void main() {
    vec3 lightDir = normalize(uLightDir);
    vec3 normal = evalWaterNormal(vLocalPos.xz, uTime);
    vec3 incomingRay = normalize(vLocalPos - uLocalCameraPos);

    vec3 reflectedRay = reflect(incomingRay, normal);
    vec3 refractedRay = refract(incomingRay, normal, IOR_AIR / IOR_WATER);
    if (length(refractedRay) < 0.001) {
      refractedRay = vec3(incomingRay.x, -abs(incomingRay.y) - 0.2, incomingRay.z);
      refractedRay = normalize(refractedRay);
    }

    float fresnel = mix(0.18, 0.88, pow(clamp(1.0 - dot(normal, -incomingRay), 0.0, 1.0), 3.0));

    vec3 reflectedColor = getSurfaceRayColor(vLocalPos, reflectedRay, aboveWaterColor, lightDir, uTime);
    vec3 refractedColor = getSurfaceRayColor(vLocalPos, refractedRay, aboveWaterColor, lightDir, uTime);

    vec3 finalColor = mix(refractedColor, reflectedColor, fresnel);
    gl_FragColor = vec4(finalColor, 0.96);
  }
`;

// --------------------------------------------------------------------------
// CONSTRUTOR PRINCIPAL: BASE, PORTARIA, 6 CASAS E ÁREAS DE LAZER (1 A 6)
// --------------------------------------------------------------------------

export function buildBaseAndAmenities3D(root, renderer, mats, nightLightObjects) {
  const casaRoofGroups = [];
  const salaoRoofGroups = [];

  // Texturas PBR compartilhadas
  const turfTex = createLawnTurfTextures();
  const travertineTex = createTravertinePaverTextures(16, 16);
  const travertineCopingTex = createTravertinePaverTextures(4, 1);
  const interlockingTex = createInterlockingPaverTextures();
  const graniteCurbTex = createGraniteCurbTexture();
  const stoneCladTex = createArchitecturalStoneTextures();
  const timberTex = createNobleTimberTextures();
  const asphaltTex = createAsphaltTextures();
  const courtTex = createSportsCourtTexture();
  const backboardGlassTex = createTemperedBackboardTexture();
  const fenceCanvas = createDiamondFenceCanvas();
  const subtleGroundGlowTex = createSubtleGroundGlowTexture();
  const softWallWashTex = createSoftWallWashTexture();
  const webglWaterTilesTex = createWebGLWaterTilesTexture();

  const fenceTexLong = new THREE.CanvasTexture(fenceCanvas);
  fenceTexLong.wrapS = fenceTexLong.wrapT = THREE.RepeatWrapping;
  fenceTexLong.repeat.set(16, 2.5);
  fenceTexLong.colorSpace = THREE.SRGBColorSpace;

  const fenceTexShort = new THREE.CanvasTexture(fenceCanvas);
  fenceTexShort.wrapS = fenceTexShort.wrapT = THREE.RepeatWrapping;
  fenceTexShort.repeat.set(10.5, 2.5);
  fenceTexShort.colorSpace = THREE.SRGBColorSpace;

  if (renderer && renderer.capabilities) {
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    turfTex.map.anisotropy = maxAniso;
    travertineTex.map.anisotropy = maxAniso;
    travertineCopingTex.map.anisotropy = maxAniso;
    interlockingTex.map.anisotropy = maxAniso;
    graniteCurbTex.anisotropy = maxAniso;
    stoneCladTex.map.anisotropy = maxAniso;
    timberTex.map.anisotropy = maxAniso;
    asphaltTex.map.anisotropy = maxAniso;
    courtTex.anisotropy = maxAniso;
    backboardGlassTex.anisotropy = maxAniso;
    fenceTexLong.anisotropy = maxAniso;
    fenceTexShort.anisotropy = maxAniso;
    webglWaterTilesTex.anisotropy = maxAniso;
  }

  // Materiais PBR arquitetônicos compartilhados (todos criados uma vez para mergeStatic máximo)
  const lawnVelvetMat = new THREE.MeshStandardMaterial({
    map: turfTex.map,
    roughnessMap: turfTex.rough,
    color: 0xf0fae0,
    roughness: 1.0
  });
  const travertinePaverMat = new THREE.MeshStandardMaterial({
    map: travertineTex.map,
    roughnessMap: travertineTex.rough,
    roughness: 1.0,
    metalness: 0.02
  });
  const travertineCopingMat = new THREE.MeshStandardMaterial({
    map: travertineCopingTex.map,
    roughnessMap: travertineCopingTex.rough,
    color: 0xf4efe6,
    roughness: 1.0,
    metalness: 0.02
  });
  const interlockingPaverMat = new THREE.MeshStandardMaterial({
    map: interlockingTex.map,
    roughnessMap: interlockingTex.rough,
    roughness: 1.0,
    metalness: 0.04
  });
  const graniteCurbMat = new THREE.MeshStandardMaterial({
    map: graniteCurbTex,
    roughness: 0.62,
    metalness: 0.03
  });
  const stoneCladMat = new THREE.MeshStandardMaterial({
    map: stoneCladTex.map,
    roughnessMap: stoneCladTex.rough,
    roughness: 1.0,
    metalness: 0.02
  });
  const woodTimberMat = new THREE.MeshStandardMaterial({
    map: timberTex.map,
    roughnessMap: timberTex.rough,
    roughness: 1.0,
    metalness: 0.03
  });
  const asphaltTexturedMat = new THREE.MeshStandardMaterial({
    map: asphaltTex.map,
    roughnessMap: asphaltTex.rough,
    roughness: 1.0,
    metalness: 0.04
  });
  const anodizedBronzeDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f26,
    roughness: 0.28,
    metalness: 0.78,
    envMapIntensity: 1.35
  });
  const brushedStainlessMat = new THREE.MeshStandardMaterial({
    color: 0xdce3ec,
    roughness: 0.20,
    metalness: 0.90,
    envMapIntensity: 1.45
  });
  const darkBasaltTrimMat = new THREE.MeshStandardMaterial({
    color: 0x262c35,
    roughness: 0.62,
    metalness: 0.08
  });
  const roofDeckLightMat = new THREE.MeshStandardMaterial({
    color: 0xd5dae0,
    roughness: 0.64,
    metalness: 0.04
  });
  const warmGlowSoftMat = new THREE.MeshBasicMaterial({ color: 0xffefc8 });
  const screenCyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const barrierRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36 });
  const barrierWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 });
  const soilMulchMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 0.94 });
  const planterFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5e24, roughness: 0.80 });
  const planterGrassMat = new THREE.MeshStandardMaterial({ color: 0x4b7d2c, roughness: 0.78 });

  // Vidros físicos refletivos (MeshPhysicalMaterial)
  const archGlassReflectiveMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.42,
    roughness: 0.05,
    metalness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.98,
    envMapIntensity: 1.85,
    ior: 1.52,
    side: THREE.DoubleSide
  });
  const pavilionGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    emissive: 0x2c2214,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.40,
    roughness: 0.05,
    metalness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.98,
    envMapIntensity: 1.9,
    ior: 1.52,
    side: THREE.DoubleSide
  });
  const backboardGlassMat = new THREE.MeshPhysicalMaterial({
    map: backboardGlassTex,
    transparent: true,
    opacity: 0.56,
    roughness: 0.04,
    metalness: 0.08,
    clearcoat: 1.0,
    reflectivity: 0.98,
    envMapIntensity: 1.75,
    side: THREE.DoubleSide
  });

  // Tela losangular metálica da quadra (opacity < 0.75 evita sombra sólida retangular em model.js)
  const fenceWireLongMat = new THREE.MeshStandardMaterial({
    map: fenceTexLong,
    transparent: true,
    alphaTest: 0.14,
    opacity: 0.74,
    depthWrite: true,
    side: THREE.DoubleSide,
    roughness: 0.36,
    metalness: 0.68
  });
  const fenceWireShortMat = new THREE.MeshStandardMaterial({
    map: fenceTexShort,
    transparent: true,
    alphaTest: 0.14,
    opacity: 0.74,
    depthWrite: true,
    side: THREE.DoubleSide,
    roughness: 0.36,
    metalness: 0.68
  });

  // Materiais de mobiliário, estofados e academia
  const creamCushionMat = new THREE.MeshStandardMaterial({ color: 0xf7f1e3, roughness: 0.72 });
  const terracottaPillowMat = new THREE.MeshStandardMaterial({ color: 0xc26142, roughness: 0.76 });
  const sagePillowMat = new THREE.MeshStandardMaterial({ color: 0x6b876a, roughness: 0.76 });
  const charcoalUpholsteryMat = new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.64 });
  const warmLinenMat = new THREE.MeshStandardMaterial({ color: 0xede6d8, roughness: 0.74 });
  const epdmPadMat = new THREE.MeshStandardMaterial({ color: 0x272b33, roughness: 0.88 });
  const fitnessAccentMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.38, metalness: 0.12 });
  const umbrellaLinenMat = new THREE.MeshStandardMaterial({
    color: 0xfaf5eb,
    roughness: 0.68,
    side: THREE.DoubleSide
  });
  const floorLightSubtleMat = new THREE.MeshBasicMaterial({
    map: subtleGroundGlowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const wallWashSubtleMat = new THREE.MeshBasicMaterial({
    map: softWallWashTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const subtleHaloGeo = new THREE.PlaneGeometry(1.4, 1.4);
  subtleHaloGeo.rotateX(-Math.PI / 2);

  // ========================================================================
  // 1. BASE DA MAQUETE, GRAMADO AVELUDADO (VÃO DA PISCINA PRESERVADO),
  //    MUROS ARTICULADOS, RUA FRONTAL E CALÇADAS
  // ========================================================================
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(103.2, 1.8, 86.2), mats.plinthDark);
  plinth.position.set(0, -0.45, 4.0);
  plinth.receiveShadow = true;
  root.add(plinth);

  const plinthTrim = new THREE.Mesh(new THREE.BoxGeometry(103.6, 0.14, 86.6), darkBasaltTrimMat);
  plinthTrim.position.set(0, 0.38, 4.0);
  root.add(plinthTrim);

  // Gramado principal construído em 4 setores ao redor do vão da Piscina Central
  // (x ∈ [-4.12, 4.12], z ∈ [-5.22, 13.62]) para manter a bacia 3D rebaixada intacta!
  const lawnSections = [
    { x: -26.86, z: -0.2, w: 45.48, d: 69.2 },
    { x:  26.86, z: -0.2, w: 45.48, d: 69.2 },
    { x:   0.0,  z: -20.01, w: 8.24, d: 29.58 },
    { x:   0.0,  z:  24.01, w: 8.24, d: 20.78 }
  ];
  for (const sec of lawnSections) {
    const lm = new THREE.Mesh(new THREE.BoxGeometry(sec.w, 0.6, sec.d), lawnVelvetMat);
    lm.position.set(sec.x, BASE_Y - 0.3, sec.z);
    lm.receiveShadow = true;
    root.add(lm);
  }

  // Muros perimetrais articulados (Oeste, Norte e Leste) com embasamento escuro, pilastras e pingadeira
  const wallH = 2.65;
  const addPerimeterWallSegment = (x, z, w, d, alongZ) => {
    const wg = new THREE.Group();
    wg.position.set(x, BASE_Y, z);

    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), mats.wallWhite);
    wallMesh.position.y = wallH * 0.5;
    wg.add(wallMesh);

    const baseSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(w + (alongZ ? 0.08 : 0), 0.28, d + (alongZ ? 0 : 0.08)),
      darkBasaltTrimMat
    );
    baseSkirt.position.y = 0.14;
    wg.add(baseSkirt);

    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(w + (alongZ ? 0.16 : 0.1), 0.14, d + (alongZ ? 0.1 : 0.16)),
      travertineCopingMat
    );
    coping.position.y = wallH + 0.07;
    wg.add(coping);

    const span = alongZ ? d : w;
    const step = 9.8;
    const count = Math.floor(span / step);
    for (let i = 0; i <= count; i++) {
      const offset = -span * 0.5 + (i / count) * span;
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(alongZ ? 0.62 : 0.36, wallH + 0.06, alongZ ? 0.36 : 0.62),
        mats.wallPureWhite
      );
      pilaster.position.set(alongZ ? 0 : offset, wallH * 0.5, alongZ ? offset : 0);
      wg.add(pilaster);
    }

    root.add(wg);
  };

  addPerimeterWallSegment(-49.4, -0.2, 0.45, 69.4, true);
  addPerimeterWallSegment(49.4, -0.2, 0.45, 69.4, true);
  addPerimeterWallSegment(0, -34.7, 99.2, 0.45, false);

  // Rua frontal asfaltada (Sul: z = 34.5 a 45.8) com guias, eixo central e setas
  const streetAsphalt = new THREE.Mesh(new THREE.BoxGeometry(102.6, 0.55, 11.4), asphaltTexturedMat);
  streetAsphalt.position.set(0, BASE_Y - 0.32, 40.2);
  streetAsphalt.receiveShadow = true;
  root.add(streetAsphalt);

  const outerStreetCurb = new THREE.Mesh(new THREE.BoxGeometry(102.6, 0.18, 0.36), graniteCurbMat);
  outerStreetCurb.position.set(0, BASE_Y - 0.02, 45.8);
  root.add(outerStreetCurb);

  // Faixas tracejadas centrais da via + linhas de bordo contínuas sutis
  for (let rx = -44; rx <= 44; rx += 11) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.04, 0.24), mats.roadLine);
    dash.position.set(rx, BASE_Y - 0.025, 41.2);
    root.add(dash);
  }
  for (const edgeZ of [37.05, 45.35]) {
    const edgeLine = new THREE.Mesh(new THREE.BoxGeometry(99.5, 0.03, 0.12), mats.roadLine);
    edgeLine.position.set(0, BASE_Y - 0.03, edgeZ);
    root.add(edgeLine);
  }

  // Calçadas frontais em travertino, faixa de grama aveludada e meio-fio de granito curvo na Portaria
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(38.5, 0.14, 3.2), travertinePaverMat);
    sw.position.set(side * 30.2, BASE_Y + 0.02, 34.4);
    sw.receiveShadow = true;
    root.add(sw);

    const verge = new THREE.Mesh(new THREE.BoxGeometry(37.5, 0.16, 1.12), lawnVelvetMat);
    verge.position.set(side * 30.4, BASE_Y + 0.03, 36.2);
    verge.receiveShadow = true;
    root.add(verge);

    const curb = new THREE.Mesh(new THREE.BoxGeometry(38.5, 0.18, 0.28), graniteCurbMat);
    curb.position.set(side * 30.2, BASE_Y + 0.04, 36.8);
    root.add(curb);

    const throatCurb = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.16, 20),
      travertinePaverMat
    );
    throatCurb.position.set(side * 10.95, BASE_Y + 0.01, 35.4);
    root.add(throatCurb);

    const throatRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.12, 8, 20, Math.PI * 0.5),
      graniteCurbMat
    );
    throatRing.rotation.x = Math.PI / 2;
    throatRing.rotation.z = side === -1 ? 0 : Math.PI * 0.5;
    throatRing.position.set(side * 10.95, BASE_Y + 0.06, 35.4);
    root.add(throatRing);
  }

  // ========================================================================
  // 2. SISTEMA DE ALAMEDAS E CAMINHOS EM PEDRA PORTUGUESA / TRAVERTINO
  // ========================================================================
  function addPavedPath(x, z, w, d, rotY = 0, withCurb = true) {
    const g = new THREE.Group();
    g.position.set(x, BASE_Y + 0.02, z);
    g.rotation.y = rotY;

    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), travertinePaverMat);
    p.receiveShadow = true;
    g.add(p);

    if (withCurb) {
      if (w >= d) {
        for (const sz of [-1, 1]) {
          const cb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.105, 0.15), graniteCurbMat);
          cb.position.set(0, 0.012, sz * (d * 0.5 + 0.045));
          g.add(cb);
        }
      } else {
        for (const sx of [-1, 1]) {
          const cb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.105, d), graniteCurbMat);
          cb.position.set(sx * (w * 0.5 + 0.045), 0.012, 0);
          g.add(cb);
        }
      }
    }

    root.add(g);
  }

  addPavedPath(0, -10.2, 90.0, 2.8);
  addPavedPath(0, 20.8, 92.0, 3.2);

  for (const bx of [-14.5, 14.5]) {
    addPavedPath(bx - 2.6, -21.5, 2.2, 22.0);
    addPavedPath(bx + 2.6, -21.5, 2.2, 22.0);
    addPavedPath(bx, -13.0, 7.4, 2.2);
    addPavedPath(bx, -31.2, 7.4, 2.0);

    const islandCurb = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.14, 17.8), graniteCurbMat);
    islandCurb.position.set(bx, BASE_Y + 0.04, -21.5);
    root.add(islandCurb);

    const island = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.18, 17.5), lawnVelvetMat);
    island.position.set(bx, BASE_Y + 0.06, -21.5);
    island.receiveShadow = true;
    root.add(island);
  }

  addPavedPath(-8.2, 5.2, 2.2, 30.8);
  addPavedPath(8.2, 5.2, 2.2, 30.8);
  addPavedPath(0, -9.8, 18.6, 2.2);
  addPavedPath(0, 18.5, 18.6, 2.2);

  const curveSegments = 28;
  for (let i = 0; i < curveSegments; i++) {
    const tm = (i + 0.5) / curveSegments;
    const zW = -9.6 + tm * 29.2;
    const xW = -27.2 + Math.sin(tm * Math.PI * 1.35) * 2.25;
    const angW = Math.atan2(Math.cos(tm * Math.PI * 1.35) * 2.25 * Math.PI * 1.35, 29.2);
    addPavedPath(xW, zW, 2.05, 1.35, angW, true);

    const zE = -9.6 + tm * 29.8;
    const xE = 26.2 - Math.sin(tm * Math.PI * 1.25) * 2.4;
    const angE = Math.atan2(-Math.cos(tm * Math.PI * 1.25) * 2.4 * Math.PI * 1.25, 29.8);
    addPavedPath(xE, zE, 2.05, 1.38, angE, true);
  }

  addPavedPath(-31.2, 16.2, 13.0, 7.8, 0, true);

  // ========================================================================
  // 3. SETOR ① — PORTARIA MONUMENTAL (CONTROLE DE ACESSO)
  // ========================================================================
  const portariaGroup = new THREE.Group();
  portariaGroup.position.set(0, BASE_Y, 29.8);
  root.add(portariaGroup);

  for (const laneX of [-5.2, 5.2]) {
    // Piso em bloco intertravado de basalto-granito com faixas laterais em granito
    const driveway = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.09, 14.8), interlockingPaverMat);
    driveway.position.set(laneX, 0.01, 2.2);
    driveway.receiveShadow = true;
    portariaGroup.add(driveway);

    for (const bx of [-2.82, 2.82]) {
      const borderStrip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 14.8), graniteCurbMat);
      borderStrip.position.set(laneX + bx, 0.015, 2.2);
      portariaGroup.add(borderStrip);
    }

    // Faixa de pedestres em termoplástico fosco
    for (let s = -2; s <= 2; s++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.105, 2.45), mats.roadLine);
      stripe.position.set(laneX + s * 1.04, 0.02, 5.5);
      portariaGroup.add(stripe);
    }

    // Linha de retenção + seta direcional discreta (lado direito entrada, esquerdo saída)
    const stopBar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.105, 0.22), mats.roadLine);
    stopBar.position.set(laneX, 0.02, 3.6);
    portariaGroup.add(stopBar);

    const arrowGroup = new THREE.Group();
    arrowGroup.position.set(laneX, 0.068, 7.6);
    if (laneX < 0) arrowGroup.rotation.y = Math.PI;
    const arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.92), mats.roadLine);
    arrowShaft.position.set(0, 0, 0.14);
    arrowGroup.add(arrowShaft);
    const arrowHeadL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.56), mats.roadLine);
    arrowHeadL.position.set(-0.15, 0, -0.34);
    arrowHeadL.rotation.y = -Math.PI * 0.25;
    arrowGroup.add(arrowHeadL);
    const arrowHeadR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.56), mats.roadLine);
    arrowHeadR.position.set(0.15, 0, -0.34);
    arrowHeadR.rotation.y = Math.PI * 0.25;
    arrowGroup.add(arrowHeadR);
    portariaGroup.add(arrowGroup);

    // Gradil metálico fino sem folha opaca atrás (permite transparência real)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(laneX, 1.18, -0.3);

    for (const ry of [-1.05, 0.0, 1.05]) {
      const hRail = new THREE.Mesh(new THREE.BoxGeometry(5.55, 0.065, 0.10), anodizedBronzeDarkMat);
      hRail.position.y = ry;
      gateGroup.add(hRail);
    }
    for (const endX of [-2.74, 2.74]) {
      const endStile = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.26, 0.11), anodizedBronzeDarkMat);
      endStile.position.x = endX;
      gateGroup.add(endStile);
    }
    for (let bx = -2.55; bx <= 2.55; bx += 0.24) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.22, 6), anodizedBronzeDarkMat);
      bar.position.x = bx;
      gateGroup.add(bar);
    }
    portariaGroup.add(gateGroup);

    // Cancela automática motorizada (gabinete na ilha central + haste articulada listrada)
    const sideSign = Math.sign(laneX);
    const barrierHousing = new THREE.Group();
    barrierHousing.position.set(sideSign * 2.52, 0, 1.65);

    const bPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), graniteCurbMat);
    bPlinth.position.y = 0.06;
    barrierHousing.add(bPlinth);

    const bCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.96, 0.34), anodizedBronzeDarkMat);
    bCabinet.position.y = 0.54;
    barrierHousing.add(bCabinet);

    const bStripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.10, 0.35), fitnessAccentMat);
    bStripe.position.y = 0.92;
    barrierHousing.add(bStripe);

    // Haste da cancela estendendo sobre a pista (saída ligeiramente inclinada 16°)
    const armPivot = new THREE.Group();
    armPivot.position.set(0, 0.88, 0.18);
    if (laneX < 0) armPivot.rotation.z = -0.28;
    const armLen = 4.25;
    const armCore = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.075, 0.045), barrierWhiteMat);
    armCore.position.set(sideSign * (armLen * 0.5 + 0.15), 0, 0);
    armPivot.add(armCore);
    for (let seg = 0; seg < 6; seg++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.052), barrierRedMat);
      band.position.set(sideSign * (0.48 + seg * 0.68), 0, 0);
      armPivot.add(band);
    }
    barrierHousing.add(armPivot);
    portariaGroup.add(barrierHousing);

    // Totem de controle TAG/Interfone do motorista
    const keypadPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.25, 0.16), anodizedBronzeDarkMat);
    keypadPost.position.set(sideSign * 2.42, 0.625, 2.95);
    portariaGroup.add(keypadPost);
    const keypadScreen = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.12), screenCyanGlowMat);
    keypadScreen.position.set(sideSign * 2.50, 1.08, 2.95);
    portariaGroup.add(keypadScreen);

    // Ilhas paisagísticas internas pós-portões (cantos arredondados em granito)
    const innerCurb = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.20, 2.6), graniteCurbMat);
    innerCurb.position.set(laneX, 0.10, -4.6);
    portariaGroup.add(innerCurb);

    const innerIsland = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.25, 2.25), lawnVelvetMat);
    innerIsland.position.set(laneX, 0.13, -4.6);
    innerIsland.receiveShadow = true;
    portariaGroup.add(innerIsland);
  }

  // Ilha central em cápsula sem emendas visíveis (ExtrudeGeometry stadium shape)
  const islandGroup = new THREE.Group();
  islandGroup.position.set(0, 0, 3.2);

  const makeCapsuleShape = (hw, hl) => {
    const s = new THREE.Shape();
    s.moveTo(-hw, -hl);
    s.lineTo(-hw, hl);
    s.absarc(0, hl, hw, Math.PI, 0, true);
    s.lineTo(hw, -hl);
    s.absarc(0, -hl, hw, 0, Math.PI, true);
    return s;
  };

  const outerIslandGeo = new THREE.ExtrudeGeometry(makeCapsuleShape(2.14, 3.05), {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 20
  });
  outerIslandGeo.rotateX(-Math.PI / 2);
  const outerIslandMesh = new THREE.Mesh(outerIslandGeo, graniteCurbMat);
  outerIslandMesh.position.y = 0.02;
  islandGroup.add(outerIslandMesh);

  const innerLawnGeo = new THREE.ExtrudeGeometry(makeCapsuleShape(1.88, 3.05), {
    depth: 0.29,
    bevelEnabled: false,
    curveSegments: 20
  });
  innerLawnGeo.rotateX(-Math.PI / 2);
  const innerLawnMesh = new THREE.Mesh(innerLawnGeo, lawnVelvetMat);
  innerLawnMesh.position.y = 0.02;
  innerLawnMesh.receiveShadow = true;
  islandGroup.add(innerLawnMesh);
  portariaGroup.add(islandGroup);

  // Guarita Central Envidraçada com MeshPhysicalMaterial e Interior Detalhado
  const guaritaBase = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.82, 4.2), darkBasaltTrimMat);
  guaritaBase.position.set(0, 0.41, -0.2);
  portariaGroup.add(guaritaBase);

  const guaritaSill = new THREE.Mesh(new THREE.BoxGeometry(4.14, 0.09, 4.34), travertineCopingMat);
  guaritaSill.position.set(0, 0.86, -0.2);
  portariaGroup.add(guaritaSill);

  const guaritaBackWall = new THREE.Mesh(new THREE.BoxGeometry(3.45, 2.75, 0.26), stoneCladMat);
  guaritaBackWall.position.set(0, 2.25, -2.05);
  portariaGroup.add(guaritaBackWall);

  // Painel interno ripado em madeira na guarita
  const guaritaWoodBack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.5, 0.08), woodTimberMat);
  guaritaWoodBack.position.set(0, 2.2, -1.86);
  portariaGroup.add(guaritaWoodBack);

  // Vidraça dupla física refletiva
  const guaritaGlass = new THREE.Mesh(new THREE.BoxGeometry(3.88, 2.65, 3.92), archGlassReflectiveMat);
  guaritaGlass.position.set(0, 2.22, -0.15);
  portariaGroup.add(guaritaGlass);

  // Balcão de atendimento + 2 monitores de segurança + cadeira
  const guardDesk = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.92, 0.72), woodTimberMat);
  guardDesk.position.set(0, 0.96, 0.72);
  portariaGroup.add(guardDesk);
  const guardCounterTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 0.82), travertineCopingMat);
  guardCounterTop.position.set(0, 1.44, 0.72);
  portariaGroup.add(guardCounterTop);

  for (const sx of [-0.55, 0.55]) {
    const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.04), anodizedBronzeDarkMat);
    monFrame.position.set(sx, 1.72, 0.65);
    portariaGroup.add(monFrame);
    const monScreen = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.28, 0.045), screenCyanGlowMat);
    monScreen.position.set(sx, 1.72, 0.66);
    portariaGroup.add(monScreen);
  }

  const guardChair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.92, 0.48), charcoalUpholsteryMat);
  guardChair.position.set(0, 1.25, -0.05);
  portariaGroup.add(guardChair);

  const guaritaCeilingGlow = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 2.6), warmGlowSoftMat);
  guaritaCeilingGlow.position.set(0, 3.48, -0.1);
  portariaGroup.add(guaritaCeilingGlow);
  nightLightObjects.push(guaritaCeilingGlow);

  // Montantes e travessas em alumínio anodizado nos 4 lados da guarita
  for (const mx of [-1.92, -0.66, 0.66, 1.92]) {
    for (const mz of [1.80, -2.10]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.075, 2.68, 0.09), anodizedBronzeDarkMat);
      mullion.position.set(mx, 2.22, mz);
      portariaGroup.add(mullion);
    }
  }
  for (const my of [1.55, 2.75, 3.52]) {
    const hMullionF = new THREE.Mesh(new THREE.BoxGeometry(3.94, 0.065, 0.09), anodizedBronzeDarkMat);
    hMullionF.position.set(0, my, 1.80);
    portariaGroup.add(hMullionF);
    for (const sx of [-1.92, 1.92]) {
      const hMullionS = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.065, 3.94), anodizedBronzeDarkMat);
      hMullionS.position.set(sx, my, -0.15);
      portariaGroup.add(hMullionS);
    }
  }

  const centerHeaderFascia = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.56, 4.15), anodizedBronzeDarkMat);
  centerHeaderFascia.position.set(0, 3.68, -0.08);
  portariaGroup.add(centerHeaderFascia);

  // Pilares laterais monumentais: concreto branco + pedra natural + ripado 3D real em madeira
  for (const side of [-1, 1]) {
    const outerPillar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 4.72, 4.10), mats.wallPureWhite);
    outerPillar.position.set(side * 10.2, 2.36, 0.05);
    portariaGroup.add(outerPillar);

    const stoneInlay = new THREE.Mesh(new THREE.BoxGeometry(1.12, 3.95, 1.85), stoneCladMat);
    stoneInlay.position.set(side * 10.2, 1.98, 0.72);
    portariaGroup.add(stoneInlay);

    const woodBacking = new THREE.Mesh(new THREE.BoxGeometry(1.85, 4.05, 3.55), anodizedBronzeDarkMat);
    woodBacking.position.set(side * 8.78, 2.025, 0);
    portariaGroup.add(woodBacking);

    // Ripas verticais 3D reais em Cumaru/Ipê (sem brilho laranja artificial)
    for (let s = -0.80; s <= 0.80; s += 0.16) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.05, 3.66), woodTimberMat);
      slat.position.set(side * 8.78 + s, 2.025, 0);
      portariaGroup.add(slat);
    }

    const downGlow = new THREE.Mesh(subtleHaloGeo, floorLightSubtleMat);
    downGlow.position.set(side * 8.78, 0.06, 1.35);
    downGlow.scale.setScalar(1.05);
    portariaGroup.add(downGlow);
    nightLightObjects.push(downGlow);
  }

  // Totem arquitetônico de identificação na entrada Oeste (fora de árvores/guias)
  const totemGroup = new THREE.Group();
  totemGroup.position.set(-12.2, 0, 3.65);
  const totemPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.24, 0.75), graniteCurbMat);
  totemPlinth.position.y = 0.12;
  totemGroup.add(totemPlinth);
  const totemStone = new THREE.Mesh(new THREE.BoxGeometry(1.38, 2.65, 0.48), stoneCladMat);
  totemStone.position.y = 1.44;
  totemGroup.add(totemStone);
  const totemPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.45, 0.54), anodizedBronzeDarkMat);
  totemPlaque.position.set(0.08, 1.55, 0.02);
  totemGroup.add(totemPlaque);
  const totemGoldAccent = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.56), brushedStainlessMat);
  totemGoldAccent.position.set(0.08, 1.88, 0.03);
  totemGroup.add(totemGoldAccent);
  const totemLightBar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.06), warmGlowSoftMat);
  totemLightBar.position.set(0.08, 2.34, 0.27);
  totemGroup.add(totemLightBar);
  nightLightObjects.push(totemLightBar);
  portariaGroup.add(totemGroup);

  // Marquise escultural em balanço: laje clara arquitetônica, filete fino metálico perimetral e forro ripado 3D
  const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.68, 4.95), mats.wallPureWhite);
  canopyTop.position.set(0, 4.42, 0.25);
  portariaGroup.add(canopyTop);

  const canopyRoofDeck = new THREE.Mesh(new THREE.BoxGeometry(22.02, 0.14, 4.78), roofDeckLightMat);
  canopyRoofDeck.position.set(0, 4.82, 0.25);
  portariaGroup.add(canopyRoofDeck);

  // Filete metálico perimetral fino (~0.14m) contornando o topo da marquise
  for (const sz of [-2.22, 2.72]) {
    const rimNS = new THREE.Mesh(new THREE.BoxGeometry(22.34, 0.12, 0.14), anodizedBronzeDarkMat);
    rimNS.position.set(0, 4.82, sz);
    portariaGroup.add(rimNS);
  }
  for (const sx of [-11.10, 11.10]) {
    const rimEW = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 5.08), anodizedBronzeDarkMat);
    rimEW.position.set(sx, 4.82, 0.25);
    portariaGroup.add(rimEW);
  }

  const canopySoffitBack = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.14, 4.45), anodizedBronzeDarkMat);
  canopySoffitBack.position.set(0, 4.02, 0.25);
  portariaGroup.add(canopySoffitBack);

  for (let sz = -1.75; sz <= 2.25; sz += 0.26) {
    const soffitSlat = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.09, 0.11), woodTimberMat);
    soffitSlat.position.set(0, 3.92, sz);
    portariaGroup.add(soffitSlat);
  }

  // Cada passagem da portaria recebe uma abóbada rasa de madeira sob a laje.
  for (const laneX of [-5.2, 5.2]) {
    const soffit = new THREE.Shape();
    soffit.moveTo(-3.15, 4.10);
    soffit.lineTo(-3.15, 3.10);
    soffit.bezierCurveTo(-2.78, 3.10, -2.68, 3.88, -1.94, 3.88);
    soffit.lineTo(1.94, 3.88);
    soffit.bezierCurveTo(2.68, 3.88, 2.78, 3.10, 3.15, 3.10);
    soffit.lineTo(3.15, 4.10);
    soffit.closePath();
    const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(soffit, {
      depth: 4.34, bevelEnabled: false, curveSegments: 6
    }), woodTimberMat);
    arch.position.set(laneX, 0, -1.92);
    portariaGroup.add(arch);
  }

  for (const spotX of [-7.4, -4.6, -2.8, 2.8, 4.6, 7.4]) {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), anodizedBronzeDarkMat);
    bezel.position.set(spotX, 3.88, 0.65);
    portariaGroup.add(bezel);
    const downlight = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.055, 12), warmGlowSoftMat);
    downlight.position.set(spotX, 3.875, 0.65);
    portariaGroup.add(downlight);
    nightLightObjects.push(downlight);
  }

  // ========================================================================
  // 4. SETOR ② — PISCINA CENTRAL (WEBGL WATER INTACTO + PRAINHA + DECK +
  //    BORDA TRAVERTINO + ESCADAS INOX + ESPREGUIÇADEIRAS + OMBRELONES + DUCHA)
  // ========================================================================
  const poolGroup = new THREE.Group();
  poolGroup.position.set(0, BASE_Y, 4.2);
  root.add(poolGroup);

  const poolHalfW = 4.12;
  const poolHalfL = 9.42;
  const poolDepth = 1.42;

  // Deck de madeira Ipê com acabamento em 4 faixas ao redor do vão da bacia
  const deckFrameSpecs = [
    { x: -5.51, z: 0.0, w: 2.78, d: 27.0 },
    { x:  5.51, z: 0.0, w: 2.78, d: 27.0 },
    { x:  0.0,  z: -11.46, w: 8.24, d: 4.08 },
    { x:  0.0,  z:  11.46, w: 8.24, d: 4.08 }
  ];
  for (const df of deckFrameSpecs) {
    const dm = new THREE.Mesh(new THREE.BoxGeometry(df.w, 0.14, df.d), mats.woodDeck);
    dm.position.set(df.x, 0.07, df.z);
    dm.receiveShadow = true;
    poolGroup.add(dm);
  }

  // Meio-fio perimetral discreto em granito emoldurando o deck externo
  for (const sx of [-6.95, 6.95]) {
    const deckEdge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 27.2), graniteCurbMat);
    deckEdge.position.set(sx, 0.075, 0);
    poolGroup.add(deckEdge);
  }

  // Borda atérmica em pedra Travertino com pingadeira interna e canaleta perimetral escura
  const copingBorderW = 0.52;
  const copingSpecs = [
    { x: -(poolHalfW + copingBorderW * 0.5 - 0.04), z: 0.0, w: copingBorderW, d: poolHalfL * 2 + copingBorderW * 2 - 0.08 },
    { x:  (poolHalfW + copingBorderW * 0.5 - 0.04), z: 0.0, w: copingBorderW, d: poolHalfL * 2 + copingBorderW * 2 - 0.08 },
    { x: 0.0, z: -(poolHalfL + copingBorderW * 0.5 - 0.04), w: poolHalfW * 2, d: copingBorderW },
    { x: 0.0, z:  (poolHalfL + copingBorderW * 0.5 - 0.04), w: poolHalfW * 2, d: copingBorderW }
  ];
  for (const cs of copingSpecs) {
    const cm = new THREE.Mesh(new THREE.BoxGeometry(cs.w, 0.24, cs.d), travertineCopingMat);
    cm.position.set(cs.x, 0.12, cs.z);
    cm.receiveShadow = true;
    poolGroup.add(cm);
  }

  // Bordas internas arredondadas em travertino como no panorama da piscina.
  const filletR = 1.05;
  const corner = new THREE.Shape();
  corner.moveTo(0, 0);
  corner.lineTo(filletR, 0);
  corner.absarc(filletR, filletR, filletR, -Math.PI / 2, -Math.PI, true);
  corner.closePath();
  const cornerGeo = new THREE.ExtrudeGeometry(corner, {
    depth: 0.24, bevelEnabled: false, curveSegments: 8
  });
  cornerGeo.rotateX(-Math.PI / 2);
  for (const [sx, sz, angle] of [[-1, 1, 0], [1, 1, Math.PI / 2], [1, -1, Math.PI], [-1, -1, -Math.PI / 2]]) {
    const stone = new THREE.Mesh(cornerGeo, travertineCopingMat);
    stone.position.set(sx * (poolHalfW - 0.04), 0, sz * (poolHalfL - 0.04));
    stone.rotation.y = angle;
    stone.receiveShadow = true;
    poolGroup.add(stone);
  }

  // Canaleta / dreno metálico escuro entre o travertino e o deck de madeira
  for (const sx of [-4.63, 4.63]) {
    const drain = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, poolHalfL * 2 + 1.04), anodizedBronzeDarkMat);
    drain.position.set(sx, 0.09, 0);
    poolGroup.add(drain);
  }
  for (const sz of [-9.93, 9.93]) {
    const drainNS = new THREE.Mesh(new THREE.BoxGeometry(poolHalfW * 2 + 0.98, 0.16, 0.07), anodizedBronzeDarkMat);
    drainNS.position.set(0, 0.09, sz);
    poolGroup.add(drainNS);
  }

  // Uniforms compartilhados entre a Bacia de Azulejos e a Superfície WebGL Water
  const waterUniforms = {
    uTime: { value: 0.0 },
    uDropCenter: { value: new THREE.Vector2(0.0, 0.0) },
    uDropTime: { value: -10.0 },
    uLightDir: { value: new THREE.Vector3(0.42, 0.86, 0.35).normalize() },
    uLocalCameraPos: { value: new THREE.Vector3(0.0, 45.0, 50.0) },
    uTileTex: { value: webglWaterTilesTex }
  };

  const poolBasinShaderMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: POOL_BASIN_VERTEX_SHADER,
    fragmentShader: POOL_BASIN_FRAGMENT_SHADER,
    side: THREE.DoubleSide
  });

  // Bacia 3D rebaixada + Prainha submersa (wet-deck raso ao Norte) + 2 degraus de transição
  const basinGroup = new THREE.Group();
  const wallTopY = 0.24;
  const wallBottomY = -poolDepth;
  const wallTotalH = wallTopY - wallBottomY;
  const wallMidY = (wallTopY + wallBottomY) * 0.5;

  const floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(poolHalfW * 2, poolHalfL * 2, 4, 8), poolBasinShaderMat);
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set(0, wallBottomY, 0);
  basinGroup.add(floorPlane);

  for (const sx of [-1, 1]) {
    const wPlane = new THREE.Mesh(new THREE.PlaneGeometry(poolHalfL * 2, wallTotalH, 8, 2), poolBasinShaderMat);
    wPlane.rotation.y = sx === -1 ? Math.PI / 2 : -Math.PI / 2;
    wPlane.position.set(sx * poolHalfW, wallMidY, 0);
    basinGroup.add(wPlane);
  }

  for (const sz of [-1, 1]) {
    const lPlane = new THREE.Mesh(new THREE.PlaneGeometry(poolHalfW * 2, wallTotalH, 4, 2), poolBasinShaderMat);
    if (sz === 1) lPlane.rotation.y = Math.PI;
    lPlane.position.set(0, wallMidY, sz * poolHalfL);
    basinGroup.add(lPlane);
  }

  // Plataforma física da Prainha submersa (y_top = -0.14, z in [-9.42, -6.85]) e 2 degraus
  const prainhaBox = new THREE.Mesh(new THREE.BoxGeometry(poolHalfW * 2, 1.28, 2.57), poolBasinShaderMat);
  prainhaBox.position.set(0, -0.78, -9.42 + 1.285);
  basinGroup.add(prainhaBox);

  const step1Box = new THREE.Mesh(new THREE.BoxGeometry(poolHalfW * 2, 0.94, 0.65), poolBasinShaderMat);
  step1Box.position.set(0, -0.95, -6.85 + 0.325);
  basinGroup.add(step1Box);

  const step2Box = new THREE.Mesh(new THREE.BoxGeometry(poolHalfW * 2, 0.60, 0.65), poolBasinShaderMat);
  step2Box.position.set(0, -1.12, -6.20 + 0.325);
  basinGroup.add(step2Box);

  poolGroup.add(basinGroup);

  // Superfície da Água WebGL Water (Refração Raytraced + Reflexo Fresnel + Ripples)
  const poolWaterShaderMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: WATER_SURFACE_VERTEX_SHADER,
    fragmentShader: WATER_SURFACE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false
  });
  poolWaterShaderMat.map = webglWaterTilesTex;

  const waterSurfaceGeo = new THREE.PlaneGeometry(poolHalfW * 2, poolHalfL * 2, 48, 96);
  waterSurfaceGeo.rotateX(-Math.PI / 2);

  const poolWaterMesh = new THREE.Mesh(waterSurfaceGeo, poolWaterShaderMat);
  poolWaterMesh.position.set(0, 0.08, 0);

  const tempCamLocal = new THREE.Vector3();
  let lastAutoTime = performance.now() * 0.001;
  poolWaterMesh.onBeforeRender = function (_renderer, _scene, camera) {
    if (camera) {
      tempCamLocal.copy(camera.position);
      poolGroup.worldToLocal(tempCamLocal);
      waterUniforms.uLocalCameraPos.value.copy(tempCamLocal);
    }
    const now = performance.now() * 0.001;
    const dt = Math.min(0.1, Math.max(0.0, now - lastAutoTime));
    lastAutoTime = now;
    if (dt > 0.0001) {
      waterUniforms.uTime.value += dt;
    }
  };

  poolWaterMesh.userData.waterUniforms = waterUniforms;
  poolWaterMesh.userData.poolGroup = poolGroup;
  poolGroup.userData.waterUniforms = waterUniforms;
  root.userData.waterUniforms = waterUniforms;

  poolGroup.add(poolWaterMesh);

  // 8 Refletores subaquáticos LED (4 a Oeste, 4 a Leste)
  const ledGeo = new THREE.SphereGeometry(0.13, 10, 10);
  const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  for (const lz of [-6.4, -2.1, 2.3, 6.8]) {
    for (const lx of [-3.98, 3.98]) {
      const led = new THREE.Mesh(ledGeo, cyanLedMat);
      led.position.set(lx, -0.18, lz);
      poolGroup.add(led);
      nightLightObjects.push(led);
    }
  }

  // Helper de espreguiçadeira esculpida multi-partes (madeira/alumínio + braços + almofada + encosto)
  function createSculptedLounger(baseColorMat, isInWater = false) {
    const lg = new THREE.Group();
    const legDrop = isInWater ? 0.24 : 0.0;

    // Estrutura de base com 4 pés e travessas laterais
    const frameBase = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.76), baseColorMat);
    frameBase.position.y = 0.14;
    lg.add(frameBase);

    for (const lx of [-0.72, 0.72]) {
      for (const lz of [-0.33, 0.33]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.02, 0.14 + legDrop, 8),
          isInWater ? brushedStainlessMat : baseColorMat
        );
        leg.position.set(lx, 0.07 - legDrop * 0.5, lz);
        lg.add(leg);
      }
    }

    // Colchonete anatômico segmentado + encosto reclinado + travesseiro rolo
    const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.66), creamCushionMat);
    seatCushion.position.set(-0.22, 0.21, 0);
    lg.add(seatCushion);

    const backrestFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.74), baseColorMat);
    backrestFrame.position.set(0.56, 0.31, 0);
    backrestFrame.rotation.z = 0.50;
    lg.add(backrestFrame);

    const backrestCushion = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.66), creamCushionMat);
    backrestCushion.position.set(0.54, 0.355, 0);
    backrestCushion.rotation.z = 0.50;
    lg.add(backrestCushion);

    const pillow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.44, 10),
      isInWater ? sagePillowMat : terracottaPillowMat
    );
    pillow.rotation.x = Math.PI / 2;
    pillow.position.set(0.64, 0.46, 0);
    lg.add(pillow);

    // Braços laterais esculturais em madeira/inox
    for (const az of [-0.37, 0.37]) {
      const armTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.06), baseColorMat);
      armTop.position.set(0.14, 0.34, az);
      lg.add(armTop);
      const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.05), baseColorMat);
      armPost.position.set(-0.18, 0.24, az);
      lg.add(armPost);
      const armPostBack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.05), baseColorMat);
      armPostBack.position.set(0.44, 0.24, az);
      lg.add(armPostBack);
    }
    return lg;
  }

  // 2 Espreguiçadeiras dentro d'água na Prainha (base submersa em y=-0.14, leito acima da linha d'água)
  for (const lx of [-2.05, 2.05]) {
    const wetLounger = createSculptedLounger(mats.wallPureWhite, true);
    wetLounger.position.set(lx, -0.04, -8.12);
    wetLounger.rotation.y = -Math.PI / 2; // Cabeceira ao Norte, pés voltados para o espelho d'água
    poolGroup.add(wetLounger);
  }

  // 8 Espreguiçadeiras esculpidas nas laterais do deck (livres dos anéis das palmeiras!)
  for (const side of [-1, 1]) {
    for (const lz of [-4.2, 1.6, 4.4, 7.2]) {
      const lg = createSculptedLounger(woodTimberMat, false);
      lg.position.set(side * 5.55, 0.14, lz);
      if (side === -1) lg.rotation.y = Math.PI; // Cabeceira voltada para fora, olhando para a piscina
      poolGroup.add(lg);
    }

    for (const tz of [-4.2, 3.0, 5.8]) {
      const sideTbl = new THREE.Group();
      sideTbl.position.set(side * 5.65, 0.14, tz + (tz < 0 ? 1.15 : 0));
      const tblPed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.14, 0.34, 12), anodizedBronzeDarkMat);
      tblPed.position.y = 0.17;
      sideTbl.add(tblPed);
      const tblTop = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.26, 0.04, 16), travertineCopingMat);
      tblTop.position.y = 0.35;
      sideTbl.add(tblTop);
      poolGroup.add(sideTbl);
    }
  }

  // Escadas em aço inox com degraus submersos (2 laterais) + corrimão central da Prainha
  const buildPoolLadder = (x, z, mirrorX) => {
    const lad = new THREE.Group();
    lad.position.set(x, 0.24, z);
    const dir = mirrorX ? -1 : 1;

    for (const rz of [-0.26, 0.26]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(dir * 0.44, -0.02, rz),
        new THREE.Vector3(dir * 0.44, 0.62, rz),
        new THREE.Vector3(dir * 0.12, 0.72, rz),
        new THREE.Vector3(-dir * 0.08, 0.56, rz),
        new THREE.Vector3(-dir * 0.08, -0.96, rz)
      ]);
      const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.028, 8, false), brushedStainlessMat);
      lad.add(rail);
      const escutcheon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10), brushedStainlessMat);
      escutcheon.position.set(dir * 0.44, 0.01, rz);
      lad.add(escutcheon);
    }
    for (const ry of [-0.24, -0.52, -0.80]) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.52), brushedStainlessMat);
      rung.position.set(-dir * 0.08, ry, 0);
      lad.add(rung);
    }
    poolGroup.add(lad);
  };
  buildPoolLadder(-4.18, 5.8, true);
  buildPoolLadder(4.18, 5.8, false);

  // Corrimão central curvo na descida da Prainha
  const stepRailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.14, -7.25),
    new THREE.Vector3(0, 0.58, -7.20),
    new THREE.Vector3(0, 0.36, -6.20),
    new THREE.Vector3(0, 0.04, -5.55),
    new THREE.Vector3(0, -0.82, -5.55)
  ]);
  const stepRail = new THREE.Mesh(new THREE.TubeGeometry(stepRailCurve, 22, 0.028, 8, false), brushedStainlessMat);
  poolGroup.add(stepRail);

  // Ducha externa da piscina (torre ripada + deck de drenagem + chuveiro inox)
  const showerGroup = new THREE.Group();
  showerGroup.position.set(4.95, 0.14, 8.2);
  const showerDrain = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.96), travertineCopingMat);
  showerDrain.position.y = 0.025;
  showerGroup.add(showerDrain);
  const showerCol = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.28, 0.36), woodTimberMat);
  showerCol.position.set(0.32, 1.14, 0);
  showerGroup.add(showerCol);
  const showerNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 8), brushedStainlessMat);
  showerNeck.rotation.z = Math.PI / 2;
  showerNeck.position.set(0.08, 2.16, 0);
  showerGroup.add(showerNeck);
  const showerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 14), brushedStainlessMat);
  showerHead.position.set(-0.14, 2.10, 0);
  showerGroup.add(showerHead);
  const showerValve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), brushedStainlessMat);
  showerValve.rotation.z = Math.PI / 2;
  showerValve.position.set(0.21, 1.08, 0);
  showerGroup.add(showerValve);
  poolGroup.add(showerGroup);

  // 4 Floreiras arquitetônicas nos cantos do deck da piscina (afastadas dos anéis de palmeiras)
  const addSquarePlanter = (parent, px, py, pz, size = 0.85, height = 0.46) => {
    const pl = new THREE.Group();
    pl.position.set(px, py, pz);
    const pot = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), travertineCopingMat);
    pot.position.y = height * 0.5;
    pl.add(pot);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(size * 0.82, 0.06, size * 0.82), soilMulchMat);
    soil.position.y = height - 0.02;
    pl.add(soil);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(size * 0.16, height * 0.95, 5),
        i % 2 === 0 ? planterFoliageMat : planterGrassMat
      );
      tuft.position.set(Math.cos(ang) * size * 0.18, height + height * 0.34, Math.sin(ang) * size * 0.18);
      tuft.rotation.set(Math.sin(ang) * 0.25, ang, -Math.cos(ang) * 0.25);
      pl.add(tuft);
    }
    parent.add(pl);
  };

  for (const px of [-4.72, 4.72]) {
    addSquarePlanter(poolGroup, px, 0.14, -9.85, 0.82, 0.48);
    addSquarePlanter(poolGroup, px, 0.14,  9.65, 0.82, 0.48);
  }

  // Helper reutilizável: Conjunto Ombrelone Realista (mastro madeira + 8 varetas + cúpula dupla ventilada) + Mesa + 4 Cadeiras
  function createParasolSet(x, z, parentGroup, baseY = 0.14) {
    const pg = new THREE.Group();
    pg.position.set(x, baseY, z);

    // Mesa redonda ripada com pedestal metálico
    const tblBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.05, 16), anodizedBronzeDarkMat);
    tblBase.position.y = 0.025;
    pg.add(tblBase);

    const tblTop = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.06, 20), woodTimberMat);
    tblTop.position.y = 0.64;
    pg.add(tblTop);

    const tblRim = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.025, 20), anodizedBronzeDarkMat);
    tblRim.position.y = 0.61;
    pg.add(tblRim);

    // Mastro central em madeira nobre + manivela + cubo superior
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 2.34, 12), woodTimberMat);
    pole.position.y = 1.17;
    pg.add(pole);

    const crankHub = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.14, 12), anodizedBronzeDarkMat);
    crankHub.position.y = 1.48;
    pg.add(crankHub);

    // 8 Varetas estruturais visíveis sob o guarda-sol
    for (let r = 0; r < 8; r++) {
      const ang = (r * Math.PI) / 4;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 1.78), woodTimberMat);
      rib.position.set(Math.cos(ang) * 0.86, 2.02, Math.sin(ang) * 0.86);
      rib.rotation.y = -ang + Math.PI * 0.5;
      rib.rotation.x = 0.24;
      pg.add(rib);
    }

    // Cúpula dupla ventilada (saiote octogonal + sobre-teto wind-vent)
    const canopyMain = new THREE.Mesh(new THREE.ConeGeometry(1.78, 0.50, 8), umbrellaLinenMat);
    canopyMain.position.y = 2.08;
    pg.add(canopyMain);

    const canopyVent = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.24, 8), umbrellaLinenMat);
    canopyVent.position.y = 2.34;
    pg.add(canopyVent);

    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.12, 8), woodTimberMat);
    finial.position.y = 2.48;
    pg.add(finial);

    // 4 Cadeiras esculpidas com pernas cônicas, braços e almofadas
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + Math.PI / 4;
      const cg = new THREE.Group();
      cg.position.set(Math.cos(ang) * 1.14, 0, Math.sin(ang) * 1.14);
      cg.rotation.y = -ang;

      for (const lx of [-0.19, 0.19]) {
        for (const lz of [-0.19, 0.19]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.38, 6), anodizedBronzeDarkMat);
          leg.position.set(lx, 0.19, lz);
          cg.add(leg);
        }
      }

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), woodTimberMat);
      seat.position.y = 0.39;
      cg.add(seat);

      const cCushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.42), creamCushionMat);
      cCushion.position.y = 0.44;
      cg.add(cCushion);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.44, 0.46), woodTimberMat);
      back.position.set(0.21, 0.62, 0);
      back.rotation.z = -0.10;
      cg.add(back);

      for (const az of [-0.21, 0.21]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.045), woodTimberMat);
        arm.position.set(0.04, 0.56, az);
        cg.add(arm);
      }

      pg.add(cg);
    }

    parentGroup.add(pg);
  }

  createParasolSet(-2.3, -11.4, poolGroup);
  createParasolSet(2.3, -11.4, poolGroup);
  createParasolSet(-2.3, 11.4, poolGroup);
  createParasolSet(2.3, 11.4, poolGroup);

  // ========================================================================
  // 5. SETOR ③ — QUADRA POLIESPORTIVA (ALAMBRADO LOSANGULAR FRAME_023,
  //    TABELAS EM VIDRO FÍSICO, BANCOS DE RESERVA E 8 REFLETORES LED)
  // ========================================================================
  const courtGroup = new THREE.Group();
  courtGroup.position.set(-36.5, BASE_Y, 3.2);
  root.add(courtGroup);

  const cw = 15.4;
  const cd = 23.6;

  const courtBase = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.85, 0.16, cd + 0.85), graniteCurbMat);
  courtBase.position.y = 0.08;
  courtBase.receiveShadow = true;
  courtGroup.add(courtBase);

  const courtFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(cw, cd),
    new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.93 })
  );
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.y = 0.168;
  courtFloor.receiveShadow = true;
  courtGroup.add(courtFloor);

  const tennisNetW = cw * 0.68;
  const tennisNetGeo = new THREE.PlaneGeometry(tennisNetW, 0.82, 16, 1);
  const tapeGeo = new THREE.PlaneGeometry(tennisNetW, 0.05, 16, 1);
  for (const [geo, elevation] of [[tennisNetGeo, 0.66], [tapeGeo, 1.07]]) {
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const span = positions.getX(i) / (tennisNetW * 0.5);
      const y = positions.getY(i);
      const sag = (geo === tapeGeo || y > 0) ? 0.10 * (1 - span * span) : 0;
      positions.setY(i, y + elevation - sag);
    }
  }
  courtGroup.add(new THREE.Mesh(tennisNetGeo, fenceWireShortMat));
  courtGroup.add(new THREE.Mesh(tapeGeo, new THREE.MeshStandardMaterial({
    color: 0xf2ebd9, side: THREE.DoubleSide, roughness: 0.94
  })));
  for (const x of [-tennisNetW * 0.5, tennisNetW * 0.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.96, 8), anodizedBronzeDarkMat);
    post.position.set(x, 0.65, 0);
    courtGroup.add(post);
  }

  const netMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    wireframe: true,
    transparent: true,
    opacity: 0.85
  });
  const rimOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35, metalness: 0.3 });
  const padBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55 });

  // Tabelas oficiais de basquete em vidro físico temperado + aros retráteis + gols de futsal
  for (const dir of [-1, 1]) {
    const hoopGroup = new THREE.Group();
    hoopGroup.position.set(0, 0.16, dir * (cd * 0.44));
    if (dir === 1) hoopGroup.rotation.y = Math.PI;

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 2.85, 12), anodizedBronzeDarkMat);
    post.position.set(0, 1.425, -0.78);
    hoopGroup.add(post);

    const postPad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.65, 12), padBlueMat);
    postPad.position.set(0, 0.85, -0.78);
    hoopGroup.add(postPad);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.92), anodizedBronzeDarkMat);
    arm.position.set(0, 2.62, -0.34);
    hoopGroup.add(arm);

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.96, 8), anodizedBronzeDarkMat);
    strut.position.set(0, 2.34, -0.38);
    strut.rotation.x = 0.65;
    hoopGroup.add(strut);

    // Moldura perimetral em aço + vidro temperado físico transparente
    const boardW = 1.76;
    const boardH = 1.14;
    const boardZ = 0.12;
    const boardY = 2.62;
    for (const fy of [-boardH * 0.5, boardH * 0.5]) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.06, 0.05, 0.06), anodizedBronzeDarkMat);
      hBar.position.set(0, boardY + fy, boardZ);
      hoopGroup.add(hBar);
    }
    for (const fx of [-boardW * 0.5, boardW * 0.5]) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, boardH, 0.06), anodizedBronzeDarkMat);
      vBar.position.set(fx, boardY, boardZ);
      hoopGroup.add(vBar);
    }
    const bottomPad = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.08, 0.08, 0.09), padBlueMat);
    bottomPad.position.set(0, boardY - boardH * 0.5 - 0.02, boardZ);
    hoopGroup.add(bottomPad);

    const glassBoard = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), backboardGlassMat);
    glassBoard.position.set(0, boardY, boardZ);
    hoopGroup.add(glassBoard);

    const rimMount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), rimOrangeMat);
    rimMount.position.set(0, 2.34, 0.19);
    hoopGroup.add(rimMount);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 10, 18), rimOrangeMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 2.34, 0.42);
    hoopGroup.add(rim);

    const net = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.36, 12, 4, true), netMat);
    net.position.set(0, 2.15, 0.42);
    hoopGroup.add(net);

    // Trave de futsal integrada com profundidade
    const goalW = 2.65;
    const goalH = 1.65;
    const goalCrossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, goalW, 10), mats.wallPureWhite);
    goalCrossbar.rotation.z = Math.PI / 2;
    goalCrossbar.position.set(0, goalH, -0.18);
    hoopGroup.add(goalCrossbar);

    for (const gx of [-goalW * 0.5, goalW * 0.5]) {
      const gPost = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, goalH, 10), mats.wallPureWhite);
      gPost.position.set(gx, goalH * 0.5, -0.18);
      hoopGroup.add(gPost);

      const gBack = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.72, 8), mats.wallPureWhite);
      gBack.rotation.x = Math.PI / 2;
      gBack.position.set(gx, 0.04, -0.54);
      hoopGroup.add(gBack);

      const gSlope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.75, 8), mats.wallPureWhite);
      gSlope.position.set(gx, goalH * 0.5, -0.52);
      gSlope.rotation.x = -0.38;
      hoopGroup.add(gSlope);
    }

    courtGroup.add(hoopGroup);
  }

  // Alambrado em tela losangular escura com textura uniforme nas 4 faces + tubos de aço
  const fenceH = 3.5;
  const fenceN = new THREE.Mesh(new THREE.PlaneGeometry(cw, fenceH), fenceWireShortMat);
  fenceN.position.set(0, fenceH * 0.5 + 0.16, -cd * 0.5);
  courtGroup.add(fenceN);
  const fenceS = fenceN.clone();
  fenceS.position.z = cd * 0.5;
  courtGroup.add(fenceS);

  const fenceW = new THREE.Mesh(new THREE.PlaneGeometry(cd, fenceH), fenceWireLongMat);
  fenceW.rotation.y = Math.PI / 2;
  fenceW.position.set(-cw * 0.5, fenceH * 0.5 + 0.16, 0);
  courtGroup.add(fenceW);
  const fenceE = fenceW.clone();
  fenceE.position.x = cw * 0.5;
  courtGroup.add(fenceE);

  // Travessas tubulares cilíndricas (4 níveis: base, 1/3, 2/3, topo)
  for (const ry of [0.22, fenceH * 0.34 + 0.16, fenceH * 0.67 + 0.16, fenceH + 0.16]) {
    for (const sz of [-cd * 0.5, cd * 0.5]) {
      const barNS = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, cw + 0.10, 8), anodizedBronzeDarkMat);
      barNS.rotation.z = Math.PI / 2;
      barNS.position.set(0, ry, sz);
      courtGroup.add(barNS);
    }
    for (const sx of [-cw * 0.5, cw * 0.5]) {
      const barWE = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, cd + 0.10, 8), anodizedBronzeDarkMat);
      barWE.rotation.x = Math.PI / 2;
      barWE.position.set(sx, ry, 0);
      courtGroup.add(barWE);
    }
  }

  // Montantes tubulares verticais + portão de acesso no canto sudeste
  for (const px of [-cw * 0.25, 0, cw * 0.25]) {
    for (const pz of [-cd * 0.5, cd * 0.5]) {
      const mPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, fenceH + 0.06, 8), anodizedBronzeDarkMat);
      mPost.position.set(px, fenceH * 0.5 + 0.16, pz);
      courtGroup.add(mPost);
    }
  }
  for (const pz of [-cd * 0.32, 0, cd * 0.32]) {
    for (const px of [-cw * 0.5, cw * 0.5]) {
      const sidePost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, fenceH + 0.06, 8), anodizedBronzeDarkMat);
      sidePost.position.set(px, fenceH * 0.5 + 0.16, pz);
      courtGroup.add(sidePost);
    }
  }

  // 8 Postes de refletores LED esportivos (sem halos gigantes lavando o piso)
  for (const px of [-cw * 0.5, cw * 0.5]) {
    for (const pz of [-cd * 0.48, -cd * 0.16, cd * 0.16, cd * 0.48]) {
      const poleH = fenceH + 0.95;
      const fPost = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, poleH, 10), anodizedBronzeDarkMat);
      fPost.position.set(px, poleH * 0.5 + 0.16, pz);
      courtGroup.add(fPost);

      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.10), anodizedBronzeDarkMat);
      bracket.position.set(px * 0.955, poleH + 0.14, pz);
      courtGroup.add(bracket);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.32), anodizedBronzeDarkMat);
      hood.position.set(px * 0.935, poleH + 0.11, pz);
      hood.rotation.z = px < 0 ? -0.35 : 0.35;
      courtGroup.add(hood);

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.26), warmGlowSoftMat);
      lamp.position.set(px * 0.935, poleH + 0.05, pz);
      lamp.rotation.z = px < 0 ? -0.35 : 0.35;
      courtGroup.add(lamp);

      nightLightObjects.push(lamp);
    }
  }

  // 2 Bancos ripados de reserva/espectadores na margem leste interna da quadra
  for (const bz of [-3.2, 3.2]) {
    const bench = new THREE.Group();
    bench.position.set(cw * 0.5 - 0.56, 0.17, bz);
    for (const lz of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.06), anodizedBronzeDarkMat);
      leg.position.set(0, 0.21, lz);
      bench.add(leg);
    }
    const seatPlank = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 2.25), woodTimberMat);
    seatPlank.position.y = 0.44;
    bench.add(seatPlank);
    const backPlank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 2.25), woodTimberMat);
    backPlank.position.set(0.20, 0.66, 0);
    bench.add(backPlank);
    courtGroup.add(bench);
  }

  // ========================================================================
  // 6. SETOR ④ — ACADEMIA AO AR LIVRE (6 ESTAÇÕES DISTINTAS) & PERGOLADO
  // ========================================================================
  const gymOutdoorGroup = new THREE.Group();
  gymOutdoorGroup.position.set(-30.0, BASE_Y, 16.2);
  root.add(gymOutdoorGroup);

  const buildFitnessStation = (type, x, z) => {
    const eq = new THREE.Group();
    eq.position.set(x, 0.10, z);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 1.72), epdmPadMat);
    pad.receiveShadow = true;
    eq.add(pad);
    const padTrim = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.04, 1.78), graniteCurbMat);
    padTrim.position.y = -0.01;
    eq.add(padTrim);

    if (type === 0) {
      // 1. Supino / Chest Press articulado
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 1.45, 10), anodizedBronzeDarkMat);
      post.position.set(0, 0.74, -0.36);
      eq.add(post);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), fitnessAccentMat);
      seat.position.set(0, 0.50, 0.22);
      eq.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.58, 0.09), fitnessAccentMat);
      back.position.set(0, 0.86, -0.14);
      back.rotation.x = -0.15;
      eq.add(back);
      const topArm = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.07, 0.07), brushedStainlessMat);
      topArm.position.set(0, 1.38, -0.12);
      eq.add(topArm);
      for (const hx of [-0.42, 0.42]) {
        const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.55, 8), brushedStainlessMat);
        lever.position.set(hx, 1.14, 0.10);
        lever.rotation.x = 0.42;
        eq.add(lever);
      }
    } else if (type === 1) {
      // 2. Elíptico Cross-Trainer
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 1.32), anodizedBronzeDarkMat);
      rail.position.y = 0.09;
      eq.add(rail);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16), anodizedBronzeDarkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.42, 0.36);
      eq.add(wheel);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.28, 10), anodizedBronzeDarkMat);
      mast.position.set(0, 0.70, 0.36);
      mast.rotation.x = -0.18;
      eq.add(mast);
      const consoleHead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.10), fitnessAccentMat);
      consoleHead.position.set(0, 1.34, 0.24);
      eq.add(consoleHead);
      for (const sx of [-0.22, 0.22]) {
        const armBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.12, 8), brushedStainlessMat);
        armBar.position.set(sx, 0.88, 0.04);
        armBar.rotation.x = sx < 0 ? 0.22 : -0.22;
        eq.add(armBar);
        const ski = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.42), fitnessAccentMat);
        ski.position.set(sx, 0.26, -0.14);
        eq.add(ski);
      }
    } else if (type === 2) {
      // 3. Simulador de Caminhada / Air Walker
      for (const sx of [-0.36, 0.36]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.48, 8), anodizedBronzeDarkMat);
        leg.position.set(sx, 0.74, 0);
        eq.add(leg);
      }
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.08), fitnessAccentMat);
      arch.position.set(0, 1.44, 0);
      eq.add(arch);
      for (const sx of [-0.20, 0.20]) {
        const pendulum = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.15, 8), brushedStainlessMat);
        pendulum.position.set(sx, 0.84, sx < 0 ? 0.14 : -0.14);
        pendulum.rotation.x = sx < 0 ? -0.22 : 0.22;
        eq.add(pendulum);
        const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.34), anodizedBronzeDarkMat);
        pedal.position.set(sx, 0.28, sx < 0 ? 0.26 : -0.26);
        eq.add(pedal);
      }
    } else if (type === 3) {
      // 4. Leg Press Sentado
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 1.38), anodizedBronzeDarkMat);
      frame.position.y = 0.10;
      eq.add(frame);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.44), fitnessAccentMat);
      seat.position.set(0, 0.46, -0.24);
      eq.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.09), fitnessAccentMat);
      back.position.set(0, 0.78, -0.46);
      back.rotation.x = -0.24;
      eq.add(back);
      const platePost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.92, 8), anodizedBronzeDarkMat);
      platePost.position.set(0, 0.48, 0.44);
      eq.add(platePost);
      const footPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.38, 0.08), brushedStainlessMat);
      footPlate.position.set(0, 0.62, 0.36);
      footPlate.rotation.x = -0.35;
      eq.add(footPlate);
    } else if (type === 4) {
      // 5. Puxador Alto / Lat Pulldown
      for (const sx of [-0.38, 0.38]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.78, 8), anodizedBronzeDarkMat);
        col.position.set(sx, 0.90, -0.22);
        eq.add(col);
      }
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 0.56), fitnessAccentMat);
      crown.position.set(0, 1.78, 0.0);
      eq.add(crown);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.44), fitnessAccentMat);
      seat.position.set(0, 0.50, 0.24);
      eq.add(seat);
      const pullBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.96, 8), brushedStainlessMat);
      pullBar.rotation.z = Math.PI / 2;
      pullBar.position.set(0, 1.54, 0.24);
      eq.add(pullBar);
    } else {
      // 6. Bicicleta Ergométrica Esportiva
      const baseBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 1.18), anodizedBronzeDarkMat);
      baseBar.position.y = 0.09;
      eq.add(baseBar);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.10, 16), anodizedBronzeDarkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.42, 0.22);
      eq.add(wheel);
      const saddlePost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), brushedStainlessMat);
      saddlePost.position.set(0, 0.50, -0.32);
      eq.add(saddlePost);
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.32), fitnessAccentMat);
      saddle.position.set(0, 0.86, -0.32);
      eq.add(saddle);
      const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.98, 8), anodizedBronzeDarkMat);
      handleStem.position.set(0, 0.62, 0.32);
      handleStem.rotation.x = -0.22;
      eq.add(handleStem);
      const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8), brushedStainlessMat);
      handleBar.rotation.z = Math.PI / 2;
      handleBar.position.set(0, 1.08, 0.20);
      eq.add(handleBar);
    }

    gymOutdoorGroup.add(eq);
  };

  let stationIdx = 0;
  for (let gx = 0; gx < 2; gx++) {
    for (let gz = 0; gz < 3; gz++) {
      buildFitnessStation(stationIdx++, -4.4 + gx * 2.25, -2.15 + gz * 2.15);
    }
  }

  // Pergolado arquitetônico em madeira Cumaru com sapatas metálicas, caibros arqueados e lounge em L
  const pergola = new THREE.Group();
  pergola.position.set(2.4, 0.08, 0.2);
  const pergW = 4.6;
  const pergD = 5.1;
  const pergH = 2.95;

  const pergBaseBorder = new THREE.Mesh(new THREE.BoxGeometry(pergW + 0.7, 0.12, pergD + 0.7), travertineCopingMat);
  pergBaseBorder.position.y = 0.06;
  pergBaseBorder.receiveShadow = true;
  pergola.add(pergBaseBorder);

  const pergDeck = new THREE.Mesh(new THREE.BoxGeometry(pergW + 0.4, 0.16, pergD + 0.4), mats.woodDeck);
  pergDeck.position.y = 0.08;
  pergDeck.receiveShadow = true;
  pergola.add(pergDeck);

  for (const px of [-pergW * 0.45, pergW * 0.45]) {
    for (const pz of [-pergD * 0.45, 0, pergD * 0.45]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.28), anodizedBronzeDarkMat);
      shoe.position.set(px, 0.21, pz);
      pergola.add(shoe);

      const col = new THREE.Mesh(new THREE.BoxGeometry(0.22, pergH - 0.1, 0.22), woodTimberMat);
      col.position.set(px, pergH * 0.5 + 0.08, pz);
      pergola.add(col);
    }
  }

  for (const px of [-pergW * 0.45, pergW * 0.45]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, pergD + 0.5), woodTimberMat);
    beam.position.set(px, pergH + 0.06, 0);
    pergola.add(beam);
  }
  for (const pz of [-pergD * 0.45, pergD * 0.45]) {
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(pergW + 0.5, 0.24, 0.20), woodTimberMat);
    crossBeam.position.set(0, pergH + 0.06, pz);
    pergola.add(crossBeam);
  }

  // Caibros arqueados e trepadeira da imagem do pergolado. A abertura central deixa passar o sol.
  const archHalfW = pergW * 0.57;
  const arch = new THREE.Shape();
  arch.moveTo(-archHalfW, 0);
  arch.quadraticCurveTo(0, 1.30, archHalfW, 0);
  arch.lineTo(archHalfW, 0.14);
  arch.quadraticCurveTo(0, 1.44, -archHalfW, 0.14);
  arch.closePath();
  const rafterGeo = new THREE.ExtrudeGeometry(arch, {
    depth: 0.12, curveSegments: 12, bevelEnabled: false
  });
  const vineGeo = new THREE.IcosahedronGeometry(1, 0);
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xbb5283, roughness: 0.92 });
  for (let i = -6; i <= 6; i++) {
    const z = i * (pergD / 12.2);
    const rafter = new THREE.Mesh(rafterGeo, woodTimberMat);
    rafter.position.set(0, pergH - 0.12, z);
    pergola.add(rafter);
    for (const side of [-1, 1]) {
      const x = side * (1.65 + 0.32 * Math.sin(i * 1.2 + side));
      const y = pergH + 0.09 + 0.65 * (1 - (x / archHalfW) ** 2);
      const leaves = new THREE.Mesh(vineGeo, i % 3 === 0 ? planterGrassMat : planterFoliageMat);
      leaves.scale.set(0.41 + 0.13 * Math.cos(i), 0.15, 0.46);
      leaves.position.set(x, y, z);
      leaves.rotation.y = i + side;
      pergola.add(leaves);
      if ((i + side) % 3 !== 0) {
        const flowers = new THREE.Mesh(vineGeo, blossomMat);
        flowers.scale.set(0.20, 0.11, 0.18);
        flowers.position.set(x - side * 0.18, y + 0.07, z + 0.12);
        pergola.add(flowers);
      }
    }
  }

  // Sofá em L esculpido com braços, almofadas de assento, encosto e almofadas decorativas
  const loungeBaseL = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.28, 0.94), woodTimberMat);
  loungeBaseL.position.set(-0.15, 0.30, -1.35);
  pergola.add(loungeBaseL);
  const loungeBackL = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.46, 0.12), woodTimberMat);
  loungeBackL.position.set(-0.15, 0.62, -1.78);
  pergola.add(loungeBackL);
  const loungeCushL = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.14, 0.80), creamCushionMat);
  loungeCushL.position.set(-0.15, 0.50, -1.31);
  pergola.add(loungeCushL);
  const loungeBackCushL = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.34, 0.16), creamCushionMat);
  loungeBackCushL.position.set(-0.15, 0.72, -1.64);
  loungeBackCushL.rotation.x = 0.14;
  pergola.add(loungeBackCushL);

  const loungeBaseSide = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.28, 2.25), woodTimberMat);
  loungeBaseSide.position.set(0.84, 0.30, -0.2);
  pergola.add(loungeBaseSide);
  const loungeBackSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 2.25), woodTimberMat);
  loungeBackSide.position.set(1.26, 0.62, -0.2);
  pergola.add(loungeBackSide);
  const loungeCushSide = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.14, 2.12), creamCushionMat);
  loungeCushSide.position.set(0.80, 0.50, -0.2);
  pergola.add(loungeCushSide);
  const loungeBackCushSide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 2.08), creamCushionMat);
  loungeBackCushSide.position.set(1.14, 0.72, -0.2);
  loungeBackCushSide.rotation.z = -0.14;
  pergola.add(loungeBackCushSide);

  // Almofadas coloridas de destaque
  const pillowSpecs = [
    [-1.12, 0.70, -1.50, 0.22, terracottaPillowMat],
    [-0.45, 0.70, -1.50, -0.15, sagePillowMat],
    [0.64, 0.70, -1.48, 0.18, terracottaPillowMat],
    [0.98, 0.70, -0.45, 0.15, sagePillowMat],
    [0.98, 0.70,  0.38, -0.18, terracottaPillowMat]
  ];
  for (const [px, py, pz, ry, pmat] of pillowSpecs) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.11), pmat);
    pil.position.set(px, py, pz);
    pil.rotation.set(-0.22, ry, 0);
    pergola.add(pil);
  }

  // Mesa de centro ripada com bandeja em travertino e vaso decorativo
  const coffeeTbl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.48, 0.26, 24), woodTimberMat);
  coffeeTbl.position.set(-0.34, 0.29, 0.22);
  pergola.add(coffeeTbl);
  const coffeeTray = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.04, 24), travertineCopingMat);
  coffeeTray.position.set(-0.34, 0.44, 0.22);
  pergola.add(coffeeTray);
  const coffeeBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.12, 12), planterFoliageMat);
  coffeeBowl.position.set(-0.34, 0.50, 0.22);
  pergola.add(coffeeBowl);

  // Luminária linear sob a longarina oeste.
  const pergGlow = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 3.0), warmGlowSoftMat);
  pergGlow.position.set(-pergW * 0.45, pergH - 0.09, 0);
  pergola.add(pergGlow);

  const pergHalo = new THREE.Mesh(subtleHaloGeo, floorLightSubtleMat);
  pergHalo.position.set(0, 0.17, 0);
  pergHalo.scale.setScalar(1.35);
  pergola.add(pergHalo);
  nightLightObjects.push(pergGlow, pergHalo);

  gymOutdoorGroup.add(pergola);

  // ========================================================================
  // 7. SETOR ⑤ — SALÃO DE FESTAS / ESPAÇO GOURMET & TERRAÇO (PAVILHÃO DE LUXO)
  // ========================================================================
  const salaoGroup = new THREE.Group();
  salaoGroup.position.set(36.2, BASE_Y, 4.2);
  root.add(salaoGroup);

  const sw = 13.4;
  const sd = 23.6;
  const sh = 4.65;

  const salaoPlinth = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.5, 0.18, sd + 0.5), travertineCopingMat);
  salaoPlinth.position.y = 0.09;
  salaoPlinth.receiveShadow = true;
  salaoGroup.add(salaoPlinth);

  const salaoFloor = new THREE.Mesh(
    new THREE.BoxGeometry(sw, 0.22, sd),
    new THREE.MeshStandardMaterial({ color: 0xe6dccd, roughness: 0.36, metalness: 0.02 })
  );
  salaoFloor.position.y = 0.12;
  salaoFloor.receiveShadow = true;
  salaoGroup.add(salaoFloor);

  const northWingFloor = new THREE.Mesh(
    new THREE.BoxGeometry(sw * 0.96, 0.24, sd * 0.33),
    new THREE.MeshStandardMaterial({ color: 0xd4cdc5, roughness: 0.42 })
  );
  northWingFloor.position.set(0, 0.13, -sd * 0.31);
  salaoGroup.add(northWingFloor);

  const bathWingFloor = new THREE.Mesh(
    new THREE.BoxGeometry(sw * 0.38, 0.25, sd * 0.32),
    new THREE.MeshStandardMaterial({ color: 0xb8c7d1, roughness: 0.34 })
  );
  bathWingFloor.position.set(sw * 0.28, 0.135, -sd * 0.31);
  salaoGroup.add(bathWingFloor);

  const interiorWallMat = mats.wallPureWhite;
  const wallCapDark = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  const intWallH = 2.85;

  function addSalaoWall(wx, wz, ww, wd, mat = interiorWallMat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, intWallH, wd), mat);
    m.position.set(wx, intWallH * 0.5 + 0.2, wz);
    salaoGroup.add(m);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.04, 0.07, wd + 0.04), wallCapDark);
    cap.position.set(wx, intWallH + 0.24, wz);
    salaoGroup.add(cap);
  }

  // Paredes perimetrais sólidas em pedra natural e alvenaria branca + divisórias internas
  addSalaoWall(sw * 0.48, 0, 0.32, sd, stoneCladMat);
  addSalaoWall(0, -sd * 0.48, sw, 0.32, stoneCladMat);
  addSalaoWall(sw * 0.26, sd * 0.48, sw * 0.44, 0.32, stoneCladMat);
  addSalaoWall(0, -sd * 0.14, sw * 0.95, 0.22);
  addSalaoWall(0.85, -sd * 0.31, 0.22, sd * 0.34);
  addSalaoWall(sw * 0.28, -sd * 0.31, sw * 0.38, 0.18);

  // Ala Norte: Academia coberta + Lounge + Sanitários com bancadas e cubas
  // Banco inclinado e piso de borracha ao lado das esteiras, como na passagem pela academia.
  const trainingMat = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.045, 2.72), mats.wallDarkSlate);
  trainingMat.position.set(-1.36, 0.285, -sd * 0.21);
  salaoGroup.add(trainingMat);
  const bench = new THREE.Group();
  bench.position.set(-1.36, 0.31, -sd * 0.21);
  for (const z of [-0.48, 0.51]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.09, 0.16), anodizedBronzeDarkMat);
    foot.position.set(0, 0.045, z);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.33, 0.12), brushedStainlessMat);
    leg.position.set(0, 0.21, z);
    bench.add(foot, leg);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 1.45), anodizedBronzeDarkMat);
  frame.position.y = 0.39;
  const seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.10, 0.46), charcoalUpholsteryMat);
  seatPad.position.set(0, 0.48, 0.46);
  const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.10, 1.03), charcoalUpholsteryMat);
  backPad.rotation.x = Math.PI / 7;
  backPad.position.set(0, 0.72, -0.26);
  bench.add(frame, seatPad, backPad);
  salaoGroup.add(bench);

  const loungeRugN = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.04, 2.7), warmLinenMat);
  loungeRugN.position.set(-sw * 0.22, 0.26, -sd * 0.28);
  salaoGroup.add(loungeRugN);

  const loungeSofaN = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 1.35), charcoalUpholsteryMat);
  loungeSofaN.position.set(-sw * 0.22, 0.48, -sd * 0.28);
  salaoGroup.add(loungeSofaN);

  for (let ti = 0; ti < 3; ti++) {
    const tm = new THREE.Group();
    tm.position.set(-sw * 0.36 + ti * 1.45, 0.26, -sd * 0.41);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 1.55), mats.wallDarkSlate);
    tm.add(belt);
    const consolePost = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.16), anodizedBronzeDarkMat);
    consolePost.position.set(0, 0.52, -0.65);
    consolePost.rotation.x = 0.22;
    tm.add(consolePost);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.04), screenCyanGlowMat);
    screen.position.set(0, 1.02, -0.52);
    tm.add(screen);
    salaoGroup.add(tm);
  }

  for (const bz of [-sd * 0.38, -sd * 0.24]) {
    const vanityTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.10, 0.54), travertineCopingMat);
    vanityTop.position.set(sw * 0.28, 0.88, bz);
    salaoGroup.add(vanityTop);
    for (const bx of [-0.55, 0.55]) {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.10, 12), mats.wallPureWhite);
      basin.position.set(sw * 0.28 + bx, 0.96, bz);
      salaoGroup.add(basin);
    }
  }

  // Salão Principal: 4 mesas redondas completas com toalhas, arranjos e 6 cadeiras
  for (const tz of [-0.6, 2.9, 6.4, 9.7]) {
    const tblPed = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.34, 0.74, 14), anodizedBronzeDarkMat);
    tblPed.position.set(-sw * 0.23, 0.56, tz);
    salaoGroup.add(tblPed);

    const rTable = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.08, 24), travertineCopingMat);
    rTable.position.set(-sw * 0.23, 0.92, tz);
    salaoGroup.add(rTable);

    const centerpiece = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.14, 12), travertineCopingMat);
    centerpiece.position.set(-sw * 0.23, 1.03, tz);
    salaoGroup.add(centerpiece);
    const flowerCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), planterFoliageMat);
    flowerCrown.position.set(-sw * 0.23, 1.18, tz);
    salaoGroup.add(flowerCrown);

    for (let c = 0; c < 6; c++) {
      const ang = (c * Math.PI) / 3;
      const ch = new THREE.Group();
      ch.position.set(-sw * 0.23 + Math.cos(ang) * 1.56, 0.22, tz + Math.sin(ang) * 1.56);
      ch.rotation.y = -ang;
      const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.44), creamCushionMat);
      cSeat.position.y = 0.44;
      ch.add(cSeat);
      const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.46, 0.46), creamCushionMat);
      cBack.position.set(0.19, 0.68, 0);
      ch.add(cBack);
      const cBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.18, 0.42, 8), anodizedBronzeDarkMat);
      cBase.position.y = 0.21;
      ch.add(cBase);
      salaoGroup.add(ch);
    }
  }

  // Mesa de banquete executiva em mármore/travertino com 10 cadeiras
  const banquetTable = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.09, 6.8), travertineCopingMat);
  banquetTable.position.set(sw * 0.22, 0.94, 5.6);
  salaoGroup.add(banquetTable);
  for (const lz of [-2.4, 2.4]) {
    const trestle = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.72, 0.18), woodTimberMat);
    trestle.position.set(sw * 0.22, 0.56, 5.6 + lz);
    salaoGroup.add(trestle);
  }
  const runner = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 6.2), terracottaPillowMat);
  runner.position.set(sw * 0.22, 0.995, 5.6);
  salaoGroup.add(runner);
  for (const cz of [-1.8, 0, 1.8]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.14, 0.16, 12), planterFoliageMat);
    bowl.position.set(sw * 0.22, 1.08, 5.6 + cz);
    salaoGroup.add(bowl);
  }

  for (let rz = -2.4; rz <= 2.4; rz += 1.6) {
    for (const sideX of [-1.42, 1.42]) {
      const bChair = new THREE.Group();
      bChair.position.set(sw * 0.22 + sideX, 0.22, 5.6 + rz);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.44), creamCushionMat);
      seat.position.y = 0.44;
      bChair.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.44), woodTimberMat);
      back.position.set(Math.sign(sideX) * 0.19, 0.68, 0);
      bChair.add(back);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.40, 0.36), anodizedBronzeDarkMat);
      ped.position.y = 0.20;
      bChair.add(ped);
      salaoGroup.add(bChair);
    }
  }

  // Bar Gourmet detalhado com prateleira traseira retroiluminada, bancada cascata e banquetas
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.96, 1.08), woodTimberMat);
  barCounter.position.set(sw * 0.21, 0.69, -0.4);
  salaoGroup.add(barCounter);
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(4.56, 0.09, 1.24), travertineCopingMat);
  barTop.position.set(sw * 0.21, 1.20, -0.4);
  salaoGroup.add(barTop);
  const barTap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 8), brushedStainlessMat);
  barTap.position.set(sw * 0.21 - 1.1, 1.42, -0.4);
  salaoGroup.add(barTap);

  // Estante retroiluminada atrás do bar (na parede norte do salão z = -sd*0.14 + 0.22)
  const backBarUnit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.35, 0.34), anodizedBronzeDarkMat);
  backBarUnit.position.set(sw * 0.21, 1.40, -sd * 0.14 + 0.28);
  salaoGroup.add(backBarUnit);
  const backBarLightPanel = new THREE.Mesh(new THREE.BoxGeometry(3.85, 1.95, 0.05), warmGlowSoftMat);
  backBarLightPanel.position.set(sw * 0.21, 1.48, -sd * 0.14 + 0.44);
  salaoGroup.add(backBarLightPanel);
  nightLightObjects.push(backBarLightPanel);
  for (const sy of [1.10, 1.62, 2.12]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.92, 0.05, 0.28), woodTimberMat);
    shelf.position.set(sw * 0.21, sy, -sd * 0.14 + 0.42);
    salaoGroup.add(shelf);
  }

  for (let bx = -1.5; bx <= 1.5; bx += 1.0) {
    const stoolPed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.18, 0.68, 10), anodizedBronzeDarkMat);
    stoolPed.position.set(sw * 0.21 + bx, 0.56, 0.46);
    salaoGroup.add(stoolPed);
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.09, 14), terracottaPillowMat);
    stoolSeat.position.set(sw * 0.21 + bx, 0.92, 0.46);
    salaoGroup.add(stoolSeat);
  }

  // Fachadas cortina de vidro refletivas (MeshPhysicalMaterial) + pilares madeira + montantes
  const glassWest = new THREE.Mesh(new THREE.BoxGeometry(0.10, sh - 0.35, sd * 0.96), pavilionGlassMat);
  glassWest.position.set(-sw * 0.48, sh * 0.5, 0);
  salaoGroup.add(glassWest);

  const glassSouth = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.54, sh - 0.35, 0.10), pavilionGlassMat);
  glassSouth.position.set(-sw * 0.21, sh * 0.5, sd * 0.48);
  salaoGroup.add(glassSouth);

  for (let pz = -sd * 0.46; pz <= sd * 0.46; pz += sd * 0.184) {
    const woodCol = new THREE.Mesh(new THREE.BoxGeometry(0.32, sh - 0.18, 0.32), woodTimberMat);
    woodCol.position.set(-sw * 0.48, sh * 0.5, pz);
    salaoGroup.add(woodCol);
    const colShoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), anodizedBronzeDarkMat);
    colShoe.position.set(-sw * 0.48, 0.25, pz);
    salaoGroup.add(colShoe);
  }
  for (let mz = -sd * 0.45; mz <= sd * 0.45; mz += 2.15) {
    const mullionW = new THREE.Mesh(new THREE.BoxGeometry(0.18, sh - 0.3, 0.075), anodizedBronzeDarkMat);
    mullionW.position.set(-sw * 0.48, sh * 0.5, mz);
    salaoGroup.add(mullionW);
  }
  for (const hy of [2.55, sh - 0.32]) {
    const transomW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.075, sd * 0.96), anodizedBronzeDarkMat);
    transomW.position.set(-sw * 0.48, hy, 0);
    salaoGroup.add(transomW);
  }
  for (let mx = -sw * 0.46; mx <= sw * 0.04; mx += 2.15) {
    const mullionS = new THREE.Mesh(new THREE.BoxGeometry(0.075, sh - 0.3, 0.18), anodizedBronzeDarkMat);
    mullionS.position.set(mx, sh * 0.5, sd * 0.48);
    salaoGroup.add(mullionS);
  }

  // Puxadores em aço inox das portas duplas de acesso ao terraço
  for (const dz of [2.15, 2.65]) {
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.35, 8), brushedStainlessMat);
    pull.position.set(-sw * 0.48 - 0.08, 1.32, dz);
    salaoGroup.add(pull);
  }

  // Cobertura removível (salaoRoofGroups): laje em balanço, filete fino escuro (~0.15m), forro ripado 3D, lustres e brises
  const salaoRoof = new THREE.Group();
  const mainSlab = new THREE.Mesh(new THREE.BoxGeometry(sw + 2.2, 0.52, sd + 2.2), mats.wallPureWhite);
  mainSlab.position.set(0, sh + 0.16, 0);
  salaoRoof.add(mainSlab);

  const roofFasciaTrim = new THREE.Mesh(new THREE.BoxGeometry(sw + 2.28, 0.10, sd + 2.28), anodizedBronzeDarkMat);
  roofFasciaTrim.position.set(0, sh + 0.41, 0);
  salaoRoof.add(roofFasciaTrim);

  // Forro ripado 3D na área externa do beiral e interior do salão
  const roofSoffitBase = new THREE.Mesh(new THREE.BoxGeometry(sw + 1.8, 0.06, sd + 1.8), warmLinenMat);
  roofSoffitBase.position.set(0, sh - 0.11, 0);
  salaoRoof.add(roofSoffitBase);
  for (let sz = -sd * 0.52; sz <= sd * 0.52; sz += 0.65) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(sw + 1.75, 0.06, 0.18), woodTimberMat);
    slat.position.set(0, sh - 0.16, sz);
    salaoRoof.add(slat);
  }

  // Laje superior clara alargada deixando apenas ~0.15m de filete metálico escuro na borda
  const roofRecess = new THREE.Mesh(new THREE.BoxGeometry(sw + 1.98, 0.56, sd + 1.98), roofDeckLightMat);
  roofRecess.position.set(0, sh + 0.20, 0);
  salaoRoof.add(roofRecess);

  const eastPenthouse = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.32, sd * 0.54), mats.wallPureWhite);
  eastPenthouse.position.set(sw * 0.31, sh + 0.88, 0.8);
  salaoRoof.add(eastPenthouse);

  const eastPenthouseCap = new THREE.Mesh(new THREE.BoxGeometry(4.12, 0.08, sd * 0.54 + 0.12), travertineCopingMat);
  eastPenthouseCap.position.set(sw * 0.31, sh + 1.56, 0.8);
  salaoRoof.add(eastPenthouseCap);

  // Brises metálicos na platibanda técnica superior
  for (let lz = -sd * 0.22; lz <= sd * 0.22; lz += 0.45) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.08), anodizedBronzeDarkMat);
    louver.position.set(sw * 0.31 - 2.02, sh + 0.92, 0.8 + lz);
    salaoRoof.add(louver);
  }

  // 3 Lustres circulares arquitetônicos pendentes dentro do Salão (ocultam junto com salaoRoof no modo Planta!)
  for (const cz of [0.2, 4.2, 8.2]) {
    const chRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.045, 8, 28), anodizedBronzeDarkMat);
    chRing.rotation.x = Math.PI / 2;
    chRing.position.set(-sw * 0.20, sh - 1.05, cz);
    salaoRoof.add(chRing);
    const chGlow = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.032, 6, 28), warmGlowSoftMat);
    chGlow.rotation.x = Math.PI / 2;
    chGlow.position.set(-sw * 0.20, sh - 1.08, cz);
    salaoRoof.add(chGlow);
    const chRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), anodizedBronzeDarkMat);
    chRod.position.set(-sw * 0.20, sh - 0.58, cz);
    salaoRoof.add(chRod);
    nightLightObjects.push(chGlow);
  }
  for (const gx of [-1.2, 0, 1.2]) {
    const pendCord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.15, 6), anodizedBronzeDarkMat);
    pendCord.position.set(sw * 0.21 + gx, sh - 0.72, -0.4);
    salaoRoof.add(pendCord);
    const pendBulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), warmGlowSoftMat);
    pendBulb.position.set(sw * 0.21 + gx, sh - 1.32, -0.4);
    salaoRoof.add(pendBulb);
    nightLightObjects.push(pendBulb);
  }

  salaoGroup.add(salaoRoof);
  salaoRoofGroups.push(salaoRoof);

  // Terraço Oeste em pedra travertino (z_local [-3.4..10.2] livre dos arbustos norte/sul!)
  const terracePatio = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.14, 13.6), travertinePaverMat);
  terracePatio.position.set(-sw * 0.5 - 2.65, 0.07, 3.4);
  terracePatio.receiveShadow = true;
  salaoGroup.add(terracePatio);

  const terraceCurb = new THREE.Mesh(new THREE.BoxGeometry(5.68, 0.12, 13.78), graniteCurbMat);
  terraceCurb.position.set(-sw * 0.5 - 2.65, 0.05, 3.4);
  salaoGroup.add(terraceCurb);

  createParasolSet(-sw * 0.5 - 2.65, -1.3, salaoGroup);
  createParasolSet(-sw * 0.5 - 2.65,  3.3, salaoGroup);
  createParasolSet(-sw * 0.5 - 2.65,  7.9, salaoGroup);

  for (const pz of [-3.0, 1.0, 5.6, 9.6]) {
    addSquarePlanter(salaoGroup, -sw * 0.5 - 4.95, 0.14, pz, 0.78, 0.44);
  }

  // ========================================================================
  // 8. SETOR ⑥ — AS 6 CASAS TÉRREAS (FACHADA EM VIDRO RECUADO FÍSICO,
  //    PEDRA E RIPADO 3D, MARQUISE EM BALANÇO, DEGRAUS E PILARES REFINADOS)
  // ========================================================================
  const suiteWoodFloorMat = new THREE.MeshStandardMaterial({ color: 0xc9a679, roughness: 0.52 });
  const livingPorcFloorMat = new THREE.MeshStandardMaterial({ color: 0xdfd3c3, roughness: 0.45 });
  const kitchenTileFloorMat = new THREE.MeshStandardMaterial({ color: 0xc7beb5, roughness: 0.48 });
  const bathBlueTileMat = new THREE.MeshStandardMaterial({ color: 0xb8c7d1, roughness: 0.38 });
  const bedSheetWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
  const blanketWarmMat = new THREE.MeshStandardMaterial({ color: 0xb4845c, roughness: 0.58 });
  const sofaTaupeMat = new THREE.MeshStandardMaterial({ color: 0x8b95a5, roughness: 0.62 });
  const hedgeGreenMat = new THREE.MeshStandardMaterial({ color: 0x3b6e1c, roughness: 0.86 });

  for (const casa of CASAS_CONFIG) {
    const cg = new THREE.Group();
    cg.position.set(casa.x, BASE_Y, casa.z);
    root.add(cg);

    const kW = casa.width;
    const kD = casa.depth;
    const kH = 3.42;
    const ds = casa.doorSide;

    // Pisos internos fiéis à Planta Humanizada
    const bedroomsFloor = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.92, 0.16, kD * 0.46), suiteWoodFloorMat);
    bedroomsFloor.position.set(0, 0.08, -kD * 0.22);
    bedroomsFloor.receiveShadow = true;
    cg.add(bedroomsFloor);

    const livingFloor = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.92, 0.16, kD * 0.46), livingPorcFloorMat);
    livingFloor.position.set(0, 0.08, kD * 0.20);
    livingFloor.receiveShadow = true;
    cg.add(livingFloor);

    const bathFloor = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.38, 0.18, kD * 0.22), bathBlueTileMat);
    bathFloor.position.set(-ds * (kW * 0.25), 0.09, 0.05);
    cg.add(bathFloor);

    const kitchenFloor = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.42, 0.18, kD * 0.26), kitchenTileFloorMat);
    kitchenFloor.position.set(ds * (kW * 0.23), 0.09, 0.12);
    cg.add(kitchenFloor);

    // Passarela de entrada em travertino + degraus flutuantes até a porta pivotante
    const entryWalk = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.10, 3.65), travertinePaverMat);
    entryWalk.position.set(ds * (kW * 0.275), 0.05, kD * 0.46);
    entryWalk.receiveShadow = true;
    cg.add(entryWalk);

    const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.56), travertineCopingMat);
    step1.position.set(ds * (kW * 0.275), 0.11, kD * 0.36);
    cg.add(step1);
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.52), travertineCopingMat);
    step2.position.set(ds * (kW * 0.275), 0.17, kD * 0.30);
    cg.add(step2);

    // Mureta baixa em granito delimitando o jardim frontal da janela (livre dos arbustos de landscapingBuilder)
    const frontBedCurb = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.52, 0.12, 0.12), graniteCurbMat);
    frontBedCurb.position.set(-ds * (kW * 0.18), 0.06, kD * 0.56 + 0.55);
    cg.add(frontBedCurb);

    const cWallH = 2.84;
    const addCasaWall = (wx, wz, ww, wd, mat = mats.wallWhite, h = cWallH, yBase = 0.12, withCap = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, h, wd), mat);
      m.position.set(wx, h * 0.5 + yBase, wz);
      cg.add(m);
      if (withCap) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.03, 0.065, wd + 0.03), wallCapDark);
        cap.position.set(wx, yBase + h + 0.03, wz);
        cg.add(cap);
      }
    };

    // Paredes externas e divisórias internas
    addCasaWall(0, -kD * 0.44, kW * 0.94, 0.24, mats.wallPureWhite);
    addCasaWall(-kW * 0.46, 0, 0.24, kD * 0.90, mats.wallPureWhite);
    addCasaWall(kW * 0.46, 0, 0.24, kD * 0.90, mats.wallPureWhite);

    // Parede frontal da sala COM ABERTURA REAL para janela de correr envidraçada
    const winCenterX = -ds * (kW * 0.18);
    const frontZ = kD * 0.42;
    addCasaWall(-ds * 3.26, frontZ, 0.92, 0.26, mats.wallPureWhite);
    addCasaWall(ds * 0.36, frontZ, 0.78, 0.26, mats.wallPureWhite);
    // Peitoril + verga da abertura da sala
    addCasaWall(winCenterX, frontZ, 2.86, 0.26, mats.wallPureWhite, 0.38, 0.12, false);
    addCasaWall(winCenterX, frontZ, 2.86, 0.26, mats.wallPureWhite, 0.50, 2.46, true);
    const winSill = new THREE.Mesh(new THREE.BoxGeometry(2.90, 0.06, 0.34), travertineCopingMat);
    winSill.position.set(winCenterX, 0.52, frontZ + 0.02);
    cg.add(winSill);

    // Pórtico arquitetônico projetado emoldurando a janela frontal
    for (const sx of [-1.48, 1.48]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.26, 0.38), mats.wallPureWhite);
      cheek.position.set(winCenterX + sx, 1.62, frontZ + 0.14);
      cg.add(cheek);
    }
    const winBrow = new THREE.Mesh(new THREE.BoxGeometry(3.16, 0.14, 0.42), mats.wallPureWhite);
    winBrow.position.set(winCenterX, 2.72, frontZ + 0.16);
    cg.add(winBrow);

    // Esquadria recuada em alumínio escuro + vidro refletivo físico (olhando para a sala 3D!)
    const slidingGlass = new THREE.Mesh(new THREE.BoxGeometry(2.74, 1.90, 0.04), archGlassReflectiveMat);
    slidingGlass.position.set(winCenterX, 1.48, frontZ - 0.02);
    cg.add(slidingGlass);
    for (const mx of [-1.36, -0.45, 0.45, 1.36]) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.94, 0.08), anodizedBronzeDarkMat);
      stile.position.set(winCenterX + mx, 1.48, frontZ - 0.02);
      cg.add(stile);
    }
    for (const my of [0.54, 2.44]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(2.80, 0.055, 0.09), anodizedBronzeDarkMat);
      track.position.set(winCenterX, my, frontZ - 0.02);
      cg.add(track);
    }
    // Cortinas translúcidas laterais dentro da sala (profundidade visual através do vidro!)
    for (const cx of [-1.14, 1.14]) {
      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.88, 0.08), warmLinenMat);
      drape.position.set(winCenterX + cx, 1.48, frontZ - 0.20);
      cg.add(drape);
    }

    // Hall recuado de entrada: parede revestida em pedra natural + painel ripado 3D + porta pivotante
    const alcoveZ = kD * 0.27;
    addCasaWall(ds * (kW * 0.28), alcoveZ, kW * 0.38, 0.26, stoneCladMat);
    addCasaWall(ds * (kW * 0.09), kD * 0.345, 0.22, kD * 0.16, mats.wallPureWhite);

    // Ripado 3D lateral no recuo da porta
    const ripadoBacking = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.52, 0.96), anodizedBronzeDarkMat);
    ripadoBacking.position.set(ds * (kW * 0.09 + 0.12 * ds) - ds * 0.02, 1.42, kD * 0.345);
    cg.add(ripadoBacking);
    for (let rz = -0.38; rz <= 0.38; rz += 0.13) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.52, 0.055), woodTimberMat);
      slat.position.set(ds * (kW * 0.108), 1.42, kD * 0.345 + rz);
      cg.add(slat);
    }

    // Porta pivotante em madeira Cumaru + puxador vertical longo em aço inox
    const doorX = ds * (kW * 0.275);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.30, 2.38, 0.30), anodizedBronzeDarkMat);
    doorFrame.position.set(doorX, 1.31, alcoveZ);
    cg.add(doorFrame);
    const houseDoor = new THREE.Mesh(new THREE.BoxGeometry(1.16, 2.30, 0.32), woodTimberMat);
    houseDoor.position.set(doorX, 1.28, alcoveZ);
    cg.add(houseDoor);
    const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.35, 8), brushedStainlessMat);
    doorHandle.position.set(doorX - ds * 0.38, 1.32, alcoveZ + 0.19);
    cg.add(doorHandle);

    // Divisórias internas dos quartos, banheiro e sala
    addCasaWall(0, -0.04, kW * 0.90, 0.16, mats.wallPureWhite);
    addCasaWall(0, -kD * 0.24, 0.16, kD * 0.40, mats.wallPureWhite);
    addCasaWall(-ds * (kW * 0.24), 0.85, kW * 0.42, 0.14, mats.wallPureWhite);

    // Mobiliário interno 3D completo (quartos, banheiro, cozinha e living visível pela janela)
    for (const sideFactor of [-1, 1]) {
      const bx = sideFactor * (kW * 0.23);
      const bz = -kD * 0.27;
      const bedBase = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.38, 1.82), bedSheetWhiteMat);
      bedBase.position.set(bx, 0.34, bz);
      cg.add(bedBase);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.50, 0.40, 0.72), blanketWarmMat);
      blanket.position.set(bx, 0.35, bz + 0.48);
      cg.add(blanket);
      for (const px of [-0.36, 0.36]) {
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.34), bedSheetWhiteMat);
        pillow.position.set(bx + px, 0.56, bz - 0.62);
        cg.add(pillow);
      }
      const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), woodTimberMat);
      nightstand.position.set(bx + sideFactor * 0.95, 0.36, bz - 0.62);
      cg.add(nightstand);
    }

    const vanity = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.45), travertineCopingMat);
    vanity.position.set(-ds * (kW * 0.34), 0.42, 0.35);
    cg.add(vanity);

    const cRug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 1.68), warmLinenMat);
    cRug.position.set(winCenterX, 0.18, kD * 0.22);
    cg.add(cRug);

    // Sofá de living detalhado + almofadas + mesa de centro (visível através do vidro frontal)
    const cSofa = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.38, 0.84), sofaTaupeMat);
    cSofa.position.set(winCenterX, 0.35, kD * 0.16);
    cg.add(cSofa);
    const cSofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.42, 0.18), sofaTaupeMat);
    cSofaBack.position.set(winCenterX, 0.60, kD * 0.16 - 0.33);
    cg.add(cSofaBack);
    for (const px of [-0.62, 0.62]) {
      const sPil = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.12), terracottaPillowMat);
      sPil.position.set(winCenterX + px, 0.62, kD * 0.16 - 0.18);
      cg.add(sPil);
    }
    const cCoffeeTbl = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.52), woodTimberMat);
    cCoffeeTbl.position.set(winCenterX, 0.28, kD * 0.27);
    cg.add(cCoffeeTbl);

    const diningTbl = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.52, 1.15), woodTimberMat);
    diningTbl.position.set(ds * (kW * 0.18), 0.42, kD * 0.11);
    cg.add(diningTbl);

    const kitchenCounter = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.65, 0.58), mats.wallCharcoal);
    kitchenCounter.position.set(ds * (kW * 0.24), 0.48, 0.22);
    cg.add(kitchenCounter);
    const kitchenTop = new THREE.Mesh(new THREE.BoxGeometry(1.90, 0.06, 0.62), travertineCopingMat);
    kitchenTop.position.set(ds * (kW * 0.24), 0.82, 0.22);
    cg.add(kitchenTop);

    // Painéis internos dos cômodos (suíte enquadrada em 1 quarto para não cruzar parede central)
    {
      const pid = `CS-0${casa.num}`;
      const backInnerZ = -kD * 0.44 + 0.12 + 0.012;
      addInteriorRoomPanel(cg, comodoUrl(pid, 'suite'), kW * 0.32, 1.25, -ds * (kW * 0.23), 1.72, backInnerZ, 0, anodizedBronzeDarkMat);
      addInteriorRoomPanel(cg, comodoUrl(pid, 'cozinha'), kD * 0.30, 1.25, ds * (kW * 0.46 - 0.12 - 0.012), 1.72, kD * 0.2, ds > 0 ? -Math.PI / 2 : Math.PI / 2, anodizedBronzeDarkMat);
      addInteriorRoomPanel(cg, comodoUrl(pid, 'banheiro'), kD * 0.30, 1.25, -ds * (kW * 0.46 - 0.12 - 0.012), 1.72, kD * 0.2, ds > 0 ? Math.PI / 2 : -Math.PI / 2, anodizedBronzeDarkMat);
    }

    // Cobertura removível (casaRoofGroups): platibanda contínua sem fresta + reservatório + marquise
    const cRoof = new THREE.Group();
    const flatSlab = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.96, 0.44, kD * 0.92), mats.roofSlabGrey);
    flatSlab.position.set(0, kH - 0.21, 0);
    cRoof.add(flatSlab);

    const paraFront = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.99, 0.84, 0.26), mats.wallPureWhite);
    paraFront.position.set(0, kH - 0.03, kD * 0.45);
    cRoof.add(paraFront);

    const paraBack = paraFront.clone();
    paraBack.position.z = -kD * 0.45;
    cRoof.add(paraBack);

    const paraL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.84, kD * 0.92), mats.wallPureWhite);
    paraL.position.set(-kW * 0.48, kH - 0.03, 0);
    cRoof.add(paraL);

    const paraR = paraL.clone();
    paraR.position.x = kW * 0.48;
    cRoof.add(paraR);

    const waterBox = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.40, 0.88, kD * 0.38), mats.roofSlabGrey);
    waterBox.position.set(ds * (kW * 0.20), kH + 0.44, -kD * 0.06);
    cRoof.add(waterBox);

    const waterBoxCap = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.42, 0.08, kD * 0.40), travertineCopingMat);
    waterBoxCap.position.set(ds * (kW * 0.20), kH + 0.90, -kD * 0.06);
    cRoof.add(waterBoxCap);

    // Marquise da entrada em balanço com forro em madeira e 2 spots quentes embutidos
    const entryCanopy = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.16, 1.52), anodizedBronzeDarkMat);
    entryCanopy.position.set(doorX, 2.74, kD * 0.35);
    cRoof.add(entryCanopy);
    const entryCanopyWood = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.05, 1.36), woodTimberMat);
    entryCanopyWood.position.set(doorX, 2.64, kD * 0.35);
    cRoof.add(entryCanopyWood);
    for (const sx of [-0.55, 0.55]) {
      const porchSpot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), warmGlowSoftMat);
      porchSpot.position.set(doorX + sx, 2.61, kD * 0.36);
      cRoof.add(porchSpot);
      nightLightObjects.push(porchSpot);
    }

    // Sanca quente sutil no teto da sala (dá profundidade acolhedora vista através do vidro!)
    const livingCoveGlow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.38), warmGlowSoftMat);
    livingCoveGlow.position.set(winCenterX, kH - 0.33, kD * 0.26);
    cRoof.add(livingCoveGlow);
    nightLightObjects.push(livingCoveGlow);

    cg.add(cRoof);
    casaRoofGroups.push(cRoof);

    // Gradil frontal transparente real (sem placa cinza atrás) + portão de pedestre + pilares esculturais
    const fenceZ = kD * 0.5 + 1.55;
    for (const ry of [0.18, 1.36]) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.92, 0.055, 0.08), anodizedBronzeDarkMat);
      hBar.position.set(0, ry, fenceZ);
      cg.add(hBar);
    }
    for (let bx = -kW * 0.40; bx <= kW * 0.40; bx += 0.24) {
      const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.24, 6), anodizedBronzeDarkMat);
      picket.position.set(bx, 0.76, fenceZ);
      cg.add(picket);
    }

    // Montantes do portão de acesso alinhados à passarela
    for (const gx of [-0.66, 0.66]) {
      const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.48, 0.09), anodizedBronzeDarkMat);
      gatePost.position.set(doorX + gx, 0.74, fenceZ);
      cg.add(gatePost);
    }

    // Pilares frontais em alvenaria + base/filete em pedra + arandela arquitetônica up/down sutil
    for (const px of [-kW * 0.46, kW * 0.46]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.84, 0.50), mats.wallWhite);
      pillar.position.set(px, 0.92, fenceZ);
      cg.add(pillar);

      const pillarStone = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.62, 0.54), stoneCladMat);
      pillarStone.position.set(px, 0.31, fenceZ);
      cg.add(pillarStone);

      const pillarCap = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.09, 0.58), travertineCopingMat);
      pillarCap.position.set(px, 1.88, fenceZ);
      cg.add(pillarCap);

      // Arandela arquitetônica dupla (up/down) em bronze escuro + lentes foscas suaves (sem cone triangular gigante!)
      const sconceBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.30, 0.12), anodizedBronzeDarkMat);
      sconceBody.position.set(px, 1.44, fenceZ + 0.28);
      cg.add(sconceBody);

      for (const ly of [1.59, 1.29]) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.09), warmGlowSoftMat);
        lens.position.set(px, ly, fenceZ + 0.28);
        cg.add(lens);
        nightLightObjects.push(lens);
      }

      const wallWash = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.72), wallWashSubtleMat);
      wallWash.position.set(px, 1.38, fenceZ + 0.265);
      cg.add(wallWash);
      nightLightObjects.push(wallWash);
    }

    // Floreira frontal em granito com sebe escalonada (entre pilar esquerdo e portão, sem obstruir pilares)
    const hedgePlanterCurb = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.50, 0.14, 0.48), graniteCurbMat);
    hedgePlanterCurb.position.set(-ds * (kW * 0.11), 0.07, fenceZ + 0.28);
    cg.add(hedgePlanterCurb);

    const hedgeMain = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.47, 0.36, 0.38), hedgeGreenMat);
    hedgeMain.position.set(-ds * (kW * 0.11), 0.24, fenceZ + 0.28);
    cg.add(hedgeMain);

    const hedgeCrown = new THREE.Mesh(new THREE.BoxGeometry(kW * 0.45, 0.14, 0.32), planterGrassMat);
    hedgeCrown.position.set(-ds * (kW * 0.11), 0.45, fenceZ + 0.28);
    cg.add(hedgeCrown);
  }

  return {
    casaRoofGroups,
    salaoRoofGroups,
    poolWaterMesh,
    waterUniforms
  };
}
