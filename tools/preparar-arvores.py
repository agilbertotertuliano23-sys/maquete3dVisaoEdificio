"""Reduz os modelos de árvore baixados (Tripo, ~1 a 2 milhões de triângulos) para uso na maquete.

Python puro (numpy + scipy + fast-simplification + Pillow), sem Blender: o importador de GLB do
Blender leva horas com 1 milhão de vértices e esta máquina tem pouca memória.

Método: lê o GLB, aplica os nós, solda os vértices, decima por quadráticas (fast-simplification),
e passa a cor da textura para os vértices (cor por vértice, sem UV: a decimação quebraria as costuras).
Saída: altura = 1, base em y = 0, centrado em x/z.

Entrada : C:\\Users\\agilb\\Downloads\\*.glb
Saída   : assets/arvores/<nome>.glb  e  assets/arvores/previa-<nome>.png
Uso     : python tools/preparar-arvores.py [nome ...]
"""
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
import fast_simplification

SRC = r"C:\Users\agilb\Downloads"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "arvores")

# nome -> (arquivo, triângulos alvo, opções)
#   verdes     : peças sem cor/textura no original (material padrão branco) ficam em tons de verde
#   corte_base : (altura, raio, piso) remove o canteiro de terra: faces abaixo da altura e fora do raio do tronco, e tudo abaixo do piso
ENTRADAS = {
    "folhosa": ("round deciduous tree 3d model.glb", 7500, {"verdes": True}),
    "palmeira": ("palm tree 3d model.glb", 6500, {"corte_base": (0.12, 0.062, 0.06)}),
    "tropical1": ("tropical plant 3d model.glb", 6500, {}),
    "tropical2": ("tropical plant 3d model (1).glb", 5500, {}),
    # ipê dos canteiros (3 rosas + 2 amarelos): copa grande, mais triângulos para manter a silhueta
    "ipe": ("árvore 3d realista.glb", 16000, {}),
}

# tons de folhagem (sRGB) para as peças sem cor; escolhidos por peça, sempre os mesmos
VERDES = [(0x2d, 0x5a, 0x1e), (0x3d, 0x7a, 0x28), (0x4f, 0x94, 0x33), (0x66, 0xab, 0x3f), (0x35, 0x6b, 0x24)]

TIPOS = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def ler_glb(caminho):
    d = open(caminho, "rb").read()
    jl, _ = struct.unpack("<II", d[12:20])
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl, _ = struct.unpack("<II", d[off:off + 8])
    return j, d[off + 8: off + 8 + bl]


def acessor(j, binario, idx):
    a = j["accessors"][idx]
    bv = j["bufferViews"][a["bufferView"]]
    dt = np.dtype(TIPOS[a["componentType"]])
    n = NCOMP[a["type"]]
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    passo = bv.get("byteStride") or dt.itemsize * n
    arr = np.ndarray((a["count"], n), dtype=dt, buffer=binario, offset=base, strides=(passo, dt.itemsize))
    arr = np.array(arr)
    if a.get("normalized"):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr


def matriz_no(no):
    if "matrix" in no:
        return np.array(no["matrix"], dtype=np.float64).reshape(4, 4).T
    t = np.array(no.get("translation", [0, 0, 0]), dtype=np.float64)
    q = no.get("rotation", [0, 0, 0, 1])
    s = np.array(no.get("scale", [1, 1, 1]), dtype=np.float64)
    x, y, z, w = q
    R = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def nos_com_malha(j):
    """Percorre a cena e devolve (índice da malha, matriz de mundo) de cada nó com malha."""
    res = []

    def visita(i, pai):
        no = j["nodes"][i]
        M = pai @ matriz_no(no)
        if "mesh" in no:
            res.append((no["mesh"], M))
        for c in no.get("children", []):
            visita(c, M)

    cena = j["scenes"][j.get("scene", 0)]
    for r in cena["nodes"]:
        visita(r, np.eye(4))
    return res


