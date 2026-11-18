from pathlib import Path
from PIL import Image
import json
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
folder = root / 'assets' / 'plantas'
files = sorted(folder.glob('*/*.png'))
assert len(files) == 58, f'Esperados 58 PNGs; encontrados {len(files)}'
report = []
for path in files:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        item = {'arquivo': path.relative_to(folder).as_posix(), 'dimensoes': list(image.size),
                'modo': image.mode, 'bytes': path.stat().st_size,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        assert image.format == 'PNG'
        if path.name != 'ambientes.png':
            assert image.mode == 'RGBA', f'Sem alpha: {path}'
            hist = image.getchannel('A').histogram()
            clear = sum(hist[:10]) / (image.width * image.height)
            assert clear > .02, f'Sem exterior transparente suficiente: {path}'
            item['percentual_transparente'] = round(clear * 100, 2)
        report.append(item)
assert len({r['sha256'] for r in report}) == len(report), 'Imagens duplicadas'
for prefix, count in [('AP', 20), ('CS', 6)]:
    for i in range(1, count + 1):
        project = folder / f'{prefix}-{i:02d}'
        expected = ['planta.png', 'ambientes.png'] + (['estrutura.png'] if prefix == 'CS' else [])
        assert all((project / name).is_file() for name in expected), f'Conjunto incompleto: {project}'
(folder / 'verificacao.json').write_text(json.dumps({'arquivos_png': len(report), 'arquivos': report}, ensure_ascii=False, indent=2), encoding='utf-8')
archive = root / 'Imagens-Plantas-e-Ambientes.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z:
    for path in sorted(folder.rglob('*')):
        if path.is_file():
            z.write(path, Path('plantas') / path.relative_to(folder))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'pngs': len(report), 'zip': str(archive), 'zip_mb': round(archive.stat().st_size / 1048576, 1)}))
