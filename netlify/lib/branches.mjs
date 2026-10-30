// La dimensión se interpreta como Principal para todos los registros históricos.
export const PRIMARY_BRANCH='principal';
export const BRANCH_ARRAYS=['businessRecords','entries','shifts','cashMovements','pettyFunds','pettyVouchers','cashCounts','costs','employees','payrolls','settlements','taxes','assets','loans','recurringEntries','quotations','purchaseOrders','stockTransfers','moneyTransfers','attendance','vacationRequests','employeeAdvances','foreignDocuments','budgets','withholdings','instruments','partners'];
export const companyBranches=data=>data?.branches?.length?data.branches:[{id:PRIMARY_BRANCH,name:'Principal',code:'P',active:true,main:true,address:'',phone:''}];
const fail=(message,status=403)=>{const error=new Error(message);error.publicMessage=message;error.status=status;throw error};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function branchAccess(access,session){
 const branches=companyBranches(access.company.data),unrestricted=access.owner||String(access.member?.role).toLowerCase()==='contador';
 const ids=unrestricted?branches.map(b=>b.id):(access.member?.branchIds||[PRIMARY_BRANCH]);
 const visible=branches.filter(b=>ids.includes(b.id)&&b.active!==false);
 const selected=session.activeBranchId;
 if(selected&&selected!=='all'&&branches.some(b=>b.id===selected)&&!visible.some(b=>b.id===selected))fail('Sin acceso a la sucursal seleccionada.');
 const branchId=selected==='all'&&unrestricted?null:visible.find(b=>b.id===selected)?.id||(unrestricted&&selected!=='all'?PRIMARY_BRANCH:visible[0]?.id);
 if(!unrestricted&&!branchId)fail('No tienes una sucursal asignada.');
 return {...access,branchId,branches:visible,unrestrictedBranches:unrestricted};
}
export const recordBranch=record=>record?.branchId||PRIMARY_BRANCH;
export function branchStock(data,product,branchId){
 const all=(data.entries||[]).flatMap(entry=>(entry.stock||[]).filter(m=>m.pid===product.id).map(m=>({q:m.q,branchId:recordBranch(entry)})));
 const total=all.reduce((sum,m)=>sum+m.q,0),local=all.filter(m=>m.branchId===branchId).reduce((sum,m)=>sum+m.q,0);
 return Math.round(((branchId===PRIMARY_BRANCH?product.stock-total:0)+local)*1e6)/1e6;
}
export function scopeBranch(data,access){
 if(!data)return data;
 const copy=structuredClone(data);copy.branches=access.branches;
 copy.cfg||={};copy.cfg.pos||={};copy.cfg.pos.useDimensions??=(data.entries||[]).some(e=>e.costCenter||e.project);
 if(!access.branchId)return copy;
 for(const name of BRANCH_ARRAYS)if(Array.isArray(copy[name]))copy[name]=copy[name].filter(row=>name==='stockTransfers'?(row.sourceId===access.branchId||row.destinationId===access.branchId):recordBranch(row)===access.branchId);
 const totals=new Map(),local=new Map();
 for(const entry of data.entries||[])for(const movement of entry.stock||[]){totals.set(movement.pid,(totals.get(movement.pid)||0)+movement.q);if(recordBranch(entry)===access.branchId)local.set(movement.pid,(local.get(movement.pid)||0)+movement.q)}
 copy.products=(data.products||[]).map(p=>({...p,stock:Math.round(((access.branchId===PRIMARY_BRANCH?p.stock-(totals.get(p.id)||0):0)+(local.get(p.id)||0))*1e6)/1e6}));
 return copy;
}
export function mergeBranch(full,previous,next,access,manage=false){
 if(!next)return next;
 if(!manage&&!same(next.branches||access.branches,access.branches))fail('Usa la administración de sucursales para modificar sus datos.');
 if(!access.branchId){
  // El consolidado es una consulta. Catálogos compartidos pueden modificarse.
  for(const name of BRANCH_ARRAYS)if(!same(previous?.[name]||[],next[name]||[]))fail('Selecciona una sucursal para registrar movimientos.');
  return {...next,branches:manage?next.branches:companyBranches(full)};
 }
 const result={...next,branches:manage?next.branches:companyBranches(full)};
 for(const name of BRANCH_ARRAYS){
  if(!Array.isArray(next[name])&&!Array.isArray(full?.[name]))continue;
  const others=(full?.[name]||[]).filter(row=>recordBranch(row)!==access.branchId),hiddenIds=new Set(others.map(row=>row.id));
  const localRows=(next[name]||[]).filter(row=>{
   // Un traslado recibido como consulta pertenece todavía a la sucursal de origen.
   // Se conserva desde el documento completo; únicamente stockReceive puede cambiarlo.
   if(name==='stockTransfers'&&recordBranch(row)!==access.branchId){
    const original=(full?.[name]||[]).find(item=>item.id===row.id);
    if(!original||original.destinationId!==access.branchId||!same(original,row))fail('El traslado de otra sucursal no se puede modificar.');
    return false;
   }
   return true;
  });
  result[name]=[...others,...localRows.map(row=>{
   if(hiddenIds.has(row.id))fail('El identificador pertenece a otra sucursal.');
   if(row.branchId&&row.branchId!==access.branchId)fail('El registro no pertenece a la sucursal activa.');
   const old=(previous?.[name]||[]).find(r=>r.id===row.id);
   // Conservar exactamente los históricos que no cambiaron.
   return old&&same(old,row)?row:{...row,branchId:access.branchId};
  })];
 }
 result.products=(next.products||[]).map(p=>{
  const old=full?.products?.find(r=>r.id===p.id),local=previous?.products?.find(r=>r.id===p.id);
  return {...p,stock:Math.round(((old?.stock||0)+p.stock-(local?.stock||0))*1e6)/1e6};
 });
 for(const old of full?.products||[])if(!result.products.some(p=>p.id===old.id)&&(full.entries||[]).some(e=>recordBranch(e)!==access.branchId&&e.stock?.some(m=>m.pid===old.id)))fail('El producto tiene movimientos en otra sucursal.');
 return result;
}

export function materializeBranches(data){
 if(!data)return data;
 data.branches=companyBranches(data);
 for(const name of BRANCH_ARRAYS)if(Array.isArray(data[name]))for(const row of data[name])if(!row.branchId)row.branchId=PRIMARY_BRANCH;
 return data;
}
