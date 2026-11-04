import '../../public/profiles.js';
import '../../public/chart-templates.js';
const ensure=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{status:422,publicMessage:message})};
export function specializedPreview(data,profile,sector){const t=globalThis.AcontecChartTemplates.get(profile,sector);ensure(t,'Perfil o sector de plantilla inválidos.');return {...t,accounts:t.accounts.map(a=>({...a,existing:!!data.accounts.some(old=>old.code===a.code)}))};}
export function applySpecializedChart(data,access,body,ctx){
 ensure(access.owner&&access.branchId,'Solo el dueño con sucursal seleccionada aplica plantillas.');ctx.permit(access,'ajustes',true);ctx.permit(access,'contabilidad',true);
 ensure(body.confirmed===true&&typeof body.reason==='string'&&body.reason.trim().length>=3&&body.reason.length<=500,'Confirma la vista previa e indica el motivo.');
 ensure(body.version===1&&body.profile===access.company.businessType,'Revisa la versión y el perfil actual antes de aplicar.');
 const full=access.company.data,t=specializedPreview(data,body.profile,body.sector);
 ensure(!(full.entries||[]).length&&!(full.products||[]).some(p=>p.stock!==0)&&!(full.payrolls||[]).length&&!(full.foreignDocuments||[]).length,'Solo se aplica sin movimientos en todas las sucursales.');
 for(const a of t.accounts){const old=data.accounts.find(o=>o.code===a.code);ensure(!old||old.tipo===a.tipo&&old.nat===a.nat,'Una cuenta existente tiene otra naturaleza; no se sustituyó ninguna cuenta.');}
 for(const {existing,...a}of t.accounts)if(!existing)data.accounts.push(a);
 data.cfg.specializedChartTemplate={version:1,profile:body.profile,sector:body.sector,reason:body.reason.trim(),appliedAt:new Date().toISOString()};return body.profile;
}
