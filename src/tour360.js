import * as THREE from 'three';

// Local spherical viewer. No CDN, key or third-party service is needed.
// Seleção: janela "imóvel" (abas + busca), carrossel de ambientes com miniaturas e botões redondos de vidro.

const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
  building: svg('<path d="M5 21V5l9-2v18"/><path d="M14 9h5v12"/><path d="M9 8v.01M9 12v.01M9 16v.01"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  plan: svg('<path d="M4 4h16v16H4z"/><path d="M4 12h8M12 4v16"/>')
};
const CATEGORIES = [['AP', 'Apartamentos'], ['CS', 'Casas'], ['COMUM', 'Áreas comuns']];
const categoryOf = id => (id.startsWith('AP') ? 'AP' : id.startsWith('CS') ? 'CS' : 'COMUM');
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class Tour360 {
  constructor(catalog, onViewSector) {
    this.catalog = catalog;
    this.loadId = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.cat = 'AP';
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'tour360';
    this.dialog.setAttribute('aria-label', 'Visita aos ambientes em 360 graus');
    this.dialog.innerHTML = `<div class="tour-stage" tabindex="0" aria-label="Panorama: arraste para olhar; use as setas para girar e mais ou menos para ampliar"></div>
      <div class="tour-top">
        <button class="tg-pill tg-back" data-action="close" aria-label="Voltar à maquete">${ICON.back}<span>Maquete</span></button>
        <button class="tg-pill tour-prop" data-action="props" aria-haspopup="dialog" aria-expanded="false" aria-controls="tour-picker" aria-label="Escolher outro imóvel">${ICON.building}<span class="tour-prop-name"></span>${ICON.chevron}</button>
        <div class="tour-title"><small></small><h2></h2></div>
      </div>
      <section class="tour-picker" id="tour-picker" hidden aria-label="Escolher imóvel para visitar">
        <div class="tp-head"><div class="tp-seg" role="group" aria-label="Tipo de imóvel"></div><input class="tp-search" type="search" placeholder="Buscar imóvel ou ambiente" aria-label="Buscar imóvel ou ambiente" autocomplete="off"></div>
        <div class="tp-grid"></div>
      </section>
      <div class="tour-status" role="status" aria-live="polite"></div>
      <div class="tour-points" aria-label="Passagens para outros ambientes"></div>
      <div class="tour-tools">
        <button class="tg-round" data-action="plus" aria-label="Aproximar">${ICON.plus}</button>
        <button class="tg-round" data-action="minus" aria-label="Afastar">${ICON.minus}</button>
        <button class="tg-round" data-action="reset" aria-label="Restaurar vista">${ICON.reset}</button>
        <button class="tg-round" data-action="fullscreen" aria-label="Tela cheia">${ICON.full}</button>
        <button class="tg-round" data-action="plan" aria-label="Mostrar a planta" aria-pressed="false">${ICON.plan}</button>
      </div>
      <aside class="tour-plan-card" hidden><strong>Planta da variação</strong><img alt="Planta do imóvel selecionado"></aside>
      <div class="tour-hint">Arraste para olhar ao redor · Toque nos pontos para mudar de ambiente</div>
      <section class="tour-rooms" aria-label="Ambientes"><nav aria-label="Ambientes"></nav></section>
      <div class="tour-image-id" aria-live="polite"><strong></strong><small></small></div>
      <small class="tour-note">Visualização conceitual · <a href="panoramas.html">Todas as imagens</a></small>`;
    document.body.append(this.dialog);
    this.stage = this.dialog.querySelector('.tour-stage');
    this.status = this.dialog.querySelector('.tour-status');
    this.nav = this.dialog.querySelector('.tour-rooms nav');
    this.picker = this.dialog.querySelector('.tour-picker');
    this.propButton = this.dialog.querySelector('.tour-prop');
    this.planButton = this.dialog.querySelector('[data-action="plan"]');
    this.planCard = this.dialog.querySelector('.tour-plan-card');
    this._buildPicker();
    this.dialog.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'close') {
        const sector = this.propertyId === 'COMUM' && this.status.hidden && this.room?.id;
        this.close();
        if (sector) onViewSector?.(sector);
      }
      if (action === 'plus') this.zoom(-8);
      if (action === 'minus') this.zoom(8);
      if (action === 'reset' && this.camera) { this.yaw = 0; this.pitch = 0; this.camera.fov = 75; this.camera.updateProjectionMatrix(); this.render(); }
      if (action === 'props') this._togglePicker(this.picker.hidden);
      if (action === 'plan') {
        this.planCard.hidden = !this.planCard.hidden;
        this.planButton.setAttribute('aria-pressed', String(!this.planCard.hidden));
      }
      if (action === 'fullscreen') {
        const operation = document.fullscreenElement ? document.exitFullscreen() : this.dialog.requestFullscreen?.();
        operation?.catch(() => { this.status.hidden = false; this.status.textContent = 'Tela cheia indisponível neste navegador.'; });
      }
    }));
    // clicar fora da janela do imóvel a fecha; Esc fecha primeiro a janela e só depois a visita
    this.dialog.addEventListener('pointerdown', event => {
      if (!this.picker.hidden && !event.target.closest('.tour-picker, .tour-prop')) this._togglePicker(false);
    });
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (!this.picker.hidden) this._togglePicker(false); else this.close();
    });
    this.dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (/SELECT|INPUT|TEXTAREA/.test(event.target.tagName)) return;
      const moves = {ArrowLeft: [-5,0], ArrowRight: [5,0], ArrowUp: [0,5], ArrowDown: [0,-5]};
      if (moves[event.key]) { event.preventDefault(); this.yaw += moves[event.key][0]; this.pitch = THREE.MathUtils.clamp(this.pitch + moves[event.key][1], -85, 85); this.render(); }
      if (['+', '=','-'].includes(event.key)) { event.preventDefault(); this.zoom(event.key === '-' ? 8 : -8); }
    });
    new ResizeObserver(() => this.resize()).observe(this.stage);
  }

  // ---------- janela de seleção do imóvel ----------
  _buildPicker() {
    const seg = this.dialog.querySelector('.tp-seg');
    for (const [key, label] of CATEGORIES) {
      const total = Object.keys(this.catalog).filter(id => categoryOf(id) === key).length;
      if (!total) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.cat = key;
      button.append(label);
      const count = document.createElement('small'); count.textContent = String(total);
      button.append(count);
      button.addEventListener('click', () => { this.cat = key; this.search.value = ''; this._renderPicker(); });
      seg.append(button);
    }
    this.search = this.dialog.querySelector('.tp-search');
    this.search.addEventListener('input', () => this._renderPicker());
  }

  _renderPicker() {
    const query = norm(this.search.value.trim());
    this.dialog.querySelectorAll('.tp-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === this.cat && !query)));
    const grid = this.dialog.querySelector('.tp-grid');
    grid.replaceChildren();
    let shown = 0;
    for (const [id, property] of Object.entries(this.catalog)) {
      // com texto na busca, procura em todos os tipos; sem texto, mostra só o tipo da aba
      const haystack = norm(property.name + ' ' + property.rooms.map(r => r.name).join(' '));
      if (query ? !haystack.includes(query) : categoryOf(id) !== this.cat) continue;
      shown++;
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'tp-card'; card.dataset.id = id;
      card.setAttribute('aria-current', String(id === this.propertyId));
      const img = new Image();
      img.src = property.rooms[0].src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      const name = document.createElement('strong'); name.textContent = property.name;
      const meta = document.createElement('small'); meta.textContent = `${property.rooms.length} ambientes`;
      card.append(img, name, meta);
      card.addEventListener('click', () => { this._togglePicker(false); this.open(id); });
      grid.append(card);
    }
    if (!shown) {
      const empty = document.createElement('p');
      empty.className = 'tp-empty'; empty.textContent = 'Nenhum imóvel encontrado. Tente outro nome.';
      grid.append(empty);
    }
  }

  _togglePicker(open) {
    this.picker.hidden = !open;
    this.propButton.setAttribute('aria-expanded', String(open));
    if (open) {
      this.cat = categoryOf(this.propertyId || Object.keys(this.catalog)[0]);
      this.search.value = '';
      this._renderPicker();
    }
  }

  initRenderer() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.stage.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 20);
    const geometry = new THREE.SphereGeometry(10, 96, 64);
    geometry.scale(-1, 1, 1);
    this.material = new THREE.MeshBasicMaterial({color: 0xffffff});
    this.sphere = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.sphere);
    this.direction = new THREE.Vector3();
    this.pointer = new Map();
    this.stage.addEventListener('pointerdown', e => {
      this.stage.focus(); this.stage.setPointerCapture(e.pointerId);
      this.pointer.set(e.pointerId, {x:e.clientX,y:e.clientY});
      this.pinchDistance = null;
    });
    this.stage.addEventListener('pointermove', e => {
      const old = this.pointer.get(e.pointerId);
      if (!old) return;
      this.pointer.set(e.pointerId, {x:e.clientX,y:e.clientY});
      if (this.pointer.size === 2) {
        const [a,b] = [...this.pointer.values()];
        const distance = Math.hypot(a.x-b.x,a.y-b.y);
        if (this.pinchDistance) this.zoom((this.pinchDistance-distance)*0.15);
        this.pinchDistance = distance;
      } else {
        this.yaw -= (e.clientX-old.x)*0.15;
        this.pitch = THREE.MathUtils.clamp(this.pitch+(e.clientY-old.y)*0.15,-85,85);
        this.render();
      }
    });
    const release = e => { this.pointer.delete(e.pointerId); this.pinchDistance = null; };
    this.stage.addEventListener('pointerup', release);
    this.stage.addEventListener('pointercancel', release);
    this.stage.addEventListener('lostpointercapture', release);
    this.stage.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY*0.04); }, {passive:false});
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); this.status.hidden = false; this.status.textContent = 'Visualização interrompida. Feche e reabra a visita.'; });
  }

  async open(id = Object.keys(this.catalog)[0], roomId) {
    const property = this.catalog[id];
    if (!property) return;
    if (!this.dialog.open) { this.previousFocus = document.activeElement; this.dialog.showModal(); }
    try { this.initRenderer(); } catch { this.status.hidden = false; this.status.textContent = 'O navegador não conseguiu iniciar a visualização 360°. Ative a aceleração gráfica e tente novamente.'; return; }
    this.property = property; this.propertyId = id;
    this.dialog.querySelector('.tour-prop-name').textContent = property.name;
    this.planButton.hidden = id === 'COMUM';
    this.planButton.setAttribute('aria-pressed', 'false');
    this.planCard.hidden = true;
    if (id !== 'COMUM') this.planCard.querySelector('img').src = `./assets/plantas/web/${id}/planta.webp`;
    this.nav.replaceChildren();
    for (const room of property.rooms) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tour-room'; button.dataset.room = room.id;
      const img = new Image();
      img.src = room.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      const label = document.createElement('span'); label.textContent = room.name;
      button.append(img, label);
      button.addEventListener('click', () => this.go(room.id));
      this.nav.append(button);
    }
    this.resize();
    await this.go(roomId || property.rooms[0].id);
    this.stage.focus();
  }

  async go(roomId) {
    const room = this.property.rooms.find(r => r.id === roomId);
    if (!room) return;
    const request = ++this.loadId;
    this.status.hidden = false; this.status.textContent = 'Abrindo ambiente…';
    this.dialog.setAttribute('aria-busy','true');
    this.dialog.querySelector('.tour-points').replaceChildren();
    try {
      const texture = await new THREE.TextureLoader().loadAsync(room.src);
      if (request !== this.loadId || !this.dialog.open) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      this.material.map?.dispose(); this.material.map = texture; this.material.needsUpdate = true;
      this.room = room; this.yaw = room.yaw || 0; this.pitch = 0;
      this.camera.fov = 75; this.camera.updateProjectionMatrix();
      this.dialog.querySelector('.tour-title small').textContent = this.property.name;
      this.dialog.querySelector('h2').textContent = room.name;
      const identifier = `${this.propertyId}-${room.id}`.toUpperCase().replaceAll('_','-');
      this.dialog.querySelector('.tour-image-id strong').textContent = `${this.property.name} · ${room.name}`;
      this.dialog.querySelector('.tour-image-id small').textContent = `IMAGEM ${identifier}`;
      this.nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-current',b.dataset.room === room.id ? 'true':'false'));
      this.nav.querySelector('[aria-current="true"]')?.scrollIntoView?.({
        inline: 'nearest', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
      this.points = (room.links || []).map(link => {
        const target = this.property.rooms.find(r => r.id === link.to);
        if (!target) return null;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'tour-point';
        const ring = document.createElement('i'); ring.className = 'tp-ring';
        const label = document.createElement('span'); label.textContent = target.name;
        button.append(ring, label);
        button.addEventListener('click', () => this.go(target.id));
        this.dialog.querySelector('.tour-points').append(button);
        return {...link, button};
      }).filter(Boolean);
      this.status.hidden = true;
      this.render();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.stage.animate([{opacity:.3},{opacity:1}],{duration:300});
    } catch {
      if (request !== this.loadId) return;
      this.status.hidden = false;
      this.status.textContent = 'Não foi possível carregar este panorama. Escolha outro ambiente ou tente novamente.';
    } finally { if (request === this.loadId) this.dialog.removeAttribute('aria-busy'); }
  }

  zoom(delta) { if (!this.camera) return; this.camera.fov = THREE.MathUtils.clamp(this.camera.fov+delta,40,95); this.camera.updateProjectionMatrix(); this.render(); }
  resize() {
    if (!this.renderer || !this.dialog.open) return;
    const {width,height} = this.stage.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width,height); this.camera.aspect=width/height; this.camera.updateProjectionMatrix(); this.render();
  }
  vector(yaw,pitch = 0) {
    const y = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch);
    return new THREE.Vector3(-Math.cos(p)*Math.cos(y),Math.sin(p),Math.cos(p)*Math.sin(y));
  }
  render() {
    if (!this.renderer || !this.dialog.open) return;
    const forward = this.vector(this.yaw,this.pitch);
    this.camera.lookAt(forward); this.camera.updateMatrixWorld();
    this.renderer.render(this.scene,this.camera);
    for (const point of this.points || []) {
      const v = this.vector(point.yaw,point.pitch || -15);
      const visible = v.dot(forward)>0;
      v.project(this.camera);
      point.button.hidden = !visible || Math.abs(v.x)>0.88 || Math.abs(v.y)>0.72;
      point.button.style.left = `${(v.x+1)*50}%`; point.button.style.top = `${(1-v.y)*50}%`;
    }
  }
  close() {
    ++this.loadId; this._togglePicker(false); this.dialog.close(); this.material?.map?.dispose();
    if (this.material) { this.material.map=null; this.material.needsUpdate=true; }
    this.pointer?.clear(); this.previousFocus?.focus();
    if (document.fullscreenElement === this.dialog) document.exitFullscreen().catch(()=>{});
  }
}
