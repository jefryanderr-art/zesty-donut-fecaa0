export function statement(data,from,to){
 data=data||{};
 const accounts=new Map((data.accounts||[]).map(a=>[a.code,{...a,debit:0,credit:0,periodDebit:0,periodCredit:0}]));
 for(const e of data.entries||[]){if(e.date>to)continue;for(const l of e.lines||[]){const a=accounts.get(l.a);if(!a)continue;a.debit+=l.d;a.credit+=l.c;if(e.date>=from&&e.type!=='cierre'){a.periodDebit+=l.d;a.periodCredit+=l.c}}}
 const rows=[...accounts.values()].map(a=>({...a,balance:Math.round((a.nat==='D'?a.debit-a.credit:a.credit-a.debit)*100)/100,periodBalance:Math.round((a.nat==='D'?a.periodDebit-a.periodCredit:a.periodCredit-a.periodDebit)*100)/100}));
 const NAT={activo:'D',gasto:'D',costo:'D',pasivo:'C',patrimonio:'C',ingreso:'C'},sum=(type,period=false)=>Math.round(rows.filter(a=>a.tipo===type).reduce((s,a)=>s+(period?a.periodBalance:a.balance)*(a.nat===NAT[type]?1:-1),0)*100)/100;
 const revenue=sum('ingreso',true),cost=sum('costo',true),expense=sum('gasto',true);return {rows,assets:sum('activo'),liabilities:sum('pasivo'),equity:sum('patrimonio'),revenue,cost,expense,profit:Math.round((revenue-cost-expense)*100)/100,inventory:rows.find(a=>a.code==='1301')?.balance||0};
}
