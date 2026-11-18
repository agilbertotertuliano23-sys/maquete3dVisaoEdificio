// ==========================================================================
// ÁRVORES E PLANTAS REAIS (modelos 3D reduzidos em assets/arvores, ver tools/preparar-arvores.py)
// Cada modelo é carregado uma vez e desenhado com InstancedMesh: dezenas de árvores custam
// só uma chamada de desenho por parte (e uma por modelo na passada de sombras).
// Os modelos foram normalizados: altura = 1, base em y = 0, centrados em x/z.
// ==========================================================================

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

const NOMES = ['folhosa', 'palmeira', 'tropical1', 'tropical2', 'ipe'];
const BASE = './assets/arvores';

// Tira do GLB as partes (geometria + material) já com a transformação dos nós aplicada
function extrairPartes(cena) {
  cena.updateMatrixWorld(true);
  const partes = [];
  cena.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    partes.push({ geometry: geo, material: o.material });
  });
  return partes;
}

/** Carrega os 4 modelos. Rejeita se algum arquivo faltar (quem chama decide o plano B). */
export async function carregarModelosArvores() {
  const loader = new GLTFLoader();
  const pares = await Promise.all(
    NOMES.map(async (nome) => {
      const gltf = await loader.loadAsync(`${BASE}/${nome}.glb?v=3`);
      return [nome, extrairPartes(gltf.scene)];
    })
  );
  return Object.fromEntries(pares);
}

// variação determinística (sem Math.random: a maquete tem que ser igual a cada abertura)
const ruido = (i, k) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Cria as instâncias e as coloca em `raiz`.
 * @param {THREE.Object3D} raiz
 * @param {Object<string, {geometry, material}[]>} modelos   retorno de carregarModelosArvores
 * @param {Object<string, {x:number, y:number, z:number, altura:number, largura?:number}[]>} posicoes  por nome de modelo
 * @returns {THREE.InstancedMesh[]}
 */
export function instalarArvores(raiz, modelos, posicoes) {
  const criadas = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const esc = new THREE.Vector3();

  for (const [nome, lista] of Object.entries(posicoes)) {
    const partes = modelos[nome];
    if (!partes || !lista.length) continue;
    for (const parte of partes) {
      const im = new THREE.InstancedMesh(parte.geometry, parte.material, lista.length);
      lista.forEach((p, i) => {
        q.setFromAxisAngle(eixoY, ruido(i, 1) * Math.PI * 2);
        const h = p.altura * (0.94 + ruido(i, 2) * 0.12); // ±6% de altura
        const l = h * (p.largura ?? 1);
        esc.set(l, h, l);
        pos.set(p.x, p.y, p.z);
        m4.compose(pos, q, esc);
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.matrixAutoUpdate = false;
      im.computeBoundingSphere();
      im.name = `arvores-${nome}`;
      raiz.add(im);
      criadas.push(im);
    }
  }
  return criadas;
}
