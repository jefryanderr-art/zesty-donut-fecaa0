// Prepared for platform execution. No external services or database are needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceCheckStock,commerceReservationsValid} from '../netlify/lib/commerce.mjs';
import {serviceConsumptionPlan} from '../netlify/lib/service-catalog.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message)};
test('una empresa flexible no cambia el control de otra empresa',()=>{
 const strict={cfg:{},products:[{id:'p',stock:0}],businessRecords:[]},flexible=structuredClone(strict);flexible.cfg.allowNegativeValues=true;
 assert.throws(()=>commerceCheckStock(strict,{items:[{p:'p',q:1}]},check),/Existencia/);
 assert.doesNotThrow(()=>commerceCheckStock(flexible,{items:[{p:'p',q:1}]},check));
 flexible.products[0].stock=-1;assert.doesNotThrow(()=>commerceReservationsValid(flexible,check));
 assert.equal(strict.products[0].stock,0);assert.equal(strict.cfg.allowNegativeValues,undefined);
});
test('consumibles pueden quedar negativos sin perder el costo ni aceptar productos inválidos',()=>{
 const data={cfg:{},entries:[],businessRecords:[],products:[{id:'p',stock:0,cost:2,unit:'unidad'},{id:'s',kind:'service',serviceDefinition:{enabled:true,version:1,consumables:[{p:'p',q:2}],components:[]}}]};
 assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:1}]),/existencias/);
 data.cfg.allowNegativeValues=true;const plan=serviceConsumptionPlan(data,[{p:'s',q:1}]);assert.equal(plan.rows[0].q,2);assert.equal(plan.totalCents,400);
 data.products[1].serviceDefinition.consumables[0].p='missing';assert.throws(()=>serviceConsumptionPlan(data,[{p:'s',q:1}]),/inválido/);
});
