// ==========================================================================
// PLANTAS HUMANIZADAS (AP-01..AP-20, CS-01..CS-06) E RECORTES DOS CÔMODOS
// Cada unidade recebe uma variação de planta pela tipologia; as imagens leves
// (webp) e os recortes dos 6 cômodos são gerados por tools/otimizar-plantas.py.
// ==========================================================================

import { PLANTAS_CATALOGO } from './plantasCatalogo.js';

const BASE = './assets/plantas/web';

export const COMODOS = [
  { id: 'sala', nome: 'Sala / Jantar' },
  { id: 'cozinha', nome: 'Cozinha' },
  { id: 'suite', nome: 'Suíte' },
  { id: 'quarto', nome: 'Quarto' },
  { id: 'banheiro', nome: 'Banheiro' },
  { id: 'varanda', nome: 'Varanda' }
];

// Variações por tipologia (nº de dormitórios das plantas geradas)
const POOLS = {
  compact53: ['AP-01', 'AP-02', 'AP-03', 'AP-04', 'AP-05'],
  mid74: ['AP-06', 'AP-07', 'AP-08', 'AP-09', 'AP-10'],
  family118: ['AP-11', 'AP-12', 'AP-13', 'AP-15', 'AP-07', 'AP-09'],
  luxury161: ['AP-16', 'AP-17', 'AP-18', 'AP-19', 'AP-20']
};

// Escolha determinística: apartamentos vizinhos (mesmo andar) nunca repetem a planta
export function pickPlantaId(typology, towerIdx, floor, aptIdx, casaNum) {
  if (typology === 'casaTerrea') return `CS-0${casaNum}`;
  const pool = POOLS[typology] || POOLS.mid74;
  return pool[(towerIdx * 3 + floor * 2 + aptIdx) % pool.length];
}

export function plantaInfo(id) {
  return PLANTAS_CATALOGO[id] || null;
}

// ?v=hq: força o navegador a trocar as imagens antigas (760 px) pelas novas (até 1400 px)
export const plantaUrl = (id) => `${BASE}/${id}/planta.webp?v=hq`;
// paredes brancas da planta (branco + alfa), geradas por tools/gerar-paredes.py; viram a camada em relevo
export const paredesUrl = (id) => `${BASE}/${id}/paredes.webp?v=hq`;
export const comodoUrl = (id, comodo) => `${BASE}/${id}/${comodo}.webp`;
