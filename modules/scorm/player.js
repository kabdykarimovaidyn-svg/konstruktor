/* Same player runs in author preview and in the exported SCORM package. */
(function(root){
'use strict';
function run(course,runtimeFactory){
 const byId=Object.fromEntries(course.steps.map(s=>[s.id,s]));
 const api=course.preview?{connected:false,warnings:[],get:()=>'',save:()=>true,finish:()=>{}}:runtimeFactory(window);
 let state={v:2,course:course.id,step:course.start,errors:0,done:false,score:0,time:0},currentVideo=null,lastSave=0,generation=0;
 try{const v=JSON.parse(api.get('cmi.suspend_data'));if([1,2].includes(v.v)&&v.course===course.id&&byId[v.step]&&Number.isInteger(v.errors)&&v.errors>=0&&typeof v.done==='boolean'&&Number.isFinite(v.score)&&v.score>=0&&v.score<=100)state={...state,...v,done:byId[v.step].type==='end'&&v.done,time:Math.max(0,Number(v.time)||0)};}catch{}
 const $=id=>document.getElementById(id);$('title').textContent=course.title;
 function save(){if(currentVideo&&byId[state.step].type==='video'&&Number.isFinite(currentVideo.currentTime))state.time=currentVideo.currentTime;let ok=false;try{ok=api.save(state);}catch{}$('lms').textContent=course.preview?'Предпросмотр · результаты не записываются':api.connected?(ok?'Прогресс сохранён в LMS':'Не удалось сохранить прогресс в LMS. Нажмите «Сохранить».'):'Просмотр вне LMS · межсессионное сохранение недоступно';}
 function el(tag,value,parent,cls){const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);if(cls)e.className=cls;if(parent)parent.append(e);return e;}
 function button(label,fn,parent,cls){const b=el('button',label,parent,cls);b.type='button';b.onclick=fn;return b;}
 function wrong(message){state.errors++;$('feedback').textContent=course.mode==='test'?'Неверное действие. Попробуйте ещё раз.':message||byId[state.step].error||'Неверное действие. Попробуйте ещё раз.';$('feedback').className='error';save();}
 function go(id){if(!byId[id]){$('feedback').textContent='Переход не настроен. Обратитесь к автору курса.';return;}if(currentVideo){currentVideo.pause();currentVideo=null;}state.step=id;state.time=0;save();render();}
 function overlay(e,r){if(r){e.style.position='absolute';e.style.left=r.x+'%';e.style.top=r.y+'%';e.style.width=r.w+'%';e.style.height=r.h+'%';}}
 function fit(e){e.onloadedmetadata=()=>{if(Number.isFinite(e.duration)&&e.duration>0){e.currentTime=Math.max(0,e.duration-.04);e.pause();}};e.onseeked=()=>e.pause();}
 function render(){
  generation++;const version=generation;const s=byId[state.step],area=$('screen');area.replaceChildren();$('feedback').textContent='';$('feedback').className='';$('task').textContent=s.instruction||'';$('step').textContent=s.title||s.id;$('errors').textContent='Ошибок: '+state.errors;
  if(s.type==='return'){
   if(s.penalty!==false)state.errors++;
   // Return nodes are explicit in the graph; target must be a choice, so no automatic loop.
   go(s.next);return;
  }
  if(s.type==='end'){state.done=true;state.score=Math.max(0,100-state.errors*(Number.isFinite(course.penalty)?course.penalty:10));el('h2','Курс завершён',area);el('p',s.body||'Все обязательные действия выполнены.',area);el('p','Ошибок: '+state.errors+' · Результат: '+state.score+' из 100',area);save();button('Сохранить результат',save,area);return;}
  const stage=el('div',undefined,area,'stage');let controls=stage;
  if(s.background){const img=el('img',undefined,stage);img.src=s.background;img.alt=s.title||'Учебный экран';img.onerror=()=>{$('feedback').textContent='Не удалось загрузить скриншот.';};stage.classList.add('screenshot');}
  else{controls=el('div',undefined,stage,'controls');}
  const backgroundVideo=s.video&&byId[s.video];
  if(s.type==='choice'&&backgroundVideo){stage.classList.add('video-stage');const v=el('video',undefined,stage);v.src=backgroundVideo.src;v.preload='auto';v.playsInline=true;v.muted=true;v.setAttribute('aria-label','Последний кадр ситуации');fit(v);v.onerror=()=>{$('feedback').textContent='Не удалось загрузить последний кадр видео.';};controls=el('div',undefined,stage,'video-options');}
  if(s.type==='message'){
   el('p',s.body||'',controls,'message');button(s.button||'Продолжить',()=>go(s.next),controls);return;
  }
  if(s.type==='video'){
   stage.classList.add('video-stage');stage.replaceChildren();const v=el('video',undefined,stage);v.controls=true;v.playsInline=true;v.preload='metadata';v.src=s.src;currentVideo=v;
   const resume=state.time;v.onloadedmetadata=()=>{if(version!==generation)return;if(resume>0&&resume<v.duration)v.currentTime=resume;};
   v.ontimeupdate=()=>{if(version===generation&&Date.now()-lastSave>5000){lastSave=Date.now();save();}};
   v.onerror=()=>{$('feedback').textContent='Видео не загрузилось. Проверьте файл или кодек.';};
   v.onended=()=>{if(version!==generation)return;if(s.options){const choices=el('div',undefined,stage,'video-options');s.options.forEach(o=>button(o.label,()=>o.wrong?wrong(o.error):go(o.next),choices));}else go(s.next);};
   const promise=v.play();if(promise?.catch)promise.catch(()=>{});return;
  }
  function options(parent){s.options.forEach(o=>{const b=button(o.label,()=>o.wrong?wrong(o.error):go(o.next),parent,'choice-button');if(s.background&&o.rect){overlay(b,o.rect);b.classList.add('hotspot');}});}
  if(s.type==='choice'){
   if(s.selectBeforeContinue){const form=el('form',undefined,controls);s.options.forEach((o,i)=>{const label=el('label',undefined,form,'radio-label');const input=el('input',undefined,label);input.type='radio';input.name='choice';input.value=String(i);label.append(document.createTextNode(o.label));});const b=el('button','Далее',form);b.type='submit';form.onsubmit=e=>{e.preventDefault();const checked=form.querySelector('input:checked');if(!checked){wrong(s.error);return;}const o=s.options[Number(checked.value)];if(o.wrong)wrong(o.error);else go(o.next);};}else options(controls);
  }else if(s.type==='input'||s.type==='form'){
   const fields=s.type==='input'?[{id:'single',label:s.label||'Введите значение',expected:s.expected,rule:s.rule||'exact',caseSensitive:s.caseSensitive,rect:s.rect,placeholder:s.placeholder}]:s.fields;
   const form=el('form',undefined,controls);form.id='step-form';const inputs=[];
   fields.forEach(f=>{const label=el('label',s.background?'':f.label,form,'field-label');const input=el('input',undefined,label);input.type='text';input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',f.label||'Поле ввода');input.placeholder=f.placeholder||'';if(s.background)overlay(input,f.rect);inputs.push({f,input});});
   const submit=el('button',s.button||'Далее',s.background?area:form);submit.type='submit';if(s.background)submit.setAttribute('form','step-form');
   if(s.background&&s.submitRect){const hit=el('button',s.button||'Далее',stage,'hotspot');hit.type='submit';hit.setAttribute('form','step-form');overlay(hit,s.submitRect);}
   form.onsubmit=e=>{e.preventDefault();const failed=inputs.find(({f,input})=>{let v=input.value.trim(),expected=String(f.expected||'').trim();if(!f.caseSensitive){v=v.toLocaleLowerCase();expected=expected.toLocaleLowerCase();}if(f.rule==='any')return !v;if(f.rule==='url'){v=v.replace(/^https?:\/\//,'').replace(/\/$/,'');expected=expected.replace(/^https?:\/\//,'').replace(/\/$/,'');}return v!==expected;});inputs.forEach(({input})=>input.removeAttribute('aria-invalid'));if(failed){failed.input.setAttribute('aria-invalid','true');failed.input.focus();wrong(s.error||'Проверьте поле «'+failed.f.label+'».');}else go(s.next);};
  }else if(s.type==='click'){
   const hit=button(s.label||'Продолжить',()=>go(s.next),stage,s.background?'hotspot':'');if(s.background)overlay(hit,s.rect);
  }
  stage.addEventListener('click',e=>{if(e.target===stage||e.target.tagName==='IMG')wrong();});
 }
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});window.addEventListener('pagehide',e=>{if(e.persisted)save();else api.finish(state);});$('save').onclick=save;render();save();
 return {getState:()=>({...state}),destroy(){generation++;if(currentVideo)currentVideo.pause();api.finish(state);}};
}
const css=`*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#223449;font:15px/1.5 system-ui}header,main,footer{max-width:1100px;margin:auto;padding:18px 24px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid #dce3eb}h1{font-size:21px}h2{font-size:18px}#task{padding:16px;background:#edf4fb;border-left:3px solid #005ca9}#task:empty{display:none}.stage{position:relative;background:white;border:1px solid #dce3eb;border-radius:4px;overflow:hidden}.controls{padding:24px}.stage.screenshot img{display:block;width:100%;height:auto}.message{white-space:pre-wrap}.video-stage{background:#111c29;aspect-ratio:16/9}.video-stage video{display:block;width:100%;height:100%;object-fit:contain}.video-options{position:absolute;left:20px;right:20px;bottom:65px;background:#112b48ce;padding:18px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center}.video-options .choice-button{min-width:180px}label{display:block;margin:12px 0}.field-label input{display:block;padding:10px;font:inherit;max-width:100%;width:420px;border:1px solid #b4c3d4;border-radius:3px;background:#fff}.screenshot .field-label input{width:auto;margin:0;min-height:0;padding:2px 6px;font-size:clamp(10px,1.5vw,16px)}input[aria-invalid=true]{outline:2px solid #bd3a2b}.radio-label{display:flex;gap:10px}button{font:inherit;background:#005ca9;color:white;border:1px solid #005ca9;border-radius:3px;cursor:pointer;padding:10px 16px;margin:5px}button:hover{background:#00457e}button:focus-visible,input:focus-visible{outline:3px solid #6aa8df;outline-offset:2px}.hotspot{opacity:0;margin:0;border:0;padding:0}.hotspot:focus-visible{opacity:.7;outline:3px solid #005ca9}.screenshot form{margin:0}.screenshot .field-label{margin:0}.choice-button{display:block}#feedback{min-height:32px;margin-top:15px}.error{padding:14px;background:#fff1ef;color:#a53024;border-left:3px solid #b83e2f}footer{font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}footer button{font-size:12px}#lms{color:#60748a}#errors{white-space:nowrap}#screen>h2,#screen>p{padding:0 20px}@media(max-width:600px){header,main,footer{padding:12px}header{flex-wrap:wrap}.video-options{left:5px;right:5px;bottom:40px;padding:8px;gap:5px}.video-options button{font-size:12px;padding:8px;margin:0}.video-options .choice-button{min-width:0}footer{flex-wrap:wrap}}`;
root.ScenaPlayer={run,css};
})(typeof window!=='undefined'?window:globalThis);
