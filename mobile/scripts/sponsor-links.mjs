// El carrusel se detiene durante el toque para no perder el enlace bajo el dedo.
export function setupSponsorLinks(openExternal){
 const bar=document.querySelector('.sponsor-bar');if(!bar)return;
 let touch=null;
 const pause=()=>{const track=bar.querySelector('.sponsor-track');if(track)track.style.animationPlayState='paused';};
 const resume=()=>{const track=bar.querySelector('.sponsor-track');if(track)track.style.animationPlayState='';};
 bar.addEventListener('touchstart',event=>{
  pause();const link=event.target.closest('a[href]');
  if(event.touches.length!==1||!link){touch=null;return;}
  const point=event.touches[0];touch={id:point.identifier,x:point.clientX,y:point.clientY,href:link.href,moved:false};
 },{passive:true});
 bar.addEventListener('touchmove',event=>{if(!touch)return;const point=[...event.touches].find(t=>t.identifier===touch.id);if(!point||Math.hypot(point.clientX-touch.x,point.clientY-touch.y)>10)touch.moved=true;},{passive:true});
 bar.addEventListener('touchend',event=>{
  const current=touch;touch=null;resume();
  if(!current||current.moved||![...event.changedTouches].some(t=>t.identifier===current.id))return;
  if(event.cancelable)event.preventDefault();event.stopPropagation();void openExternal(current.href);
 },{passive:false});
 bar.addEventListener('touchcancel',()=>{touch=null;resume();});
}
