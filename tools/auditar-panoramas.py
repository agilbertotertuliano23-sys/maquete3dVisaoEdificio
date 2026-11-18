"""Check complete coverage, image integrity and the navigable graph without editing images."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
raw=(ROOT/'src/tour360Catalogo.js').read_text(encoding='utf-8')
catalog=json.loads(raw.split('export const TOUR_CATALOG = ',1)[1].strip().removesuffix(';'))
expected=[f'AP-{i:02d}' for i in range(1,21)]+[f'CS-{i:02d}' for i in range(1,7)]+['COMUM']
errors=[];seen={};images=[]
extras=json.loads((ROOT/'assets/panoramas/ambientes-adicionais.json').read_text(encoding='utf-8'))
for pid in expected:
 if pid not in catalog:
  errors.append(f'Missing property {pid}');continue
 rooms=catalog[pid]['rooms'];ids={r['id'] for r in rooms}
 required=12 if pid=='COMUM' else 6+sum(r['property']==pid for r in extras)
 if len(rooms)!=required:errors.append(f'{pid}: {len(rooms)}/{required} rooms')
 for room in rooms:
  file=ROOT/room.get('original',room['src']).removeprefix('./')
  try:
   with Image.open(ROOT/room['src'].removeprefix('./')) as web: web.verify()
   with Image.open(file) as img:
    w,h=img.size;img.verify()
   if abs(w/h-2)>0.02:errors.append(f'Not 2:1: {file.name} {w}x{h}')
   checksum=hashlib.sha256(file.read_bytes()).hexdigest()
   if checksum in seen:errors.append(f'Duplicate: {pid}/{room["id"]} = {seen[checksum]}')
   seen[checksum]=pid+'/'+room['id']
   images.append({'property':pid,'room':room['id'],'width':w,'height':h,'bytes':file.stat().st_size,'sha256':checksum})
  except Exception as exc:errors.append(str(exc))
  for link in room['links']:
   if link['to'] not in ids:errors.append(f'Dangling link {pid}/{room["id"]} -> {link["to"]}')
 for start in ids:
  visited=set();todo=[start]
  while todo:
   current=todo.pop()
   if current in visited:continue
   visited.add(current)
   node=next((r for r in rooms if r['id']==current),None)
   if node:todo.extend(l['to'] for l in node['links'])
  if visited!=ids:errors.append(f'Unreachable rooms from {pid}/{start}')
report={'properties':len(catalog),'panoramas':len(images),'bytes':sum(i['bytes'] for i in images),'errors':errors,'images':images}
(ROOT/'assets/panoramas/verificacao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False))
raise SystemExit(bool(errors))
