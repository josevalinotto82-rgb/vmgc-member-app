import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild-wasm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=path.join(root,'src'),dest=path.join(root,'www');
await mkdir(dest,{recursive:true});await cp(src,dest,{recursive:true});
await build({entryPoints:[path.join(root,'scripts/vendor.mjs')],outfile:path.join(dest,'vendor-supabase.js'),tsconfigRaw:{},bundle:true,format:'iife',minify:true,target:'es2022'});
await build({entryPoints:[path.join(root,'scripts/native.mjs')],outfile:path.join(dest,'native-runtime.js'),tsconfigRaw:{},bundle:true,format:'iife',minify:true,target:'es2022'});
await cp(path.join(root,'node_modules/html2canvas/dist/html2canvas.min.js'),path.join(dest,'vendor-html2canvas.js'));
for(const file of await readdir(dest)) {
  if(!file.endsWith('.html'))continue;
  const filePath=path.join(dest,file);let html=await readFile(filePath,'utf8');
  html=html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/g,'vendor-supabase.js');
  html=html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/html2canvas@1\.4\.1\/dist\/html2canvas\.min\.js/g,'vendor-html2canvas.js');
  if(html.includes('from "https://esm.sh/@supabase/supabase-js@2"')) {
    html=html.replace(/import \{ createClient \} from "https:\/\/esm\.sh\/@supabase\/supabase-js@2";/g,'const createClient = window.supabase.createClient;');
    html=html.replace(/<head>/i,'<head>\n<script src="vendor-supabase.js"></script>');
  }
  html=html.replace(/if \("serviceWorker" in navigator\)/g,'if ("serviceWorker" in navigator && !window.Capacitor?.isNativePlatform())');
  html=html.replace(/<head>/i,'<head>\n<script defer src="native-runtime.js"></script>\n<link rel="stylesheet" href="native.css">');
  await writeFile(filePath,html);
}
await writeFile(path.join(dest,'native.css'),'html{background:#f5f8f3}body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}input,select,textarea{font-size:16px!important}');
console.log('App empaquetada: pantallas y librerías locales en www/.');

