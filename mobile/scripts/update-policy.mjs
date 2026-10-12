export function compareVersions(a,b){
 const valid=value=>/^\d+(?:\.\d+){0,3}$/.test(String(value||''));
 if(!valid(a)||!valid(b))return null;
 const left=String(a).split('.').map(Number),right=String(b).split('.').map(Number);
 for(let i=0;i<Math.max(left.length,right.length);i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return Math.sign(delta);}return 0;
}
export function updatePolicy(info,release,platform,channel){
 if(!release||release.platform!==platform||release.channel!==channel)return null;
 let url;try{url=new URL(release.store_url);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password)return null;
 if(platform==='ios'&&(url.hostname!=='apps.apple.com'||!url.pathname.endsWith('/id6818911765')))return null;
 if(platform==='android'&&(url.hostname!=='play.google.com'||url.searchParams.get('id')!==info.id))return null;
 const latest=platform==='android'?Number(release.latest_build):null;
 const current=Number(info.build);
 const newer=platform==='android'?Number.isSafeInteger(latest)&&latest>current:compareVersions(release.latest_version,info.version)===1;
 if(!newer)return null;
 const minimum=Number(release.minimum_build);
 const mandatory=platform==='android'?release.minimum_build!=null&&Number.isSafeInteger(minimum)&&minimum<=latest&&current<minimum:compareVersions(release.minimum_version,info.version)===1&&compareVersions(release.minimum_version,release.latest_version)<=0;
 return {mandatory,key:platform+':'+channel+':'+(platform==='android'?latest:release.latest_version),url:url.href,version:release.latest_version,message:release.message};
}
