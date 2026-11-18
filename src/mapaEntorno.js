// ==========================================================================
// MAPA DO ENTORNO EM 3D (MODO LOCALIZAÇÃO) — Vila Mariana, São Paulo
// Mapa real do OpenStreetMap (MapLibre + OpenFreeMap, grátis e sem chave), câmera inclinada
// com prédios em volume, os pontos do entorno, as 5 torres do empreendimento e o boneco
// do Street View. As ruas com foto vêm do Mapillary (precisa do token já salvo).
// ==========================================================================

import { POIS_ENTORNO } from './data.js';
import { SV_BAIRRO, svGetToken } from './streetview.js';

const MAPLIBRE_VERSION = '4.7.1';
const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';

const COR_TIPO = {
  club: '#a78bfa', highway: '#f97316', avenue: '#facc15', school: '#38bdf8',
  gov: '#f472b6', park: '#4ade80', market: '#fb923c'
};

// 5 torres fictícias no terreno: deslocamento em metros do centro (leste, norte), largura, profundidade, altura
const TORRES = [
  { e: -34, n: 10, w: 26, d: 22, h: 92, nome: 'A' },
  { e: 8, n: 26, w: 26, d: 22, h: 92, nome: 'B' },
  { e: 38, n: -6, w: 24, d: 20, h: 68, nome: 'C' },
  { e: -6, n: -20, w: 22, d: 18, h: 48, nome: 'D' },
  { e: -44, n: -26, w: 22, d: 18, h: 48, nome: 'E' }
];

let libPromise = null;
function carregarMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const base = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist`;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}/maplibre-gl.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${base}/maplibre-gl.js`;
    js.onload = () => resolve(window.maplibregl);
    js.onerror = () => { libPromise = null; reject(new Error('Não foi possível carregar o mapa (sem internet?)')); };
    document.head.appendChild(js);
  });
  return libPromise;
}

// retângulo de w × d metros centrado a (e, n) metros do centro do terreno
function retangulo(centro, e, n, w, d) {
  const mLat = 111320;
  const mLng = 111320 * Math.cos((centro.lat * Math.PI) / 180);
  const c = (de, dn) => [centro.lng + (e + de) / mLng, centro.lat + (n + dn) / mLat];
  return [[c(-w / 2, -d / 2), c(w / 2, -d / 2), c(w / 2, d / 2), c(-w / 2, d / 2), c(-w / 2, -d / 2)]];
}

export class MapaEntorno {
  // el: contêiner do painel (com #mapa-canvas e os botões); abrirStreetView(ponto) abre o Street View
  constructor({ el, abrirStreetView }) {
    this.el = el;
    this.abrirStreetView = abrirStreetView;
    this.map = null;
    this.fotosLigadas = true;
    el.querySelector('#mapa-btn-todos').addEventListener('click', () => this.verTodos());
    this.btnFotos = el.querySelector('#mapa-btn-fotos');
    this.btnFotos.addEventListener('click', () => this.alternarFotos());
  }

  _status(msg) {
    const s = this.el.querySelector('#mapa-status');
    s.textContent = msg;
    s.hidden = !msg;
  }

  async mostrar() {
    if (this.map) { this.map.resize(); return; }
    this._status('Carregando o mapa da Vila Mariana…');
    try {
      const ml = await carregarMapLibre();
      this._criar(ml);
    } catch (err) {
      this._status(err.message || 'Falha ao carregar o mapa.');
    }
  }

