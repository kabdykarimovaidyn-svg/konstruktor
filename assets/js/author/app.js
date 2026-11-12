/* Author application: coordinates modules; SCORM internals stay isolated. */
(function(){
'use strict';
const M=ScenaModel,$=id=>document.getElementById(id),h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let p=M.project(),selected=p.start,tab='editor',undo=[],redo=[],revision=0,saveTimer,saveChain=Promise.resolve(),unsaved=false,urls=new Map(),drawing=null,uploadTarget=null,toastTimer,busy=false,selectedGroup=p.groups[0].id,hasProject=false,addAnchor=null,pendingBatch=[],batchURLs=new Map(),confirmResolver=null,previewToken=null;
const icon={intro:'▶',slide:'▧',video:'▷',choice:'⑂',form:'⌨',click:'▧',message:'≡',return:'↩',end:'✓'};
const node=()=>p.steps.find(n=>n.id===selected);
function notice(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4500);}
function url(path){const a=p.assets[path];if(!a)return '';let stored=urls.get(path);if(stored?.blob!==a.blob){if(stored)URL.revokeObjectURL(stored.url);stored={blob:a.blob,url:URL.createObjectURL(a.blob)};urls.set(path,stored);}return stored.url;}
function clearURLs(){for(const item of urls.values())URL.revokeObjectURL(item.url);urls.clear();}
function checkpoint(){undo.push(structuredClone(p));if(undo.length>40)undo.shift();redo=[];}
function changed(){unsaved=true;revision++;$('save-status').textContent='Сохраняется…';clearTimeout(saveTimer);const rev=revision;saveTimer=setTimeout(()=>{const snapshot=structuredClone(p);saveChain=saveChain.catch(()=>{}).then(()=>ScenaStorage.save(snapshot)).then(updatedAt=>{if(revision===rev){unsaved=false;p.updatedAt=updatedAt;$('save-status').textContent='Сохранено в браузере';}}).catch(()=>{$('save-status').textContent='Не сохранено · скачайте проект';notice('Автосохранение недоступно или закончилось место. Скачайте файл проекта.');});},500);}
function mutate(fn){checkpoint();fn();changed();}
function restoreHistory(back){const src=back?undo:redo,dst=back?redo:undo;if(!src.length)return;dst.push(structuredClone(p));p=src.pop();if(!p.steps.some(n=>n.id===selected))selected=p.steps[0]?.id;changed();render();}
function select(id,full=true){if(!p.steps.some(n=>n.id===id))return;selected=id;selectedGroup=p.steps.find(n=>n.id===id).group;drawing=null;if(full)render();else{renderInspector();renderList();}}
function title(id){return p.steps.find(n=>n.id===id)?.title||'Не выбран';}
function linkOptions(value,{choiceOnly=false,videoOnly=false}={}){return '<option value="">Не выбран</option>'+p.steps.filter(n=>(!choiceOnly||n.type==='choice')&&(!videoOnly||n.type==='video')).map(n=>`<option value="${h(n.id)}" ${n.id===value?'selected':''}>${h(n.title)}</option>`).join('');}
function assetOptions(value,video=false){return '<option value="">Не выбран</option>'+Object.entries(p.assets).filter(([,a])=>video?a.blob.type.startsWith('video/'):a.blob.type.startsWith('image/')).map(([path,a])=>`<option value="${h(path)}" ${path===value?'selected':''}>${h(a.name)}</option>`).join('');}
function input(label,path,value,type='text'){return `<label>${h(label)}<input type="${type}" data-path="${h(path)}" value="${h(value??'')}" ${type==='number'?'step="0.1"':''}></label>`;}
function textarea(label,path,value){return `<label>${h(label)}<textarea data-path="${h(path)}">${h(value||'')}</textarea></label>`;}
function target(label,path,value,options={}){return `<label>${h(label)}<select data-path="${h(path)}">${linkOptions(value,options)}</select></label>`;}
function rectFields(path,r){r=r||{x:20,y:20,w:30,h:10};return `<div class="rect-grid">${['x','y','w','h'].map((key,i)=>`<label>${['X, %','Y, %','Ш, %','В, %'][i]}<input type="number" min="0" max="100" step="0.1" data-path="${h(path+'.'+key)}" value="${Number(r[key]).toFixed(1)}"></label>`).join('')}</div>`;}
function checkbox(label,path,value){return `<label><input type="checkbox" data-path="${h(path)}" ${value?'checked':''}>${h(label)}</label>`;}
function renderList(){ScenaOutline.render();}
const inspectorSections=new Map();
let inspectorSelectedField='',inspectorSelectedVisual='';
function inspectorSection(n,key,title,content,defaultOpen=false){
 const stateKey=n.id+':'+key;
 const open=inspectorSections.has(stateKey)?inspectorSections.get(stateKey):defaultOpen;
 return '<details class="inspector-section" data-inspector-section="'+h(stateKey)+'" '+(open?'open':'')+'>'+
  '<summary>'+h(title)+'</summary><div class="inspector-section-body">'+content+'</div></details>';
}
function openElementTools(){
 const n=node();if(!n)return;
 inspectorSections.set(n.id+':add',true);
 renderInspector();
 if(innerWidth<=1160)document.body.classList.add('inspector-open');
 const section=Array.from($('inspector-content').querySelectorAll('[data-inspector-section]'))
  .find(item=>item.dataset.inspectorSection===n.id+':add');
 section?.scrollIntoView({block:'nearest'});
 section?.querySelector('summary')?.focus({preventScroll:true});
}
function renderInspector(){
 const n=node(),panel=$('inspector-content');
 $('selected-id').textContent=n?.id||'';
 if(!n){panel.innerHTML='<p class="muted">Добавьте или выберите шаг.</p>';return;}
 const section=(key,title,body,open=false)=>inspectorSection(n,key,title,body,open);
 const screen=['form','click'].includes(n.type);
 const selectedVisual=ScenaAreas.currentVisual?.(n);
 const visualKey=selectedVisual?n.id+':'+selectedVisual.id:'';
 if(visualKey&&visualKey!==inspectorSelectedVisual){inspectorSections.set(n.id+':design',true);inspectorSections.set(n.id+':visual-properties',true);inspectorSections.set(n.id+':field',false);}
 inspectorSelectedVisual=visualKey;
 const selectedField=n.type==='form'?ScenaAreas.currentField(n):null;
 const selectionKey=selectedField?n.id+':'+selectedField.id:'';
 if(selectionKey&&selectionKey!==inspectorSelectedField)inspectorSections.set(n.id+':field',true);
 inspectorSelectedField=selectionKey;
 let out='<p class="inspector-explanation">'+h(M.descriptions[n.type])+'</p>';
 const info=input('Название шага · видно автору','title',n.title)+
  '<label>Раздел курса<select data-path="group" '+(n.type==='end'&&p.settings.flow==='sequence'?'disabled':'')+'>'+
  p.groups.map(g=>'<option value="'+h(g.id)+'" '+(n.group===g.id?'selected':'')+'>'+h(g.title)+'</option>').join('')+'</select></label>';
 out+=section('step','О шаге',info);
 out+=section('task','Задание сотруднику',
  input('Заголовок задания','taskTitle',n.taskTitle)+textarea('Текст задания','instruction',n.instruction));
 let media='';
 if(n.type==='video'){
  media='<label>Видеофайл<select data-path="src">'+assetOptions(n.src,true)+'</select></label>'+
   '<button data-upload="video" class="full">'+(n.src?'Заменить видео':'Загрузить видео')+'</button>';
 }
 if(['form','click','choice'].includes(n.type)){
  media='<label>Скриншот фона<select data-path="background">'+assetOptions(n.background)+'</select></label>'+
   '<button data-upload="image" class="full">'+(n.background?'Заменить скриншот':'Загрузить скриншот')+'</button>';
  if(screen&&n.background)media+='<button data-crop-screen class="full">Обрезать / вырезать окно</button>';
 }
 if(media)out+=section('media',n.type==='video'?'Видеоматериал':'Скриншот',media,!n.background&&!n.src);
 if(['form','click','choice'].includes(n.type)){
  const icons={
   text:'<path d="M5 5h14M12 5v14M8 19h8"/>',
   input:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9v6M10 9h7"/>',
   select:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m14 10 3 3 3-3M6 10h4"/>',
   checkbox:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
   radio:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
   jump:'<path d="M10 5H4v14h6M10 12h11m-5-5 5 5-5 5"/>',
   submit:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 3 3 5-6"/>',
   rectangle:'<rect x="3" y="5" width="18" height="14" rx="1"/>',
   ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
   triangle:'<path d="m12 3 10 17H2Z"/>',
   arrow:'<path d="M3 12h17m-6-6 6 6-6 6"/>',
   line:'<path d="m4 19 16-14"/>'
  };
  const toolButton=(key,label,attribute,icon,disabled=false)=>
   '<button type="button" class="tool-tile" '+attribute+'="'+key+'" '+(disabled?'disabled':'')+' title="'+h(label)+'">'+
   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[icon||key]+'</svg><span>'+h(label)+'</span></button>';
  let tools='<p class="tool-instruction">Выберите инструмент и обведите место на скриншоте.</p>';
  if(screen){
   tools+='<div class="tool-group-label">Ввод и действия</div><div class="tool-palette interaction-palette">'+
    [['text','Поле ввода','input'],['select','Список'],['checkbox','Галочка'],['radio','Переключатели'],['jump','Переход'],['submit','Проверить']].map(([key,label,icon])=>
     toolButton(key,label,'data-inspector-tool',icon,!n.background&&['jump','submit'].includes(key))).join('')+'</div>';
  }
  tools+='<div class="tool-group-label">Надпись</div><div class="tool-palette text-palette">'+
   toolButton('text','Текстовый блок','data-add-visual','text',!n.background)+'</div>'+
   '<div class="tool-group-label">Фигуры</div><div class="tool-palette shape-palette">'+
   [['rectangle','Прямоугольник'],['ellipse','Овал'],['triangle','Треугольник'],['arrow','Стрелка'],['line','Линия']].map(([key,label])=>
    toolButton(key,label,'data-add-visual',key,!n.background)).join('')+'</div>';
  out+=section('add','Добавить элемент',tools,true);
 }
 if(n.type==='form'&&!selectedVisual){
  const fields='<label>Выбранное поле<select data-inspector-field>'+
   n.fields.map(f=>'<option value="'+h(f.id)+'" '+(ScenaAreas.currentField(n)?.id===f.id?'selected':'')+'>'+h(f.label)+'</option>').join('')+
   '</select></label>'+ScenaFieldUI.html(p,n,{input,checkbox,rectFields});
  out+=section('field','Свойства поля',fields,true);
 }
 if(selectedVisual){
  const i=n.decorations.indexOf(selectedVisual),base='decorations.'+i+'.';
  let props='<label>Выбранный объект<select data-inspector-visual>'+n.decorations.map(v=>
   '<option value="'+h(v.id)+'" '+(v.id===selectedVisual.id?'selected':'')+'>'+h(v.label)+'</option>').join('')+'</select></label>'+
   input('Название объекта',base+'label',selectedVisual.label);
  if(selectedVisual.type==='text')props+=textarea('Текст',base+'text',selectedVisual.text);
  props+='<details class="advanced"><summary>Положение и размер</summary>'+rectFields(base+'rect',selectedVisual.rect)+'</details>'+
   '<button data-delete-visual="'+i+'" class="full danger">Удалить объект</button>';
  out+=section('visual-properties','Свойства объекта',props,true);
 }
 let content='';
 if(n.type==='intro')content=textarea('Описание на обложке','body',n.body);
 if(n.type==='message'){
  if(n.template==='guide')content+='<p class="small">Каждая строка — «Название|Пояснение» для одного пункта инструкции.</p>';
  content+=textarea('Текст страницы','body',n.body)+input('Подпись кнопки','button',n.button);
 }
 if(n.type==='end')content=textarea('Текст завершения','body',n.body);
 if(content)out+=section('content',n.type==='intro'?'Содержание обложки':'Содержание страницы',content,true);
 if(n.type==='choice'){
  let options='';
  n.options.forEach((o,i)=>{
   const base='options.'+i+'.';
   let body=input('Текст ответа',base+'label',o.label)+
    checkbox('Засчитать ошибку сразу и остаться на шаге',base+'wrong',o.wrong)+
    (o.wrong?textarea('Сообщение об ошибке',base+'error',o.error):target('Открыть шаг',base+'next',o.next));
   if(n.background||n.video)body+='<button data-draw-option="'+i+'" class="full">Обвести кнопку на экране</button>';
   if(o.rect)body+='<details class="advanced"><summary>Положение и размер</summary>'+rectFields(base+'rect',o.rect)+'</details>';
   if(n.video)body+='<details class="advanced"><summary>Оформление кнопки</summary>'+
    input('Цвет кнопки',base+'color',o.color||'#005ca9','color')+
    input('Цвет текста',base+'textColor',o.textColor||'#ffffff','color')+
    input('Размер шрифта',base+'fontSize',o.fontSize||16,'number')+
    checkbox('Скругление',base+'rounded',o.rounded!==false)+'</details>';
   body+='<button data-remove-option="'+i+'" class="full danger">Удалить ответ</button>';
   options+=section('option-'+(o.id||i),'Ответ '+(i+1)+' · '+o.label,body);
  });
  options+='<button data-add-option class="full">Добавить ответ</button>'+
   '<p class="small">Чтобы показать последствия решения, укажите шаг с видео. Ошибку можно засчитать позже через возврат к вопросу.</p>';
  if(n.background)options+=checkbox('Считать ошибкой нажатие мимо активной области','countMissClicks',n.countMissClicks===true);
  out+=section('answers','Ответы и переходы',options,true);
  const video=target('Видео для последнего кадра','video',n.video,{videoOnly:true})+
   checkbox('Выбрать ответ и подтвердить кнопкой «Далее»','selectBeforeContinue',n.selectBeforeContinue)+
   (n.video?'<label>Когда показывать ответы<select data-path="showMode"><option value="end" '+(n.showMode!=='time'?'selected':'')+'>В конце видео</option><option value="time" '+(n.showMode==='time'?'selected':'')+'>На указанной секунде с паузой</option></select></label>'+
    (n.showMode==='time'?input('Секунда появления','showAt',n.showAt||0,'number'):''):'');
  out+=section('video-options','Ответы поверх видео',video);
 }
 if(screen){
  let transitions='';
  for(const [i,j] of (n.jumps||[]).entries()){
   transitions+=section('jump-'+j.id,j.label,
    input('Название области','jumps.'+i+'.label',j.label)+
    target('Открыть шаг','jumps.'+i+'.next',j.next)+
    '<button data-redraw-jump="'+i+'" class="full">Обвести область заново</button>'+
    '<button data-remove-jump="'+i+'" class="full danger">Удалить переход</button>');
  }
  if(!n.jumps?.length)transitions='<p class="small">Переходов пока нет. В разделе «Добавить элемент» выберите «Переход» и обведите кнопку или вкладку.</p>';
  out+=section('jumps','Переходы по областям'+(n.jumps?.length?' · '+n.jumps.length:''),transitions);
  let check=textarea('Сообщение при неверном действии','error',n.error);
  if(n.type==='form'){
   check=input('Подпись кнопки проверки','button',n.button)+check+
    target('После правильного заполнения','next',n.next)+
    '<button data-draw-submit class="full">Обвести кнопку проверки на скриншоте</button>';
   if(n.submitRect)check+='<details class="advanced"><summary>Положение кнопки проверки</summary>'+rectFields('submitRect',n.submitRect)+'</details><button data-clear-submit class="full">Убрать область проверки</button>';
  }else{
   check=input('Название кнопки','label',n.label)+
    '<button data-draw-click class="full">Обвести кнопку на скриншоте</button>'+check+
    target('После нажатия','next',n.next);
   if(n.rect)check+='<details class="advanced"><summary>Положение кнопки</summary>'+rectFields('rect',n.rect)+'</details>';
  }
  check+=checkbox('Считать ошибкой нажатие мимо активной области','countMissClicks',n.countMissClicks===true)+
   '<p class="small">Если выключено, свободные клики по скриншоту не увеличивают счётчик ошибок. Значения полей проверяются при подтверждении.</p>';
  check+=checkbox('Показывать «Далее» под экраном','showNext',n.showNext??!(n.jumps?.length||n.submitRect));
  out+=section('continue','Проверка и продолжение',check);
 }
 let next='';
 if(n.type==='video')next=target('После окончания видео','next',n.next);
 if(n.type==='intro')next=target('После кнопки «Начать»','next',n.next);
 if(n.type==='slide')next=target('После слайда','next',n.next);
 if(n.type==='message')next=target('Открыть следующий шаг','next',n.next);
 if(n.type==='return')next=target('Вернуться к вопросу','next',n.next,{choiceOnly:true})+
  checkbox('Засчитать ветку как одну ошибку','penalty',n.penalty!==false);
 if(next)out+=section('next','Переход к следующему шагу',next);
 let design='<p class="small">Выделите текст или фигуру на скриншоте, чтобы настроить оформление этого объекта.</p>';
 if(selectedVisual){
  const v=selectedVisual,i=n.decorations.indexOf(v),base='decorations.'+i+'.';
  design=input(v.type==='text'?'Цвет текста':'Цвет обводки',base+'color',v.color||'#005ca9','color');
  if(v.type==='text'){
   design+='<label>Шрифт<select data-path="'+base+'font">'+['Arial','Verdana','Georgia','Tahoma','Trebuchet MS'].map(font=>
    '<option '+(v.font===font?'selected':'')+'>'+font+'</option>').join('')+'</select></label>'+
    checkbox('Автоподбор по размеру блока',base+'autoFont',v.autoFont!==false)+
    (v.autoFont===false?input('Размер шрифта',base+'fontSize',v.fontSize||24,'number'):'')+
    checkbox('Полужирный',base+'bold',v.bold)+checkbox('Курсив',base+'italic',v.italic)+
    '<label>Выравнивание<select data-path="'+base+'align">'+[['left','Слева'],['center','По центру'],['right','Справа']].map(([key,title])=>
     '<option value="'+key+'" '+(v.align===key?'selected':'')+'>'+title+'</option>').join('')+'</select></label>';
  }else{
   design+=input('Толщина обводки',base+'strokeWidth',v.strokeWidth??2,'number')+
    input('Поворот, °',base+'rotation',v.rotation||0,'number')+
    '<div class="rotation-actions"><button data-rotate-object="-90" title="Повернуть влево на 90°">↶ 90°</button><button data-rotate-object="90" title="Повернуть вправо на 90°">↷ 90°</button><button data-reset-rotation>Сбросить</button></div>'+
    '<p class="small">Или тяните круглую ручку над выделенной фигурой. Shift — шаг 15°.</p>';
  }
  if(v.type!=='line')design+=checkbox('Без заливки',base+'noFill',v.noFill!==false)+
   (v.noFill===false?input('Цвет заливки',base+'fill',v.fill||'#e7f1fb','color'):'');
 }
 out+=section('design','Оформление',design,!!selectedVisual);
 out+=section('actions','Действия с шагом',
  '<button data-set-start class="full">Сделать началом курса</button><button data-duplicate class="full">Создать копию шага</button><button data-delete class="full danger">Удалить шаг</button>');
 panel.innerHTML=out;
 panel.querySelectorAll('details').forEach((details,index)=>{
  const key=details.dataset.inspectorSection||n.id+':advanced:'+
   (details.querySelector('[data-path]')?.dataset.path||details.querySelector('summary')?.textContent||index);
  if(!details.dataset.inspectorSection&&inspectorSections.has(key))details.open=inspectorSections.get(key);
  details.addEventListener('toggle',()=>{
   if(details.isConnected)inspectorSections.set(key,details.open);
  });
 });
}
function renderEditor(){const n=node();$('selected-type').textContent=n?M.types[n.type]:'';$('selected-title').textContent=n?.title||'Добавьте первый шаг';if(!n){$('editor-content').innerHTML='<div class="placeholder">Добавьте шаг в левой панели.</div>';return;}
 let content='<p class="step-description">'+h(M.descriptions[n.type])+'</p>';content+=n.instruction?`<div class="step-instruction"><h3>${h(n.taskTitle||'Работа в программе')}</h3><strong>Задание</strong><span>${h(n.instruction)}</span></div>`:'';
 if(n.type==='video')content+=n.src&&p.assets[n.src]?`<video class="editor-video" controls preload="metadata" src="${url(n.src)}"></video><p class="small">${h(p.assets[n.src].name)} · ${(p.assets[n.src].blob.size/1048576).toFixed(1)} МБ</p><button data-editor-upload="video">Заменить видео</button>`:'<div class="placeholder"><h2>Добавьте видео этой сцены</h2><p>MP4 или WebM. После просмотра можно перейти к выбору или следующему видео.</p><button data-editor-upload="video" class="primary">Загрузить видео</button></div>';
 else if(n.background&&p.assets[n.background]){
  content+=['form','click','choice'].includes(n.type)?ScenaAreas.html(n,`<img src="${url(n.background)}" alt="Фон шага ${h(n.title)}">`):`<img class="static-slide" src="${url(n.background)}" alt="Слайд презентации">`;
 }else if(['form','click'].includes(n.type))content+='<div class="placeholder"><h2>Ваш экран программы</h2><p>Загрузите скриншот. Затем выделите поля ввода и кнопки мышью.</p><button data-editor-upload="image" class="primary">Загрузить скриншот</button></div>'+(n.type==='form'?`<div class="settings-card" style="margin-top:16px"><h3>Поля без скриншота</h3>${n.fields.map(f=>`<label>${h(f.label)}<input readonly placeholder="Будет доступно при прохождении"></label>`).join('')}</div>`:'');
 else if(n.type==='choice'){const source=p.steps.find(s=>s.id===n.video);if(source?.src&&p.assets[source.src]){content+=ScenaAreas.html(n,`<video src="${url(source.src)}" muted preload="metadata" class="canvas-video"></video>`);}else content+=`<div class="placeholder"><h2>${h(n.title)}</h2><p>Выберите исходное видео справа или загрузите скриншот.</p><button data-editor-upload="image">Загрузить скриншот</button></div>`;}
 else if(n.type==='return')content+=`<div class="placeholder"><h2>↩ Возврат к решению</h2><p>Цель: <strong>${h(title(n.next))}</strong></p><p>Вводное видео не повторяется. Ошибка учитывается после просмотра последствий.</p></div>`;
 else if(n.type==='intro')content+=`<div class="author-business-cover"><div class="author-business-brand">${p.theme?.logo?`<img src="${url(p.theme.logo)}" alt="Логотип">`:p.theme?.coverLogoHidden?'':`<img src="${M.brandLogo}" alt="Корпоративный университет Казахтелеком">`}</div><div class="author-business-center"><small>КОРПОРАТИВНОЕ ОБУЧЕНИЕ</small><h2>${h(p.title)}</h2><p>${h(n.body||'')}</p><span>Начать</span></div><footer>ПРОФЕССИОНАЛЬНОЕ РАЗВИТИЕ · Корпоративный университет</footer></div>`;
 else if(['end'].includes(n.type))content+=`<div class="author-completion" style="font-family:${h(p.theme?.font||'Arial')};border-top-color:${/^#[a-f0-9]{6}$/i.test(p.theme?.color||'')?p.theme.color:'#005ca9'}"><div class="author-completion-icon">${n.type==='intro'?'▶':'✓'}</div>${p.theme?.logo?`<img class="author-logo" src="${url(p.theme.logo)}" alt="Логотип">`:``}<small>${n.type==='intro'?'ДОБРО ПОЖАЛОВАТЬ':'ОБУЧЕНИЕ ЗАВЕРШЕНО'}</small><h2>${h(p.title)}</h2><p>${h(n.body||'Вы прошли все необходимые задания.')}</p><span class="author-finish-button">${n.type==='intro'?'Начать':'Завершить'}</span><p class="small">${n.type==='intro'?'Кнопка открывает первый материал курса.':'Кнопка сохраняет результат и завершает SCORM-сессию.'}</p></div>`;
 else content+=`<div class="settings-card"><h2>${h(n.title)}</h2><p style="white-space:pre-wrap">${h(n.body||'Добавьте текст справа.')}</p>${n.type==='end'?'<span class="tag">Завершает курс и передаёт результат в LMS</span>':''}</div>`;
 if(n.options)content+='<div class="quick-options">'+n.options.map((o,i)=>`<div class="quick-option"><strong>${i+1}. ${h(o.label)}</strong><small>${o.wrong?'Ошибка → повтор':h(title(o.next))}</small></div>`).join('')+'</div>';else if(n.type!=='end')content+=`<div class="quick-option" style="margin-top:16px"><strong>Далее</strong><small>${h(title(n.next))}</small></div>`;
 $('editor-content').innerHTML=content;if($('screen-wrap')){bindDrawing();ScenaAreas.bind();const video=$('screen-wrap').querySelector('video');if(video)video.onloadedmetadata=()=>{video.currentTime=Math.max(0,video.duration-.05);};}}
function setDrawing(tool){if(tool.kind==='new-field'&&(node()?.fields?.length||0)>=30){notice('На одном экране доступно до 30 полей.');return;}if(!node()?.background&&!node()?.video){notice('Сначала загрузите скриншот или выберите видео.');return;}document.body.classList.remove('inspector-open');setTab('editor');drawing=tool;renderEditor();$('screen-wrap')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
function bindDrawing(){const wrap=$('screen-wrap');let start=null,draft=null;
 wrap.onpointerdown=e=>{if(!drawing)return;e.preventDefault();const b=wrap.getBoundingClientRect();start={x:Math.max(0,Math.min(100,(e.clientX-b.left)/b.width*100)),y:Math.max(0,Math.min(100,(e.clientY-b.top)/b.height*100))};draft=document.createElement('div');draft.className='zone draft';wrap.append(draft);wrap.setPointerCapture(e.pointerId);};
 wrap.onpointermove=e=>{if(!start)return;const b=wrap.getBoundingClientRect(),x=Math.max(0,Math.min(100,(e.clientX-b.left)/b.width*100)),y=Math.max(0,Math.min(100,(e.clientY-b.top)/b.height*100));draft.dataset.rect=JSON.stringify({x:Math.min(start.x,x),y:Math.min(start.y,y),w:Math.abs(x-start.x),h:Math.abs(y-start.y)});const r=JSON.parse(draft.dataset.rect);Object.assign(draft.style,{left:r.x+'%',top:r.y+'%',width:r.w+'%',height:r.h+'%'});};
 wrap.onpointerup=()=>{if(!start)return;start=null;const r=JSON.parse(draft.dataset.rect||'null');draft.remove();draft=null;if(!r||r.w<1||r.h<1){notice('Область слишком маленькая. Обведите её ещё раз.');return;}const tool=drawing,n=node();if(tool.kind==='crop'){drawing=null;openCrop(n,r);return;}mutate(()=>{if(tool.kind==='new-visual'){
 const type=tool.visualType;
 const names={text:'Текст',rectangle:'Прямоугольник',ellipse:'Круг / овал',triangle:'Треугольник',arrow:'Стрелка',line:'Линия'};
 (n.decorations||=[]).push({id:M.uid('visual'),type,label:names[type],text:type==='text'?'Введите текст':'',rect:r,color:'#005ca9',fill:'#e7f1fb',noFill:type==='text'||type==='line',strokeWidth:2,autoFont:true,font:'Arial',fontSize:24});
}else if(tool.kind==='new-jump'){(n.jumps||=[]).push({id:M.uid('jump'),label:'Переход',next:'',rect:r});p.settings.flow='branching';}else if(tool.kind==='jump')n.jumps[tool.index].rect=r;else if(tool.kind==='new-field'){if(n.type==='click'){n.type='form';n.fields=[];n.button='Далее';if(n.error==='Нажмите на нужную область.')n.error='Проверьте заполнение полей.';if(n.rect)n.submitRect=n.rect;delete n.rect;}const f=M.field();f.rect=r;f.kind=tool.fieldKind||'text';if(f.kind==='checkbox'){f.label='Галочка';f.expectedChecked=true;}if(['select','radio'].includes(f.kind)){f.choices='Вариант 1\nВариант 2';f.expected='Вариант 1';f.label=f.kind==='select'?'Список':'Переключатели';}n.fields.push(f);}else if(tool.kind==='field')n.fields[tool.index].rect=r;else if(tool.kind==='submit')n.submitRect=r;else if(tool.kind==='click')n.rect=r;else if(tool.kind==='option')n.options[tool.index].rect=r;});drawing=null;if(tool.kind==='new-visual'){
 inspectorSections.set(n.id+':add',false);inspectorSections.set(n.id+':visual-properties',true);inspectorSections.set(n.id+':design',true);
}if(['new-jump','new-field'].includes(tool.kind))inspectorSections.set(n.id+':add',false);if(tool.kind==='new-jump'){inspectorSections.set(n.id+':field',false);inspectorSections.set(n.id+':jumps',true);inspectorSections.set(n.id+':jump-'+n.jumps.at(-1).id,true);}if(tool.kind==='new-field')inspectorSections.set(n.id+':field',true);render();if(tool.kind==='new-visual')ScenaAreas.pickVisual(n.decorations.at(-1).id);if(tool.kind==='new-field')ScenaAreas.pickField(n.fields.at(-1).id);notice(tool.kind==='new-visual'?'Объект добавлен. Текст и оформление можно изменить справа.':tool.kind==='new-jump'?'Область сохранена. Выберите целевой шаг справа.':'Область сохранена. Настройте проверку шага.');if((n.type==='form'||tool.kind==='new-jump')&&innerWidth<=1160)document.body.classList.add('inspector-open');};wrap.onpointercancel=()=>{start=null;draft?.remove();draft=null;};}
function loadCropImage(path){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(Error('Не удалось открыть скриншот.'));
  img.src=url(path);
 });
}
function openCrop(source,rect){
 const dialog=$('crop-dialog'),select=$('crop-background'),project=p,sourcePath=source.background;
 select.innerHTML='<option value="">Только вырезанный фрагмент</option>'+p.steps
  .filter(step=>step.id!==source.id&&step.background&&p.assets[step.background])
  .map(step=>'<option value="'+h(step.id)+'">'+h(step.title)+'</option>').join('');
 $('crop-status').textContent='';
 const save=$('crop-save');
 save.disabled=false;
 save.onclick=async()=>{
  save.disabled=true;
  try{
   const base=project.steps.find(step=>step.id===select.value);
   const image=await loadCropImage(sourcePath);
   const background=base?await loadCropImage(base.background):null;
   if(p!==project||!dialog.open)return;
   const {naturalWidth:w,naturalHeight:height}=image;
   const x=w*rect.x/100,y=height*rect.y/100,sw=w*rect.w/100,sh=height*rect.h/100;
   const canvas=document.createElement('canvas');
   canvas.width=background?background.naturalWidth:Math.max(1,Math.round(sw));
   canvas.height=background?background.naturalHeight:Math.max(1,Math.round(sh));
   const ctx=canvas.getContext('2d');
   if(background){
    ctx.drawImage(background,0,0);
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,x,y,sw,sh,canvas.width*rect.x/100,canvas.height*rect.y/100,canvas.width*rect.w/100,canvas.height*rect.h/100);
   }else ctx.drawImage(image,x,y,sw,sh,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(p!==project||!dialog.open)return;
   if(!blob)throw Error('Не удалось сохранить фрагмент.');
   const file=new File([blob],(base?'Всплывающее окно':'Обрезанный скриншот')+'.png',{type:'image/png'});
   validateFiles([file]);
   uploadTarget={mode:'screens',id:(base||source).id,group:(base||source).group,popupBase:base?.id};
   dialog.close();
   await upload([file]);
  }catch(error){$('crop-status').textContent=error.message;}
  finally{save.disabled=false;}
 };
 dialog.showModal();
}
function renderSettings(){ ScenaCourseUI.render();$('course-flow').value=p.settings.flow||'branching';$('start-step').innerHTML=linkOptions(p.start);$('course-mode').value=p.settings.mode;$('course-penalty').value=p.settings.penalty;}
function renderMedia(){const used=new Set([...p.steps.flatMap(n=>[n.src,n.background]),p.theme?.logo].filter(Boolean));$('media-grid').innerHTML=Object.entries(p.assets).map(([path,a])=>`<div class="media-card">${a.blob.type.startsWith('video/')?`<video controls preload="metadata" src="${url(path)}"></video>`:`<img src="${url(path)}" alt="${h(a.name)}">`}<strong>${h(a.name)}</strong><small>${(a.blob.size/1048576).toFixed(2)} МБ · ${used.has(path)?'используется':'не используется'}</small><div><button data-use-asset="${h(path)}">Назначить шагу</button>${!used.has(path)?`<button data-delete-asset="${h(path)}">Удалить</button>`:''}</div></div>`).join('')||'<div class="placeholder">Пока нет файлов. Загрузите видео или скриншоты.</div>';}
function render(){if(document.activeElement!==$('course-title'))$('course-title').value=p.title;renderList();renderInspector();if(tab==='editor')renderEditor();if(tab==='map')ScenaMap.render();if(tab==='media')renderMedia();renderSettings();$('course-progress').textContent=M.count(p.groups.length,'раздел','раздела','разделов')+' · '+M.count(p.steps.length,'шаг','шага','шагов');$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;}
function setTab(value){tab=value;drawing=null;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===value));document.querySelectorAll('main>.view').forEach(v=>v.classList.toggle('hidden',v.id!=='view-'+value));render();}
function attach(kind){uploadTarget={id:selected,kind,mode:'replace'};$('asset-input').multiple=false;$('asset-input').accept=kind==='video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp';$('asset-input').value='';$('asset-input').click();}
function insertionAnchor(){if(addAnchor&&p.steps.some(n=>n.id===addAnchor&&n.group===selectedGroup))return addAnchor;const group=p.steps.filter(n=>n.group===selectedGroup);return [...group].reverse().find(n=>n.type!=='end')?.id||group.find(n=>n.type==='end')?.id||null;}
function openAdd(after=null){addAnchor=after;$('add-dialog').showModal();}
function chooseMaterials(mode){uploadTarget={mode,id:insertionAnchor(),group:selectedGroup};$('asset-input').multiple=true;$('asset-input').accept=mode==='videos'?'video/mp4,video/webm':mode==='screens'?'image/png,image/jpeg,image/webp':'video/mp4,video/webm,image/png,image/jpeg,image/webp';$('asset-input').value='';$('asset-input').click();}
function validateFiles(files){let total=0;for(const f of files){if(!/^(video\/(mp4|webm)|image\/(png|jpeg|webp))$/.test(f.type))throw Error('Выберите MP4, WebM, PNG, JPEG или WebP.');if(!f.size)throw Error('Один из файлов пустой.');total+=f.size;}ScenaStorage.checkSize(p,total);if(p.steps.length+files.length>500)throw Error('В курсе может быть не более 500 шагов.');}
function batchList(){ $('batch-title').textContent='Материалы для раздела «'+(p.groups.find(g=>g.id===uploadTarget?.group)?.title||'Курс')+'»';$('confirm-batch').textContent='Добавить шаги ('+pendingBatch.length+')';$('confirm-batch').disabled=!pendingBatch.length;$('batch-list').innerHTML=pendingBatch.map((f,i)=>{if(!batchURLs.has(f))batchURLs.set(f,URL.createObjectURL(f));return `<div class="batch-item"><span>${i+1}</span>${f.type.startsWith('image/')?`<img src="${batchURLs.get(f)}" alt="">`:'<span class="batch-video">▷</span>'}<strong>${h(f.name)}</strong><button data-batch-up="${i}" aria-label="Поднять файл ${h(f.name)}" ${i===0?'disabled':''}>↑</button><button data-batch-down="${i}" aria-label="Опустить файл ${h(f.name)}" ${i===pendingBatch.length-1?'disabled':''}>↓</button><button data-batch-remove="${i}" aria-label="Убрать файл ${h(f.name)}">×</button></div>`;}).join('');}
function clearBatch(){pendingBatch=[];for(const u of batchURLs.values())URL.revokeObjectURL(u);batchURLs.clear();}
async function upload(files){if(!files.length)return;try{validateFiles(files);if(['screens','videos','materials'].includes(uploadTarget?.mode)){pendingBatch=files.slice();batchList();$('batch-dialog').showModal();return;}const target=uploadTarget;mutate(()=>{for(const f of files){const path='media/'+M.uid('asset')+'.'+f.type.split('/')[1].replace('jpeg','jpg');p.assets[path]={blob:f,name:f.name};const n=p.steps.find(n=>n.id===target?.id);if(n&&target?.mode==='replace'){if(f.type.startsWith('video/'))n.src=path;else{n.background=path;if(n.type==='choice')n.video='';}}}});uploadTarget=null;render();notice(target?.mode==='replace'?'Файл заменён только на этом шаге.':'Файлы добавлены в медиатеку. Чтобы сделать из них шаги, нажмите «Добавить материал».');}catch(e){notice(e.message);}}
function addBatch(){try{validateFiles(pendingBatch);const anchor=uploadTarget?.id,group=uploadTarget?.group||selectedGroup;const nodes=pendingBatch.map(f=>{const isVideo=f.type.startsWith('video/'),n=M.node(isVideo?'video':'click',group),path='media/'+M.uid('asset')+'.'+f.type.split('/')[1].replace('jpeg','jpg');n.title=f.name.replace(/\.[^.]+$/,'');if(isVideo)n.src=path;else{n.background=path;delete n.rect;}return {node:n,path,file:f};});mutate(()=>{nodes.forEach(x=>p.assets[x.path]={name:x.file.name,blob:x.file});const popupBase=p.steps.find(step=>step.id===uploadTarget?.popupBase);
 const originalNext=popupBase?.next;
 if(popupBase)p.settings.flow='branching';
 M.insert(p,nodes.map(x=>x.node),anchor,group);
 if(popupBase){popupBase.next=originalNext;nodes[0].node.next=popupBase.id;}
 if(p.settings.flow==='sequence')ScenaMap.arrange();});selected=nodes[0]?.node.id;selectedGroup=group;$('batch-dialog').close();clearBatch();uploadTarget=null;setTab('editor');notice(nodes.length+' отдельных шагов добавлено. Предыдущие скриншоты сохранены.');}catch(e){notice(e.message);}}

