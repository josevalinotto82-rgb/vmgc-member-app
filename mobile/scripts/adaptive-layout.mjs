// Detect real text layout, including Android WebView text zoom. Never reduce
// the user's chosen font scale to force content into fixed-height cards.
export function setupAdaptiveLayout(){
 if(document.documentElement.dataset.adaptiveReady)return;
 document.documentElement.dataset.adaptiveReady='true';
 const root=document.documentElement,probe=document.createElement('span');
 probe.setAttribute('aria-hidden','true');probe.className='club-text-probe';probe.textContent='Ag';
 probe.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;font:16px/normal sans-serif;white-space:nowrap';document.body.append(probe);
 let pending=false,lastWidth=innerWidth;
 function overlaps(element){return element&&element.clientWidth>0&&(element.scrollWidth>element.clientWidth+2||element.scrollHeight>element.clientHeight+2);}
 function check(){
  pending=false;
  if(innerWidth!==lastWidth){root.classList.remove('club-large-text');lastWidth=innerWidth;}
  if(root.classList.contains('club-large-text'))return;
  let enlarged=probe.getBoundingClientRect().height>24;
  const cards=[...document.querySelectorAll('.app-card')];
  enlarged ||= cards.some(card=>{
   const box=card.getBoundingClientRect(),title=card.querySelector('.app-card-title'),desc=card.querySelector('.app-card-desc');
   return overlaps(card)||[title,desc].some(text=>text&&(text.getBoundingClientRect().bottom>box.bottom-5||overlaps(text)));
  });
  const hero=document.querySelector('.welcome'),caption=hero?.querySelector('.mobile-hero-caption'),name=hero?.querySelector('.member-name');
  if(hero&&name&&caption)enlarged ||= name.getBoundingClientRect().bottom>caption.getBoundingClientRect().top-3;
  enlarged ||= [...document.querySelectorAll('.mini-value,.contact-value,.tee-course')].some(overlaps);
  if(enlarged)root.classList.add('club-large-text');
 }
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(check);}};
 const resize=new ResizeObserver(schedule);resize.observe(document.body);resize.observe(probe);
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
 window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);schedule();
}
