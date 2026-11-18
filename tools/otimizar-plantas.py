"""Gera as versões leves das plantas e recorta os 6 cômodos de cada painel.

Entrada : assets/plantas/<ID>/{planta,estrutura,ambientes}.png  (~2,5 MB cada)
Saída   : assets/plantas/web/<ID>/planta.webp, sala/cozinha/suite/quarto/banheiro/varanda.webp
          src/plantasCatalogo.js  (dimensões + nomes, importado pelo app)
Uso     : python tools/otimizar-plantas.py
"""
import json
import re
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "assets" / "plantas"
OUT = SRC / "web"

COMODOS = ["sala", "cozinha", "suite", "quarto", "banheiro", "varanda"]  # ordem do painel 3x2
PLANTA_MAX = 1400  # lado maior da planta usada como textura (as originais têm ~1300 px: não amplia)
COMODO_LADO = 440  # recorte quadrado de cada cômodo
INSET = 7          # corta a moldura branca entre as vistas


def achar_divisoes(img, eixo):
    """Acha as linhas brancas que separam as 3 colunas (ou as 2 fileiras)."""
    w, h = img.size
    g = img.convert("L")
    n = 3 if eixo == "x" else 2
    esperado = [round((w if eixo == "x" else h) * i / n) for i in range(1, n)]
    achadas = []
    for e in esperado:
        melhor, melhor_v = e, -1
        for p in range(e - 14, e + 15):
            box = (p, 0, p + 1, h) if eixo == "x" else (0, p, w, p + 1)
            v = sum(g.crop(box).getdata()) / (h if eixo == "x" else w)
            if v > melhor_v:
                melhor, melhor_v = p, v
        achadas.append(melhor)
    return achadas


def recortar_comodos(id_, pasta_out):
    img = Image.open(SRC / id_ / "ambientes.png").convert("RGB")
    w, h = img.size
    xs = [0] + achar_divisoes(img, "x") + [w]
    ys = [0] + achar_divisoes(img, "y") + [h]
    i = 0
    for r in range(2):
        for c in range(3):
            box = (xs[c] + INSET, ys[r] + INSET, xs[c + 1] - INSET, ys[r + 1] - INSET)
            t = img.crop(box)
            lado = min(t.size)
            ox, oy = (t.size[0] - lado) // 2, (t.size[1] - lado) // 2
            t = t.crop((ox, oy, ox + lado, oy + lado)).resize((COMODO_LADO, COMODO_LADO), Image.LANCZOS)
            t.save(pasta_out / f"{COMODOS[i]}.webp", "WEBP", quality=80, method=6)
            i += 1


def main():
    manifesto = json.loads((SRC / "manifesto-geracao.json").read_text(encoding="utf-8"))
    nomes = {a["id"]: a["name"] for a in manifesto["assets"]}
    # o manifesto veio com acentos corrompidos em alguns nomes
    nomes.update({"AP-03": "Ateliê", "AP-05": "Pátio", "AP-06": "Família", "AP-08": "Convívio",
                  "AP-10": "Refúgio", "AP-14": "Terraço", "AP-18": "Essência", "CS-01": "Casa Ipê",
                  "CS-04": "Casa Acácia", "CS-06": "Casa Araucária"})
    catalogo = {}
    ids = sorted(p.name for p in SRC.iterdir() if p.is_dir() and re.match(r"(AP|CS)-\d+$", p.name))
    for id_ in ids:
        pasta = OUT / id_
        pasta.mkdir(parents=True, exist_ok=True)
        p = Image.open(SRC / id_ / "planta.png").convert("RGBA")
        # corta a margem transparente para a planta encaixar justa no pavimento
        bbox = p.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
        if bbox:
            p = p.crop(bbox)
        esc = min(1.0, PLANTA_MAX / max(p.size))  # nunca amplia: só reduz o que passar do limite
        p = p.resize((round(p.size[0] * esc), round(p.size[1] * esc)), Image.LANCZOS)
        p.save(pasta / "planta.webp", "WEBP", quality=92, method=6)
        recortar_comodos(id_, pasta)
        catalogo[id_] = {"nome": nomes.get(id_, id_), "w": p.size[0], "h": p.size[1]}
        print(id_, catalogo[id_])

    js = (
        "// GERADO por tools/otimizar-plantas.py — não editar à mão.\n"
        "export const PLANTAS_CATALOGO = "
        + json.dumps(catalogo, ensure_ascii=False, indent=1)
        + ";\n"
    )
    (RAIZ / "src" / "plantasCatalogo.js").write_text(js, encoding="utf-8")


if __name__ == "__main__":
    main()
