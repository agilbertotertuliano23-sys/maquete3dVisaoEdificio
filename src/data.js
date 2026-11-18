// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — DADOS ARQUITETÔNICOS, TORRES, CASAS, LAZER,
// PAISAGISMO E UNIDADES (100% CONSISTENTE COM AS PRANCHAS DE REFERÊNCIA)
// ==========================================================================

import { pickPlantaId } from './plantas.js';

export const FLOOR_H = 1.45;
export const BASE_Y = 0.6;

// Configuração exata das 5 Torres Residenciais conforme a Planta Baixa Geral,
// Elevação Frontal e Vista Aérea 3D:
// - Fileira Norte (Fundo): Torre A (Oeste, 18 pav), Torre B (Centro, 15 pav), Torre C (Leste, 18 pav)
// - Fileira Central (Piscina): Torre D (Oeste, 10 pav), Torre E (Leste, 10 pav)
export const TOWERS_CONFIG = [
  {
    id: 'A',
    name: 'Torre A',
    subtitle: 'Torre Residencial Alta — Noroeste',
    category: 'Torre Alta',
    x: -29.0,
    z: -21.5,
    width: 20.4,
    depth: 16.8,
    floors: 18,
    unitsPerFloor: 4,
    areaRange: '118,50 a 161,34 m²',
    dormsLabel: '3 a 4 Quartos (Suítes)',
    roofTop: BASE_Y + 18 * FLOOR_H + 2.8
  },
  {
    id: 'B',
    name: 'Torre B',
    subtitle: 'Torre Residencial Central — Norte',
    category: 'Torre Alta',
    x: 0.0,
    z: -21.5,
    width: 20.4,
    depth: 16.8,
    floors: 15,
    unitsPerFloor: 4,
    areaRange: '110,00 a 148,00 m²',
    dormsLabel: '3 a 4 Quartos (Suítes)',
    roofTop: BASE_Y + 15 * FLOOR_H + 2.8
  },
  {
    id: 'C',
    name: 'Torre C',
    subtitle: 'Torre Residencial Alta — Nordeste',
    category: 'Torre Alta',
    x: 29.0,
    z: -21.5,
    width: 20.4,
    depth: 16.8,
    floors: 18,
    unitsPerFloor: 4,
    areaRange: '118,50 a 161,34 m²',
    dormsLabel: '3 a 4 Quartos (Suítes)',
    roofTop: BASE_Y + 18 * FLOOR_H + 2.8
  },
  {
    id: 'D',
    name: 'Torre D',
    subtitle: 'Torre Média — Boulevard Piscina Oeste',
    category: 'Torre Média',
    x: -16.6,
    z: 1.8,
    width: 18.2,
    depth: 15.6,
    floors: 10,
    unitsPerFloor: 4,
    areaRange: '74,21 a 110,00 m²',
    dormsLabel: '2 a 3 Quartos (Suíte)',
    roofTop: BASE_Y + 10 * FLOOR_H + 2.5
  },
  {
    id: 'E',
    name: 'Torre E',
    subtitle: 'Torre Média — Boulevard Piscina Leste',
    category: 'Torre Média',
    x: 16.6,
    z: 1.8,
    width: 18.2,
    depth: 15.6,
    floors: 10,
    unitsPerFloor: 4,
    areaRange: '74,21 a 110,00 m²',
    dormsLabel: '2 a 3 Quartos (Suíte)',
    roofTop: BASE_Y + 10 * FLOOR_H + 2.5
  }
];

// 6 Casas Térreas com Quintal na Fachada Frontal (3 a Oeste da Portaria, 3 a Leste)
export const CASAS_CONFIG = [
  { id: 'CASA-01', num: 1, name: 'Casa 01 (Oeste)', x: -41.2, z: 27.2, width: 7.8, depth: 8.2, doorSide: 1 },
  { id: 'CASA-02', num: 2, name: 'Casa 02 (Oeste)', x: -30.4, z: 27.2, width: 7.8, depth: 8.2, doorSide: 1 },
  { id: 'CASA-03', num: 3, name: 'Casa 03 (Oeste)', x: -19.6, z: 27.2, width: 7.8, depth: 8.2, doorSide: 1 },
  { id: 'CASA-04', num: 4, name: 'Casa 04 (Leste)', x:  19.6, z: 27.2, width: 7.8, depth: 8.2, doorSide: -1 },
  { id: 'CASA-05', num: 5, name: 'Casa 05 (Leste)', x:  30.4, z: 27.2, width: 7.8, depth: 8.2, doorSide: -1 },
  { id: 'CASA-06', num: 6, name: 'Casa 06 (Leste)', x:  41.2, z: 27.2, width: 7.8, depth: 8.2, doorSide: -1 }
];

