// ==========================================================================
// STREET VIEW GRATUITO (MAPILLARY) — ENTORNO DO EMPREENDIMENTO (VILA MARIANA, SÃO PAULO)
// O prédio da maquete é fictício; o bairro e os pontos de vista são reais.
// Cada ponto fica a ~100 m do centro, olhando para o terreno; o Mapillary usa a
// foto de rua mais próxima da coordenada (cobertura colaborativa: pode haver falhas).
// ==========================================================================

export const SV_BAIRRO = {
  nome: 'Vila Mariana',
  cidade: 'São Paulo, SP',
  // terreno imaginário ao lado do Metrô Vila Mariana (Rua Domingos de Moraes)
  centro: { lat: -23.589, lng: -46.6352 }
};

// Vistas "à volta do prédio": cada uma olha para o terreno a partir de um lado
export const SV_VISTAS = [
  { id: 'norte', nome: 'Lado norte', lat: -23.5881, lng: -46.6352, heading: 180 },
  { id: 'leste', nome: 'Lado leste', lat: -23.589, lng: -46.6343, heading: 270 },
  { id: 'sul', nome: 'Lado sul', lat: -23.5899, lng: -46.6352, heading: 0 },
  { id: 'oeste', nome: 'Lado oeste', lat: -23.589, lng: -46.6361, heading: 90 }
];

const TOKEN_STORAGE = 'ilusao.mlyToken';
const MLY_VERSION = '4.1.2';

export function svGetToken() {
  try {
    return (window.MAPILLARY_TOKEN || localStorage.getItem(TOKEN_STORAGE) || '').trim();
  } catch (e) {
    return (window.MAPILLARY_TOKEN || '').trim();
  }
}

export function svSetToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE, token.trim());
    else localStorage.removeItem(TOKEN_STORAGE);
  } catch (e) { window.MAPILLARY_TOKEN = token; } // sem armazenamento: vale só nesta sessão
}

// Link oficial do Google Maps (sem chave): abre o mesmo ponto em outra aba
export function svMapsUrl(p) {
  const q = new URLSearchParams({
    api: '1',
    map_action: 'pano',
    viewpoint: `${p.lat},${p.lng}`,
    heading: String(p.heading ?? 0),
    pitch: '0',
    fov: '90'
  });
  return `https://www.google.com/maps/@?${q}`;
}

// Carrega o MapillaryJS só na primeira abertura (não pesa o início da maquete)
let mlyPromise = null;
export function carregarMapillary() {
  if (window.mapillary) return Promise.resolve(window.mapillary);
  if (mlyPromise) return mlyPromise;
  mlyPromise = new Promise((resolve, reject) => {
    const base = `https://cdn.jsdelivr.net/npm/mapillary-js@${MLY_VERSION}/dist`;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}/mapillary.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${base}/mapillary.js`;
    js.onload = () => resolve(window.mapillary);
    js.onerror = () => { mlyPromise = null; reject(new Error('Não foi possível carregar o MapillaryJS (sem internet?)')); };
    document.head.appendChild(js);
  });
  return mlyPromise;
}

const distM = (aLat, aLng, bLat, bLng) => {
  const k = 111320;
  const dx = (aLng - bLng) * k * Math.cos((aLat * Math.PI) / 180);
  const dy = (aLat - bLat) * k;
  return Math.hypot(dx, dy);
};

// Foto de rua mais próxima do ponto (prefere panorama 360° quando está quase tão perto quanto a mais próxima)
export async function mlyImagemProxima(token, lat, lng) {
  for (const raio of [0.0008, 0.002]) { // ~90 m, depois ~220 m
    const bbox = [lng - raio, lat - raio, lng + raio, lat + raio].join(',');
    const url = 'https://graph.mapillary.com/images?' + new URLSearchParams({
      access_token: token,
      fields: 'id,computed_geometry,is_pano,compass_angle',
      bbox,
      limit: '200'
    });
    const r = await fetch(url);
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('TOKEN');
    if (!r.ok) throw new Error(`Mapillary respondeu ${r.status}`);
    const lista = ((await r.json()).data || [])
      .filter((i) => i.computed_geometry)
      .map((i) => ({ ...i, d: distM(lat, lng, i.computed_geometry.coordinates[1], i.computed_geometry.coordinates[0]) }))
      .sort((a, b) => a.d - b.d);
    if (!lista.length) continue;
    const pano = lista.find((i) => i.is_pano && i.d <= lista[0].d + 25);
    return pano || lista[0];
  }
  return null;
}

// Posição horizontal (0..1) de um panorama que aponta para `heading` (graus, bússola)
export function mlyCentroPano(img, heading) {
  const rel = (((heading - (img.compass_angle || 0)) / 360) % 1 + 1) % 1;
  return (rel + 0.5) % 1;
}
