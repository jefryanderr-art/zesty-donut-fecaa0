import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../netlify/lib/business-profile.mjs';
import {specializedPreview,applySpecializedChart} from '../netlify/lib/chart-templates.mjs';
const make=()=>{const data={cfg:{},accounts:[],products:[],entries:[]};return {data,access:{owner:true,branchId:'principal',company:{businessType:'software',data}},body:{profile:'software',sector:'servicios',version:1,confirmed:true,reason:'Aprobación del catálogo'},ctx:{permit:(a,m)=>assert.ok(!a.blocked?.includes(m))}}};
test('32 perfiles y siete sectores tienen plantilla especializada aditiva sin efectos de vista previa',()=>{
 for(const p of catalog.profiles)for(const sector of ['comercio','servicios','industria','agro','construccion','financiero','sin_fines_de_lucro']){const f=make(),before=structuredClone(f.data),t=specializedPreview(f.data,p.id,sector);assert.ok(t.accounts.length>=12);assert.equal(new Set(t.accounts.map(a=>a.code)).size,t.accounts.length);assert.deepEqual(f.data,before);}
});
test('conserva cuentas existentes y rechaza naturaleza incompatible antes de escribir',()=>{
 const f=make();f.data.accounts=[{code:'2199',name:'Nombre original',tipo:'pasivo',nat:'C',sub:''}];applySpecializedChart(f.data,f.access,f.body,f.ctx);assert.equal(f.data.accounts[0].name,'Nombre original');const before=structuredClone(f.data);applySpecializedChart(f.data,f.access,f.body,f.ctx);assert.deepEqual(f.data.accounts,before.accounts);
 const other=make();other.data.accounts=[{code:'2199',name:'Histórica',tipo:'activo',nat:'D'}];const saved=structuredClone(other.data);assert.throws(()=>applySpecializedChart(other.data,other.access,other.body,other.ctx));assert.deepEqual(other.data,saved);
});
test('exige dueño, permisos, confirmación, motivo, versión, perfil real y ausencia de movimientos global',()=>{
 for(const patch of [{owner:false},{branchId:null},{blocked:['contabilidad']},{blocked:['ajustes']}]){const f=make();assert.throws(()=>applySpecializedChart(f.data,{...f.access,...patch},f.body,f.ctx));}
 for(const patch of [{confirmed:false},{reason:'x'},{version:9},{profile:'hotel'}]){const f=make();assert.throws(()=>applySpecializedChart(f.data,f.access,{...f.body,...patch},f.ctx));}
 for(const patch of [{entries:[{branchId:'otra'}]},{products:[{stock:1}]},{payrolls:[{}]},{foreignDocuments:[{}]}]){const f=make();f.access.company.data={...f.data,...patch};assert.throws(()=>applySpecializedChart(f.data,f.access,f.body,f.ctx));assert.equal(f.data.accounts.length,0);}
});
