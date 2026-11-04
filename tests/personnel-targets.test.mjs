import test from 'node:test';
import assert from 'node:assert/strict';
import {tierCommission} from '../netlify/lib/personnel.mjs';
test('comisión marginal por tramos sin aplicar la tasa superior a toda la base',()=>{
 assert.equal(tierCommission(15000,[{thresholdCents:0,rateBp:100},{thresholdCents:10000,rateBp:200}]),200);
 assert.throws(()=>tierCommission(15000,[{thresholdCents:100,rateBp:100}]));
});
