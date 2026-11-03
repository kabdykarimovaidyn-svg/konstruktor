/* Local project library. v2 migrates the old single-project record without data loss. */
(function(root){
'use strict';
let database;const LIMIT=250*1024*1024;
function summary(p,extra={}){return {id:p.id,title:p.title,createdAt:p.createdAt||Date.now(),updatedAt:p.updatedAt||Date.now(),steps:p.steps.length,sections:p.groups.length,bytes:size(p),...extra};}
function db(){return database||(database=new Promise((resolve,reject)=>{
 if(!root.indexedDB)return reject(Error('Хранение проектов недоступно. Скачайте файл проекта.'));
 const r=indexedDB.open('scena-author-v2',2);
 r.onupgradeneeded=e=>{const d=r.result,tx=r.transaction;for(const name of ['library','summaries','meta'])if(!d.objectStoreNames.contains(name))d.createObjectStore(name);
  if(e.oldVersion<2&&d.objectStoreNames.contains('projects')){const old=tx.objectStore('projects').get('current');old.onsuccess=()=>{if(old.result?.id){const p=old.result;p.createdAt=p.createdAt||Date.now();p.updatedAt=p.updatedAt||Date.now();tx.objectStore('library').put(p,p.id);tx.objectStore('summaries').put(summary(p),p.id);tx.objectStore('meta').put(p.id,'active');}};}
 };
 r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Закройте другие вкладки конструктора и обновите страницу.'));
}));}
async function readStore(store,key){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function list({trash=false}={}){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('summaries').objectStore('summaries').getAll();r.onsuccess=()=>resolve(r.result.filter(p=>trash?!!p.deletedAt:!p.deletedAt).sort((a,b)=>b.updatedAt-a.updatedAt));r.onerror=()=>reject(r.error);});}
async function load(id){if(!id)id=await readStore('meta','active');if(!id)return undefined;const meta=await readStore('summaries',id);if(meta?.deletedAt)return undefined;return readStore('library',id);}
async function write(stores,fn){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(stores,'readwrite');fn(tx);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Нет места для сохранения проекта.'));tx.onabort=()=>reject(tx.error||Error('Не удалось сохранить проект.'));});}
async function save(project,{active=true}={}){const p=structuredClone(project);p.createdAt=p.createdAt||Date.now();p.updatedAt=Date.now();await write(['library','summaries','meta'],tx=>{tx.objectStore('library').put(p,p.id);tx.objectStore('summaries').put(summary(p),p.id);if(active)tx.objectStore('meta').put(p.id,'active');});return p.updatedAt;}
async function trash(id){const item=await readStore('summaries',id);if(!item)return;await write(['summaries','meta'],tx=>{tx.objectStore('summaries').put({...item,deletedAt:Date.now()},id);const r=tx.objectStore('meta').get('active');r.onsuccess=()=>{if(r.result===id)tx.objectStore('meta').delete('active');};});}
async function restore(id){const item=await readStore('summaries',id);if(item)await write(['summaries'],tx=>tx.objectStore('summaries').put({...item,deletedAt:null},id));}
async function profile(value){if(value){await write(['meta'],tx=>tx.objectStore('meta').put({name:String(value.name||'Автор курса').slice(0,80)},'profile'));}return await readStore('meta','profile')||{name:'Автор курса'};}
const size=p=>Object.values(p.assets||{}).reduce((n,a)=>n+a.blob.size,0);
function checkSize(p,additional=0){if(size(p)+additional>LIMIT)throw Error('Лимит проекта — 250 МБ медиа. Уменьшите размер видео.');}
function base64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
async function file(p){p=structuredClone(p);checkSize(p);const data={...p,assets:{}};for(const [path,a]of Object.entries(p.assets))data.assets[path]={name:a.name,type:a.blob.type,base64:await base64(a.blob)};return new Blob([JSON.stringify(data)],{type:'application/json'});}
async function read(file){if(file.size>360*1024*1024)throw Error('Файл проекта слишком большой.');const raw=JSON.parse(await file.text());let total=0;const assets={};for(const [path,a]of Object.entries(raw.assets||{})){if(!/^media\/[\w.-]+$/.test(path)||typeof a.base64!=='string')throw Error('Неверный файл медиа.');total+=a.base64.length*3/4;if(total>LIMIT)throw Error('Медиа превышают лимит 250 МБ.');const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));assets[path]={name:String(a.name||path),blob:new Blob([bytes],{type:String(a.type||'application/octet-stream')})};}raw.assets=assets;return ScenaModel.cleanImport(raw);}
root.ScenaStorage={load,save,list,trash,restore,profile,file,read,checkSize,size,LIMIT};
})(typeof window!=='undefined'?window:globalThis);