function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function issuesHTML(report){return (report.problems.length?report.problems.map(e=>`<button class="issue" data-issue-node="${h(e.id||'')}">${h(e.text)}</button>`).join(''):'<div class="issue ok">Курс готов к сборке.</div>')+(report.warnings.length?'<p class="small">Предупреждения ниже не мешают выгрузке. Нажмите на сообщение, чтобы открыть шаг.</p>':'')+report.warnings.map(e=>`<button class="issue warning" data-issue-node="${h(e.id)}">${h(e.text)}</button>`).join('');}
function check(){const report=M.inspect(p);if(!report.problems.length){try{ScenaSCORM.validate(M.toCourse(p));}catch(e){report.problems.push({text:e.message});}}return report;}
function preview(fromCurrent=false){try{const course=fromCurrent?M.previewCourse(p,selected):M.toCourse(p);if(!fromCurrent){const report=check();if(report.problems.length){setTab('settings');$('validation-results').innerHTML=issuesHTML(report);notice('Исправьте ошибки курса перед полным просмотром. Отдельный шаг можно проверить кнопкой «Посмотреть этот шаг».');return;}}previewToken=M.uid('preview');course.previewToken=previewToken;const resources=Object.fromEntries(Object.keys(p.assets).map(path=>[path,url(path)]));$('preview-frame').srcdoc=ScenaSCORM.preview(course,resources);document.querySelector('#preview-dialog .dialog-bar strong').textContent=fromCurrent?(course.previewDependencies?'Проверка шага · сначала заполните исходное поле':'Проверка выбранного шага'):'Предпросмотр курса';$('preview-dialog').showModal();}catch(error){notice('Проверьте настройки этого шага: '+error.message);}}
async function build(){const button=$('build-scorm');button.disabled=true;$('export-status').textContent='Собирается ZIP…';await new Promise(r=>setTimeout(r,30));try{const report=check();if(report.problems.length)throw Error('Курс содержит ошибки.');const referenced=new Set([...p.steps.flatMap(n=>[n.src,n.background]),p.theme?.logo].filter(Boolean));const assets=Object.fromEntries([...referenced].map(path=>[path,p.assets[path].blob]));const blob=await ScenaSCORM.build(M.toCourse(p),assets);download(blob,p.id+'-scorm12.zip');$('export-status').textContent='Готово: '+(blob.size/1048576).toFixed(2)+' МБ. Загрузите ZIP в тестовый курс Mirapolis.';}catch(e){$('export-status').textContent='Не удалось собрать пакет: '+e.message;}finally{button.disabled=false;}}
function addNode(type){if(type==='end'&&p.settings.flow==='sequence'&&p.steps.some(n=>n.type==='end')){select(p.steps.find(n=>n.type==='end').id);notice('Итоговый экран уже есть в конце курса.');return;}const n=M.node(type,selectedGroup);mutate(()=>{if(['choice','return'].includes(type))p.settings.flow='branching';M.insert(p,[n],insertionAnchor(),selectedGroup);if(p.settings.flow==='sequence')ScenaMap.arrange();});selected=n.id;render();if(tab==='map')ScenaMap.focus(n.id);}

