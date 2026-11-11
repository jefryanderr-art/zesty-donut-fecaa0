import {accountingEntries} from './accounting-engine.mjs';
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
const cashAccounts=data=>data.accounts.filter(a=>['1101','1102','1104'].includes(a.code)||a.code.startsWith('1103-')).map(a=>a.code);
const requireValue=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{publicMessage:message,status:400})};
export function guardCash(previous, next, {strict=false}={}) {
  if(next?.cfg?.allowNegativeValues===true)return;
  for (const code of cashAccounts(next)) {
    const minimum = data => {
      let balance = 0, lowest = 0;
      const days = new Map();
      for (const entry of accountingEntries(data?.entries)) days.set(entry.date, (days.get(entry.date) || 0) + (entry.lines || []).filter(line => line.a === code).reduce((total, line) => total + line.d - line.c, 0));
      for (const [, net] of [...days].sort(([first], [second]) => first.localeCompare(second))) {
        balance = round(balance + net);
        lowest = Math.min(lowest, balance);
      }
      return lowest;
    };
    requireValue(minimum(next) >= (strict ? 0 : Math.min(0, minimum(previous)) - 0.01), 'El movimiento deja caja o banco en negativo en alguna fecha. Revisa el fondo y la fecha.');
  }
}
