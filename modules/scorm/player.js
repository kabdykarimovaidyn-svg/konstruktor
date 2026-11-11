/* Same player runs in author preview and in the exported SCORM package. */
(function(root){
'use strict';
function run(course,runtimeFactory){
 const byId=Object.fromEntries(course.steps.map(s=>[s.id,s]));
 const api=course.preview?{connected:false,warnings:[],get:()=>'',save:()=>true,finish:()=>true}:runtimeFactory(window);
 let state={v:4,values:{},progress:'',course:course.id,step:course.start,errors:0,done:false,score:0,time:0,refs:{},salt:''},currentVideo=null,lastSave=0,generation=0;const frames=new Map(),screenValues=new Map();let rememberScreen=null;
 try{const v=JSON.parse(api.get('cmi.suspend_data'));if([1,2,3,4].includes(v.v)&&v.course===course.id&&byId[v.step]&&Number.isInteger(v.errors)&&v.errors>=0&&typeof v.done==='boolean'&&Number.isFinite(v.score)&&v.score>=0&&v.score<=100)state={...state,...v,done:byId[v.step].type==='end'&&v.done,time:Math.max(0,Number(v.time)||0)};}catch{}
 const $=id=>document.getElementById(id);$('title').textContent=course.title;
 const refKey=(step,field)=>step+'/'+field,needed=new Set();
 for(const step of course.steps)for(const f of step.type==='input'?[{id:'single',remember:step.remember}]:step.fields||[]){if(f.remember)needed.add(refKey(step.id,f.id));if(f.rule==='match'&&f.match)needed.add(refKey(f.match.stepId,f.match.fieldId));}
 state.refs=Object.fromEntries(Object.entries(state.refs||{}).filter(([k,v])=>needed.has(k)&&typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)));
 if(!/^[a-f0-9]{32}$/.test(state.salt||'')){state.salt='';state.refs={};}
 function salt(){if(state.salt)return state.salt;if(!window.crypto?.getRandomValues)return '';const data=new Uint8Array(16);window.crypto.getRandomValues(data);return state.salt=Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');}
 // Salted fingerprints only: learner-entered passwords never enter suspend_data in plain text.
 function hash(value){const bytes=new TextEncoder().encode(value),size=Math.ceil((bytes.length+9)/64)*64,data=new Uint8Array(size);data.set(bytes);data[bytes.length]=128;const view=new DataView(data.buffer);view.setUint32(size-4,bytes.length*8,false);const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2],result=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const rotr=(x,n)=>(x>>>n)|(x<<(32-n));for(let at=0;at<size;at+=64){const w=new Uint32Array(64);for(let i=0;i<16;i++)w[i]=view.getUint32(at+i*4,false);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;}let [a,b,c,d,e,f,g,h]=result;for(let i=0;i<64;i++){const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,h].forEach((v,i)=>result[i]=(result[i]+v)>>>0);}return result.map(v=>v.toString(16).padStart(8,'0')).join('');}
 const autofillKeys=new Set();for(const step of course.steps)for(const f of step.fields||[])if(f.autofill)autofillKeys.add(refKey(f.autofill.stepId,f.autofill.fieldId));
 state.values=Object.fromEntries(Object.entries(state.values||{}).filter(([k,v])=>autofillKeys.has(k)&&typeof v==='string'&&v.length<=64));
 state.progress=typeof state.progress==='string'&&/^[0-9a-f]*$/.test(state.progress)&&state.progress.length<=125?state.progress:'';
 const theme=course.theme||{},color=/^#[0-9a-f]{6}$/i.test(theme.color||'')?theme.color:'#005ca9',font=['Arial','Verdana','Georgia','Tahoma','Trebuchet MS'].includes(theme.font)?theme.font:'Arial';
 if(document.documentElement?.style){document.documentElement.style.setProperty('--accent',color);document.documentElement.style.setProperty('--course-font',font);for(const [name,key]of [['--heading-color','titleColor'],['--text-color','textColor']])document.documentElement.style.setProperty(name,/^#[a-f0-9]{6}$/i.test(theme[key]||'')?theme[key]:'#21384f');}
 if($('course-logo')&&theme.logo){$('course-logo').src=theme.logo;$('course-logo').hidden=false;}
 function visited(index){return !!(parseInt(state.progress[Math.floor(index/4)]||'0',16)&(1<<(index%4)));}
 function mark(id){const i=course.steps.findIndex(s=>s.id===id);if(i<0)return;const a=state.progress.padEnd(Math.ceil(course.steps.length/4),'0').split('');a[Math.floor(i/4)]=(parseInt(a[Math.floor(i/4)],16)|(1<<(i%4))).toString(16);state.progress=a.join('');}
 function progress(){const bar=$('course-progress');if(!bar)return;bar.replaceChildren();const done=course.steps.filter((s,i)=>visited(i)&&s.type!=='return');const queue=[[state.step]],seen=new Set();let rest=[];while(queue.length){const path=queue.shift(),id=path.at(-1);if(seen.has(id))continue;seen.add(id);const s=byId[id];if(!s)continue;if(s.type==='end'){rest=path.map(id=>byId[id]).filter(s=>s.type!=='return');break;}for(const to of [...(s.options?s.options.filter(o=>!o.wrong).map(o=>o.next):[s.next]),...(s.jumps||[]).map(j=>j.next)])if(to&&!path.includes(to))queue.push([...path,to]);}const pages=[...done,...rest.filter(s=>!done.some(d=>d.id===s.id))];for(const page of pages){const seg=el('span',undefined,bar);seg.className=page.id===state.step?'current':visited(course.steps.indexOf(page))?'complete':'pending';seg.setAttribute('aria-label',page.id===state.step?'Текущая страница':visited(course.steps.indexOf(page))?'Пройдено':'Впереди');}bar.setAttribute('aria-label','Прогресс: '+done.length+' из '+pages.length+' страниц маршрута');}
 let finished=false,finishing=false;
 function stats(){if($('errors'))$('errors').textContent='Ошибок: '+state.errors;}
 function warning(message){const e=$('session-warning');if(e){e.textContent=message||'';e.hidden=!message;}}

 function save(){if(finished)return true;if(currentVideo&&byId[state.step].type==='video'&&Number.isFinite(currentVideo.currentTime))state.time=currentVideo.currentTime;let ok=false;try{ok=api.save(state);}catch{}if(!ok&&api.connected)warning('Не удалось сохранить прогресс. Сохранение повторится при следующем действии.');else warning('');return ok;}
 function el(tag,value,parent,cls){const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;if(parent)parent.append(e);return e;}
 function button(label,fn,parent,cls){const b=el('button',label,parent,cls);b.type='button';b.onclick=fn;return b;}
 function wrong(message){state.errors++;stats();$('feedback').textContent=course.mode==='test'?'Неверное действие. Попробуйте ещё раз.':message||byId[state.step].error||'Неверное действие. Попробуйте ещё раз.';$('feedback').className='error';save();}
 function go(id){if(!byId[id]){$('feedback').textContent='Переход не настроен. Обратитесь к автору курса.';return;}rememberScreen?.();if(currentVideo){if(byId[id].type==='choice'&&byId[id].video===state.step){state.frameId=state.step;state.frameTime=Number.isFinite(currentVideo.currentTime)?currentVideo.currentTime:0;try{const c=document.createElement('canvas');c.width=currentVideo.videoWidth;c.height=currentVideo.videoHeight;if(c.width&&c.height){c.getContext('2d').drawImage(currentVideo,0,0);frames.set(state.step,c.toDataURL('image/jpeg',.85));if(frames.size>6)frames.delete(frames.keys().next().value);}}catch{}}currentVideo.pause();currentVideo=null;}mark(state.step);state.step=id;state.time=0;save();render();}
 function overlay(e,r){if(r){e.style.position='absolute';e.style.left=r.x+'%';e.style.top=r.y+'%';e.style.width=r.w+'%';e.style.height=r.h+'%';}}
 function fit(e){e.onloadedmetadata=()=>{if(Number.isFinite(e.duration)&&e.duration>0){e.currentTime=Math.max(0,e.duration-.04);e.pause();}};e.onseeked=()=>e.pause();}

 function finishCourse(buttonElement,status){if(finishing||finished)return;finishing=true;buttonElement.disabled=true;let ok=false;const wasConnected=api.connected;try{ok=api.finish(state)===true;}catch{}if(!ok){status.textContent='Не удалось сохранить завершение. Проверьте соединение и нажмите «Завершить» ещё раз.';status.className='finish-status failure';buttonElement.disabled=false;finishing=false;return;}finished=true;finishing=false;warning('');buttonElement.textContent='Завершено';status.textContent=course.preview?'Просмотр завершён.':wasConnected?'Результат сохранён. Если окно не закрылось, закройте просмотр в системе обучения.':'Просмотр завершён. Для учёта результата открывайте курс из системы обучения.';status.className='finish-status';if(course.preview){try{window.parent?.postMessage({type:'scena-preview-finished',token:course.previewToken},'*');}catch{}return;}try{if(!window.parent||window.parent===window){if(typeof window.close==='function')window.close();}else window.parent.postMessage({type:'scena-course-finished',courseId:course.id,status:'completed'},'*');}catch{}}
 function instruction(s){if(s.instruction?.trim())return s.instruction;return ({video:byId[s.next]?.showMode==='time'?'Посмотрите видео до появления вариантов и выберите действие.':'Посмотрите видео до конца и продолжите выполнение задания.',choice:s.selectBeforeContinue?'Выберите вариант ответа, затем нажмите «Далее».':'Выберите один из вариантов ответа.',form:'Заполните поля на экране и нажмите кнопку продолжения.',input:'Введите данные и нажмите «Далее».',click:'Нажмите нужную кнопку на экране программы.',message:'Ознакомьтесь с пояснением и продолжите.',slide:'Изучите слайд и нажмите «Далее».'})[s.type]||'';}
 let mediaViewport=null,mediaStage=null,mediaRatio=16/9,mediaZoom=1;
 function fitSelects(){
  if(!mediaStage?.querySelectorAll)return;
  for(const input of mediaStage.querySelectorAll('select')){
   const height=input.getBoundingClientRect().height;
   input.style.fontSize=Math.max(12,Math.min(18,height*.6))+'px';
   input.style.padding='0 4px';
   input.style.lineHeight='normal';
  }
 }
 function fitMedia(){if(!mediaViewport?.getBoundingClientRect||!mediaStage)return;const box=mediaViewport.getBoundingClientRect(),cs=window.getComputedStyle(mediaViewport),innerW=mediaViewport.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),innerH=mediaViewport.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom),w=Math.max(1,Math.floor(Math.min(innerW,innerH*mediaRatio)-1))*mediaZoom;mediaStage.style.width=w+'px';mediaStage.style.height=w/mediaRatio+'px';if(mediaStage.style.setProperty)mediaStage.style.setProperty('--field-font',Math.max(9,Math.min(20,w/60))+'px');fitSelects();}
 function watchMedia(stage,viewport,ratio=16/9){mediaStage=stage;mediaViewport=viewport;mediaRatio=ratio;fitMedia();}
 function footer(area){const tools=el('div',undefined,area,'screen-tools');el('span',$('step').textContent,tools,'page-caption');return tools;}
 function resizeLayout(){fitMedia();}
 const requestFit=()=>{if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(resizeLayout);else resizeLayout();};
 if(window.ResizeObserver){const observer=new ResizeObserver(requestFit);observer.observe($('screen'));if($('task-banner'))observer.observe($('task-banner'));}
 window.addEventListener('resize',requestFit);
 function navigation(area){
  const nav=el('div',undefined,area,'navigation'),step=byId[state.step];
  if(step.template==='guide')nav.classList.add('guide-navigation');
  if(['form','click'].includes(step.type)){
   const visible=step.showNext??!(step.jumps?.length||step.submitRect);
   if(!visible)nav.style.display='none';
  }
  return nav;
 }
 function decorateOptions(step,parent){const positioned=step.options.some(o=>o.rect);if(positioned){parent.classList.add('positioned-options');}for(const o of step.options){const b=button(o.label,()=>o.wrong?wrong(o.error):go(o.next),parent,'choice-button');if(o.rect)overlay(b,o.rect);if(/^#[a-f0-9]{6}$/i.test(o.color||'')){b.style.background=o.color;b.style.borderColor=o.color;}if(/^#[a-f0-9]{6}$/i.test(o.textColor||''))b.style.color=o.textColor;if(Number(o.fontSize)>=10&&Number(o.fontSize)<=32)b.style.fontSize=o.fontSize+'px';b.style.borderRadius=o.rounded===false?'0':'6px';}}
 function renderGuide(step,parent){
  const guide=el('section',undefined,parent,'learner-guide');
  el('h2',step.title||'Как проходить тренажёр',guide);
  el('p','Посмотрите, что означают элементы на экране.',guide,'guide-subtitle');
  const grid=el('div',undefined,guide,'guide-layout');
  const demo=el('div',undefined,grid,'guide-demo');
  demo.setAttribute('aria-hidden','true');
  function marker(element,number){
   element.classList.add('guide-marked');
   el('span',number,element,'guide-marker');
   return element;
  }
  const progress=marker(el('div',undefined,demo,'guide-progress'),1);
  for(let i=0;i<6;i++)el('i',undefined,progress,i<3?'complete':'');
  const top=el('div',undefined,demo,'guide-demo-top');
  el('span','Прогресс',top);
  marker(el('span','Ошибок: 0',top),2);
  marker(el('div','Задание | Заполните данные клиента',demo,'guide-task'),3);
  el('h3','Карточка клиента',demo);
  el('p','Телефон',demo);
  marker(el('div','+7 701',demo,'guide-field'),4);
  el('p','Тип обращения',demo);
  marker(el('div','▾',demo,'guide-field'),5);
  marker(el('div','Открыть заказы',demo,'guide-active'),6);
  marker(el('p','☑ Данные проверены',demo),7);
  marker(el('div','Проверьте номер телефона',demo,'guide-error'),8);
  marker(el('small','Увеличить ↗',demo),9);
  const list=el('div',undefined,grid,'guide-list');
  const order=['Прогресс','Счётчик ошибок','Задание','Поле ввода','Выпадающий список','Активная область','Галочка','Сообщение об ошибке','Увеличить'];
  const lines=(step.body||'').split('\n').filter(Boolean);
  const rank=line=>{const index=order.indexOf(line.split('|')[0]);return index<0?order.length:index;};
  lines.sort((a,b)=>rank(a)-rank(b));
  for(const [i,line] of lines.entries()){
   const separator=line.indexOf('|');
   const item=el('div',undefined,list,'guide-item');
   el('span',i+1,item,'guide-number');
   const text=el('div',undefined,item);
   el('strong',separator<0?line:line.slice(0,separator),text);
   if(separator>=0)el('p',line.slice(separator+1),text);
  }
  el('p','При переходе между экранами введённые данные сохраняются в текущем прохождении.',guide,'guide-note');
 }
 function render(){
  generation++;rememberScreen=null;mediaViewport=null;mediaStage=null;mediaZoom=1;const version=generation;const s=byId[state.step],area=$('screen');area.replaceChildren();area.className=['intro','end'].includes(s.type)?'terminal-screen':'content-screen';if($('title').parentElement)$('title').parentElement.hidden=s.type==='intro';if($('course-progress'))$('course-progress').hidden=s.type==='intro';requestFit();$('feedback').textContent='';$('feedback').className='';$('task').textContent=instruction(s);$('step').textContent=s.type==='video'?'Видеоматериал':s.type==='choice'?'Вопрос':s.type==='message'?'Пояснение':s.type==='slide'?'Презентация':'Практическое задание';stats();progress();if($('task-title'))$('task-title').textContent=s.taskTitle||({video:'Просмотр видео',choice:'Выбор решения',form:'Работа в программе',click:'Работа в программе',message:'Изучение материала',slide:'Презентация'})[s.type]||'Учебный шаг';if($('task-banner'))$('task-banner').hidden=['end','intro'].includes(s.type)||s.template==='guide';if($('work-bar'))$('work-bar').hidden=['end','intro'].includes(s.type);
  if(s.type==='return'){
   if(s.penalty!==false)state.errors++;
   // Return nodes are explicit in the graph; target must be a choice, so no automatic loop.
   go(s.next);return;
  }
  if(s.type==='intro'){
   const card=el('div',undefined,area,'business-cover');
   const brand=el('div',undefined,card,'business-brand');
   const logo=theme.logo||(!theme.coverLogoHidden&&course.coverLogo);
   if(logo){const image=el('img',undefined,brand,'business-logo');image.src=logo;image.alt='Корпоративный университет Казахтелеком';}
   const center=el('div',undefined,card,'business-center');
   el('div','КОРПОРАТИВНОЕ ОБУЧЕНИЕ',center,'business-eyebrow');
   el('h2',course.title,center,'business-title');
   if(s.body?.trim())el('p',s.body,center,'business-description');
   button('Начать',()=>go(s.next),center,'business-start');
   const bottom=el('div',undefined,card,'business-bottom');
   el('span','ПРОФЕССИОНАЛЬНОЕ РАЗВИТИЕ',bottom);
   el('span','Корпоративный университет',bottom);
   return;
  }
  if(s.type==='end'){mark(s.id);progress();state.done=true;state.score=Math.max(0,100-state.errors*(Number.isFinite(course.penalty)?course.penalty:10));const card=el('div',undefined,area,'completion-card');el('div','✓',card,'completion-icon');el('div',course.previewScope==='step'?'ПРОВЕРКА ШАГА ЗАВЕРШЕНА':'ОБУЧЕНИЕ ЗАВЕРШЕНО',card,'completion-kicker');el('h2',course.title,card,'completion-title');el('p',s.body||'Вы прошли все необходимые задания.',card,'completion-description');const metrics=el('div',undefined,card,'completion-metrics');el('span','Ошибок: '+state.errors,metrics);el('span','Результат: '+state.score+' из 100',metrics);el('p',course.preview?'Нажмите «Завершить», чтобы закрыть предпросмотр.':'Нажмите «Завершить», чтобы закончить просмотр и передать результат.',card,'completion-hint');const status=el('p','',card,'finish-status');status.setAttribute('role','status');const endButton=button('Завершить',()=>finishCourse(endButton,status),card,'finish-button');save();return;}
  const viewport=el('div',undefined,area,'media-viewport');const stage=el('div',undefined,viewport,'stage');const tools=footer(area);let controls=stage;
  if(s.background){const img=el('img',undefined,stage);img.src=s.background;img.alt='Экран программы';watchMedia(stage,viewport);img.onload=()=>{if(version!==generation)return;mediaRatio=img.naturalWidth/img.naturalHeight||16/9;requestFit();};const zoom=button('Увеличить',()=>{mediaZoom=mediaZoom===1?2:1;zoom.textContent=mediaZoom===1?'Увеличить':'Вписать';viewport.classList.toggle('zoomed',mediaZoom>1);fitMedia();},tools,'zoom-button');img.onerror=()=>{$('feedback').textContent='Не удалось загрузить скриншот.';};stage.classList.add('screenshot');}
  else{controls=el('div',undefined,stage,'controls');}
  const backgroundVideo=s.video&&byId[s.video];
  if(s.type==='choice'&&backgroundVideo){stage.replaceChildren();stage.classList.add('video-stage');watchMedia(stage,viewport);if(frames.has(s.video)){const img=el('img',undefined,stage);img.src=frames.get(s.video);img.alt='Последний кадр ситуации';img.onload=()=>{if(version===generation){mediaRatio=img.naturalWidth/img.naturalHeight||16/9;requestFit();}};}else{const v=el('video',undefined,stage);v.src=backgroundVideo.src;v.preload='auto';v.playsInline=true;v.muted=true;v.setAttribute('aria-label','Последний кадр ситуации');v.addEventListener('loadedmetadata',()=>{if(version===generation){mediaRatio=v.videoWidth/v.videoHeight||16/9;requestFit();}});fit(v);if(s.showMode==='time')v.onloadedmetadata=()=>{v.currentTime=Math.min(Number(s.showAt)||0,Math.max(0,v.duration-.04));v.pause();};if(state.frameId===s.video&&state.frameTime>0){v.onloadedmetadata=()=>{v.currentTime=state.frameTime;v.pause();};}v.onerror=()=>{$('feedback').textContent='Не удалось загрузить последний кадр видео.';};}controls=el('div',undefined,stage,'video-options');}
  if(s.type==='slide'){if(!s.background)el('p','Слайд не найден.',controls);button('Далее',()=>go(s.next),navigation(area));return;}
  if(s.type==='message'){
   if(s.template==='guide'){renderGuide(s,controls);}else if(s.template==='cards'){const cards=el('div',undefined,controls,'template-cards');(s.body||'').split('\n').filter(Boolean).forEach(t=>el('p',t,cards));}else if(s.template==='dialog'){(s.body||'').split('\n').filter(Boolean).forEach((t,i)=>el('p',t,controls,'dialog-bubble '+(i%2?'reply':'')));}else el('p',s.body||'',controls,'message');button(s.button||'Далее',()=>go(s.next),navigation(area));return;
  }
  if(s.type==='video'){
   stage.classList.add('video-stage');watchMedia(stage,viewport);stage.replaceChildren();const v=el('video',undefined,stage);v.controls=true;v.setAttribute('controlsList','nofullscreen');v.playsInline=true;v.preload='metadata';v.src=s.src;currentVideo=v;v.addEventListener('loadedmetadata',()=>{if(version!==generation)return;mediaRatio=v.videoWidth/v.videoHeight||16/9;requestFit();});
   const fs=button('На весь экран',()=>{if(area.requestFullscreen)area.requestFullscreen().catch(()=>{$('feedback').textContent='Контейнер LMS или браузер не разрешает полноэкранный режим.';});else {$('feedback').textContent='Полноэкранный режим недоступен в этом браузере.';}},tools,'fullscreen-button');const loading=el('span','Загрузка видео…',stage,'video-loading');v.oncanplay=()=>loading.remove();v.onwaiting=()=>{loading.textContent='Загрузка видео…';if(!loading.parentNode)stage.append(loading);};const choice=byId[s.next];let shown=false;function timedChoice(){if(shown||choice?.type!=='choice'||choice.video!==s.id||choice.showMode!=='time'||v.currentTime<Number(choice.showAt||0))return;shown=true;v.pause();state.time=v.currentTime;const box=el('div',undefined,stage,'video-options timed-options');decorateOptions(choice,box);save();}
   const resume=state.time;v.onloadedmetadata=()=>{if(version!==generation)return;if(resume>0&&resume<v.duration)v.currentTime=resume;};
   v.ontimeupdate=()=>{timedChoice();if(version===generation&&Date.now()-lastSave>5000){lastSave=Date.now();save();}};
   v.onerror=()=>{$('feedback').textContent='Видео не загрузилось. Проверьте файл или кодек.';};
   v.onended=()=>{if(version!==generation)return;if(choice?.showMode==='time'&&choice.video===s.id){timedChoice();if(shown)return;}if(s.options){const choices=el('div',undefined,stage,'video-options');s.options.forEach(o=>button(o.label,()=>o.wrong?wrong(o.error):go(o.next),choices));}else go(s.next);};
   const promise=v.play();if(promise?.catch)promise.catch(()=>{});return;
  }
  function options(parent){if(s.video){decorateOptions(s,parent);return;}s.options.forEach(o=>{const b=button(o.label,()=>o.wrong?wrong(o.error):go(o.next),parent,'choice-button');if(s.background&&o.rect){overlay(b,o.rect);b.classList.add('hotspot');}});}
  if(s.type==='choice'){
   if(s.selectBeforeContinue){const form=el('form',undefined,controls);form.id='choice-form';s.options.forEach((o,i)=>{const label=el('label',undefined,form,'radio-label');const input=el('input',undefined,label);input.type='radio';input.name='choice';input.value=String(i);input.setAttribute('aria-label',o.label);if(s.background&&o.rect){overlay(label,o.rect);label.classList.add('screen-radio');}else label.append(document.createTextNode(o.label));});const b=el('button','Далее',navigation(area));b.type='submit';b.setAttribute('form','choice-form');form.onsubmit=e=>{e.preventDefault();const checked=form.querySelector('input:checked');if(!checked){wrong(s.error);return;}const o=s.options[Number(checked.value)];if(o.wrong)wrong(o.error);else go(o.next);};}else options(controls);
  }else if(s.type==='input'||s.type==='form'){
   const fields=s.type==='input'?[{id:'single',label:s.label||'Введите значение',expected:s.expected,rule:s.rule||'exact',caseSensitive:s.caseSensitive,rect:s.rect,placeholder:s.placeholder}]:s.fields;
   const form=el('form',undefined,controls);form.id='step-form';const inputs=[];
   const previous=screenValues.get(s.id);
   fields.forEach(f=>{const kind=f.kind||'text',label=el('label',s.background?'':f.label,form,'field-label kind-'+kind);if(s.background)overlay(label,f.rect);let input;if(kind==='select'){input=el('select',undefined,label);el('option','',input).value='';for(const t of (f.choices||'').split('\n').map(t=>t.trim()).filter(Boolean)){el('option',t,input).value=t;}input.value=f.initial||'';}else if(kind==='checkbox'){input=el('input',undefined,label);input.type='checkbox';input.checked=!!f.initialChecked;if(!s.background)el('span',f.label,label);}else if(kind==='radio'){input=el('div',undefined,label,'radio-group');for(const [i,t] of (f.choices||'').split('\n').map(t=>t.trim()).filter(Boolean).entries()){const item=el('label',undefined,input),r=el('input',undefined,item);r.type='radio';r.name=f.id;r.value=t;r.checked=t===f.initial;r.setAttribute('aria-label',f.label+': '+t);el('span',t,item);} }else{input=el('input',undefined,label);input.type=f.inputType==='password'?'password':'text';input.autocomplete=f.inputType==='password'?'new-password':'off';input.spellcheck=false;input.placeholder=f.placeholder||'';}
   input.setAttribute('aria-label',f.label||'Поле ввода');const read=()=>kind==='checkbox'?String(input.checked):kind==='radio'?(input.querySelector('input:checked')?.value||''):input.value;const set=value=>{if(kind==='checkbox')input.checked=value==='true';else if(kind==='radio')input.querySelectorAll('input').forEach(r=>r.checked=r.value===value);else input.value=value;};if(f.autofill){const value=state.values[refKey(f.autofill.stepId,f.autofill.fieldId)];if(value!==undefined)set(value);else {$('feedback').textContent='Для автозаполнения сначала заполните исходное поле.';$('feedback').className='error';}}if(previous?.has(f.id))set(previous.get(f.id));inputs.push({f,input,read,set});});
   if(s.background)rememberScreen=()=>screenValues.set(s.id,new Map(inputs.map(item=>[item.f.id,item.read()])));
   const submit=el('button',s.button||'Далее',navigation(area));submit.type='submit';submit.setAttribute('form','step-form');
   if(s.background&&s.submitRect){const hit=el('button',s.button||'Далее',stage,'hotspot');hit.type='submit';hit.setAttribute('form','step-form');overlay(hit,s.submitRect);}
   form.onsubmit=e=>{e.preventDefault();let failed=null,message='';const raw=new Map(inputs.map(item=>[item.f.id,item.read()]));for(const item of inputs){message='';const {f,input}=item,value=item.read(),kind=f.kind||'text';let valid=true;if(kind==='checkbox')valid=value===String(f.expectedChecked!==false);else if(['select','radio'].includes(kind))valid=value===f.expected;else if(f.rule==='match'){const source=f.match;if(source?.stepId===s.id&&raw.has(source.fieldId))valid=value===raw.get(source.fieldId);else{const expected=source&&state.refs[refKey(source.stepId,source.fieldId)];if(!expected||!state.salt){$('feedback').textContent='Исходное значение не заполнено. Пройдите исходный шаг.';$('feedback').className='error';return;}valid=hash(state.salt+'\0'+value)===expected;}message='Значение должно в точности совпадать с исходным полем. Проверьте регистр и пробелы.';}else{let v=f.trim===false?value:value.trim(),expected=f.trim===false?String(f.expected||''):String(f.expected||'').trim();if(!f.caseSensitive){v=v.toLocaleLowerCase();expected=expected.toLocaleLowerCase();}if(f.rule==='any')valid=!!v.trim();else if(f.rule==='oneOf')valid=(f.accepted||'').split('\n').filter(t=>t.trim()).some(t=>(f.caseSensitive?(f.trim===false?t:t.trim()):(f.trim===false?t:t.trim()).toLocaleLowerCase())===v);else if(f.rule==='range'){const number=Number(value.trim().replace(',','.'));valid=/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim())&&number>=Number(f.min)&&number<=Number(f.max);}else if(f.rule==='email')valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());else if(f.rule==='phone')valid=/^\+?[\d\s()-]+$/.test(value.trim())&&value.replace(/\D/g,'').length>=10&&value.replace(/\D/g,'').length<=15;else {if(f.rule==='url'){v=v.replace(/^https?:\/\//,'').replace(/\/$/,'');expected=expected.replace(/^https?:\/\//,'').replace(/\/$/,'');}valid=v===expected;}}if(!valid){failed=item;break;}}
   inputs.forEach(({input})=>input.removeAttribute('aria-invalid'));if(failed){failed.input.setAttribute('aria-invalid','true');failed.input.focus();wrong(message||s.error||'Проверьте поле «'+failed.f.label+'».');return;}
   const nextValues={...state.values},nextRefs={...state.refs};for(const item of inputs){const k=refKey(s.id,item.f.id),value=item.read();if(autofillKeys.has(k)){if(value.length>64){wrong('Для автозаполнения используйте значение не длиннее 64 символов.');return;}nextValues[k]=value;}if(needed.has(k)){if(!salt()){$('feedback').textContent='В браузере недоступно сопоставление полей.';return;}nextRefs[k]=hash(state.salt+'\0'+value);}}if(JSON.stringify({...state,values:nextValues,refs:nextRefs}).length>3600){$('feedback').textContent='Превышен объём сохраняемых данных. Сократите значения для автозаполнения.';return;}state.values=nextValues;state.refs=nextRefs;go(s.next);};

  }else if(s.type==='click'){
   if(s.rect||!s.jumps?.length){const hit=button(s.label||'Продолжить',()=>go(s.next),stage,s.background?'hotspot':'');if(s.background)overlay(hit,s.rect);}else if(s.next)button('Далее',()=>go(s.next),navigation(area));
  }
  if(s.background)for(const j of s.jumps||[]){const hit=button(j.label,()=>go(j.next),stage,'hotspot');overlay(hit,j.rect);}
  requestFit();
  stage.addEventListener('click',e=>{if(e.target===stage||e.target.tagName==='IMG')wrong();});
 }
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});window.addEventListener('pagehide',e=>{if(e.persisted)save();else api.finish(state);});if($('save'))$('save').onclick=save;render();save();
 return {getState:()=>({...state,refs:{...state.refs}}),destroy(){generation++;if(currentVideo)currentVideo.pause();api.finish(state);}};
}
const css=`:root{--accent:#005ca9;--course-font:Arial;--heading-color:#21384f;--text-color:#21384f}*{box-sizing:border-box}html{height:100%;overflow:hidden}body{margin:0;height:100vh;height:100dvh;display:flex;flex-direction:column;background:#f4f7fb;color:var(--text-color);font:14px/1.45 var(--course-font),sans-serif;overflow:hidden;padding:10px 16px;gap:8px}.course-header{display:flex;align-items:center;gap:12px;min-height:24px;flex-shrink:0}.course-header h1{font-size:13px;font-weight:600;color:var(--heading-color);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}#course-logo{max-width:100px;max-height:24px;object-fit:contain}#course-logo[hidden]{display:none}.error-counter{margin-left:auto;white-space:nowrap;font-size:11px;color:#647b91;padding:3px 7px;background:#fff;border:1px solid #d8e2ec;border-radius:4px}main{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}.segmented-progress{display:flex;gap:4px;height:4px;flex-shrink:0;margin:0 0 2px}.segmented-progress span{flex:1;min-width:1px;background:#d8e4ef;border-radius:2px}.segmented-progress .complete{background:var(--accent)}.segmented-progress .current{background:#79aad5}.task-banner{display:flex;align-items:flex-start;gap:12px;padding:9px 13px;background:var(--accent);color:white;border-radius:5px;flex-shrink:0;min-height:38px}.task-banner[hidden]{display:none}.task-label{font-size:12px;white-space:nowrap;padding-right:12px;border-right:1px solid #ffffff55;line-height:20px}#task{font-size:13px;line-height:20px;margin:0;min-width:0;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;flex:1}.task-banner.expanded #task{display:block;max-height:25vh;overflow:auto}button{font:inherit;border:1px solid var(--accent);background:var(--accent);color:white;cursor:pointer;border-radius:4px;padding:8px 18px;margin:0}button:hover{filter:brightness(.94)}button:disabled{opacity:.65;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #75b1eb;outline-offset:2px}#more-task{padding:0;border:0;background:none;text-decoration:underline;font-size:11px;line-height:20px;white-space:nowrap}#more-task[hidden]{display:none}#work-bar{display:none}#feedback:empty{display:none}#feedback{position:fixed;z-index:25;bottom:55px;left:24px;right:24px;box-shadow:0 3px 14px #78301b18;font-size:12px;padding:7px 11px;border-left:3px solid #bb4030;color:#a23827;background:#fff0ec;border-radius:3px;max-height:13vh;overflow:auto}#screen{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}#screen.content-screen{padding-bottom:40px}.media-viewport{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;background:#e9eef4;border:1px solid #d4dfea;border-radius:5px;padding:8px}.media-viewport.zoomed{align-items:flex-start;justify-content:flex-start}.stage{position:relative;flex-shrink:0;border-radius:3px;background:white;border:1px solid #d1dce7;overflow:hidden;width:100%;height:100%}.stage:has(>.controls){overflow:auto}.controls{padding:22px;max-width:950px;margin:auto}.stage.screenshot>img,.video-stage>video,.video-stage>img{display:block;width:100%;height:100%;object-fit:contain}.video-stage{background:#102137;border-color:#102137}.screen-tools{position:absolute;bottom:0;left:0;height:32px;display:flex;align-items:center;gap:12px;max-width:calc(100% - 135px)}.page-caption{font-size:10px;color:#7b8fa2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.screen-tools button{padding:5px 9px;font-size:10px;color:#3d6387;background:white;border:1px solid #c8d8e7;white-space:nowrap}.navigation{position:absolute;bottom:0;right:0;display:flex;justify-content:flex-end;max-width:65%;min-height:32px}.navigation button{font-size:12px;padding:7px 20px;min-width:115px}.video-options{position:absolute;left:5%;right:5%;bottom:14%;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;background:#102b46dc;padding:12px;border-radius:5px}.video-options .choice-button{flex:1;min-width:150px}.positioned-options{inset:0!important;padding:0!important;background:none!important;display:block!important;pointer-events:none}.positioned-options button{pointer-events:auto;min-width:0!important;margin:0;padding:4px 7px;overflow:auto}.video-loading{position:absolute;top:10px;left:10px;background:#102137cc;color:#fff;font-size:11px;padding:5px 10px}.field-label{display:block;margin:14px 0;font-size:13px}.field-label input,.field-label select{display:block;width:420px;max-width:100%;padding:10px;font:inherit;border:1px solid #b5c8da;border-radius:4px;background:white;color:#24364b}.screenshot .field-label{position:absolute;display:flex;align-items:center;margin:0;padding:0;gap:5px}.screenshot .field-label input:not([type=checkbox]):not([type=radio]),.screenshot .field-label select{width:100%;height:100%;min-width:0;max-width:100%;padding:2px 6px;margin:0;font-size:var(--field-font,14px);border-radius:4px}.kind-checkbox{display:flex;align-items:center;gap:7px}.kind-checkbox input{width:auto;accent-color:var(--accent)}.screenshot .kind-checkbox input{width:100%;height:100%;margin:0;accent-color:var(--accent)}input[aria-invalid=true],select[aria-invalid=true],.radio-group[aria-invalid=true]{outline:2px solid #bc4431}.radio-label{display:flex;gap:10px;align-items:center;padding:12px 0}.radio-label input{accent-color:var(--accent)}.screen-radio{margin:0;padding:0 10px;cursor:pointer;background:transparent}.screen-radio input{width:clamp(12px,1.8vw,22px);height:clamp(12px,1.8vw,22px);margin:0}.radio-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;height:100%;background:#ffffffed}.radio-group label{display:flex;align-items:center;gap:6px;margin:2px;font-size:var(--field-font,13px)}.radio-group input{width:auto;padding:0;accent-color:var(--accent)}.hotspot{opacity:0;margin:0;border:0;padding:0;min-width:0;min-height:0}.hotspot:focus-visible{opacity:.65;outline:3px solid #005ca9}.choice-button{display:block;margin:6px 0}.message{white-space:pre-wrap;line-height:1.8}.template-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.template-cards p{border-top:3px solid var(--accent);background:#f2f7fb;padding:18px}.dialog-bubble{background:#edf3fa;border-radius:10px;padding:16px;max-width:80%;white-space:pre-wrap}.dialog-bubble.reply{margin-left:auto;background:var(--accent);color:white}.terminal-screen{align-items:center;justify-content:center;overflow:auto}.completion-card{max-width:750px;width:100%;max-height:100%;overflow:auto;text-align:center;background:white;border:1px solid #d1dfeb;border-top:4px solid var(--accent);border-radius:7px;padding:28px 32px}.completion-title{font-size:25px;line-height:1.3;color:var(--heading-color);margin:12px auto 16px;overflow-wrap:anywhere}.completion-kicker{font-size:10px;letter-spacing:1px;color:#7890a6;font-weight:600}.completion-description{white-space:pre-wrap;font-size:14px;line-height:1.7;margin:12px 0;color:var(--text-color)}.completion-icon{display:grid;place-items:center;margin:0 auto 18px;width:52px;height:52px;border-radius:50%;background:#edf5fc;color:var(--accent);font-size:28px}.intro-logo{max-width:180px;max-height:60px;margin-bottom:18px}.completion-metrics{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin:20px 0}.completion-metrics span{background:#f2f7fb;padding:8px 13px;font-size:12px;border:1px solid #dae7f2;border-radius:4px}.completion-hint,.finish-status{font-size:11px;color:#7890a6;line-height:1.7;margin-top:18px}.finish-status:empty{display:none}.finish-status.failure{color:#a33e2d;background:#fff0ec;padding:9px}.finish-button{display:block;margin:20px auto 0;min-width:170px}.screen-tools .fullscreen-button{display:block}#screen:fullscreen{background:#102137;padding:8px 8px 40px}.screen-tools:fullscreen{display:flex}#session-warning{font-size:11px;padding:6px 10px;background:#fff7df;color:#7c652e;max-height:10vh;overflow:auto;flex-shrink:0}#session-warning[hidden]{display:none}@media(max-width:600px){body{padding:8px;gap:6px}main{gap:6px}.course-header{gap:6px}.course-header h1{font-size:11px}.error-counter{font-size:10px}.task-banner{padding:7px 9px;gap:8px}.task-label{font-size:11px;padding-right:8px}#task{font-size:12px}.segmented-progress{gap:2px}.media-viewport{padding:3px}.navigation button{font-size:11px;min-width:90px;padding:7px 12px}.screen-tools{gap:5px;max-width:calc(100% - 100px)}.page-caption{display:none}.screen-tools button{font-size:10px}.positioned-options button{font-size:clamp(9px,2.7vw,15px)!important;padding:2px}.video-options{padding:6px;gap:6px}.video-options .choice-button{min-width:100px;font-size:11px}.controls{padding:15px}.completion-card{padding:20px 16px}.completion-title{font-size:21px}.completion-description{font-size:12px}.completion-metrics{margin:12px 0}.completion-hint{margin-top:12px}.finish-button{margin-top:14px}}

html{overflow:auto}body{overflow:auto}.task-banner{align-items:flex-start}
#task{display:block;-webkit-line-clamp:unset;overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere}
#more-task{display:none!important}#screen.content-screen{min-height:180px}
.hotspot{opacity:1;color:transparent;background:rgba(0,92,169,.08);border:1px solid rgba(0,92,169,.65);border-radius:4px;animation:area-glow 2.8s ease-in-out infinite}
.screenshot .field-label{border:1px solid rgba(0,92,169,.65);border-radius:4px;animation:area-glow 2.8s ease-in-out infinite}
.hotspot:focus-visible{opacity:1;color:transparent}
.hotspot:hover,.screenshot .field-label:focus-within{animation:none;box-shadow:0 0 0 2px rgba(0,92,169,.3)}
@keyframes area-glow{0%,100%{box-shadow:0 0 0 0 rgba(0,92,169,.08)}50%{box-shadow:0 0 0 3px rgba(0,92,169,.28)}}
@media(prefers-reduced-motion:reduce){.hotspot,.screenshot .field-label{animation:none;box-shadow:0 0 0 1px rgba(0,92,169,.25)}}

.navigation.guide-navigation{left:0;right:0;max-width:100%;justify-content:center}
.learner-guide h2{color:var(--heading-color);font-size:clamp(22px,3vw,34px);margin:0 0 5px}
.guide-subtitle{margin:0 0 20px;color:#51677e}
.guide-layout{display:grid;grid-template-columns:minmax(230px,1fr) minmax(260px,1.15fr);gap:25px;align-items:start}
.guide-marked{position:relative}
.guide-marker{position:absolute;left:-15px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--accent);color:white;border:2px solid white;box-shadow:0 1px 4px #183e6240;font:700 12px Arial,sans-serif;z-index:2}
.guide-demo-top .guide-marked{padding-left:16px}
.guide-demo-top .guide-marker{left:-10px}
.guide-demo small.guide-marked{display:block;padding-left:16px}
.guide-progress{margin-top:18px!important}
.guide-demo{border:1px solid #c9d9e9;border-radius:10px;padding:20px;background:#f5f9fd;position:sticky;top:0}
.guide-demo-top{display:flex;justify-content:space-between;font-size:11px;color:#526c86;margin:10px 0 14px}
.guide-progress{display:flex;gap:4px;margin:7px 0 14px}
.guide-progress i{height:5px;flex:1;background:#d2e1f1;border-radius:3px}
.guide-progress .complete{background:var(--accent)}
.guide-task{background:var(--accent);color:white;padding:10px;border-radius:5px}
.guide-demo h3{font-size:20px;color:var(--heading-color);margin:20px 0 12px}
.guide-demo p{margin:10px 0 5px}
.guide-field{background:white;border:1px solid #8aa4bd;border-radius:4px;padding:8px;color:#344c64}
.guide-active{margin:18px 0 12px;background:#e6f1ff;border:1px solid var(--accent);border-radius:5px;padding:10px;color:var(--accent);animation:area-glow 2.8s ease-in-out infinite;text-align:center}
.guide-error{background:#fff0ed;border:1px solid #df7878;color:#a02a24;padding:10px;border-radius:5px;margin:16px 0 10px}
.guide-list{display:grid;gap:14px}
.guide-item{display:flex;gap:10px;font-size:13px}
.guide-number{display:flex;align-items:center;justify-content:center;background:var(--accent);color:white;border-radius:5px;width:27px;height:27px;flex-shrink:0}
.guide-item strong{font-size:15px;color:var(--heading-color)}
.guide-item p{margin:3px 0 0;line-height:1.45}
.guide-note{margin:20px 0 0;font-size:12px;color:#51677e}
@media(max-width:650px){.guide-layout{grid-template-columns:1fr}.guide-demo{position:static}.guide-list{gap:12px}}
@media(prefers-reduced-motion:reduce){.guide-active{animation:none}}

.course-header[hidden],.segmented-progress[hidden]{display:none}
.business-cover{width:100%;min-height:100%;background:#fff;border:1px solid #dce5ef;border-top:4px solid var(--accent);display:flex;flex-direction:column;padding:clamp(22px,4vw,55px);text-align:left;box-shadow:0 15px 40px #153c6410}
.business-brand{border-bottom:1px solid #dde5ed;padding-bottom:24px;min-height:75px}
.business-logo{display:block;width:clamp(200px,27vw,340px);max-width:100%;height:auto}
.business-center{flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(30px,5vh,65px) 0;gap:22px}
.business-eyebrow{font-size:11px;letter-spacing:.18em;color:#56718b;font-weight:600}
.business-title{font-size:clamp(26px,4vw,50px);line-height:1.15;font-weight:600;letter-spacing:-.025em;color:var(--heading-color);max-width:1000px;margin:0;overflow-wrap:anywhere}
.business-description{font-size:14px;line-height:1.7;color:#64778a;max-width:700px;margin:0;white-space:pre-wrap}
.business-start{min-width:185px;padding:13px 32px;border-radius:3px;font-size:15px;font-weight:600;margin-top:7px}
.business-bottom{border-top:1px solid #dde5ed;padding-top:20px;display:flex;justify-content:space-between;gap:15px;font-size:10px;letter-spacing:.06em;color:#73869a}
@media(max-width:600px){.business-bottom{flex-direction:column;text-align:center}.business-center{gap:18px}.business-brand{padding-bottom:18px}}
`;
const markup='<header class="course-header"><img id="course-logo" hidden alt="Логотип"><h1 id="title"></h1><span id="errors" class="error-counter" role="status"></span></header><main><div id="course-progress" class="segmented-progress" role="group"></div><section id="task-banner" class="task-banner" aria-label="Задание"><strong class="task-label">Задание</strong><h2 id="task-title" hidden></h2><p id="task"></p><button id="more-task" hidden type="button" aria-expanded="false">Полностью</button></section><div id="work-bar" hidden><span id="step"></span></div><div id="feedback" role="status" aria-live="polite"></div><section id="screen"></section><div id="session-warning" role="status" hidden></div></main>';

root.ScenaPlayer={run,css,markup};
})(typeof window!=='undefined'?window:globalThis);