// Posição do observador e ponto de interesse na geometria do condomínio.
function vistaLocal([x, y, z], [tx, ty, tz]) {
  const dx = x - tx, dy = y - ty, dz = z - tz;
  const radius = Math.hypot(dx, dy, dz);
  return {
    camTarget: { x: tx, y: ty, z: tz },
    camSpherical: { radius, phi: Math.acos(dy / radius), theta: Math.atan2(dx, dz) }
  };
}

export const VISTAS_COMPLEMENTARES = [
  { id: 'boulevard', ...vistaLocal([0, 2.7, 22], [0, 3.2, -7]) },
  { id: 'jardins', ...vistaLocal([-9, 2.5, 20.8], [-14.2, 3.2, 13.4]) },
  { id: 'pergolado', ...vistaLocal([-27.9, 2.2, 19.6], [-27.5, 1.9, 14.6]) },
  { id: 'gourmet', ...vistaLocal([36, 2.3, 8.7], [39, 1.95, 3]) },
  { id: 'academia_coberta', ...vistaLocal([36.4, 2.35, -0.3], [32, 1.9, -5]) }
];

// Os 7 Setores Numerados da Planta Baixa Geral (Legenda 1 a 7)
export const SECTORS_LEGENDA = [
  {
    num: 1,
    id: 'portaria',
    title: 'Portaria (Controle de Acesso)',
    subtitle: 'Guarita central blindada, pórtico em concreto e madeira ripada, acesso duplo e ilha paisagística',
    x: 0.0,
    y: 4.5,
    z: 29.8,
    ...vistaLocal([2.6, 2.7, 40.6], [0, 3.6, 29])
  },
  {
    num: 2,
    id: 'piscina',
    title: 'Piscina Central (Adulto e Infantil)',
    subtitle: 'Espelho d’água em pastilha azul-celeste, iluminação subaquática LED, solarium em deck de madeira, espreguiçadeiras e guarda-sóis',
    x: 0.0,
    y: 1.5,
    z: 4.2,
    ...vistaLocal([2.4, 2.5, 15.7], [0, 2.4, -5.1])
  },
  {
    num: 3,
    id: 'quadra',
    title: 'Quadra Poliesportiva',
    subtitle: 'Piso esportivo em terracota com marcações de tênis, tabelas de basquete, alambrado e iluminação em LED',
    x: -36.5,
    y: 2.0,
    z: 3.2,
    ...vistaLocal([-40, 2.4, 12], [-33, 2.55, -3])
  },
  {
    num: 4,
    id: 'academia_ar_livre',
    title: 'Academia ao Ar Livre & Pergolado',
    subtitle: 'Estações de ginástica e musculação ao ar livre integradas a pergolado de madeira nobre com lounge de descanso',
    x: -29.5,
    y: 2.2,
    z: 16.0,
    ...vistaLocal([-35.6, 2.5, 20.1], [-30.8, 1.85, 14.8])
  },
  {
    num: 5,
    id: 'salao_festas',
    title: 'Salão de Festas / Espaço Gourmet',
    subtitle: 'Pavilhão envidraçado com pé-direito amplo, salão de banquetes, cozinha gourmet, academia coberta e terraço com ombrelones',
    x: 36.2,
    y: 3.5,
    z: 4.2,
    ...vistaLocal([40.4, 2.3, 12.6], [32, 1.95, 6.5])
  },
  {
    num: 6,
    id: 'casas_aluguel',
    title: 'Casas para Aluguel (Unidades Térreas)',
    subtitle: 'Unidades térreas independentes (48 a 72 m²) com 2–3 quartos (1 suíte), fachada contemporânea, gradil e quintal privativo',
    x: -30.4,
    y: 3.2,
    z: 27.2,
    bounds2: { x: 30.4, y: 3.2, z: 27.2 },
    ...vistaLocal([-25.9, 2.4, 38.6], [-30.4, 2.5, 28.3])
  },
  {
    num: 7,
    id: 'torres_residenciais',
    title: 'Torres Residenciais (A, B, C, D e E)',
    subtitle: '5 torres com planta em H (4 apartamentos por andar), varanda gourmet com guarda-corpo em vidro e ventilação cruzada',
    x: 0.0,
    y: 26.0,
    z: -21.5,
    ...vistaLocal([0, 2.5, 18.1], [0, 8, -18])
  }
];

