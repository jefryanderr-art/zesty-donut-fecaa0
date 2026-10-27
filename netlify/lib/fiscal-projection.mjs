import { moneyCents } from './accounting-engine.mjs';
// Totales fiscales anuales: no incluyen nombres, nóminas ni asientos ocultos.
export function fiscalAnnualTotals(data){
 const accounts=new Map((data.accounts||[]).map(a=>[a.code,a])),years={};
 for(const entry of data.entries||[]){
  const year=entry.date.slice(0,4),row=years[year]||={incomeCents:0,costCents:0,expenseCents:0};
  for(const line of entry.lines||[]){
   const account=accounts.get(line.a);if(!account)continue;
   const debit=moneyCents(line.d||0),credit=moneyCents(line.c||0);
   if(account.tipo==='ingreso')row.incomeCents+=credit-debit;
   if(account.tipo==='costo')row.costCents+=debit-credit;
   if(account.tipo==='gasto'&&line.a!=='6108')row.expenseCents+=debit-credit;
  }
 }
 return years;
}