function addTemplate(kind){if(kind==='guide'){const n=M.guideNode(selectedGroup);mutate(()=>M.insert(p,[n],insertionAnchor(),selectedGroup));select(n.id);return;}if(kind==='intro'){if(p.steps.some(n=>n.type==='intro')){select(p.steps.find(n=>n.type==='intro').id);return;}mutate(()=>M.addIntro(p));select(p.start);return;}const n=M.node('message',selectedGroup);n.template=kind;n.title={instruction:'Инструкция',cards:'Карточки',dialog:'Диалог'}[kind]||'Материал';n.body={instruction:'Шаг 1. Подготовьте необходимые данные.\nШаг 2. Выполните действие.\nШаг 3. Проверьте результат.',cards:'Первый ключевой пункт\nВторой ключевой пункт\nТретий ключевой пункт',dialog:'Клиент: Добрый день! Мне нужна помощь.\nСотрудник: Здравствуйте! Уточните, пожалуйста, детали.'}[kind];mutate(()=>M.insert(p,[n],insertionAnchor(),selectedGroup));selected=n.id;render();}
function setPath(object,path,value){const parts=path.split('.');let ref=object;for(const part of parts.slice(0,-1)){if(!Object.hasOwn(ref,part))throw Error('Поле не найдено.');ref=ref[part];}ref[parts.at(-1)]=value;}
let textEdit=null;
$('inspector-content').addEventListener('input',e=>{const path=e.target.dataset.path;if(!path||!(e.target.tagName==='TEXTAREA'||e.target.type==='text'))return;const n=node();if(!n)return;const key=n.id+':'+path;if(textEdit!==key){checkpoint();textEdit=key;}setPath(n,path,e.target.value);
 if(path.startsWith('decorations.')){
  const wrap=$('screen-wrap');
  if(wrap){wrap.querySelectorAll('.screen-visual').forEach(el=>el.remove());wrap.insertAdjacentHTML('beforeend',(n.decorations||[]).map(v=>ScenaVisuals.markup(v)).join(''));}
 }
 changed();renderList();$('selected-title').textContent=n.title;const instruction=$('editor-content').querySelector('.step-instruction span');if(path==='instruction'&&instruction)instruction.textContent=n.instruction;if(path==='taskTitle'){const heading=$('editor-content').querySelector('.step-instruction h3');if(heading)heading.textContent=n.taskTitle||'Работа в программе';}if(/^fields\.\d+\.label$/.test(path)){const f=n.fields[Number(path.split('.')[1])],zone=Array.from(document.querySelectorAll('[data-area-key]')).find(e=>e.dataset.areaKey==='f:'+f.id);if(zone){zone.querySelector('span').textContent=f.label;zone.setAttribute('aria-label','Область: '+f.label);}const chip=Array.from(document.querySelectorAll('[data-select-field]')).find(e=>e.dataset.selectField===f.id);if(chip)chip.textContent=f.label+' · '+({text:'Текст',select:'Список',checkbox:'Галочка',radio:'Переключатели'}[f.kind||'text']);}});
