export function noticeDestination(value){
  try{const url=new URL(value,location.href);if(url.origin!==location.origin)return null;
    if(!['panel.html','torneos.html','grilla_interactiva.html'].includes(url.pathname.split('/').pop()))return null;
    return url.pathname+url.search;
  }catch{return null;}
}
export function connectInbox(box,bell,acknowledge=()=>{}){
  const list=box.querySelector('.notice-empty');
  let userId=null;
  let revision=0;
  const clean=document.createElement('button');clean.type='button';clean.textContent='Limpiar casilla';
  clean.style.cssText='border:0;background:transparent;color:#166534;padding:12px 0;font-size:15px';
  list.before(clean);clean.hidden=true;
  clean.addEventListener('click',async()=>{
    if(!confirm('¿Limpiar todos tus avisos actuales? Los avisos nuevos seguirán llegando.'))return;
    clean.disabled=true;
    try{const {error}=await window.db.rpc('club_notice_clear');if(error)throw error;await refresh();}
    catch{alert('No se pudo limpiar la casilla. Intentá nuevamente.');}
    finally{clean.disabled=false;}
  });
  async function refresh(){
    const request=++revision;
    try{
      const {data:{session}}=await window.db.auth.getSession();if(!session)return;
      userId=session.user.id;
      const {data,error}=await window.db.rpc('club_notice_inbox');
      if(error)throw error;
      if(request!==revision)return;
      list.replaceChildren();
      clean.hidden=!data.length;
      if(!data.length){list.textContent='No tenés avisos pendientes.';bell.dataset.unread='false';await acknowledge();return;}
      const read=localStorage.getItem('vmgc-notice-read:'+userId)||'';
      bell.dataset.unread=String(!box.open&&data[0].created_at>read);
      for(const notice of data){
        const item=document.createElement('article');item.style.cssText='text-align:left;padding:14px 0;border-bottom:1px solid #dce7dc';
        const title=document.createElement('strong');title.textContent=notice.title;
        const body=document.createElement('p');body.textContent=notice.body;
        const date=document.createElement('small');date.textContent=new Date(notice.created_at).toLocaleString('es-AR');
        item.append(title,date,body);date.style.cssText='display:block;margin-top:6px';
        const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.setAttribute('aria-label','Eliminar aviso: '+notice.title);
        remove.style.cssText='border:0;background:transparent;color:#8b3434;padding:10px 0;font-size:14px;display:block';
        remove.addEventListener('click',async()=>{
          remove.disabled=true;
          try{const {error}=await window.db.from('club_notice_hidden').upsert({user_id:userId,notice_id:notice.id});if(error)throw error;await refresh();}
          catch{remove.disabled=false;alert('No se pudo eliminar el aviso. Intentá nuevamente.');}
        });
        if(notice.image_url){const image=document.createElement('img');image.src=notice.image_url;image.alt='Flyer: '+notice.title;image.loading='lazy';image.style.cssText='width:100%;height:auto;border-radius:10px';item.append(image);}
        const destination=noticeDestination(notice.destination);
        if(destination&&!destination.endsWith('panel.html')){const link=document.createElement('a');link.href=destination;link.textContent='Ver torneo';item.append(link);}
        item.append(remove);list.append(item);
      }
      if(box.open){localStorage.setItem('vmgc-notice-read:'+userId,data[0].created_at);await acknowledge();}
    }catch{list.textContent='No se pudieron cargar los avisos. Volvé a abrir la campanita para intentar nuevamente.';}
  }
  bell.addEventListener('click',()=>void refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  void refresh();
  return refresh;
}
