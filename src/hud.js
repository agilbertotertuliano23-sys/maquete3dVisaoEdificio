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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
else montar();
