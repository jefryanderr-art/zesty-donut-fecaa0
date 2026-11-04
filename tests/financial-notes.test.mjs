import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisOperation,analysisReport} from '../netlify/lib/analysis.mjs';
test('notas: versión editable sin asientos y permiso contable obligatorio',async()=>{
 const d={entries:[],businessRecords:[]},a={owner:true,branchId:'principal',company:{businessType:'comercio'}},base={module:'notas_financieras',date:'2026-01-01',reason:'Preparar cierre',confirmed:true},ctx={permit(){}};
 await analysisOperation(d,a,{email:'dueño'},{...base,operation:'analysisEnable',enabled:true},ctx);
 await analysisOperation(d,a,{email:'dueño'},{...base,operation:'analysisSave',template:'Políticas revisadas'},ctx);
 const body={...base,from:'2026-01-01',to:'2026-01-31'};
 const r=analysisReport(d,a,body,()=>true);assert.equal(r.notes,'Políticas revisadas');assert.equal(r.templateVersion,2);assert.equal(r.notice,'verifica con tu contador');assert.deepEqual(d.entries,[]);
 assert.throws(()=>analysisReport(d,a,body,()=>false),/lectura/);
});