$('inspector-content').addEventListener('focusout',()=>{textEdit=null;});
$('inspector-content').addEventListener('change',e=>{if(e.target.hasAttribute('data-field-match')||e.target.hasAttribute('data-field-autofill')){const autofill=e.target.hasAttribute('data-field-autofill');const f=node()?.fields[Number(e.target.dataset.fieldMatch??e.target.dataset.fieldAutofill)];if(f){const [stepId,fieldId]=e.target.value.split('/');mutate(()=>f[autofill?'autofill':'match']=stepId&&fieldId?{stepId,fieldId}:null);render();}return;}if(e.target.hasAttribute('data-inspector-visual')){ScenaAreas.pickVisual(e.target.value);return;}if(e.target.hasAttribute('data-inspector-field')){ScenaAreas.pickField(e.target.value);return;}const path=e.target.dataset.path;if(!path)return;const n=node();if(!n)return;if(e.target.tagName==='TEXTAREA'||e.target.type==='text')return;let value=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Number(e.target.value):e.target.value;if(e.target.type==='number'&&!Number.isFinite(value))return;
 mutate(()=>{setPath(n,path,value);
 if(/^decorations\.\d+\.(fontSize|strokeWidth|rotation)$/.test(path)){
  const object=n.decorations[Number(path.split('.')[1])],key=path.split('.')[2];
  const limits={fontSize:[8,120],strokeWidth:[0,12],rotation:[-360,360]}[key];
  object[key]=Math.max(limits[0],Math.min(limits[1],value));
 }
 if(path==='next'||/^options\.\d+\.next$/.test(path))p.settings.flow='branching';if(path==='group'){selectedGroup=value;M.sequence(p);}if(/(?:rect|submitRect)\./.test(path)){const base=path.split('.').slice(0,-1);let r=n;for(const key of base)r=r[key];r.x=Math.max(0,Math.min(99,r.x));r.y=Math.max(0,Math.min(99,r.y));r.w=Math.max(1,Math.min(100-r.x,r.w));r.h=Math.max(1,Math.min(100-r.y,r.h));}if(/^fields\.\d+\.kind$/.test(path)){const f=n.fields[Number(path.split('.')[1])];if(value!=='text'){f.rule='exact';delete f.match;delete f.inputType;if(['select','radio'].includes(value)&&!f.choices){f.choices='Вариант 1\nВариант 2';f.expected='Вариант 1';}}}if(path==='background'&&value)n.video='';if(path==='video'&&value){n.background='';n.selectBeforeContinue=false;}});render();});
