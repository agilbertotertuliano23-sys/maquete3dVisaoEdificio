// ==========================================================================
// HUD À MODA DA REFERÊNCIA (NAVIGO · reel DeLzrKJoCNt): bússola que acompanha a câmera
// e atalhos de vista flutuantes ("Bird Eye View" / "Elevation" na referência).
//
// Não toca na lógica da maquete: lê o ângulo da câmera em `window.ilusaoApp.scene3d` e repassa o
// clique para os botões do cabeçalho (btn-cam-*), de modo que o estado "ativo" continua vindo do
// main.js. O CSS (mobile.css) decide onde e quando aparecem: só em telas até 900px.
// ==========================================================================

const VISTAS = [
  { id: 'btn-cam-aerea', rotulo: 'Vista aérea' },
  { id: 'btn-cam-frontal', rotulo: 'Fachada' },
  { id: 'btn-cam-planta', rotulo: 'Planta' },
];
const RUMOS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']; // pt-BR: L = leste, O = oeste

function montar() {
  const palco = document.getElementById('id-stage');
  if (!palco) return;

  const coluna = document.createElement('div');
  coluna.className = 'hud-col';
  coluna.innerHTML = `
    <div class="hud-bussola" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <circle class="hud-aro" cx="32" cy="32" r="29"/>
        <g class="hud-agulha">
          <path class="hud-norte" d="M32 7l7 22H25z"/>
          <path class="hud-sul" d="M32 57l-7-22h14z"/>
        </g>
        <circle class="hud-eixo" cx="32" cy="32" r="3"/>
      </svg>
      <span class="hud-rumo">N</span>
    </div>
    <div class="hud-vistas" role="group" aria-label="Vistas da maquete"></div>`;
  palco.appendChild(coluna);

  const grupo = coluna.querySelector('.hud-vistas');
  const botoes = VISTAS.map(({ id, rotulo }) => {
    const origem = document.getElementById(id);
    if (!origem) return null;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hud-vista';
    b.textContent = rotulo;
    b.addEventListener('click', () => origem.click());
    grupo.appendChild(b);
    return { b, origem };
  }).filter(Boolean);

  // espelha o estado ativo dos botões do cabeçalho
  const sincronizar = () => botoes.forEach(({ b, origem }) => b.classList.toggle('is-ativa', origem.classList.contains('active')));
  const obs = new MutationObserver(sincronizar);
  botoes.forEach(({ origem }) => obs.observe(origem, { attributes: true, attributeFilter: ['class'] }));
  sincronizar();

  // bússola: a agulha aponta o norte (-Z na maquete); a câmera olha para -(posição - alvo),
  // então o rumo é -theta e a agulha gira +theta.
  const agulha = coluna.querySelector('.hud-agulha');
  const rumoEl = coluna.querySelector('.hud-rumo');
  const bussola = coluna.querySelector('.hud-bussola');
  let ultimo = Infinity;
  const quadro = () => {
    requestAnimationFrame(quadro);
    if (!bussola.offsetParent) return; // escondida pelo CSS: não gasta nada
    const theta = window.ilusaoApp?.scene3d?.camState?.spherical?.theta;
    if (typeof theta !== 'number') return;
    const graus = (theta * 180) / Math.PI;
    if (Math.abs(graus - ultimo) < 0.4) return;
    ultimo = graus;
    agulha.style.transform = `rotate(${graus.toFixed(1)}deg)`;
    const rumo = (((-graus) % 360) + 360) % 360;
    rumoEl.textContent = RUMOS[Math.round(rumo / 45) % 8];
  };
  requestAnimationFrame(quadro);
}

// --------------------------------------------------------------------------
// ORIENTAÇÃO: como no reel, a maquete é pensada para o celular DEITADO (horizontal).
// Em celular em pé aparece um aviso que pede para girar e, onde o navegador deixa (Android),
// entra em tela cheia e trava na horizontal. No iPhone não existe trava: o aviso pede pra girar
// à mão (e a rotação automática precisa estar liberada). Dá para ignorar e seguir em pé.
// Não giramos a página por CSS de propósito: o toque e o raycast da cena 3D usam as coordenadas
// da tela, e uma página girada quebraria o arrasto e o clique nas unidades.
// --------------------------------------------------------------------------
const CHAVE_EM_PE = 'maquete.seguirEmPe';

