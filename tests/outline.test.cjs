const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../assets/js/author/model.js');const M=ScenaModel;
const handlers={},nodes=new Map();function element(id){if(!nodes.has(id))nodes.set(id,{scrollTop:0,innerHTML:'',hidden:false,textContent:'',addEventListener:(event,fn)=>handlers[event]=fn,querySelector:()=>({focus(){}}),querySelectorAll:()=>[]});return nodes.get(id);}
let modal=false;const document={getElementById:element,querySelector:()=>modal?{}:null};const window={};
const ctx={window,document,ScenaModel:M,Set,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../assets/js/author/outline.js'),'utf8'),ctx);
let p=M.project(),end=p.steps[0];const steps=Array.from({length:6},(_,i)=>({...M.node('message','s1'),title:'Шаг '+i}));M.insert(p,steps,end.id,'s1');let active=steps[0].id,removed=[];
const outline=window.ScenaOutline,adapter={project:()=>p,selected:()=>active,group:()=> 's1',url:()=>'',select(id){active=id;outline.render();},removeMany:ids=>removed.push(Array.from(ids))};outline.init(adapter);outline.render();
const click=(id,shiftKey=false)=>element('node-list').onclick({shiftKey,target:{closest:()=>({dataset:{select:id}})}});
click(steps[1].id);element('node-list').scrollTop=320;click(steps[4].id,true);
assert.deepEqual(Array.from(outline.selection()),steps.slice(1,5).map(s=>s.id));assert.equal(element('node-list').scrollTop,320);assert.equal(element('outline-selection').hidden,false);
click(steps[2].id,true);assert.deepEqual(Array.from(outline.selection()),steps.slice(1,3).map(s=>s.id));
function key(key,editable=false){let prevented=false,stopped=false;handlers.keydown({key,target:{closest:()=>editable?{}:null},preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});return {prevented,stopped};}
assert.deepEqual(key('Delete'),{prevented:true,stopped:true});assert.deepEqual(removed[0],steps.slice(1,3).map(s=>s.id));
key('Delete',true);modal=true;key('Backspace');modal=false;assert.equal(removed.length,1);
key('Escape');assert.deepEqual(Array.from(outline.selection()),[active]);assert.equal(element('outline-selection').hidden,true);
click(steps[5].id,true);assert.deepEqual(Array.from(outline.selection()),steps.slice(2,6).map(s=>s.id));
p={...M.project(),id:'different-project'};active=p.start;outline.render();assert.deepEqual(Array.from(outline.selection()),[p.start]);
console.log('Список: Shift-диапазон, изменение границы, Escape, Delete без конфликта с холстом/вводом, прокрутка и переключение проекта проверены.');
// Exercise the actual bulk-delete coordinator: one undo checkpoint and safe cancellation.
(async()=>{
 const source=fs.readFileSync(require.resolve('../assets/js/author/app.js'),'utf8');const fn=source.slice(source.indexOf('async function removeSteps(ids)'),source.indexOf('function duplicateStep(id)'));
 const project=M.project(),finish=project.steps[0],batch=Array.from({length:4},()=>M.node('message','s1'));M.insert(project,batch,finish.id,'s1');
 let allow=true,snapshots=[];const appCtx={p:project,M,selected:batch[1].id,selectedGroup:'s1',Set,confirmAction:async()=>allow,node:()=>project.steps.find(n=>n.id===appCtx.selected),mutate:fn=>{snapshots.push(structuredClone(project));fn();},ScenaOutline:{selectOne(){}},render(){},notice(){},$:()=>({querySelector:()=>({focus(){}})})};vm.createContext(appCtx);vm.runInContext(fn,appCtx);
 allow=false;await appCtx.removeSteps(batch.slice(1,3).map(n=>n.id));assert.equal(snapshots.length,0);assert.equal(project.steps.length,5);
 allow=true;await appCtx.removeSteps(batch.slice(1,3).map(n=>n.id));assert.equal(snapshots.length,1);assert.deepEqual(project.steps.map(n=>n.id),[batch[0].id,batch[3].id,finish.id]);assert.equal(batch[0].next,batch[3].id);assert.equal(appCtx.selected,batch[3].id);assert.equal(snapshots[0].steps.length,5);
 await appCtx.removeSteps(project.steps.map(n=>n.id));assert.equal(project.steps.length,1);assert.equal(project.steps[0].type,'end');
 console.log('Пакетное удаление: отмена подтверждения ничего не меняет, один checkpoint возвращает весь набор, сохраняется соседний шаг и непустой проект.');
})().catch(e=>{console.error(e);process.exitCode=1;});
