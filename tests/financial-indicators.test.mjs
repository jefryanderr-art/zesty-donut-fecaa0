import test from 'node:test';
import assert from 'node:assert/strict';
import {financialSnapshot,analysisOperation,analysisReport,DEFAULT_MAPPING} from '../netlify/lib/analysis.mjs';
test('indicadores: cero no produce infinitos; solo dueño activa y se exige confirmación',async()=>{
 const d={businessRecords:[],entries:[]};const a={owner:false,branchId:'principal'};
 await assert.rejects(()=>analysisOperation(d,a,{email:'x'},{operation:'analysisEnable',module:'indicadores_financieros',enabled:true,reason:'Prueba',confirmed:true},{permit(){}}),/dueño/);
 assert.equal(analysisReport(d,a,{module:'indicadores_financieros'},()=>true).enabled,false);
 const x=financialSnapshot(d,'2026-01-01','2026-01-31',DEFAULT_MAPPING);assert.equal(x.values.dso,null);assert.equal(x.values.ebitda,null);
 assert.deepEqual(d.businessRecords,[]);
});