  _criar(ml) {
    const c = SV_BAIRRO.centro;
    const map = (this.map = new ml.Map({
      container: this.el.querySelector('#mapa-canvas'),
      style: ESTILO,
      center: [c.lng, c.lat],
      zoom: 15.7,
      pitch: 62,
      bearing: -28,
      maxPitch: 80,
      attributionControl: { compact: true }
    }));
    map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      this._status('');
      this._torres(map, c);
      this._fotos(map);
    });
    map.on('error', (e) => {
      if (e && e.error && /Failed to fetch|NetworkError/i.test(String(e.error.message))) {
        this._status('Sem conexão com o servidor de mapas. Verifique a internet.');
      }
    });

    this._marcadores(ml, map, c);
  }

  _torres(map, c) {
    map.addSource('torres', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: TORRES.map((t) => ({
          type: 'Feature',
          properties: { h: t.h },
          geometry: { type: 'Polygon', coordinates: retangulo(c, t.e, t.n, t.w, t.d) }
        }))
      }
    });
    map.addLayer({
      id: 'torres-3d',
      type: 'fill-extrusion',
      source: 'torres',
      paint: {
        'fill-extrusion-color': '#2aa7ff',
        'fill-extrusion-height': ['get', 'h'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.95,
        'fill-extrusion-vertical-gradient': true
      }
    });
  }

  // Ruas que têm foto no Mapillary (linhas verdes); clicar numa delas abre a foto ali
  _fotos(map) {
    const token = svGetToken();
    if (!token) { this.btnFotos.hidden = true; return; }
    map.addSource('mly', {
      type: 'vector',
      tiles: [`https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`],
      minzoom: 6,
      maxzoom: 14
    });
    map.addLayer({
      id: 'mly-seq',
      type: 'line',
      minzoom: 13.5, // longe demais vira uma massa verde: só aparece com o mapa aproximado
      source: 'mly',
      'source-layer': 'sequence',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#05cb63', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 17, 3], 'line-opacity': 0.5 }
    });
    map.on('mouseenter', 'mly-seq', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'mly-seq', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'mly-seq', (e) => {
      this.abrirStreetView({ nome: 'Rua selecionada no mapa', lat: e.lngLat.lat, lng: e.lngLat.lng, heading: 0 });
    });
  }

  alternarFotos() {
    this.fotosLigadas = !this.fotosLigadas;
    this.btnFotos.classList.toggle('active', this.fotosLigadas);
    if (this.map && this.map.getLayer('mly-seq')) {
      this.map.setLayoutProperty('mly-seq', 'visibility', this.fotosLigadas ? 'visible' : 'none');
    }
  }

  _marcadores(ml, map, c) {
    for (const poi of POIS_ENTORNO) {
      const el = document.createElement('div');
      el.className = 'mp-poi';
      el.style.setProperty('--c', COR_TIPO[poi.type] || '#94a3b8');
      el.innerHTML = '<div class="mp-pill"></div><div class="mp-stem"></div><div class="mp-dot"></div>';
      el.querySelector('.mp-pill').textContent = poi.name;
      el.title = `${poi.name} — clique para ver a rua`;
      el.addEventListener('click', () => this.abrirStreetView({ nome: poi.name, lat: poi.lat, lng: poi.lng, heading: 0 }));
      new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).addTo(map);
    }

    // rótulo do empreendimento + boneco do Street View (abre a vista à volta do prédio)
    const emp = document.createElement('div');
    emp.className = 'mp-emp';
    emp.innerHTML = '<div class="mp-emp-pill">Empreendimento</div><div class="mp-stem"></div>';
    new ml.Marker({ element: emp, anchor: 'bottom', offset: [0, -96] }).setLngLat([c.lng, c.lat]).addTo(map);

    const peg = document.createElement('button');
    peg.className = 'mp-pegman';
    peg.type = 'button';
    peg.title = 'Abrir o Street View à volta do prédio';
    peg.innerHTML = '<span class="mp-peg-bubble">🚶 Ver Vista da Rua (Street View)</span><span class="mp-peg-fig">🧍</span>';
    peg.addEventListener('click', (e) => { e.stopPropagation(); this.abrirStreetView(); });
    new ml.Marker({ element: peg, anchor: 'bottom' }).setLngLat([c.lng + 0.00055, c.lat - 0.0004]).addTo(map);
  }

  // enquadra o prédio e todos os pontos do entorno
  verTodos() {
    if (!this.map || !window.maplibregl) return;
    const b = new window.maplibregl.LngLatBounds();
    b.extend([SV_BAIRRO.centro.lng, SV_BAIRRO.centro.lat]);
    POIS_ENTORNO.forEach((p) => b.extend([p.lng, p.lat]));
    const alt = this.el.clientHeight || 600;
    const pad = Math.max(30, Math.min(90, Math.round(alt * 0.1))); // painel baixo: margem menor
    this.map.fitBounds(b, { padding: { top: pad + 30, bottom: pad + 50, left: pad, right: pad }, pitch: 40, bearing: 0, maxZoom: 14.5, duration: 1600 });
  }
}
