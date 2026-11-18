// ==========================================================================
// FUSÃO DE MALHAS ESTÁTICAS — corta milhares de chamadas de desenho sem mudar o visual
// Cada objeto da cena custa uma chamada de desenho por quadro (e outra na passada de sombras).
// A maquete tinha ~17 mil objetos pequenos; aqui os que são opacos, parados e do mesmo material
// viram uma malha só. O que é alternado em tempo de execução (andares, coberturas, luzes, água)
// fica protegido: cada grupo protegido é fundido só por dentro, então continua ligando e desligando.
// ==========================================================================

import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';

const _inv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();

// Assinatura do material: dois materiais com as mesmas propriedades visuais viram um só
function assinatura(m) {
  const t = (x) => (x ? x.uuid : '-');
  const hex = (c) => (c && c.isColor ? c.getHex() : '-');
  return [
    m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.roughness, m.metalness,
    m.opacity, m.side, t(m.map), t(m.normalMap), t(m.roughnessMap), t(m.metalnessMap), t(m.emissiveMap),
    m.envMapIntensity, m.reflectivity, m.flatShading, m.vertexColors, m.alphaTest, m.fog,
    m.depthWrite, m.depthTest, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.toneMapped,
    m.clearcoat, m.transmission, m.ior, m.sheen, m.specularIntensity
  ].join('|');
}

