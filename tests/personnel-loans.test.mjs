import test from 'node:test';
import assert from 'node:assert/strict';
import {loanInstallments,guardPersonnel} from '../netlify/lib/personnel.mjs';
test('cuotas exactas con residuo; un pago histórico permanece inmutable',()=>{
 assert.deepEqual(loanInstallments(100,3).map(x=>x.amountCents),[34,33,33]);
 assert.throws(()=>loanInstallments(1,2));
 const old={payrolls:[{id:'p',entryId:'entry',net:10}]};
 assert.throws(()=>guardPersonnel(old,{payrolls:[{...old.payrolls[0],net:9}]},'Operación: personnelPay'));
});