def imagem(j, binario, idx_textura, cache):
    if idx_textura in cache:
        return cache[idx_textura]
    src = j["textures"][idx_textura]["source"]
    bv = j["bufferViews"][j["images"][src]["bufferView"]]
    dados = binario[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
    im = Image.open(io.BytesIO(dados)).convert("RGB")
    cache[idx_textura] = np.asarray(im)
    return cache[idx_textura]


def srgb_para_linear(c):
    return np.power(np.clip(c, 0, 1), 2.2)


def carregar(caminho, verdes=False):
    """Todas as primitivas num só conjunto: posições (mundo), cores lineares por vértice, triângulos."""
    j, b = ler_glb(caminho)
    P, C, F = [], [], []
    cache = {}
    base = 0
    n_sem_cor = 0
    for malha, M in nos_com_malha(j):
        for prim in j["meshes"][malha]["primitives"]:
            if prim.get("mode", 4) != 4:
                continue
            pos = acessor(j, b, prim["attributes"]["POSITION"]).astype(np.float64)
            pos = pos @ M[:3, :3].T + M[:3, 3]
            n = len(pos)
            idx = acessor(j, b, prim["indices"]).reshape(-1, 3) if "indices" in prim else np.arange(n).reshape(-1, 3)
            mat = j["materials"][prim["material"]] if "material" in prim else {}
            pbr = mat.get("pbrMetallicRoughness", {})
            fator = np.array(pbr.get("baseColorFactor", [1, 1, 1, 1])[:3], dtype=np.float32)
            tex = pbr.get("baseColorTexture")
            if tex is not None and "TEXCOORD_0" in prim["attributes"]:
                im = imagem(j, b, tex["index"], cache)
                uv = acessor(j, b, prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
                h, w, _ = im.shape
                x = np.floor((uv[:, 0] % 1.0) * (w - 1) + 0.5).astype(np.int64)
                y = np.floor((uv[:, 1] % 1.0) * (h - 1) + 0.5).astype(np.int64)
                cor = srgb_para_linear(im[y, x].astype(np.float32) / 255.0) * fator
            elif verdes and "baseColorFactor" not in pbr:
                tom = np.array(VERDES[n_sem_cor % len(VERDES)], dtype=np.float32) / 255.0
                n_sem_cor += 1
                # leve variação de claro/escuro pela altura do vértice, para a copa não ficar chapada
                v = 0.82 + 0.36 * np.clip((pos[:, 1] - pos[:, 1].min()) / max(np.ptp(pos[:, 1]), 1e-6), 0, 1)
                cor = srgb_para_linear(tom)[None, :] * v[:, None].astype(np.float32)
            else:
                cor = np.tile(fator, (n, 1))
            P.append(pos)
            C.append(cor.astype(np.float32))
            F.append(idx.astype(np.int64) + base)
            base += n
    cache.clear()
    return np.concatenate(P), np.concatenate(C), np.concatenate(F)


def normalizar(P):
    mn, mx = P.min(axis=0), P.max(axis=0)
    h = mx[1] - mn[1]
    P = (P - np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])) / h
    return P


def cortar_base(P, C, F, altura, raio, piso=0.0):
    """Remove o canteiro/vaso de terra: faces abaixo de `altura` e afastadas do eixo mais que `raio`. Renormaliza."""
    cen = P[F].mean(axis=1)
    fora = ((cen[:, 1] < altura) & (np.hypot(cen[:, 0], cen[:, 2]) > raio)) | (cen[:, 1] < piso)
    F = F[~fora]
    usados = np.unique(F)
    novo = -np.ones(len(P), dtype=np.int64)
    novo[usados] = np.arange(len(usados))
    P, C, F = P[usados], C[usados], novo[F]
    return normalizar(P), C, F


def soldar(P, C, F):
    """Vértices duplicados nas costuras de UV impedem a decimação de colapsar: une os que coincidem em posição."""
    chave = np.round(P * 1e5).astype(np.int64)
    _, primeiro, inverso = np.unique(chave, axis=0, return_index=True, return_inverse=True)
    inverso = inverso.reshape(-1)
    P2, C2 = P[primeiro], C[primeiro]
    F2 = inverso[F]
    ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    return P2, C2, F2[ok]


def normais(P, F):
    n = np.zeros_like(P)
    a, b, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    fn = np.cross(b - a, c - a)  # peso = área
    for k in range(3):
        np.add.at(n, F[:, k], fn)
    l = np.linalg.norm(n, axis=1, keepdims=True)
    l[l == 0] = 1
    return n / l


def linear_para_srgb(c):
    return np.power(np.clip(c, 0, 1), 1 / 2.2)


