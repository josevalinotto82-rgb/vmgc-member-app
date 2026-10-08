(function(){
 function setup(){
  for(const back of document.querySelectorAll(".floating-back-btn, header a.back, .container>a.back, main.app>button.back")){
   back.classList.add('native-back');
   if(!back.hasAttribute('aria-label'))back.setAttribute('aria-label',back.textContent.trim()||'Volver a la pantalla anterior');
   back.setAttribute('title','Volver');
   back.innerHTML="<svg viewBox=\"0 0 24 36\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 5 5 18l11 13\"/></svg>";
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
