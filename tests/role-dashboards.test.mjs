import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisReport} from '../netlify/lib/analysis.mjs';
import {roleAllows} from '../netlify/lib/policies.mjs';
test('tablero cajero conserva permiso propio, restringe a operador y omite finanzas',()=>{
 const a={owner:false,member:{role:'cajero',id:'a'}},data={businessRecords:[{module:'tableros_rol',kind:'configuration',status:'Activa'}],entries:[{type:'venta',date:'2026-01-01',operatorId:'a',subtotal:10},{type:'venta',date:'2026-01-01',operatorId:'b',subtotal:90}]};
 assert.equal(roleAllows(a,'tableros_rol'),true);
 const r=analysisReport(data,a,{module:'tableros_rol',from:'2026-01-01',to:'2026-01-31'},m=>m==='facturacion');
 assert.deepEqual(r.rows,[{key:'sales',value:1000,unit:'money'}]);
 assert.deepEqual(analysisReport(data,a,{module:'tableros_rol'},()=>false).rows,[]);
});
