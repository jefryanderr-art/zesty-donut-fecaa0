import {moneyCents,accountingEntries} from './accounting-engine.mjs';
import {documentHash} from './accounting-codec.mjs';
import {fiscalCheck as check,checklistComplete} from './fiscal-rules.mjs';
import {financialReports,periodRange} from './period-package.mjs';
export function annualPreview(data,year){
 const {from,to,months}=periodRange(year);check(year.length===4,'Selecciona un año.');
 const records=data.fiscalWorkflows||[],previous=records.find(r=>r.kind==='closure'&&r.period===year);
 const pending=[],fin=financialReports(data,from,to);
 if(to>=new Date().toISOString().slice(0,10))pending.push('El ejercicio debe haber terminado.');
 if(previous)pending.push('El ejercicio ya tiene un cierre automático registrado; no se ejecuta dos veces.');
 if((data.entries||[]).some(e=>e.type==='cierre'&&e.year===year))pending.push('Existe un cierre anterior: revisar con el contador; no se duplica.');
 const years=[...new Set(data.entries.filter(e=>!['apertura-anual','anula-apertura-anual'].includes(e.type)&&e.date<from).map(e=>e.date.slice(0,4)))];
 for(const y of years)if(!records.some(r=>r.kind==='closure'&&r.period===y&&r.state==='cerrado')&&!data.entries.some(e=>e.type==='cierre'&&e.year===y))pending.push(`El año ${y} tiene movimientos y no está cerrado.`);
 const list=(data.businessRecords||[]).find(r=>r.module==='cierre_periodo'&&r.kind==='period'&&r.periodType==='anual'&&r.period===year);
 if(!list||!checklistComplete(list))pending.push('Completar el checklist F4.7 anual: conciliaciones, depreciación, provisiones, IVA, retenciones y nómina.');
 for(const r of data.businessRecords||[])if(r.module==='bancos'&&r.kind==='statement'&&r.date>=from&&r.date<=to&&r.status!=='Cerrada')pending.push(`Conciliación bancaria pendiente: ${r.name||r.id}.`);
 for(const p of data.payrolls||[])if((p.date||p.to)>=from&&(p.date||p.to)<=to&&!p.entryId)pending.push(`Planilla sin asiento: ${p.id}.`);
 for(const tax of data.taxes||[])if(tax.period?.startsWith(year)&&tax.recognized===false)pending.push(`Obligación fiscal sin reconocer: ${tax.name||tax.id}.`);
 pending.push(...fin.warnings);
 const resultAccount=data.accounts.find(a=>a.code==='3198'),retained=data.accounts.find(a=>a.code==='3102');
 if(resultAccount&&resultAccount.tipo!=='patrimonio')pending.push('La cuenta 3198 existe y no es de patrimonio; resolver antes de cerrar.');
 if(!retained||retained.tipo!=='patrimonio')pending.push('Configurar 3102 como utilidades acumuladas.');
 const selected=accountingEntries(data.entries,to),net=new Map();for(const e of selected)for(const l of e.lines)net.set(l.a,(net.get(l.a)||0)+moneyCents(l.d)-moneyCents(l.c));
 const closing=[];let result=0;for(const a of data.accounts.filter(a=>['ingreso','costo','gasto'].includes(a.tipo))){const n=net.get(a.code)||0;if(n){closing.push({a:a.code,d:n<0?-n/100:0,c:n>0?n/100:0});result+=n;}}
 if(result)closing.push({a:'3198',d:result>0?result/100:0,c:result<0?-result/100:0});
 const profit=-result,transfer=profit?[{a:'3198',d:profit>0?profit/100:0,c:profit<0?-profit/100:0},{a:'3102',d:profit<0?-profit/100:0,c:profit>0?profit/100:0}]:[];
 for(const l of [...closing,...transfer])net.set(l.a,(net.get(l.a)||0)+moneyCents(l.d)-moneyCents(l.c));
 const opening=[];for(const a of data.accounts.filter(a=>['activo','pasivo','patrimonio'].includes(a.tipo))){const n=net.get(a.code)||0;if(n)opening.push({a:a.code,d:n>0?n/100:0,c:n<0?-n/100:0});}
 const diff=opening.reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0);if(diff)pending.push(`La apertura no cuadra: ${diff} centavos.`);
 for(const a of data.accounts.filter(a=>['activo','pasivo','patrimonio'].includes(a.tipo))){const n=opening.filter(l=>l.a===a.code).reduce((s,l)=>s+moneyCents(l.d)-moneyCents(l.c),0);if(n!==(net.get(a.code)||0))pending.push(`Apertura distinta al cierre en ${a.code}.`);}
 const openingDate=(+year+1)+'-01-01',nextMovements=data.entries.filter(e=>e.date>=openingDate).length;
 const content={year,from,to,months,pending:[...new Set(pending)],closing,transfer,opening,openingDate,nextMovements,profitCents:profit,notice:nextMovements?'Hay movimientos en el año siguiente. Se conservan; la apertura sustituye únicamente la acumulación de saldos anteriores.':'Los reportes posteriores parten de la apertura contabilizada.',reopenProcedure:'Solo el dueño puede reabrir con motivo. Se agregan contrasientos que revierten cierre, traspaso y apertura; no se borra ni modifica el historial. El mismo cierre automático no se vuelve a ejecutar; los ajustes posteriores requieren revisión del contador.'};
 return {...content,hash:documentHash(content)};
}
