import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { setupPush } from './push.mjs';
import { PushNotifications } from '@capacitor/push-notifications';
import { noticeDestination } from './push-inbox.mjs';
if(Capacitor.isNativePlatform()) {
  if(Capacitor.getPlatform()==='android'){
    void setupPush();
    void PushNotifications.addListener('pushNotificationActionPerformed',event=>{
      location.href=noticeDestination(event.notification.data?.destination)||'panel.html';
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
