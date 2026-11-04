import '../../public/fiscal-calculations.js';
export function fiscalAnnualTotals(data){const years={};for(const year of new Set((data.entries||[]).map(e=>e.date.slice(0,4)))){const r=globalThis.AcontecFiscalMath.annual(data,year);years[year]={incomeCents:Math.round(r.income*100),costCents:Math.round(r.cost*100),expenseCents:Math.round(r.expense*100)}}return years}
