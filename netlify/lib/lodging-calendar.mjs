import {createHash,timingSafeEqual} from 'node:crypto';
// An explicitly shared calendar exposes busy dates only; never guest or financial data.
export function sharedCalendar(company,unitId,key){
 if(!company||company.archivedAt||!/^[a-f0-9]{64}$/.test(key||''))return null;
 const rows=company.data?.businessRecords||[],unit=rows.find(r=>r.kind==='lodging-unit'&&r.id===unitId&&r.active!==false),share=unit?.calendarShare;
 if(!share||Date.parse(share.expires)<=Date.now()||!/^[a-f0-9]{64}$/.test(share.hash))return null;
 if(!timingSafeEqual(Buffer.from(share.hash,'hex'),createHash('sha256').update(key).digest()))return null;
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const events=rows.filter(r=>['reservas','contratos'].includes(r.module)&&r.unitId===unit.id&&r.branchId===unit.branchId&&r.start&&r.end&&r.status!=='Cancelada').map(r=>['BEGIN:VEVENT','UID:'+r.id+'@acontec.company','DTSTAMP:'+stamp,...(r.module==='contratos'?['DTSTART;VALUE=DATE:'+r.start.slice(0,10).replaceAll('-',''),'DTEND;VALUE=DATE:'+r.end.slice(0,10).replaceAll('-','')]:['DTSTART:'+new Date(r.start).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTEND:'+new Date(r.end).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')]),'SUMMARY:No disponible','END:VEVENT'].join('\r\n'));
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Acontec//Disponibilidad//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH',...events,'END:VCALENDAR',''].join('\r\n');
}
