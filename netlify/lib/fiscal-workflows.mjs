import {randomUUID,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {getStore} from '@netlify/blobs';
import {fiscalCheck as check} from './fiscal-rules.mjs';
import {documentHash} from './accounting-codec.mjs';
import {periodPackage,periodRange,WORK_NOTICE} from './period-package.mjs';
import {annualPreview} from './annual-closing.mjs';
import {WORKFLOW_MODULES,workflowEnabled,workflowRows,nicaraguaTemplate,validateTemplate,activeTemplates,declarationsForPeriod,declarationCalculation,validateWorkflow,lateCharges} from './declaration-rules.mjs';
export const WORKFLOW_OPS=['workflowEnable','workflowLoss','workflowTemplate','workflowPrepare','workflowPresent','workflowPay','workflowRectify','workflowSettings','workflowPackage','workflowClose','workflowReopen'];
export const workflowModule=body=>['workflowClose','workflowReopen'].includes(body.operation)?'cierre_anual':body.operation==='workflowEnable'||body.operation==='workflowPackage'?body.module:'declaraciones';
export const accountingPermissionModules=['contabilidad','fiscal','personal','inventario','ventas','compras','gastos','cajas','costos','proveedores'];
export function permitPackage(access,permit,data){
 for(const m of accountingPermissionModules)permit(access,m,false);
 // Un paquete contiene también anexos de los módulos que estén presentes.
 for(const m of new Set((data?.businessRecords||[]).filter(r=>['bancos','constancias_laborales','retenciones_fiscales'].includes(r.module)).map(r=>r.module)))permit(access,m,false);
 check(!access.support,'El soporte temporal no puede generar paquetes ni cierres.');
}
export function workflowFileRecord(data,access,id,type='zip'){
 check(access.branchId&&!access.support,'Selecciona una sucursal autorizada.');
 const record=(data.fiscalWorkflows||[]).find(r=>r.id===id&&r.branchId===access.branchId);
 check(record&&['declaration','closure','packageJob'].includes(record.kind),'Archivo no encontrado.');
 check(type!=='backup'||access.owner&&!access.member,'Solo el dueño descarga el respaldo completo.');
 return record;
}
export function workflowPacket(data,period,meta){const p=periodPackage(data,period,meta);p.declarations=workflowEnabled(data,'declaraciones')?declarationsForPeriod(data,period,meta.generatedAt):[];p.meta.templates=activeTemplates(data).map(t=>({id:t.id,country:t.template.country,version:t.version}));delete p.hash;p.hash=documentHash(p);return p;}
export function workflowReport(data,body,meta={}){
 const module=body.module;check(WORKFLOW_MODULES.includes(module),'Módulo inválido.');const enabled=workflowEnabled(data,module);
 const base={enabled,module,notice:WORK_NOTICE,electronicFiling:false};if(!enabled)return base;
 const period=body.period;periodRange(period);const packet=workflowPacket(data,period,meta);
 return {...base,period,packet,declarations:module==='declaraciones'?packet.declarations:[],templates:module==='declaraciones'?activeTemplates(data):[],templateBase:nicaraguaTemplate(),lossBalances:workflowRows(data,'declaraciones').filter(r=>r.kind==='lossBalance'),closures:workflowRows(data,'cierre_anual').filter(r=>r.kind==='closure'),jobs:workflowRows(data,module).filter(r=>r.kind==='packageJob'&&r.period===period).map(({id,status,progress,error,receipt,period})=>({id,status,progress,error,receipt:receipt?{name:receipt.name,size:receipt.size}:null,period})),preview:module==='cierre_anual'?annualPreview(data,period):null};
}
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const text=(s,n=200)=>String(s||'').trim().slice(0,n);
export async function workflowOperation(data,access,session,body,ctx){
 const module=workflowModule(body),op=body.operation;check(WORKFLOW_MODULES.includes(module),'Módulo inválido.');ctx.permit(access,module,true);
 check(!access.support&&access.branchId,'Selecciona una sucursal autorizada.');
 check(body.confirmed===true&&text(body.reason,501).length>=3&&text(body.reason,501).length<=500,'Confirma e indica el motivo (3 a 500 caracteres).');
 const actor=session.member?.name||session.email,now=new Date().toISOString(),reason=text(body.reason,500);
 const records=data.fiscalWorkflows||=[],event={action:op,actor,at:now,reason};
 const add=(kind,values={})=>{const row={id:randomUUID(),module,kind,date:now.slice(0,10),branchId:access.branchId,events:[event],...values};records.push(row);data.fiscalWorkflows=records;return row;};
 const get=id=>{const row=records.find(r=>r.id===id&&r.module===module&&(['configuration','template'].includes(r.kind)||r.branchId===access.branchId));check(row,'Registro no encontrado en la sucursal.');return row;};
 const store=ctx.store||getStore({name:'acontec-private-receipts',consistency:'strong'});
 const put=async(bytes,name,mime='application/json',generated=true)=>{const key=ctx.companyId+'/'+randomUUID();ctx.addedKeys.push(key);await store.set(key,bytes);return {key,name,mime,generated,size:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};};
 const file=async(input)=>{
  check(input&&typeof input.base64==='string'&&input.base64.length<=1400000,'Adjunta un comprobante de hasta 1 MB.');const bytes=Buffer.from(input.base64,'base64');check(bytes.length>0&&bytes.length<=1048576&&bytes.toString('base64')===input.base64,'Adjunto inválido.');
  const valid=input.mime==='application/pdf'&&bytes.toString('ascii',0,5)==='%PDF-'||input.mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||input.mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||input.mime==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';check(valid,'Usa un PDF, JPG, PNG o WebP válido.');
  const retained=[...await ctx.receipts(),...ctx.newReceipts].filter(r=>!r.generated);check(retained.length<100&&retained.reduce((s,r)=>s+(r.size||0),0)+bytes.length<=52428800,'Límite de comprobantes: 100 archivos o 50 MB por empresa.');
  const receipt=await put(bytes,text(input.name,150).replace(/[\x00-\x1f/\\]/g,'')||'comprobante',input.mime,false);ctx.newReceipts.push(receipt);return receipt;
 };
 const makeJob=async(period,packet)=>{const snapshot=await put(Buffer.from(JSON.stringify(packet)),'paquete-'+period+'.json');return add('packageJob',{period,status:'pendiente',progress:0,snapshot,packetHash:packet.hash,createdBy:session.email,createdMemberId:session.memberId||null}).id;};
 if(op==='workflowEnable'){
  check(access.owner&&!access.member&&typeof body.enabled==='boolean','Solo el dueño activa cada módulo.');
  let config=workflowRows(data,module).find(r=>r.kind==='configuration');if(!config)config=add('configuration');else config.events.push(event);config.enabled=body.enabled;
  if(module==='declaraciones'&&body.enabled&&!workflowRows(data,module).some(r=>r.kind==='template')){const template=nicaraguaTemplate();add('template',{family:template.id,version:1,template});}
  return config.id;
 }
 check(workflowEnabled(data,module),'El dueño debe activar este módulo.');
 if(op==='workflowLoss'){
  check(access.owner||(access.rolePolicy?access.rolePolicy.modules?.[body.operation==='workflowClose'?'cierre_anual':'fiscal']?.edit===true:String(access.member?.role).toLowerCase()==='contador'),'Solo el dueño o contador configura pérdidas.');ctx.permit(access,'fiscal',true);ctx.permit(access,'contabilidad',false);
  check(/^20\d{2}$/.test(body.period||'')&&body.period<now.slice(0,4)&&Number.isSafeInteger(body.amountCents)&&body.amountCents>0&&text(body.source,501).length>=3&&validDate(body.effectiveFrom),'Pérdida sin año anterior, centavos, fuente o vigencia válidos.');
  check(!records.some(r=>r.kind==='lossBalance'&&r.period===body.period),'Ya existe un saldo registrado para ese año; conserva su origen y revisa ajustes con el contador.');
  check(Array.isArray(body.entryIds)&&body.entryIds.length>0&&body.entryIds.length<=100&&body.entryIds.every(id=>data.entries.some(e=>e.id===id&&e.date.startsWith(body.period))),'Vincula asientos del año de origen.');
  return add('lossBalance',{period:body.period,amountCents:body.amountCents,source:text(body.source,500),effectiveFrom:body.effectiveFrom,entryIds:body.entryIds}).id;
 }
 if(op==='workflowTemplate'){
  check(access.owner||(access.rolePolicy?access.rolePolicy.modules?.[body.operation==='workflowClose'?'cierre_anual':'fiscal']?.edit===true:String(access.member?.role).toLowerCase()==='contador'),'Solo el dueño o contador configura plantillas.');ctx.permit(access,'fiscal',true);
  const template=validateTemplate(body.template),old=body.id?get(body.id):null;check(!old||old.kind==='template','Plantilla inválida.');
  check(!old||!records.some(r=>r.kind==='template'&&r.parentId===old.id),'La plantilla cambió. Recarga la versión actual.');
  return add('template',{family:old?.family||randomUUID(),version:(old?.version||0)+1,parentId:old?.id||null,template}).id;
 }
 permitPackage(access,ctx.permit,data);
 const meta={company:access.company.name,companyId:ctx.companyId,branchId:access.branchId,generatedAt:now,generatedBy:actor,revision:access.company.revision};
 if(op==='workflowPackage'){periodRange(body.period);return makeJob(body.period,workflowPacket(data,body.period,meta));}
 if(op==='workflowClose'){
  check(access.owner||(access.rolePolicy?access.rolePolicy.modules?.[body.operation==='workflowClose'?'cierre_anual':'fiscal']?.edit===true:String(access.member?.role).toLowerCase()==='contador'),'Solo el dueño o contador cierra el ejercicio.');ctx.permit(access,'contabilidad',true);
  const preview=annualPreview(data,body.period);check(preview.hash===body.previewHash,'La vista previa cambió. Revísala antes de confirmar.');check(!preview.pending.length,'Pendientes: '+preview.pending.join(' '));
  // Respaldo íntegro del documento de empresa, además del checkpoint transaccional existente.
  const backup=await put(gzipSync(Buffer.from(JSON.stringify({format:'acontec-before-annual-close-v1',data:access.company.data,revision:access.company.revision,meta}))), 'respaldo-antes-cierre-'+body.period+'.json.gz','application/gzip');
  const packet=workflowPacket(data,body.period,meta),packageJobId=await makeJob(body.period,packet);
  if(!data.accounts.some(a=>a.code==='3198'))data.accounts.push({code:'3198',name:'Resultado del ejercicio (cierre anual)',introducedByAnnualCloseOn:preview.to,tipo:'patrimonio',nat:'C',sub:''});
  const entryIds=[];for(const [type,lines,date]of [['cierre-anual',preview.closing,preview.to],['traspaso-anual',preview.transfer,preview.to],['apertura-anual',preview.opening,preview.openingDate]])if(lines.length){const e=ctx.append(data,session,{date,type,year:body.period,branchId:access.branchId,desc:type+' '+body.period+' · '+reason,total:lines.reduce((s,l)=>s+Math.round(l.d*100),0)/100,lines});entryIds.push(e.id);}
  // Un año vacío también tiene corte de apertura identificable (asiento de saldo cero).
  if(!preview.opening.length){const e=ctx.append(data,session,{date:preview.openingDate,type:'apertura-anual',year:body.period,branchId:access.branchId,desc:'Apertura anual sin saldos',total:0,lines:[]});entryIds.push(e.id);}
  data.cfg.periodLocks||={};for(const month of preview.months)data.cfg.periodLocks[access.branchId+':'+month]={closed:true,reason,actor,at:now,source:'annual'};
  return add('closure',{period:body.period,state:'cerrado',previewHash:preview.hash,entryIds,backup,packageJobId,packetHash:packet.hash}).id;
 }
 if(op==='workflowReopen'){
  check(access.owner&&!access.member,'Solo el dueño reabre el ejercicio.');ctx.permit(access,'contabilidad',true);const r=get(body.id);check(r.kind==='closure'&&r.state==='cerrado','Cierre no disponible para reapertura.');
  check(!records.some(c=>c.kind==='closure'&&c.state==='cerrado'&&c.period>r.period),'Reabre primero los ejercicios posteriores.');
  const originals=r.entryIds.map(id=>data.entries.find(e=>e.id===id));check(originals.every(Boolean),'Faltan asientos del cierre.');
  for(const e of originals){const type=e.type==='apertura-anual'?'anula-apertura-anual':'reapertura-anual';ctx.append(data,session,{date:e.date,type,branchId:access.branchId,openingId:e.type==='apertura-anual'?e.id:undefined,closureId:r.id,desc:'Reapertura · '+reason,total:e.total,lines:e.lines.map(l=>({a:l.a,d:l.c,c:l.d}))});}
  for(const month of periodRange(r.period).months)data.cfg.periodLocks[access.branchId+':'+month]={closed:false,reason,actor,at:now,source:'annual-reopen'};
  r.state='reabierto';r.events.push(event);return r.id;
 }
 ctx.permit(access,'fiscal',true);
 let r=body.id?get(body.id):null;
 if(op==='workflowPrepare'&&!r){
  const template=activeTemplates(data).find(t=>t.id===body.templateId);check(template,'Plantilla no vigente.');const definition=template.template.declarations.find(d=>d.id===body.definitionId);check(definition,'Declaración no encontrada.');
  periodRange(body.period);check(!workflowRows(data,module).some(x=>x.kind==='declaration'&&x.templateFamily===template.family&&x.definitionId===definition.id&&x.period===body.period&&!x.parentId),'Ya existe una declaración para ese período.');
  r=add('declaration',{period:body.period,templateFamily:template.family,templateSnapshot:{...structuredClone(template.template),id:template.id,version:template.version},definitionSnapshot:structuredClone(definition),definitionId:definition.id,state:'pendiente',settings:{credits:[],adjustments:[]}});
 }
 check(r?.kind==='declaration','Selecciona una declaración.');
 if(op==='workflowRectify'){
  check(r.frozen,'Solo se rectifica una declaración presentada.');check(!records.some(x=>x.kind==='declaration'&&x.parentId===r.id),'Ya existe una rectificativa de esta versión.');
  return add('declaration',{parentId:r.id,period:r.period,templateFamily:r.templateFamily,definitionId:r.definitionId,templateSnapshot:structuredClone(r.templateSnapshot),definitionSnapshot:structuredClone(r.definitionSnapshot),state:'pendiente',settings:{credits:[],adjustments:[]}}).id;
 }
 if(op==='workflowSettings'){
  check(!r.frozen,'Una presentada se conserva; crea una rectificativa.');check(body.settings&&Buffer.byteLength(JSON.stringify(body.settings))<=60000,'Ajustes demasiado grandes.');
  check(Object.keys(body.settings).every(k=>['credits','adjustments'].includes(k)),'Campo de ajuste no permitido.');
  check(Array.isArray(body.settings.credits)&&Array.isArray(body.settings.adjustments)&&body.settings.credits.length<=100&&body.settings.adjustments.length<=100,'Ajustes inválidos.');
  declarationCalculation(data,r.templateSnapshot,r.definitionSnapshot,r.period,{...body.settings,declarationId:r.id,parentId:r.parentId},now);r.settings=structuredClone(body.settings);r.events.push(event);return r.id;
 }
 if(op==='workflowPay'){
  check(r.frozen&&r.state!=='pagada'&&validDate(body.paymentDate)&&body.paymentDate>=r.filing.date&&text(body.bank)&&text(body.reference),'Pago sin presentación, banco, fecha o referencia válidos.');
  check(Number.isSafeInteger(body.amountCents)&&body.amountCents>0,'El pago requiere centavos enteros positivos.');
  const charges=lateCharges(r.definitionSnapshot,r.frozen.amountCents,r.frozen.due,body.paymentDate,periodRange(r.period).to);
  check(body.amountCents===(r.frozen.amountCents||0)+charges.penaltyCents+charges.interestCents,'El comprobante debe cubrir exactamente el monto congelado y los recargos calculados.');
  r.payment={...charges,bank:text(body.bank),reference:text(body.reference),date:body.paymentDate,amountCents:body.amountCents,receipt:await file(body.file)};r.state='pagada';r.events.push(event);return r.id;
 }
 check(!r.frozen,'Una presentada es inmutable; crea una rectificativa.');
 const calculation=declarationCalculation(data,r.templateSnapshot,r.definitionSnapshot,r.period,{...r.settings,declarationId:r.id,parentId:r.parentId},now);check(!calculation.missing.length,'Falta configurar: '+calculation.missing.join(' '));
 if(op==='workflowPrepare'){r.prepared=calculation;r.state='preparada';r.preparedAt=now;r.events.push(event);return r.id;}
 if(op==='workflowPresent'){
  check(r.state==='preparada'&&text(body.reference)&&validDate(body.filingDate)&&body.filingDate>=periodRange(r.period).from&&body.filingDate<=now.slice(0,10),'Prepara la declaración e indica comprobante y fecha válidos.');
  check(body.calculationHash===calculation.hash,'Las cifras cambiaron. Revisa el cálculo actual.');
  const receipt=await file(body.file),packet=workflowPacket(data,r.period,meta);r.frozen=calculation;r.state=r.parentId?'rectificada':'presentada';r.filing={reference:text(body.reference),date:body.filingDate,receipt};
  // El paquete contiene las cifras de esta presentación, no el estado anterior de la pantalla.
  packet.declarations=declarationsForPeriod(data,r.period,now);packet.attachments.push({type:'presentacion',id:r.id,...receipt});delete packet.hash;packet.hash=documentHash(packet);
  r.package={receipt:await put(Buffer.from(JSON.stringify(packet)),'paquete-congelado-'+r.period+'.json'),hash:packet.hash};r.packageJobId=await makeJob(r.period,packet);
  if(body.lockPeriod===true){check(access.owner,'Solo el dueño bloquea el período al presentar.');data.cfg.periodLocks||={};for(const month of periodRange(r.period).months)data.cfg.periodLocks[access.branchId+':'+month]={closed:true,reason,actor,at:now,source:'declaration'};}
  r.events.push(event);return r.id;
 }
 check(false,'Operación fiscal no disponible.');
}
export function guardWorkflows(previous,next,action){
 const a=previous?.fiscalWorkflows||[],b=next?.fiscalWorkflows||[];
 const authorized=WORKFLOW_OPS.some(op=>action==='Operación: '+op)||action==='Paquete fiscal procesado';
 if(documentHash(a)!==documentHash(b)&&!authorized)check(false,'Usa las operaciones protegidas de Declaraciones y Cierre anual.');
 const old=new Map(a.map(r=>[r.id,r]));for(const r of a){const n=b.find(n=>n.id===r.id);check(n,'Los registros fiscales históricos se conservan.');if(r.frozen)check(documentHash(r.frozen)===documentHash(n.frozen)&&documentHash(r.templateSnapshot)===documentHash(n.templateSnapshot)&&documentHash(r.filing)===documentHash(n.filing)&&documentHash(r.package)===documentHash(n.package),'La presentación y su paquete congelado son inmutables.');if(['template','lossBalance'].includes(r.kind))check(documentHash(r)===documentHash(n),'Las plantillas se cambian creando otra versión.');}
 const entries=new Map((next.entries||[]).map(e=>[e.id,e]));for(const e of previous?.entries||[])if(['apertura-anual','cierre-anual','traspaso-anual','anula-apertura-anual','reapertura-anual'].includes(e.type))check(documentHash(e)===documentHash(entries.get(e.id)||null),'Los asientos automáticos se conservan; usa Reabrir.');
 for(const e of next.entries||[])if(['apertura-anual','cierre-anual','traspaso-anual','anula-apertura-anual','reapertura-anual'].includes(e.type)&&!(previous?.entries||[]).some(p=>p.id===e.id))check(['Operación: workflowClose','Operación: workflowReopen'].includes(action),'Asiento anual fuera de su operación autorizada.');
 for(const tax of next.taxes||[]){const oldTax=(previous?.taxes||[]).find(t=>t.id===tax.id);if(tax.source==='iva'&&tax.usedCredit>0&&documentHash(oldTax||null)!==documentHash(tax))check(tax.usedCredit<=globalThis.AcontecFiscalMath.vatCreditAvailable(previous||{},tax.period),'Crédito de IVA reservado en una declaración presentada.');}
 validateWorkflow(next);
}
