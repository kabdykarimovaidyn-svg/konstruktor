"""Проверка синтаксиса JS и встроенных обработчиков без установки пакетов."""
from pathlib import Path
import os, re, shutil, subprocess, tempfile
ROOT = Path(__file__).resolve().parents[1]
node = os.environ.get('CODEX_PRIMARY_RUNTIME_NODE') or shutil.which('node')
if not node:
    candidate = Path('/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node')
    if candidate.exists(): node = str(candidate)
if not node: raise SystemExit('Для проверки синтаксиса нужен Node.js.')
html = (ROOT / 'index.html').read_text()
for path in re.findall(r'(?:src|href)="((?:assets|modules)/[^"]+)"', html):
    assert (ROOT / path.split('?',1)[0]).is_file(), path
for path in sorted(list((ROOT / 'assets/js').rglob('*.js')) + list((ROOT / 'modules').rglob('*.js'))):
    subprocess.run([node, '--check', str(path)], check=True)
# Проверяет также HTML/JS-границы в исходной разметке.
handlers = re.findall(r'\bon\w+="([^"]*)"', html)
import html as html_module
with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / 'handlers.js'
    path.write_text('\n'.join('function handler'+str(i)+'(event){'+html_module.unescape(value)+'}' for i,value in enumerate(handlers)))
    subprocess.run([node, '--check', str(path)], check=True)
print('Ссылки на файлы, JavaScript и обработчики проверены.')
