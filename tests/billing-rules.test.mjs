import test from 'node:test';
import assert from 'node:assert/strict';
import {addMonths,dayEnd,entitlement,DEFAULT_PLANS,moduleIncluded,platformContextAllowed,supportGrantActive,servicePaymentKey,validatePlan} from '../netlify/lib/billing-rules.mjs';

test('la prueba vence a las 24 horas y no se reinicia por consultar',()=>{
 const sub={trialEndsAt:'2026-10-23T12:00:00Z',state:'prueba'};
 assert.equal(entitlement(sub,false,Date.parse('2026-10-23T11:59:59Z')).access,true);
 assert.equal(entitlement(sub,false,Date.parse('2026-10-23T12:00:00Z')).access,false);
 assert.equal(sub.trialEndsAt,'2026-10-23T12:00:00Z');
});
test('los meses y años conservan el calendario sin desbordar febrero',()=>{
 assert.equal(addMonths('2026-01-31',1),'2026-02-28');
 assert.equal(addMonths('2024-02-29',12),'2025-02-28');
 assert.equal(addMonths('2026-10-22',24),'2028-10-22');
});
test('la gracia termina al final del segundo día de Managua y la cancelación conserva solo el periodo pagado',()=>{
 const sub={plan:'pro',state:'activo',paidUntil:dayEnd('2026-10-22'),trialEndsAt:'2026-10-21T00:00:00Z'};
 assert.equal(entitlement(sub,false,Date.parse('2026-10-25T05:59:59Z')).state,'en_gracia');
 assert.equal(entitlement(sub,false,Date.parse('2026-10-25T06:00:00Z')).access,false);
 assert.equal(entitlement({...sub,canceledAt:new Date()},false,Date.parse('2026-10-23T05:59:59Z')).access,true);
 assert.equal(entitlement({...sub,canceledAt:new Date()},false,Date.parse('2026-10-23T06:00:00Z')).access,false);
 assert.equal(entitlement({...sub,state:'suspendido'},false,Date.parse('2026-10-22T12:00:00Z')).access,false);
});
test('ser dueño o colaborador de Acontec no concede rol de plataforma',()=>{
 const context={platformAdmin:true,member:false,platformCompany:true,companyId:'acontec',activeCompanyId:'acontec'};
 assert.equal(platformContextAllowed(context),true);
 for(const patch of [{platformAdmin:false},{member:true},{platformCompany:false},{activeCompanyId:'cliente'}])assert.equal(platformContextAllowed({...context,...patch}),false);
});
test('soporte exige permiso específico, rol y vigencia, incluso en el instante de vencimiento',()=>{
 const now=Date.parse('2026-10-22T12:00:00Z'),grant={email:'soporte@example.invalid',expiresAt:new Date(now+86400000)};
 assert.equal(supportGrantActive(grant,grant.email,true,false,now),true);
 assert.equal(supportGrantActive(grant,grant.email,true,false,now+86400000),false);
 assert.equal(supportGrantActive(grant,'otro@example.invalid',true,false,now),false);
 assert.equal(supportGrantActive(grant,grant.email,false,false,now),false);
 assert.equal(supportGrantActive(null,grant.email,true,false,now),false);
});
test('la referencia idempotente distingue entornos y es estable en reintentos',()=>{
 const ern='ACT-0123456789abcdef-01';
 assert.equal(servicePaymentKey('sandbox',ern),servicePaymentKey('sandbox',ern));
 assert.notEqual(servicePaymentKey('sandbox',ern),servicePaymentKey('production',ern));
 assert.throws(()=>servicePaymentKey('sandbox','externa'));
});
test('planes mantienen los precios anuales, exclusiones y centavos enteros',()=>{
 assert.deepEqual(DEFAULT_PLANS.map(p=>p.annualCents),[31400,63000,190000]);
 assert.equal(moduleIncluded(DEFAULT_PLANS[0],'personal'),false);
 assert.equal(moduleIncluded(DEFAULT_PLANS[0],'ventas'),true);
 assert.equal(moduleIncluded(DEFAULT_PLANS[1],'sucursales'),false);
 assert.equal(moduleIncluded(DEFAULT_PLANS[2],'sucursales'),true);
 assert.throws(()=>validatePlan({...DEFAULT_PLANS[0],monthlyCents:3500.5,active:true}));
 assert.equal(validatePlan({...DEFAULT_PLANS[0],active:true}).monthlyCents,3500);
});
