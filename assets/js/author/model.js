/* Project data and graph operations. No DOM or SCORM dependencies. */
(function(root){
'use strict';
const types={video:'Видео',choice:'Выбор',form:'Поля ввода',click:'Область нажатия',message:'Экран / разбор',return:'Возврат к выбору',end:'Завершение'};
const uid=prefix=>prefix+'_'+Math.random().toString(36).slice(2,10);
function project(){const end=node('end','s1');return {schema:2,id:uid('course'),title:'Новый учебный курс',start:end.id,steps:[end],groups:[{id:'s1',title:'Сценарий 1'}],layout:{[end.id]:{x:60,y:60}},settings:{mode:'learn',penalty:10},assets:{}};}
function node(type,group){const id=uid('step');const n={id,type,title:types[type],instruction:'',group};if(type!=='end')n.next='';if(type==='video')n.src='';if(type==='choice'){delete n.next;n.options=[{id:uid('opt'),label:'Вариант 1',next:''},{id:uid('opt'),label:'Вариант 2',next:''}];n.video='';}if(type==='form'){n.fields=[field()];n.error='Проверьте заполнение полей.';n.button='Далее';}if(type==='click'){n.rect={x:35,y:60,w:30,h:12};n.error='Нажмите на нужную область.';n.label='Продолжить';}if(type==='message'){n.body='Введите пояснение или текст ситуации.';n.button='Продолжить';}if(type==='return'){n.title='Повторить выбор';n.penalty=true;}return n;}
function field(){return {id:uid('field'),label:'Поле ввода',rule:'exact',expected:'',rect:{x:20,y:35,w:60,h:10}};}
function links(n){return n.type==='end'?[]:n.options?n.options.filter(o=>!o.wrong).map(o=>({key:o.id||String(n.options.indexOf(o)),label:o.label,to:o.next})): [{key:'next',label:n.type==='return'?'Повторить выбор':'Далее',to:n.next}];}
function toCourse(p){return {id:p.id,title:p.title,start:p.start,mode:p.settings.mode,penalty:p.settings.penalty,steps:p.steps.map(n=>{const s=structuredClone(n);delete s.group;return s;})};}
function inspect(p){const problems=[],warnings=[],ids=new Set(p.steps.map(s=>s.id));
 if(!p.title.trim())problems.push({text:'Укажите название курса.'});
 if(!ids.has(p.start))problems.push({text:'Выберите стартовый шаг.'});
 if(!p.steps.some(n=>n.type==='end'))problems.push({text:'Добавьте завершение курса.'});
 for(const n of p.steps){const add=t=>problems.push({id:n.id,text:n.title+': '+t});
  if(n.type==='video'&&!p.assets[n.src])add('загрузите видео.');
  if(n.background&&!p.assets[n.background])add('файл скриншота отсутствует.');
  if(n.type==='click'&&!n.background)add('загрузите скриншот для области нажатия.');
  if(n.type==='choice'&&(!n.options?.length||!n.options.some(o=>!o.wrong)))add('нужен хотя бы один вариант с переходом.');
  if(n.type==='choice'&&n.video&&!p.steps.some(s=>s.id===n.video&&s.type==='video'))add('выберите существующее видео для последнего кадра.');
  if(n.type==='form'&&(!n.fields?.length))add('добавьте поле ввода.');
  for(const f of n.fields||[])if(f.rule!=='any'&&!String(f.expected||'').trim())add('укажите правильное значение поля «'+f.label+'».');
  for(const edge of links(n)){if(!edge.to)add('не настроен переход «'+edge.label+'».');else if(!ids.has(edge.to))add('переход ведёт к удалённому шагу.');}
  if(n.type==='return'&&n.next&&!p.steps.some(s=>s.id===n.next&&s.type==='choice'))add('возврат должен вести к точке выбора.');
 }
 const seen=new Set(),stack=[p.start];while(stack.length){const id=stack.pop();if(seen.has(id)||!ids.has(id))continue;seen.add(id);links(p.steps.find(n=>n.id===id)).forEach(e=>stack.push(e.to));}
 for(const n of p.steps)if(!seen.has(n.id))warnings.push({id:n.id,text:n.title+': шаг недостижим из начала курса.'});
 const ending=new Set(p.steps.filter(n=>n.type==='end').map(n=>n.id));let changed=true;while(changed){changed=false;for(const n of p.steps)if(!ending.has(n.id)&&links(n).some(e=>ending.has(e.to))){ending.add(n.id);changed=true;}}
 for(const n of p.steps)if(seen.has(n.id)&&!ending.has(n.id))problems.push({id:n.id,text:n.title+': из этой ветки нет пути к завершению.'});
 return {problems,warnings};
}
function link(p,from,key,to){const a=p.steps.find(n=>n.id===from),b=p.steps.find(n=>n.id===to);if(!a||!b||a.type==='end')throw Error('Выберите существующие шаги.');if(a.type==='return'&&b.type!=='choice')throw Error('Возврат должен вести к выбору.');if(a.options){const option=a.options.find(o=>o.id===key);if(!option)throw Error('Вариант удалён.');option.next=to;}else a.next=to;}
function remove(p,id){p.steps=p.steps.filter(n=>n.id!==id);delete p.layout[id];for(const n of p.steps){if(n.next===id)n.next='';if(n.video===id)n.video='';n.options?.forEach(o=>{if(o.next===id)o.next='';});}if(p.start===id)p.start=p.steps[0]?.id||'';}
function cleanImport(raw){if(!raw||raw.schema!==2||!Array.isArray(raw.steps)||raw.steps.length>500||!Array.isArray(raw.groups)||!raw.groups.length||typeof raw.id!=='string'||!/^[-\w]{1,80}$/.test(raw.id))throw Error('Неподдерживаемый формат проекта.');const p=structuredClone(raw);if(p.groups.length>100||p.groups.some(g=>!g||typeof g.id!=='string'||!/^[-\w]{1,80}$/.test(g.id)||['__proto__','constructor','prototype'].includes(g.id)))throw Error('Некорректные сценарии.');p.groups.forEach(g=>g.title=String(g.title||'Сценарий'));p.title=String(p.title||'Курс');p.layout=p.layout||{};p.assets=p.assets||{};p.settings={mode:'learn',penalty:10,...p.settings};if(!['learn','test'].includes(p.settings.mode)||!Number.isFinite(p.settings.penalty)||p.settings.penalty<0||p.settings.penalty>100)throw Error('Некорректные настройки курса.');const ids=new Set();for(const n of p.steps){if(!types[n.type]||!/^[-\w]{1,80}$/.test(n.id)||ids.has(n.id)||['__proto__','constructor','prototype'].includes(n.id))throw Error('Некорректные ID или типы шагов.');ids.add(n.id);n.title=String(n.title||types[n.type]);n.instruction=String(n.instruction||'');if(n.type==='choice'&&!n.options)n.options=[];if(n.type==='form'&&!n.fields)n.fields=[];if(!p.groups.some(g=>g.id===n.group))n.group=p.groups[0].id;if(n.options){if(!Array.isArray(n.options)||n.options.length>30)throw Error('Слишком много вариантов.');n.options.forEach(o=>o.id=o.id||uid('opt'));}if(n.fields&&(!Array.isArray(n.fields)||n.fields.length>30))throw Error('Слишком много полей.');const pos=p.layout[n.id];if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))p.layout[n.id]={x:60,y:60};else p.layout[n.id]={x:Math.max(0,Math.min(20000,pos.x)),y:Math.max(0,Math.min(30000,pos.y))};}return p;}
root.ScenaModel={types,uid,project,node,field,links,toCourse,inspect,link,remove,cleanImport};
})(typeof window!=='undefined'?window:globalThis);
