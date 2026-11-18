"""Extrai as paredes brancas de cada planta para virarem uma camada em relevo (3D).

Entrada : assets/plantas/<ID>/planta.png (e estrutura.png nas casas, que tem paredes limpas)
Saída   : assets/plantas/web/<ID>/paredes.webp  — mesmo tamanho de planta.webp,
          branco onde há parede, transparente no resto (o app empilha a camada em alturas).
Uso     : python tools/gerar-paredes.py [ID ...]
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "assets" / "plantas"
OUT = SRC / "web"
PLANTA_MAX = 1400  # igual a tools/otimizar-plantas.py (as camadas precisam casar pixel a pixel)


def mascara_paredes(rgba, e_estrutura):
    a = np.asarray(rgba)
    rgb, alfa = a[..., :3].astype(np.int16), a[..., 3]
    minimo = rgb.min(axis=2)
    sat = rgb.max(axis=2) - minimo
    # parede = branco quase puro, sem cor; piso/móveis são creme ou madeira
    # (nas plantas geradas o branco varia de ~232 a 255 conforme a iluminação)
    limiar = 228 if e_estrutura else 232
    m = ((minimo >= limiar) & (sat <= 9) & (alfa > 200)).astype(np.uint8)
    # tira pontinhos soltos (brilho de almofada, reflexo) e fecha furinhos
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, rot, st, _ = cv2.connectedComponentsWithStats(m, 8)
    area_min = m.shape[0] * m.shape[1] * (0.0003 if e_estrutura else 0.0016)
    manter = np.zeros(n, bool)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        # na planta mobiliada parede é longa e mancha de móvel não; na estrutura só há parede
        comprido = e_estrutura or max(w, h) >= 0.09 * max(m.shape)
        if area >= area_min and comprido:
            manter[i] = True
    return manter[rot].astype(np.uint8)


def processar(id_):
    p = Image.open(SRC / id_ / "planta.png").convert("RGBA")
    bbox = p.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    fonte = p
    estrutura = SRC / id_ / "estrutura.png"
    e_estrutura = estrutura.exists()
    if e_estrutura:
        fonte = Image.open(estrutura).convert("RGBA")
        if fonte.size != p.size:
            fonte = fonte.resize(p.size, Image.LANCZOS)
    if bbox:
        p = p.crop(bbox)
        fonte = fonte.crop(bbox)
    esc = min(1.0, PLANTA_MAX / max(p.size))  # mesma regra do otimizar-plantas: nunca amplia
    tam = (round(p.size[0] * esc), round(p.size[1] * esc))
    fonte = fonte.resize(tam, Image.LANCZOS)
    m = mascara_paredes(fonte, e_estrutura)
    saida = np.zeros((*m.shape, 4), np.uint8)
    saida[..., :3] = 255
    saida[..., 3] = m * 255
    pasta = OUT / id_
    pasta.mkdir(parents=True, exist_ok=True)
    Image.fromarray(saida, "RGBA").save(pasta / "paredes.webp", "WEBP", lossless=True, method=6)
    return tam, float(m.mean())


def main():
    ids = sys.argv[1:] or sorted(p.name for p in SRC.iterdir() if p.is_dir() and p.name[:2] in ("AP", "CS"))
    for id_ in ids:
        tam, cob = processar(id_)
        print(id_, tam, f"paredes cobrem {cob * 100:.1f}%")


if __name__ == "__main__":
    main()
