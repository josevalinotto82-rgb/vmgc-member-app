// Esta identidad se incorpora únicamente al paquete nativo.
export function setupMobileDesign(){
 document.documentElement.classList.add('club-mobile');
 const page=location.pathname.split('/').pop()?.replace('.html','')||'index';
 document.body.dataset.nativePage=page;
 if(page==='panel'){
  const welcome=document.querySelector('.welcome');
  if(welcome){
   const eyebrow=document.createElement('div');eyebrow.className='mobile-eyebrow';eyebrow.textContent='TU CLUB. TU JUEGO.';welcome.prepend(eyebrow);
   const caption=document.createElement('span');caption.className='mobile-hero-caption';caption.textContent='Villa María Golf Club';welcome.append(caption);
  }
  const icons=['flag','tee','chart','user'];
  const paths={flag:'M5 21V3m0 1c6-4 8 4 14 0v9c-6 4-8-4-14 0',tee:'M5 6h14M12 6v15M8 21h8M8 3h8',chart:'M4 20h17M7 16v-5M12 16V7M17 16V3',user:'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0'};
  document.querySelectorAll('.app-card').forEach((card,index)=>{
   const icon=document.createElement('span');icon.className='mobile-card-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[icons[index]]+'"/></svg>';card.prepend(icon);
   const arrow=document.createElement('span');arrow.className='mobile-card-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');card.append(arrow);
  });
 }
}
