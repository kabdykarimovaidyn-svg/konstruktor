const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class E{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.handlers={};this.classList={add(){}};this.value='';this.currentTime=0;this.duration=10;}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}addEventListener(k,v){this.handlers[k]=v;}focus(){}pause(){}play(){this.playCount=(this.playCount||0)+1;return Promise.resolve();}all(){return this.children.filter(c=>typeof c==='object').flatMap(c=>[c,...c.all()]);}}
const nodes=Object.fromEntries(['title','step','task','screen','feedback','lms','errors','save'].map(k=>[k,new E('div')]));const document={getElementById:k=>nodes[k],createElement:t=>new E(t),createTextNode:s=>s,addEventListener(){}};const window={addEventListener(){}};window.crypto={getRandomValues:a=>{a.fill(7);return a;}};const ctx={window,document,console,Date,TextEncoder,Uint8Array,Uint32Array,DataView};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../modules/scorm/player.js'),'utf8'),ctx);

const crypto=require('node:crypto'),F=require('../modules/scorm/fields.js');require('../modules/scorm/scorm.js');
const course={id:'matching',title:'Регистрация',start:'a',steps:[{id:'a',title:'secret-file.png',type:'form',next:'b',fields:[{id:'p',label:'Пароль',rule:'any',inputType:'password'}]},{id:'b',type:'form',next:'end',fields:[{id:'confirm',label:'Повтор',rule:'match',match:{stepId:'a',fieldId:'p'}}]},{id:'end',type:'end'}]};
assert.equal(F.issues(course).length,0);assert.equal(ScenaSCORM.validate(course),true);
assert.equal(F.candidates(course,'b','confirm')[0].fieldId,'p');
let saved,finishOK=false,calls=0,closes=0;window.close=()=>closes++;window.parent=window;
const bridge={connected:true,get:()=>'',save:s=>{saved=JSON.parse(JSON.stringify(s));return true;},finish:()=>{calls++;return finishOK;}};
let player=window.ScenaPlayer.run(course,()=>bridge);const all=t=>nodes.screen.all().filter(e=>e.tagName===t.toUpperCase()),submit=()=>all('form')[0].onsubmit({preventDefault(){}});
assert.equal(nodes.step.textContent,'Практическое задание');assert.equal(all('input')[0].type,'password');
all('input')[0].value='Тест Secret  ';submit();assert.equal(player.getState().step,'b');
assert.equal(saved.refs['a/p'],crypto.createHash('sha256').update(saved.salt+'\0Тест Secret  ').digest('hex'));
assert.equal(JSON.stringify(saved).includes('Secret'),false);
const suspended=JSON.stringify(saved);player=window.ScenaPlayer.run(course,()=>({...bridge,get:()=>suspended}));
for(const value of ['Тест Secret','тест Secret  ']){all('input')[0].value=value;submit();assert.equal(player.getState().step,'b');}
assert.equal(nodes.errors.textContent,'Ошибок: 2');all('input')[0].value='Тест Secret  ';submit();assert.equal(player.getState().done,true);
assert.equal(all('h2')[0].textContent,course.title);let finish=all('button').find(e=>e.textContent==='Завершить');finish.onclick();assert.equal(closes,0);assert.equal(finish.disabled,false);finishOK=true;finish.onclick();finish.onclick();assert.equal(calls,2);assert.equal(closes,1);
const same=structuredClone(course);same.steps=[{id:'a',type:'form',next:'end',fields:[{id:'p',label:'Пароль',rule:'any'},{id:'c',label:'Повтор',rule:'match',match:{stepId:'a',fieldId:'p'}}]},course.steps[2]];assert.equal(F.issues(same).length,0);player=window.ScenaPlayer.run(same,()=>({...bridge,get:()=>''}));all('input')[0].value='A';all('input')[1].value='a';submit();assert.equal(player.getState().step,'a');all('input')[1].value='A';submit();assert.equal(player.getState().step,'end');
const bad=structuredClone(course);bad.steps[1].fields[0].match.fieldId='missing';assert.match(F.issues(bad)[0].message,/исходное/);assert.throws(()=>ScenaSCORM.validate(bad),/исходное/);
const branch=structuredClone(course);branch.start='choice';branch.steps.unshift({id:'choice',type:'choice',options:[{label:'A',next:'a'},{label:'B',next:'b'}]});assert.match(F.issues(branch)[0].message,/пропущено/);
console.log('Сопоставление: точность, регистр, пробелы, SHA-256, восстановление, поля одного экрана, ветки и повтор завершения проверены.');
