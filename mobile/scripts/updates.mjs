import {updatePolicy} from './update-policy.mjs';
export function setupUpdates(Capacitor,App,Browser){
 const platform=Capacitor.getPlatform();if(!['ios','android'].includes(platform))return;
 // Android se distribuye actualmente por la prueba cerrada Alpha.
 const channel=platform==='android'?'alpha':'production';
 let checking=false,lastCheck=0,dialog=null;
 async function check(){
  if(checking||Date.now()-lastCheck<15*60*1000||navigator.onLine===false||!window.db)return;
  checking=true;lastCheck=Date.now();
  try{
   const [info,result]=await Promise.all([App.getInfo(),window.db.from('mobile_app_releases').select('*').eq('platform',platform).eq('channel',channel).maybeSingle()]);
   if(result.error) return;const policy=updatePolicy(info,result.data,platform,channel);if(!policy||dialog?.open)return;
   const dismissed=Number(localStorage.getItem('vmgc-update-dismiss:'+policy.key)||0);
   if(!policy.mandatory&&Date.now()-dismissed<24*60*60*1000)return;
   dialog=document.createElement('dialog');dialog.className='mobile-update';dialog.setAttribute('aria-labelledby','mobile-update-title');
   const symbol=document.createElement('div');symbol.className='update-symbol';symbol.textContent='↗';symbol.setAttribute('aria-hidden','true');
   const eyebrow=document.createElement('span');eyebrow.className='mobile-eyebrow';eyebrow.textContent='VILLA MARÍA GOLF';
   const title=document.createElement('h2');title.id='mobile-update-title';title.textContent='Tu club se renueva.';
   const text=document.createElement('p');text.textContent=policy.message||'Hay una nueva versión de la app con mejoras para tu juego.';
   const version=document.createElement('small');version.textContent='Versión '+policy.version+' · '+(platform==='ios'?'App Store':'Google Play');
   const button=document.createElement('button');button.className='update-now';button.textContent='Actualizar la app ↗';button.onclick=()=>void Browser.open({url:policy.url});
   dialog.append(symbol,eyebrow,title,text,version,button);
   if(!policy.mandatory){const later=document.createElement('button');later.className='update-later';later.textContent='Recordarme mañana';later.onclick=()=>{localStorage.setItem('vmgc-update-dismiss:'+policy.key,String(Date.now()));dialog.close();};dialog.append(later);}
   else{dialog.dataset.required='true';const note=document.createElement('p');note.className='update-required';note.textContent='Esta actualización es necesaria para seguir usando la app.';dialog.append(note);dialog.addEventListener('cancel',event=>event.preventDefault());}
   dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  }catch{/* Sin conexión o sin publicación confirmada, la app sigue funcionando. */}finally{checking=false;}
 }
 let attempts=0;const ready=setInterval(()=>{if(window.db||++attempts>=30){clearInterval(ready);void check();}},500);
 void App.addListener('appStateChange',({isActive})=>{if(isActive)void check();});
 window.addEventListener('online',()=>{lastCheck=0;void check();});
}
