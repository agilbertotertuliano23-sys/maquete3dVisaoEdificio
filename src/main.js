// ==========================================================================
// ILUSÃO DIGITAL STUDIO 3D — CONTROLADOR PRINCIPAL DA APLICAÇÃO
// ==========================================================================

import {
  TOWERS_CONFIG,
  SECTORS_LEGENDA,
  DADOS_EMPREENDIMENTO,
  PAISAGISMO_DATA,
  POIS_ENTORNO,
  towerFloorTop,
  generateAllUnits,
  formatBRL
} from './data.js';
import { COMODOS, plantaInfo, plantaUrl, comodoUrl } from './plantas.js';
import { TOUR_CATALOG } from './tour360Catalogo.js';
import { paintRange } from './liquidUI.js';
import { MaqueteScene3D } from './scene3d.js';
import { MapaEntorno } from './mapaEntorno.js';
import {
  SV_BAIRRO, SV_VISTAS, svGetToken, svSetToken, svMapsUrl,
  carregarMapillary, mlyImagemProxima, mlyCentroPano
} from './streetview.js';

class IlusaoDigitalApp {
  constructor() {
    this.units = generateAllUnits();
    this.unitsById = new Map(this.units.map(u => [u.id, u]));

    this.currentMode = 'desmonte'; // 'filme' | 'desmonte' | 'planta' | 'localizacao' | 'unidades'
    this.activeCamPreset = 'aerea';
    this.activeUnit = null;
    this.activeUnitView = 'render';
    this.poiDomElements = [];
    this.towerDomElements = [];
    this.sectorDomElements = [];

    this._cacheDOM();
    this._initScene3D();
    this._initLabels3D();
    this._populatePlantaBaixaSidebar();
    this._populatePaisagismoModal();
    this._initStreetView();
    this._initMapaEntorno();
    this._bindUIEvents();
    this._updateAvailabilityCounts();
    this._renderSearchResults();
    this._labelQuickUnits();
  }

  _labelQuickUnits() {
    document.querySelectorAll('.btn-QuickUnit').forEach(btn => {
      const u = this.unitsById.get(btn.dataset.unitId);
      if (u) btn.textContent = `Ver ${u.code} (${formatBRL(u.price)})`;
    });
  }

  _cacheDOM() {
    this.canvasContainer = document.getElementById('canvas-container');
    this.labelsContainer = document.getElementById('labels-3d-container');
    this.hoverTooltip = document.getElementById('unit-hover-tooltip');

    this.activeModeLabel = document.getElementById('active-mode-label');
    this.navFilme = document.getElementById('nav-filme');
    this.navFachada = document.getElementById('nav-fachada');

    this.btnCamAerea = document.getElementById('btn-cam-aerea');
    this.btnCamFrontal = document.getElementById('btn-cam-frontal');
    this.btnCamPlanta = document.getElementById('btn-cam-planta');
    this.btnOpenPaisagismo = document.getElementById('btn-open-paisagismo');
    this.btnOpenFicha = document.getElementById('btn-open-ficha');

    this.editorialPanel = document.getElementById('editorial-panel');
    this.desmontePanel = document.getElementById('desmonte-panel');
    this.plantaGeralSidebar = document.getElementById('planta-geral-sidebar');
    this.availabilityHud = document.getElementById('availability-hud');
    this.bottomDock = document.getElementById('bottom-pill-dock');

    this.btnModeDesmonte = document.getElementById('btn-mode-desmonte');
    this.btnModePlanta = document.getElementById('btn-mode-planta');
    this.btnModeLocalizacao = document.getElementById('btn-mode-localizacao');
    this.btnModeUnidades = document.getElementById('btn-mode-unidades');

    // Desmonte controls
    this.desmonteTowerName = document.getElementById('desmonte-tower-name');
    this.floorCutLabel = document.getElementById('floor-cut-label');
    this.floorCutSlider = document.getElementById('floor-cut-slider');
    this.towerChips = Array.from(document.querySelectorAll('.tower-chip'));
    this.sectorMiniList = document.getElementById('sector-mini-list');

    // Planta Baixa Geral sidebar elements
    this.pgLegendList = document.getElementById('pg-legend-list');
    this.pgMiniPlantaCanvas = document.getElementById('pg-mini-planta-canvas');
    this.pgDadosList = document.getElementById('pg-dados-list');

    // Paisagismo & Ficha Técnica Modals
    this.paisagismoModalBackdrop = document.getElementById('paisagismo-modal-backdrop');
    this.treesShowcaseGrid = document.getElementById('trees-showcase-grid');
    this.shrubsShowcaseGrid = document.getElementById('shrubs-showcase-grid');
    this.fichaModalBackdrop = document.getElementById('ficha-modal-backdrop');

    // Sync Toast
    this.syncToastOverlay = document.getElementById('sync-toast-overlay');
    this.syncSubText = document.getElementById('sync-sub-text');

    // Unit Popup Card
    this.unitPopupBackdrop = document.getElementById('unit-popup-backdrop');
    this.upPrice = document.getElementById('up-price');
    this.upUnitCode = document.getElementById('up-unit-code');
    this.upDorms = document.getElementById('up-dorms');
    this.upSuites = document.getElementById('up-suites');
    this.upVagas = document.getElementById('up-vagas');
    this.upArea = document.getElementById('up-area');
    this.upStatusBadge = document.getElementById('up-status-badge');
    this.unitPopupLoading = document.getElementById('unit-popup-loading');
    this.upMainImg = document.getElementById('up-main-img');
    this.upThumbs = document.getElementById('up-thumbs');
    this.unitPopupVisual = document.getElementById('unit-popup-visual');

    // Painel do apartamento (plantas + recortes dos cômodos)
    this.aptPanel = document.getElementById('apt-panel');
    this.aptKicker = document.getElementById('apt-kicker');
    this.aptTitle = document.getElementById('apt-title');
    this.aptSub = document.getElementById('apt-sub');
    this.aptTabs = document.getElementById('apt-tabs');
    this.aptMainImg = document.getElementById('apt-main-img');
    this.aptMainCap = document.getElementById('apt-main-cap');
    this.aptThumbs = document.getElementById('apt-thumbs');
    this.aptTagsLayer = document.getElementById('apt-tags-3d');
    this.aptTagEls = [];
    this.aptCtx = null;      // { tower, floor } do andar cortado
    this.activeApt = null;

    // Search Modal
    this.searchModalBackdrop = document.getElementById('search-modal-backdrop');
    this.fUnitQuery = document.getElementById('f-unit-query');
    this.fTorre = document.getElementById('f-torre');
    this.fStatus = document.getElementById('f-status');
    this.fDorms = document.getElementById('f-dorms');
    this.fSuites = document.getElementById('f-suites');
    this.fVagas = document.getElementById('f-vagas');
    this.fArea = document.getElementById('f-area');
    this.fPriceMin = document.getElementById('f-price-min');
    this.fPriceMax = document.getElementById('f-price-max');
    this.unitsFoundCount = document.getElementById('units-found-count');
    this.searchLoadingBox = document.getElementById('search-loading-box');
    this.searchResultsGrid = document.getElementById('search-results-grid');

    // Street View Overlay
    this.streetviewOverlay = document.getElementById('streetview-overlay');
    this.svTitle = document.getElementById('sv-title');
    this.svSubtitle = document.getElementById('sv-subtitle');
    this.svViewerEl = document.getElementById('sv-viewer');
    this.svStatus = document.getElementById('sv-status');
    this.svKeyBox = document.getElementById('sv-key-box');
    this.svChips = document.getElementById('sv-chips');
    this.svOpenLink = document.getElementById('sv-open-maps');

    // Reel Reference Video Modal
    this.reelModalBackdrop = document.getElementById('reel-modal-backdrop');
    this.refVideoPlayer = document.getElementById('ref-video-player');
    this.referenceVideoSelect = document.getElementById('reference-video-select');
    this.referenceVideoDownload = document.getElementById('reference-video-download');

    // Localização 3D floating card
    this.loc3dCard = document.getElementById('loc-3d-card');
  }

