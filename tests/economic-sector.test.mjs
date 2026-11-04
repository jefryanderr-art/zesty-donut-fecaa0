// Preparadas para ejecución por la plataforma; sin modificaciones de datos reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sectorTemplatePreview,configureEconomicSector,validateEconomicSector} from '../netlify/lib/economic-sector.mjs';
const data=()=>({cfg:{},entries:[],products:[],accounts:[{code:'1101',name:'Caja',tipo:'activo',nat:'D'}]});
const request=()=>({sector:'servicios',confirmed:true,reason:'Selección explícita',templateVersion:1});
const ctx={permit:(access,module)=>{if(access.blocked?.includes(module))throw new Error('Sin permiso '+module)}};
const access=state=>({owner:true,branchId:'principal',company:{data:state,businessType:'software'}});
test('la vista previa no modifica datos y declara cuentas existentes',()=>{
 const state=data(),before=structuredClone(state);assert.equal(sectorTemplatePreview(state,'servicios').accounts.length,2);assert.deepEqual(state,before);assert.throws(()=>sectorTemplatePreview(state,'inexistente'));
});
test('elegir sector con movimientos conserva exactamente cuentas y asientos',()=>{
 const state=data();state.entries=[{id:'historico',total:123.45}];const before=structuredClone(state);
 configureEconomicSector(state,access(state),request(),ctx);assert.deepEqual(state.accounts,before.accounts);assert.deepEqual(state.entries,before.entries);assert.equal(state.cfg.economicSector.id,'servicios');assert.equal(state.cfg.chartTemplate,undefined);
});
test('solo dueño con permiso, sucursal, confirmación y motivo configura',()=>{
 for(const patch of [{owner:false},{branchId:null},{blocked:['ajustes']}])assert.throws(()=>{const state=data();configureEconomicSector(state,{...access(state),...patch},request(),ctx)});
 for(const patch of [{confirmed:false},{reason:'x'},{sector:'otro'}])assert.throws(()=>{const state=data();configureEconomicSector(state,access(state),{...request(),...patch},ctx)});
});
test('aplicar plantilla es aditivo y registra perfil, motivo y versión',()=>{
 const state=data();configureEconomicSector(state,access(state),{...request(),applyTemplate:true},ctx);assert.equal(state.accounts.length,3);assert.equal(state.accounts[0].code,'1101');assert.equal(state.cfg.chartTemplate.businessType,'software');assert.equal(state.cfg.chartTemplate.version,1);
 const copy=structuredClone(state.accounts);configureEconomicSector(state,access(state),{...request(),applyTemplate:true},ctx);assert.deepEqual(state.accounts,copy);
});
test('rechaza movimientos de cualquier sucursal, stock, nómina y documentos extranjeros',()=>{
 for(const patch of [{entries:[{branchId:'otra'}]},{products:[{stock:1}]},{payrolls:[{}]},{foreignDocuments:[{}]}]){
  const state=data(),full={...data(),...patch};assert.throws(()=>configureEconomicSector(state,{...access(state),company:{data:full}},{...request(),applyTemplate:true},ctx));assert.equal(state.accounts.length,1);
 }
});
test('plantilla exige Contabilidad y versión vigente; nunca reemplaza cuentas incompatibles',()=>{
 const state=data();assert.throws(()=>configureEconomicSector(state,{...access(state),blocked:['contabilidad']},{...request(),applyTemplate:true},ctx));
 assert.throws(()=>configureEconomicSector(state,access(state),{...request(),applyTemplate:true,templateVersion:2},ctx));
 state.accounts.push({code:'4108',name:'Pasivo histórico',tipo:'pasivo',nat:'C'});const before=structuredClone(state);
 assert.throws(()=>configureEconomicSector(state,access(state),{...request(),applyTemplate:true},ctx));assert.deepEqual(state,before);
});
test('la restauración rechaza sectores y versiones desconocidos, sin añadir valores al histórico',()=>{
 const state=data(),before=structuredClone(state);validateEconomicSector(state);assert.deepEqual(state,before);
 for(const cfg of [{economicSector:{id:'otro',version:1}},{chartTemplate:{sector:'servicios',version:9}}])assert.throws(()=>validateEconomicSector({...data(),cfg}));
});
