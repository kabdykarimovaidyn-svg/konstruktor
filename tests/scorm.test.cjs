/* Meaningful module checks: packaging, graph validation, LMS lifecycle and recovery. */
const assert=require('node:assert/strict');const fs=require('node:fs');
require('../modules/scorm/scorm.js');
const {build,validate,runtime}=global.ScenaSCORM;
const demo={id:'test',title:'Курс < & " тест',start:'a',steps:[{id:'a',type:'input',expected:'да',next:'b'},{id:'b',type:'choice',options:[{label:'Верно',next:'end'},{label:'Нет',wrong:true,next:'b'}]},{id:'end',type:'end'}]};
function fakeLMS(values={},reject=''){
 const calls=[];const data={...values};const API={LMSInitialize(v){calls.push(['init',v]);return 'true';},LMSGetValue(k){calls.push(['get',k]);return data[k]||'';},LMSSetValue(k,v){calls.push(['set',k,v]);if(k===reject)return 'false';data[k]=v;return 'true';},LMSCommit(v){calls.push(['commit',v]);return 'true';},LMSFinish(v){calls.push(['finish',v]);return 'true';}};return {API,calls,data};
}
(async()=>{
 assert.equal(validate(demo),true);
 assert.throws(()=>validate({...demo,start:'absent'}));
 assert.throws(()=>validate({...demo,steps:[{id:'a',type:'video',next:'end'},{id:'end',type:'end'}]}),/видео/);
 assert.throws(()=>validate({...demo,steps:[{id:'a',type:'choice',options:[{label:'Loop',next:'a'}]},{id:'end',type:'end'}]}));
 assert.throws(()=>validate({...demo,steps:[{id:'a',type:'input',expected:'yes',next:'absent'},{id:'end',type:'end'}]}));
 await assert.rejects(build({...demo,steps:[{id:'a',type:'video',src:'https://example.com/a.mp4',next:'end'},{id:'end',type:'end'}]}),/Медиафайл/);
 await assert.rejects(build(demo,{'media/../bad':new Uint8Array([1])}),/путь/);
 const lms=fakeLMS(),win={API:lms.API};win.parent=win;
 const bridge=runtime(win);assert.equal(bridge.connected,true);assert.equal(lms.data['cmi.core.lesson_status'],'incomplete');
 const state={v:1,course:'test',step:'b',errors:1,done:false,score:0};assert.equal(bridge.save(state),true);assert.equal(lms.data['cmi.core.exit'],'suspend');assert.deepEqual(JSON.parse(lms.data['cmi.suspend_data']),state);
 const completed={...state,step:'end',done:true,score:90};bridge.save(completed);assert.equal(lms.data['cmi.core.lesson_status'],'completed');assert.equal(lms.data['cmi.core.score.raw'],'90');assert.equal(lms.data['cmi.core.exit'],'');assert.match(lms.data['cmi.core.session_time'],/^\d{4}:\d{2}:\d{2}\.\d{2}$/);
 assert.equal(bridge.finish(completed),true);assert.equal(bridge.finish(completed),true);assert.equal(lms.calls.filter(c=>c[0]==='finish').length,1);
 const resumed=runtime(win);assert.equal(JSON.parse(resumed.get('cmi.suspend_data')).step,'end');assert.equal(lms.data['cmi.core.lesson_status'],'completed');
 const broken=fakeLMS({},'cmi.suspend_data'),brokenWin={API:broken.API};brokenWin.parent=brokenWin;assert.equal(runtime(brokenWin).save(state),false);
 assert.equal(runtime(brokenWin).finish(state),false);assert.equal(broken.calls.filter(c=>c[0]==='finish').length,0);const retry=fakeLMS(),rw={API:retry.API};rw.parent=rw;const rb=runtime(rw);retry.API.LMSFinish=()=> 'false';assert.equal(rb.finish(completed),false);assert.equal(rb.connected,true);retry.API.LMSFinish=()=> 'true';assert.equal(rb.finish(completed),true);const initFail=fakeLMS();initFail.API.LMSInitialize=()=> 'false';const failWin={API:initFail.API};failWin.parent=failWin;assert.equal(runtime(failWin).connected,false);assert.equal(runtime(failWin).finish(completed),false);assert.equal(initFail.calls.filter(c=>c[0]==='set').length,0);
 const noAPI={};noAPI.parent=noAPI;assert.equal(runtime(noAPI).connected,false);
 const child={parent:{API:lms.API}};child.parent.parent=child.parent;assert.equal(runtime(child).connected,true);
 const hostile={get parent(){throw Error('cross origin')}};assert.equal(runtime(hostile).connected,false);
 const opener={parent:null,opener:win};opener.parent=opener;assert.equal(runtime(opener).connected,true);
 const blob=await build(demo);fs.writeFileSync('/tmp/scena-module-test.zip',Buffer.from(await blob.arrayBuffer()));
 const mixed={id:'mixed',title:'Видео + экран',start:'v',steps:[{id:'v',type:'video',src:'media/test.mp4',options:[{label:'Продолжить',next:'c'}]},{id:'c',type:'click',background:'media/screen.png',rect:{x:10,y:20,w:30,h:10},next:'end'},{id:'end',type:'end'}]};
 const media=await build(mixed,{'media/test.mp4':new Uint8Array([0,1,2,3]),'media/screen.png':new Uint8Array([4,5,6])});fs.writeFileSync('/tmp/scena-media-test.zip',Buffer.from(await media.arrayBuffer()));
 // Build the real editor demo through its adapter, without importing the editor.
 const real=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/gmail-v1.json'),'utf8'));validate(real);const realBlob=await build(real);fs.writeFileSync(require('node:path').join(__dirname,'../../scena-gmail-scorm12.zip'),Buffer.from(await realBlob.arrayBuffer()));
 console.log('SCORM: проверены граф, ZIP, медиа, адаптер, LMS init/save/resume/finish, ошибки LMS.');
})().catch(e=>{console.error(e);process.exit(1);});
