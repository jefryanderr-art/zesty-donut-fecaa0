'use strict';
// Índice temporal de referencias. Nunca autoriza ni recupera saldos, clientes o sesiones.
let CATALOG_CACHE=null;
function productCatalog(){
 const namespace='acontec.catalog.'+CO.id+'.'+(CO.memberId||U.email),stamp=JSON.stringify(S.products.map(p=>[p.id,p.code,p.name,p.barcodes||[]]));
 if(CATALOG_CACHE?.key===namespace&&CATALOG_CACHE.revision===REV&&CATALOG_CACHE.stamp===stamp)return CATALOG_CACHE.records;
 let cached;try{cached=JSON.parse(localStorage.getItem(namespace)||'null')}catch{}
 const valid=cached&&cached.revision===REV&&cached.stamp===stamp&&cached.expires>Date.now()&&Array.isArray(cached.records);
 const records=valid?cached.records:S.products.map(p=>({id:p.id,name:p.name,code:p.code,barcodes:p.barcodes||[]}));
 CATALOG_CACHE={key:namespace,revision:REV,stamp,records};
 if(!valid)try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('acontec.catalog.')&&key!==namespace)localStorage.removeItem(key)}localStorage.setItem(namespace,JSON.stringify({revision:REV,stamp,records,expires:Date.now()+300000}))}catch{}
 return records;
}
// Los importes, permisos y existencias proceden siempre del documento vigente de la sesión.
function findCatalogCode(code){const hit=productCatalog().find(p=>p.code===code||p.barcodes.includes(code));return hit?prod(hit.id):undefined}
