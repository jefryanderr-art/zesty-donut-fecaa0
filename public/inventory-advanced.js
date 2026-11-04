'use strict';
// Inventario avanzado (Fase 5): bodegas, kits, conteo cíclico, consignación/VNR y desembarque.
// Todo nace apagado; el dueño lo activa con motivo. Informes internos: verifica con tu contador.
const IV_MODULES=['bodegas','kits','conteo_ciclico','consignacion_vnr','desembarque'];
const IV_OPS={invEnable:null,invWarehouse:'bodegas',invLimit:'bodegas',invAssign:'bodegas',invTransfer:'bodegas',invKit:'kits',invCountOpen:'conteo_ciclico',invCountLink:'conteo_ciclico',invConsign:'consignacion_vnr',invConsignClose:'consignacion_vnr',invLanded:'desembarque',invLandedExpense:'desembarque'};
const IV_TEXT={help:'Herramientas internas de inventario. Cada módulo comienza apagado; se activa con motivo y confirmación. No generan asientos automáticos. Verifica con tu contador.',loading:'Consultando inventario autorizado…',error:'No se completó la gestión.',enable:'Activar o desactivar',enabled:'Habilitar para operaciones futuras',date:'Fecha efectiva',reason:'Motivo',confirmed:'Confirmo esta operación',save:'Guardar',refresh:'Actualizar',field:'Campo',value:'Valor',details:'Detalle',exportPdf:'Descargar PDF',exportCsv:'Descargar CSV',notice:'Informe interno de apoyo; no genera asientos automáticos. Verifica con tu contador.',warehouse:'Nueva bodega',name:'Nombre',zone:'Zona',limit:'Mínimo y máximo',min:'Mínimo',max:'Máximo',assign:'Asignar existencia',qty:'Cantidad',transfer:'Trasladar entre bodegas',from:'Origen',to:'Destino',warehouseId:'Bodega',productId:'Producto',alerts:'Alertas y reposición sugerida',stock:'Existencias por bodega',unassigned:'Sin asignar a bodega',kit:'Definir kit',components:'Componentes (código=cantidad, separados por coma)',kits:'Costo y disponibilidad',countOpen:'Abrir conteo',scope:'Alcance',zona:'Zona',categoria:'Categoría',scopeValue:'Zona o categoría',countHelp:'Primero realiza el conteo confirmado en Inventario y luego vincúlalo aquí.',countLink:'Vincular conteo realizado',entryId:'Conteo confirmado',consign:'Registrar consignación',supplier:'Proveedor',unitCostCents:'Costo unitario (centavos)',close:'Cerrar',nrv:'Valor neto realizable (solo reporte)',landedOpen:'Abrir desembarque de compra',purchaseId:'Compra',landedExpense:'Agregar factura de gasto',reference:'Factura',amountCents:'Importe (centavos)',concept:'Concepto',landed:'Costo puesto en bodega',bodegas:'Bodegas y ubicaciones',kits_t:'Kits y combos',conteo_ciclico:'Conteo cíclico',consignacion_vnr:'Consignación y valor neto realizable',desembarque:'Gastos de desembarque',kitLimit:'La venta de un kit no descuenta componentes automáticamente; usa el motor de ventas actual con sus componentes.'};
const ivT=k=>uiT('inventory.'+k,IV_TEXT[k]||k),ivE=k=>esc(ivT(k)),ivToday=()=>tsToday();
const ivModal=(title,body,ok)=>modal(esc(title),body,ok,esc(ivT('save')));
const ivField=(name,value='',type='text',attrs='')=>field(name,ivT(name),value,type,attrs);
const ivSelect=(name,rows,value)=>selectField(name,ivT(name),rows.map(([id,label])=>option(id,label,String(id)===String(value))).join(''));
const ivConfirm=()=>ivField('date',ivToday(),'date','required')+ivField('reason','','text','required minlength="3" maxlength="500"')+bCheck('confirmed',ivT('confirmed'))+notice(ivT('help'));
const ivCommon=f=>({date:v(f,'date'),reason:v(f,'reason'),confirmed:f.elements.confirmed.checked});
let IV_REPORT=null;
const ivAction=(action,label,id='')=>`<button type="button" class="btn ghost" data-a="${action}" data-id="${esc(id)}">${ivE(label)}</button>`;
const ivFetch=(format='VIEW')=>api('operations?c='+encodeURIComponent(CO.id),'POST',{operation:'inventoryReport',module:R,date:ivToday(),from:ivToday().slice(0,4)+'-01-01',to:ivToday(),format});
const ivFlat=(value,path='',rows=[])=>{if(value&&typeof value==='object')for(const [k,vv]of Object.entries(value))ivFlat(vv,path?path+' / '+k:k,rows);else rows.push([path,String(value??'')]);return rows};
const ivDisplay=data=>table([ivT('field'),ivT('value')],ivFlat(data).map(([k,val])=>'<tr><td>'+esc(k)+'</td><td>'+esc(val)+'</td></tr>').join(''));
const ivProducts=()=>(S.products||[]).filter(p=>p.kind!=='service').map(p=>[p.id,(p.code?p.code+' · ':'')+p.name]);
const ivWarehouses=()=>IV_REPORT.records.filter(r=>r.kind==='warehouse'&&r.status==='Activa').map(w=>[w.id,w.name]);
const ivBase=actionAllowed;
actionAllowed=function(action,data={}){if(action in IV_OPS)return permission(IV_OPS[action]||R,true);if(['invExport','invDetails'].includes(action))return permission(R,false);return ivBase(action,data)};
for(const a of ['invExport','invDetails'])READ_ACTIONS.add(a);
for(const module of IV_MODULES)V[module]=async()=>{
 const companyId=CO.id,route=R;main(pageHead(ivT(module==='kits'?'kits_t':module))+notice(ivT('loading')));
 try{
  const report=await ivFetch();if(CO.id!==companyId||R!==route)return;IV_REPORT=report;
  const write=permission(module,true),enabled=report.enabled;let controls=CO.owner&&write?ivAction('invEnable','enable'):'',sections='';
  if(enabled&&write){
   if(module==='bodegas')controls+=ivAction('invWarehouse','warehouse')+ivAction('invLimit','limit')+ivAction('invAssign','assign')+ivAction('invTransfer','transfer');
   if(module==='kits')controls+=ivAction('invKit','kit');
   if(module==='conteo_ciclico')controls+=ivAction('invCountOpen','countOpen')+ivAction('invCountLink','countLink');
   if(module==='consignacion_vnr')controls+=ivAction('invConsign','consign');
   if(module==='desembarque')controls+=ivAction('invLanded','landedOpen')+ivAction('invLandedExpense','landedExpense');
  }
  if(module==='bodegas'&&enabled)sections+='<section class="card"><h3>'+ivE('stock')+'</h3>'+ivDisplay(report.stock)+'</section><section class="card"><h3>'+ivE('alerts')+'</h3>'+ivDisplay(report.alerts)+'</section><section class="card"><h3>'+ivE('unassigned')+'</h3>'+ivDisplay(report.unassigned)+'</section>';
  if(module==='kits'&&enabled)sections+='<section class="card"><h3>'+ivE('kits')+'</h3>'+notice(ivT('kitLimit'))+ivDisplay(report.kits)+'</section>';
  if(module==='consignacion_vnr'&&enabled)sections+='<section class="card"><h3>'+ivE('consign')+'</h3>'+ivDisplay(report.consignments)+'</section><section class="card"><h3>'+ivE('nrv')+'</h3>'+ivDisplay(report.nrv)+'</section>';
  if(module==='desembarque'&&enabled)sections+='<section class="card"><h3>'+ivE('landed')+'</h3>'+ivDisplay(report.landed)+'</section>';
  if(module==='conteo_ciclico'&&enabled)sections+=notice(ivT('countHelp'));
  const rows=report.records.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.status)+'</td><td>'+ivAction('invDetails','details',r.id)+(enabled&&write&&r.kind==='consignment'&&r.status==='Abierta'?ivAction('invConsignClose','close',r.id):'')+'</td></tr>').join('');
  main(pageHead(ivT(module==='kits'?'kits_t':module))+notice(ivT('help'))+`<section class="card">${controls}${ivAction('invExport','exportPdf','PDF')}${ivAction('invExport','exportCsv','CSV')}</section>${sections}<section class="card">${table([ivT('name'),ivT('date'),ivT('field'),''],rows)}</section>`);enforceAccessUI();
 }catch(error){main(pageHead(ivT(module==='kits'?'kits_t':module))+notice(error.message||ivT('error')))}
};
const ivOp=(op,extra=()=>({}))=>async f=>{await operate(op,{...ivCommon(f),module:R,...extra(f)});view()};
ACT.invEnable=()=>ivModal(ivT('enable'),bCheck('enabled',ivT('enabled'))+ivConfirm(),async f=>{await operate('invEnable',{...ivCommon(f),module:R,enabled:f.elements.enabled.checked});view()});
ACT.invWarehouse=()=>ivModal(ivT('warehouse'),ivField('name','','text','required maxlength="80"')+ivField('zone','','text','maxlength="80"')+ivConfirm(),ivOp('invWarehouse',f=>({name:v(f,'name'),zone:v(f,'zone')})));
ACT.invLimit=()=>ivModal(ivT('limit'),ivSelect('warehouseId',ivWarehouses())+ivSelect('productId',ivProducts())+ivField('min','','number','min="0" step="any"')+ivField('max','','number','min="0" step="any"')+ivConfirm(),ivOp('invLimit',f=>({warehouseId:v(f,'warehouseId'),productId:v(f,'productId'),min:v(f,'min'),max:v(f,'max')})));
ACT.invAssign=()=>ivModal(ivT('assign'),ivSelect('warehouseId',ivWarehouses())+ivSelect('productId',ivProducts())+ivField('qty',0,'number','required min="0" step="any"')+ivConfirm(),ivOp('invAssign',f=>({warehouseId:v(f,'warehouseId'),productId:v(f,'productId'),qty:Number(v(f,'qty'))})));
ACT.invTransfer=()=>ivModal(ivT('transfer'),ivSelect('from',ivWarehouses())+ivSelect('to',ivWarehouses())+ivSelect('productId',ivProducts())+ivField('qty',1,'number','required min="0" step="any"')+ivConfirm(),ivOp('invTransfer',f=>({fromWarehouseId:v(f,'from'),toWarehouseId:v(f,'to'),productId:v(f,'productId'),qty:Number(v(f,'qty'))})));
ACT.invKit=()=>ivModal(ivT('kit'),ivSelect('productId',ivProducts())+ivField('components','','text','required')+ivConfirm(),ivOp('invKit',f=>({productId:v(f,'productId'),components:v(f,'components').split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const [key,q]=s.split('='),p=(S.products||[]).find(p=>p.code===key.trim()||p.name===key.trim());return {p:p?.id||'',q:Number(q)}})})));
ACT.invCountOpen=()=>ivModal(ivT('countOpen'),ivSelect('scope',[['zona',ivT('zona')],['categoria',ivT('categoria')]])+ivField('scopeValue','','text','required maxlength="80"')+ivConfirm(),ivOp('invCountOpen',f=>({scope:v(f,'scope'),value:v(f,'scopeValue')})));
ACT.invCountLink=()=>ivModal(ivT('countLink'),notice(ivT('countHelp'))+ivSelect('id',IV_REPORT.records.filter(r=>r.kind==='count'&&r.status==='Abierto').map(r=>[r.id,r.name]))+ivSelect('entryId',(S.entries||[]).filter(e=>e.type==='conteo').slice(-50).map(e=>[e.id,e.date+' · '+e.desc]))+ivConfirm(),ivOp('invCountLink',f=>({id:v(f,'id'),entryId:v(f,'entryId')})));
ACT.invConsign=()=>ivModal(ivT('consign'),ivField('supplier','','text','required maxlength="120"')+ivSelect('productId',ivProducts())+ivField('qty',1,'number','required min="0" step="any"')+ivField('unitCostCents',0,'number','required min="0" step="1"')+ivConfirm(),ivOp('invConsign',f=>({supplier:v(f,'supplier'),productId:v(f,'productId'),qty:Number(v(f,'qty')),unitCostCents:Number(v(f,'unitCostCents'))})));
ACT.invConsignClose=d=>ivModal(ivT('close'),ivConfirm(),ivOp('invConsignClose',()=>({id:d.id})));
ACT.invLanded=()=>ivModal(ivT('landedOpen'),ivSelect('purchaseId',(S.entries||[]).filter(e=>e.type==='compra'&&e.stock?.length).slice(-100).map(e=>[e.id,(e.reference||e.id)+' · '+e.party]))+ivConfirm(),ivOp('invLanded',f=>({purchaseId:v(f,'purchaseId')})));
ACT.invLandedExpense=()=>ivModal(ivT('landedExpense'),ivSelect('id',IV_REPORT.records.filter(r=>r.kind==='landed').map(r=>[r.id,r.name]))+ivField('supplier','','text','required maxlength="120"')+ivField('reference','','text','required maxlength="60"')+ivField('amountCents',0,'number','required min="1" step="1"')+ivField('concept','','text','maxlength="120"')+ivConfirm(),ivOp('invLandedExpense',f=>({id:v(f,'id'),supplier:v(f,'supplier'),reference:v(f,'reference'),amountCents:Number(v(f,'amountCents')),concept:v(f,'concept')})));
ACT.invDetails=d=>ivModal(ivT('details'),ivDisplay(IV_REPORT.records.find(r=>r.id===d.id)),()=>{});
const ivDownload=(name,blob)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)};
ACT.invExport=async d=>{
 const format=d.id==='PDF'?'PDF':'CSV',report=await ivFetch(format);
 const meta=[['company',report.company],['period',report.from+' / '+report.to],['generatedAt',report.generatedAt],['generatedBy',report.generatedBy],['version',report.version],['branchId',report.branchId]];
 const tabular=[[ivT('field'),ivT('value')],...ivFlat({records:report.records,stock:report.stock,alerts:report.alerts,unassigned:report.unassigned,kits:report.kits,consignments:report.consignments,nrv:report.nrv,landed:report.landed})];
 const name=R+'-'+ivToday();
 if(format==='CSV'){const encode=x=>'"'+String(x).replaceAll('"','""').replace(/^\s*[=+@-]/,"'$&")+'"';ivDownload(name+'.csv',new Blob(['﻿'+[...meta,[ivT('notice')],...tabular].map(r=>r.map(encode).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));return}
 await loadExportScript('/vendor/jspdf.js?v=0f6fe797a6df06bd');await loadExportScript('/vendor/autotable.js?v=31884888608c7aab');
 const pdf=new jspdf.jsPDF({orientation:'landscape'});pdf.text(ivT(R==='kits'?'kits_t':R),14,14);pdf.setFontSize(8);pdf.text(meta.map(([k,x])=>k+': '+x).join('  ·  '),14,20);pdf.text(ivT('notice'),14,25);
 pdf.autoTable({startY:30,head:[tabular[0].map(String)],body:tabular.slice(1).map(r=>r.map(String)),styles:{fontSize:7}});pdf.save(name+'.pdf');
};
