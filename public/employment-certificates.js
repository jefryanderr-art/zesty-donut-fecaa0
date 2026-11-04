'use strict';
const EC_TEXT={"title": "Constancias laborales", "loading": "Consultando permisos y configuración…", "help": "Constancias con texto definido por el dueño. Sin validez oficial garantizada; verifica con tu contador. Cada descarga queda en bitácora.", "configure": "Configurar constancias de esta sucursal", "enabled": "Constancias habilitadas en esta sucursal.", "disabled": "Apagado por defecto. El dueño debe configurar y activar esta sucursal.", "pdf": "Descargar PDF", "csv": "Descargar CSV para Excel", "enable": "Habilitar constancias futuras en esta sucursal", "workText": "Texto de la constancia de trabajo", "incomeText": "Texto de la constancia de ingresos", "plainText": "Texto literal, sin HTML ni variables. Los datos del empleado y el período se agregan por separado. Cambiar el texto conserva versiones de respaldo y no cambia documentos descargados.", "reason": "Motivo para la bitácora", "confirm": "Confirmo la configuración para futuras constancias", "save": "Guardar", "employee": "Empleado", "kind": "Tipo de constancia", "work": "Constancia de trabajo", "income": "Constancia de ingresos", "from": "Desde", "to": "Hasta", "basis": "Ingresos: percepciones brutas de nóminas pagadas según fecha de pago dentro del período. No incluye adelantos, liquidaciones ni nóminas pendientes. Verifica con tu contador.", "company": "Empresa", "branch": "Sucursal", "period": "Período", "generated": "Fecha de generación", "author": "Generado por", "version": "Versión del formato", "templateVersion": "Versión del texto", "position": "Cargo", "start": "Fecha de ingreso", "text": "Texto de la empresa", "gross": "Ingresos brutos pagados (centavos)", "currency": "Moneda", "notice": "Aviso", "download": "Descargar", "error": "No se pudo generar la constancia."};
const ecT=k=>uiT('employment.'+k,EC_TEXT[k]),ecE=k=>esc(ecT(k));
const ecButton=(action,label)=>`<button type="button" class="btn ghost" data-a="${action}">${ecE(label)}</button>`;
let EC_VIEW=null;
const ecAllowed=actionAllowed;
actionAllowed=function(action,data={}){
 if(action==='certificateConfigure')return !!CO?.owner&&permission('constancias_laborales',true)&&permission('personal',true);
 if(['certificatePdf','certificateCsv'].includes(action))return permission('constancias_laborales')&&permission('personal');
 return ecAllowed(action,data);
};
READ_ACTIONS.add('certificatePdf');READ_ACTIONS.add('certificateCsv');
V.constancias_laborales=async()=>{
 const id=CO.id,route=R;EC_VIEW=null;main(pageHead(ecT('title'))+notice(ecT('loading')));
 try{
  const result=await api('operations?c='+encodeURIComponent(id),'POST',{operation:'certificateView'});
  if(CO.id!==id||R!==route)return;EC_VIEW=result;
  main(pageHead(ecT('title'))+notice(ecT('help'))+'<section class="card">'+(CO.owner&&permission('personal',true)&&permission('constancias_laborales',true)?ecButton('certificateConfigure','configure'):'')+notice(ecT(result.enabled?'enabled':'disabled'))+(result.enabled?ecButton('certificatePdf','pdf')+ecButton('certificateCsv','csv'):'')+'</section>');enforceAccessUI();
 }catch(error){if(CO.id===id&&R===route)main(pageHead(ecT('title'))+notice(error.message||ecT('error')))}
};
ACT.certificateConfigure=()=>{
 if(!EC_VIEW)return;
 modal(ecT('configure'),bCheck('enabled',ecT('enable'),EC_VIEW.enabled)+`<label>${ecE('workText')}<textarea name="workText" required maxlength="3000" rows="5">${esc(EC_VIEW.workText)}</textarea></label><label>${ecE('incomeText')}<textarea name="incomeText" required maxlength="3000" rows="5">${esc(EC_VIEW.incomeText)}</textarea></label>`+notice(ecT('plainText'))+field('reason',ecT('reason'),'','text','required minlength="3" maxlength="500"')+bCheck('confirmed',ecT('confirm')),async f=>{
  await operate('certificateConfigure',{date:today(),enabled:f.elements.enabled.checked,workText:v(f,'workText'),incomeText:v(f,'incomeText'),reason:v(f,'reason'),confirmed:f.elements.confirmed.checked});view();
 },ecT('save'));
};
const ecDownload=(name,blob)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)};
function ecExport(format){
 if(!EC_VIEW?.enabled)return;
 modal(ecT('title'),selectField('employeeId',ecT('employee'),EC_VIEW.employees.map(e=>option(e.id,e.name)).join(''))+selectField('kind',ecT('kind'),option('work',ecT('work'))+option('income',ecT('income')))+field('from',ecT('from'),today().slice(0,8)+'01','date','required')+field('to',ecT('to'),today(),'date','required')+notice(ecT('basis')),async f=>{
  const id=CO.id,report=await api('operations?c='+encodeURIComponent(id),'POST',{operation:'certificateReport',format,employeeId:v(f,'employeeId'),kind:v(f,'kind'),from:v(f,'from'),to:v(f,'to')});if(CO.id!==id)return;
  const pairs=[['company',report.company],['branch',report.branchId],['period',report.from+' / '+report.to],['generated',report.generatedAt],['author',report.generatedBy],['version',report.version],['templateVersion',report.templateVersion],['kind',ecT(report.kind)],['employee',report.employee.name],['position',report.employee.position],['start',report.employee.start],['text',report.text],...(report.incomeCents===null?[]:[['gross',report.incomeCents],['currency',report.currency]]),['notice',report.notice]];
  const rows=pairs.map(([k,value])=>[ecT(k),String(value)]),name='constancia-'+report.kind+'-'+today();
  if(format==='CSV'){const cell=x=>'"'+String(x).replaceAll('"','""').replace(/^\s*[=+@-]/,"'$&")+'"';ecDownload(name+'.csv',new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));return}
  await loadExportScript('/vendor/jspdf.js?v=0f6fe797a6df06bd');await loadExportScript('/vendor/autotable.js?v=31884888608c7aab');
  const pdf=new jspdf.jsPDF();pdf.setFontSize(14);pdf.text(ecT(report.kind),14,16);pdf.autoTable({startY:24,body:rows,styles:{fontSize:10,overflow:'linebreak'},columnStyles:{0:{cellWidth:45}}});pdf.save(name+'.pdf');
 },ecT('download'));
}
ACT.certificatePdf=()=>ecExport('PDF');ACT.certificateCsv=()=>ecExport('CSV');
