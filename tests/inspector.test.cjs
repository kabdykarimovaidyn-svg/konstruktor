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
 ScenaAreas:{currentField:n=>n.fields?.[0],items:n=>[...(n.fields||[]).map(f=>({key:'f:'+f.id,label:f.label,field:f})),...(n.jumps||[]).map(j=>({key:'j:'+j.id,label:j.label,jump:j})),...(n.decorations||[]).map(v=>({key:'v:'+v.id,label:v.label,visual:v}))]},
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
  for(const name of ['Добавить элемент','Свойства поля','Добавленные элементы','Проверка и продолжение'])
   assert.ok(panel.innerHTML.includes(name),name);
  assert.ok(panel.innerHTML.includes('data-inspector-tool="jump"'));
  assert.ok(panel.innerHTML.includes('data-path="fields.0.expected"')===false);
  assert.ok(panel.innerHTML.includes('data-applied-key="j:jump1"'));
 }
}
console.log('Правая панель: разделы, инструменты, выбранное поле и переходы доступны для всех типов шагов.');
selected=fieldStep;
selected.decorations=[{id:'v1',type:'text',label:'Заголовок',text:'Тест',rect:{x:1,y:1,w:40,h:20},autoFont:false,fontSize:24}];
context.ScenaAreas.currentVisual=n=>n.decorations?.[0];
vm.runInContext('renderInspector()',context);
for(const name of ['Фигуры','Текстовый блок','Свойства объекта','Цвет текста','Размер шрифта','Полужирный','Выравнивание'])
 assert.ok(panel.innerHTML.includes(name),name);
assert.ok(!panel.innerHTML.includes('data-inspector-design'));
assert.ok(panel.innerHTML.includes('data-path="decorations.0.text"'));
console.log('Панель оформления настраивает выбранный текстовый объект.');

assert.ok(!panel.innerHTML.includes(':visuals"'));
assert.ok(panel.innerHTML.indexOf('data-add-visual="arrow"')<panel.innerHTML.indexOf('Свойства объекта'));
assert.ok(panel.innerHTML.includes('viewBox="0 0 24 24"'));
selected.decorations[0].type='arrow';
vm.runInContext('renderInspector()',context);
assert.ok(panel.innerHTML.includes('data-rotate-object="90"'));
assert.ok(panel.innerHTML.includes('data-reset-rotation'));
console.log('Фигуры вложены в добавление элементов, палитра использует пиктограммы, поворот доступен в свойствах.');

assert.ok(!panel.innerHTML.includes('Переходы по областям'));
const addSection=panel.innerHTML.indexOf('data-inspector-section="'+selected.id+':add"');
const appliedList=panel.innerHTML.indexOf('class="applied-elements"');
assert.ok(appliedList>addSection);
assert.ok(panel.innerHTML.slice(0,panel.innerHTML.lastIndexOf('<div',appliedList)).endsWith('</div></details>'));
console.log('Применённые переходы отображаются соседним списком после закрытого раздела добавления.');

assert.ok(panel.innerHTML.includes('data-applied-key="j:jump1"'));
assert.ok(panel.innerHTML.includes('data-applied-key="v:v1"'));
assert.ok(panel.innerHTML.includes('data-applied-key="f:'));
console.log('Список добавленных объектов содержит поля, переходы и фигуры.');

context.ScenaAreas.currentEntry=n=>({key:'j:jump1',label:n.jumps[0].label,jump:n.jumps[0]});
context.ScenaAreas.currentVisual=()=>undefined;
vm.runInContext('renderInspector()',context);
assert.ok(panel.innerHTML.includes('Свойства перехода'));
assert.ok(panel.innerHTML.includes('data-path="jumps.0.next"'));
console.log('Выбор применённого перехода открывает его настройки.');
