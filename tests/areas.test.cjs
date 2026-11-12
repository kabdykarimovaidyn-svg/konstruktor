const assert=require('node:assert/strict');require('../assets/js/author/model.js');const handlers={},host={addEventListener:(type,fn)=>handlers['host:'+type]=fn},canvas={focus(){}};global.window=global;global.document={getElementById:id=>id==='editor-content'?host:{classList:{contains:()=>false}},querySelector:s=>s==='dialog[open]'?null:canvas,addEventListener:(type,fn)=>handlers[type]=fn};require('../assets/js/author/areas.js');
const M=ScenaModel,n=M.node('form','s1');n.fields=[{...M.field(),label:'A',rect:{x:10,y:20,w:20,h:10}},{...M.field(),label:'B',rect:{x:40,y:20,w:20,h:10}}];const [a,b]=n.fields;let snapshots=[];const api={node:()=>n,project:()=>({}),editor(){},inspector(){},render(){},notice(){},checkpoint(){},changed(){},mutate(fn){snapshots.push(structuredClone(n));fn();},draw(){},drawing:()=>null,cancel(){}};ScenaAreas.init(api);ScenaAreas.pickField(a.id);ScenaAreas.pickField(b.id,true);
function key(key,meta=false,target={closest:()=>false}){let prevented=false;handlers.keydown({key,metaKey:meta,ctrlKey:false,target,preventDefault(){prevented=true;}});return prevented;}
assert.equal(key('c',true),true);assert.equal(key('v',true),true);assert.equal(n.fields.length,4);assert.notEqual(n.fields[2].id,a.id);assert.notEqual(n.fields[3].id,b.id);assert.equal(n.fields[2].rect.x,12);assert.equal(n.fields[3].rect.x,42);key('ArrowDown');assert.equal(n.fields[2].rect.y,22.25);assert.equal(a.rect.y,20);assert.equal(key('v',true,{closest:()=>true}),false);assert.equal(n.fields.length,4);key('Delete');assert.equal(n.fields.length,2);assert.ok(snapshots.length>=3);console.log('Области: Cmd/Ctrl+C/V, независимые ID, Shift-группа, стрелки, удаление и защита текстового ввода проверены.');

ScenaAreas.pickField(a.id);key('c',true);n.type='click';delete n.fields;n.rect={x:20,y:70,w:30,h:10};key('v',true);assert.equal(n.type,'form');assert.equal(n.fields.length,1);assert.equal(n.submitRect.y,70);console.log('Вставка поля на другой экран сохраняет кнопку перехода.');
n.background='screen.png';
n.decorations=[{id:'visual1',type:'text',label:'Заголовок',text:'Пример',rect:{x:5,y:5,w:40,h:15},fontSize:28,autoFont:false}];
ScenaAreas.pickVisual('visual1');
assert.equal(ScenaAreas.currentVisual(n).text,'Пример');
assert.equal(ScenaAreas.currentField(n),undefined);
key('c',true);key('v',true);
assert.equal(n.decorations.length,2);
assert.notEqual(n.decorations[1].id,'visual1');
assert.equal(n.decorations[1].fontSize,28);
key('ArrowRight');
assert.equal(n.decorations[1].rect.x,7.25);
key('Delete');
assert.equal(n.decorations.length,1);
console.log('Текстовый объект: выбор, копирование стиля, перемещение и удаление.');
