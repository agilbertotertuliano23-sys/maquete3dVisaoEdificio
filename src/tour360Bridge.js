import { Tour360 } from './tour360.js';
import { TOUR_CATALOG } from './tour360Catalogo.js';

let viewer;
let eastHouses = false;
function enter(id, room, mirrorX = false) {
  if (!TOUR_CATALOG[id]) return;
  eastHouses = room === 'casas_aluguel' && mirrorX;
  if (!viewer) {
    viewer = new Tour360(TOUR_CATALOG, roomId => {
      window.ilusaoApp?.viewSector(roomId, roomId === 'casas_aluguel' && eastHouses);
    });
    viewer.dialog.addEventListener('close', () => window.ilusaoApp?._atualizarPausa3D());
  }
  window.tour360 = viewer;
  window.ilusaoApp?.scene3d.setPausado(true);
  viewer.open(id,room);
}
window.addEventListener('maquete:tour360', event => enter(event.detail?.property, event.detail?.room, event.detail?.mirrorX));
document.getElementById('btn-tour360')?.addEventListener('click', () => {
  const id = window.ilusaoApp?.activeApt?.planta || window.ilusaoApp?.activeUnit?.planta;
  enter(TOUR_CATALOG[id] ? id : TOUR_CATALOG.COMUM ? 'COMUM' : 'AP-01');
});
document.getElementById('apt-tour360')?.addEventListener('click', () => enter(window.ilusaoApp?.activeApt?.planta));
document.getElementById('unit-tour360')?.addEventListener('click', () => enter(window.ilusaoApp?.activeUnit?.planta));
window.addEventListener('DOMContentLoaded', () => {
  const common = TOUR_CATALOG.COMUM;
  if (!common) return;
  for (const room of common.rooms) {
    if (document.querySelector(`[data-tour-sector="${room.id}"]`)) continue;
    const button = document.createElement('button');
    button.className='sector-mini-btn'; button.textContent=`360° · ${room.name}`;
    button.dataset.tourSector=room.id;
    button.addEventListener('click',()=>enter('COMUM',room.id));
    document.getElementById('sector-mini-list')?.append(button);
  }
});
const selector = document.getElementById('reference-video-select');
selector?.addEventListener('change', () => {
  const video = document.getElementById('ref-video-player');
  video.pause(); video.src=selector.value; video.load();
  document.getElementById('reference-video-download').href=selector.value;
});
