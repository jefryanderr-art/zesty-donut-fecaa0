import test from 'node:test';
import assert from 'node:assert/strict';
import {abcReport,validateAnalysisRecord} from '../netlify/lib/analysis.mjs';
test('ABC asigna exactamente los centavos y no modifica asientos',()=>{
 const data={entries:[]},before=structuredClone(data),pools=[{name:'Atención',dimension:'cliente',amountCents:101,drivers:[{key:'a',units:1},{key:'b',units:2}]}];
 assert.equal(abcReport(data,pools).reduce((s,r)=>s+r.amountCents,0),101);assert.deepEqual(data,before);
 assert.throws(()=>validateAnalysisRecord({kind:'configuration',version:1,events:[],pools:[{...pools[0],amountCents:0.1}]}),/centavos/);
});
