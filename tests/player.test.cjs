// Runs the exported Gmail player against a minimal DOM and a recording LMS API.
// This verifies event/state behavior, not browser layout or media playback.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes={};
class Element {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.value='';this.className='';this.hidden=false;this.handlers={};this.classList={add(){},remove(){}};}
 set id(v){this._id=v;nodes[v]=this;} get id(){return this._id;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(key,value){this[key]=value;}
 removeAttribute(key){delete this[key];}
 focus(){}
 addEventListener(key,fn){this.handlers[key]=fn;}
 querySelector(){return this.walk().find(n=>n.tagName==='INPUT'&&n.checked)||null;}
 walk(){return this.children.filter(c=>typeof c==='object').flatMap(c=>[c,...c.walk()]);}
}
const document={getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createTextNode:text=>text,addEventListener(){},visibilityState:'visible'};
for(const id of ['title','task','step','screen','feedback','lms','save','errors']){const el=new Element('div');el.id=id;}
const data={},calls=[];const window={API:{LMSInitialize:()=> 'true',LMSGetValue:k=>data[k]||'',LMSSetValue:(k,v)=>{data[k]=v;calls.push([k,v]);return 'true';},LMSCommit:()=> 'true',LMSFinish:()=> 'true'},addEventListener(){}};window.parent=window;
const context={window,document,console,Date};vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);vm.runInContext(fs.readFileSync(process.argv[3],'utf8'),context);
function elements(tag){return nodes.screen.walk().filter(e=>e.tagName===tag.toUpperCase());}
function submit(){elements('form')[0].onsubmit({preventDefault(){}});}
function current(){return JSON.parse(data['cmi.suspend_data']);}
assert.equal(current().step,'address');elements('input')[0].value='gmai.com';submit();assert.equal(current().step,'address');assert.equal(current().errors,1);
elements('input')[0].value='HTTPS://GMAIL.COM/';submit();assert.equal(current().step,'register');
elements('button').find(b=>b.textContent==='Далее / войти').onclick();assert.equal(current().errors,2);assert.equal(current().step,'register');
elements('button').find(b=>b.textContent==='Создать аккаунт').onclick();assert.equal(current().step,'type');
elements('button').find(b=>b.textContent==='Для ребёнка').onclick();assert.equal(current().errors,3);assert.equal(current().step,'type');
elements('button').find(b=>b.textContent==='Для личного использования').onclick();elements('input')[0].value='Айдын';submit();assert.equal(current().step,'mailtype');
submit();assert.equal(current().step,'mailtype');assert.equal(current().errors,4);elements('input')[0].checked=true;submit();assert.equal(current().step,'username');
elements('input')[0].value='aidyn.practice';submit();assert.equal(current().done,true);assert.equal(current().score,60);assert.equal(data['cmi.core.lesson_status'],'completed');assert.equal(data['cmi.core.score.raw'],'60');
// Reopening the package resumes the final result without changing the score.
vm.runInContext(fs.readFileSync(process.argv[3],'utf8'),context);assert.equal(current().done,true);assert.equal(current().score,60);
console.log('Экспортированный тренажёр: неверный адрес, неверные кнопки, отсутствие выбора, правильное прохождение и восстановление результата проверены.');
