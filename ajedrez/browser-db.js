import {LIBRARY_KEY} from './library.js';
export async function openBrowserDatabase({indexedDB=globalThis.indexedDB,legacyStorage}={}){
 if(!indexedDB)throw new Error('Browser database unavailable.');
 const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('between-bishops-training',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close other old app tabs and try again.'));});
 const read=()=>new Promise((resolve,reject)=>{const transaction=db.transaction('records','readonly'),request=transaction.objectStore('records').get(LIBRARY_KEY);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 const stored=await read();
 let persisted=stored;
 const cache=new Map();if(stored!==undefined)cache.set(LIBRARY_KEY,stored);else{try{const legacy=legacyStorage?.getItem(LIBRARY_KEY);if(legacy)cache.set(LIBRARY_KEY,legacy);}catch{}}
 let pending=Promise.resolve(),failure=null;
 const storage={
  getItem:key=>cache.get(key)||null,
  async refresh(){const value=await read();persisted=value;if(value!==undefined)cache.set(LIBRARY_KEY,value);},
  setItem(key,value){
   if(failure)throw failure;
   cache.set(key,value);
   pending=pending.then(()=>new Promise((resolve,reject)=>{
    if(failure){reject(failure);return;}
    const transaction=db.transaction('records','readwrite');
    const records=transaction.objectStore('records');
    const current=records.get(key);
    let conflict=false;
    current.onsuccess=()=>{
     if(current.result!==persisted){conflict=true;transaction.abort();return;}
     records.put(value,key);
    };
    transaction.oncomplete=()=>{persisted=value;resolve();};
    transaction.onabort=()=>reject(conflict
     ?new Error('Another tab changed the library. Export this tab’s backup before reloading. / Otra pestaña cambió el banco. Exporta el respaldo de esta pestaña antes de recargar.')
     :transaction.error||new Error('Database write aborted.'));
   })).catch(error=>{failure=error;});
  },
  async flush(){await pending;if(failure)throw failure;},
  close(){db.close();},
 };
 if(stored===undefined&&cache.has(LIBRARY_KEY)){storage.setItem(LIBRARY_KEY,cache.get(LIBRARY_KEY));await storage.flush();}
 return storage;
}
