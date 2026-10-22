import {createVerify,X509Certificate} from 'node:crypto';
import {providerConfig,billingError} from './billing-rules.mjs';
export async function pagadito(path,body,environment){
 const config=providerConfig();if(!config.ready)billingError('Configura las credenciales de Pagadito en Netlify antes de pagar.',503);
 if(environment&&environment!==config.environment)billingError('Este cobro pertenece a otro entorno. Restaura su configuración para gestionarlo.',409);
 // Solo las consultas son repetibles sin crear autorizaciones duplicadas.
 const attempts=path==='get-status-recurring-payments'?2:1;
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const response=await fetch(config.base+'/api/v2/'+path,{method:'POST',headers:{'content-type':'application/json',Accept:'application/json',Authorization:'Basic '+Buffer.from(`${process.env.PAGADITO_UID.trim()}:${process.env.PAGADITO_WSK.trim()}`).toString('base64')},body:JSON.stringify(body),signal:AbortSignal.timeout(5000),redirect:'error'});
   let result;try{result=await response.json()}catch(error){if(['TimeoutError','AbortError'].includes(error.name))throw error}
   // Nunca registrar cuerpos, URL de pago, credenciales ni tokens.
   console.info('pagadito_response',{operation:path,httpStatus:response.status,code:/^PG[0-9]{4}$/.test(result?.code)?result.code:null,attempt});
   if(!response.ok)billingError('Pagadito no respondió. Intenta nuevamente.',502);
   if(!result)billingError('Respuesta no válida del proveedor de pagos.',502);
   return result;
  }catch(error){
   const timeout=['TimeoutError','AbortError'].includes(error.name);
   if(timeout)console.warn('pagadito_timeout',{operation:path,attempt});
   if(timeout&&attempt<attempts)continue;
   if(error.publicMessage)throw error;
   billingError('No se pudo consultar Pagadito. El plan no se activó sin confirmación.',502);
  }
 }
}
export function safePaymentUrl(value){const config=providerConfig();let url;try{url=new URL(value)}catch{billingError('Enlace de pago inválido.',502)}if(url.protocol!=='https:'||url.hostname!==new URL(config.base).hostname||url.username||url.password||url.port)billingError('Enlace de pago no autorizado.',502);return url.href}
export function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1}return (c^0xffffffff)>>>0}
export async function verifyWebhook(headers,raw){
 try{
  const id=headers.get('pagadito-notification-id'),ts=headers.get('pagadito-notification-timestamp'),algo=headers.get('pagadito-auth-algo'),signature=headers.get('pagadito-signature'),cert=headers.get('pagadito-cert-url');
  if(!id||!ts||!signature||!cert||!['SHA256withRSA','RSA-SHA256','sha256WithRSAEncryption'].includes(algo))return false;
  const url=new URL(cert),config=providerConfig();if(!config.ready||url.protocol!=='https:'||url.username||url.password||url.port||!['connect.pagadito.com','sandbox-connect.pagadito.com','www.pagadito.com','pagadito.com'].includes(url.hostname))return false;
  const body=JSON.parse(raw.toString('utf8'));
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok||Number(response.headers.get('content-length')||0)>32768)return false;
  const pem=await response.text();if(pem.length>32768)return false;
  const verifier=createVerify('RSA-SHA256');verifier.update(`${id}|${ts}|${body.id}|${crc32(raw)}|${process.env.PAGADITO_WSK.trim()}`);
  return verifier.verify(new X509Certificate(pem).publicKey,Buffer.from(signature,'base64'));
 }catch{return false}
}
