import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { createSessionStorage } from './session-storage.mjs';
const native=Capacitor.isNativePlatform();
const page=location.pathname.split('/').pop()?.replace('.html','')||'index';
if(native){
 const vault=registerPlugin('ClubSession');
 let gate;
 const waitDom=()=>document.readyState==='loading'?new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true})):Promise.resolve();
 const unblock=()=>document.documentElement.classList.remove('club-starting');
 window.finishClubStartup=unblock;
 async function unlock(){
  try{return await vault.open();}
  catch(error){
   await waitDom();
   return new Promise(resolve=>{
    const box=document.createElement('div');box.className='club-access-lock';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    box.innerHTML='<img src="escudo.png" alt="Villa María Golf Club"><h1>Tu club, a un paso.</h1><p>Desbloqueá tu acceso para continuar.</p><button type="button" data-unlock>Volver a intentar</button><button type="button" data-password>Ingresar con contraseña</button><p role="status"></p>';
    const siblings=[...document.body.children];for(const node of siblings)node.inert=true;
    document.body.append(box);unblock();
    const retry=box.querySelector('[data-unlock]'),password=box.querySelector('[data-password]'),status=box.querySelector('[role=status]');
    retry.onclick=async()=>{retry.disabled=password.disabled=true;try{const result=await vault.open();for(const node of siblings)node.inert=false;box.remove();resolve(result);}catch{status.textContent='No se pudo desbloquear. Podés volver a intentar o ingresar con contraseña.';}finally{retry.disabled=password.disabled=false;}};
    password.onclick=async()=>{retry.disabled=password.disabled=true;try{await vault.reset();for(const key of Object.keys(localStorage))if(key.startsWith('sb-'))localStorage.removeItem(key);sessionStorage.removeItem('vmgc-auth-link');localStorage.removeItem('vmgc_nombre_socio');location.replace('login.html');}catch{status.textContent='No pudimos preparar el ingreso. Volvé a intentarlo.';retry.disabled=password.disabled=false;}};
   });
  }
 }
 gate=unlock();
 const storage=createSessionStorage(vault,()=>gate,localStorage);
 window.clubAuthOptions={storage,persistSession:true,autoRefreshToken:true};
 window.clubSessionReady=gate;
 window.clearClubSession=async()=>{await vault.reset();for(const key of Object.keys(localStorage))if(key.startsWith('sb-'))localStorage.removeItem(key);};
 // Main-thread callbacks cannot await Supabase auth methods while its lock is held.
 window.addEventListener('DOMContentLoaded',async()=>{
  await gate;
  await window.nativeAuthReady;
  if(window.vmgcAuthNavigating)return;
  if(window.db?.auth){
   const {data,error}=await window.db.auth.getSession();
   if(error){unblock();return;}
   if(['index','login'].includes(page)&&data.session&&!window.vmgcAuthNavigating){location.replace('panel.html');return;}
   if(page==='index'){location.replace('login.html');return;}
   if(['panel','mi_perfil','grilla_interactiva','estadisticas','resultados','torneos_para_anotarse','torneos'].includes(page)&&!data.session){location.replace('login.html');return;}
  }
  requestAnimationFrame(()=>requestAnimationFrame(unblock));
  if(page==='mi_perfil')await profileBiometrics(vault).catch(()=>console.warn('No se pudo consultar el acceso biométrico.'));
 });
 async function profileBiometrics(plugin){
  const {data}=await window.db.auth.getSession();if(!data.session)return;
  const info=await plugin.status();
  const box=document.createElement('section');box.className='card club-biometric-settings';
  box.innerHTML='<h2>Acceso al club</h2><p>Desbloqueá la app con la biometría de este teléfono. Se vuelve a solicitar al abrirla o después de un minuto fuera de la app.</p><button type="button"></button><p role="status"></p>';
  const button=box.querySelector('button'),message=box.querySelector('[role=status]');let enabled=info.enabled;
  const label=info.label||'huella o reconocimiento facial';
  const render=()=>{button.textContent=enabled?'Desactivar '+label:'Activar '+label;button.disabled=!info.available&&!enabled;if(!info.available&&!enabled)message.textContent='Configurá una biometría compatible en los ajustes del teléfono para activar esta opción.';};render();
  button.onclick=async()=>{button.disabled=true;message.textContent='';try{const result=await plugin.configure({enabled:!enabled});enabled=result.enabled;message.textContent=enabled?'Acceso biométrico activado en este teléfono.':'Acceso biométrico desactivado.';}catch{message.textContent='No se cambió la configuración. Podés volver a intentarlo.';}finally{render();}};
  const anchor=document.getElementById('btnSavePassword')?.closest('section');if(anchor)anchor.before(box);else document.body.append(box);
 }
 // Cover immediately when leaving; a short interruption does not prompt again.
 let backgroundAt=0;
 void App.addListener('appStateChange',async({isActive})=>{
  if(!isActive){backgroundAt=Date.now();window.db?.auth.stopAutoRefresh();document.documentElement.classList.add('club-starting');return;}
  if(backgroundAt&&Date.now()-backgroundAt>=60000){gate=unlock();window.clubSessionReady=gate;await gate;}
  backgroundAt=0;window.db?.auth.startAutoRefresh();unblock();
 });
}

if(!native)document.documentElement.classList.remove('club-starting');
