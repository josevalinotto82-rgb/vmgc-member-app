import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild-wasm';
if(process.env.VMGC_SCREENSHOT_BUILD!=='1')throw Error('Usar exclusivamente en el flujo ios-ipad-screenshots.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'www');
for(const name of ['panel.html','mi_perfil.html']){
 const file=path.join(web,name);let html=await readFile(file,'utf8');
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 // Las capturas son locales, con datos de ejemplo y sin autenticación ni escrituras.
 html=html.replace(/\sonclick="[^"]*"/gi,'');
 html=html.replace('</head>','<script type="module" src="store-capture-runtime.js"></script></head>');
 await writeFile(file,html);
}
await build({entryPoints:[path.join(root,'scripts/store-capture-runtime.mjs')],outfile:path.join(web,'store-capture-runtime.js'),bundle:true,format:'esm',minify:true,target:'es2022'});
await writeFile(path.join(web,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>const scene=window.__VMGC_STORE_CAPTURE__;if(["inicio","perfil","hcp"].includes(scene))location.replace(scene==="inicio"?"panel.html":"mi_perfil.html");else document.body.textContent="Falta seleccionar la escena de captura.";</script></body></html>');
if(!process.argv.includes('--web-only')){
 const swift=path.join(root,'ios/App/App/SceneDelegate.swift');let source=await readFile(swift,'utf8');
 if(!source.includes('VMGC_STORE_CAPTURE_PATCH')){
  const marker='        webView.scrollView.bounces = false';
  if(!source.includes(marker))throw Error('No se encontró el punto de preparación de WKWebView.');
  source='import WebKit\n'+source;
  source=source.replace(marker,`        // VMGC_STORE_CAPTURE_PATCH: sólo Debug + simulador + variable explícita.
        #if DEBUG && targetEnvironment(simulator)
        if let scene = ProcessInfo.processInfo.environment["VMGC_CAPTURE_SCENE"], ["inicio", "perfil", "hcp"].contains(scene) {
            let controller = webView.configuration.userContentController
            controller.add(StoreCaptureReadyHandler(), name: "vmgcCaptureReady")
            controller.addUserScript(WKUserScript(source: "window.__VMGC_STORE_CAPTURE__ = '" + scene + "';", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif
`+marker);
  source+=`\n#if DEBUG && targetEnvironment(simulator)
private final class StoreCaptureReadyHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "vmgcCaptureReady", let body = message.body as? [String: Any], body["ready"] as? Bool == true,
              let scene = body["scene"] as? String, ["inicio", "perfil", "hcp"].contains(scene) else { return }
        do {
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONSerialization.data(withJSONObject: body)
            try data.write(to: directory.appendingPathComponent("store-capture-ready.json"), options: .atomic)
        } catch { NSLog("No se pudo confirmar la captura: %@", error.localizedDescription) }
    }
}
#endif
`;
  await writeFile(swift,source);
 }
}
console.log('Capturas aisladas preparadas: inicio, perfil e HCP. Sin conexión a Supabase ni datos personales reales.');
