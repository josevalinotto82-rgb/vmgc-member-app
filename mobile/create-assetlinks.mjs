import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
// Huellas públicas SHA-256 del certificado que firma la app instalada.
// Para Google Play usar App signing key certificate, no Upload key certificate.
const fingerprints = process.argv.slice(2).map(value => value.toUpperCase());
if (!fingerprints.length || fingerprints.some(value => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))) {
  console.error('Uso: node scripts/create-assetlinks.mjs "HUELLA_SHA256_CON_DOS_PUNTOS" ["OTRA_HUELLA"]');
  process.exit(1);
}
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.well-known');
const statements = [{relation: ['delegate_permission/common.get_login_creds'], target: {
  namespace: 'android_app', package_name: 'ar.com.villamariagolf.members',
  sha256_cert_fingerprints: [...new Set(fingerprints)]
}}];
await mkdir(directory, {recursive: true});
await writeFile(path.join(directory, 'assetlinks.json'), JSON.stringify(statements, null, 2)+'\n');
console.log('Generado .well-known/assetlinks.json. Publicalo en app.villamariagolf.com.ar.');
