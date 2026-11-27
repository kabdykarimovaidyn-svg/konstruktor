const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class E{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.handlers={};this.classList={add(){}};this.value='';this.currentTime=0;this.duration=10;}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}addEventListener(k,v){this.handlers[k]=v;}focus(){}pause(){}play(){this.playCount=(this.playCount||0)+1;return Promise.resolve();}all(){return this.children.filter(c=>typeof c==='object').flatMap(c=>[c,...c.all()]);}}
const nodes=Object.fromEntries(['title','step','task','screen','feedback','lms','errors','save'].map(k=>[k,new E('div')]));const document={getElementById:k=>nodes[k],createElement:t=>new E(t),createTextNode:s=>s,addEventListener(){}};const window={addEventListener(){}};const ctx={window,document,console,Date};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../modules/scorm/player.js'),'utf8'),ctx);
const course={id:'branches',title:'Branches',start:'intro',steps:[{id:'intro',type:'video',src:'media/i.mp4',next:'choose'},{id:'choose',type:'choice',video:'intro',options:[{label:'Bad',next:'bad'},{label:'Good',next:'good'}]},{id:'bad',type:'video',src:'media/b.mp4',next:'explain'},{id:'explain',type:'message',body:'Reason',next:'retry'},{id:'retry',type:'return',next:'choose',penalty:true},{id:'good',type:'video',src:'media/g.mp4',next:'form'},{id:'form',type:'form',fields:[{id:'a',label:'URL',rule:'url',expected:'gmail.com'},{id:'b',label:'Name',rule:'any'}],next:'end'},{id:'end',type:'end'}]};let saved;const bridge={connected:true,warnings:[],get:()=>'',save:s=>{saved={...s};return true;},finish(){}};const player=window.ScenaPlayer.run(course,()=>bridge),all=t=>nodes.screen.all().filter(e=>e.tagName===t.toUpperCase()),click=t=>all('button').find(e=>e.textContent===t).onclick();const intro=all('video')[0];assert.equal(player.getState().step,'intro');intro.onended();assert.equal(player.getState().step,'choose');click('Bad');all('video')[0].onended();assert.equal(player.getState().errors,0);click('Далее');assert.equal(player.getState().step,'choose');assert.equal(player.getState().errors,1);assert.equal(intro.playCount,1);click('Good');all('video')[0].onended();const form=all('form')[0],inputs=all('input');inputs[0].value='gmai.com';inputs[1].value='';form.onsubmit({preventDefault(){}});assert.equal(player.getState().step,'form');assert.equal(player.getState().errors,2);inputs[0].value='HTTPS://GMAIL.COM/';inputs[1].value='Practice';form.onsubmit({preventDefault(){}});assert.equal(player.getState().done,true);assert.equal(saved.score,80);
const bridge2={...bridge,get:()=>JSON.stringify({v:2,course:'branches',step:'intro',errors:2,score:0,done:false,time:6})};const reopened=window.ScenaPlayer.run(course,()=>bridge2);const video=all('video')[0];video.onloadedmetadata();assert.equal(video.currentTime,6);assert.equal(reopened.getState().errors,2);
console.log('Проигрыватель v2: отложенные последствия, возврат без повтора, несколько полей и восстановление видео проверены.');
const screens={id:'screens',title:'Screens',start:'main',steps:[
 {id:'main',type:'form',background:'main.png',fields:[{id:'phone',label:'Phone',rule:'any',rect:{x:5,y:10,w:30,h:10}}],next:'finish',
  jumps:[{id:'orders',label:'Orders',next:'orders',checkBeforeJump:false,rect:{x:50,y:5,w:20,h:10}}]},
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
screens.steps[0].jumps.push({id:'done',label:'Finish here',next:'finish',checkBeforeJump:false,rect:{x:70,y:5,w:20,h:10}});
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
const coverPlayer=window.ScenaPlayer.run(guideCourse,()=>bridge);
const coverLogo=all('img').find(e=>e.className==='business-logo');
assert.ok(coverLogo.src.startsWith('data:image/svg+xml;base64,'));
assert.equal(all('button').find(e=>e.textContent==='Начать').className,'business-start');
click('Начать');
assert.equal(coverPlayer.getState().step,guideProject.steps[1].id);
console.log('Корпоративная обложка использует встроенный логотип и запускает курс.');
screens.steps[0].countMissClicks=false;
const freeClickPlayer=window.ScenaPlayer.run(screens,()=>bridge);
let stage=nodes.screen.all().find(e=>e.className==='stage');
stage.handlers.click({target:stage});
stage.handlers.click({target:{tagName:'IMG'}});
assert.equal(freeClickPlayer.getState().errors,0);
screens.steps[0].countMissClicks=true;
const strictClickPlayer=window.ScenaPlayer.run(screens,()=>bridge);
stage=nodes.screen.all().find(e=>e.className==='stage');
stage.handlers.click({target:stage});
assert.equal(strictClickPlayer.getState().errors,1);
screens.steps[0].fields[0].rule='exact';
screens.steps[0].fields[0].expected='correct';
all('input')[0].value='wrong';
all('form')[0].onsubmit({preventDefault(){}});
assert.equal(strictClickPlayer.getState().errors,2);
console.log('Свободные клики не штрафуются при отключённой настройке. Проверка неверного ввода сохраняется.');
const selectionCourse={id:'selection',title:'Выбор области',start:'main',steps:[
 {id:'main',type:'form',background:'main.png',fields:[{id:'row',kind:'selection',label:'Строка клиента',rule:'exact',rect:{x:10,y:20,w:70,h:8}}],next:'end',jumps:[{id:'tab',label:'Заказы',next:'orders',rect:{x:5,y:5,w:20,h:8}}]},
 {id:'orders',type:'click',background:'orders.png',jumps:[{id:'back',label:'Назад',next:'main',rect:{x:5,y:5,w:20,h:8}}]},
 {id:'end',type:'end'}
]};
assert.equal(ScenaSCORM.validate(selectionCourse),true);
const selectionPlayer=window.ScenaPlayer.run(selectionCourse,()=>bridge);
let markButton=all('button').find(e=>e.className==='screen-selection');
assert.equal(markButton['data-selected'],'false');
markButton.onclick();
assert.equal(markButton['data-selected'],'true');
assert.equal(selectionPlayer.getState().step,'main');
assert.equal(selectionPlayer.getState().errors,0);
click('Заказы');click('Назад');
markButton=all('button').find(e=>e.className==='screen-selection');
assert.equal(markButton['data-selected'],'true');
markButton.onclick();
assert.equal(markButton['data-selected'],'false');
assert.equal(selectionPlayer.getState().errors,0);
selectionCourse.steps[0].fields[0].selectionRequired=true;
all('form')[0].onsubmit({preventDefault(){}});
assert.equal(selectionPlayer.getState().step,'main');
assert.equal(selectionPlayer.getState().errors,1);
markButton.onclick();
all('form')[0].onsubmit({preventDefault(){}});
assert.equal(selectionPlayer.getState().done,true);
console.log('Выбор области: без перехода и ошибок, повторное снятие, восстановление между экранами и необязательная проверка.');
// A required choice must also guard a hotspot, including a direct completion target.
selectionCourse.steps[0].jumps.push({id:'finish',label:'Готово',next:'end',rect:{x:75,y:80,w:20,h:10}});
const guardedSelection=window.ScenaPlayer.run(selectionCourse,()=>bridge);
click('Готово');
assert.equal(guardedSelection.getState().step,'main');
assert.equal(guardedSelection.getState().errors,1);
assert.ok(nodes.feedback.textContent.includes('Строка клиента'));
all('button').find(e=>e.className==='screen-selection').onclick();
click('Заказы');
assert.equal(guardedSelection.getState().step,'orders');
click('Назад');
assert.equal(all('button').find(e=>e.className==='screen-selection')['data-selected'],'true');
click('Готово');
assert.equal(guardedSelection.getState().step,'end');
assert.equal(guardedSelection.getState().done,true);
// A tab may explicitly remain available before selecting the required row.
selectionCourse.steps[0].jumps[0].checkBeforeJump=false;
const freelyNavigate=window.ScenaPlayer.run(selectionCourse,()=>bridge);
click('Заказы');
assert.equal(freelyNavigate.getState().step,'orders');
assert.equal(freelyNavigate.getState().errors,0);
click('Назад');
click('Готово');
assert.equal(freelyNavigate.getState().step,'main');
// Requiredness removed: old free navigation continues to work.
selectionCourse.steps[0].fields[0].selectionRequired=false;
const optionalSelection=window.ScenaPlayer.run(selectionCourse,()=>bridge);
click('Готово');
assert.equal(optionalSelection.getState().done,true);
console.log('Обязательный выбор блокирует область перехода; после выбора открывается её цель. Свободные вкладки сохраняются.');

// Wrong dropdown answers must block default hotspots even when miss clicks are free.
const dropdownCourse={id:'dropdown',title:'Список',start:'main',steps:[
 {id:'main',type:'form',background:'main.png',countMissClicks:false,fields:[{id:'list',kind:'select',label:'Статус',choices:'Верно\nНеверно',expected:'Верно',rect:{x:10,y:10,w:30,h:10}}],jumps:[{id:'continue',label:'Продолжить проверку',next:'end',rect:{x:60,y:60,w:20,h:10}}]},
 {id:'end',type:'end'}]};
const dropdownPlayer=window.ScenaPlayer.run(dropdownCourse,()=>bridge);
stage=nodes.screen.all().find(e=>e.className==='stage');
stage.handlers.click({target:stage});
assert.equal(dropdownPlayer.getState().errors,0);
all('select')[0].value='Неверно';
click('Продолжить проверку');
assert.equal(dropdownPlayer.getState().step,'main');
assert.equal(dropdownPlayer.getState().errors,1);
all('select')[0].value='Верно';
click('Продолжить проверку');
assert.equal(dropdownPlayer.getState().done,true);
dropdownCourse.steps[0].jumps[0].checkBeforeJump=false;
const freeDropdown=window.ScenaPlayer.run(dropdownCourse,()=>bridge);
all('select')[0].value='Неверно';
click('Продолжить проверку');
assert.equal(freeDropdown.getState().done,true);
console.log('Список проверяется перед переходом независимо от штрафа за клик мимо; явная свободная навигация сохранена.');
// Modes change presentation, never bypass correctness or reveal the failed field in exams.
document.documentElement=new E('html');document.documentElement.style.setProperty=()=>{};
for(const mode of ['learn','test']){
 const c=structuredClone(dropdownCourse);c.mode=mode;delete c.steps[0].jumps[0].checkBeforeJump;
 c.steps[0].fields[0].error='Выберите рабочий статус';
 const modePlayer=window.ScenaPlayer.run(c,()=>bridge);
 assert.equal(document.documentElement['data-course-mode'],mode);
 all('select')[0].value='Неверно';click('Продолжить проверку');
 assert.equal(modePlayer.getState().step,'main');assert.equal(modePlayer.getState().errors,mode==='test'?1:0);
 if(mode==='test'){
  assert.equal(all('select')[0]['aria-invalid'],undefined);
  assert.ok(!nodes.feedback.textContent.includes('Статус'));
  assert.ok(!nodes.feedback.textContent.includes('рабочий'));
 }else{assert.equal(all('select')[0]['aria-invalid'],'true');assert.equal(nodes.feedback.textContent,'Выберите рабочий статус');}
 all('select')[0].value='Верно';click('Продолжить проверку');assert.equal(modePlayer.getState().done,true);
 assert.equal(modePlayer.getState().score,mode==='test'?90:0);
 assert.equal(modePlayer.getState().scored,mode==='test');
 assert.equal(all('button').some(e=>e.textContent==='Пройти заново'),mode==='learn');
 const actions=nodes.screen.all().find(e=>e.className==='completion-actions');
 assert.deepEqual(actions.children.map(e=>e.textContent),mode==='learn'?['Пройти заново','Завершить']:['Завершить']);
 if(mode==='learn'){click('Пройти заново');assert.equal(modePlayer.getState().step,'main');assert.equal(modePlayer.getState().done,false);assert.equal(all('select')[0].value,'');assert.equal(modePlayer.getState().progress,'');}

}
console.log('Обучение и экзамен: одинаковая проверка ответов, обучение без оценки с повтором, экзамен с оценкой без повтора.');
// Delayed penalties must also remain unscored in learning.
const learningStory=structuredClone(course);learningStory.mode='learn';
const storyPlayer=window.ScenaPlayer.run(learningStory,()=>bridge);
all('video')[0].onended();click('Bad');all('video')[0].onended();click('Далее');
assert.equal(storyPlayer.getState().step,'choose');assert.equal(storyPlayer.getState().errors,0);
// A saved learning run must never restore into the same-ID exam.
const examResume=structuredClone(dropdownCourse);examResume.mode='test';delete examResume.steps[0].jumps[0].checkBeforeJump;
const crossMode=window.ScenaPlayer.run(examResume,()=>({...bridge,get:()=>JSON.stringify({v:4,mode:'learn',course:examResume.id,step:'end',errors:0,score:0,done:true})}));
assert.equal(crossMode.getState().step,'main');assert.equal(crossMode.getState().done,false);
assert.equal(crossMode.getState().scored,true);
console.log('Отложенные штрафы в обучении отключены; прогресс обучения не восстанавливается в экзамене.');

const sectionCourse={id:'sections',title:'Разделы',coverLogo:coverLogo.src,start:'menu',steps:[
 {id:'menu',type:'message',template:'sections',next:'end',sections:[
  {label:'Первый',next:'first',finish:'first',icon:'chart'},
  {label:'Второй',next:'second',finish:'second'},
  {label:'Третий',next:'third',finish:'third'}
 ]},
 {id:'first',type:'form',fields:[{id:'code',label:'Code',expected:'123'}],next:'menu'},
 {id:'second',type:'message',next:'menu'},
 {id:'third',type:'message',next:'menu'},
 {id:'end',type:'end'}
]};
assert.equal(ScenaSCORM.validate(sectionCourse),true);
const sectionPlayer=window.ScenaPlayer.run(sectionCourse,()=>bridge);
assert.equal(all('img').find(e=>e.className==='business-logo').src,coverLogo.src);
const cards=()=>nodes.screen.all().filter(e=>e.className?.startsWith('section-card '));
const attempt=value=>{
 all('input')[0].value=value;
 all('form')[0].onsubmit({preventDefault(){}});
};
assert.deepEqual(cards().map(e=>e.className),['section-card section-open','section-card section-locked','section-card section-locked']);
const sectionIcon=card=>card.all().find(e=>e.className==='section-icon').innerHTML;
assert.equal(sectionIcon(cards()[0]),window.ScenaPlayer.sectionIcons.chart.markup);
assert.equal(sectionIcon(cards()[1]),window.ScenaPlayer.sectionIcons.folder.markup);
const openCard=()=>all('button').find(e=>e.className==='section-card section-open');
assert.equal(openCard(),cards()[0]);
assert.ok(openCard().all().some(e=>e.textContent==='1. '+sectionCourse.steps[0].sections[0].label));
assert.equal(all('button').filter(e=>e.className?.startsWith('section-card ')).length,1);
openCard().onclick();
attempt('wrong');
assert.equal(sectionPlayer.getState().step,'first');
attempt('123');
assert.deepEqual(cards().map(e=>e.className),['section-card section-done','section-card section-open','section-card section-locked']);
const midway=JSON.stringify(saved);
for(let retry=0;retry<2;retry++){
 click('Пройти заново');
 assert.equal(sectionPlayer.getState().step,'first');
 assert.equal(all('input')[0].value,'');
 attempt('wrong');
 assert.equal(sectionPlayer.getState().errors,1);
 assert.equal(JSON.stringify(saved),midway);
 attempt('123');
 assert.equal(sectionPlayer.getState().step,'menu');
 assert.equal(JSON.stringify(saved),midway);
}
click('Пройти заново');
click('К разделам');
assert.equal(sectionPlayer.getState().step,'menu');
assert.equal(JSON.stringify(saved),midway);
const resumedSections=window.ScenaPlayer.run(sectionCourse,()=>({...bridge,get:()=>midway}));
assert.equal(all('button').filter(e=>e.textContent==='Пройти заново').length,1);
openCard().onclick();
click('Далее');
assert.equal(all('button').filter(e=>e.textContent==='Пройти заново').length,2);
openCard().onclick();
click('Далее');
assert.equal(all('button').filter(e=>e.textContent==='Пройти заново').length,3);
click('К завершению курса');
assert.equal(resumedSections.getState().done,true);
console.log('Разделы: последовательность, восстановление и повторение без изменения результата проверены.');

// The combined player resumes a locked exam and only unlocks practice after a failed section.
nodes['course-section-return']=new E('button');
const guided={...structuredClone(sectionCourse),id:'guided-test',mode:'guided',start:'welcome',penalty:10};
guided.steps.unshift({id:'welcome',type:'intro',next:'menu'});
guided.steps.find(s=>s.id==='second').type='form';
guided.steps.find(s=>s.id==='second').fields=[{id:'code',label:'Code',expected:'123'}];
assert.equal(ScenaSCORM.validate(guided),true);
const mode=name=>all('button').find(e=>e.className==='section-mode-button'&&e.all().some(child=>child.textContent===name));
const progressText=name=>mode(name).all().find(e=>e.tagName==='SPAN').textContent;
const back=nodes['course-section-return'];
let session=window.ScenaPlayer.run(guided,()=>bridge);
click('Начать');
assert.equal(mode('Экзамен').disabled,true);
assert.equal(progressText('Обучение'),'Пройдено 0 из 3');
assert.equal(cards().filter(e=>e.tagName==='BUTTON').length,1);
assert.ok(cards()[1].all().some(e=>e.textContent==='После раздела 1'));
openCard().onclick();
assert.equal(back.hidden,false);
assert.equal(mode('Обучение'),undefined);
all('input')[0].value='abandoned';
back.onclick();
assert.equal(session.getState().step,'menu');
assert.equal(progressText('Обучение'),'Пройдено 0 из 3');
openCard().onclick();
assert.equal(all('input')[0].value,'');
attempt('123');
click('Пройти заново');
assert.equal(session.getState().step,'first');
back.onclick();
assert.equal(session.getState().step,'menu');
assert.equal(progressText('Обучение'),'Пройдено 1 из 3');
openCard().onclick();attempt('123');
openCard().onclick();click('Далее');
assert.equal(progressText('Обучение'),'Пройдено 3 из 3');
assert.equal(progressText('Экзамен'),'Сдано 0 из 3');
mode('Экзамен').onclick();
assert.equal(session.getState().trained,true);
assert.equal(session.getState().done,false);
click('Начать экзамен');
assert.equal(session.getState().step,'menu');
assert.equal(mode('Обучение').disabled,true);
assert.equal(progressText('Обучение'),'Пройдено 3 из 3');
assert.equal(progressText('Экзамен'),'Сдано 0 из 3');
openCard().onclick();attempt('123');
assert.equal(progressText('Экзамен'),'Сдано 1 из 3');
assert.ok(cards()[2].className.includes('section-locked'));
openCard().onclick();
assert.equal(session.getState().step,'second');
assert.equal(back.hidden,true);
assert.equal(mode('Обучение'),undefined);
const examSave=JSON.stringify(saved);
session=window.ScenaPlayer.run(guided,()=>({...bridge,get:()=>examSave}));
assert.equal(back.hidden,true);
assert.equal(session.getState().step,'second');
attempt('wrong');attempt('wrong');attempt('wrong');attempt('123');
assert.equal(session.getState().failed,'second');
assert.equal(session.getState().failedScore,70);
assert.equal(mode('Обучение').disabled,false);
assert.equal(progressText('Обучение'),'Пройдено 3 из 3');
assert.equal(progressText('Экзамен'),'Сдано 1 из 3');
const failedSave=JSON.stringify(saved);
session=window.ScenaPlayer.run(guided,()=>({...bridge,get:()=>failedSave}));
assert.equal(session.getState().failed,'second');
click('Вернуться к обучению');
assert.equal(session.getState().step,'second');
assert.equal(back.hidden,false);
attempt('wrong');attempt('123');
assert.equal(session.getState().failed,'second');
assert.equal(JSON.stringify(saved),failedSave);
click('Повторить экзамен по разделу');
assert.equal(session.getState().step,'second');
assert.equal(back.hidden,true);
attempt('wrong');attempt('123');
openCard().onclick();click('Далее');
click('К итогам экзамена');
assert.equal(session.getState().done,false);
assert.equal(back.hidden,true);
click('Сдать экзамен');
assert.equal(session.getState().done,true);
assert.equal(session.getState().score,97);
click('На начальную страницу');
assert.equal(session.getState().step,'welcome');
assert.equal(session.getState().done,true);
console.log('Единый курс: раздельный прогресс, выход из обучения, блокировка выхода на экзамене, пересдача и сдача проверены.');

const sectionResult=structuredClone(guided);
const menu=sectionResult.steps.find(step=>step.id==='menu');
const first=sectionResult.steps.find(step=>step.id==='first');
menu.sections[0].finish='first-end';first.next='first-end';
sectionResult.steps.push({id:'first-end',template:'section-end',type:'message',sectionTitle:'Первый',next:'menu'});
assert.equal(ScenaSCORM.validate(sectionResult),true);
const resultPlayer=window.ScenaPlayer.run(sectionResult,()=>bridge);
click('Начать');
openCard().onclick();attempt('123');
assert.equal(resultPlayer.getState().step,'first-end');
assert.ok(all('h2').some(e=>e.textContent===sectionResult.title));
assert.ok(all('h3').some(e=>e.textContent==='Первый'));
assert.equal(resultPlayer.getState().done,false);
click('К выбору разделов');
assert.equal(resultPlayer.getState().step,'menu');
assert.ok(cards()[0].className.includes('section-done'));
const testState={...saved,mode:'test',trained:true,step:'first',progress:'',attempt:{start:'first',progress:'',errors:0}};
const examResult=window.ScenaPlayer.run(sectionResult,()=>({...bridge,get:()=>JSON.stringify(testState)}));
attempt('wrong');attempt('wrong');attempt('wrong');attempt('123');
assert.equal(examResult.getState().failed,'first');
assert.equal(examResult.getState().step,'menu');
assert.ok(all('strong').some(e=>e.textContent==='Раздел не сдан'));
console.log('Экран завершения раздела и отказ до показа успешного результата проверены.');

const stepPreview={...sectionCourse,start:'first',mode:'learn',preview:true,previewScope:'step',previewSectionMenu:true,previewToken:'test-preview'};
let previewMessage;
window.parent={postMessage(message){previewMessage=message;}};
const previewClose=nodes['close-preview']=new E('button');
window.ScenaPlayer.run(stepPreview,()=>bridge);
assert.equal(back.hidden,false);
assert.equal(nodes.errors.textContent,'Обучение · без оценки');
const expand=all('button').find(button=>button.textContent==='На весь экран');
expand.onclick();
assert.equal(expand.textContent,'Свернуть');
assert.equal(previewMessage.type,'scena-preview-expand');
assert.equal(previewMessage.expanded,true);
expand.onclick();
assert.equal(previewMessage.expanded,false);
back.onclick();
assert.equal(previewMessage.type,'scena-preview-sections');
assert.equal(previewMessage.token,stepPreview.previewToken);
assert.equal(previewClose.hidden,false);
previewClose.onclick();
assert.equal(previewMessage.type,'scena-preview-close');
assert.equal(previewMessage.token,stepPreview.previewToken);
window.ScenaPlayer.run({...stepPreview,mode:'test'},()=>bridge);
assert.equal(back.hidden,true);
assert.equal(previewClose.hidden,false);
window.ScenaPlayer.run(sectionCourse,()=>bridge);
assert.equal(previewClose.hidden,true);
