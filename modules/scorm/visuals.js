/* Pure, escaped visual markup shared by the author canvas and exported player. */
(function(root){
'use strict';
function markup(v){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=(value,fallback,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
 const color=(value,fallback)=>/^#[a-f0-9]{6}$/i.test(value||'')?value:fallback;
 const r=v.rect||{},x=number(r.x,0,0,99),y=number(r.y,0,0,99),w=number(r.w,20,1,100-x),h=number(r.h,10,1,100-y);
 const stroke=color(v.color,'#005ca9'),fill=v.noFill?'none':color(v.fill,'#e7f1fb');
 const width=number(v.strokeWidth,2,0,12),rotation=number(v.rotation,0,-360,360);
 let content='';
 if(v.type==='text'){
  const font=['Arial','Verdana','Georgia','Tahoma','Trebuchet MS'].includes(v.font)?v.font:'Arial';
  const size=v.autoFont!==false?'min(48cqh, 12cqw)':number(v.fontSize,24,8,120)/w*10+'cqw';
  const align=['left','center','right'].includes(v.align)?v.align:'left';
  content='<div class="visual-text" style="color:'+stroke+';font-family:'+font+';font-size:'+size+
   ';font-weight:'+(v.bold?'700':'400')+';font-style:'+(v.italic?'italic':'normal')+
   ';text-align:'+align+';background:'+(v.noFill!==false?'transparent':color(v.fill,'#ffffff'))+'">'+escape(v.text)+'</div>';
 }else{
  const shapes={
   rectangle:'<rect x="3" y="3" width="94" height="94" rx="2"/>',
   ellipse:'<ellipse cx="50" cy="50" rx="47" ry="47"/>',
   triangle:'<polygon points="50,3 97,97 3,97"/>',
   arrow:'<polygon points="3,35 65,35 65,8 97,50 65,92 65,65 3,65"/>',
   line:'<line x1="3" y1="50" x2="97" y2="50"/>'
  };
  if(!shapes[v.type])return '';
  content='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="transform:rotate('+rotation+'deg)" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linejoin="round">'+shapes[v.type]+'</svg>';
 }
 return '<div class="screen-visual" data-visual-id="'+escape(v.id)+'" '+(v.type==='text'?'':'aria-hidden="true"')+' style="left:'+x+'%;top:'+y+'%;width:'+w+'%;height:'+h+'%">'+content+'</div>';
}
function valid(list){
 if(!Array.isArray(list)||list.length>50)return false;
 const ids=new Set();
 return list.every(v=>{
  if(!v||!/^[-\w]{1,80}$/.test(v.id)||ids.has(v.id))return false;
  ids.add(v.id);
  const r=v.rect;
  return ['text','rectangle','ellipse','triangle','arrow','line'].includes(v.type)&&
   r&&['x','y','w','h'].every(k=>Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=100.001&&r.y+r.h<=100.001&&
   (v.type!=='text'||typeof v.text==='string'&&v.text.length<=5000);
 });
}
root.ScenaVisuals={markup,valid};
})(typeof window!=='undefined'?window:globalThis);
