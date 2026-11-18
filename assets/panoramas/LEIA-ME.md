# Visitas panorâmicas 360°

Execute `iniciar.bat` na raiz. Clique nos pontos dos espaços comuns diretamente na maquete para entrar no ambiente; clique em um apartamento para visitar a sua variação. O botão **Maquete** retorna à vista anterior. **Visita 360°** na barra superior abre o explorador completo. O fluxo segue o Reel `Dd2FExNoS6Q`, enviado pelo usuário, que foi baixado e inspecionado; o vídeo anterior da pasta foi preservado.

O conjunto contém **296 panoramas**: interiores de **20 variações de apartamentos** e **6 casas**, mais **12 áreas comuns**. Todos possuem nome e código para revisão. A navegação e a identificação estão integradas à maquete.

- `http://localhost:18910/panoramas.html`: biblioteca de imagens, busca por ambiente/variação, downloads e acesso ao tour.
- `http://localhost:18910/tour360.html?planta=AP-01`: visita direta à variação.
- Arraste com mouse ou dedo; setas do teclado também giram a câmera.
- Roda do mouse, pinça de dois dedos e botões +/− controlam o zoom.
- Pontos sobre a imagem e lista de ambientes fazem as passagens entre cenas.
- `Esc` retorna à maquete; o botão de tela cheia amplia a visita.

As imagens são panoramas de proporção 2:1 projetados no interior de uma esfera, gerados pela ferramenta integrada `image_gen`. Os PNGs ficam em subpastas por variação; não dependem de API, conta ou CDN para visualização. Os prompts e arquivos de origem são registrados nos manifestos JSON desta pasta.

## Identificação para ajustes

O rodapé da visita e os cartões da biblioteca mostram o código de cada vista, por exemplo `AP-01-SALA` ou `COMUM-PORTARIA`. A pasta `revisao/` contém cópias identificadas em PNG, com nome da variação, ambiente, código e caminho do original. A biblioteca oferece **Baixar com identificação**. Essas cópias são quadros de revisão com legenda; o visualizador usa os panoramas sem a faixa de rodapé para manter a projeção esférica.

Consulte `INDICE-PARA-AJUSTES.md` para localizar o arquivo correspondente a cada código. Exemplo de pedido: “AP-10-CLOSET: trocar a madeira por carvalho claro”. Os originais permanecem em `AP-XX/`, `CS-XX/` e `COMUM/`; os WebPs ao lado são versões leves para navegação.

São visualizações conceituais derivadas das plantas e dos painéis de ambientes existentes. A visita usa posições panorâmicas fixas ligadas por pontos; não é deslocamento livre com paralaxe em uma reconstrução arquitetônica. Imagens geradas separadamente podem apresentar diferenças de geometria, mobiliário ou emendas, mesmo compartilhando referências. Os pontos indicam destinos navegáveis, não levantamento de portas ou posições métricas. A vista externa é representativa da variação, não uma fotografia de cada pavimento.

`tools/catalogar-panoramas.py` refaz o catálogo usando somente os arquivos presentes. `tools/verificar-tour360.cjs` valida navegação no navegador. Os PNGs e o catálogo estão separados das plantas e imagens anteriores, que foram preservadas.

Nova referência: `reference/reel-Dd2FExNoS6Q.mp4` (43,68 s), baixada do Reel fornecido. O vídeo anterior permanece disponível no seletor do player.
