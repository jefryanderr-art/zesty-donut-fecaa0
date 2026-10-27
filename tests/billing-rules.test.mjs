import { fiscalAnnualTotals } from '../netlify/lib/fiscal-projection.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {internalTestApplies,internalTestEntitlement,addMonths,dayEnd,entitlement,DEFAULT_PLANS,moduleIncluded,requirePlanModule,planModule,BLOCKABLE_MODULES,platformContextAllowed,supportGrantActive,servicePaymentKey,validatePlan} from '../netlify/lib/billing-rules.mjs';

test('la prueba vence a las 24 horas y no se reinicia por consultar',()=>{
 const sub={trialEndsAt:'2026-10-23T12:00:00Z',state:'prueba'};
 assert.equal(entitlement(sub,false,Date.parse('2026-10-23T11:59:59Z')).access,true);
 assert.equal(entitlement(sub,false,Date.parse('2026-10-23T12:00:00Z')).access,false);
 assert.equal(sub.trialEndsAt,'2026-10-23T12:00:00Z');
});
test('el pago confirmado activa el plan elegido antes de terminar la prueba',()=>{
 const now=Date.parse('2026-10-22T12:00:00Z');
 const trialEndsAt='2026-10-23T12:00:00Z';
 const sub={trialEndsAt,state:'prueba'};
 assert.equal(entitlement(sub,false,now).state,'prueba');
 for(const plan of DEFAULT_PLANS){
  const paid=entitlement({...sub,state:'activo',plan:plan.id,interval:'mensual',paidUntil:dayEnd('2026-11-22')},false,now);
  assert.equal(paid.access,true);
  assert.equal(paid.state,'activo');
  assert.equal(paid.plan,plan.id);
  assert.equal(paid.paidUntil,dayEnd('2026-11-22').toISOString());
  assert.equal(paid.trialEndsAt,undefined);
 }
 assert.equal(sub.trialEndsAt,trialEndsAt);
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
test('los planes existentes conservan precios y límites; Básico incorpora Fiscal',()=>{
 const basic=DEFAULT_PLANS.find(p=>p.id==='basico'),standard=DEFAULT_PLANS.find(p=>p.id==='estandar'),pro=DEFAULT_PLANS.find(p=>p.id==='pro');
 assert.deepEqual([basic,standard,pro].map(p=>[p.monthlyCents,p.annualCents]),[[3500,31400],[7000,63000],[20000,190000]]);
 assert.deepEqual(basic.blockedModules,['personal','control_personal','decisiones','sucursales']);
 assert.equal(moduleIncluded(basic,'fiscal'),true);
 assert.deepEqual(standard.blockedModules,['sucursales']);assert.deepEqual(pro.blockedModules,[]);
 assert.deepEqual([basic,standard].map(p=>p.limits),[{companies:1,branches:1},{companies:1,branches:1}]);assert.deepEqual(pro.limits,{companies:null,branches:null});
 assert.throws(()=>validatePlan({...basic,monthlyCents:3500.5,active:true}));assert.equal(validatePlan({...basic,active:true}).monthlyCents,3500);
});
test('Facturación ocupa el primer lugar con precios confirmados y bloqueos precisos',()=>{
 const p=DEFAULT_PLANS[0];assert.equal(p.id,'facturacion');assert.equal(p.name,'Facturación');assert.equal(p.monthlyCents,3000);assert.equal(p.annualCents,31000);assert.equal(p.currency,'USD');assert.deepEqual(p.limits,{companies:1,branches:1});
 assert.deepEqual(p.blockedModules,['contabilidad','finanzas','cajas','personal','control_personal','decisiones','sucursales']);
 assert.deepEqual(DEFAULT_PLANS.map(p=>p.id),['facturacion','basico','estandar','pro']);
});
test('el editor acepta todos los módulos configurables y rechaza módulos desconocidos',()=>{
 const p={...DEFAULT_PLANS[0],active:true};
 assert.deepEqual(validatePlan({...p,blockedModules:BLOCKABLE_MODULES}).blockedModules,BLOCKABLE_MODULES);
 assert.throws(()=>validatePlan({...p,blockedModules:['desconocido']}));
});
test('el servidor rechaza cada módulo excluido y permite la operación y las deudas',()=>{
 const p=DEFAULT_PLANS[0];
 for(const module of p.blockedModules){assert.equal(moduleIncluded(p,module),false);assert.throws(()=>requirePlanModule(p,module),error=>error.status===403&&error.publicMessage.startsWith('Tu plan no incluye '));}
 for(const module of ['cobrar','pagar','ventas','compras','gastos','costos','inventario','facturacion','fiscal','accesibilidad','ajustes','auditoria']){assert.equal(moduleIncluded(p,module),true,module);assert.doesNotThrow(()=>requirePlanModule(p,module));}
 assert.equal(planModule('cobrar'),'ventas');assert.equal(planModule('pagar'),'compras');
 for(const route of ['traslados','compararsucursales','asistencia','simuladores','rentabilidad','pronostico'])assert.equal(moduleIncluded(p,route),false,route);
});
test('marcar Incluir cambia efectivamente el permiso y no elimina los demás bloqueos',()=>{
 const p=DEFAULT_PLANS[0],edited=validatePlan({...p,active:true,blockedModules:p.blockedModules.filter(m=>m!=='contabilidad')});
 assert.equal(moduleIncluded(edited,'contabilidad'),true);assert.doesNotThrow(()=>requirePlanModule(edited,'contabilidad'));assert.equal(moduleIncluded(edited,'cajas'),false);
 const denyDebts={...p,blockedModules:[...p.blockedModules,'ventas','compras']};assert.equal(moduleIncluded(denyDebts,'cobrar'),false);assert.equal(moduleIncluded(denyDebts,'pagar'),false);
});

test('Fiscal conserva bases anuales históricas sin exponer asientos ni empleados',()=>{
 const totals=fiscalAnnualTotals({accounts:[{code:'4101',tipo:'ingreso'},{code:'6101',tipo:'gasto'},{code:'6108',tipo:'gasto'}],entries:[{id:'venta',date:'2026-10-01',lines:[{a:'4101',d:0,c:100}]},{id:'nomina-privada',employeeName:'Privado',date:'2026-10-02',lines:[{a:'6101',d:20,c:0}]},{id:'renta',date:'2026-10-03',lines:[{a:'6108',d:5,c:0}]}]});
 assert.deepEqual(totals,{'2026':{incomeCents:10000,costCents:0,expenseCents:2000}});
 assert.equal(JSON.stringify(totals).includes('Privado'),false);
});

test('prueba interna exige dueño administrador, plan y empresa ajena a plataforma',()=>{
 const context={testPlan:'basico',isPlatformCompany:false,ownerPlatformAdmin:true};
 assert.equal(internalTestApplies({...context,ownerPlatformAdmin:false}),false);
 assert.equal(internalTestApplies({...context,isPlatformCompany:true}),false);
 assert.equal(internalTestApplies({...context,testPlan:null}),false);
 assert.equal(internalTestApplies(context),true);
 assert.equal(internalTestApplies({...context,isPlatformCompany:undefined}),false);
});
test('el entitlement interno no concede una suscripción comercial',()=>{
 for(const plan of DEFAULT_PLANS)assert.deepEqual(internalTestEntitlement(plan.id),{access:true,state:'prueba_interna',plan:plan.id,internalTest:true});
});
