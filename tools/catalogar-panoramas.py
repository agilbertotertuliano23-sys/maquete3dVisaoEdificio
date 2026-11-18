"""Rebuild the local tour catalog using only generated files that actually exist."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'assets' / 'panoramas'
NAMES = {'sala':'Sala / Jantar','cozinha':'Cozinha','suite':'Suíte principal','quarto':'Dormitório 2',
         'banheiro':'Banheiro','varanda':'Varanda / Terraço'}
ROOM_ORDER=['sala','cozinha','lavanderia','patio-servico','varanda','entrada','circulacao',
            'escritorio','suite','closet','banheiro-suite','quarto','quarto-3','quarto-4','banheiro','banheiro-2']
# Link angles are navigation markers and can be calibrated individually for each panorama.
LINKS = {'sala':[('cozinha',90),('varanda',-25),('suite',170),('quarto',-170),('banheiro',145)],
         'cozinha':[('sala',-30)],'suite':[('sala',65)],'quarto':[('sala',-135)],
         'banheiro':[('sala',-135)],'varanda':[('sala',160)]}
COMMON = [
 ('portaria','Portaria e acesso'),('boulevard','Boulevard'),('piscina','Piscina e solário'),
 ('quadra','Quadra poliesportiva'),('academia_ar_livre','Academia ao ar livre'),
 ('pergolado','Pergolado e lounge'),('salao_festas','Salão de festas'),
 ('gourmet','Espaço gourmet'),('academia_coberta','Academia coberta'),
 ('jardins','Jardins e alamedas'),('casas_aluguel','Casas térreas'),
 ('torres_residenciais','Torres residenciais')]
COMMON_LINKS = {
 'portaria':['boulevard','casas_aluguel'], 'boulevard':['portaria','piscina','jardins','torres_residenciais'],
 'piscina':['boulevard','quadra','salao_festas'], 'quadra':['piscina','academia_ar_livre'],
 'academia_ar_livre':['quadra','pergolado'],'pergolado':['academia_ar_livre','jardins'],
 'salao_festas':['piscina','gourmet','academia_coberta'],'gourmet':['salao_festas'],
 'academia_coberta':['salao_festas'],'jardins':['boulevard','pergolado','casas_aluguel'],
 'casas_aluguel':['portaria','jardins'],'torres_residenciais':['boulevard']}

def main():
 manifest = json.loads((ROOT/'assets/plantas/manifesto-geracao.json').read_text(encoding='utf-8'))
 extras_path=BASE/'ambientes-adicionais.json'
 extras=json.loads(extras_path.read_text(encoding='utf-8')) if extras_path.exists() else []
 catalog = {}
 for prop in sorted(manifest['assets'],key=lambda x:x['id']):
  pid=prop['id']; rooms=[]
  names={**NAMES,**{r['id']:r['name'] for r in extras if r['property']==pid}}
  available=[rid for rid in names if (BASE/pid/f'{rid}.png').is_file()]
  links={k:list(v) for k,v in LINKS.items()}
  if 'circulacao' in available:
   links['sala']=[('cozinha',90),('varanda',-25),('circulacao',175)]
   for rid in ['suite','quarto','banheiro','quarto-3','quarto-4','banheiro-2','escritorio']:
    links[rid]=[('circulacao',140)]
   links['circulacao']=[('sala',175),('suite',-80),('quarto',65),('banheiro',130),('quarto-3',-130),('quarto-4',105),('banheiro-2',-40),('escritorio',30)]
  links['suite']+= [('banheiro-suite',-145),('closet',100)]
  links['cozinha']+= [('lavanderia',140)]
  links['sala']+= [('entrada',145)]
  links.update({'banheiro-suite':[('suite',145)],'closet':[('suite',140)],
    'lavanderia':[('cozinha',140),('patio-servico',-50)],'patio-servico':[('lavanderia',140)],'entrada':[('sala',0)]})
  # During generation, publish only scenes reachable from the living-room entry.
  if 'sala' not in available: continue
  reached=set(); queue=['sala']
  while queue:
   rid=queue.pop()
   if rid in reached: continue
   reached.add(rid)
   queue.extend(to for to,_ in links.get(rid,[]) if to in available and to not in reached)
  available=[rid for rid in ROOM_ORDER if rid in available and rid in reached]
  for rid in available:
   ext='webp' if (BASE/pid/f'{rid}.webp').is_file() else 'png'
   rooms.append({'id':rid,'name':names[rid], 'src':f'./assets/panoramas/{pid}/{rid}.{ext}', 'original':f'./assets/panoramas/{pid}/{rid}.png',
     'links':[{'to':to,'yaw':yaw,'pitch':-12} for to,yaw in links.get(rid,[]) if to in available]})
  if rooms: catalog[pid]={'name':pid+' · '+prop['name'],'rooms':rooms}
 available=[rid for rid,_ in COMMON if (BASE/'COMUM'/f'{rid}.png').is_file()]
 if available:
  rooms=[]
  for rid,name in COMMON:
   if rid not in available: continue
   links=[to for to in COMMON_LINKS[rid] if to in available]
   ext='webp' if (BASE/'COMUM'/f'{rid}.webp').is_file() else 'png'
   rooms.append({'id':rid,'name':name,'src':f'./assets/panoramas/COMUM/{rid}.{ext}','original':f'./assets/panoramas/COMUM/{rid}.png',
     'links':[{'to':to,'yaw':-55+i*55,'pitch':-12} for i,to in enumerate(links)]})
  catalog['COMUM']={'name':'Condomínio · Áreas comuns','rooms':rooms}
 (ROOT/'src/tour360Catalogo.js').write_text('// Gerado por tools/catalogar-panoramas.py\nexport const TOUR_CATALOG = '+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
 print(json.dumps({'properties':len(catalog),'panoramas':sum(len(p['rooms']) for p in catalog.values())}))
if __name__ == '__main__': main()
