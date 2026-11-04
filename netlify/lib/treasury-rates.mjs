import {treasuryRateRows,recurringDay,bankRateMicros} from './accounting-engine.mjs';
import {bankBaseCurrency} from './banks.mjs';
export const BCN_RATE_ENDPOINT='https://servicios.bcn.gob.ni/Tc_Servicio/ServicioTC.asmx';
// Consulta manual SOAP al servicio público del BCN. Nunca se ejecuta desde cron.
export async function officialRatesPreview(data,body,request=fetch){
 const unavailable=reason=>({available:false,reason,grid:[]});
 if(body.module!=='tipos_cambio'||data.cfg?.treasuryControls?.tipos_cambio?.enabled!==true||data.cfg?.treasuryControls?.tipos_cambio?.sourceEnabled!==true)return unavailable('Fuente desactivada.');
 if(globalThis.Netlify?.env?.get('BCN_RATES_ENABLED')!=='true')return unavailable('Fuente oficial sin configurar.');
 try{
  const day=recurringDay(body.date);if(day>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Managua',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))return unavailable('Selecciona una fecha transcurrida.');const [year,month,date]=day.split('-').map(Number);
  const response=await request(BCN_RATE_ENDPOINT,{method:'POST',signal:AbortSignal.timeout(8000),redirect:'error',headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:'"http://servicios.bcn.gob.ni/RecuperaTC_Dia"'},body:`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><RecuperaTC_Dia xmlns="http://servicios.bcn.gob.ni/"><Ano>${year}</Ano><Mes>${month}</Mes><Dia>${date}</Dia></RecuperaTC_Dia></soap:Body></soap:Envelope>`});
  if(!response.ok)return unavailable('Fuente temporalmente no disponible.');
  const reader=response.body.getReader();let size=0,parts=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>200000){await reader.cancel();return unavailable('Respuesta demasiado grande.');}parts.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}const xml=new TextDecoder().decode(bytes);
  if(/<!DOCTYPE|<!ENTITY|Fault/i.test(xml))return unavailable('Respuesta oficial no reconocida.');
  const matched=/<(?:\w+:)?RecuperaTC_DiaResult(?:\s[^>]*)?>\s*([0-9]+(?:\.[0-9]{1,6})?)\s*<\/(?:\w+:)?RecuperaTC_DiaResult>/.exec(xml);if(!matched)return unavailable('Formato oficial no reconocido.');
  const base=bankBaseCurrency(data),micros=bankRateMicros(matched[1]),converted=base==='NIO'?micros:Number((1000000000000n+BigInt(micros)/2n)/BigInt(micros));
  const rate=(converted/1000000).toFixed(6),grid=[[day,base==='NIO'?'USD':'NIO',rate,'Banco Central de Nicaragua · RecuperaTC_Dia']];
  const rates=treasuryRateRows(grid,data.exchangeRates||[],base);return {available:true,grid,rates,source:'Banco Central de Nicaragua',sourceUrl:BCN_RATE_ENDPOINT,rateDate:day,fetchedAt:new Date().toISOString()};
 }catch{return unavailable('No se pudo consultar o validar la fuente. Puedes importar el archivo manualmente.');}
}
