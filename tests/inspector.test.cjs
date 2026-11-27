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
vm.runInContext(fs.readFileSync(require.resolve('../modules/scorm/player.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../assets/js/author/field-ui.js'),'utf8'),context);
const helpers = source.slice(source.indexOf('function input('),source.indexOf('function renderList('));
const inspector = source.slice(source.indexOf('const inspectorSections='),source.indexOf('function renderEditor('));
vm.runInContext(helpers+inspector,context);
const iconPicker=context.sectionIconPicker({icon:'chart'},0);
assert.equal([...iconPicker.matchAll(/data-section-icon=/g)].length,28);
assert.match(iconPicker,/data-section-icon="chart"[^>]*aria-pressed="true"/);
assert.match(context.sectionIconPicker({icon:'unknown'},0),/data-section-icon="folder"[^>]*aria-pressed="true"/);
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

const structureProject=ScenaModel.project();
ScenaModel.addGuide(structureProject);
structureProject.groups.push({id:'second',title:'Раздел «Практика»'});
const activity=ScenaModel.node('message','second');
ScenaModel.insert(structureProject,[activity],null,'second');
context.p=structureProject;
vm.runInContext(source.slice(source.indexOf('function linkOptions('),source.indexOf('function assetOptions(')),context);
const transitionOptions=context.linkOptions(activity.id);
assert.ok(transitionOptions.indexOf('label="Начало курса"')<transitionOptions.indexOf('label="Раздел «Практика»"'));
assert.ok(transitionOptions.indexOf('label="Раздел «Практика»"')<transitionOptions.indexOf('label="Итог курса"'));
assert.ok(transitionOptions.includes('value="'+activity.id+'" selected'));
assert.doesNotMatch(context.linkOptions('',{endOnly:true}),/Начало курса|Раздел «Практика»/);
console.log('Списки переходов группируют вступление, материалы и итог курса.');

const previewProject=ScenaModel.project();
ScenaModel.addGuide(previewProject);
const previewStep=ScenaModel.node('message','s1');
ScenaModel.insert(previewProject,[previewStep],previewProject.steps.find(s=>s.type==='end').id,'s1');
const previewMenu=ScenaModel.addSectionMenu(previewProject);
const elements={};
const previewContext={
 p:previewProject,selected:previewStep.id,M:ScenaModel,
 check:()=>({problems:[]}),
 notice(message){throw Error(message);},
 $:id=>elements[id]||=( {classList:{remove(){}},showModal(){this.open=true;}} ),
 document:{querySelector:()=>({})},
 ScenaSCORM:{preview(course){return JSON.stringify(course);}}
};
vm.createContext(previewContext);
vm.runInContext(source.slice(source.indexOf('function preview('),source.indexOf('async function build(')),previewContext);
for(const scope of [false,'from']){
 previewContext.preview(scope);
 const course=JSON.parse(elements['preview-frame'].srcdoc);
 assert.equal(course.mode,'guided');
 assert.equal(course.previewSectionMenu,false);
}
previewContext.preview(true);
assert.equal(JSON.parse(elements['preview-frame'].srcdoc).previewScope,'step');
assert.equal(JSON.parse(elements['preview-frame'].srcdoc).previewSectionMenu,true);
previewContext.preview('sections');
assert.equal(JSON.parse(elements['preview-frame'].srcdoc).start,previewMenu.id);
assert.equal(JSON.parse(elements['preview-frame'].srcdoc).previewSectionMenu,false);
const previewMarkup=fs.readFileSync(require.resolve('../index.html'),'utf8').match(/<dialog id="preview-dialog".*?<\/dialog>/)[0];
assert.match(previewMarkup,/<iframe [^>]+><\/iframe><\/dialog>$/);
assert.match(context.ScenaPlayer.markup,/<span id="errors"[^>]*><\/span><button [^>]*id="close-preview"[^>]* hidden>Закрыть<\/button>/);
console.log('Предпросмотр с выбранного шага использует меню режимов плеера, отдельный шаг имеет выход к разделам.');
