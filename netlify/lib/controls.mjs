import { and, eq } from 'drizzle-orm';
import { productBarcodes } from '../../db/schema.ts';
export { guardPeriods } from './period-controls.mjs';
const fail=(message,status=400)=>{const error=new Error(message);error.publicMessage=message;error.status=status;throw error};
export function codesOf(product){return product.barcodes||[]}
export async function syncBarcodes(client,company,data){
 const before=(company.data?.products||[]).map(p=>[p.id,codesOf(p)]),after=(data.products||[]).map(p=>[p.id,codesOf(p)]);
 const map=new Map();
 for(const product of data.products||[]){
  const codes=codesOf(product);
  if(!Array.isArray(codes)||codes.length>30)fail('Un producto admite hasta 30 códigos.');
  for(const code of codes){
   if(typeof code!=='string'||!code.trim()||code!==code.trim()||code.length>128||/[\x00-\x1f\x7f]/.test(code))fail('Código de barras inválido.');
   if(map.has(code))fail('El código '+code+' ya pertenece a '+map.get(code)+'.',409);
   map.set(code,product.name);
  }
 }
 if(JSON.stringify(before)===JSON.stringify(after))return;
 // La fila de empresa está bloqueada: cambios de códigos y documento son atómicos.
 const existing=await client.select().from(productBarcodes).where(eq(productBarcodes.companyId,company.id));
 const wanted=new Map((data.products||[]).flatMap(p=>codesOf(p).map(code=>[code,p.id])));
 for(const row of existing)if(wanted.get(row.code)!==row.productId)await client.delete(productBarcodes).where(and(eq(productBarcodes.companyId,company.id),eq(productBarcodes.id,row.id)));
 const unchanged=new Set(existing.filter(row=>wanted.get(row.code)===row.productId).map(row=>row.code));
 const added=[...wanted].filter(([code])=>!unchanged.has(code)).map(([code,productId])=>({companyId:company.id,code,productId}));
 if(added.length)await client.insert(productBarcodes).values(added);
}
