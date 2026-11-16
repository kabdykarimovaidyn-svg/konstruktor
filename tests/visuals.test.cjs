const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
require('../assets/js/author/model.js');
require('../modules/scorm/player.js');
require('../modules/scorm/scorm.js');
const V=ScenaVisuals,M=ScenaModel;
const rect={x:10,y:20,w:35,h:15};
const objects=['rectangle','ellipse','triangle','arrow','line','text'].map((type,i)=>({
 id:'visual_'+i,type,label:type,rect:{...rect},text:'Текст <script>alert(1)</script>',
 color:'#005ca9',fill:'#ffffff',noFill:true,autoFont:false,fontSize:24,font:'Arial'
}));
assert.equal(V.valid(objects),true);
for(const object of objects){
 const markup=V.markup(object);
 assert.ok(markup.includes('screen-visual'));
 assert.equal(vm.runInNewContext('('+V.markup.toString()+')')(object),markup);
}
assert.ok(V.markup(objects.at(-1)).includes('&lt;script&gt;'));
assert.ok(!V.markup({...objects[0],color:'red;position:fixed'}).includes('position:fixed'));
assert.equal(V.valid([objects[0],objects[0]]),false);
assert.equal(V.valid([{...objects[0],rect:{...rect,w:100}}]),false);
assert.equal(V.valid([{...objects.at(-1),text:'x'.repeat(5001)}]),false);
const p=M.project(),screen=M.node('click','s1');
screen.background='media/screen.svg';
screen.decorations=objects;
screen.next=p.start;
p.steps.unshift(screen);p.start=screen.id;
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="white"/></svg>';
p.assets[screen.background]={name:'screen.svg',blob:new Blob([svg],{type:'image/svg+xml'})};
assert.equal(M.inspect(p).problems.length,0);
assert.deepEqual(M.cleanImport(p).steps[0].decorations,objects);
const preview=ScenaSCORM.preview(M.toCourse(p),{[screen.background]:'data:image/svg+xml,'+encodeURIComponent(svg)});
assert.ok(preview.includes('function markup(v,resolve)'));
assert.ok(preview.includes('container-type:size'));
(async()=>{
 const zip=await ScenaSCORM.build(M.toCourse(p),{[screen.background]:p.assets[screen.background].blob});
 fs.writeFileSync('/tmp/visuals-scorm12.zip',Buffer.from(await zip.arrayBuffer()));
 assert.ok(Buffer.from(await zip.arrayBuffer()).includes(Buffer.from('function markup(v,resolve)')));
 console.log('Фигуры и текст: безопасная разметка, импорт, автономный renderer и SCORM проверены.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const image={id:'image_test',type:'image',label:'Картинка',src:'media/overlay.png',rect:{x:10,y:10,w:30,h:20}};
assert.equal(ScenaVisuals.valid([image]),true);
assert.equal(ScenaVisuals.valid([{...image,src:'https://outside.example/a.png'}]),false);
assert.ok(ScenaVisuals.markup(image).includes('media/overlay.png'));
assert.ok(ScenaVisuals.markup(image,()=> 'blob:local-image').includes('blob:local-image'));
assert.equal(ScenaVisuals.markup({...image,src:'javascript:alert(1)'}),'');
screen.decorations.push(image);
p.assets[image.src]={name:'overlay.png',blob:new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'})};
assert.equal(M.inspect(p).problems.length,0);
const imagePreview=ScenaSCORM.preview(M.toCourse(p),{[screen.background]:'blob:background',[image.src]:'blob:overlay'});
assert.ok(imagePreview.includes('blob:overlay'));
assert.throws(()=>ScenaSCORM.preview(M.toCourse(p),{[screen.background]:'blob:background'}),/картинка/);
(async()=>{
 const course=M.toCourse(p),assets=Object.fromEntries(Object.entries(p.assets).map(([k,a])=>[k,a.blob]));
 await assert.rejects(()=>ScenaSCORM.build(course,{[screen.background]:p.assets[screen.background].blob}),/Картинка/);
 const zip=await ScenaSCORM.build(course,assets);assert.ok(Buffer.from(await zip.arrayBuffer()).includes(Buffer.from('media/overlay.png')));
 console.log('Картинка-объект: безопасный путь, предпросмотр, обязательное включение в SCORM и автономная упаковка проверены.');
})().catch(error=>{console.error(error);process.exitCode=1;});
