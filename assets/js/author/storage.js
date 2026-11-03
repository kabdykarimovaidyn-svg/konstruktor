/* Single-project IndexedDB persistence; portable project files include media. */
(function(root){
'use strict';
let database;const LIMIT=250*1024*1024;
function db(){return database||(database=new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(Error('Автосохранение недоступно. Скачайте файл проекта.'));const r=indexedDB.open('scena-author-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
async function load(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('projects'),r=tx.objectStore('projects').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function save(project){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('projects','readwrite');tx.objectStore('projects').put(project,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Нет места для сохранения.'));tx.onabort=()=>reject(tx.error||Error('Не удалось сохранить проект.'));});}
const size=p=>Object.values(p.assets).reduce((n,a)=>n+a.blob.size,0);
function checkSize(p,additional=0){if(size(p)+additional>LIMIT)throw Error('Лимит проекта — 250 МБ медиа. Уменьшите размер видео.');}
function base64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
async function file(p){checkSize(p);const data={...p,assets:{}};for(const [path,a]of Object.entries(p.assets))data.assets[path]={name:a.name,type:a.blob.type,base64:await base64(a.blob)};return new Blob([JSON.stringify(data)],{type:'application/json'});}
async function read(file){if(file.size>360*1024*1024)throw Error('Файл проекта слишком большой.');const raw=JSON.parse(await file.text());let total=0;const assets={};for(const [path,a]of Object.entries(raw.assets||{})){if(!/^media\/[\w.-]+$/.test(path)||typeof a.base64!=='string')throw Error('Неверный файл медиа.');total+=a.base64.length*3/4;if(total>LIMIT)throw Error('Медиа превышают лимит 250 МБ.');const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));assets[path]={name:String(a.name||path),blob:new Blob([bytes],{type:String(a.type||'application/octet-stream')})};}raw.assets=assets;return ScenaModel.cleanImport(raw);}
root.ScenaStorage={load,save,file,read,checkSize,size,LIMIT};
})(typeof window!=='undefined'?window:globalThis);
