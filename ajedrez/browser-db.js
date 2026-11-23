import {LIBRARY_KEY} from './library.js';
export async function openBrowserDatabase({indexedDB=globalThis.indexedDB,legacyStorage}={}){
 if(!indexedDB)throw new Error('Browser database unavailable.');
 const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('between-bishops-training',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close other old app tabs and try again.'));});
 const stored=await new Promise((resolve,reject)=>{const transaction=db.transaction('records','readonly'),request=transaction.objectStore('records').get(LIBRARY_KEY);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 const cache=new Map();if(stored!==undefined)cache.set(LIBRARY_KEY,stored);else{try{const legacy=legacyStorage?.getItem(LIBRARY_KEY);if(legacy)cache.set(LIBRARY_KEY,legacy);}catch{}}
 let pending=Promise.resolve(),failure=null;
 const storage={
  getItem:key=>cache.get(key)||null,
  setItem(key,value){if(failure)throw failure;cache.set(key,value);pending=pending.then(()=>new Promise((resolve,reject)=>{const transaction=db.transaction('records','readwrite');transaction.objectStore('records').put(value,key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error||new Error('Database write failed.'));transaction.onabort=()=>reject(transaction.error||new Error('Database write aborted.'));})).catch(error=>{failure=error;});},
  async flush(){await pending;if(failure)throw new Error('Could not save the browser database. Export a backup now. / No se pudo guardar la base local. Exporta un respaldo ahora.');},
  close(){db.close();},
 };
 if(stored===undefined&&cache.has(LIBRARY_KEY)){storage.setItem(LIBRARY_KEY,cache.get(LIBRARY_KEY));await storage.flush();}
 return storage;
}
