import '../src/shared-back.js';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { setupPush } from './push.mjs';
import { PushNotifications } from '@capacitor/push-notifications';

import { setupAuthLinks } from './auth-links.mjs';
if(Capacitor.isNativePlatform()) {
  window.nativeAuthReady=setupAuthLinks(App).catch(()=>console.warn('No se pudo preparar el regreso desde el correo.'));
  if(Capacitor.getPlatform()==='android') {
    const autofill=registerPlugin('ClubAutofill');
    window.commitClubLogin=async()=>{
      try { await autofill.commit(); } catch { console.warn('No se pudo avisar al autocompletado del teléfono.'); }
    };
  }
  if(Capacitor.getPlatform()==='ios' && document.getElementById('loginForm')) {
    const credentials=registerPlugin('ClubCredentials');
    const button=document.createElement('button');
    button.type='button';button.textContent='Usar contraseña guardada';
    button.style.marginTop='12px';
    document.getElementById('loginForm').append(button);
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try {
        const result=await credentials.savedPassword();
        if(!result.cancelled && result.username && result.password) {
          document.getElementById('email').value=result.username;
          document.getElementById('password').value=result.password;
          document.getElementById('loginBtn').focus();
        }
      } catch {
        document.getElementById('msg').textContent='No se encontró una contraseña guardada. Podés ingresar con tu email y contraseña.';
      } finally {button.disabled=false;}
    });
  }
  if(['android','ios'].includes(Capacitor.getPlatform())){
    void setupPush();
    void PushNotifications.addListener('pushNotificationActionPerformed',event=>{
      sessionStorage.setItem('vmgc-pending-notice',JSON.stringify(event.notification));
      if(location.pathname.endsWith('/panel.html') && window.openClubNotice) window.openClubNotice();
      else location.href='panel.html';
    });
  }
  const external = async value => {
    const url=new URL(value,location.href);
    if(!['https:','http:'].includes(url.protocol))return;
    try{await Browser.open({url:url.href});}catch{console.warn('No se pudo abrir el enlace externo.');}
  };
  const originalOpen=window.open.bind(window);
  window.open=(url,target,features)=>{
    const parsed=new URL(url,location.href);
    if(parsed.origin!==location.origin && ['https:','http:'].includes(parsed.protocol)){void external(parsed.href);return null;}
    return originalOpen(url,target,features);
  };
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');if(!link)return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin && ['https:','http:'].includes(url.protocol)){event.preventDefault();void external(url.href);}
  });
  if(Capacitor.getPlatform()==='android')App.addListener('backButton',({canGoBack})=>{
    const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return;}
    const page=location.pathname.split('/').pop();
    if(page==='torneos.html' && new URLSearchParams(location.search).get('origen')==='estadisticas'){location.href='estadisticas.html';return;}
    if(['index.html','login.html','panel.html',''].includes(page)){void App.minimizeApp();return;}
    if(canGoBack)history.back();else location.href='panel.html';
  });
}
