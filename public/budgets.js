'use strict';
// Presupuesto vs real (Fase 6, ítem 1). Nace apagado; el dueño lo activa con motivo. Informe interno: verifica con tu contador.
const BG_OPS={budEnable:null,budCreate:'presupuestos',budRevise:'presupuestos',budArchive:'presupuestos'};
const BG_TEXT={title:'Presupuesto vs real',help:'Compara lo presupuestado con lo real por cuenta, centro de costo, proyecto o sucursal. Es informativo: no genera asientos. Verifica con tu contador.',loading:'Consultando presupuestos autorizados…',error:'No se completó la gestión.',enable:'Activar o desactivar',enabled:'Habilitar para operaciones futuras',thresholdPct:'Umbral de alerta (%)',date:'Fecha efectiva',reason:'Motivo',confirmed:'Confirmo esta operación',save:'Guardar',create:'Nuevo presupuesto',revise:'Nueva versión',archive:'Archivar',name:'Nombre',year:'Año',dimension:'Dimensión',cuenta:'Cuenta',centro:'Centro de costo',proyecto:'Proyecto',sucursal:'Sucursal',linesHelp:'Líneas (clave=importe en centavos, separadas por coma)',lines:'Líneas',id:'Presupuesto',version:'Versión',budget:'Presupuestado (centavos)',actual:'Real (centavos)',diff:'Diferencia (centavos)',pct:'Desviación %',alert:'Alerta',yes:'Sí',no:'No',exportPdf:'Descargar PDF',exportCsv:'Descargar CSV',field:'Campo',value:'Valor',notice:'Informe interno de apoyo; no es asesoría fiscal. Verifica con tu contador.',actualHelp:'El real suma los asientos del año: en cuentas, el saldo natural; en centro, proyecto y sucursal, solo gastos y costos.'};
const bgT=k=>uiT('budgets.'+k,BG_TEXT[k]||k),bgE=k=>esc(bgT(k)),bgToday=()=>tsToday();
const bgField=(name,value='',type='text',attrs='')=>field(name,bgT(name),value,type,attrs);
const bgModal=(title,body,ok)=>modal(esc(title),body,ok,esc(bgT('save')));
const bgConfirm=()=>bgField('date',bgToday(),'date','required')+bgField('reason','','text','required minlength="3" maxlength="500"')+bCheck('confirmed',bgT('confirmed'))+notice(bgT('help'));
const bgCommon=f=>({date:v(f,'date'),reason:v(f,'reason'),confirmed:f.elements.confirmed.checked});
const bgAction=(action,label,id='')=>`<button type="button" class="btn ghost" data-a="${action}" data-id="${esc(id)}">${bgE(label)}</button>`;
let BG_REPORT=null;
const bgFetch=(format='VIEW')=>api('operations?c='+encodeURIComponent(CO.id),'POST',{operation:'budgetReport',date:bgToday(),from:bgToday().slice(0,4)+'-01-01',to:bgToday(),format});
const bgLines=text=>text.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.lastIndexOf('=');return {key:s.slice(0,i).trim(),amountCents:Number(s.slice(i+1))}});
const bgBase=actionAllowed;
actionAllowed=function(action,data={}){if(action in BG_OPS)return permission('presupuestos',true);if(['budExport'].includes(action))return permission('presupuestos',false);return bgBase(action,data)};
READ_ACTIONS.add('budExport');
V.presupuestos=async()=>{
 const companyId=CO.id,route=R;main(pageHead(bgT('title'))+notice(bgT('loading')));
 try{
  const report=await bgFetch();if(CO.id!==companyId||R!==route)return;BG_REPORT=report;
  const write=permission('presupuestos',true);let controls=CO.owner&&write?bgAction('budEnable','enable'):'';
  if(report.enabled&&write)controls+=bgAction('budCreate','create')+bgAction('budRevise','revise')+bgAction('budArchive','archive');
  const sections=report.enabled?report.budgets.map(b=>'<section class="card"><h3>'+esc(b.name)+' · '+bgE(b.dimension)+' · '+esc(b.year)+' · v'+esc(b.version)+'</h3>'+table([bgT('name'),bgT('budget'),bgT('actual'),bgT('diff'),bgT('pct'),bgT('alert')],b.lines.map(l=>'<tr><td>'+esc(l.key)+'</td><td>'+esc(l.budgetCents)+'</td><td>'+esc(l.actualCents)+'</td><td>'+esc(l.diffCents)+'</td><td>'+esc(l.pct==null?'—':l.pct.toFixed(1))+'</td><td>'+bgE(l.alert?'yes':'no')+'</td></tr>').join(''))+'</section>').join('')+notice(bgT('actualHelp')):'';
  main(pageHead(bgT('title'))+notice(bgT('help'))+`<section class="card">${controls}${bgAction('budExport','exportPdf','PDF')}${bgAction('budExport','exportCsv','CSV')}</section>${sections}`);enforceAccessUI();
 }catch(error){main(pageHead(bgT('title'))+notice(error.message||bgT('error')))}
};
const bgBudgets=()=>(BG_REPORT?.records||[]).filter(r=>r.kind==='budget'&&r.status==='Activa').map(r=>[r.id,r.name+' · '+r.year]);
const bgOp=(op,extra=()=>({}))=>async f=>{await operate(op,{...bgCommon(f),...extra(f)});view()};
ACT.budEnable=()=>bgModal(bgT('enable'),bCheck('enabled',bgT('enabled'))+bgField('thresholdPct',10,'number','min="0" max="1000" step="any"')+bgConfirm(),async f=>{await operate('budEnable',{...bgCommon(f),enabled:f.elements.enabled.checked,thresholdPct:Number(v(f,'thresholdPct'))});view()});
ACT.budCreate=()=>bgModal(bgT('create'),bgField('name','','text','required maxlength="120"')+bgField('year',bgToday().slice(0,4),'number','required min="2000" max="2100"')+selectField('dimension',bgT('dimension'),['cuenta','centro','proyecto','sucursal'].map(d=>option(d,bgT(d),false)).join(''))+bgField('lines','','text','required')+notice(bgT('linesHelp'))+bgConfirm(),bgOp('budCreate',f=>({name:v(f,'name'),year:Number(v(f,'year')),dimension:v(f,'dimension'),lines:bgLines(v(f,'lines'))})));
ACT.budRevise=()=>bgModal(bgT('revise'),selectField('id',bgT('id'),bgBudgets().map(([i,l])=>option(i,l,false)).join(''))+bgField('lines','','text','required')+notice(bgT('linesHelp'))+bgConfirm(),bgOp('budRevise',f=>({id:v(f,'id'),lines:bgLines(v(f,'lines'))})));
ACT.budArchive=()=>bgModal(bgT('archive'),selectField('id',bgT('id'),bgBudgets().map(([i,l])=>option(i,l,false)).join(''))+bgConfirm(),bgOp('budArchive',f=>({id:v(f,'id')})));
const bgDownload=(name,blob)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)};
ACT.budExport=async d=>{
 const format=d.id==='PDF'?'PDF':'CSV',report=await bgFetch(format);
 const meta=[['company',report.company],['period',report.from+' / '+report.to],['generatedAt',report.generatedAt],['generatedBy',report.generatedBy],['version',report.version],['branchId',report.branchId]];
 const body=report.budgets.flatMap(b=>b.lines.map(l=>[b.name,b.dimension,b.year,'v'+b.version,l.key,l.budgetCents,l.actualCents,l.diffCents,l.pct==null?'':l.pct.toFixed(1),l.alert?bgT('yes'):bgT('no')]));
 const head=[bgT('title'),bgT('dimension'),bgT('year'),bgT('version'),bgT('name'),bgT('budget'),bgT('actual'),bgT('diff'),bgT('pct'),bgT('alert')],name='presupuestos-'+bgToday();
 if(format==='CSV'){const encode=x=>'"'+String(x).replaceAll('"','""').replace(/^\s*[=+@-]/,"'$&")+'"';bgDownload(name+'.csv',new Blob(['﻿'+[...meta,[bgT('notice')],head,...body].map(r=>r.map(encode).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));return}
 await loadExportScript('/vendor/jspdf.js?v=0f6fe797a6df06bd');await loadExportScript('/vendor/autotable.js?v=31884888608c7aab');
 const pdf=new jspdf.jsPDF({orientation:'landscape'});pdf.text(bgT('title'),14,14);pdf.setFontSize(8);pdf.text(meta.map(([k,x])=>k+': '+x).join('  ·  '),14,20);pdf.text(bgT('notice'),14,25);
 pdf.autoTable({startY:30,head:[head],body:body.map(r=>r.map(String)),styles:{fontSize:7}});pdf.save(name+'.pdf');
};
