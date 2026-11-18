# Ilusão Digital STUDIO 3D — Maquete Interativa (`WEB-Maquete3D-IlusaoDigital`)

Maquete interativa inspirada no Reel da **@ilusaodigital**. A maquete agora é o modelo
**`apartment complex 3d model.glb`** (Tripo): 5 torres, boulevard com piscina, quadra, clube e casas.

## Como a maquete funciona

- **`assets/maquete.glb`** — o GLB original (60 MB, 1M vértices, textura 4096) foi reduzido no Blender
  para ~380 mil vértices e textura 2048 (~19 MB). O original continua em `Downloads`.
- **`src/model.js`** — carrega o GLB (escala 70, centro em x=4, z=2) e aplica um material com **corte por
  torre no shader**: cada torre tem uma caixa (x/z) e uma altura de corte; o que passa da altura é descartado
  e as faces internas saem em cor chapada (a torre cortada parece um bloco maciço).
- **`src/data.js`** — `MODEL_PLACEMENT`, `FLOOR_H`, `BASE_Y` e `TOWERS_CONFIG` (posição, pegada, nº de
  pavimentos e `roofTop` de cada torre, medidos na malha). Para ajustar uma torre, mexa só ali.
- **`src/scene3d.js`** — caixas invisíveis por torre (clique → pavimento pela altura do ponto), planta
  humanizada 3D no pavimento cortado e blocos coloridos de disponibilidade nas duas faces longas.

| Torre | Onde | Pavimentos | Unidades |
|-------|------|-----------:|---------:|
| A | canto oeste (alta) | 25 | 100 |
| B | canto leste (alta) | 25 | 100 |
| C | fundo | 21 | 84 |
| D | boulevard oeste | 13 | 52 |
| E | boulevard leste | 13 | 52 |

Total: **388 unidades** (a contagem na tela é calculada, não fixa).

> Nº de pavimentos e alturas são **estimados** da silhueta do modelo (o GLB é uma malha única, sem
> andares separados). Se contar diferente do projeto real, corrija `floors` e `FLOOR_H` em `data.js`.

## Modos

- **Filme** — vista aérea com o entorno 3D (rodovia, bairro, floresta).
- **Desmonte Interativo** — clique numa torre (ou use chips, slider e atalhos): o corte desce até o
  pavimento e aparece a planta humanizada 3D.
- **Localização** — mapa do entorno, POIs e Street View 360°.
- **Unidades Disponíveis** — verde/amarelo/cinza por unidade, hover, card e busca com filtros.

## 🚀 3. Como Executar
Dê dois cliques em **`iniciar.bat`** ou execute no terminal:
```powershell
cd C:\Users\agilb\Downloads\web\WEB-Maquete3D-IlusaoDigital
python -m http.server 18910
```
Acesse no navegador: **[http://localhost:18910/index.html](http://localhost:18910/index.html)**

## Plantas em variação e recortes dos cômodos (atualização)

- Cada unidade tem `unit.planta` (AP-01..AP-20 nas torres, CS-01..CS-06 nas casas), escolhida por tipologia em
  `src/plantas.js` — apartamentos vizinhos nunca repetem a planta.
- `python tools/otimizar-plantas.py` gera `assets/plantas/web/<ID>/` (planta + 6 recortes: sala, cozinha, suíte,
  quarto, banheiro, varanda) em WebP (~5,7 MB no total) e o catálogo `src/plantasCatalogo.js`.
- No **Desmonte**, o pavimento cortado mostra a planta de cada um dos 4 apartamentos; clique no apartamento (ou
  no rótulo) para abrir o painel à esquerda com os cômodos. O card da unidade usa as mesmas imagens.
- Layout: `compact.css` (carregado depois de `styles.css`) concentra o visual compacto.
- Otimização: sombras só são recalculadas quando algo muda, pixel ratio limitado a 1,5 e 30 fps com a câmera parada.
- Observação: a maquete atual é procedural (`model.js`); `assets/maquete.glb` não é carregado.