  _openTour360(property, room = 'sala', mirrorX = false) {
    window.dispatchEvent(new CustomEvent('maquete:tour360', { detail: { property, room, mirrorX } }));
  }

  viewSector(room, mirrorX = false) {
    if (this.currentMode !== 'desmonte') this.switchMode('desmonte');
    this._setDesmonteState('ALL', 19, false);
    this.activeCamPreset = null;
    this.btnCamAerea.classList.remove('active');
    this.btnCamFrontal.classList.remove('active');
    this.sectorMiniList.closest('details')?.removeAttribute('open');
    this.scene3d.focusOnSector(room, mirrorX);
  }

  _initScene3D() {
    this.scene3d = new MaqueteScene3D(this.canvasContainer, {
      onUnitHover: (unit, x, y) => this._handleUnitHover(unit, x, y),
      onUnitClick: (unit) => { this.openUnitPopup(unit); this._openTour360(unit.planta); },
      onApartmentClick: (unit) => { this.selectApartment(unit); this._openTour360(unit.planta); },
      onFloorSliceClick: (towerId, floor) => this._syncDesmonteUIFrom3D(towerId, floor),
      onFrameUpdate: () => this._updateFloatingLabels(),
      onModelReady: () => {
        const box = document.getElementById('model-loading');
        if (box) box.hidden = true;
      }
    });

    this.scene3d.bindUnitsData(this.units);
  }

  // Cria os Rótulos 3D das 5 Torres, os Pins Laranja Numerados (1 a 7) da Planta Baixa Geral e os 21 POIs
  _initLabels3D() {
    this.labelsContainer.innerHTML = '';
    this.poiDomElements = [];
    this.towerDomElements = [];
    this.sectorDomElements = [];

    // 1. Rótulos das 5 Torres (Torre A, Torre B, Torre C, Torre D, Torre E)
    for (const cfg of TOWERS_CONFIG) {
      const el = document.createElement('div');
      el.className = 'tower-tag-3d';
      el.textContent = cfg.name;
      el.title = `Selecionar ${cfg.name} (${cfg.floors} andares)`;
      el.addEventListener('click', () => {
        if (this.currentMode === 'desmonte' || this.currentMode === 'planta') {
          this.switchMode('desmonte');
          const sliceFloor = Math.max(4, Math.floor(cfg.floors * 0.65));
          this._setDesmonteState(cfg.id, sliceFloor, true);
        } else if (this.currentMode === 'unidades') {
          this.fTorre.value = cfg.id;
          this.openSearchModal();
        }
      });
      this.labelsContainer.appendChild(el);
      this.towerDomElements.push({ cfg, el });
    }

    // 2. Pins Laranja Numerados (① a ⑥) idênticos à Prancha 1 ("Planta Baixa Geral")
    for (const sec of SECTORS_LEGENDA) {
      if (sec.num === 7) continue; // As 5 torres já têm seus próprios rótulos "Torre A..E"
      const createPinEl = (wx, wy, wz) => {
        const pin = document.createElement('button');
        pin.className = 'sector-pin-3d';
        pin.dataset.tourSector = sec.id;
        pin.textContent = String(sec.num);
        pin.title = `${sec.num}. ${sec.title} — Entrar em 360°`;
        pin.setAttribute('aria-label', `${sec.title} — Visita 360°`);
        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openTour360('COMUM', sec.id, !!sec.bounds2 && wx === sec.bounds2.x);
        });
        this.labelsContainer.appendChild(pin);
        this.sectorDomElements.push({ sec, el: pin, x: wx, y: wy, z: wz });
      };

