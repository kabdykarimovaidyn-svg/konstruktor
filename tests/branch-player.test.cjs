const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class E{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.handlers={};this.classList={add(){}};this.value='';this.currentTime=0;this.duration=10;}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}addEventListener(k,v){this.handlers[k]=v;}focus(){}pause(){}play(){this.playCount=(this.playCount||0)+1;return Promise.resolve();}all(){return this.children.filter(c=>typeof c==='object').flatMap(c=>[c,...c.all()]);}}
const nodes=Object.fromEntries(['title','step','task','screen','feedback','lms','errors','save'].map(k=>[k,new E('div')]));const document={getElementById:k=>nodes[k],createElement:t=>new E(t),createTextNode:s=>s,addEventListener(){}};const window={addEventListener(){}};const ctx={window,document,console,Date};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../modules/scorm/player.js'),'utf8'),ctx);
const course={id:'branches',title:'Branches',start:'intro',steps:[{id:'intro',type:'video',src:'media/i.mp4',next:'choose'},{id:'choose',type:'choice',video:'intro',options:[{label:'Bad',next:'bad'},{label:'Good',next:'good'}]},{id:'bad',type:'video',src:'media/b.mp4',next:'explain'},{id:'explain',type:'message',body:'Reason',next:'retry'},{id:'retry',type:'return',next:'choose',penalty:true},{id:'good',type:'video',src:'media/g.mp4',next:'form'},{id:'form',type:'form',fields:[{id:'a',label:'URL',rule:'url',expected:'gmail.com'},{id:'b',label:'Name',rule:'any'}],next:'end'},{id:'end',type:'end'}]};let saved;const bridge={connected:true,warnings:[],get:()=>'',save:s=>{saved={...s};return true;},finish(){}};const player=window.ScenaPlayer.run(course,()=>bridge),all=t=>nodes.screen.all().filter(e=>e.tagName===t.toUpperCase()),click=t=>all('button').find(e=>e.textContent===t).onclick();const intro=all('video')[0];assert.equal(player.getState().step,'intro');intro.onended();assert.equal(player.getState().step,'choose');click('Bad');all('video')[0].onended();assert.equal(player.getState().errors,0);click('Далее');assert.equal(player.getState().step,'choose');assert.equal(player.getState().errors,1);assert.equal(intro.playCount,1);click('Good');all('video')[0].onended();const form=all('form')[0],inputs=all('input');inputs[0].value='gmai.com';inputs[1].value='';form.onsubmit({preventDefault(){}});assert.equal(player.getState().step,'form');assert.equal(player.getState().errors,2);inputs[0].value='HTTPS://GMAIL.COM/';inputs[1].value='Practice';form.onsubmit({preventDefault(){}});assert.equal(player.getState().done,true);assert.equal(saved.score,80);
const bridge2={...bridge,get:()=>JSON.stringify({v:2,course:'branches',step:'intro',errors:2,score:0,done:false,time:6})};const reopened=window.ScenaPlayer.run(course,()=>bridge2);const video=all('video')[0];video.onloadedmetadata();assert.equal(video.currentTime,6);assert.equal(reopened.getState().errors,2);
console.log('Проигрыватель v2: отложенные последствия, возврат без повтора, несколько полей и восстановление видео проверены.');
const screens={id:'screens',title:'Screens',start:'main',steps:[
 {id:'main',type:'form',background:'main.png',fields:[{id:'phone',label:'Phone',rule:'any',rect:{x:5,y:10,w:30,h:10}}],next:'finish',
  jumps:[{id:'orders',label:'Orders',next:'orders',rect:{x:50,y:5,w:20,h:10}}]},
 {id:'orders',type:'click',background:'orders.png',jumps:[{id:'back',label:'Back',next:'main',rect:{x:5,y:5,w:15,h:10}}]},
 {id:'finish',type:'end'}
]};
require('../modules/scorm/scorm.js');
assert.equal(ScenaSCORM.validate(screens),true);
const screenPlayer=window.ScenaPlayer.run(screens,()=>bridge);
all('input')[0].value='+7 701';
click('Orders');
assert.equal(screenPlayer.getState().step,'orders');
click('Back');
assert.equal(screenPlayer.getState().step,'main');
assert.equal(all('input')[0].value,'+7 701');
assert.equal(screenPlayer.getState().errors,0);
assert.ok(!JSON.stringify(saved).includes('+7 701'));
console.log('Переход между скриншотами сохраняет незавершённый ввод в сеансе.');
// A hotspot can finish the course directly, without a screenshot destination.
screens.steps[0].jumps.push({id:'done',label:'Finish here',next:'finish',rect:{x:70,y:5,w:20,h:10}});
assert.equal(ScenaSCORM.validate(screens),true);
const finishViaArea=window.ScenaPlayer.run(screens,()=>bridge);
click('Finish here');
assert.equal(finishViaArea.getState().step,'finish');
assert.equal(finishViaArea.getState().done,true);
console.log('Область перехода открывает завершающий слайд.');
screens.steps[0].showNext=false;
window.ScenaPlayer.run(screens,()=>bridge);
assert.ok(nodes.screen.all().some(e=>e.className==='navigation'&&e.style.display==='none'));
screens.steps[0].showNext=true;
window.ScenaPlayer.run(screens,()=>bridge);
assert.ok(nodes.screen.all().some(e=>e.className==='navigation'&&e.style.display!=='none'));
console.log('Показ нижней кнопки управляется настройкой экрана.');
require('../assets/js/author/model.js');
const guideProject=ScenaModel.project();
ScenaModel.addGuide(guideProject);
const guideCourse=ScenaModel.toCourse(guideProject);
const guidePlayer=window.ScenaPlayer.run(guideCourse,()=>bridge);
click('Начать');
assert.equal(guidePlayer.getState().step,guideProject.steps[1].id);
assert.equal(all('strong').filter(e=>e.textContent==='Прогресс').length,1);
assert.equal(all('strong').filter(e=>e.textContent==='Галочка').length,1);
click('Понятно, начать');
assert.equal(guidePlayer.getState().done,true);
console.log('Инструкция отображает легенду и продолжает курс по центральному маршруту.');
window.ScenaPlayer.run(guideCourse,()=>bridge);
click('Начать');
const markers=nodes.screen.all().filter(e=>e.className==='guide-marker').map(e=>Number(e.textContent)).sort((a,b)=>a-b);
assert.deepEqual(markers,[1,2,3,4,5,6,7,8,9]);
console.log('На иллюстрации присутствуют все девять номеров легенды.');
const illustrationMarkers=nodes.screen.all().filter(e=>e.className==='guide-marker').map(e=>Number(e.textContent));
assert.deepEqual(illustrationMarkers,[1,2,3,4,5,6,7,8,9]);
const legendTitles=all('strong').map(e=>e.textContent);
assert.deepEqual(legendTitles,['Прогресс','Счётчик ошибок','Задание','Поле ввода','Выпадающий список','Активная область','Галочка','Сообщение об ошибке','Увеличить']);
console.log('Номера на иллюстрации и пояснения следуют одному порядку сверху вниз.');
