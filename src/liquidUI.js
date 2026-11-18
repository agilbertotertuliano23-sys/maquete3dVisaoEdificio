// Ajustes de interface do "Liquid Glass": preenchimento azul do controle deslizante de andares.
// O CSS lê a variável --p (porcentagem) para pintar a trilha até o polegar de vidro.
export function paintRange(el) {
  if (!el) return;
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 100;
  const p = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--p', `${p}%`);
}

const slider = document.getElementById('floor-cut-slider');
if (slider) {
  paintRange(slider);
  slider.addEventListener('input', () => paintRange(slider));
}
