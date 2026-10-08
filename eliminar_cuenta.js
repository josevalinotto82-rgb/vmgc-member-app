(async()=>{
  const form=document.getElementById('deleteForm'),button=document.getElementById('deleteButton'),status=document.getElementById('deleteStatus'),password=document.getElementById('password'),email=document.getElementById('email');
  const initial=await db.auth.getSession();
  if(!initial.data.session){document.getElementById('emailField').hidden=false;email.required=true;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!confirm('¿Eliminar tu cuenta de Villa Maria Golf?'))return;
    button.disabled=true;status.textContent='Procesando…';
    try{
      const {data:{session}}=await db.auth.getSession();
      if(!session){const login=await db.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(login.error)throw Error('Revisá tu email y contraseña.');}
      const result=await db.functions.invoke('delete-app-account',{body:{confirm:true,password:password.value}});
      if(result.error){let detail;try{detail=await result.error.context?.json();}catch{}throw Error(detail?.error||'No se pudo eliminar la cuenta. Intentá nuevamente.');}
      if(result.data?.error)throw Error(result.data.error);
      if(result.data?.ok!==true)throw Error('No se pudo confirmar la eliminación.');
      password.value='';
      await db.auth.signOut({scope:'local'});
      form.replaceChildren();status.textContent='Tu cuenta fue eliminada.';form.append(status);
      const link=document.createElement('a');link.href='registro.html';link.textContent='Registrarme nuevamente';form.append(link);
    }catch(error){status.textContent=error.message;button.disabled=false;}
  });
})();