// Dados Gerais do Empreendimento (Prancha 1)
export const DADOS_EMPREENDIMENTO = [
  { icon: '📐', label: 'Área do Terreno', value: '28.000 m² (200m × 140m)' },
  { icon: '🏗️', label: 'Área Construída', value: '48.500 m²' },
  { icon: '🏢', label: 'Nº de Torres', value: '5 Torres (A, B, C, D e E)' },
  { icon: '🔢', label: 'Pavimentos', value: '10 a 18 Pavimentos Tipo' },
  { icon: '🚪', label: 'Unidades por Torre', value: '4 Unidades / Pavimento' },
  { icon: '🏠', label: 'Total de Apartamentos', value: '284 Unidades Residenciais' },
  { icon: '🏡', label: 'Casas Térreas (Aluguel)', value: '6 Unidades Frontais (até 10 no complexo)' },
  { icon: '🚗', label: 'Vagas de Garagem', value: '720 Vagas (Moradores + Visitantes)' }
];

// Catálogo Botânico & Paisagismo (Prancha 2)
export const PAISAGISMO_DATA = {
  trees: [
    {
      id: 'pau_ferro',
      name: 'Árvore de Sombra — Pau-Ferro',
      scientific: 'Caesalpinia ferrea',
      crown: '7,00 – 10,00 m',
      height: '6,00 – 9,00 m',
      color: '#3f7428',
      accentColor: '#eab308',
      details: ['Folhagem densa composta bipinada', 'Casca lisa marmorizada/escura', 'Floração amarela ornamental'],
      locationDesc: 'Cinturão verde perimetral (Oeste, Norte e Leste) e bosques entre as Torres A, B e C',
      camTarget: { x: -45, y: 4, z: -15 },
      camSpherical: { radius: 32, phi: Math.PI * 0.33, theta: 0.45 }
    },
    {
      id: 'palmeira_imperial',
      name: 'Palmeira Imperial',
      scientific: 'Roystonea oleracea',
      crown: '4,00 – 6,00 m',
      height: '7,00 – 12,00 m',
      color: '#4d8c30',
      accentColor: '#84cc16',
      details: ['Folha (Fronde) plumosa arqueada', 'Estipe colunar cinza anelado', 'Canteiro base com Cordiline e balizadores'],
      locationDesc: 'Alamedas centrais, entorno do deck da Piscina Central e jardins das Torres D e E',
      camTarget: { x: -8.5, y: 5, z: 3.5 },
      camSpherical: { radius: 28, phi: Math.PI * 0.34, theta: 0.28 }
    },
    {
      id: 'ipe_rosa',
      name: 'Ipê Rosa',
      scientific: 'Handroanthus heptaphyllus',
      crown: '6,00 – 8,00 m',
      height: '6,00 – 9,00 m',
      color: '#db2777',
      accentColor: '#f472b6',
      details: ['Floração exuberante rosa-magenta', 'Tapete de flores caídas no solo', 'Destaque escultural nos jardins centrais'],
      locationDesc: '3 praças floridas frontais ao sul das Torres D e E (Eixo do Boulevard Principal)',
      camTarget: { x: 16.5, y: 4.5, z: 14.5 },
      camSpherical: { radius: 26, phi: Math.PI * 0.32, theta: -0.2 }
    }
  ],
  shrubs: [
    { id: 'hibisco', name: 'Hibisco', scientific: 'Hibiscus rosa-sinensis', size: '1,00 – 1,50 m', foliage: '#1e4620', flower: '#ef4444' },
    { id: 'ixora', name: 'Ixora', scientific: 'Ixora coccinea', size: '1,00 – 1,50 m', foliage: '#274e13', flower: '#f97316' },
    { id: 'cordiline', name: 'Cordiline (Dracena)', scientific: 'Cordyline fruticosa', size: '0,80 – 1,20 m', foliage: '#881337', flower: '#e11d48' },
    { id: 'mureia', name: 'Muréia (Jasmim-laranja)', scientific: 'Murraya paniculata', size: '0,80 – 1,20 m', foliage: '#2d5a27', flower: '#f8fafc' },
    { id: 'pingo_ouro', name: 'Pingo-de-Ouro', scientific: 'Duranta erecta', size: '0,80 – 1,20 m', foliage: '#84cc16', flower: '#fde047' },
    { id: 'grama_amendoim', name: 'Grama-Amendoim (Forração)', scientific: 'Arachis repens', size: '0,10 – 0,25 m', foliage: '#3f6212', flower: '#facc15' }
  ]
};