function ehCelular() {
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600;
}
const emPe = () => matchMedia('(orientation: portrait)').matches;
const lido = () => { try { return sessionStorage.getItem(CHAVE_EM_PE) === '1'; } catch { return false; } };
const gravar = () => { try { sessionStorage.setItem(CHAVE_EM_PE, '1'); } catch { /* modo privado: só vale nesta aba */ } };

function avisoOrientacao() {
  if (!ehCelular()) return;

  const aviso = document.createElement('div');
  aviso.className = 'aviso-giro';
  aviso.hidden = true;
  aviso.setAttribute('role', 'dialog');
  aviso.setAttribute('aria-modal', 'true');
  aviso.setAttribute('aria-label', 'Gire o celular para a horizontal');
  aviso.innerHTML = `
    <div class="aviso-giro-card">
      <svg class="aviso-giro-icone" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect x="21" y="6" width="22" height="42" rx="4"/>
        <path d="M30 41h4"/>
        <path d="M10 54a24 24 0 0 0 44 0" class="aviso-giro-seta"/>
        <path d="M54 54l-1-7-6 3"/>
      </svg>
      <strong>Gire o celular</strong>
      <p>A maquete funciona melhor na <b>horizontal</b>, com o menu na lateral e a cena em tela cheia.</p>
      <button type="button" class="aviso-giro-ok">Girar para horizontal</button>
      <button type="button" class="aviso-giro-pular">Continuar em pé</button>
      <small class="aviso-giro-dica" hidden>Se não girou sozinho, desative o bloqueio de rotação do celular e vire o aparelho.</small>
    </div>`;
  document.body.appendChild(aviso);

  const dica = aviso.querySelector('.aviso-giro-dica');
  const atualizar = () => { aviso.hidden = !(emPe() && !lido()); };

  aviso.querySelector('.aviso-giro-ok').addEventListener('click', async () => {
    try {
      // tela cheia + trava só funcionam com um toque do usuário e só no Android/Chrome
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
      await screen.orientation.lock('landscape');
    } catch {
      dica.hidden = false; // iPhone/Safari ou navegador sem trava: gira à mão
    }
    atualizar();
  });
  aviso.querySelector('.aviso-giro-pular').addEventListener('click', () => { gravar(); atualizar(); });

  matchMedia('(orientation: portrait)').addEventListener('change', atualizar);
  addEventListener('resize', atualizar);
  atualizar();
}

// --------------------------------------------------------------------------
// PAINEL DO DESMONTE RECOLHÍVEL: em telas pequenas ele ocupava boa parte da cena. Um botão no
// cabeçalho do painel o recolhe (fica só o nome da torre) e abre de novo; a escolha dura a visita.
// O scene3d já observa o tamanho dos painéis e reenquadra a maquete sozinho.
// --------------------------------------------------------------------------
const CHAVE_RECOLHIDO = 'maquete.desmonteRecolhido';

function painelRecolhivel() {
  const painel = document.getElementById('desmonte-panel');
  const cabecalho = painel?.querySelector('.desmonte-header');
  if (!painel || !cabecalho) return;

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'desmonte-recolher';
  botao.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';

  const aplicar = (recolhido) => {
    painel.classList.toggle('is-recolhido', recolhido);
    botao.setAttribute('aria-expanded', String(!recolhido));
    botao.setAttribute('aria-label', recolhido ? 'Abrir os controles do desmonte' : 'Recolher os controles do desmonte');
    botao.title = botao.getAttribute('aria-label');
    try { sessionStorage.setItem(CHAVE_RECOLHIDO, recolhido ? '1' : '0'); } catch { /* sem armazenamento: só nesta tela */ }
  };
  botao.addEventListener('click', () => aplicar(!painel.classList.contains('is-recolhido')));
  cabecalho.appendChild(botao);

  let salvo = false;
  try { salvo = sessionStorage.getItem(CHAVE_RECOLHIDO) === '1'; } catch { /* idem */ }
  aplicar(salvo);
}

function iniciar() {
  montar();
  painelRecolhivel();
  avisoOrientacao();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
