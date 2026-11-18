"""Merge generation provenance without modifying the image masters."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
base=root/'assets/panoramas'
assets={}
files=[base/'geracao.json',base/'comum-base.json',base/'comum-geracao.json',base/'interiores-geracao.json']+sorted((base/'lotes').glob('*.json'))
for file in files:
 if not file.exists():continue
 data=json.loads(file.read_text(encoding='utf-8'))
 for asset in data.get('assets',[]):
  if asset.get('source') and (root/asset['destination']).is_file():assets[(asset['property'],asset['id'])]=asset
manifest={'generator':'image_gen built-in','reference_video':'reference/reel-Dd2FExNoS6Q.mp4','projection':'equirectangular 2:1','navigation':'linked fixed panoramic viewpoints','assets':[assets[k] for k in sorted(assets)]}
for a in manifest['assets']:
 a['code']=(a['property']+'-'+a['id']).upper().replace('_','-')
(base/'manifesto-geracao.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
index=['# Índice para solicitar ajustes','', 'Use o código mostrado no rodapé da visita e na biblioteca para identificar a imagem.','','| Código | Arquivo |','|---|---|']
index += [f"| {a['code']} | [{a['destination']}]({a['destination'].removeprefix('assets/panoramas/')}) |" for a in manifest['assets']]
(base/'INDICE-PARA-AJUSTES.md').write_text('\n'.join(index)+'\n',encoding='utf-8')
print(json.dumps({'recorded':len(assets)}))