// Altura (Y de cena) do topo do corpo da torre com `floorNum` pavimentos.
export function towerFloorTop(floorNum) {
  return BASE_Y + floorNum * FLOOR_H;
}

// Pontos de interesse (POIs) do Mapa do Entorno (Modo Localização) — bairro Vila Mariana, São Paulo.
// lat/lng são aproximados; o Street View ajusta ao panorama mais próximo (ver src/streetview.js).
export const POIS_ENTORNO = [
  { id: 'ibirapuera', name: 'Parque Ibirapuera', type: 'park', x: -18, y: 8, z: 54, lat: -23.5874, lng: -46.6576, hasStreetView: true },
  { id: 'jabaquara', name: 'Av. Jabaquara', type: 'highway', x: 72, y: 10, z: 26, lat: -23.601, lng: -46.641 },
  { id: 'domingos', name: 'Av. Domingos de Moraes', type: 'avenue', x: -6, y: 14, z: -42, lat: -23.5905, lng: -46.636 },
  { id: 'marista', name: 'Colégio Marista Arquidiocesano', type: 'school', x: -58, y: 12, z: -8, lat: -23.5965, lng: -46.6372 },
  { id: 'unifesp', name: 'Unifesp — Campus São Paulo', type: 'school', x: -34, y: 12, z: -42, lat: -23.5985, lng: -46.646 },
  { id: 'cinemateca', name: 'Cinemateca Brasileira', type: 'gov', x: -4, y: 11, z: -48, lat: -23.5919, lng: -46.6416 },
  { id: 'alesp', name: 'Assembleia Legislativa', type: 'gov', x: 22, y: 11, z: -46, lat: -23.5837, lng: -46.6564 },
  { id: 'metro_vm', name: 'Metrô Vila Mariana', type: 'gov', x: -8, y: 18, z: -68, lat: -23.5897, lng: -46.6349 },
  { id: 'oca', name: 'Oca — Ibirapuera', type: 'park', x: -36, y: 16, z: -58, lat: -23.5871, lng: -46.6588 },
  { id: 'metro_ar', name: 'Metrô Ana Rosa', type: 'gov', x: 24, y: 18, z: -68, lat: -23.5818, lng: -46.6384 },
  { id: 'hsp', name: 'Hospital São Paulo', type: 'school', x: 34, y: 16, z: -56, lat: -23.5981, lng: -46.6455 },
  { id: 'cabral', name: 'Av. Pedro Álvares Cabral', type: 'avenue', x: 58, y: 17, z: -58, lat: -23.5846, lng: -46.6556 },
  { id: 'sh_santa_cruz', name: 'Shopping Santa Cruz', type: 'market', x: -8, y: 20, z: -82, lat: -23.5987, lng: -46.6373 },
  { id: 'plaza_sul', name: 'Shopping Plaza Sul', type: 'market', x: 8, y: 23, z: -96, lat: -23.603, lng: -46.6392 },
  { id: 'metro_sc', name: 'Metrô Santa Cruz', type: 'gov', x: -42, y: 19, z: -76, lat: -23.5991, lng: -46.6368 },
  { id: 'metro_pa', name: 'Metrô Paraíso', type: 'gov', x: -64, y: 19, z: -76, lat: -23.5755, lng: -46.6407 },
  { id: 'paulista', name: 'Av. Paulista', type: 'avenue', x: -38, y: 24, z: -102, lat: -23.5614, lng: -46.6559 },
  { id: 'aclimacao', name: 'Parque da Aclimação', type: 'park', x: 10, y: 26, z: -112, lat: -23.5733, lng: -46.6307 },
  { id: 'sh_ibirapuera', name: 'Shopping Ibirapuera', type: 'market', x: -86, y: 16, z: -56, lat: -23.6101, lng: -46.6667 },
  { id: 'av_ibirapuera', name: 'Av. Ibirapuera', type: 'avenue', x: -110, y: 17, z: -58, lat: -23.599, lng: -46.664 },
  { id: 'vergueiro', name: 'Rua Vergueiro', type: 'avenue', x: -68, y: 17, z: -62, lat: -23.5895, lng: -46.637 }
];