$('inspector-content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!node())return;const d=b.dataset,n=node();
 if(d.addVisual){
  if((n.decorations?.length||0)>=50){notice('Доступно до 50 фигур и текстовых блоков.');return;}
  setDrawing({kind:'new-visual',visualType:d.addVisual});return;
 }
 if('rotateObject'in d||'resetRotation'in d){
  const visual=ScenaAreas.currentVisual(n);if(!visual)return;
  mutate(()=>visual.rotation='resetRotation'in d?0:((Number(visual.rotation)||0)+Number(d.rotateObject)+360)%360);
  render();return;
 }
 if('deleteVisual'in d){mutate(()=>n.decorations.splice(Number(d.deleteVisual),1));render();return;}
 if(d.inspectorTool){
  const tool=d.inspectorTool;
  if(tool==='jump'){
   if((n.jumps?.length||0)>=30){notice('Доступно до 30 переходов.');return;}
   setDrawing({kind:'new-jump'});
  }else if(tool==='submit')setDrawing({kind:n.type==='click'?'click':'submit'});
  else if(!n.background){
   if((n.fields?.length||0)>=30){notice('Доступно до 30 полей.');return;}
   const field=M.field();field.kind=tool;
   field.label={text:'Поле ввода',select:'Список',checkbox:'Галочка',radio:'Переключатели'}[tool];
   if(tool==='checkbox')field.expectedChecked=true;
   if(['select','radio'].includes(tool)){field.choices='Вариант 1\nВариант 2';field.expected='Вариант 1';}
   mutate(()=>{if(n.type==='click'){n.type='form';n.fields=[];n.button='Далее';if(n.rect)n.submitRect=n.rect;delete n.rect;}n.fields.push(field);});
   render();ScenaAreas.pickField(field.id);
  }else setDrawing({kind:'new-field',fieldKind:tool});
  return;
 }
if('cropScreen'in d){setDrawing({kind:'crop'});return;}
 if('redrawJump'in d){setDrawing({kind:'jump',index:Number(d.redrawJump)});return;}
 if('removeJump'in d){mutate(()=>n.jumps.splice(Number(d.removeJump),1));render();return;}
 if(d.upload){attach(d.upload);return;}if('setStart'in d){mutate(()=>p.start=n.id);render();return;}if('delete'in d){removeStep(n.id);return;}if('duplicate'in d){duplicateStep(n.id);return;}if('addOption'in d){mutate(()=>n.options.push({id:M.uid('opt'),label:'Новый вариант',next:''}));render();}if('removeOption'in d){mutate(()=>n.options.splice(Number(d.removeOption),1));render();}if('addField'in d){mutate(()=>n.fields.push(M.field()));render();}if('removeField'in d){mutate(()=>n.fields.splice(Number(d.removeField),1));render();}if('drawClick'in d)setDrawing({kind:'click'});if('drawField'in d)setDrawing({kind:'field',index:Number(d.drawField)});if('drawSubmit'in d)setDrawing({kind:'submit'});if('clearSubmit'in d){mutate(()=>delete n.submitRect);render();}if('drawOption'in d)setDrawing({kind:'option',index:Number(d.drawOption)});});
