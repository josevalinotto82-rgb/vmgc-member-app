// Only auth keys use this adapter. Legacy local tokens are migrated once into
// the OS vault and removed only after a verified successful write.
export function createSessionStorage(vault,ready,legacy){
 let serial=Promise.resolve();
 const queue=fn=>{const task=serial.then(fn);serial=task.catch(()=>{});return task;};
 return {
  getItem:key=>queue(async()=>{await ready();const stored=await vault.read({key});if(stored.value!=null){legacy.removeItem(key);return stored.value;}const old=legacy.getItem(key);if(old!=null){await vault.write({key,value:old});legacy.removeItem(key);}return old;}),
  setItem:(key,value)=>queue(async()=>{await ready();await vault.write({key,value});legacy.removeItem(key);}),
  removeItem:key=>queue(async()=>{await ready();await vault.remove({key});legacy.removeItem(key);})
 };
}