// Gerador determinístico para manter sempre as mesmas unidades
function seededRandom(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function generateAllUnits() {
  const units = [];
  const forceAvailable = new Set(['D-054', 'A-181', 'A-251', 'C-162', 'CASA-01', 'CASA-04']);
  let seedCounter = 1;

  for (const [towerIdx, tower] of TOWERS_CONFIG.entries()) {
    const isHighTower = tower.floors >= 15; // Torres A, B, C = Torre Alta (110–160 m²); D, E = Torre Média (70–110 m²)

    for (let floor = 1; floor <= tower.floors; floor++) {
      for (let aptIdx = 1; aptIdx <= tower.unitsPerFloor; aptIdx++) {
        const floorStr = floor < 10 ? `0${floor}` : `${floor}`;
        const code = `${tower.id}-${floorStr}${aptIdx}`;

        const r = seededRandom(seedCounter++);
        let status = r < 0.62 ? 'disponivel' : (r < 0.84 ? 'reservado' : 'vendido');
        if (forceAvailable.has(code)) status = 'disponivel';

        let dorms, suites, vagas, area, areaNum, price, typology;
        if (isHighTower) {
          if (floor >= tower.floors - 2) {
            const big = aptIdx % 2 === 0;
            dorms = 4; suites = big ? 4 : 3; vagas = 4;
            area = big ? '161,34' : '148,20'; areaNum = big ? 161.34 : 148.20;
            price = (big ? 1240000 : 1120000) + floor * 9500;
            typology = 'luxury161';
          } else {
            const big = aptIdx % 2 === 1;
            dorms = 3; suites = 3; vagas = 3;
            area = big ? '128,40' : '118,50'; areaNum = big ? 128.40 : 118.50;
            price = (big ? 960000 : 890000) + floor * 6800;
            typology = 'family118';
          }
        } else {
          // Torres Médias D e E (70 a 110 m², 2 a 3 Quartos)
          if (floor >= tower.floors - 1) {
            dorms = 3; suites = 2; vagas = 2;
            area = '108,40'; areaNum = 108.40;
            price = 820000 + floor * 6200;
            typology = 'family118';
          } else if (aptIdx % 2 === 0) {
            dorms = 2; suites = 1; vagas = 1;
            area = '74,21'; areaNum = 74.21;
            price = 573400 + (floor - 5) * 4500;
            if (code === 'D-054') price = 573400;
            typology = 'compact53';
          } else {
            dorms = 3; suites = 1; vagas = 2;
            area = '88,60'; areaNum = 88.60;
            price = 668000 + floor * 4800;
            typology = 'mid74';
          }
        }

        units.push({
          id: code,
          code,
          displayTitle: `Torre ${tower.id} - ${floorStr}${aptIdx}`,
          tower: tower.id,
          floor,
          aptIdx,
          dorms,
          suites,
          vagas,
          area,
          areaNum,
          price,
          status,
          typology,
          planta: pickPlantaId(typology, towerIdx, floor, aptIdx),
          sortOrder: units.length + 1
        });
      }
    }
  }

  // Adiciona também as 6 Casas Térreas Frontais (Casas para Aluguel / Investimento)
  CASAS_CONFIG.forEach((casa, idx) => {
    // CS-01/02/04 têm 2 quartos; CS-03/05/06 têm 3 (conforme as plantas geradas)
    const big = [3, 5, 6].includes(casa.num);
    const status = idx === 2 ? 'reservado' : 'disponivel';
    units.push({
      id: casa.id,
      code: casa.id,
      displayTitle: `${casa.name} — Térrea c/ Quintal`,
      tower: 'CASA',
      casaNum: casa.num,
      floor: 1,
      aptIdx: idx + 1,
      dorms: big ? 3 : 2,
      suites: 1,
      vagas: 2,
      area: big ? '72,00' : '58,40',
      areaNum: big ? 72.0 : 58.4,
      price: big ? 645000 : 540000,
      status,
      typology: 'casaTerrea',
      planta: pickPlantaId('casaTerrea', 0, 1, idx + 1, casa.num),
      sortOrder: units.length + 1
    });
  });

  return units;
}

export function formatBRL(val) {
  return 'R$ ' + Math.round(val).toLocaleString('pt-BR');
}
