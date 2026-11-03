"""Собрать автономный HTML без внешних зависимостей."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text()
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + (ROOT / m[1].split('?',1)[0]).read_text() + '</style>', html)
html = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + re.sub(r'</script', lambda _: r'<\/script', (ROOT / m[1].split('?',1)[0]).read_text(), flags=re.I) + '</script>', html)
(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist/index.html').write_text(html)
print('Собран dist/index.html')
