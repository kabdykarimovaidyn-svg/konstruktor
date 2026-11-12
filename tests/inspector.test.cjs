const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
require('../assets/js/author/model.js');
const source = fs.readFileSync(require.resolve('../assets/js/author/app.js'), 'utf8');
const panel = {innerHTML:'',querySelectorAll:()=>[]};
const project = ScenaModel.project();
const fieldStep = ScenaModel.node('form','s1');
fieldStep.background = 'screen.png';
fieldStep.fields[0].rule = 'any';
fieldStep.next = project.start;
fieldStep.jumps = [{id:'jump1',label:'Заказы',next:project.start,rect:{x:10,y:10,w:20,h:10}}];
project.steps.unshift(fieldStep);
project.start = fieldStep.id;
let selected = fieldStep;
const context = {
 p: project, M: ScenaModel, ScenaModel,
 node:()=>selected,
 $:id=>id==='inspector-content'?panel:{textContent:''},
 h:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 ScenaAreas:{currentField:n=>n.fields?.[0]},
 linkOptions:()=>'<option value="">Не выбран</option>',
 assetOptions:()=>'<option value="">Не выбран</option>'
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../assets/js/author/field-ui.js'),'utf8'),context);
const helpers = source.slice(source.indexOf('function input('),source.indexOf('function renderList('));
const inspector = source.slice(source.indexOf('const inspectorSections='),source.indexOf('function renderEditor('));
vm.runInContext(helpers+inspector,context);
for(const type of ['form','click','choice','video','intro','message','slide','return','end']){
 selected=type==='form'?fieldStep:ScenaModel.node(type,'s1');
 vm.runInContext('renderInspector()',context);
 assert.ok(panel.innerHTML.includes('data-inspector-section='));
 assert.ok(panel.innerHTML.includes('Оформление'));
 assert.ok(!panel.innerHTML.includes('data-screen-action'));
 if(type==='form'){
  for(const name of ['Добавить элемент','Свойства поля','Переходы по областям','Проверка и продолжение'])
   assert.ok(panel.innerHTML.includes(name),name);
  assert.ok(panel.innerHTML.includes('data-inspector-tool="jump"'));
  assert.ok(panel.innerHTML.includes('data-path="fields.0.expected"')===false);
  assert.ok(panel.innerHTML.includes('data-path="jumps.0.next"'));
 }
}
console.log('Правая панель: разделы, инструменты, выбранное поле и переходы доступны для всех типов шагов.');
