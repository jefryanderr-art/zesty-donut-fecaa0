// Mantenimiento manual de URL de caché; no compila ni genera el frontend.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../public');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex').slice(0,16);
// Primero las dependencias cargadas dinámicamente, después los scripts que las referencian.
for(const name of ['analytics.js','access.js','imports.js','barcodes.js']){
 const file=resolve(root,name),source=readFileSync(file,'utf8');
 writeFileSync(file,source.replace(/(['"])(\/(?:vendor\/)?[\w.-]+\.(?:m?js))(?:\?v=[\w.-]+)?\1/g,(all,quote,url)=>{
  const asset=resolve(root,'.'+url);return existsSync(asset)?quote+url+'?v='+hash(asset)+quote:all;
 }));
}
for(const name of ['index.html','configurar-google.html','privacidad.html','terminos.html','reembolsos.html','cookies.html']){
 const file=resolve(root,name),source=readFileSync(file,'utf8');
 writeFileSync(file,source.replace(/((?:src|href)=")((?:\/)?[\w./-]+\.(?:css|m?js))(?:\?v=[\w.-]+)?(")/g,(all,start,url,end)=>{
  const asset=resolve(root,url.replace(/^\//,''));return existsSync(asset)?start+url+'?v='+hash(asset)+end:all;
 }));
}
console.log('URL de los recursos estáticos actualizadas.');
