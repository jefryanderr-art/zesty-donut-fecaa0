// Only non-fiscal route drafts and visits may enter this device queue.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function queuePayload(operation,body,operationId){
 if(!uuid.test(operationId)||body.confirmed!==true)throw Error('Confirma la operación de preventa.');
 const keys=operation==='routeOrder'?['id','customerId','date','due','status','payment','note','items']:operation==='routeVisit'?['customerId','date','result','reason','location']:null;
 if(!keys||operation==='routeOrder'&&!['Borrador','Enviado'].includes(body.status))throw Error('Solo se admiten pedidos de preventa y visitas sin valor fiscal.');
 const result={operation,operationId,confirmed:true,durableRoute:true};for(const key of keys)if(body[key]!==undefined)result[key]=structuredClone(body[key]);
 if(operation==='routeOrder'){result.id=result.id||'';result.items=(result.items||[]).map(i=>({p:i.p,q:i.q,u:i.u}));}
 return result;
}
export function durableRoutePayload(body){
 if(body.durableRoute!==true)return body;
 if(!['routeOrder','routeVisit'].includes(body.operation)||body.operation==='routeOrder'&&!['Borrador','Enviado'].includes(body.status))throw Error('La cola solo admite pedidos de preventa y visitas.');
 // Revision is an optimistic-concurrency envelope, never business content.
 const {revision,...original}=body;return original;
}
export function queueScope(user,company){if(!user?.email||!company?.id||!company.branchId)throw Error('Selecciona una sesión y sucursal.');return JSON.stringify([user.email,company.memberId||'',company.id,company.branchId]);}
export function validateQueueRow(row){
 const p=row?.payload;
 if(!p||p.durableRoute!==true||p.operationId!==row.operationId||!row.branchId||p.branchId!==row.branchId)throw Error('Elemento de cola inválido.');
 const clean={...queuePayload(p.operation,p,p.operationId),branchId:row.branchId};
 if(Object.keys(clean).length!==Object.keys(p).length||!Object.keys(clean).every(key=>JSON.stringify(clean[key])===JSON.stringify(p[key])))throw Error('El contenido de la cola no coincide con el pedido o visita original.');
 return row;
}
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('acontec-route-outbox',1);request.onupgradeneeded=()=>request.result.createObjectStore('pending',{keyPath:'operationId'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('No se pudo abrir la cola del dispositivo.'));})}
async function transaction(mode,work){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('pending',mode),store=tx.objectStore('pending');let result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('No se pudo guardar la cola del dispositivo.'));tx.onabort=tx.onerror;work(store,value=>{result=value})})}finally{db.close()}}
export const pendingFor=scope=>transaction('readonly',(store,done)=>{const r=store.getAll();r.onsuccess=()=>done(r.result.filter(row=>row.scope===scope).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.operationId.localeCompare(b.operationId)))});
export const allPending=()=>transaction('readonly',(store,done)=>{const r=store.getAll();r.onsuccess=()=>done(r.result)});
export const savePending=row=>{validateQueueRow(row);return transaction('readwrite',store=>store.put(row))};
export const removePending=id=>transaction('readwrite',store=>store.delete(id));
export const replaceRejected=(old,row)=>{validateQueueRow(row);return transaction('readwrite',store=>{const r=store.get(old);r.onsuccess=()=>{if(!r.result||r.result.scope!==row.scope||r.result.status!=='rejected'){store.transaction.abort();return}store.put(row);store.delete(old)}})};
