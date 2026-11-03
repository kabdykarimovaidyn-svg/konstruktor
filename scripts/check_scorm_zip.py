"""Run after node tests/scorm.test.cjs. No external dependencies."""
from zipfile import ZipFile
from pathlib import Path
import xml.etree.ElementTree as ET
import os,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
node=os.environ.get('CODEX_PRIMARY_RUNTIME_NODE') or shutil.which('node') or '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node'
for filename in [Path('/tmp/scena-module-test.zip'),Path('/tmp/scena-media-test.zip'),ROOT.parent/'scena-gmail-scorm12.zip']:
 with ZipFile(filename) as archive:
  assert archive.testzip() is None
  manifest=ET.fromstring(archive.read('imsmanifest.xml'))
  for element in manifest.iter():
   if element.tag.endswith('file'): assert element.attrib['href'] in archive.namelist()
  with tempfile.TemporaryDirectory() as tmp:
   for name in ['course.js','player.js']:
    path=Path(tmp)/name;path.write_bytes(archive.read(name));subprocess.run([node,'--check',str(path)],check=True)
   if filename.name=='scena-gmail-scorm12.zip':
    subprocess.run([node,str(ROOT/'tests/player.test.cjs'),str(Path(tmp)/'course.js'),str(Path(tmp)/'player.js')],check=True)
print('SCORM ZIP: CRC, XML, ссылки, JavaScript проверены.')
