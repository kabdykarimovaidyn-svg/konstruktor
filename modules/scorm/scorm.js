/* SCORM module v1: public contract in README.md. No editor dependencies. */
(function(root){
'use strict';
const enc=new TextEncoder();
function escapeXML(value){return String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function validate(course){
 if(!course||!/^[-a-zA-Z0-9_]{1,80}$/.test(course.id)||!course.title)throw Error('Нужны ID курса и название.');
 if(!Array.isArray(course.steps)||!course.steps.length||course.steps.length>500)throw Error('Нужно от 1 до 500 шагов.');
 const ids=new Set();let endings=0;
 course.steps.forEach(s=>{if(!/^[-a-zA-Z0-9_]{1,80}$/.test(s.id)||ids.has(s.id))throw Error('ID шагов должны быть уникальными.');ids.add(s.id);if(!['input','choice','click','video','form','message','return','end','intro','slide'].includes(s.type))throw Error('Неизвестный тип шага.');if(s.type==='end')endings++;});
 if(!ids.has(course.start)||!endings)throw Error('Нужны стартовый и финальный шаги.');
 const links=s=>[...(s.options?.filter(o=>!o.wrong).map(o=>o.next).filter(Boolean)||(s.next?[s.next]:[])),...(s.jumps||[]).map(j=>j.next)];
 for(const s of course.steps){
  if(s.type==='form'&&(!Array.isArray(s.fields)||!s.fields.length))throw Error('Добавьте поле ввода: '+s.id);
  
  if(s.type==='form'&&s.background&&s.fields.some(f=>!f.rect))throw Error('Выделите области всех полей на скриншоте.');
  if(s.type==='return'&&!course.steps.some(t=>t.id===s.next&&t.type==='choice'))throw Error('Возврат должен вести к выбору.');
  if(s.video&&!course.steps.some(t=>t.id===s.video&&t.type==='video'&&t.src))throw Error('Для последнего кадра нужно видео.');
  if(s.type==='input'&&(typeof s.expected!=='string'||!s.expected.trim()))throw Error('Нужно правильное значение поля.');
  if(s.type==='choice'&&(!Array.isArray(s.options)||!s.options.length||!s.options.some(o=>!o.wrong)))throw Error('Нужен хотя бы один правильный вариант.');
  if(s.options?.some(o=>!o.label||(!o.wrong&&!o.next)))throw Error('У варианта нет подписи или перехода.');
  if(s.type==='video'&&!s.src)throw Error('Не загружено видео: '+s.id);
  if(s.type!=='end'&&!links(s).length)throw Error('Нет перехода: '+s.id);
  for(const id of links(s)){if(!ids.has(id))throw Error('Переход на несуществующий шаг: '+id);}
  if(s.type==='slide'&&!s.background)throw Error('Отсутствует слайд презентации.');
  if(s.type==='choice'&&s.showMode==='time'&&(!Number.isFinite(Number(s.showAt))||Number(s.showAt)<0))throw Error('Укажите секунду появления кнопок.');
  if(s.jumps?.some(j=>!j.label||!j.rect||!s.background||!course.steps.some(t=>t.id===j.next))&&course.previewScope!=='step')throw Error('Настройте область перехода и целевой шаг.');
  if(s.type==='click'&&!s.rect&&!s.jumps?.length)throw Error('Нужна область нажатия.');
  if([s.rect,s.submitRect,...(s.fields||[]).map(f=>f.rect),...(s.options||[]).map(o=>o.rect),...(s.jumps||[]).map(j=>j.rect)].filter(Boolean).some(r=>!['x','y','w','h'].every(k=>Number.isFinite(r[k]))||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>100.001||r.y+r.h>100.001))throw Error('Область должна быть внутри экрана (0–100%).');
 }
 const reachable=new Set();function walk(id){if(reachable.has(id))return;reachable.add(id);links(course.steps.find(s=>s.id===id)).forEach(walk);}walk(course.start);
 if(!course.steps.some(s=>s.type==='end'&&reachable.has(s.id)))throw Error('Из начала нельзя достичь завершения.');
 // Reject reachable dead-end loops: every reachable step needs a route to an end.
 const canEnd=new Set(course.steps.filter(s=>s.type==='end').map(s=>s.id));let changed=true;
 while(changed){changed=false;for(const s of course.steps)if(!canEnd.has(s.id)&&links(s).some(id=>canEnd.has(id))){canEnd.add(s.id);changed=true;}}
 if([...reachable].some(id=>!canEnd.has(id)))throw Error('В сценарии есть ветка без пути к завершению.');
 const fields=root.ScenaFields||(typeof require==='function'?require('./fields.js'):null);if(!fields)throw Error('Модуль проверки полей не загружен.');const issues=fields.issues(course);if(issues.length)throw Error(issues[0].message);
 return true;
}
function runtime(win){
 let api=null,active=false,finished=false,started=Date.now();const warnings=[];
 function find(w){for(let i=0;w&&i<50;i++){try{if(w.API)return w.API;if(w===w.parent)break;w=w.parent;}catch{break;}}return null;}
 api=find(win);if(!api){try{api=find(win.opener);}catch{}}
 function call(method,...args){try{const result=api[method](...args);if(String(result)==='false')warnings.push(method+' отклонён LMS');return result;}catch{warnings.push(method+' недоступен');return 'false';}}
 if(api)active=String(call('LMSInitialize',''))==='true';
 function get(key){return active?String(call('LMSGetValue',key)||''):'';}
 function set(key,value){return !active||String(call('LMSSetValue',key,String(value)))==='true';}
 const initialStatus=get('cmi.core.lesson_status');
 if(active&&!['completed','passed','failed'].includes(initialStatus)){set('cmi.core.lesson_status','incomplete');call('LMSCommit','');}
 function time(){const total=Math.min(35999999,Math.floor((Date.now()-started)/10));return String(Math.floor(total/360000)).padStart(4,'0')+':'+String(Math.floor(total/6000)%60).padStart(2,'0')+':'+String(Math.floor(total/100)%60).padStart(2,'0')+'.'+String(total%100).padStart(2,'0');}
 return {get,save(state){if(finished)return true;const data=JSON.stringify(state);if(data.length>4096)throw Error('Слишком много данных прогресса.');if(!active)return !api;
 const results=[set('cmi.suspend_data',data),set('cmi.core.lesson_location',state.step),set('cmi.core.session_time',time()),set('cmi.core.exit',state.done?'':'suspend')];
 if(state.done){results.push(set('cmi.core.score.min',0),set('cmi.core.score.max',100),set('cmi.core.score.raw',state.score),set('cmi.core.lesson_status','completed'));}
 results.push(String(call('LMSCommit',''))==='true');return results.every(Boolean);},finish(state){if(finished)return true;if(!this.save(state))return false;if(active&&String(call('LMSFinish',''))!=='true')return false;finished=true;active=false;return true;},get connected(){return active;},get warnings(){return warnings.slice();},initialStatus};
}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function concat(parts){const length=parts.reduce((n,p)=>n+p.length,0);if(length>0xffffffff)throw Error('Пакет слишком большой для ZIP32.');const out=new Uint8Array(length);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function header(size,values){const a=new Uint8Array(size),v=new DataView(a.buffer);values.forEach(([offset,value,width])=>width===2?v.setUint16(offset,value,true):v.setUint32(offset,value,true));return a;}
function zip(files){if(files.length>65535)throw Error('Слишком много файлов.');const local=[],central=[];let offset=0;
 for(const [path,data] of files){const name=enc.encode(path),bytes=typeof data==='string'?enc.encode(data):data,crc=crc32(bytes);if(bytes.length>0xffffffff)throw Error('Файл слишком большой.');const h=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,crc,4],[18,bytes.length,4],[22,bytes.length,4],[26,name.length,2]]);local.push(h,name,bytes);central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,crc,4],[20,bytes.length,4],[24,bytes.length,4],[28,name.length,2],[42,offset,4]]),name);offset+=h.length+name.length+bytes.length;}
 const directory=concat(central),end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,directory.length,4],[16,offset,4]]);return concat([...local,directory,end]);
}
async function build(course,assets={}){
 const player=(root.ScenaPlayer||((typeof require==='function')&&(require('./player.js'),root.ScenaPlayer))).run,css=root.ScenaPlayer.css;
 validate(course);const clone=JSON.parse(JSON.stringify(course)),files=[];const allowed=new Set(Object.keys(assets));
 for(const path of allowed){if(!/^media\/[a-zA-Z0-9_.-]+$/.test(path))throw Error('Небезопасный путь: '+path);const input=assets[path];const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):typeof input?.arrayBuffer==='function'?new Uint8Array(await input.arrayBuffer()):null;if(!bytes||!bytes.length)throw Error('Пустой или неподдерживаемый файл: '+path);files.push([path,bytes]);}
 if(clone.theme?.logo&&!allowed.has(clone.theme.logo))throw Error('Логотип не включён в пакет.');
 for(const s of clone.steps)for(const key of ['src','background'])if(s[key]&&!allowed.has(s[key]))throw Error('Медиафайл не включён в пакет: '+s[key]);
 const data=JSON.stringify(clone).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const html='<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeXML(course.title)+'</title><link rel="stylesheet" href="player.css">'+root.ScenaPlayer.markup+'<script src="course.js"></script><script src="player.js"></script></html>';
 files.push(['index.html',html],['player.css',css],['course.js','window.SCENA_COURSE='+data+';'],['player.js','('+player.toString()+')(window.SCENA_COURSE,'+runtime.toString()+');']);
 const paths=['index.html','player.css','course.js','player.js',...allowed];
 const manifest='<?xml version="1.0" encoding="UTF-8"?><manifest identifier="'+escapeXML(course.id)+'" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="ORG"><organization identifier="ORG"><title>'+escapeXML(course.title)+'</title><item identifier="ITEM" identifierref="SCO"><title>'+escapeXML(course.title)+'</title></item></organization></organizations><resources><resource identifier="SCO" type="webcontent" adlcp:scormtype="sco" href="index.html">'+paths.map(p=>'<file href="'+escapeXML(p)+'"/>').join('')+'</resource></resources></manifest>';
 files.unshift(['imsmanifest.xml',manifest]);return new Blob([zip(files)],{type:'application/zip'});
}
function preview(course,assets={}){
 validate(course);const clone=JSON.parse(JSON.stringify(course));clone.preview=true;
 for(const step of clone.steps)for(const key of ['src','background'])if(step[key]){if(!assets[step[key]])throw Error('Не найден медиафайл: '+step[key]);step[key]=assets[step[key]];}
 if(clone.theme?.logo){if(!assets[clone.theme.logo])throw Error('Не найден логотип.');clone.theme.logo=assets[clone.theme.logo];}
 const json=JSON.stringify(clone).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Предпросмотр</title><style>'+root.ScenaPlayer.css+'</style>'+root.ScenaPlayer.markup+'<script>('+root.ScenaPlayer.run.toString()+')('+json+','+runtime.toString()+');</script></html>';
}
root.ScenaSCORM=Object.freeze({version:'4.0.0',validate,build,runtime,preview});
})(typeof window!=='undefined'?window:globalThis);
