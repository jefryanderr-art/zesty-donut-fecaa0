import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceWorkflow,checkServiceBilling,serviceTimeBilling,checkServiceSchedule} from '../netlify/lib/service-workflows.mjs';
import {serviceTripRows,serviceAlerts} from '../public/service-model.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const access={branchId:'principal',owner:true,company:{businessType:'profesionales'}};
const context={check,permit:()=>{},date:value=>value};
const session={email:'operador@example.test'};
test('cotización convierte líneas y anticipo una sola vez',async()=>{
 const quote={id:'quote',module:'documentos_venta',branchId:'principal',status:'Pendiente',name:'Proyecto',date:'2026-11-01',items:[{p:'service',q:2,u:40}],total:80,deposit:20,depositAccount:'2108'};
 const data={businessRecords:[quote]};const body={operation:'businessServicesQuote',id:'quote',module:quote.module,confirmed:true,date:'2026-11-05'};
 const id=await serviceWorkflow(data,access,session,body,context),project=data.businessRecords.find(r=>r.id===id);
 assert.equal(project.deposit,20);assert.equal(quote.deposit,0);assert.equal(quote.status,'Convertido');assert.equal(quote.convertedProjectId,id);
 await assert.rejects(()=>serviceWorkflow(data,access,session,body,context));assert.equal(data.businessRecords.length,2);
});
test('bonos conservan precio, cantidades y anticipo suficiente',()=>{
 const r={module:'proyectos',servicePackage:true,deposit:50,items:[{p:'s',q:3,u:25}],billed:[{entryId:'invoice'}]};
 const data={entries:[{id:'invoice',items:[{p:'s',q:1,u:25}]}]};
 assert.doesNotThrow(()=>checkServiceBilling(r,[{p:'s',q:2,u:25,vatRate:0}],data,check));
 assert.throws(()=>checkServiceBilling(r,[{p:'s',q:3,u:25}],data,check));
 assert.throws(()=>checkServiceBilling(r,[{p:'s',q:1,u:24}],data,check));
 assert.throws(()=>checkServiceBilling({...r,deposit:1},[{p:'s',q:1,u:25}],data,check));
});
test('el tiempo exige horas exactas y no admite un registro facturado',()=>{
 const r={module:'proyectos',serviceTime:[{id:'t',minutes:45}]};
 assert.equal(serviceTimeBilling(r,[{q:0.75}],{serviceTimeIds:['t']},check).length,1);
 assert.throws(()=>serviceTimeBilling(r,[{q:1}],{serviceTimeIds:['t']},check));
 r.serviceTime[0].entryId='invoice';assert.throws(()=>serviceTimeBilling(r,[{q:0.75}],{serviceTimeIds:['t']},check));
});
test('profesional no se solapa entre consultorios y alimentos conserva su circuito',()=>{
 const a={id:'a',module:'agenda',branchId:'principal',responsible:'Doctora',start:'2026-11-05T10:00:00Z',end:'2026-11-05T11:00:00Z'},b={...a,id:'b'};
 assert.throws(()=>checkServiceSchedule(a,[b],check,'salud'));
 assert.doesNotThrow(()=>checkServiceSchedule(a,[b],check,'restaurante'));
 assert.doesNotThrow(()=>checkServiceSchedule({...a,service:{waiting:true}},[b],check,'belleza'));
});
test('cupo y asistencia rechazan duplicados y membresías vencidas',async()=>{
 const r={id:'class',module:'agenda',name:'Clase',date:'2026-11-01',branchId:'principal',service:{capacity:1}},data={businessRecords:[r],customers:[{id:'a',status:'activo',name:'Alumno'},{id:'b',status:'activo',name:'Alumno 2'}]};
 const b={operation:'businessServicesAttendance',id:r.id,module:r.module,date:'2026-11-05',confirmed:true,mode:'reservar',customerId:'a'};
 await serviceWorkflow(data,{...access,company:{businessType:'gimnasio'}},session,b,context);
 await assert.rejects(()=>serviceWorkflow(data,access,session,{...b,customerId:'b'},context));
 r.service.expires='2026-11-04';await assert.rejects(()=>serviceWorkflow(data,access,session,{...b,mode:'asistencia'},context));
});
test('rentabilidad excluye costos anulados e incluye devoluciones en centavos',()=>{
 const rows=serviceTripRows([{id:'trip',name:'Viaje',service:{unit:'Unidad 4'},billed:[{entryId:'sale'}]}],[{id:'sale',type:'venta',subtotal:120.15},{id:'nc',type:'nota-credito',invoiceId:'sale',subtotal:10.10}],[{businessId:'trip',base:20.01},{businessId:'trip',base:50,reversalId:'undo'}]);
 assert.equal(rows[0].profitCents,9004);
 assert.equal(serviceAlerts({service:{noticeDays:7,renewalDate:'2026-11-12'}},'2026-11-05').length,1);
});
