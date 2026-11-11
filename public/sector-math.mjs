// Cálculos compartidos: cantidades en unidades; todo importe nuevo en centavos.
import {businessRecipePlan,moneyCents} from './accounting-math.mjs?v=ebd0d1f516492643';
export function sectorBom(recipe,n,recipes,products,path=[]){
 if(path.includes(recipe.id)||path.length>=12)throw new Error('Lista de materiales cíclica o de más de 12 niveles.');
 const result=new Map();
 for(const line of businessRecipePlan(recipe,n,products)){
  const sub=recipes.find(r=>r.productId===line.p&&r.status==='Activa');
  const leaves=sub?sectorBom(sub,line.q,recipes,products,[...path,recipe.id]):[line];
  for(const i of leaves)result.set(i.p,{p:i.p,q:Math.round(((result.get(i.p)?.q||0)+i.q)*1e6)/1e6});
 }
 return [...result.values()];
}
export function sectorMrp(orders,recipes,products){
 const needed=new Map();
 for(const o of orders.filter(o=>o.phase==='Programada')){
  const recipe=recipes.find(r=>r.id===o.recipeId);if(!recipe)continue;
  for(const i of sectorBom(recipe,o.q,recipes,products))needed.set(i.p,(needed.get(i.p)||0)+i.q);
 }
 return [...needed].map(([p,q])=>{const stock=products.find(x=>x.id===p)?.stock||0;return {p,q,stock,buy:Math.max(0,Math.round((q-stock)*1e6)/1e6)}});
}
export function sectorCrop(cycle,records,data){
 const harvest=(cycle.logs||[]).filter(l=>l.type==='Cosecha').reduce((n,l)=>n+l.q,0),loss=(cycle.logs||[]).filter(l=>l.type==='Pérdida').reduce((n,l)=>n+l.q,0),area=records.find(r=>r.id===cycle.parcelId)?.area||0;
 const costs=sectorNetCosts(cycle,data).reduce((n,l)=>n+l.amountCents,0),income=(cycle.sectorSales||[]).reduce((n,l)=>n+l.amountCents-(data?.entries||[]).filter(e=>e.type==='nota-credito'&&e.invoiceId===l.entryId).reduce((s,e)=>s+moneyCents(e.subtotal),0),0);
 return {harvest,loss,area,yieldPerHa:area?harvest/area:0,costCents:costs,costPerHaCents:area?Math.round(costs/area):0,costPerUnitCents:harvest?Math.round(costs/harvest):0,incomeCents:income,profitCents:income-costs,breakEvenQ:cycle.expectedPriceCents?costs/cycle.expectedPriceCents:null};
}
export function sectorNetCosts(record,data){return (record.sectorCosts||[]).filter(l=>!data?.costs?.some(c=>c.entryId===l.entryId&&c.reversalId))}
export function sectorWork(work,data){
 return (work.costCodes||[]).map(c=>({...c,actualCents:sectorNetCosts(work,data).filter(x=>x.code===c.code).reduce((n,x)=>n+x.amountCents,0)}));
}
export function sectorMaterialCost(lines,products){return lines.reduce((n,i)=>n+moneyCents(Math.round(i.q*products.find(p=>p.id===i.p).cost*100)/100),0)}
