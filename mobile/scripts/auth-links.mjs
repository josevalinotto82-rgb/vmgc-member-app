export const AUTH_SCHEME='ar.com.villamariagolf.members:';

export function authDestination(value) {
  let url;
  try { url=new URL(value); } catch { return null; }
  if(url.protocol!==AUTH_SCHEME || url.hostname!=='auth' || url.username || url.password || url.port)return null;
  const page={'/confirmado':'auth_confirmado.html','/recovery':'cambiar_password.html'}[url.pathname];
  if(!page)return null;
  const code=url.searchParams.get('code');
  const error=url.searchParams.get('error')||new URLSearchParams(url.hash.slice(1)).get('error');
  if(!code && !error)return null;
  const params=new URLSearchParams();
  if(code)params.set('code',code);
  else params.set('error_code','invalid_link');
  return `${page}?${params}`;
}

export async function setupAuthLinks(App) {
  let queue=Promise.resolve();
  const handle=value=>{
    queue=queue.then(async()=>{
      const destination=authDestination(value);
      if(!destination)return;
      // A launch URL survives page changes. Store only a digest to avoid replaying it.
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
      const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      if(sessionStorage.getItem('vmgc-auth-link')===key)return;
      sessionStorage.setItem('vmgc-auth-link',key);
      globalThis.vmgcAuthNavigating=true;
      location.replace(destination);
    }).catch(()=>{console.warn('No se pudo abrir el enlace de ingreso.');});
    return queue;
  };
  await App.addListener('appUrlOpen',event=>{void handle(event.url);});
  const launch=await App.getLaunchUrl();
  if(launch?.url)await handle(launch.url);
}
