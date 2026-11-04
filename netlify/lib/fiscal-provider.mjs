// Interfaz de proveedor fiscal. Solo existe «manual DGI»: no hace llamadas externas ni afirma certificación.
// Un proveedor externo exigiría credenciales en variables de Netlify y una fase aparte; hoy cualquier otro id se rechaza.
export const FISCAL_STATES=['borrador','emitido','aceptado','rechazado','anulado'];
export const FISCAL_TRANSITIONS={borrador:['emitido','anulado'],emitido:['aceptado','rechazado','anulado'],rechazado:['borrador','anulado'],aceptado:['anulado'],anulado:[]};
export const NON_FISCAL_MARK='DOCUMENTO NO FISCAL';
const fail=message=>{throw Object.assign(new Error(message),{publicMessage:message,status:400})};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export const manualDgiProvider={
 id:'manual_dgi',label:'Manual DGI (número y fecha escritos a mano)',external:false,
 // Prepara el documento: sin número y fecha escritos a mano queda marcado como no fiscal.
 prepare(input){
  const number=String(input.number??'').trim().slice(0,40),fiscalDate=String(input.fiscalDate??'').trim();
  if(fiscalDate&&!(DAY.test(fiscalDate)&&Number.isFinite(Date.parse(fiscalDate))))fail('Fecha fiscal inválida.');
  const complete=Boolean(number&&fiscalDate);
  return {number,fiscalDate,nonFiscal:!complete,marker:complete?'':NON_FISCAL_MARK};
 },
 // «Firmar/enviar» es una confirmación local: no transmite nada a la DGI.
 submit(record){
  if(record.nonFiscal)fail('Escribe número y fecha fiscal antes de emitir; sin ellos queda como '+NON_FISCAL_MARK+'.');
  return {state:'emitido',external:false};
 },
 status(record){return {state:record.fiscalState,external:false,note:'Estado registrado manualmente; no se consultó a la DGI.'}},
 cancel(record,reason){
  if(String(reason||'').trim().length<3)fail('Escribe el motivo de la anulación.');
  return {state:'anulado',external:false,note:'Anular el estado fiscal no revierte la contabilidad; corrige con nota de crédito.'};
 }
};
export const FISCAL_PROVIDERS={manual_dgi:manualDgiProvider};
export function fiscalProvider(id='manual_dgi'){
 const provider=Object.hasOwn(FISCAL_PROVIDERS,id)?FISCAL_PROVIDERS[id]:null;
 if(!provider)fail('Proveedor fiscal no disponible; solo existe el manual DGI.');
 return provider;
}
export function fiscalTransition(from,to){
 if(!FISCAL_TRANSITIONS[from]?.includes(to))fail('Transición fiscal no permitida: '+from+' → '+to+'.');
 return to;
}
