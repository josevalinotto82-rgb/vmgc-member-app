import {readFile} from 'node:fs/promises';
export async function waitForCapture(file,scene,{timeout=60000,interval=500}={}){
 const start=Date.now();
 while(Date.now()-start<timeout){
  try{const ready=JSON.parse(await readFile(file,'utf8'));if(ready.scene===scene&&ready.ready===true&&ready.width>0&&ready.height>0)return ready;}catch{}
  await new Promise(resolve=>setTimeout(resolve,interval));
 }
 throw Error('El simulador no confirmó que la pantalla '+scene+' esté lista. Revisar el registro de compilación.');
}
if(process.argv[1]?.endsWith('wait-store-capture.mjs')){
 const [file,scene]=process.argv.slice(2);if(!file||!scene)throw Error('Falta archivo o escena');
 await waitForCapture(file,scene);console.log('Pantalla lista:',scene);
}
