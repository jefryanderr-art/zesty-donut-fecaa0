import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLaborParameters,personnelOperation} from '../netlify/lib/personnel.mjs';
test('reglas explícitas sin tasas implícitas; activación solo dueño',()=>{
 assert.throws(()=>validateLaborParameters({country:'País',effective:'2026-01-01'}));
 assert.throws(()=>personnelOperation({businessRecords:[]},{branchId:'principal',owner:false},{email:'test@example.test'},{operation:'personnelEnable',module:'parametros_laborales',confirmed:true,reason:'Configurar reglas',date:'2026-01-01',enabled:true},{permit(){}}));
});
