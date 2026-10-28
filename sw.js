/* Retire legacy cached pages and the old PWA installer. */
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('vmgc-'))await caches.delete(name);await self.clients.claim();})());});
// No offline copies of member pages or account data. Normal browser requests apply.
