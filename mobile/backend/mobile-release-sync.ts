import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const packageName='ar.com.villamariagolf.members';
const appleId=6818911765;
const encoder=new TextEncoder();
function base64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function versionCompare(a:string,b:string){
 if(!/^\d+(?:\.\d+){0,3}$/.test(a)||!/^\d+(?:\.\d+){0,3}$/.test(b))return null;
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<Math.max(x.length,y.length);i++)if((x[i]||0)!==(y[i]||0))return Math.sign((x[i]||0)-(y[i]||0));return 0;
}
async function json(url:string,options:RequestInit={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return await response.json();
}
async function writeRelease(row:Record<string,unknown>){
 const {data:previous,error:readError}=await db.from('mobile_app_releases').select('latest_version,latest_build').eq('platform',row.platform).eq('channel',row.channel).maybeSingle();
 if(readError)throw Error('Database read failed');
 if(previous){
  const older=row.platform==='android'?Number(row.latest_build)<Number(previous.latest_build):versionCompare(String(row.latest_version),previous.latest_version)===-1;
  if(older)return 'Retained newer confirmed version';
 }
 // Actualizar sólo los campos detectados: las reglas mínimas manuales se conservan.
 const {error}=await db.from('mobile_app_releases').upsert({...row,checked_at:new Date().toISOString()},{onConflict:'platform,channel'});
 if(error)throw Error('Database write failed');return 'Published version confirmed';
}
async function apple(){
 const data=await json('https://itunes.apple.com/lookup?id='+appleId+'&country=ar');
 const app=data.results?.find((item:any)=>item.trackId===appleId&&item.bundleId===packageName);
 if(!app||!/^\d+(?:\.\d+){0,3}$/.test(app.version))throw Error('Public app listing unavailable');
 await writeRelease({platform:'ios',channel:'production',latest_version:app.version,store_url:'https://apps.apple.com/ar/app/villa-maria-golf/id'+appleId,published_at:app.currentVersionReleaseDate||new Date().toISOString()});
 return {ok:true,version:app.version};
}
async function google(){
 const raw=Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT')||Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
 if(!raw)return {ok:false,reason:'Service account required'};
 let service:any;try{service=JSON.parse(raw);}catch{return {ok:false,reason:'Invalid service account configuration'};}
 const email=service.client_email;
 if(!email||!service.private_key)return {ok:false,reason:'Incomplete service account configuration'};
 try{
  const seconds=Math.floor(Date.now()/1000);
  const header=base64url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=base64url(encoder.encode(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+3600})));
  const pem=service.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const unsigned=header+'.'+payload;
  const signed=base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(unsigned))));
  const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signed})});
  const headers={Authorization:'Bearer '+token.access_token,'content-type':'application/json'};
  const root='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+packageName;
  // La edición se usa para leer el estado actual y se descarta; nunca se publica.
  const edit=await json(root+'/edits',{method:'POST',headers,body:'{}'});
  const channels:Record<string,unknown>={};
  try{
   for(const channel of ['alpha','production']){
    try{
     const [lifecycle,track]=await Promise.all([json(root+'/tracks/'+channel+'/releases',{headers}),json(root+'/edits/'+edit.id+'/tracks/'+channel,{headers})]);
     const published=new Set((lifecycle.releases||[]).filter((release:any)=>release.releaseLifecycleState==='RELEASE_LIFECYCLE_STATE_PUBLISHED').flatMap((release:any)=>(release.activeArtifacts||[]).map((a:any)=>Number(a.versionCode))));
     const candidates=(track.releases||[]).filter((release:any)=>release.status==='completed').flatMap((release:any)=>(release.versionCodes||[]).map((code:string)=>({code:Number(code),name:release.name||''}))).filter((r:any)=>published.has(r.code));
     candidates.sort((a:any,b:any)=>b.code-a.code);
     const newest=candidates[0];if(!newest){channels[channel]={ok:true,available:false};continue;}
     // Si el nombre no contiene versión, mostrar código de compilación sin adivinar.
     const version=newest.name.match(/\b\d+\.\d+(?:\.\d+){0,2}\b/)?.[0]||String(newest.code);
     await writeRelease({platform:'android',channel,latest_version:version,latest_build:newest.code,store_url:'https://play.google.com/store/apps/details?id='+packageName});
     channels[channel]={ok:true,version,build:newest.code};
    }catch(error){channels[channel]={ok:false,reason:error instanceof Error?error.message:'Store check failed'};}
   }
  }finally{await fetch(root+'/edits/'+edit.id,{method:'DELETE',headers,signal:AbortSignal.timeout(10000)}).catch(()=>{});}
  return {service_account:email,channels};
 }catch(error){return {ok:false,service_account:email,reason:error instanceof Error?error.message:'Store check failed'};}
}
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const supplied=request.headers.get('x-vmgc-sync');if(!supplied)return new Response('Unauthorized',{status:401});
 const {data:state,error}=await db.from('mobile_release_sync_state').select('token,last_attempt').eq('id',1).single();
 if(error||!state)return new Response('Unavailable',{status:503});
 const equal=supplied.length===state.token.length&&supplied.split('').reduce((value,char,index)=>value|(char.charCodeAt(0)^state.token.charCodeAt(index)),0)===0;
 if(!equal)return new Response('Unauthorized',{status:401});
 if(state.last_attempt&&Date.now()-Date.parse(state.last_attempt)<45*60*1000)return new Response('Already checked',{status:429});
 const now=new Date().toISOString();
 let claim=db.from('mobile_release_sync_state').update({last_attempt:now}).eq('id',1);
 claim=state.last_attempt?claim.eq('last_attempt',state.last_attempt):claim.is('last_attempt',null);
 const {data:claimed,error:claimError}=await claim.select('id');
 if(claimError||!claimed?.length)return new Response('Already checking',{status:409});
 const [ios,android]=await Promise.allSettled([apple(),google()]);
 const safe=(result:PromiseSettledResult<unknown>)=>result.status==='fulfilled'?result.value:{ok:false,reason:result.reason instanceof Error?result.reason.message:'Store check failed'};
 const status={checked_at:now,ios:safe(ios),android:safe(android)};
 await db.from('mobile_release_sync_state').update({last_status:status}).eq('id',1);
 return Response.json(status);
});
