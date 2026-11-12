/* Author-only canvas. Percent coordinates survive zoom, preview and export. */
(function(root){'use strict';let app,selected=new Set(),clipboard=[],zoom=1,owner='';const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function entries(n){const a=[];if(n.type==='form')n.fields.forEach((f,i)=>{if(f.rect)a.push({key:'f:'+f.id,rect:f.rect,label:f.label,field:f,index:i});});if(n.type==='click'&&n.rect)a.push({key:'click',rect:n.rect,label:n.label||'Кнопка'});if(n.submitRect)a.push({key:'submit',rect:n.submitRect,label:'Далее'});n.options?.forEach((o,i)=>{if(o.rect)a.push({key:'o:'+o.id,rect:o.rect,label:o.label,option:o,index:i});});n.jumps?.forEach(j=>{if(j.rect)a.push({key:'j:'+j.id,rect:j.rect,label:j.label,jump:j});});n.decorations?.forEach((v,i)=>a.push({key:'v:'+v.id,rect:v.rect,label:v.label||'Объект',visual:v,index:i}));return a;}
function sync(n){if(owner!==n.id){owner=n.id;selected.clear();}const valid=new Set(entries(n).map(e=>e.key));selected=new Set([...selected].filter(k=>valid.has(k)));}
function html(n,media){sync(n);return `<div class="canvas-tools canvas-type-${n.type}"><button data-area-tools>Добавить элемент</button><button data-area-submit>${n.type==='choice'?'Кнопка ответа':'Проверка и продолжение'}</button><button data-area-copy ${selected.size?'':'disabled'}>Копировать</button><button data-area-paste ${clipboard.length?'':'disabled'}>Вставить</button><button data-area-delete ${selected.size?'':'disabled'}>Удалить</button><label>Масштаб<select id="canvas-zoom">${[.5,.75,1,1.25,1.5,2].map(z=>`<option value="${z}" ${zoom===z?'selected':''}>${z*100}%</option>`).join('')}</select></label><button data-area-cancel>Отменить выделение</button></div><p class="small canvas-help">${app.drawing()?'Обведите новую область мышью. Escape — отменить. ':'Выделите область. '}Shift — несколько; Ctrl/Cmd+C, V — копирование; стрелки — перемещение; Delete — удаление. Потяните края для изменения размера.</p><div class="canvas-viewport" tabindex="0" aria-label="Рабочая область скриншота"><div id="screen-wrap" class="screen-wrap canvas-surface ${app.drawing()?'drawing':''}" style="width:${zoom*100}%">${media}${(n.decorations||[]).map(v=>root.ScenaVisuals.markup(v)).join('')}${entries(n).map(e=>`<button type="button" class="zone ${e.visual?'visual-zone':''} ${selected.has(e.key)?'area-selected':''}" data-area-key="${h(e.key)}" style="left:${e.rect.x}%;top:${e.rect.y}%;width:${e.rect.w}%;height:${e.rect.h}%;${e.visual?'transform:rotate('+(Number(e.visual.rotation)||0)+'deg);transform-origin:center center;':''}" aria-label="Область: ${h(e.label)}"><span>${h(e.label)}</span>${selected.has(e.key)&&selected.size===1&&e.visual?'<i data-rotate class="rotate-handle" title="Повернуть объект · Shift — шаг 15°" aria-hidden="true">↻</i>':''}${selected.has(e.key)&&selected.size===1?['nw','n','ne','e','se','s','sw','w'].map(d=>`<i data-resize="${d}" class="resize-handle handle-${d}"></i>`).join(''):''}</button>`).join('')}</div></div><div class="canvas-elements">${n.fields?.map(f=>`<button data-select-field="${h(f.id)}" class="${selected.has('f:'+f.id)?'active':''}">${h(f.label)} · ${{text:'Текст',select:'Список',checkbox:'Галочка',radio:'Переключатели'}[f.kind||'text']}</button>`).join('')||''}</div>`;}
function currentField(n){sync(n);if(Array.from(selected).some(key=>!key.startsWith('f:')))return;return n.fields?.find(f=>selected.has('f:'+f.id))||n.fields?.[0];}
function currentEntry(n){sync(n);return entries(n).find(item=>selected.has(item.key));}
function pickEntry(key){sync(app.node());selected=new Set([key]);app.editor();app.inspector();}
function currentVisual(n){sync(n);return n.decorations?.find(v=>selected.has('v:'+v.id));}
function pickVisual(id){sync(app.node());selected=new Set(['v:'+id]);app.editor();app.inspector();}
function pickField(id,add=false){sync(app.node());if(add){selected.has('f:'+id)?selected.delete('f:'+id):selected.add('f:'+id);}else selected=new Set(['f:'+id]);app.editor();app.inspector();}
function copy(){const n=app.node();clipboard=entries(n).filter(e=>selected.has(e.key)).map(e=>e.visual?{type:'visual',value:structuredClone(e.visual)}:e.field?{type:'field',value:structuredClone(e.field)}:e.jump?{type:'jump',value:structuredClone(e.jump)}:e.option?{type:'option',value:structuredClone(e.option)}:{type:e.key,value:{rect:structuredClone(e.rect),label:e.label}});app.notice('Скопировано областей: '+clipboard.length);}
function paste(){if(!clipboard.length)return;const n=app.node();if((n.options?.length||0)+clipboard.filter(x=>x.type==='option').length>30){app.notice('Доступно до 30 вариантов.');return;}const visuals=clipboard.filter(x=>x.type==='visual');if(visuals.length&&(!n.background||(n.decorations?.length||0)+visuals.length>50)){app.notice('На скриншоте доступно до 50 фигур и текстовых блоков.');return;}const jumps=clipboard.filter(x=>x.type==='jump');if(jumps.length&&(!n.background||!['form','click'].includes(n.type)||(n.jumps?.length||0)+jumps.length>30)){app.notice('Переходы можно вставить на экран тренажёра. Максимум 30.');return;}const fields=clipboard.filter(x=>x.type==='field');if((n.fields?.length||0)+fields.length>30){app.notice('На одном экране доступно до 30 полей.');return;}if(fields.length&&!['form','click'].includes(n.type)){app.notice('Поля можно вставить на экран тренажёра.');return;}app.mutate(()=>{if(fields.length&&n.type==='click'){n.type='form';n.fields=[];if(n.rect)n.submitRect=structuredClone(n.rect);delete n.rect;n.button='Далее';}const ids=new Map(fields.map(x=>[x.value.id,ScenaModel.uid('field')]));selected.clear();for(const c of clipboard){const v=structuredClone(c.value),r=v.rect;r.x=Math.min(100-r.w,r.x+2);r.y=Math.min(100-r.h,r.y+2);if(c.type==='visual'){v.id=ScenaModel.uid('visual');v.label+=' — копия';(n.decorations||=[]).push(v);selected.add('v:'+v.id);}else if(c.type==='field'){v.id=ids.get(v.id);v.label+=' — копия';if(v.match?.stepId===n.id&&ids.has(v.match.fieldId))v.match.fieldId=ids.get(v.match.fieldId);n.fields.push(v);selected.add('f:'+v.id);}else if(c.type==='jump'){v.id=ScenaModel.uid('jump');(n.jumps||=[]).push(v);app.project().settings.flow='branching';selected.add('j:'+v.id);}else if(c.type==='option'&&n.options){v.id=ScenaModel.uid('opt');n.options.push(v);selected.add('o:'+v.id);}else if(c.type==='submit'){n.submitRect=r;selected.add('submit');}else if(c.type==='click'){n.rect=r;selected.add('click');}}});app.render();focus();}
function remove(){if(!selected.size)return;const n=app.node();app.mutate(()=>{if(n.decorations)n.decorations=n.decorations.filter(v=>!selected.has('v:'+v.id));if(n.fields)n.fields=n.fields.filter(f=>!selected.has('f:'+f.id));if(n.jumps)n.jumps=n.jumps.filter(j=>!selected.has('j:'+j.id));if(n.options)n.options=n.options.filter(o=>!selected.has('o:'+o.id));if(selected.has('submit'))delete n.submitRect;if(selected.has('click'))delete n.rect;});selected.clear();app.render();focus();}
function focus(){document.querySelector('.canvas-viewport')?.focus({preventScroll:true});}
function bind(){
 const wrap=document.getElementById('screen-wrap');
 if(!wrap)return;
 const n=app.node();
 let drag=null;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const angle=(x,y,cx,cy)=>Math.atan2(y-cy,x-cx)*180/Math.PI;
 function updateObjects(){
  const zones=Array.from(wrap.querySelectorAll('[data-area-key]'));
  const graphics=Array.from(wrap.querySelectorAll('[data-visual-id]'));
  for(const item of entries(n)){
   const position={left:item.rect.x+'%',top:item.rect.y+'%',width:item.rect.w+'%',height:item.rect.h+'%'};
   const zone=zones.find(element=>element.dataset.areaKey===item.key);
   if(zone)Object.assign(zone.style,position);
   if(!item.visual)continue;
   const transform='rotate('+(Number(item.visual.rotation)||0)+'deg)';
   if(zone)zone.style.transform=transform;
   const graphic=graphics.find(element=>element.dataset.visualId===item.visual.id);
   if(!graphic)continue;
   Object.assign(graphic.style,position,{transform});
   const text=graphic.querySelector('.visual-text');
   if(text&&item.visual.autoFont===false)text.style.fontSize=(item.visual.fontSize||24)/item.rect.w*10+'cqw';
  }
 }
 wrap.addEventListener('pointerdown',event=>{
  if(app.drawing())return;
  const zone=event.target.closest('[data-area-key]');
  if(!zone){selected.clear();app.editor();app.inspector();focus();return;}
  event.preventDefault();
  event.stopPropagation();
  const key=zone.dataset.areaKey;
  const entry=entries(n).find(item=>item.key===key);
  const rotating=!!event.target.closest('[data-rotate]');
  if(event.shiftKey&&!rotating&&!event.target.dataset.resize){
   selected.has(key)?selected.delete(key):selected.add(key);
   app.editor();app.inspector();focus();return;
  }
  if(rotating||!selected.has(key))selected=new Set([key]);
  const box=wrap.getBoundingClientRect();
  const cx=box.left+(entry.rect.x+entry.rect.w/2)/100*box.width;
  const cy=box.top+(entry.rect.y+entry.rect.h/2)/100*box.height;
  drag={
   x:event.clientX,y:event.clientY,box,
   handle:event.target.dataset.resize,
   rotating,cx,cy,
   initialAngle:angle(event.clientX,event.clientY,cx,cy),
   original:entries(n).filter(item=>selected.has(item.key)).map(item=>({
    key:item.key,rect:structuredClone(item.rect),rotation:Number(item.visual?.rotation)||0
   })),
   started:false
  };
  wrap.setPointerCapture(event.pointerId);
  zone.classList.add('area-selected');
 });
 wrap.addEventListener('pointermove',event=>{
  if(!drag)return;
  const dx=(event.clientX-drag.x)/drag.box.width*100;
  const dy=(event.clientY-drag.y)/drag.box.height*100;
  if(!drag.started&&Math.abs(dx)+Math.abs(dy)<.1)return;
  if(!drag.started){app.checkpoint();drag.started=true;}
  const all=entries(n);
  if(drag.rotating){
   const original=drag.original[0];
   const object=all.find(item=>item.key===original.key)?.visual;
   if(object){
    let rotation=original.rotation+angle(event.clientX,event.clientY,drag.cx,drag.cy)-drag.initialAngle;
    if(event.shiftKey)rotation=Math.round(rotation/15)*15;
    object.rotation=Math.round(((rotation%360+360)%360)*10)/10;
   }
  }else if(drag.handle){
   const original=drag.original[0];
   const radians=original.rotation*Math.PI/180;
   const cos=Math.cos(radians),sin=Math.sin(radians);
   const pixelX=event.clientX-drag.x,pixelY=event.clientY-drag.y;
   const localX=cos*pixelX+sin*pixelY,localY=-sin*pixelX+cos*pixelY;
   const oldWidth=original.rect.w/100*drag.box.width;
   const oldHeight=original.rect.h/100*drag.box.height;
   let left=-oldWidth/2,right=oldWidth/2,top=-oldHeight/2,bottom=oldHeight/2;
   const minimumWidth=drag.box.width/100,minimumHeight=drag.box.height/100;
   if(drag.handle.includes('w'))left=Math.min(right-minimumWidth,left+localX);
   if(drag.handle.includes('e'))right=Math.max(left+minimumWidth,right+localX);
   if(drag.handle.includes('n'))top=Math.min(bottom-minimumHeight,top+localY);
   if(drag.handle.includes('s'))bottom=Math.max(top+minimumHeight,bottom+localY);
   const centerX=(left+right)/2,centerY=(top+bottom)/2;
   const w=clamp((right-left)/drag.box.width*100,1,100);
   const h=clamp((bottom-top)/drag.box.height*100,1,100);
   const x=original.rect.x+original.rect.w/2+(cos*centerX-sin*centerY)/drag.box.width*100-w/2;
   const y=original.rect.y+original.rect.h/2+(sin*centerX+cos*centerY)/drag.box.height*100-h/2;
   Object.assign(all.find(item=>item.key===original.key).rect,{x:clamp(x,0,100-w),y:clamp(y,0,100-h),w,h});
  }else{
   const minX=Math.min(...drag.original.map(item=>item.rect.x));
   const minY=Math.min(...drag.original.map(item=>item.rect.y));
   const maxX=Math.max(...drag.original.map(item=>item.rect.x+item.rect.w));
   const maxY=Math.max(...drag.original.map(item=>item.rect.y+item.rect.h));
   const x=clamp(dx,-minX,100-maxX),y=clamp(dy,-minY,100-maxY);
   for(const original of drag.original)Object.assign(all.find(item=>item.key===original.key).rect,{
    x:original.rect.x+x,y:original.rect.y+y
   });
  }
  updateObjects();
 });
 function finish(){
  if(!drag)return;
  const moved=drag.started;
  drag=null;
  if(moved)app.changed();
  app.editor();app.inspector();focus();
 }
 wrap.addEventListener('pointerup',finish);
 wrap.addEventListener('pointercancel',finish);
}
function init(adapter){app=adapter;document.getElementById('editor-content').addEventListener('change',e=>{if(e.target.id==='canvas-zoom'){zoom=Number(e.target.value);app.editor();}});document.getElementById('editor-content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if('areaTools'in d)app.tools?.();if('areaSubmit'in d){const n=app.node();if(n.type==='choice'){if(!n.options.length)app.mutate(()=>n.options.push({id:ScenaModel.uid('opt'),label:'Ответ',next:''}));app.draw({kind:'option',index:n.options.length-1});}else app.draw({kind:n.type==='click'?'click':'submit'});}if('areaCopy'in d){copy();app.editor();focus();}if('areaPaste'in d)paste();if('areaDelete'in d)remove();if('areaCancel'in d){selected.clear();app.cancel();app.editor();}if(d.selectField)pickField(d.selectField,e.shiftKey);});document.addEventListener('keydown',e=>{if(!document.querySelector('.canvas-viewport')||document.getElementById('view-editor').classList.contains('hidden')||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable=true]'))return;if(app.drawing()){if(e.key==='Escape'){e.preventDefault();app.cancel();app.editor();}return;}const cmd=e.ctrlKey||e.metaKey;if(cmd&&e.key.toLowerCase()==='c'&&selected.size){e.preventDefault();copy();}if(cmd&&e.key.toLowerCase()==='v'&&clipboard.length){e.preventDefault();paste();}if(['Delete','Backspace'].includes(e.key)&&selected.size){e.preventDefault();remove();}if(e.key.startsWith('Arrow')&&selected.size){e.preventDefault();const dx=e.key==='ArrowLeft'?-.25:e.key==='ArrowRight'?.25:0,dy=e.key==='ArrowUp'?-.25:e.key==='ArrowDown'?.25:0,all=entries(app.node()).filter(e=>selected.has(e.key));const x=Math.max(-Math.min(...all.map(e=>e.rect.x)),Math.min(100-Math.max(...all.map(e=>e.rect.x+e.rect.w)),dx)),y=Math.max(-Math.min(...all.map(e=>e.rect.y)),Math.min(100-Math.max(...all.map(e=>e.rect.y+e.rect.h)),dy));app.mutate(()=>all.forEach(e=>{e.rect.x+=x;e.rect.y+=y;}));app.editor();app.inspector();focus();}});}
root.ScenaAreas={items:entries,currentEntry,pickEntry,init,html,bind,currentField,pickField,currentVisual,pickVisual,reset:()=>selected.clear()};
})(window);