$('editor-content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.editorUpload){attach(d.editorUpload);return;}if('cancelTool'in d){drawing=null;renderEditor();return;}if('zoneField'in d){$('field-block-'+d.zoneField)?.scrollIntoView({block:'nearest'});return;}if('drawOption'in d){setDrawing({kind:'option',index:Number(d.drawOption)});return;}if(d.tool){if(d.tool==='new-field')setDrawing({kind:'new-field'});else if(d.tool==='option')setDrawing({kind:'option',index:0});else setDrawing({kind:d.tool});}});
$('add-group').onclick=()=>{const g={id:M.uid('section'),title:'Раздел '+(p.groups.length+1)};mutate(()=>{p.groups.push(g);M.sequence(p);});selectedGroup=g.id;render();notice('Раздел добавлен. Нажмите «Добавить сюда» под его названием.');};
$('add-material').onclick=()=>openAdd();$('add-dialog').onclick=e=>{const b=e.target.closest('[data-add-material]');if(!b)return;$('add-dialog').close();if(b.dataset.addMaterial==='capture'){
 const target={mode:'screens',id:insertionAnchor(),group:selectedGroup};
 ScenaCapture.open(files=>{validateFiles(files);uploadTarget=target;return upload(files);});
}else if(['screens','videos'].includes(b.dataset.addMaterial))chooseMaterials(b.dataset.addMaterial);else if(b.dataset.addMaterial.startsWith('template-'))addTemplate(b.dataset.addMaterial.slice(9));else addNode(b.dataset.addMaterial);};
let titleEditing=false;$('course-title').oninput=()=>{if(!titleEditing){checkpoint();titleEditing=true;}p.title=$('course-title').value;const heading=$('editor-content').querySelector('.author-completion h2');if(heading)heading.textContent=p.title;changed();};$('course-title').onblur=()=>{titleEditing=false;if(!p.title.trim()){p.title='Без названия';$('course-title').value=p.title;changed();}};document.querySelector('.tabs').onclick=e=>{if(e.target.dataset.tab)setTab(e.target.dataset.tab);};
$('asset-input').onchange=()=>upload([...$('asset-input').files]);$('library-upload').onclick=()=>{uploadTarget={mode:'library'};$('asset-input').multiple=true;$('asset-input').accept='video/mp4,video/webm,image/png,image/jpeg,image/webp';$('asset-input').value='';$('asset-input').click();};
$('batch-list').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if('batchRemove'in d)pendingBatch.splice(Number(d.batchRemove),1);else{const i=Number(d.batchUp??d.batchDown),j=i+('batchUp'in d?-1:1);if(j>=0&&j<pendingBatch.length)[pendingBatch[i],pendingBatch[j]]=[pendingBatch[j],pendingBatch[i]];}batchList();};$('sort-batch').onclick=()=>{pendingBatch.sort((a,b)=>a.name.localeCompare(b.name,'ru',{numeric:true}));batchList();};$('confirm-batch').onclick=addBatch;$('cancel-batch').onclick=()=>$('batch-dialog').close();$('batch-dialog').addEventListener('close',()=>clearBatch());
$('configure-flow').onclick=()=>setTab('settings');$('course-flow').onchange=async()=>{const next=$('course-flow').value;if(next==='sequence'&&p.steps.filter(n=>n.type==='end').length>1){notice('Для прохождения по порядку оставьте один итоговый экран.');renderSettings();return;}if(next==='sequence'&&p.steps.some(n=>n.type==='return')){notice('Удалите шаги возврата перед переходом к прохождению по порядку.');renderSettings();return;}if(next==='sequence'&&p.settings.flow!=='sequence'&&!await confirmAction('Изменить порядок прохождения?','Все правильные ответы и шаги будут вести дальше по списку слева. Настроенные ветки заменятся последовательностью. Действие можно отменить.','Идти по порядку')){renderSettings();return;}mutate(()=>{p.settings.flow=next;M.sequence(p);if(next==='sequence')ScenaMap.arrange();});render();};
$('media-grid').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.useAsset){const n=node();if(!n){notice('Сначала добавьте шаг.');return;}const path=b.dataset.useAsset,a=p.assets[path];if(a.blob.type.startsWith('video/')&&n.type!=='video'){notice('Выберите шаг типа «Видео» в левой панели.');return;}if(a.blob.type.startsWith('image/')&&!['form','click','choice','message'].includes(n.type)){notice('Выберите шаг тренажёра или выбора.');return;}mutate(()=>{n[a.blob.type.startsWith('video/')?'src':'background']=path;if(a.blob.type.startsWith('image/')&&n.type==='choice')n.video='';});setTab('editor');}if(b.dataset.deleteAsset){mutate(()=>delete p.assets[b.dataset.deleteAsset]);renderMedia();}};
$('start-step').onchange=()=>{mutate(()=>p.start=$('start-step').value);render();};$('course-mode').onchange=()=>mutate(()=>p.settings.mode=$('course-mode').value);$('course-penalty').onchange=()=>{mutate(()=>p.settings.penalty=Math.max(0,Math.min(100,Number($('course-penalty').value)||0)));renderSettings();};$('validate-course').onclick=()=>{$('validation-results').innerHTML=issuesHTML(check());};
$('preview-course').onclick=()=>preview();$('preview-node').onclick=()=>preview(true);$('close-preview').onclick=()=>{$('preview-dialog').close();$('preview-frame').srcdoc='';};$('preview-dialog').addEventListener('close',()=>{$('preview-frame').srcdoc='';previewToken=null;});window.addEventListener('message',e=>{if(e.source===$('preview-frame').contentWindow&&e.data?.type==='scena-preview-finished'&&previewToken&&e.data.token===previewToken)$('preview-dialog').close();});
$('export-course').onclick=()=>{const report=check();$('export-results').innerHTML=issuesHTML(report);$('build-scorm').disabled=!!report.problems.length;$('export-status').textContent='';$('export-dialog').showModal();};$('close-export').onclick=()=>$('export-dialog').close();$('build-scorm').onclick=build;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-issue-node]');if(b?.dataset.issueNode){$('export-dialog').close();selected=b.dataset.issueNode;setTab('editor');}});
$('download-project').onclick=async()=>{const b=$('download-project');b.disabled=true;try{notice('Подготавливается проект с медиа…');download(await ScenaStorage.file(p),p.id+'.scena.json');notice('Проект скачан вместе с медиа.');}catch(e){notice(e.message);}finally{b.disabled=false;}};
$('undo').onclick=()=>restoreHistory(true);$('redo').onclick=()=>restoreHistory(false);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();restoreHistory(!e.shiftKey);}});window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});

