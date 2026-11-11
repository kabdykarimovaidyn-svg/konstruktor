/* Project data and graph operations. No DOM or SCORM dependencies. */
(function(root){
'use strict';
const FieldRules=root.ScenaFields||(typeof require==='function'?require('../../../modules/scorm/fields.js'):null);
const types={intro:'Начальная страница',slide:'Слайд презентации',video:'Видеоролик',choice:'Вопрос с вариантами ответа',form:'Скриншот с вводом данных',click:'Скриншот с нажатием кнопки',message:'Текст и объяснение',return:'Повторить вопрос',end:'Завершение курса'};
const descriptions={intro:'Обложка курса с логотипом и кнопкой «Начать».',slide:'Статический слайд презентации. Просмотрите и продолжите.',video:'Сотрудник смотрит видео, затем переходит дальше.',choice:'Добавьте кнопки с ответами и задайте, куда ведёт каждый ответ.',form:'Сотрудник заполняет поля поверх скриншота. Ответы проверяются.',click:'Сотрудник нажимает указанную кнопку на скриншоте.',message:'Покажите инструкцию, пояснение или причину результата.',return:'После последствий верните сотрудника к тому же вопросу.',end:'Завершите курс и передайте результат в систему обучения.'};
const count=(n,one,few,many)=>n+' '+(n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many);
const uid=prefix=>prefix+'_'+Math.random().toString(36).slice(2,10);
function project(){const end=node('end','s1');return {schema:2,id:uid('course'),title:'Новый учебный курс',start:end.id,steps:[end],groups:[{id:'s1',title:'Раздел 1'}],layout:{[end.id]:{x:60,y:60}},settings:{mode:'learn',penalty:10,flow:'sequence'},createdAt:Date.now(),assets:{}};}
function node(type,group){const id=uid('step');const n={id,type,title:types[type],instruction:'',group};if(type!=='end')n.next='';if(type==='intro'){n.body='Добро пожаловать! Нажмите «Начать», чтобы приступить.';n.button='Начать';}if(type==='slide')n.button='Далее';if(type==='video')n.src='';if(type==='choice'){delete n.next;n.options=[{id:uid('opt'),label:'Вариант 1',next:''},{id:uid('opt'),label:'Вариант 2',next:''}];n.video='';}if(type==='form'){n.fields=[field()];n.error='Проверьте заполнение полей.';n.button='Далее';}if(type==='click'){n.rect={x:35,y:60,w:30,h:12};n.error='Нажмите на нужную область.';n.label='Продолжить';}if(type==='message'){n.body='Введите пояснение или текст ситуации.';n.button='Продолжить';}if(type==='return'){n.title='Повторить вопрос';n.penalty=true;}return n;}
function field(){return {id:uid('field'),label:'Поле ввода',rule:'exact',expected:'',rect:{x:20,y:35,w:60,h:10}};}
function links(n){const primary= n.type==='end'?[]:n.options?n.options.filter(o=>!o.wrong).map(o=>({key:o.id||String(n.options.indexOf(o)),label:o.label,to:o.next})): [{key:'next',label:n.type==='return'?'Повторить выбор':'Далее',to:n.next}];return [...primary,...(n.jumps||[]).map(j=>({key:j.id,label:j.label,to:j.next}))];}
function toCourse(p){return {id:p.id,title:p.title,start:p.start,mode:p.settings.mode,penalty:p.settings.penalty,theme:structuredClone(p.theme||{}),steps:p.steps.map(n=>{const s=structuredClone(n);delete s.group;return s;})};}
function previewCourse(p,id){const current=p.steps.find(n=>n.id===id);if(!current)throw Error('Выберите шаг.');const finish={id:'preview_finish',type:'end',title:'Проверка шага завершена',body:'Этот шаг работает. Закройте предпросмотр, чтобы продолжить редактирование.'};while(p.steps.some(n=>n.id===finish.id))finish.id+='x';const nodes=new Map();function add(n){if(!n||nodes.has(n.id))return;const copy=structuredClone(n);nodes.set(copy.id,copy);if(copy.type==='return'){const question=p.steps.find(n=>n.id===copy.next&&n.type==='choice');if(!question)throw Error('Выберите вопрос для возврата.');add(question);}else if(copy.type!=='end'){if(copy.jumps)copy.jumps.forEach(j=>j.next=finish.id);if(copy.options)copy.options.forEach(o=>{if(!o.wrong)o.next=finish.id;});else copy.next=finish.id;}if(copy.video){const video=p.steps.find(n=>n.id===copy.video&&n.type==='video');if(!video)throw Error('Выберите видео для последнего кадра.');add(video);}}add(current);if(current.type==='video'&&!current.options){const question=p.steps.find(n=>n.id===current.next&&n.type==='choice');if(question){add(question);nodes.get(current.id).next=question.id;}}const dependencies=[],visited=new Set(),visiting=new Set();function collect(n){if(visiting.has(n.id))throw Error('Поля не могут ссылаться друг на друга по кругу.');if(visited.has(n.id))return;visiting.add(n.id);for(const f of n.fields||[])for(const ref of [f.rule==='match'?f.match:null,f.autofill].filter(Boolean))if(ref.stepId!==n.id){const source=p.steps.find(s=>s.id===ref.stepId);if(!source)throw Error('Выберите исходное поле для сравнения.');collect(source);add(source);if(!dependencies.includes(source.id))dependencies.push(source.id);}visiting.delete(n.id);visited.add(n.id);}collect(current);dependencies.forEach((id,index)=>{nodes.get(id).next=dependencies[index+1]||current.id;});return {...toCourse(p),previewScope:'step',previewDependencies:dependencies.length>0,start:dependencies[0]||current.id,steps:[...nodes.values(),finish]};}
function inspect(p){const problems=[],warnings=[],ids=new Set(p.steps.map(s=>s.id));
 if(!p.title.trim())problems.push({text:'Укажите название курса.'});
 if(!ids.has(p.start))problems.push({text:'Выберите стартовый шаг.'});
 if(!p.steps.some(n=>n.type==='end'))problems.push({text:'Добавьте завершение курса.'});
 for(const n of p.steps){const add=t=>problems.push({id:n.id,text:n.title+': '+t});
  if(n.type==='video'&&!p.assets[n.src])add('загрузите видео.');
  if(n.background&&!p.assets[n.background])add('файл скриншота отсутствует.');
  if(n.type==='click'&&!n.background)add('загрузите скриншот.');if(n.type==='click'&&!n.rect&&!n.jumps?.length)add('выделите кнопку на скриншоте.');
  if(n.type==='choice'&&(!n.options?.length||!n.options.some(o=>!o.wrong)))add('нужен хотя бы один вариант с переходом.');
  if(n.type==='choice'&&n.video&&!p.steps.some(s=>s.id===n.video&&s.type==='video'))add('выберите существующее видео для последнего кадра.');
  if(n.type==='form'&&(!n.fields?.length))add('добавьте поле ввода.');if(n.type==='form'&&n.background&&n.fields?.some(f=>!f.rect))add('выделите области всех полей на скриншоте.');
  if(n.jumps?.some(j=>!j.rect||!n.background||!p.steps.some(t=>t.id===j.next)))add('для перехода укажите область и целевой шаг.');
  for(const edge of links(n)){if(!edge.to)add('не настроен переход «'+edge.label+'».');else if(!ids.has(edge.to))add('переход ведёт к удалённому шагу.');}
  if(n.type==='return'&&n.next&&!p.steps.some(s=>s.id===n.next&&s.type==='choice'))add('возврат должен вести к точке выбора.');
 }
 const seen=new Set(),stack=[p.start];while(stack.length){const id=stack.pop();if(seen.has(id)||!ids.has(id))continue;seen.add(id);links(p.steps.find(n=>n.id===id)).forEach(e=>stack.push(e.to));}
 for(const n of p.steps)if(!seen.has(n.id)){
  const incoming=p.steps.filter(source=>links(source).some(edge=>edge.to===n.id));
  const reason=incoming.length
   ?'На него ведут переходы из '+incoming.map(source=>'«'+source.title+'»').join(', ')+', но эти шаги тоже не соединены с началом курса. Свяжите эту ветку с доступным шагом.'
   :'На этот шаг не ведёт ни один переход. На предыдущем экране выберите его в поле «Далее» или в области «Переход».';
  warnings.push({id:n.id,text:'«'+n.title+'» сотрудник не увидит при прохождении с начала. '+reason+' Если это запасной экран, предупреждение можно оставить.'});
 }
 const ending=new Set(p.steps.filter(n=>n.type==='end').map(n=>n.id));let changed=true;while(changed){changed=false;for(const n of p.steps)if(!ending.has(n.id)&&links(n).some(e=>ending.has(e.to))){ending.add(n.id);changed=true;}}
 for(const n of p.steps)if(seen.has(n.id)&&!ending.has(n.id))problems.push({id:n.id,text:n.title+': из этой ветки нет пути к завершению.'});
 for(const issue of FieldRules.issues(toCourse(p)))problems.push({id:issue.id,text:(p.steps.find(n=>n.id===issue.id)?.title||'Поля')+': '+issue.message});
 return {problems,warnings};
}
function link(p,from,key,to){const a=p.steps.find(n=>n.id===from),b=p.steps.find(n=>n.id===to);if(!a||!b||a.type==='end')throw Error('Выберите существующие шаги.');if(a.type==='return'&&b.type!=='choice')throw Error('Возврат должен вести к выбору.');const jump=a.jumps?.find(j=>j.id===key);if(jump){jump.next=to;p.settings.flow='branching';}else if(a.options){p.settings.flow='branching';const option=a.options.find(o=>o.id===key);if(!option)throw Error('Вариант удалён.');option.next=to;}else{p.settings.flow='branching';a.next=to;}}
function remove(p,id){const removed=p.steps.find(n=>n.id===id);if(removed?.template==='guide'&&removed.next&&removed.next!==id){for(const n of p.steps){if(n.next===id)n.next=removed.next;for(const edge of [...(n.options||[]),...(n.jumps||[])])if(edge.next===id)edge.next=removed.next;}if(p.start===id)p.start=removed.next;}p.steps=p.steps.filter(n=>n.id!==id);delete p.layout[id];for(const n of p.steps){if(n.next===id)n.next='';if(n.video===id)n.video='';[...(n.options||[]),...(n.jumps||[])].forEach(o=>{if(o.next===id)o.next='';});}if(p.start===id)p.start=p.steps[0]?.id||'';sequence(p);}

function ordered(p){return p.groups.flatMap(g=>p.steps.filter(n=>n.group===g.id));}
function sequence(p){if(p.settings.flow!=='sequence')return;const all=ordered(p),ends=all.filter(n=>n.type==='end');ends.forEach(n=>n.group=p.groups.at(-1).id);const steps=[...all.filter(n=>n.type!=='end'),...ends];p.steps=steps;p.start=steps[0]?.id||'';steps.forEach((n,i)=>{const next=steps[i+1]?.id||'';if(n.type==='end')return;if(n.options)n.options.forEach(o=>{if(!o.wrong)o.next=next;});else n.next=next;});}
function insert(p,nodes,afterId,groupId){const group=groupId||p.steps.find(n=>n.id===afterId)?.group||p.groups[0].id;nodes.forEach(n=>n.group=group);const original=p.steps.find(n=>n.id===afterId);const oldNext=original?.next;let list=p.steps.filter(n=>n.group===group),at=list.findIndex(n=>n.id===afterId)+1;if(original?.type==='end')at=Math.max(0,list.findIndex(n=>n.id===afterId));if(!afterId)at=list.findIndex(n=>n.type==='end');if(at<0)at=list.length;list.splice(at,0,...nodes);p.steps=p.groups.flatMap(g=>g.id===group?list:p.steps.filter(n=>n.group===g.id));
 nodes.forEach((n,i)=>{p.layout[n.id]={x:60,y:70+(at+i)*290};if(n.type!=='end'&&!n.options)n.next=nodes[i+1]?.id||oldNext||list.find(n=>n.type==='end')?.id||'';});
 if(p.settings.flow==='sequence')sequence(p);else if(original&&original.type!=='end'&&original.type!=='return'&&!original.options)original.next=nodes[0].id;
}
function move(p,id,targetId,after=false,groupId){if(id===targetId)return;const n=p.steps.find(n=>n.id===id);if(!n)return;const target=p.steps.find(n=>n.id===targetId),group=target?.group||groupId||n.group;if(!p.groups.some(g=>g.id===group))return;const rest=p.steps.filter(s=>s.id!==id),groupNodes=rest.filter(s=>s.group===group);let at=target?groupNodes.findIndex(s=>s.id===targetId)+(after?1:0):groupNodes.length;n.group=group;groupNodes.splice(Math.max(0,at),0,n);p.steps=p.groups.flatMap(g=>g.id===group?groupNodes:rest.filter(s=>s.group===g.id));sequence(p);}
function moveGroup(p,id,direction){const at=p.groups.findIndex(g=>g.id===id),to=at+direction;if(at<0||to<0||to>=p.groups.length)return;[p.groups[at],p.groups[to]]=[p.groups[to],p.groups[at]];p.steps=ordered(p);sequence(p);}
function removeGroup(p,id){if(p.groups.length<=1)throw Error('В курсе должен оставаться хотя бы один раздел.');const remaining=p.groups.filter(g=>g.id!==id);if(p.settings.flow==='sequence')p.steps.filter(n=>n.group===id&&n.type==='end').forEach(n=>n.group=remaining.at(-1).id);const ids=p.steps.filter(n=>n.group===id).map(n=>n.id);p.groups=remaining;ids.forEach(id=>remove(p,id));sequence(p);}

function cleanImport(raw){if(!raw||raw.schema!==2||!Array.isArray(raw.steps)||raw.steps.length>500||!Array.isArray(raw.groups)||!raw.groups.length||typeof raw.id!=='string'||!/^[-\w]{1,80}$/.test(raw.id))throw Error('Неподдерживаемый формат проекта.');const p=structuredClone(raw);if(p.groups.length>100||p.groups.some(g=>!g||typeof g.id!=='string'||!/^[-\w]{1,80}$/.test(g.id)||['__proto__','constructor','prototype'].includes(g.id)))throw Error('Некорректные сценарии.');p.groups.forEach(g=>g.title=String(g.title||'Сценарий'));p.title=String(p.title||'Курс');p.layout=p.layout||{};p.assets=p.assets||{};p.theme=p.theme||{};p.settings={mode:'learn',penalty:10,flow:'branching',...p.settings};if(!['learn','test'].includes(p.settings.mode)||!Number.isFinite(p.settings.penalty)||p.settings.penalty<0||p.settings.penalty>100)throw Error('Некорректные настройки курса.');const ids=new Set();for(const n of p.steps){if(!types[n.type]||!/^[-\w]{1,80}$/.test(n.id)||ids.has(n.id)||['__proto__','constructor','prototype'].includes(n.id))throw Error('Некорректные ID или типы шагов.');ids.add(n.id);if(n.jumps!==undefined&&(!Array.isArray(n.jumps)||n.jumps.length>30||n.jumps.some(j=>!j||typeof j.id!=='string'||typeof j.label!=='string'||typeof j.next!=='string')))throw Error('Некорректные области перехода.');n.title=String(n.title||types[n.type]);n.instruction=String(n.instruction||'');if(n.type==='choice'&&!n.options)n.options=[];if(n.type==='form'&&!n.fields)n.fields=[];if(!p.groups.some(g=>g.id===n.group))n.group=p.groups[0].id;if(n.options){if(!Array.isArray(n.options)||n.options.length>30)throw Error('Слишком много вариантов.');n.options.forEach(o=>o.id=o.id||uid('opt'));}if(n.fields&&(!Array.isArray(n.fields)||n.fields.length>30))throw Error('Слишком много полей.');const pos=p.layout[n.id];if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))p.layout[n.id]={x:60,y:60};else p.layout[n.id]={x:Math.max(0,Math.min(20000,pos.x)),y:Math.max(0,Math.min(30000,pos.y))};}return p;}
function guideNode(group){
 const n=node('message',group);
 n.template='guide';
 n.title='Как проходить тренажёр';
 n.button='Понятно, начать';
 n.body=[
  'Прогресс|Синяя полоска сверху показывает, какую часть курса вы прошли.',
  'Счётчик ошибок|Справа сверху показано количество неверных действий.',
  'Задание|Синяя плашка сверху объясняет, что нужно сделать на текущем экране.',
  'Активная область|Синяя обводка и мягкая пульсация показывают, куда можно нажать.',
  'Поле ввода|Нажмите на поле и введите данные по заданию.',
  'Выпадающий список|Нажмите на стрелку вниз и выберите вариант. Длинный список можно прокрутить.',
  'Галочка|Нажмите, чтобы поставить или снять отметку.',
  'Сообщение об ошибке|Красная подсказка снизу объясняет, что исправить. Попробуйте ещё раз.',
  'Увеличить|Нажмите «Увеличить», если детали скриншота плохо видны. «Вписать» вернёт общий вид.'
 ].join('\n');
 return n;
}
function addGuide(p){
 if(p.steps.some(n=>n.template==='guide'))return;
 addIntro(p);
 const intro=p.steps.find(n=>n.type==='intro'),guide=guideNode(intro.group);
 guide.next=intro.next;
 intro.next=guide.id;
 p.steps.splice(p.steps.indexOf(intro)+1,0,guide);
 p.layout[guide.id]={x:60,y:310};
}
function addIntro(p){if(p.steps.some(n=>n.type==='intro'))return;const intro=node('intro',p.groups[0].id);intro.next=p.start;p.steps.unshift(intro);p.start=intro.id;p.layout[intro.id]={x:60,y:20};sequence(p);}
function fieldCandidates(p,stepId,fieldId){return FieldRules.candidates({...toCourse(p),steps:ordered(p)},stepId,fieldId);}
function usedFields(p){return FieldRules.remembered(toCourse(p));}
root.ScenaModel={guideNode,addGuide,addIntro,fieldCandidates,usedFields,types,descriptions,count,uid,project,node,field,links,toCourse,previewCourse,inspect,link,remove,cleanImport,ordered,sequence,insert,move,moveGroup,removeGroup};
})(typeof window!=='undefined'?window:globalThis);