def escrever_glb(caminho, P, N, C, F):
    n = len(P)
    idx_tipo = np.uint16 if n < 65535 else np.uint32
    partes = [
        np.ascontiguousarray(P, np.float32).tobytes(),
        np.ascontiguousarray(N, np.float32).tobytes(),
        np.ascontiguousarray(np.round(np.clip(C, 0, 1) * 255), np.uint8).tobytes(),
        np.ascontiguousarray(F.reshape(-1), idx_tipo).tobytes(),
    ]
    # cada bufferView alinhado a 4 bytes
    blobs, offs, pos = [], [], 0
    for p in partes:
        pad = (-len(p)) % 4
        offs.append(pos)
        blobs.append(p + b"\0" * pad)
        pos += len(p) + pad
    corpo = b"".join(blobs)
    j = {
        "asset": {"version": "2.0", "generator": "preparar-arvores.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2}, "indices": 3, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 0.88}, "doubleSided": True}],
        "buffers": [{"byteLength": len(corpo)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offs[0], "byteLength": len(partes[0]), "target": 34962},
            {"buffer": 0, "byteOffset": offs[1], "byteLength": len(partes[1]), "target": 34962},
            {"buffer": 0, "byteOffset": offs[2], "byteLength": len(partes[2]), "target": 34962},
            {"buffer": 0, "byteOffset": offs[3], "byteLength": len(partes[3]), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": n, "type": "VEC3", "min": P.min(axis=0).tolist(), "max": P.max(axis=0).tolist()},
            {"bufferView": 1, "componentType": 5126, "count": n, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5121, "normalized": True, "count": n, "type": "VEC3"},
            {"bufferView": 3, "componentType": 5125 if idx_tipo is np.uint32 else 5123, "count": int(F.size), "type": "SCALAR"},
        ],
    }
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(corpo)
    with open(caminho, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON") + js)
        f.write(struct.pack("<I4s", len(corpo), b"BIN\0") + corpo)


def previa(caminho, P, C, F, tam=520):
    """Miniatura por rasterização plana (pintor) de uma vista 3/4: só para conferir a forma e as cores."""
    ang = np.radians(35)
    R = np.array([[np.cos(ang), 0, -np.sin(ang)], [0, 1, 0], [np.sin(ang), 0, np.cos(ang)]])
    Q = (P - np.array([0, 0.5, 0])) @ R.T
    # leve inclinação para ver de cima
    t = np.radians(18)
    Rx = np.array([[1, 0, 0], [0, np.cos(t), -np.sin(t)], [0, np.sin(t), np.cos(t)]])
    Q = Q @ Rx.T
    esc = tam * 0.82 / max(Q[:, 0].max() - Q[:, 0].min(), Q[:, 1].max() - Q[:, 1].min())
    X = tam / 2 + Q[:, 0] * esc
    Y = tam / 2 - Q[:, 1] * esc
    prof = Q[F, 2].mean(axis=1)
    ordem = np.argsort(prof)  # mais longe primeiro (câmera olha para -z? aqui z maior = mais perto)
    cor_tri = linear_para_srgb(C[F].mean(axis=1))
    luz = np.clip(0.55 + 0.45 * normais(P, F)[F].mean(axis=1) @ np.array([0.4, 0.8, 0.45]), 0.3, 1.1)
    im = Image.new("RGB", (tam, tam), (214, 226, 240))
    d = ImageDraw.Draw(im)
    for i in ordem:
        a, b, c = F[i]
        col = tuple(int(np.clip(v * luz[i] * 255, 0, 255)) for v in cor_tri[i])
        d.polygon([(X[a], Y[a]), (X[b], Y[b]), (X[c], Y[c])], fill=col)
    im.save(caminho)


def processar(nome):
    arquivo, alvo, opc = ENTRADAS[nome]
    print(f"[arvores] {nome}: lendo {arquivo} ...", flush=True)
    P, C, F = carregar(os.path.join(SRC, arquivo), verdes=opc.get("verdes", False))
    antes = len(F)
    P = normalizar(P)
    P, C, F = soldar(P, C, F)
    if "corte_base" in opc:
        P, C, F = cortar_base(P, C, F, *opc["corte_base"])
    print(f"[arvores] {nome}: {antes} tri -> {len(F)} após soldar; decimando para ~{alvo}", flush=True)
    reducao = min(0.995, max(0.0, 1.0 - alvo / len(F)))
    P2, F2 = fast_simplification.simplify(P.astype(np.float32), F.astype(np.int32), target_reduction=reducao, agg=7)
    # modelos com muitas peças soltas (folhas) param antes do alvo: repete até chegar perto
    for _ in range(4):
        if len(F2) <= alvo * 1.12:
            break
        P2, F2 = fast_simplification.simplify(P2.astype(np.float32), F2.astype(np.int32), target_reduction=min(0.9, 1.0 - alvo / len(F2)), agg=7)
    P2 = P2.astype(np.float64)
    F2 = F2.astype(np.int64)
    # cor: média dos 6 vértices originais mais próximos de cada vértice novo
    arv = cKDTree(P)
    dist, ix = arv.query(P2, k=6, workers=1)
    peso = 1.0 / (dist + 1e-4)
    C2 = (C[ix] * peso[..., None]).sum(axis=1) / peso.sum(axis=1, keepdims=True)
    N2 = normais(P2, F2)
    os.makedirs(OUT, exist_ok=True)
    destino = os.path.join(OUT, f"{nome}.glb")
    escrever_glb(destino, P2, N2, C2, F2)
    previa(os.path.join(OUT, f"previa-{nome}.png"), P2, C2, F2)
    print(f"[arvores] {nome}: {antes} -> {len(F2)} triângulos, {len(P2)} vértices | {os.path.getsize(destino)//1024} KB", flush=True)


if __name__ == "__main__":
    for n in (sys.argv[1:] or list(ENTRADAS)):
        processar(n)