      createPinEl(sec.x, sec.y, sec.z);
      if (sec.bounds2) {
        createPinEl(sec.bounds2.x, sec.bounds2.y, sec.bounds2.z);
      }
    }

    // 3. Rótulos dos 21 POIs do Entorno (Modo Localização)
    for (const poi of POIS_ENTORNO) {
      const wrap = document.createElement('div');
      wrap.className = 'poi-label-3d';
      wrap.hidden = true;

      let extraClass = '';
      if (poi.type === 'highway') extraClass = 'highway';
      else if (poi.type === 'avenue') extraClass = 'avenue';

      wrap.innerHTML = `
        <div class="poi-pill ${extraClass}">${poi.name}</div>
        <div class="poi-stem"></div>
        <div class="poi-dot"></div>
      `;

      wrap.addEventListener('click', () => {
        this.openStreetView({ nome: poi.name, lat: poi.lat, lng: poi.lng, heading: 0 });
      });

      this.labelsContainer.appendChild(wrap);
      this.poiDomElements.push({
        poi,
        el: wrap,
        pillEl: wrap.querySelector('.poi-pill'),
        stemEl: wrap.querySelector('.poi-stem'),
        measuredW: 0,
        measuredH: 0
      });

      if (poi.hasStreetView) {
        const pegman = document.createElement('div');
        pegman.className = 'sv-pegman-pin';
        pegman.hidden = true;
        pegman.title = 'Clique para abrir o Google Street View diretamente pelo mapa';
        pegman.innerHTML = `
          <div class="sv-pegman-bubble">
            <span>🚶</span>
            <span>Ver Vista da Rua (Street View)</span>
          </div>
          <div class="sv-pegman-figure">🧍</div>
        `;
        pegman.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openStreetView(); // boneco do mapa: abre a vista à volta do prédio, como na referência
        });
        this.labelsContainer.appendChild(pegman);
        this.pegmanPin = {
          el: pegman,
          x: poi.x + 14,
          y: poi.y - 2,
          z: poi.z - 4
        };
      }
    }
  }

  _updateFloatingLabels() {
    this._updateAptTags();
    const isLoc = (this.currentMode === 'localizacao' && !this.mapaVisivel); // com o mapa real aberto, os rótulos 3D somem
    const showTowers = (this.currentMode === 'desmonte' || this.currentMode === 'planta' || this.currentMode === 'unidades');
    const showSectorPins = (this.currentMode === 'planta' || this.currentMode === 'desmonte');

    for (const item of this.towerDomElements) {
      if (!showTowers) {
        item.el.hidden = true;
        continue;
      }
      let topFloor = item.cfg.floors;
      if (this.currentMode === 'planta') {
        topFloor = 1;
      } else if (this.currentMode === 'desmonte' && (this.scene3d.selectedTowerId === 'ALL' || this.scene3d.selectedTowerId === item.cfg.id)) {
        topFloor = Math.min(this.scene3d.cutFloor, item.cfg.floors);
      }
      const wy = this.currentMode === 'planta'
        ? 2.6
        : (topFloor >= item.cfg.floors ? item.cfg.roofTop : towerFloorTop(topFloor)) + 2.5;
      const pos = this.scene3d.projectToScreen(item.cfg.x, wy, item.cfg.z);
      if (!pos) {
        item.el.hidden = true;
      } else {
        item.el.hidden = false;
        item.el.classList.toggle('planta-tag-style', this.currentMode === 'planta');
        item.el.style.left = `${pos.x}px`;
        item.el.style.top = `${pos.y}px`;
      }
    }

    for (const item of this.sectorDomElements) {
      if (!showSectorPins) {
        item.el.hidden = true;
        continue;
      }
      const pos = this.scene3d.projectToScreen(item.x, item.y, item.z);
      if (!pos || pos.x < -30 || pos.x > window.innerWidth + 30 || pos.y < -30 || pos.y > window.innerHeight + 30) {
        item.el.hidden = true;
      } else {
        item.el.hidden = false;
        item.el.style.left = `${pos.x}px`;
        item.el.style.top = `${pos.y}px`;
      }
    }

    if (!isLoc) {
      for (const item of this.poiDomElements) {
        item.el.hidden = true;
      }
    } else {
      const cRect = this.labelsContainer.getBoundingClientRect();
      const vw = cRect.width || window.innerWidth;
      const vh = cRect.height || (window.innerHeight - 54);

      const placedBoxes = [];
      const reserveRect = (el, pad = 8) => {
        if (!el || el.hidden) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        placedBoxes.push({
          l: r.left - cRect.left - pad,
          r: r.right - cRect.left + pad,
          t: r.top - cRect.top - pad,
          b: r.bottom - cRect.top + pad
        });
      };
      reserveRect(this.loc3dCard, 10);
      reserveRect(this.bottomDock, 8);

      const candidates = [];
      for (const item of this.poiDomElements) {
        const pos = this.scene3d.projectToScreen(item.poi.x, item.poi.y, item.poi.z);
        if (!pos || pos.x < 12 || pos.x > vw - 12 || pos.y < 36 || pos.y > vh - 12) {
          item.el.hidden = true;
          continue;
        }
        if (!item.measuredW) {
          item.el.style.visibility = 'hidden';
          item.el.hidden = false;
          item.measuredW = item.pillEl?.offsetWidth || (item.poi.name.length * 7 + 24);
          item.measuredH = item.pillEl?.offsetHeight || 24;
          item.el.style.visibility = '';
        }
        candidates.push({ item, pos });
      }

      // Coloca rótulos de primeiro plano (maior y) antes para evitar sobreposição e cruzar hastes
      candidates.sort((a, b) => b.pos.y - a.pos.y);

      const overlaps = (box) => {
        for (const o of placedBoxes) {
          if (box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t) return true;
        }
        return false;
      };

      const BASE_STEM_H = 18;
      const DOT_H = 6;
      const STAGGER_STEPS = [0, 30, 58];

      for (const { item, pos } of candidates) {
        const halfW = item.measuredW * 0.5;
        const pillH = item.measuredH;
        const l = pos.x - halfW - 4;
        const r = pos.x + halfW + 4;

        if (l < 4 || r > vw - 4) {
          item.el.hidden = true;
          continue;
        }

        let chosenExtra = -1;
        let chosenBox = null;
        for (const extra of STAGGER_STEPS) {
          const stemH = BASE_STEM_H + extra;
          const b = pos.y - DOT_H - stemH + 3;
          const t = b - pillH - 6;
          if (t < 6) continue;
          const box = { l, r, t, b };
          if (!overlaps(box)) {
            chosenExtra = extra;
            chosenBox = box;
            break;
          }
        }

        if (chosenExtra < 0) {
          item.el.hidden = true;
          continue;
        }

        if (item.stemEl) {
          item.stemEl.style.height = `${BASE_STEM_H + chosenExtra}px`;
        }
        item.el.hidden = false;
        item.el.style.left = `${pos.x}px`;
        item.el.style.top = `${pos.y}px`;
        placedBoxes.push(chosenBox);
      }
    }

    if (this.pegmanPin) {
      if (!isLoc) {
        this.pegmanPin.el.hidden = true;
      } else {
        const pos = this.scene3d.projectToScreen(this.pegmanPin.x, this.pegmanPin.y, this.pegmanPin.z);
        if (!pos) {
          this.pegmanPin.el.hidden = true;
        } else {
          this.pegmanPin.el.hidden = false;
          this.pegmanPin.el.style.left = `${pos.x}px`;
          this.pegmanPin.el.style.top = `${pos.y}px`;
        }
      }
    }
  }

  // Preenche o painel lateral da Planta Baixa Geral (Prancha 1) e os atalhos de Setores
  _populatePlantaBaixaSidebar() {
    // 1. Mini botões de setores no painel de Desmonte
    this.sectorMiniList.innerHTML = '';
    this.pgLegendList.innerHTML = '';

    for (const room of TOUR_CATALOG.COMUM.rooms) {
      const sec = SECTORS_LEGENDA.find(s => s.id === room.id);
      const miniBtn = document.createElement('button');
      miniBtn.className = 'sector-mini-btn';
      miniBtn.dataset.viewSector = room.id;
      miniBtn.textContent = room.name;
      miniBtn.title = `Enquadrar ${room.name} na maquete 3D`;
      if (sec) {
        const badge = document.createElement('span');
        badge.className = 'sec-num-badge';
        badge.textContent = sec.num;
        miniBtn.prepend(badge);
      }
      miniBtn.addEventListener('click', () => this.viewSector(room.id));
      const tourBtn = document.createElement('button');
      tourBtn.className = 'sector-mini-btn';
      tourBtn.dataset.tourSector = room.id;
      tourBtn.textContent = '360°';
      tourBtn.setAttribute('aria-label', `Visitar ${room.name} em 360°`);
      tourBtn.addEventListener('click', () => this._openTour360('COMUM', room.id));
      this.sectorMiniList.append(miniBtn, tourBtn);
    }

    for (const sec of SECTORS_LEGENDA) {
      // Item completo na Legenda da Planta Baixa Geral (Prancha 1)
      const legItem = document.createElement('div');
      legItem.className = 'pg-legend-item';
      legItem.innerHTML = `
        <span class="sec-num-badge">${sec.num}</span>
        <div>
          <strong>${sec.title}</strong>
          <small>${sec.subtitle}</small>
        </div>
      `;
      legItem.addEventListener('click', () => {
        this._openTour360('COMUM', sec.id);
      });
      this.pgLegendList.appendChild(legItem);
    }

    // 2. Desenha a miniatura da Planta Tipo no painel "Torres (Planta Tipo)"
    if (this.pgMiniPlantaCanvas) {
      this._drawMiniPlantaTipo(this.pgMiniPlantaCanvas);
    }

    // 3. Dados do Empreendimento
    this.pgDadosList.innerHTML = '';
    for (const d of DADOS_EMPREENDIMENTO) {
      const row = document.createElement('div');
      row.className = 'pg-dado-row';
      row.innerHTML = `<span class="pg-dado-ic">${d.icon}</span><span>${d.label}: <strong>${d.value}</strong></span>`;
      this.pgDadosList.appendChild(row);
    }
  }

  _drawMiniPlantaTipo(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Desenha o apartamento tipo igual ao quadro "Torres (Planta Tipo)" da Prancha 1
    const px = 10, py = 10, pw = w - 20, ph = h - 20;
    // Suíte (topo esquerdo)
    ctx.fillStyle = '#c9a679';
    ctx.fillRect(px, py, pw * 0.45, ph * 0.42);
    // Banheiro (meio esquerdo)
    ctx.fillStyle = '#b8c7d1';
    ctx.fillRect(px, py + ph * 0.42, pw * 0.45, ph * 0.20);
    // Dormitório 2 (base esquerda)
    ctx.fillStyle = '#b89466';
    ctx.fillRect(px, py + ph * 0.62, pw * 0.45, ph * 0.38);
    // Cozinha (topo direito)
    ctx.fillStyle = '#c7beb5';
    ctx.fillRect(px + pw * 0.45, py, pw * 0.55, ph * 0.32);
    // Sala Estar/Jantar (meio direito)
    ctx.fillStyle = '#dfd3c3';
    ctx.fillRect(px + pw * 0.45, py + ph * 0.32, pw * 0.55, ph * 0.44);
    // Varanda (base direita)
    ctx.fillStyle = '#e5dec9';
    ctx.fillRect(px + pw * 0.45, py + ph * 0.76, pw * 0.55, ph * 0.24);

    // Camas e móveis na miniatura
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(px + 8, py + 12, pw * 0.22, ph * 0.22);
    ctx.fillRect(px + 8, py + ph * 0.68, pw * 0.22, ph * 0.22);
    ctx.fillStyle = '#8c5832';
    ctx.fillRect(px + pw * 0.62, py + ph * 0.38, pw * 0.22, ph * 0.14);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(px, py, pw, ph);
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.45, py); ctx.lineTo(px + pw * 0.45, py + ph);
    ctx.moveTo(px, py + ph * 0.42); ctx.lineTo(px + pw * 0.45, py + ph * 0.42);
    ctx.moveTo(px, py + ph * 0.62); ctx.lineTo(px + pw * 0.45, py + ph * 0.62);
    ctx.moveTo(px + pw * 0.45, py + ph * 0.32); ctx.lineTo(px + pw, py + ph * 0.32);
    ctx.moveTo(px + pw * 0.45, py + ph * 0.76); ctx.lineTo(px + pw, py + ph * 0.76);
    ctx.stroke();
  }

  // Preenche o Modal Interativo de Paisagismo (Prancha 2)
  _populatePaisagismoModal() {
    this.treesShowcaseGrid.innerHTML = '';
    for (const tree of PAISAGISMO_DATA.trees) {
      const card = document.createElement('div');
      card.className = 'botanical-tree-card';
      card.innerHTML = `
        <div class="tree-dims-top">Copa: ${tree.crown} • Altura: ${tree.height}</div>
        <canvas class="tree-preview-canvas" width="260" height="190" data-tree-id="${tree.id}"></canvas>
        <div class="tree-card-info">
          <div class="tree-title-pill">
            <strong>${tree.name}</strong>
            <em>${tree.scientific}</em>
          </div>
          <ul class="tree-detail-list">
            ${tree.details.map(d => `<li>${d}</li>`).join('')}
          </ul>
          <p class="tree-loc-desc">📍 ${tree.locationDesc}</p>
          <button class="btn-focus-tree-3d">Ver na Maquete 3D →</button>
        </div>
      `;
      card.querySelector('.btn-focus-tree-3d').addEventListener('click', () => {
        this.paisagismoModalBackdrop.hidden = true;
        if (this.currentMode === 'planta') this.switchMode('desmonte');
        this.scene3d.flyTo(
          { x: tree.camTarget.x, y: tree.camTarget.y, z: tree.camTarget.z },
          tree.camSpherical.radius,
          tree.camSpherical.phi,
          tree.camSpherical.theta
        );
      });
      this.treesShowcaseGrid.appendChild(card);
      this._drawBotanicalTreeCanvas(card.querySelector('canvas'), tree);
    }

    this.shrubsShowcaseGrid.innerHTML = '';
    for (const sh of PAISAGISMO_DATA.shrubs) {
      const scard = document.createElement('div');
      scard.className = 'botanical-shrub-card';
      scard.innerHTML = `
        <div class="shrub-circle-preview" style="background: radial-gradient(circle at 35% 35%, ${sh.flower}, ${sh.foliage} 70%)">
          <span class="shrub-flower-dot" style="background:${sh.flower}"></span>
        </div>
        <div class="shrub-info">
          <strong>${sh.name}</strong>
          <em>${sh.scientific}</em>
          <small>Porte: ${sh.size}</small>
        </div>
      `;
      this.shrubsShowcaseGrid.appendChild(scard);
    }
  }

  _drawBotanicalTreeCanvas(canvas, tree) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#070a0f';
    ctx.fillRect(0, 0, w, h);

    // Canteiro circular iluminado na base (igual à Prancha 2!)
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(w * 0.2, h * 0.85, w * 0.6, 8);
    ctx.fillStyle = '#4d7c0f';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.84, w * 0.26, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dois balizadores iluminados nas laterais do canteiro
    for (const bx of [w * 0.25, w * 0.75]) {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(bx - 3, h * 0.72, 6, 22);
      const g = ctx.createRadialGradient(bx, h * 0.72, 2, bx, h * 0.72, 22);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, h * 0.72, 22, 0, Math.PI * 2); ctx.fill();
    }

    if (tree.id === 'palmeira_imperial') {
      // Estipe cinza e frondes arqueadas
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(w * 0.47, h * 0.36, w * 0.06, h * 0.48);
      ctx.fillStyle = '#4d8c30';
      ctx.fillRect(w * 0.475, h * 0.24, w * 0.05, h * 0.14);
      ctx.strokeStyle = '#4d8c30';
      ctx.lineWidth = 6;
      for (const ang of [-1.2, -0.8, -0.4, 0.4, 0.8, 1.2]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.25);
        ctx.quadraticCurveTo(w * 0.5 + ang * 48, h * 0.06, w * 0.5 + ang * 76, h * 0.34);
        ctx.stroke();
      }
    } else {
      // Tronco ramificado (Pau-Ferro ou Ipê Rosa)
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.84);
      ctx.lineTo(w * 0.5, h * 0.5);
      ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.36, h * 0.42);
      ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.64, h * 0.42);
      ctx.stroke();

      // Copa frondosa
      const blobs = [
        [w * 0.5, h * 0.32, 42],
        [w * 0.33, h * 0.38, 32],
        [w * 0.67, h * 0.38, 32],
        [w * 0.42, h * 0.24, 30],
        [w * 0.58, h * 0.24, 30]
      ];
      for (const [cx, cy, cr] of blobs) {
        const g = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, cr);
        g.addColorStop(0, tree.accentColor);
        g.addColorStop(1, tree.color);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // --------------------------------------------------------------------------
  // GOOGLE STREET VIEW REAL (Vila Mariana, SP) — ver src/streetview.js
  // --------------------------------------------------------------------------
  _initStreetView() {
    this.svVista = SV_VISTAS[0];
    this.svChips.innerHTML = SV_VISTAS.map((v) => `<button class="sv-chip" data-id="${v.id}">${v.nome}</button>`).join('');
    this.svChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.sv-chip');
      if (btn) this.openStreetView(SV_VISTAS.find((v) => v.id === btn.dataset.id));
    });
    document.getElementById('sv-key-save').addEventListener('click', () => {
      svSetToken(document.getElementById('sv-key-input').value);
      this._renderStreetView();
    });
    document.getElementById('sv-key-clear').addEventListener('click', () => {
      svSetToken('');
      document.getElementById('sv-key-input').value = '';
      this._renderStreetView();
    });
  }

  // --------------------------------------------------------------------------
  // MAPA REAL 3D DO ENTORNO (modo Localização) — ver src/mapaEntorno.js
  // --------------------------------------------------------------------------
  _initMapaEntorno() {
    this.mapaEl = document.getElementById('mapa-entorno');
    this.mapaVisivel = false;
    this.mapa = new MapaEntorno({ el: this.mapaEl, abrirStreetView: (p) => this.openStreetView(p) });
    // Alternância suave entre o Mapa Real (MapLibre) e a cena 3D com raios de distância
    document.getElementById('mapa-btn-3d')?.addEventListener('click', () => this._mostrarMapa(false));
    document.getElementById('loc-btn-mapa')?.addEventListener('click', () => this._mostrarMapa(true));
    document.getElementById('loc-btn-sv')?.addEventListener('click', () => this.openStreetView());
  }

  _mostrarMapa(visivel) {
    const showMap = !!visivel && this.currentMode === 'localizacao';
    this.mapaVisivel = showMap;
    if (this.mapaEl) this.mapaEl.hidden = !showMap;
    if (this.loc3dCard) {
      this.loc3dCard.hidden = !(this.currentMode === 'localizacao' && !showMap);
    }
    if (showMap && this.mapa) this.mapa.mostrar();
    this._atualizarPausa3D();
    if (this.currentMode === 'localizacao' && !showMap) {
      this._updateFloatingLabels();
    }
  }

  // a maquete 3D só desenha quando está visível (o mapa e o Street View cobrem a tela inteira)
  _atualizarPausa3D() {
    this.scene3d.setPausado(this.mapaVisivel || !this.streetviewOverlay.hidden || !!window.tour360?.dialog.open);
  }

  // ponto = { nome, lat, lng, heading }; sem argumento abre a frente do empreendimento
  openStreetView(ponto) {
    this.svVista = ponto || SV_VISTAS[0];
    this.streetviewOverlay.hidden = false;
    this._atualizarPausa3D();
    this._renderStreetView();
  }

  async _renderStreetView() {
    const p = this.svVista;
    const doEntorno = SV_VISTAS.some((v) => v.id === p.id);
    this.svTitle.textContent = doEntorno ? `Entorno do empreendimento — ${p.nome}` : `${p.nome} — Vista da Rua`;
    this.svSubtitle.textContent = `${SV_BAIRRO.nome}, ${SV_BAIRRO.cidade} • ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    this.svChips.querySelectorAll('.sv-chip').forEach((c) => c.classList.toggle('active', c.dataset.id === p.id));
    this.svOpenLink.href = svMapsUrl(p);

    const token = svGetToken();
    this.svKeyBox.hidden = !!token;
    this.svViewerEl.hidden = !token;
    if (!token) { this._svStatus(''); return; }

    const pedido = (this._svPedido = (this._svPedido || 0) + 1); // ignora respostas de cliques antigos
    this._svStatus('Procurando a foto de rua mais próxima…');
    try {
      const [mly, img] = await Promise.all([carregarMapillary(), mlyImagemProxima(token, p.lat, p.lng)]);
      if (pedido !== this._svPedido) return;
      if (!img) {
        this._svStatus('O Mapillary não tem foto de rua perto deste ponto. Use “Abrir no Google Maps ↗” no topo.');
        return;
      }
      // recria o visualizador a cada vista: moveTo falha se a foto anterior ainda estiver carregando
      if (this.svViewer) { try { this.svViewer.remove(); } catch (e) { /* já removido */ } }
      this.svViewer = new mly.Viewer({ accessToken: token, container: this.svViewerEl, imageId: img.id });
      const viewer = this.svViewer;
      this._svStatus('');
      if (img.is_pano) {
        // gira o panorama 360° para olhar na direção do terreno assim que a foto estiver pronta
        const girar = () => { try { viewer.setCenter([mlyCentroPano(img, p.heading || 0), 0.5]); } catch (e) { /* sem efeito */ } };
        viewer.on('image', girar);
      }
    } catch (err) {
      if (pedido !== this._svPedido) return;
      if (err.message === 'TOKEN') {
        svSetToken('');
        this.svKeyBox.hidden = false;
        this.svViewerEl.hidden = true;
        this._svStatus('O Mapillary recusou o token. Confira se é o “Client Token” (começa com MLY|) e cole de novo.');
      } else {
        this._svStatus(err.message || 'Falha ao carregar o Street View.');
      }
    }
  }

  _svStatus(msg) {
    this.svStatus.textContent = msg;
    this.svStatus.hidden = !msg;
  }

  closeStreetView() {
    this.streetviewOverlay.hidden = true;
    this._atualizarPausa3D();
  }

  // ==========================================================================
  // NAVEGAÇÃO ENTRE OS MODOS E CÂMERAS DO SISTEMA
  // ==========================================================================
  setCameraPresetUI(preset) {
    this.activeCamPreset = preset;
    this.btnCamAerea.classList.toggle('active', preset === 'aerea');
    this.btnCamFrontal.classList.toggle('active', preset === 'frontal');
    this.btnCamPlanta.classList.toggle('active', preset === 'planta_baixa');

    if (preset === 'planta_baixa') {
      this.switchMode('planta');
    } else {
      if (this.currentMode === 'planta') {
        this.switchMode('desmonte');
      }
      this.scene3d.setCameraPreset(preset);
    }
  }

  switchMode(mode, opts = {}) {
    const previousMode = this.currentMode;

    // Clicar novamente em Localização alterna suavemente entre o Mapa Real (MapLibre) e o Entorno 3D
    if (mode === 'localizacao' && previousMode === 'localizacao') {
      const nextMapState = (typeof opts.showMap === 'boolean') ? opts.showMap : !this.mapaVisivel;
      if (this.mapa) this._mostrarMapa(nextMapState);
      return;
    }

    this.currentMode = mode;
    this.hoverTooltip.hidden = true;

    if (mode !== 'unidades') {
      this._hideSyncToast();
    }
    if (mode !== 'desmonte') {
      this.towerDomElements.forEach(item => item.el.classList.remove('active'));
    }

    this.navFilme.classList.toggle('active', mode === 'filme');
    this.navFachada.classList.toggle('active', mode !== 'filme');

    this.btnModeDesmonte.classList.toggle('active', mode === 'desmonte');
    this.btnModePlanta.classList.toggle('active', mode === 'planta');
    this.btnModeLocalizacao.classList.toggle('active', mode === 'localizacao');
    this.btnModeUnidades.classList.toggle('active', mode === 'unidades');

    this.btnCamPlanta.classList.toggle('active', mode === 'planta');
    if (mode !== 'planta') {
      this.btnCamAerea.classList.toggle('active', this.activeCamPreset === 'aerea');
      this.btnCamFrontal.classList.toggle('active', this.activeCamPreset === 'frontal');
    } else {
      this.btnCamAerea.classList.remove('active');
      this.btnCamFrontal.classList.remove('active');
    }

    this.editorialPanel.hidden = (mode !== 'filme');
    this.desmontePanel.hidden = (mode !== 'desmonte');
    this.plantaGeralSidebar.hidden = (mode !== 'planta');
    this.availabilityHud.hidden = (mode !== 'unidades');
    this.bottomDock.hidden = (mode === 'filme');

    const labels = {
      filme: 'Apresentação Institucional — Contemple o Novo',
      desmonte: 'Maquete 3D & Desmonte Interativo (Planta em H)',
      planta: 'Planta Baixa Geral — Condomínio Residencial e Aluguel',
      localizacao: 'Mapa do Entorno 3D (Vila Mariana) & Street View',
      unidades: `Disponibilidade Comercial em Tempo Real (${this.units.length} Unidades)`
    };
    this.activeModeLabel.textContent = labels[mode] || 'Maquete 3D';

    this.scene3d.setMode(mode);
    if (this.mapa) {
      const openMap = mode === 'localizacao' && (typeof opts.showMap === 'boolean' ? opts.showMap : true);
      this._mostrarMapa(openMap);
    }
    if (mode === 'desmonte' && this.aptCtx) {
      if (this.activeApt) {
        this.aptPanel.hidden = false;
      } else {
        const ctx = this.aptCtx;
        this.aptCtx = null; // força remontar o painel do andar cortado
        this._syncAptPanel(ctx);
      }
    } else {
      this.aptPanel.hidden = true;
    }

    if (mode === 'unidades' && previousMode !== 'unidades') {
      this._triggerAvailabilitySyncToast();
    }
  }

  _hideSyncToast() {
    if (this._syncToastTimer) {
      clearTimeout(this._syncToastTimer);
      this._syncToastTimer = null;
    }
    if (this._syncToastHideTimer) {
      clearTimeout(this._syncToastHideTimer);
      this._syncToastHideTimer = null;
    }
    if (this.syncToastOverlay) {
      this.syncToastOverlay.hidden = true;
    }
  }

  _triggerAvailabilitySyncToast() {
    this._hideSyncToast();
    this.syncToastOverlay.hidden = false;
    const total = this.units.length;
    const startedAt = performance.now();
    this.syncSubText.textContent = `Sincronizando ${Math.round(total * 0.55)}/${total}`;

    this._syncToastTimer = setTimeout(() => {
      this._syncToastTimer = null;
      if (performance.now() - startedAt >= 340) {
        this._hideSyncToast();
        return;
      }
      this.syncSubText.textContent = `Sincronizando ${total}/${total}`;
    }, 140);

    this._syncToastHideTimer = setTimeout(() => {
      this._hideSyncToast();
    }, 340);
  }

  // ==========================================================================
  // CONTROLES DO DESMONTE INTERATIVO
  // ==========================================================================
  _setDesmonteState(towerId, floorNum, animate = true) {
    this.towerChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.tower === towerId);
    });
    this.towerDomElements.forEach(item => {
      item.el.classList.toggle('active', item.cfg.id === towerId);
    });

    const cfg = TOWERS_CONFIG.find(t => t.id === towerId);
    const maxF = cfg ? cfg.floors : Math.max(...TOWERS_CONFIG.map(t => t.floors));
    this.floorCutSlider.max = String(maxF + 1);
    this.floorCutSlider.value = String(floorNum);
    paintRange(this.floorCutSlider);

    this.desmonteTowerName.textContent = cfg ? `${cfg.name} (${cfg.floors} andares)` : 'Todas as Torres';
    if (floorNum > maxF) {
      this.floorCutLabel.textContent = 'Cobertura (Completo)';
    } else {
      this.floorCutLabel.textContent = `${floorNum}º andar`;
    }

    this.scene3d.setFloorCut(towerId, floorNum, animate);
    this._syncAptPanel(cfg && floorNum <= cfg.floors ? { tower: towerId, floor: floorNum } : null);
  }

  // ==========================================================================
  // PAINEL DO APARTAMENTO — planta em variação + recortes dos cômodos
  // ==========================================================================
  _units4(ctx) {
    return [1, 2, 3, 4]
      .map(i => this.unitsById.get(`${ctx.tower}-${String(ctx.floor).padStart(2, '0')}${i}`))
      .filter(Boolean);
  }

  _syncAptPanel(ctx) {
    const same = ctx && this.aptCtx && ctx.tower === this.aptCtx.tower && ctx.floor === this.aptCtx.floor;
    this.aptCtx = ctx;
    if (!ctx || this.currentMode !== 'desmonte') {
      this.aptPanel.hidden = true;
      this.activeApt = null;
      this.scene3d.setSelectedApartment(null, false);
      return;
    }
    if (same && !this.aptPanel.hidden) return;
    const units = this._units4(ctx);
    this.aptKicker.textContent = `TORRE ${ctx.tower} · ${ctx.floor}º ANDAR`;
    this.aptTabs.innerHTML = '';
    units.forEach(u => {
      const b = document.createElement('button');
      b.className = 'apt-tab';
      b.dataset.unit = u.id;
      b.innerHTML = `<span><i class="st-dot st-${u.status}"></i>${u.code.split('-')[1]}</span><small>${u.dorms} dorms</small>`;
      b.title = `${u.code} · ${plantaInfo(u.planta)?.nome || ''}`;
      b.addEventListener('click', () => this.selectApartment(u));
      this.aptTabs.appendChild(b);
    });
    this.aptPanel.hidden = false;
    if (units[0]) this.selectApartment(units[0], false);
  }

  selectApartment(unit, fly = true) {
    if (!unit) return;
    if (!this.aptCtx || this.aptCtx.tower !== unit.tower || this.aptCtx.floor !== unit.floor) {
      this.aptCtx = { tower: unit.tower, floor: unit.floor };
    }
    this.activeApt = unit;
    this.scene3d.setSelectedApartment(unit, fly);
    const info = plantaInfo(unit.planta);
    const st = unit.status === 'disponivel' ? 'Disponível' : unit.status === 'reservado' ? 'Reservado' : 'Vendido';
    this.aptTitle.textContent = `${unit.code} · ${info ? info.nome : unit.planta}`;
    this.aptSub.textContent = `${unit.dorms} dorms · ${unit.suites} suítes · ${unit.area} m² · ${st}`;
    const labelTitle = document.getElementById('apt-label-title');
    if (labelTitle) labelTitle.textContent = `Ambientes do ${unit.code}`;
    this.aptTabs.querySelectorAll('.apt-tab').forEach(b => b.classList.toggle('active', b.dataset.unit === unit.id));

    const items = [
      ...COMODOS.map(c => ({
        src: comodoUrl(unit.planta, c.id), nome: c.nome, room: c.id,
        has360: !!TOUR_CATALOG[unit.planta]?.rooms.some(r => r.id === c.id)
      })),
      { src: plantaUrl(unit.planta), nome: 'Planta', planta: true }
    ];
    this.aptThumbs.innerHTML = '';
    items.forEach((it, i) => {
      // cada foto vira um "bloco" do apartamento: miniatura + nome visível + selo 360° quando há panorama do mesmo ambiente
      const tile = document.createElement('div');
      tile.className = 'apt-tile';
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'apt-thumb';
      t.title = `${it.nome} · ${unit.code}`;
      t.setAttribute('aria-label', `${it.nome} do ${unit.code}: ver foto`);
      t.innerHTML = `<img src="${it.src}" alt="" loading="lazy" decoding="async">`;
      t.addEventListener('click', () => this._setAptMain(items, i));
      const name = document.createElement('span');
      name.className = 'apt-tile-name';
      name.textContent = it.nome;
      tile.append(t, name);
      if (it.has360) {
        const v = document.createElement('button');
        v.type = 'button';
        v.className = 'apt-360';
        v.textContent = '360°';
        v.title = `Visitar ${it.nome} em 360°`;
        v.setAttribute('aria-label', `Visitar ${it.nome} do ${unit.code} em 360 graus`);
        v.addEventListener('click', (e) => { e.stopPropagation(); this._openTour360(unit.planta, it.room); });
        tile.append(v);
      }
      this.aptThumbs.appendChild(tile);
    });
    this._setAptMain(items, 0);
  }

  _setAptMain(items, i) {
    const it = items[i];
    this.aptMainImg.src = it.src;
    this.aptMainImg.alt = it.nome;
    this.aptMainImg.classList.toggle('is-planta', !!it.planta);
    this.aptMainCap.textContent = it.nome;
    this.aptThumbs.querySelectorAll('.apt-thumb').forEach((el, k) => el.classList.toggle('active', k === i));
  }

  _updateAptTags() {
    const anchors = (this.currentMode === 'desmonte' && this.aptCtx) ? this.scene3d.getApartmentAnchors() : [];
    while (this.aptTagEls.length < anchors.length) {
      const el = document.createElement('button');
      el.className = 'apt-tag-3d';
      el.addEventListener('click', (e) => { e.stopPropagation(); if (el._unit) { this.selectApartment(el._unit); this._openTour360(el._unit.planta); } });
      this.aptTagsLayer.appendChild(el);
      this.aptTagEls.push(el);
    }
    this.aptTagEls.forEach((el, i) => {
      const a = anchors[i];
      const pos = a && this.scene3d.projectToScreen(a.x, a.y, a.z);
      if (!pos) { if (!el.hidden) el.hidden = true; return; }
      if (el._unit !== a.unit) {
        el._unit = a.unit;
        el.innerHTML = `<i class="st-dot st-${a.unit.status}"></i>${a.unit.code}`;
      }
      el.classList.toggle('active', !!this.activeApt && this.activeApt.id === a.unit.id);
      el.hidden = false;
      el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)`;
    });
  }

  _syncDesmonteUIFrom3D(towerId, floorNum) {
    this._setDesmonteState(towerId, floorNum, false);
  }

  // ==========================================================================
  // HOVER E CARD DE DETALHE DA UNIDADE
  // ==========================================================================
  _handleUnitHover(unit, x, y) {
    if (!unit) {
      this.hoverTooltip.hidden = true;
      return;
    }
    this.hoverTooltip.textContent = unit.code;
    this.hoverTooltip.style.left = `${x}px`;
    this.hoverTooltip.style.top = `${y}px`;
    this.hoverTooltip.hidden = false;
  }

  openUnitPopup(unit) {
    if (!unit) return;
    this.activeUnit = unit;
    this.activeUnitView = 'render';

    this.upPrice.textContent = `Preço: ${formatBRL(unit.price)}`;
    this.upUnitCode.textContent = `UNIDADE: ${unit.code}`;
    this.upDorms.textContent = String(unit.dorms);
    this.upSuites.textContent = String(unit.suites);
    this.upVagas.textContent = String(unit.vagas);
    this.upArea.textContent = unit.area;

    this.upStatusBadge.className = `unit-status-pill status-${unit.status}`;
    this.upStatusBadge.textContent =
      unit.status === 'disponivel' ? 'DISPONÍVEL' :
      unit.status === 'reservado' ? 'RESERVADO' : 'VENDIDO';

    document.querySelectorAll('.u-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.uview === 'render');
    });

    this.unitPopupBackdrop.hidden = false;
    this.unitPopupLoading.hidden = false;
    this._renderUnitMedia('render');

    setTimeout(() => {
      this.unitPopupLoading.hidden = true;
    }, 240);
  }

  // 'render' = recortes dos 6 cômodos; 'planta' = planta humanizada da variação da unidade
  _renderUnitMedia(view, roomIdx = 0) {
    const u = this.activeUnit;
    if (!u) return;
    const planta = view === 'planta';
    this.unitPopupVisual.classList.toggle('view-planta', planta);
    this.upThumbs.hidden = planta;
    if (planta) {
      this.upMainImg.src = plantaUrl(u.planta);
      this.upMainImg.alt = `Planta ${u.planta}`;
      return;
    }
    const room = COMODOS[roomIdx];
    this.upMainImg.src = comodoUrl(u.planta, room.id);
    this.upMainImg.alt = room.nome;
    this.upThumbs.innerHTML = '';
    COMODOS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'up-thumb' + (i === roomIdx ? ' active' : '');
      b.innerHTML = `<img src="${comodoUrl(u.planta, c.id)}" alt="${c.nome}" decoding="async"><span>${c.nome}</span>`;
      b.addEventListener('click', () => this._renderUnitMedia('render', i));
      this.upThumbs.appendChild(b);
    });
  }

  closeUnitPopup() {
    this.unitPopupBackdrop.hidden = true;
  }

  // ==========================================================================
  // MODAL "Buscar unidades"
  // ==========================================================================
  openSearchModal(withLoadingEffect = false) {
    this.searchModalBackdrop.hidden = false;
    if (withLoadingEffect) {
      this.searchLoadingBox.hidden = false;
      this.searchResultsGrid.hidden = true;
      setTimeout(() => {
        this.searchLoadingBox.hidden = true;
        this.searchResultsGrid.hidden = false;
        this._renderSearchResults();
      }, 320);
    } else {
      this.searchLoadingBox.hidden = true;
      this.searchResultsGrid.hidden = false;
      this._renderSearchResults();
    }
  }

  closeSearchModal() {
    this.searchModalBackdrop.hidden = true;
  }

  _updateAvailabilityCounts() {
    const disp = this.units.filter(u => u.status === 'disponivel').length;
    const res = this.units.filter(u => u.status === 'reservado').length;
    const vend = this.units.filter(u => u.status === 'vendido').length;
    document.getElementById('count-disp').textContent = String(disp);
    document.getElementById('count-res').textContent = String(res);
    document.getElementById('count-vend').textContent = String(vend);
  }

  _getFilteredUnits() {
    const q = this.fUnitQuery.value.trim().toLowerCase().replace(/\s+/g, '');
    const torre = this.fTorre.value;
    const status = this.fStatus.value;
    const dorms = this.fDorms.value;
    const suites = this.fSuites.value;
    const vagas = this.fVagas.value;
    const areaFilter = this.fArea.value;
    const pMin = Number(this.fPriceMin.value || 0);
    const pMax = Number(this.fPriceMax.value || 99999999);

    return this.units.filter(u => {
      if (q) {
        const cleanCode = u.code.toLowerCase().replace('-', '');
        const rawCode = u.code.toLowerCase();
        const titleClean = u.displayTitle.toLowerCase().replace(/\s+/g, '');
        if (!rawCode.includes(q) && !cleanCode.includes(q) && !titleClean.includes(q)) {
          return false;
        }
      }
      if (torre !== 'ALL' && u.tower !== torre) return false;
      if (status !== 'ALL' && u.status !== status) return false;
      if (dorms !== 'ALL' && String(u.dorms) !== dorms) return false;
      if (suites !== 'ALL' && String(u.suites) !== suites) return false;
      if (vagas !== 'ALL' && String(u.vagas) !== vagas) return false;

      if (areaFilter !== 'ALL') {
        if (areaFilter === '53' && u.areaNum > 73) return false;
        if (areaFilter === '74' && (u.areaNum <= 73 || u.areaNum > 112)) return false;
        if (areaFilter === '118' && (u.areaNum <= 112 || u.areaNum > 135)) return false;
        if (areaFilter === '161' && u.areaNum <= 135) return false;
      }

      if (u.price < pMin || u.price > pMax) return false;
      return true;
    });
  }

  _renderSearchResults() {
    const filtered = this._getFilteredUnits();
    this.unitsFoundCount.textContent = `${filtered.length} unidades encontradas`;

    const visibleSlice = filtered.slice(0, 60);
    this.searchResultsGrid.innerHTML = '';

    for (const u of visibleSlice) {
      const card = document.createElement('article');
      card.className = 'unit-result-card';

      const thumbUrl = comodoUrl(u.planta, 'sala');
      const stLabel =
        u.status === 'disponivel' ? 'Disponível' :
        u.status === 'reservado' ? 'Reservado' : 'Vendido';

      const dormText = u.dorms === 1 ? '1 dorm' : `${u.dorms} dorms`;
      const suiteText = u.suites === 1 ? '1 suíte' : `${u.suites} suítes`;
      const vagaText = u.vagas === 1 ? '1 vaga' : `${u.vagas} vagas`;

      card.innerHTML = `
        <div class="urc-thumb" style="background-image: url('${thumbUrl}')" role="img" aria-label="${u.displayTitle}"></div>
        <div class="urc-body">
          <div>
            <div class="urc-top">
              <strong class="urc-title">${u.displayTitle}</strong>
              <span class="urc-status st-${u.status}">${stLabel}</span>
            </div>
            <div class="urc-specs">
              <span class="urc-spec-pill">${dormText}</span>
              <span class="urc-spec-pill">${suiteText}</span>
              <span class="urc-spec-pill">${vagaText}</span>
              <span class="urc-spec-pill">${u.area} m²</span>
            </div>
          </div>
          <div>
            <div class="urc-price">${formatBRL(u.price)}</div>
            <button class="btn-ver-unidade" data-unit-code="${u.id}">Ver unidade</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-ver-unidade').addEventListener('click', () => {
        this.closeSearchModal();
        if (this.currentMode !== 'unidades') {
          this.switchMode('unidades');
        }
        this.scene3d.focusOnUnit(u.id);
        this.openUnitPopup(u);
      });

      this.searchResultsGrid.appendChild(card);
    }
  }

  _clearFilters() {
    this.fUnitQuery.value = '';
    this.fTorre.value = 'ALL';
    this.fStatus.value = 'ALL';
    this.fDorms.value = 'ALL';
    this.fSuites.value = 'ALL';
    this.fVagas.value = 'ALL';
    this.fArea.value = 'ALL';
    this.fPriceMin.value = '0';
    this.fPriceMax.value = '99999999';
    this._renderSearchResults();
  }

  // ==========================================================================
  // EVENTOS GERAIS DE INTERFACE
  // ==========================================================================
  _bindUIEvents() {
    // Botões de modo inferior
    this.btnModeDesmonte.addEventListener('click', () => this.switchMode('desmonte'));
    this.btnModePlanta.addEventListener('click', () => this.switchMode('planta'));
    this.btnModeLocalizacao.addEventListener('click', () => this.switchMode('localizacao'));
    this.btnModeUnidades.addEventListener('click', () => {
      if (this.currentMode === 'unidades') {
        this.openSearchModal(true);
      } else {
        this.switchMode('unidades');
      }
    });

    // Atalhos de Vistas e Pranchas no Topo
    this.btnCamAerea.addEventListener('click', () => this.setCameraPresetUI('aerea'));
    this.btnCamFrontal.addEventListener('click', () => this.setCameraPresetUI('frontal'));
    this.btnCamPlanta.addEventListener('click', () => this.setCameraPresetUI('planta_baixa'));

    document.getElementById('btn-close-planta-sidebar').addEventListener('click', () => {
      this.setCameraPresetUI('aerea');
    });

    // Modal Paisagismo (Prancha 2)
    this.btnOpenPaisagismo?.addEventListener('click', () => {
      this.paisagismoModalBackdrop.hidden = false;
    });
    document.getElementById('btn-close-paisagismo-modal').addEventListener('click', () => {
      this.paisagismoModalBackdrop.hidden = true;
    });
    this.paisagismoModalBackdrop.addEventListener('click', (e) => {
      if (e.target === this.paisagismoModalBackdrop) this.paisagismoModalBackdrop.hidden = true;
    });

    // Modal Ficha Técnica & Materiais (Prancha 5)
    this.btnOpenFicha?.addEventListener('click', () => {
      this.fichaModalBackdrop.hidden = false;
    });
    document.getElementById('btn-close-ficha-modal').addEventListener('click', () => {
      this.fichaModalBackdrop.hidden = true;
    });
    this.fichaModalBackdrop.addEventListener('click', (e) => {
      if (e.target === this.fichaModalBackdrop) this.fichaModalBackdrop.hidden = true;
    });

    document.querySelectorAll('.btn-focus-3d-sheet').forEach(btn => {
      btn.addEventListener('click', () => {
        this.fichaModalBackdrop.hidden = true;
        if (btn.dataset.focusTower) {
          this.switchMode('desmonte');
          const tId = btn.dataset.focusTower;
          const cfg = TOWERS_CONFIG.find(t => t.id === tId);
          this._setDesmonteState(tId, cfg ? Math.floor(cfg.floors * 0.65) : 10, true);
        } else if (btn.dataset.focusSector) {
          this.switchMode('desmonte');
          this.scene3d.focusOnSector(btn.dataset.focusSector);
        }
      });
    });

    document.querySelectorAll('.amenity-mini-card').forEach(card => {
      card.addEventListener('click', () => {
        this.fichaModalBackdrop.hidden = true;
        if (card.dataset.focusSector) {
          this.switchMode('desmonte');
          this.scene3d.focusOnSector(card.dataset.focusSector);
          this._openTour360('COMUM', card.dataset.focusSector);
        }
      });
    });

    // Links do cabeçalho ("Filme" | "Fachada Interativa")
    this.navFilme.addEventListener('click', () => this.switchMode('filme'));
    this.navFachada.addEventListener('click', () => this.switchMode('desmonte'));
    document.getElementById('btn-brand-home').addEventListener('click', () => this.setCameraPresetUI('aerea'));
    document.getElementById('btn-enter-interactive').addEventListener('click', () => this.switchMode('desmonte'));

    // Controles do Desmonte Interativo
    this.towerChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const tId = chip.dataset.tower;
        const cfg = TOWERS_CONFIG.find(t => t.id === tId);
        const targetFloor = cfg ? Math.max(5, Math.floor(cfg.floors * 0.65)) : 19;
        this._setDesmonteState(tId, targetFloor, true);
      });
    });

    this.floorCutSlider.addEventListener('input', () => {
      const fVal = Number(this.floorCutSlider.value);
      this._setDesmonteState(this.scene3d.selectedTowerId, fVal, false);
    });

    document.getElementById('btn-reset-cut').addEventListener('click', () => {
      this._setDesmonteState('ALL', 19, true);
      this.scene3d.setCameraPreset('aerea');
    });

    document.querySelectorAll('.floor-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = Number(btn.dataset.floor);
        const t = btn.dataset.tower;
        this._setDesmonteState(t, f, true);
      });
    });

    // Atalhos de unidades
    document.querySelectorAll('.btn-QuickUnit').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.dataset.unitId;
        const u = this.unitsById.get(uId);
        if (u) {
          this.scene3d.focusOnUnit(u.id);
          this.openUnitPopup(u);
        }
      });
    });

    // Botões de abrir modal "Buscar unidades"
    document.getElementById('btn-open-search-top').addEventListener('click', () => {
      if (this.currentMode !== 'unidades') this.switchMode('unidades');
      this.openSearchModal(false);
    });
    document.getElementById('btn-open-filter-hud').addEventListener('click', () => {
      this.openSearchModal(true);
    });
    document.getElementById('btn-close-search-modal').addEventListener('click', () => this.closeSearchModal());
    this.searchModalBackdrop.addEventListener('click', (e) => {
      if (e.target === this.searchModalBackdrop) this.closeSearchModal();
    });

    const filterInputs = [
      this.fUnitQuery, this.fTorre, this.fStatus, this.fDorms,
      this.fSuites, this.fVagas, this.fArea, this.fPriceMin, this.fPriceMax
    ];
    filterInputs.forEach(inp => {
      inp.addEventListener('input', () => this._renderSearchResults());
      inp.addEventListener('change', () => this._renderSearchResults());
    });

    document.getElementById('btn-clear-filters').addEventListener('click', () => this._clearFilters());

    document.getElementById('btn-preset-1m').addEventListener('click', () => {
      this._clearFilters();
      this.fStatus.value = 'disponivel';
      this.fPriceMin.value = '1000000';
      this._renderSearchResults();
    });

    // Painel do apartamento
    document.getElementById('apt-close').addEventListener('click', () => {
      this.aptPanel.hidden = true;
    });
    document.getElementById('apt-open').addEventListener('click', () => {
      if (this.activeApt) this.openUnitPopup(this.activeApt);
    });

    // Eventos do Card Flutuante da Unidade
    document.getElementById('btn-close-unit-popup').addEventListener('click', () => this.closeUnitPopup());
    this.unitPopupBackdrop.addEventListener('click', (e) => {
      if (e.target === this.unitPopupBackdrop) this.closeUnitPopup();
    });

    document.querySelectorAll('.u-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.uview;
        if (view === 'foco3d' && this.activeUnit) {
          this.closeUnitPopup();
          if (this.activeUnit.tower === 'CASA') {
            this.switchMode('planta');
            this.scene3d.focusOnSector('casas_aluguel');
          } else {
            this.switchMode('desmonte');
            this._setDesmonteState(this.activeUnit.tower, this.activeUnit.floor, true);
          }
          return;
        }
        document.querySelectorAll('.u-tab').forEach(t => t.classList.toggle('active', t === tab));
        if (this.activeUnit) {
          this._renderUnitMedia(view);
        }
      });
    });

    // Eventos do Google Street View 360°
    document.getElementById('btn-close-streetview').addEventListener('click', () => this.closeStreetView());
    document.getElementById('btn-open-streetview').addEventListener('click', () => this.openStreetView());

    // Eventos do Player do Vídeo Original (Reel)
    this.referenceVideoSelect?.addEventListener('change', () => {
      const val = this.referenceVideoSelect.value;
      queueMicrotask(() => {
        if (this.refVideoPlayer && this.refVideoPlayer.getAttribute('src') !== val) {
          this.refVideoPlayer.pause();
          this.refVideoPlayer.src = val;
          this.refVideoPlayer.load();
        }
        if (this.referenceVideoDownload && this.referenceVideoDownload.getAttribute('href') !== val) {
          this.referenceVideoDownload.href = val;
        }
      });
    });
    document.getElementById('btn-ref-video')?.addEventListener('click', () => {
      this.reelModalBackdrop.hidden = false;
      this.refVideoPlayer.play().catch(() => {});
    });
    document.getElementById('btn-close-reel-modal').addEventListener('click', () => {
      this.refVideoPlayer.pause();
      this.reelModalBackdrop.hidden = true;
    });
    this.reelModalBackdrop.addEventListener('click', (e) => {
      if (e.target === this.reelModalBackdrop) {
        this.refVideoPlayer.pause();
        this.reelModalBackdrop.hidden = true;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.reelModalBackdrop.hidden) {
          this.refVideoPlayer.pause();
          this.reelModalBackdrop.hidden = true;
        } else if (!this.paisagismoModalBackdrop.hidden) {
          this.paisagismoModalBackdrop.hidden = true;
        } else if (!this.fichaModalBackdrop.hidden) {
          this.fichaModalBackdrop.hidden = true;
        } else if (!this.unitPopupBackdrop.hidden) {
          this.closeUnitPopup();
        } else if (!this.searchModalBackdrop.hidden) {
          this.closeSearchModal();
        } else if (!this.streetviewOverlay.hidden) {
          this.closeStreetView();
        }
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.ilusaoApp = new IlusaoDigitalApp();
});
