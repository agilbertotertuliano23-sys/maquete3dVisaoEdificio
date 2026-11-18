# Biblioteca de plantas e ambientes

Abra **index.html** nesta pasta para consultar e baixar as imagens. Funciona diretamente no navegador, sem servidor.

## Conteúdo

- **AP-01 a AP-20:** vinte apartamentos diferentes, cada um com `planta.png` e `ambientes.png`.
- **CS-01 a CS-06:** seis casas diferentes, cada uma com `planta.png`, `estrutura.png` e `ambientes.png`.
- Total: **58 PNGs**, incluindo **26 painéis com seis vistas cada** (156 cenas de ambientes).

`planta.png` é a vista superior ortogonal, com mobiliário e transparência fora do imóvel. `estrutura.png` mostra a casa sem mobiliário, com paredes, aberturas e pisos. `ambientes.png` é um painel opaco de seis renderizações: sala/jantar, cozinha, suíte, quarto, banheiro e varanda/pátio.

## Céu e altura dos apartamentos

- AP-01 a AP-06: vistas inspiradas em andares intermediários, aproximadamente o 6º andar.
- AP-07 a AP-13: vistas de andares altos, aproximadamente o 12º andar.
- AP-15 a AP-18: vistas altas, aproximadamente o 16º andar.
- AP-14, AP-19 e AP-20: variantes de cobertura, com terraços abertos para o céu.
- Casas: vistas térreas para vegetação, pátios e varandas.

## Uso na maquete

Use os PNGs originais de planta como textura/sobreposição. Preserve a proporção de cada imagem e habilite transparência no material. As plantas têm formatos distintos (retangulares, alongados, em L, em T e com pátio); o encaixe sobre um pavimento requer ajuste individual de escala e orientação. Os arquivos são recursos visuais independentes; o código da maquete original não foi alterado.

São estudos visuais conceituais, sem levantamento dimensional do modelo existente. Os interiores são interpretações da planta de referência e podem apresentar diferenças pontuais de mobiliário e aberturas. As estruturas são representações arquitetônicas sem cálculo estrutural.

Geradas com a ferramenta integrada **image_gen**, sem uso da API/CLI. Os prompts individuais estão em `manifesto-geracao.json` e `derivados-geracao.json`. `verificacao.json` registra dimensões, formato, transparência e integridade dos arquivos.
