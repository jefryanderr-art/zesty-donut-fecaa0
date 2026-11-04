import '../../public/economic-sectors.js';
const catalog=globalThis.AcontecSectors;
const ensure=(value,message)=>{if(!value)throw Object.assign(new Error(message),{status:422,publicMessage:message})};
export function sectorTemplatePreview(data,sector){
 const template=catalog.get(sector);ensure(template,'Sector económico inválido.');
 return {version:catalog.version,sector,accounts:template.accounts.map(account=>({...account,existing:!!data.accounts?.some(a=>a.code===account.code)}))};
}
export function validateEconomicSector(data){
 const sector=data.cfg?.economicSector,template=data.cfg?.chartTemplate;
 if(sector!==undefined)ensure(sector&&catalog.get(sector.id)&&sector.version===catalog.version,'Configuración de sector inválida.');
 if(template!==undefined)ensure(template&&catalog.get(template.sector)&&template.version===catalog.version,'Referencia de plantilla inválida.');
}
export function configureEconomicSector(data,access,body,ctx){
 ensure(access.owner&&access.branchId,'Solo el dueño con una sucursal seleccionada configura el sector.');ctx.permit(access,'ajustes',true);
 ensure(body.confirmed===true&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=500,'Confirma la configuración e indica un motivo.');
 ensure(body.applyTemplate===undefined||typeof body.applyTemplate==='boolean','Confirma explícitamente si deseas aplicar la plantilla.');
 const preview=sectorTemplatePreview(data,body.sector);
 if(body.applyTemplate===true){
  ctx.permit(access,'contabilidad',true);
  const full=access.company?.data||data;
  ensure(!(full.entries||[]).length&&!(full.products||[]).some(p=>p.stock!==0)&&!(full.payrolls||[]).length&&!(full.foreignDocuments||[]).length,'La plantilla solo se aplica a empresas nuevas o sin movimientos en ninguna sucursal.');
  ensure(body.templateVersion===catalog.version,'La plantilla cambió; revisa la vista previa.');
  for(const account of preview.accounts){const old=data.accounts.find(a=>a.code===account.code);ensure(!old||(old.tipo===account.tipo&&old.nat===account.nat),'Una cuenta existente tiene otra naturaleza. Conserva el catálogo y revísalo con tu contador.');}
  for(const {existing,...account}of preview.accounts)if(!existing)data.accounts.push(account);
  data.cfg.chartTemplate={version:catalog.version,sector:body.sector,businessType:access.company.businessType||'comercio',appliedAt:new Date().toISOString(),reason:body.reason.trim()};
 }
 data.cfg.economicSector={id:body.sector,version:catalog.version,changedAt:new Date().toISOString(),reason:body.reason.trim()};
 return body.sector;
}
