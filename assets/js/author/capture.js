(function(root){
'use strict';

const byId=id=>document.getElementById(id);
const dialog=byId('capture-dialog');
const preview=byId('capture-preview');
const start=byId('capture-start');
const shot=byId('capture-shot');
const review=byId('capture-review');
const status=byId('capture-status');
let session;

function stop(current){
  current.stream?.getTracks().forEach(track=>track.stop());
  current.stream=null;
  preview.srcObject=null;
  preview.hidden=true;
  shot.disabled=true;
}

function update(current){
  start.disabled=current.busy||Boolean(current.stream)||!navigator.mediaDevices?.getDisplayMedia;
  shot.disabled=current.busy||!current.stream||!preview.videoWidth;
  review.disabled=current.busy||!current.files.length;
  review.textContent='Проверить снимки ('+current.files.length+')';
}

byId('capture-url-form').onsubmit=event=>{
  event.preventDefault();
  const url=new URL(byId('capture-url').value);
  if(!['https:','http:'].includes(url.protocol)){
    status.textContent='Введите ссылку, начинающуюся с https:// или http://.';
    return;
  }
  window.open(url.href,'_blank','noopener,noreferrer');
  status.textContent='Вернитесь сюда и нажмите «Выбрать вкладку».';
};

start.onclick=async()=>{
  const current=session;
  current.busy=true;
  update(current);
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{displaySurface:'browser'},audio:false,selfBrowserSurface:'exclude'
    });
    if(session!==current||!dialog.open){
      stream.getTracks().forEach(track=>track.stop());
      return;
    }
    current.stream=stream;
    preview.srcObject=stream;
    preview.hidden=false;
    stream.getVideoTracks()[0].addEventListener('ended',()=>{
      if(session!==current||current.stream!==stream)return;
      stop(current);
      status.textContent='Захват остановлен. Снимки доступны для проверки.';
      update(current);
    });
    status.textContent='Откройте нужный экран сайта и нажмите «Снять кадр».';
  }catch(error){
    if(session===current)status.textContent=error.name==='NotAllowedError'
      ?'Доступ к вкладке не предоставлен. Можно выбрать её ещё раз.'
      :'Не удалось начать захват вкладки. Проверьте разрешения браузера.';
  }finally{
    current.busy=false;
    if(session===current)update(current);
  }
};

preview.onloadeddata=()=>{if(session)update(session);};

shot.onclick=async()=>{
  const current=session;
  if(!current.stream||!preview.videoWidth||preview.readyState<2)return;
  current.busy=true;
  update(current);
  try{
    const canvas=document.createElement('canvas');
    canvas.width=preview.videoWidth;
    canvas.height=preview.videoHeight;
    canvas.getContext('2d').drawImage(preview,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(session!==current||!dialog.open)return;
    if(!blob)throw Error('Не удалось снять кадр.');
    current.files.push(new File([blob],'Снимок '+(current.files.length+1)+'.png',{type:'image/png'}));
    status.textContent='Снимок добавлен. Можно снять следующий экран.';
  }catch(error){
    if(session===current)status.textContent=error.message;
  }finally{
    current.busy=false;
    if(session===current)update(current);
  }
};

review.onclick=async()=>{
  const current=session;
  current.busy=true;
  update(current);
  try{
    await current.onReview(current.files);
    dialog.close();
  }catch(error){
    status.textContent=error.message;
  }finally{
    current.busy=false;
    if(session===current)update(current);
  }
};

dialog.addEventListener('close',()=>{
  if(dialog.open||!session)return;
  stop(session);
  session=null;
});

root.ScenaCapture={open(onReview){
  if(session)stop(session);
  session={onReview,files:[],stream:null,busy:false};
  byId('capture-url').value='';
  status.textContent=navigator.mediaDevices?.getDisplayMedia?''
    :'Захват вкладки недоступен. Откройте конструктор по HTTPS в браузере с поддержкой захвата экрана.';
  update(session);
  dialog.showModal();
}};
})(window);
