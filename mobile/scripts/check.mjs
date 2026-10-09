import {readFile,readdir,access} from 'node:fs/promises';
import {strict as assert} from 'node:assert';
const config=JSON.parse(await readFile('capacitor.config.json','utf8'));
assert.equal(config.webDir,'www');assert.ok(!config.server?.url,'La app debe cargar pantallas locales.');
for(const file of await readdir('www'))if(file.endsWith('.html')){
 const html=await readFile('www/'+file,'utf8');assert.ok(html.includes('native-runtime.js'),file+': falta integración móvil');
 assert.ok(!/https:\/\/(cdn\.jsdelivr\.net|esm\.sh)/.test(html),file+': dependencia remota');
 for(const m of html.matchAll(/<script[^>]*src="([^"]+)"/g)){const script=m[1].split('?')[0];if(!script.startsWith('http'))await access('www/'+script);}
}
assert.ok(!(await readdir('www')).includes('torneos_internos.html'));
console.log('Verificado: pantallas locales, scripts presentes, integración móvil y estadísticas aprobadas.');
