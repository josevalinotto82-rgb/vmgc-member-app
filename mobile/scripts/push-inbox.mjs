export function noticeDestination(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{const url=new URL(value,location.href);
    if(url.origin===location.origin && ['panel.html','torneos.html','grilla_interactiva.html','torneos_para_anotarse.html','resultados.html','estadisticas.html'].includes(url.pathname.split('/').pop()))return url.pathname+url.search+url.hash;
    if(['https:','http:'].includes(url.protocol) && !url.username && !url.password)return url.href;
    return null;
  }catch{return null;}
}
export function appendNoticeBody(node,value){
  const text=String(value||'');let offset=0;
  for(const match of text.matchAll(/https?:\/\/[^\s<>]+|www\.[^\s<>]+/gi)){
    const label=match[0].replace(/[.,;:!?)}\]]+$/,'');
    node.append(document.createTextNode(text.slice(offset,match.index)));
    const destination=noticeDestination(label.startsWith('www.')?'https://'+label:label);
    if(destination){const link=document.createElement('a');link.href=destination;link.textContent=label;link.style.overflowWrap='anywhere';node.append(link);}
    else node.append(document.createTextNode(label));
    offset=match.index+label.length;
  }
  node.append(document.createTextNode(text.slice(offset)));
}
export function connectInbox(box,bell,acknowledge=()=>{}){
 const list=box.querySelector('.notice-empty');list.classList.add('notice-list');
 let userId=null,revision=0,installation=null,legacy=false;
 const generationKey='vmgc-mobile-inbox-generation';
 // Guardar el estado anterior antes de pedir permisos por primera vez.
 if(!localStorage.getItem(generationKey))localStorage.setItem(generationKey,localStorage.getItem('vmgc-push-permission-asked')?'legacy':'fresh');
 const upgrading=localStorage.getItem(generationKey)==='legacy';
 const toolbar=document.createElement('div');toolbar.className='notice-tools';
 const count=document.createElement('span');count.className='notice-count';
 const clean=document.createElement('button');clean.type='button';clean.className='notice-clear';clean.innerHTML='<span aria-hidden="true">⌫</span> Limpiar casilla';
 toolbar.append(count,clean);list.before(toolbar);clean.hidden=true;
 const confirmation=document.createElement('div');confirmation.className='notice-confirm';confirmation.hidden=true;
 confirmation.innerHTML='<strong>¿Limpiar tu casilla?</strong><p>Los avisos nuevos seguirán llegando.</p><button type="button" data-clear-yes>Limpiar avisos</button><button type="button" data-clear-no>Cancelar</button>';
 toolbar.after(confirmation);
 clean.onclick=()=>{confirmation.hidden=false;confirmation.querySelector('[data-clear-yes]').focus();};
 confirmation.querySelector('[data-clear-no]').onclick=()=>{confirmation.hidden=true;clean.focus();};
 const status=box.querySelector('[role="status"]');
 const report=message=>{if(status)status.textContent=message;};
 confirmation.querySelector('[data-clear-yes]').onclick=async()=>{
  const button=confirmation.querySelector('[data-clear-yes]');button.disabled=true;
  try{const {error}=await window.db.rpc('mobile_notice_clear',{p_installation:installation});if(error)throw error;confirmation.hidden=true;await refresh();report('Casilla limpia.');}
  catch{report('No pudimos limpiar los avisos. Intentá nuevamente.');}finally{button.disabled=false;}
 };
 const empty=()=>{list.innerHTML='<div class="notice-welcome"><span class="notice-welcome-symbol" aria-hidden="true">✦</span><h3>Lo nuevo del club, acá.</h3><p>Desde ahora vas a encontrar tus avisos de torneos y resultados en esta casilla.</p><div class="notice-help"><span>←</span>Deslizá un aviso hacia la izquierda para eliminarlo. Si lo deslizás hasta el final, se elimina directamente.</div><small>Los avisos se conservan durante 14 días.</small></div>';};
 async function refresh(selectedId){
  const request=++revision;
  try{
   const {data:{session}}=await window.db.auth.getSession();if(!session){list.replaceChildren();clean.hidden=true;return false;}
   userId=session.user.id;
   const key='vmgc-mobile-inbox-installation:'+userId;
   installation=localStorage.getItem(key);
   if(!installation){installation=crypto.randomUUID();legacy=upgrading||!!localStorage.getItem('vmgc-notice-read:'+userId);localStorage.setItem(key,installation);localStorage.setItem(key+':legacy',String(legacy));}
   legacy=localStorage.getItem(key+':legacy')==='true';
   const {data:payload,error}=await window.db.rpc('mobile_notice_inbox',{p_installation:installation,p_existing:legacy});if(error)throw error;
   if(request!==revision)return false;
   const data=payload?.notices||[];
   list.replaceChildren();clean.hidden=!data.length;count.textContent=data.length?data.length+' '+(data.length===1?'aviso':'avisos'):'Tu casilla';
   if(!data.length){empty();bell.dataset.unread='false';if(box.open)await acknowledge();return false;}
   const read=localStorage.getItem('vmgc-notice-read:'+userId)||'';
   bell.dataset.unread=String(!box.open&&data.some(n=>n.created_at>read));
   for(const notice of data){
    const item=document.createElement('article');item.className='notice-card';item.dataset.noticeId=String(notice.id);
    const remove=document.createElement('button');remove.type='button';remove.className='notice-remove';remove.setAttribute('aria-label','Eliminar aviso: '+notice.title);remove.innerHTML='<span aria-hidden="true">⌫</span><span>Eliminar</span>';
    const content=document.createElement('div');content.className='notice-content';
    const tag=document.createElement('span');tag.className='notice-tag';tag.textContent='VILLA MARÍA GOLF';
    const title=document.createElement('h3');title.textContent=notice.title;
    const date=document.createElement('time');date.dateTime=notice.created_at;date.textContent=new Date(notice.created_at).toLocaleString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const body=document.createElement('p');body.className='notice-body';appendNoticeBody(body,notice.body);
    content.append(tag,date,title,body);
    if(notice.image_url){const image=document.createElement('img');image.src=notice.image_url;image.alt='Flyer: '+notice.title;image.loading='lazy';content.append(image);}
    const destination=noticeDestination(notice.destination);
    if(destination){const link=document.createElement('a');link.href=destination;link.className='notice-action';link.innerHTML='<span>Ver información</span><span aria-hidden="true">↗</span>';content.append(link);}
    item.append(remove,content);list.append(item);
    let deleting=false;
    const erase=async()=>{
     if(deleting)return;deleting=true;remove.disabled=true;item.classList.add('notice-deleting');
     try{const {error}=await window.db.from('mobile_notice_hidden').upsert({user_id:userId,notice_id:notice.id},{onConflict:'user_id,notice_id',ignoreDuplicates:true});if(error)throw error;await refresh();report('Aviso eliminado.');}
     catch{deleting=false;remove.disabled=false;item.classList.remove('notice-deleting');content.style.transform='';report('No pudimos eliminar el aviso. Intentá nuevamente.');}
    };
    remove.onclick=erase;
    remove.addEventListener('focus',()=>{content.style.transform='translateX(-88px)';});
    let drag=null,moved=false;
    const begin=(id,x,y,target)=>{
     if(deleting||target.closest('a,button'))return;
     drag={id,x,y,axis:null,dx:0};moved=false;
    };
    const move=(id,x,y,event)=>{
     if(!drag||drag.id!==id)return;
     const dx=x-drag.x,dy=y-drag.y;
     if(!drag.axis&&Math.hypot(dx,dy)>9){drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(drag.axis==='x')content.classList.add('notice-dragging');}
     if(drag.axis!=='x')return;
     if(event.cancelable)event.preventDefault();
     moved=true;drag.dx=Math.min(0,Math.max(-content.clientWidth,dx));content.style.transform='translateX('+drag.dx+'px)';item.classList.toggle('notice-full-delete',-drag.dx>content.clientWidth*.68);
    };
    const finish=(id,cancelled=false)=>{
     if(!drag||drag.id!==id)return;
     const complete=!cancelled&&drag.axis==='x'&&-drag.dx>content.clientWidth*.68;
     const opened=!cancelled&&drag.axis==='x'&&drag.dx<-40;
     drag=null;content.classList.remove('notice-dragging');item.classList.remove('notice-full-delete');
     if(complete)void erase();else content.style.transform=opened?'translateX(-88px)':'';
    };
    // WKWebView: usar el contacto real y cancelar sólo el desplazamiento horizontal.
    content.addEventListener('touchstart',event=>{
     if(event.touches.length!==1){if(drag)finish(drag.id,true);return;}
     const touch=event.touches[0];begin(touch.identifier,touch.clientX,touch.clientY,event.target);
    },{passive:true});
    content.addEventListener('touchmove',event=>{
     if(!drag)return;
     if(event.touches.length!==1){finish(drag.id,true);return;}
     const touch=[...event.touches].find(t=>t.identifier===drag.id);
     if(touch)move(touch.identifier,touch.clientX,touch.clientY,event);
    },{passive:false});
    for(const type of ['touchend','touchcancel'])content.addEventListener(type,event=>{
     if(!drag)return;
     const touch=[...event.changedTouches].find(t=>t.identifier===drag.id);
     if(touch)finish(touch.identifier,type==='touchcancel');
    });
    content.addEventListener('pointerdown',event=>{
     if(event.pointerType==='touch'||event.button!==0)return;
     begin(event.pointerId,event.clientX,event.clientY,event.target);
     if(drag){try{content.setPointerCapture(event.pointerId);}catch{}}
    });
    content.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')move(event.pointerId,event.clientX,event.clientY,event);});
    content.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')finish(event.pointerId);});
    content.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')finish(event.pointerId,true);});
    content.addEventListener('click',event=>{if(moved){event.preventDefault();event.stopPropagation();moved=false;}else if(content.style.transform){content.style.transform='';}},true);
   }
   const selected=selectedId?[...list.children].find(n=>n.dataset.noticeId===String(selectedId)):null;
   if(selected){selected.classList.add('notice-selected');selected.scrollIntoView({block:'nearest'});}
   if(box.open){localStorage.setItem('vmgc-notice-read:'+userId,data[0].created_at);await acknowledge();}
   return selectedId?!!selected:true;
  }catch{list.innerHTML='<div class="notice-welcome"><h3>No pudimos conectar.</h3><p>Volvé a abrir la casilla para intentar nuevamente.</p></div>';clean.hidden=true;return false;}
 }
 bell.addEventListener('click',()=>void refresh());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{if(!document.hidden)void refresh();},5*60*1000);
 void refresh();return refresh;
}
