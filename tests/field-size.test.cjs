const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let scale=1,resize;
class E{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={setProperty(){}};this.handlers={};this.classList={add(){},toggle(){}};this.clientWidth=1000;this.clientHeight=600;}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}addEventListener(k,v){this.handlers[k]=v;}
 all(){return this.children.filter(c=>typeof c==='object').flatMap(c=>[c,...c.all()]);}
 querySelectorAll(selector){return selector==='select,input[type=text],input[type=password]'?this.all().filter(c=>c.tagName==='SELECT'||c.tagName==='INPUT'&&['text','password'].includes(c.type)):[];}
 getBoundingClientRect(){return {height:({Small:16,Tall:38,Password:20,List:14}[this['aria-label']]||600)*scale};}
}
const nodes=Object.fromEntries(['title','step','task','screen','feedback','errors'].map(k=>[k,new E('div')]));
const events={};
const document={getElementById:k=>nodes[k],createElement:t=>new E(t),createTextNode:s=>s,addEventListener(k,fn){events[k]=fn;}};
document.documentElement=new E('html');
document.documentElement.requestFullscreen=async()=>{document.fullscreenElement=document.documentElement;events.fullscreenchange();};
document.exitFullscreen=async()=>{document.fullscreenElement=null;events.fullscreenchange();};
const window={addEventListener(k,fn){if(k==='resize')resize=fn;},getComputedStyle(){return {paddingLeft:'8',paddingRight:'8',paddingTop:'8',paddingBottom:'8'};}};
const ctx={document,window,console,Date};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../modules/scorm/player.js'),'utf8'),ctx);
const fields=[{id:'small',label:'Small',rect:{x:0,y:0,w:30,h:3}},{id:'tall',label:'Tall',rect:{x:0,y:10,w:30,h:7}},{id:'pass',label:'Password',inputType:'password',rect:{x:0,y:20,w:30,h:4}},{id:'list',label:'List',kind:'select',choices:'One\nTwo',rect:{x:0,y:30,w:30,h:3}}];
window.ScenaPlayer.run({id:'font',title:'Font',start:'form',steps:[{id:'form',type:'form',background:'screen.png',fields,next:'end'},{id:'end',type:'end'}]},()=>({connected:false,warnings:[],get:()=>'',save:()=>true}));
const inputs=nodes.screen.all().filter(e=>['INPUT','SELECT'].includes(e.tagName));
assert.equal(inputs.length,4);
for(const input of inputs){const h=input.getBoundingClientRect().height,font=parseFloat(input.style.fontSize);assert.ok(font*1.2+2<=h);assert.ok(font>0);}
assert.ok(parseFloat(inputs[0].style.fontSize)<parseFloat(inputs[1].style.fontSize));
assert.ok(parseFloat(inputs[3].style.fontSize)<12,'Short lists must fit without a 12px minimum');
inputs[0].value='A long address must remain unchanged';
const before=parseFloat(inputs[0].style.fontSize);scale=.5;resize();
assert.ok(parseFloat(inputs[0].style.fontSize)<before);
assert.equal(inputs[0].value,'A long address must remain unchanged');
scale=2;nodes.screen.all().find(e=>e.textContent==='Увеличить').onclick();
assert.ok(parseFloat(inputs[1].style.fontSize)>24,'Zoom scales the font cap too');
console.log('Screenshot text/password/list fonts fit individual heights, resize and zoom without changing values.');
const actions=nodes.screen.all().find(e=>e.className==='screen-actions');
const [zoom,fullscreen]=actions.children.filter(e=>e.tagName==='BUTTON');
assert.equal(zoom.textContent,'Вписать');
assert.equal(fullscreen.textContent,'На весь экран');
(async()=>{
 await fullscreen.onclick();
 assert.equal(document.fullscreenElement,document.documentElement);
 assert.equal(fullscreen.textContent,'Свернуть');
 assert.equal(inputs[0].value,'A long address must remain unchanged');
 await document.exitFullscreen();
 assert.equal(fullscreen.textContent,'На весь экран');
 await fullscreen.onclick();
 await fullscreen.onclick();
 assert.equal(document.fullscreenElement,null);
})().catch(error=>{console.error(error);process.exitCode=1;});
