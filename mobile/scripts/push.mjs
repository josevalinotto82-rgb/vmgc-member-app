import { PushNotifications } from '@capacitor/push-notifications';
import { connectInbox } from './push-inbox.mjs';

// Registro automático del dispositivo y casilla de avisos del jugador.
export async function setupPush() {
  if(!location.pathname.endsWith('/panel.html'))return;
  const style=document.createElement('style');
  style.textContent=`.header .logo{flex-shrink:0}.header>div{min-width:0}.club{font-size:clamp(17px,5vw,22px)}.club-bell{margin-left:auto;flex-shrink:0;width:44px;height:44px;border:1px solid #dce7dc;border-radius:50%;background:white;color:#166534;display:grid;place-items:center;position:relative}.club-bell svg{width:23px;height:23px}.club-bell[data-unread="true"]:after{content:'';position:absolute;right:7px;top:6px;width:8px;height:8px;background:#d99a1b;border:2px solid white;border-radius:50%}.club-notices{width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 48px);box-sizing:border-box;overflow:auto;border:0;border-radius:22px;padding:24px;color:#1f2937;background:#fff;box-shadow:0 20px 60px #0003}.club-notices::backdrop{background:#142b2266}.club-notices h2{margin:0;color:#166534;font-size:21px}.notice-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.notice-close{border:0;background:#f0f5f0;border-radius:50%;width:40px;height:40px;font-size:24px;color:#3e5740}.notice-enable{border:0;background:#166534;color:white;border-radius:12px;padding:13px 18px;font-size:16px;font-weight:600;width:100%}.notice-enable:disabled{opacity:.6}.club-notices p{font-size:15px;line-height:1.5}.notice-empty{padding:22px 12px;text-align:center;background:#f5f8f3;border-radius:14px;color:#647467}.club-notices details{margin-top:20px;font-size:13px;color:#647467}.club-notices textarea{box-sizing:border-box;width:100%;height:100px;margin-top:10px;font-size:16px}`;
  document.head.append(style);
  const bell=document.createElement('button');
  bell.type='button';bell.className='club-bell';bell.setAttribute('aria-label','Notificaciones');
  bell.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4M12 2V1"/></svg>';
  document.querySelector('.header')?.append(bell);
  const box=document.createElement('dialog');box.className='club-notices';box.setAttribute('aria-labelledby','notice-title');
  box.innerHTML='<div class="notice-heading"><h2 id="notice-title">Notificaciones</h2><button type="button" class="notice-close" aria-label="Cerrar">×</button></div><p>Recibí los avisos de torneos y resultados del club.</p><div class="notice-empty">Todavía no hay avisos nuevos.</div><p role="status"></p><details hidden><summary>Diagnóstico de notificaciones</summary><textarea readonly aria-label="Código del dispositivo"></textarea></details>';
  document.body.append(box);
  const refresh=connectInbox(box,bell);
  const copy=document.createElement('button');
  copy.type='button';copy.className='notice-enable';copy.textContent='Copiar código';
  box.querySelector('details').append(copy);
  copy.addEventListener('click',async()=>{
    const field=box.querySelector('textarea');
    try{await navigator.clipboard.writeText(field.value);copy.textContent='Código copiado';}
    catch{
      field.focus({preventScroll:true});field.select();
      copy.textContent=document.execCommand('copy')?'Código copiado':'Código seleccionado: usá Copiar';
    }
  });
  bell.addEventListener('click',()=>{box.showModal();bell.dataset.unread='false';box.querySelector('.notice-close').focus({preventScroll:true});});
  box.querySelector('.notice-close').addEventListener('click',()=>box.close());
  const status=box.querySelector('[role="status"]');
  const report=text=>{status.textContent=text;};
  let currentToken=null;
  let registrationTimer;
  const clearRegistrationTimer=()=>clearTimeout(registrationTimer);
  async function activate(){
    report('Activando notificaciones…');
    try{
      await listenersReady;
      let permission=await PushNotifications.checkPermissions();
      if(permission.receive==='prompt'||permission.receive==='prompt-with-rationale'){
        localStorage.setItem('vmgc-push-permission-asked','1');
        permission=await PushNotifications.requestPermissions();
      }
      if(permission.receive!=='granted'){
        report('Las notificaciones están desactivadas. Podés habilitarlas en los ajustes del teléfono.');return;
      }
      report('Conectando los avisos del club…');
      clearRegistrationTimer();
      registrationTimer=setTimeout(()=>{report('La conexión está tardando demasiado. Revisá internet y volvé a intentar.');},15000);
      await PushNotifications.register();
    }catch(error){clearRegistrationTimer();report('No se pudo activar: '+(error?.message||'revisá la conexión e intentá nuevamente.'));}
  }
  window.unregisterClubPush=async()=>{
    if(!currentToken)return;
    const result=await window.db.functions.invoke('club-notifications',{body:{action:'unregister',token:currentToken}});
    if(result.error||result.data?.error)throw Error('No se pudo desvincular el dispositivo. Intentá cerrar sesión nuevamente.');
    await PushNotifications.unregister();currentToken=null;
  };
  const listenersReady=(async()=>{
  await PushNotifications.addListener('registration',async token=>{
    currentToken=token.value;
    box.querySelector('textarea').value=token.value;
    box.querySelector('details').hidden=true;
    
    report('Conectando los avisos del club…');
    try{
      const result=await window.db.functions.invoke('club-notifications',{body:{action:'register',token:token.value}});
      if(result.error||result.data?.error)throw Error();
      clearRegistrationTimer();report('Notificaciones activadas.');
    }catch{clearRegistrationTimer();report('El permiso está concedido, pero falta conectar los avisos del club. Cerrá y volvé a abrir la app para reintentar.');}
  });
  await PushNotifications.addListener('registrationError',()=>{
    clearRegistrationTimer();
    report('No se pudo registrar el dispositivo. Revisá la conexión e intentá nuevamente.');
  });
  await PushNotifications.addListener('pushNotificationReceived',notification=>{
    box.querySelector('.notice-empty').textContent=[notification.title,notification.body].filter(Boolean).join(' — ');
    bell.dataset.unread=String(!box.open);
    if(notification.data?.notice_id)void refresh();
  });
  })();
  listenersReady.catch(error=>{report('No se pudo preparar las notificaciones: '+(error?.message||'intentá nuevamente.'));});
  // Pedir permiso una sola vez, con sesión iniciada, y registrar automáticamente.
  try {
    const {data:{session}}=await window.db.auth.getSession();
    if(!session)return;
    const permission=await PushNotifications.checkPermissions();
    if(permission.receive==='granted'){
      await activate();
    }else if((permission.receive==='prompt'||permission.receive==='prompt-with-rationale')&&!localStorage.getItem('vmgc-push-permission-asked')){
      await activate();
    }else if(permission.receive!=='granted'){
      report('Las notificaciones están desactivadas. Podés habilitarlas en los ajustes del teléfono.');
    }
  }catch{report('No se pudo conectar. Revisá internet y volvé a abrir la app.');}
}
