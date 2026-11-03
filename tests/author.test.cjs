const assert=require('node:assert/strict');require('../assets/js/author/model.js');require('../modules/scorm/scorm.js');
const M=global.ScenaModel;let p=M.project();const start=M.node('message',p.groups[0].id),choice=M.node('choice',p.groups[0].id),bad=M.node('message',p.groups[0].id),retry=M.node('return',p.groups[0].id),form=M.node('form',p.groups[0].id),end=p.steps[0];p.steps.push(start,choice,bad,retry,form);p.start=start.id;start.next=choice.id;bad.next=retry.id;retry.next=choice.id;form.fields[0].rule='any';form.next=end.id;M.link(p,choice.id,choice.options[0].id,form.id);M.link(p,choice.id,choice.options[1].id,bad.id);assert.equal(M.inspect(p).problems.length,0);assert.equal(ScenaSCORM.validate(M.toCourse(p)),true);assert.throws(()=>M.link(p,retry.id,'next',form.id),/Возврат/);
M.remove(p,form.id);assert.equal(choice.options[0].next,'');assert.ok(M.inspect(p).problems.some(e=>e.id===choice.id));
const imported=M.cleanImport(structuredClone(p));assert.equal(imported.schema,2);assert.throws(()=>M.cleanImport({...p,steps:[p.steps[0],p.steps[0]]}),/ID/);
console.log('Авторская модель: ручные связи, цикл возврата, удаление связанного шага и импорт проверены.');
// Screenshot batches are independent steps; visual order drives sequential playback.
let seq=M.project(),finish=seq.steps[0],a=M.node('click','s1'),b=M.node('click','s1'),c=M.node('click','s1');
M.insert(seq,[a,b,c],finish.id,'s1');assert.deepEqual(M.ordered(seq).map(n=>n.id),[a.id,b.id,c.id,finish.id]);assert.equal(seq.start,a.id);assert.equal(a.next,b.id);assert.equal(c.next,finish.id);
M.move(seq,a.id,c.id,true);assert.deepEqual(M.ordered(seq).map(n=>n.id),[b.id,c.id,a.id,finish.id]);assert.equal(seq.start,b.id);assert.equal(b.next,c.id);assert.equal(c.next,a.id);
seq.groups.push({id:'second',title:'Раздел 2'});M.sequence(seq);assert.equal(finish.group,'second');const d=M.node('message','second');M.insert(seq,[d],finish.id,'second');assert.equal(a.next,d.id);assert.equal(d.next,finish.id);
M.removeGroup(seq,'second');assert.ok(seq.steps.some(n=>n.id===finish.id));assert.equal(finish.group,'s1');assert.equal(a.next,finish.id);
seq.settings.flow='branching';const oldTarget=c.next;M.move(seq,c.id,b.id,false);assert.equal(c.next,oldTarget);
assert.equal(M.count(1,'шаг','шага','шагов'),'1 шаг');assert.equal(M.count(23,'шаг','шага','шагов'),'23 шага');
console.log('Порядок скриншотов, изменение переходов, сохранение веток и итогового экрана при удалении раздела проверены.');
const draft=M.project(),ready=M.node('form','s1'),unfinished=M.node('video','s1');ready.fields[0].rule='any';ready.next=unfinished.id;draft.steps.push(ready,unfinished);const isolated=M.previewCourse(draft,ready.id);assert.equal(ScenaSCORM.validate(isolated),true);assert.equal(ready.next,unfinished.id);assert.ok(!isolated.steps.some(n=>n.id===unfinished.id));
console.log('Отдельный шаг проверяется без готовности остальных материалов; исходные переходы сохраняются.');