// Devolve '' se a malha pode ser fundida, ou o motivo de não poder
function motivoInelegivel(mesh, skip) {
  if (!mesh.isMesh) return 'nao_malha';
  if (mesh.isInstancedMesh) return 'instanciada';
  if (mesh.isSkinnedMesh) return 'esqueleto';
  const mat = mesh.material;
  const geo = mesh.geometry;
  if (!mat || !geo || !geo.attributes || !geo.attributes.position) return 'sem_geometria';
  if (Array.isArray(mat)) return 'multi_material';
  if (skip.has(mesh)) return 'ignorada';
  if (mesh.userData && Object.keys(mesh.userData).length) return 'userData';
  if (mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return 'onBeforeRender';
  if (mat.isShaderMaterial || mat.isRawShaderMaterial) return 'shader';
  if (mat.transparent) return 'transparente';
  if (mat.blending !== THREE.NormalBlending) return 'mistura';
  if (mat.wireframe) return 'wireframe';
  if (mat.clippingPlanes && mat.clippingPlanes.length) return 'recorte';
  if (mat.aoMap || mat.lightMap || mat.alphaMap || mat.displacementMap || mat.bumpMap) return 'mapas_extras';
  if (geo.morphAttributes && Object.keys(geo.morphAttributes).length) return 'morph';
  if (mat.vertexColors && !geo.attributes.color) return 'cor_sem_atributo';
  return '';
}

const elegivel = (mesh, skip) => !motivoInelegivel(mesh, skip);

// Conta, por motivo, as malhas visíveis de `root` que não foram (ou não puderam ser) fundidas
export function diagnosticar(root, ignorar = []) {
  const skip = new Set(ignorar);
  const out = {};
  const visivel = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  root.traverse((o) => {
    if (!o.isMesh || o.name === 'fundida' || !visivel(o)) return;
    const k = motivoInelegivel(o, skip) || 'elegivel_mas_sobrou';
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

function geometriaNoDominio(mesh, matRelativa, comCor) {
  const g = mesh.geometry.clone();
  // só os atributos que o material usa; todos os fundidos precisam ter o mesmo conjunto
  for (const nome of Object.keys(g.attributes)) {
    if (nome !== 'position' && nome !== 'normal' && nome !== 'uv' && !(comCor && nome === 'color')) g.deleteAttribute(nome);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  g.clearGroups();
  g.applyMatrix4(matRelativa);
  return g;
}

/**
 * Funde as malhas opacas e estáticas de `root`, por material.
 * @param {THREE.Object3D} root       raiz a otimizar (ainda pode estar fora da cena)
 * @param {object} opcoes
 * @param {THREE.Object3D[]} opcoes.protegidos  grupos alternados em execução: fundidos só por dentro
 * @param {THREE.Object3D[]} opcoes.ignorar     objetos que não podem ser tocados (água, luzes noturnas)
 * @returns {{antes:number, depois:number, materiais:number}}
 */
export function mergeStatic(root, { protegidos = [], ignorar = [] } = {}) {
  // ?semfusao na URL desliga a fusão: serve para comparar antes/depois lado a lado
  if (typeof location !== 'undefined' && /[?&]semfusao/.test(location.search)) return { antes: 0, depois: 0, materiais: 0, desligado: true };
  root.updateMatrixWorld(true);
  const skip = new Set(ignorar);
  const prot = new Set(protegidos.filter((p) => p && p !== root));
  const dominios = [root, ...prot];
  const canonico = new Map(); // assinatura -> material único
  let antes = 0;
  let depois = 0;
  let falhas = 0;
  let erro = '';

  for (const dom of dominios) {
    // 1) coleta as malhas elegíveis deste domínio (sem entrar em outros protegidos nem em grupos ocultos)
    const lista = [];
    const visita = (o) => {
      for (const c of o.children) {
        if (prot.has(c) || !c.visible || c.isLight || c.isCamera) continue;
        if (c.isMesh) { if (elegivel(c, skip)) lista.push(c); } else visita(c);
      }
    };
    visita(dom);
    if (lista.length < 2) continue;

    _inv.copy(dom.matrixWorld).invert();

    // 2) agrupa por material + sombra + ordem de desenho
    const grupos = new Map();
    for (const m of lista) {
      _rel.multiplyMatrices(_inv, m.matrixWorld);
      if (_rel.determinant() < 0) continue; // espelhado (inverte o sentido das faces): deixa como está
      const sig = assinatura(m.material);
      if (!canonico.has(sig)) canonico.set(sig, m.material);
      const chave = `${sig}#${+m.castShadow}${+m.receiveShadow}#${m.renderOrder}#${m.material.vertexColors ? 'c' : '-'}`;
      let g = grupos.get(chave);
      if (!g) { g = { sig, meshes: [], cast: m.castShadow, recv: m.receiveShadow, ordem: m.renderOrder, cor: !!m.material.vertexColors }; grupos.set(chave, g); }
      g.meshes.push({ m, rel: _rel.clone() });
    }

    // 3) funde cada grupo e troca as malhas originais pela fundida
    for (const g of grupos.values()) {
      if (g.meshes.length < 2) continue;
      const geos = g.meshes.map(({ m, rel }) => geometriaNoDominio(m, rel, g.cor));
      let fundida;
      try { fundida = mergeGeometries(geos, false); } catch (e) { fundida = null; erro = String(e && e.message || e); }
      geos.forEach((x) => x.dispose());
      if (!fundida) { falhas += g.meshes.length; if (!erro) erro = 'mergeGeometries devolveu null (atributos diferentes)'; continue; }
      const mesh = new THREE.Mesh(fundida, canonico.get(g.sig));
      mesh.castShadow = g.cast;
      mesh.receiveShadow = g.recv;
      mesh.renderOrder = g.ordem;
      mesh.name = 'fundida';
      mesh.matrixAutoUpdate = false; // parada para sempre
      dom.add(mesh);
      for (const { m } of g.meshes) m.parent.remove(m);
      antes += g.meshes.length;
      depois += 1;
    }
  }
  return { antes, depois, materiais: canonico.size, falhas, erro };
}

// --------------------------------------------------------------------------
// FUSÃO ENTRE ANDARES DE UMA TORRE
// O desmonte liga/desliga andares inteiros. Em vez de manter um grupo por andar (≈15 chamadas de
// desenho cada), todos os andares viram UMA malha por material e cada vértice guarda o número do
// seu andar (aFloor). O vertex shader empurra para fora da tela os vértices de andares acima do
// corte (uniform uFloorCut), o que dá exatamente o mesmo resultado de esconder o grupo.
// A sombra usa um material de profundidade com o mesmo corte.
// --------------------------------------------------------------------------
function injetarCorte(material, uCut) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFloorCut = uCut;
    shader.vertexShader = 'attribute float aFloor;\nuniform float uFloorCut;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  if (aFloor > uFloorCut + 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'
    );
  };
  material.customProgramCacheKey = () => 'floorcut';
  return material;
}

/**
 * @param {THREE.Object3D} tGroup       grupo da torre (pai dos andares)
 * @param {THREE.Object3D[]} andares    grupos dos andares, do 1º ao último (índice 0 = andar 1)
 * @returns {{uCut:{value:number}, antes:number, depois:number}|null}  uCut.value = último andar visível
 */
export function mergeAcrossFloors(tGroup, andares, { ignorar = [] } = {}) {
  if (typeof location !== 'undefined' && /[?&]semfusao/.test(location.search)) return null;
  tGroup.updateMatrixWorld(true);
  const skip = new Set(ignorar);
  const uCut = { value: andares.length };
  _inv.copy(tGroup.matrixWorld).invert();

  const grupos = new Map();
  andares.forEach((fg, idx) => {
    const visita = (o) => {
      for (const c of o.children) {
        if (!c.visible || c.isLight || c.isCamera) continue;
        if (!c.isMesh) { visita(c); continue; }
        if (!elegivel(c, skip)) continue;
        _rel.multiplyMatrices(_inv, c.matrixWorld);
        if (_rel.determinant() < 0) continue;
        const sig = assinatura(c.material);
        const chave = `${sig}#${+c.castShadow}${+c.receiveShadow}#${c.renderOrder}#${c.material.vertexColors ? 'c' : '-'}`;
        let g = grupos.get(chave);
        if (!g) { g = { mat: c.material, meshes: [], cast: c.castShadow, recv: c.receiveShadow, ordem: c.renderOrder, cor: !!c.material.vertexColors }; grupos.set(chave, g); }
        g.meshes.push({ m: c, rel: _rel.clone(), andar: idx + 1 });
      }
    };
    visita(fg);
  });

  let antes = 0;
  let depois = 0;
  const depth = injetarCorte(new THREE.MeshDepthMaterial(), uCut);
  for (const g of grupos.values()) {
    if (g.meshes.length < 2) continue;
    const geos = g.meshes.map(({ m, rel, andar }) => {
      const geo = geometriaNoDominio(m, rel, g.cor);
      geo.setAttribute('aFloor', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(andar), 1));
      return geo;
    });
    let fundida = null;
    try { fundida = mergeGeometries(geos, false); } catch (e) { fundida = null; }
    geos.forEach((x) => x.dispose());
    if (!fundida) continue;
    const mesh = new THREE.Mesh(fundida, injetarCorte(g.mat.clone(), uCut));
    mesh.castShadow = g.cast;
    mesh.receiveShadow = g.recv;
    mesh.renderOrder = g.ordem;
    mesh.customDepthMaterial = depth;
    mesh.name = 'fundida-torre';
    mesh.userData.semFusao = true; // a fusão geral não pode engolir esta malha (perderia aFloor e o corte)
    mesh.matrixAutoUpdate = false;
    tGroup.add(mesh);
    for (const { m } of g.meshes) m.parent.remove(m);
    antes += g.meshes.length;
    depois += 1;
  }
  return { uCut, antes, depois };
}
