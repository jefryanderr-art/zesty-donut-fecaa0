import {moneyCents,invoiceLinkedEntries} from './accounting-math.mjs?v=85cbc732b6b20e19';
export {commerceInstallmentBalances as servicePaymentBalances} from './commerce-math.mjs?v=c4ffc07778e4e912';
// Campos operativos opcionales; nunca expedientes clínicos ni reglas fiscales implícitas.
export const SERVICE_PROFILES=['profesionales','software','freelance','inmobiliaria','seguros','recurrentes','belleza','salud','educacion','gimnasio','taller','lavanderia','transporte'];
export const SERVICE_MODULES=['agenda','proyectos','contratos','cuentas_abiertas','documentos_venta','reservas','medidas','despacho'];
const f=(key,label,type='text')=>({key,label,type});
export const commonFields=[f('preferences','Preferencias de atención (sin datos sensibles)'),f('nextDate','Próxima cita / control / renovación','date'),f('noticeDays','Avisar con días de anticipación','integer'),f('renewalDate','Vencimiento de contrato / licencia / póliza','date'),f('surveyEnabled','Habilitar encuesta opcional','boolean')];
const professional=[f('portfolio','Propiedad / póliza / licencia y referencia del cliente'),f('deliverables','Entregables acordados'),f('lead','Prospecto / contacto de seguimiento'),f('followupDate','Próximo seguimiento','date'),f('brokerage','Condiciones de intermediación (honorarios en líneas de servicio)')];
export const sectorFields={profesionales:professional,software:professional,freelance:professional,inmobiliaria:professional,seguros:professional,recurrentes:professional,
 belleza:[f('professional','Profesional'),f('waiting','En lista de espera','boolean'),f('suggestedDays','Sugerir próxima cita en días','integer')],
 salud:[f('patient','Paciente o mascota (identificación administrativa)'),f('guardian','Dueño / responsable'),f('doctor','Doctor'),f('agreement','Convenio con aseguradora / empresa'),f('sessions','Sesiones previstas','integer'),f('control','Control / vacuna: solo recordatorio administrativo')],
 educacion:[f('student','Alumno'),f('guardianId','Responsable de pago (cliente de cartera)','customer'),f('guardian','Referencia del responsable'),f('group','Grupo'),f('schedule','Horario'),f('scholarship','Beca autorizada: condiciones'),f('siblings','Hermanos: referencias y condición del descuento')],
 gimnasio:[f('member','Socio'),f('expires','Vencimiento de membresía','date'),f('paused','Membresía pausada','boolean'),f('pauseUntil','Pausa hasta','date'),f('capacity','Cupo de clase','integer'),f('visitLimit','Límite de visitas (0: sin límite)','integer')],
 taller:[f('plate','Placa / serie del equipo'),f('model','Modelo'),f('mileage','Kilometraje','integer'),f('reception','Checklist de recepción y accesorios'),f('approvalReference','Referencia de aprobación del presupuesto por el cliente'),f('approvedDate','Fecha de aprobación','date'),f('mechanic','Mecánico'),f('warrantyUntil','Garantía hasta','date'),f('maintenanceDate','Próximo mantenimiento','date')],
 lavanderia:[f('tag','Etiqueta / número de orden'),f('chargeUnit','Cobro por peso / prenda'),f('pieces','Detalle de prendas / peso recibido'),f('homeDelivery','Entrega a domicilio','boolean'),f('address','Dirección de entrega'),f('promisedDate','Entrega prometida','date')],
 transporte:[f('origin','Origen'),f('destination','Destino'),f('unit','Unidad'),f('driver','Conductor'),f('maintenanceDate','Mantenimiento programado','date'),f('vehicleDocumentDue','Documento del vehículo vence','date'),f('driverDocumentDue','Documento del conductor vence','date')]
};
export const serviceFields=profile=>[...commonFields,...(sectorFields[profile]||[])];
export function serviceAlerts(r,day){
 const s=r.service||{},days=s.noticeDays||0,edge=new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
 return ['nextDate','renewalDate','followupDate','expires','maintenanceDate','vehicleDocumentDue','driverDocumentDue','promisedDate'].filter(k=>s[k]&&s[k]<=edge).map(k=>({key:k,date:s[k]}));
}

export function serviceInvoiceBalance(entries,id){return invoiceLinkedEntries(entries,id).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0);}
export function serviceTripRows(records,entries,costs){return records.map(r=>{
 const ids=new Set([r.entryId,...(r.billed||[]).map(b=>b.entryId)].filter(Boolean));
 const salesCents=entries.filter(e=>e.type==='venta'&&ids.has(e.id)||e.type==='nota-credito'&&ids.has(e.invoiceId)).reduce((n,e)=>n+moneyCents(e.subtotal||0)*(e.type==='nota-credito'?-1:1),0);
 const costCents=costs.filter(c=>c.businessId===r.id&&!c.reversalId).reduce((n,c)=>n+moneyCents(c.base||0),0);
 return {id:r.id,name:r.name,unit:r.service?.unit||r.vehicle||'Sin unidad',salesCents,costCents,profitCents:salesCents-costCents};
});}
