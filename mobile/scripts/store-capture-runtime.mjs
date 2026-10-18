import '../src/shared-back.js';
import {setupMobileDesign} from './mobile-design.mjs';
// Sólo se incluye en la compilación aislada para capturas. Nunca consulta la base real.
const scene=window.__VMGC_STORE_CAPTURE__;
if(!['inicio','perfil','hcp'].includes(scene))throw Error('Escena de captura inválida');
setupMobileDesign();
const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
if(scene==='inicio'){
 set('welcomeTitle','Buen día.');set('memberName','JUGADOR DE EJEMPLO');
 const style=document.createElement('style');style.textContent='.club-bell{margin-left:auto;flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;position:relative}.club-bell svg{width:23px;height:23px}';document.head.append(style);
 const bell=document.createElement('button');bell.type='button';bell.className='club-bell';bell.setAttribute('aria-label','Notificaciones');bell.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';document.querySelector('.header').append(bell);
}else{
 const values={profileName:'Jugador de ejemplo',profileMatricula:'00000',profileIndex:'12,4',profileLowIndex:'10,6',profileBornDate:'01/01/1990',profileDocNumber:'00000000',profileEmail:'demo@example.com',profilePhone:'0000000000'};
 for(const [id,value] of Object.entries(values))set(id,value);
 // Las valoraciones son las mismas de VMGC mostradas por la app; el jugador es ficticio.
 const tees=[{name:'Negro',color:'negras',slope:131,rating:70.8},{name:'Amarillo',color:'amarillas',slope:129,rating:70.2},{name:'Blanco',color:'blancas',slope:125,rating:66.9}];
 document.getElementById('hcpVMGC').innerHTML=tees.map(tee=>{
  const hcp=Math.min(54,Math.round(12.4*tee.slope/113+tee.rating-72));
  return '<div class="hcp-card stone-'+tee.color+'"><div><div class="hcp-title">Salidas '+tee.name+'</div><div class="hcp-detail"><div class="tee-index">Index <strong>12,4</strong></div><div class="tee-course"><span>Slope <strong>'+tee.slope+'</strong></span><span>Rating <strong>'+String(tee.rating).replace('.',',')+'</strong></span><span>Par <strong>72</strong></span></div></div></div><div class="hcp-number">'+hcp+'</div></div>';
 }).join('');
}
// Esperar fuentes e imágenes antes de avisar al simulador que puede capturar.
await document.fonts.ready;
await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
document.querySelectorAll('.sponsor-track').forEach(track=>track.style.animationPlayState='paused');
if(scene==='hcp')document.getElementById('hcpVMGC').closest('section').scrollIntoView({block:'start'});
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const ready={scene,ready:true,width:innerWidth,height:innerHeight};window.__VMGC_CAPTURE_READY__=ready;
window.webkit?.messageHandlers?.vmgcCaptureReady?.postMessage(ready);