async function flush(){clearTimeout(saveTimer);await saveChain.catch(()=>{});if(!hasProject||!unsaved)return;const rev=revision;try{const time=await ScenaStorage.save(p);if(rev===revision){p.updatedAt=time;unsaved=false;$('save-status').textContent='Сохранено в браузере';}}catch(error){$('save-status').textContent='Не сохранено · скачайте проект';throw error;}}
function home(value){if(value)document.body.classList.remove('inspector-open');$('projects-home').classList.toggle('hidden',!value);$('workspace').classList.toggle('hidden',value);document.body.classList.toggle('projects-mode',value);['download-project','preview-course','export-course'].forEach(id=>$(id).disabled=!hasProject);}
async function activate(next,options={}){await flush();next=M.cleanImport(next);await ScenaStorage.save(next);clearURLs();p=next;hasProject=true;selected=p.start||p.steps[0]?.id;selectedGroup=node()?.group||p.groups[0].id;undo=[];redo=[];revision++;unsaved=false;ScenaMap.reset();if(options.arrange){ScenaMap.arrange();await ScenaStorage.save(p);}$('save-status').textContent='Сохранено в браузере';home(false);setTab('editor');}
function confirmAction(title,message,action='Продолжить'){if(confirmResolver)confirmResolver(false);$('confirm-title').textContent=title;$('confirm-message').textContent=message;$('confirm-yes').textContent=action;$('confirm-dialog').showModal();return new Promise(resolve=>confirmResolver=resolve);}
function resolveConfirm(value){const resolve=confirmResolver;confirmResolver=null;$('confirm-dialog').close();if(resolve)resolve(value);}
$('confirm-no').onclick=()=>resolveConfirm(false);$('confirm-yes').onclick=()=>resolveConfirm(true);$('confirm-dialog').addEventListener('cancel',()=>resolveConfirm(false));
$('show-inspector').onclick=()=>document.body.classList.add('inspector-open');$('hide-inspector').onclick=()=>document.body.classList.remove('inspector-open');
function afterRemove(){if(!p.steps.some(n=>n.id===selected))selected=p.steps[0]?.id;if(!p.groups.some(g=>g.id===selectedGroup))selectedGroup=p.groups[0].id;}
async function removeStep(id){const n=p.steps.find(n=>n.id===id);if(!n)return;if(!await confirmAction('Удалить шаг?',`Шаг «${n.title}» будет удалён. ${p.settings.flow==='sequence'||n.template==='guide'?'Следующий шаг займёт его место.':'Связи с этим шагом потребуется проверить.'} Действие можно отменить.`,'Удалить шаг'))return;mutate(()=>M.remove(p,id));afterRemove();render();notice('Шаг удалён. Нажмите «Отменить», чтобы вернуть его.');}
function duplicateStep(id){const n=p.steps.find(n=>n.id===id);if(!n)return;const copy=structuredClone(n);copy.id=M.uid('step');copy.title+=' — копия';copy.options?.forEach(o=>o.id=M.uid('opt'));copy.jumps?.forEach(j=>j.id=M.uid('jump'));copy.decorations?.forEach(v=>v.id=M.uid('visual'));const fieldIds=new Map((copy.fields||[]).map(f=>[f.id,M.uid('field')]));copy.fields?.forEach(f=>{f.id=fieldIds.get(f.id);if(f.match?.stepId===n.id)f.match={stepId:copy.id,fieldId:fieldIds.get(f.match.fieldId)||f.match.fieldId};});mutate(()=>M.insert(p,[copy],id,n.group));selected=copy.id;selectedGroup=copy.group;render();}
let renamingStep=null;
function renameStep(id){const n=p.steps.find(s=>s.id===id);if(!n)return;renamingStep=id;$('step-rename-title').value=n.title;$('step-rename-dialog').showModal();$('step-rename-title').focus();$('step-rename-title').select();}
$('step-rename-cancel').onclick=()=>$('step-rename-dialog').close();$('step-rename-form').onsubmit=e=>{e.preventDefault();const value=$('step-rename-title').value.trim(),n=p.steps.find(s=>s.id===renamingStep);if(!value||!n)return;mutate(()=>n.title=value);$('step-rename-dialog').close();render();};
ScenaAreas.init({tools:openElementTools,node,project:()=>p,editor:renderEditor,inspector:renderInspector,render,notice,mutate,checkpoint,changed,draw:setDrawing,drawing:()=>drawing,cancel:()=>{drawing=null;}});
ScenaCourseUI.init({project:()=>p,url,mutate,changed,render,notice,activate,flush,download,preview,export:()=>{$('export-course').click();}});
ScenaMap.init({project:()=>p,selected:()=>selected,url,mutate,checkpoint,changed,select,notice,render});
ScenaOutline.init({project:()=>p,selected:()=>selected,group:()=>selectedGroup,setGroup:id=>{selectedGroup=id;},url,select,mutate,checkpoint,changed,notice,render,add:after=>openAdd(after),confirm:confirmAction,remove:removeStep,rename:renameStep,duplicate:duplicateStep,afterRemove,arrange:()=>ScenaMap.arrange()});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')&&!$('workspace').classList.contains('hidden'))e.preventDefault();});document.addEventListener('drop',e=>{if(e.dataTransfer?.files.length&&!$('workspace').classList.contains('hidden')){e.preventDefault();uploadTarget={mode:'materials',id:selected,group:selectedGroup};upload([...e.dataTransfer.files]);}});
(async()=>{try{const saved=await ScenaStorage.load();if(saved){p=M.cleanImport(saved);selected=p.start;selectedGroup=node()?.group||p.groups[0].id;hasProject=true;}$('save-status').textContent=hasProject?'Сохранено в браузере':'';}catch{$('save-status').textContent='Хранение проектов недоступно';}render();await ScenaProjects.init({active:()=>hasProject?p.id:null,flush,activate,notice,home,preview,confirm:confirmAction,deactivate:()=>{hasProject=false;unsaved=false;home(true);},rename:title=>{mutate(()=>p.title=title||'Без названия');render();}});})();
})();
