import * as supabase from '@supabase/supabase-js';
window.supabase = {...supabase, createClient(url,key,options={}) {
  const native=window.Capacitor?.isNativePlatform();
  return supabase.createClient(url,key,{...options,auth:{
    persistSession:true,autoRefreshToken:true,
    ...(native ? {flowType:'pkce'} : {}),...options.auth
  }});
}};
