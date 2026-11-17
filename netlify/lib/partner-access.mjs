import '../../public/role-permissions.js';
import {requirePlanModule,moduleIncluded} from './billing-rules.mjs';
// Independent of role policies: only manageMember may change this membership grant, under the company lock.
export const partnerGrant = member => globalThis.AcontecRoles.partnerGrant(member?.partnerAccess ?? member?.permissions?.partnerAccess);
export const activePartner = p => !!p && p.active !== false && !['inactivo','archivado'].includes(p.status);
export function partnerAuthorized(access, partner, kind) {
 const grant=partnerGrant(access.member),key=kind==='gasto_personal'?'personalExpenses':kind==='retiro'?'withdrawals':kind==='statement'?'statement':null;
 return !access.support&&(kind==='statement'||!access.readOnlyLimit)&&(!access.billingPlan||moduleIncluded(access.billingPlan,kind==='gasto_personal'?'gastos':'contabilidad'))&&access.member?.active===true&&activePartner(partner)&&grant.partnerId===partner.id&&!!key&&grant[key]===true;
}
export function requirePartnerPlan(access,kind){
 if(access.support||access.readOnlyLimit)throw Object.assign(new Error('Acceso de solo lectura.'),{publicMessage:'Acceso de solo lectura.',status:403});
 requirePlanModule(access.billingPlan,kind==='gasto_personal'?'gastos':'contabilidad');
}
export function validatePartnerGrant({owner,previous,requested,partners,members,memberId,check}){
 const before=partnerGrant({partnerAccess:previous}),next=globalThis.AcontecRoles.partnerGrant(requested??before);
 check(owner||JSON.stringify(before)===JSON.stringify(next),'Solo el dueño cambia los permisos del socio.');
 if(next.partnerId){check(partners.some(p=>p.id===next.partnerId&&activePartner(p))||before.partnerId===next.partnerId&&['personalExpenses','withdrawals','statement'].every(key=>!next[key]||before[key]),'Selecciona un socio activo.');check(!members.some(m=>m.id!==memberId&&partnerGrant(m).partnerId===next.partnerId),'El socio ya está vinculado a otro usuario.');}
 check(!!next.partnerId||!next.personalExpenses&&!next.withdrawals&&!next.statement,'Vincula un socio antes de conceder permisos.');
 return next;
}
