// Prepared for the platform. No local database or external service is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../public/role-permissions.js';
import {roleAllows,salesAdministrator,supervisor,cashAdministrator} from '../netlify/lib/policies.mjs';
import {canonical} from '../netlify/lib/accounting-codec.mjs';
const rules=globalThis.AcontecRoles;
const source=readFileSync(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
const modules=['panel','ventas','facturacion','compras','gastos','inventario','cajas','costos','proveedores','contabilidad','finanzas','personal','fiscal','ajustes','auditoria','auditoria_revision','accesibilidad','diseno_factura'];
const fail=(message,status=403)=>{throw Object.assign(new Error(message),{status})};
const ctx=vm.createContext({roleRules:rules,roleAllows,MODULES:modules,structuredClone,accessError:fail,moduleIncluded:()=>true,requirePlanModule:()=>{}});
vm.runInContext(source.slice(source.indexOf('export const requireModule'),source.indexOf('export const allData')).replaceAll('export ',''),ctx);
const {allowed}=vm.runInContext('({allowed})',ctx);
vm.runInContext(source.slice(source.indexOf('export function validateRolePolicy'),source.indexOf('function guardRoleChanges')).replaceAll('export ',''),ctx);
const policy=(module,actions)=>({modules:{[module]:Object.fromEntries(rules.actions.map(a=>[a,actions.includes(a)]))},specials:Object.fromEntries(rules.specials.map(k=>[k,false])),ownOperations:false});

test('los cargos históricos conservan sus restricciones y las matrices individuales',()=>{
 for(const role of ['cajero','vendedor','supervisor','contador','observador'])for(const level of ['ninguno','lectura','escritura']){
  const permissions=Object.fromEntries(modules.map(m=>[m,level]));
  const access={member:{role},permissions};
  const converted=rules.legacyPolicy(role,permissions,modules);
  for(const module of modules.filter(m=>m!=='panel')){
   assert.equal(allowed(access,module),rules.permits(converted,module),role+':'+module);
   assert.equal(allowed(access,module,true),rules.permits(converted,module,'create'),role+':'+module);
  }
 }
 const first=rules.legacyPolicy('contador',{ventas:'lectura'},modules),second=rules.legacyPolicy('contador',{ventas:'escritura'},modules);
 assert.equal(first.modules.ventas.edit,false);assert.equal(second.modules.ventas.edit,true);
});
test('un cargo personalizado usa permisos de datos y distingue crear, editar y borrar',()=>{
 const access={member:{role:'Cargo personalizado'},rolePolicy:policy('ventas',['view','create'])};
 assert.equal(allowed(access,'ventas'),true);assert.equal(allowed(access,'ventas',true,'create'),true);
 assert.equal(allowed(access,'ventas',true,'edit'),false);assert.equal(allowed(access,'ventas',true,'delete'),false);
 assert.equal(allowed(access,'compras'),false);
 assert.equal(allowed({...access,readOnlyLimit:true},'ventas',true,'create'),false);
 assert.equal(allowed({...access,support:true},'ventas',true,'create'),false);
 assert.equal(allowed({...access,owner:true},'ventas',true,'delete'),true);
});
test('el permiso de administrar accesos es obligatorio; el dueño conserva acceso protegido',()=>{
 assert.equal(allowed({member:{role:'contador'},permissions:{accesibilidad:'lectura'}},'accesibilidad'),false);
 assert.equal(allowed({rolePolicy:policy('ventas',['view'])},'accesibilidad'),false);
 assert.equal(allowed({rolePolicy:policy('accesibilidad',rules.actions)},'accesibilidad'),true);
 assert.equal(allowed({owner:true,permissions:{}},'accesibilidad',true),true);
});
test('un administrador no puede conceder acciones ni alcances superiores',()=>{
 const access={rolePolicy:policy('inventario',['view','create'])};
 assert.doesNotThrow(()=>ctx.validateRolePolicy(policy('inventario',['view']),access));
 assert.throws(()=>ctx.validateRolePolicy(policy('inventario',['view','edit']),access),/permisos/);
 const special=policy('inventario',['view']);special.specials.corrections=true;
 assert.throws(()=>ctx.validateRolePolicy(special,access),/superiores/);
 const missingView=policy('inventario',['create']);
 assert.throws(()=>ctx.validateRolePolicy(missingView,{owner:true}),/requieren/);
 assert.throws(()=>ctx.validateRolePolicy({modules:{inventado:{}},specials:{}},{owner:true}),/inválidos/);
 const own={...policy('inventario',['view']),ownOperations:true};
 assert.equal(rules.within(policy('inventario',['view']),own),false);
});
test('los permisos especiales se aplican también a los ayudantes de autorización',()=>{
 const access={member:{role:'Cargo personalizado'},rolePolicy:policy('facturacion',['view','create'])};
 assert.equal(supervisor(access),false);assert.equal(cashAdministrator(access),false);assert.equal(salesAdministrator(access),false);
 access.rolePolicy.specials.corrections=true;access.rolePolicy.specials.cashAdmin=true;access.rolePolicy.specials.salesAdmin=true;
 assert.equal(supervisor(access),true);assert.equal(cashAdministrator(access),true);assert.equal(salesAdministrator(access),true);
 assert.equal(supervisor({...access,owner:true}),true);
});

function roleHarness(){
 const tables=Object.fromEntries(['companyRoles','companyMembers','sessions'].map(name=>[name,{name,...Object.fromEntries(['id','companyId','email','memberId','createdAt'].map(key=>[key,{key}]))}]));
 const rows={companyRoles:[],companyMembers:[],sessions:[]},events=[];
 let n=0;
 const client={select(){return {from(table){this.table=table;return this},where(filter){this.filter=filter;return this},orderBy(){return this},then(resolve){resolve(rows[this.table.name].filter(this.filter||(()=>true)).map(row=>structuredClone(row)))}}},
  insert(table){return {values(value){this.value=value;return this},returning(){const row={id:'role-'+(++n),version:0,...this.value};rows[table.name].push(row);return Promise.resolve([structuredClone(row)])}}},
  update(table){return {set(patch){this.patch=patch;return this},where(filter){this.filter=filter;for(const row of rows[table.name].filter(filter))Object.assign(row,this.patch);return this},returning(){return Promise.resolve(rows[table.name].filter(this.filter).map(row=>structuredClone(row)))},then(resolve){resolve()}}},
  delete(table){return {where(filter){rows[table.name]=rows[table.name].filter(row=>!filter(row));return Promise.resolve()}}},
 };
 const context=vm.createContext({...tables,structuredClone,db:{transaction:f=>f(client)},eq:(column,value)=>row=>row[column.key]===value,and:(...filters)=>row=>filters.every(f=>f(row)),or:(...filters)=>row=>filters.some(f=>f(row)),
  companyAccess:async(_client,id)=>({company:{id,ownerEmail:'owner@example.invalid'},owner:true}),allowed,accessError:fail,audit:async(...args)=>events.push(args),MODULES:modules,
  validateRolePolicy:ctx.validateRolePolicy,roleRules:rules,safeMember:m=>m,
 });
 const manager=readFileSync(new URL('../netlify/lib/company-roles.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
 vm.runInContext(manager,context);
 return {rows,events,list:id=>context.listCompanyRoles(id,{email:'owner@example.invalid'}),manage:(id,body,method)=>context.manageCompanyRole(id,{email:'owner@example.invalid'},body,method)};
}
test('crear, editar y borrar quedan aislados por empresa y exigen revisión y reasignación',async()=>{
 const h=roleHarness();
 const first=await h.list('company-a'),second=await h.list('company-b');
 assert.equal(first.roles.length,9);assert.equal(second.roles.length,9);
 const original=canonical(second.roles);
 const {role}=await h.manage('company-a',{name:'Almacén',description:'Consulta y registro',policy:policy('inventario',['view','create']),confirmed:true},'POST');
 await assert.rejects(()=>h.manage('company-b',{id:role.id,version:0,confirmed:true},'DELETE'),/Recarga/);
 await assert.rejects(()=>h.manage('company-a',{id:role.id,version:8,confirmed:true},'DELETE'),/Recarga/);
 h.rows.companyMembers.push({id:'m1',companyId:'company-a',roleId:role.id,role:role.name,version:0,permissions:{}});
 await assert.rejects(()=>h.manage('company-a',{id:role.id,version:0,confirmed:true},'DELETE'),/Reasigna/);
 await h.manage('company-a',{id:role.id,version:0,reassignRoleId:first.roles[0].id,confirmed:true},'DELETE');
 assert.equal(h.rows.companyMembers[0].roleId,first.roles[0].id);
 assert.equal(h.rows.companyRoles.some(r=>r.id===role.id),false);
 assert.equal(canonical((await h.list('company-b')).roles),original);
});
test('editar el cargo no sobrescribe excepciones individuales históricas',async()=>{
 const h=roleHarness(),list=await h.list('company-a'),role=list.roles.find(r=>r.key==='contador');
 const old={id:'legacy',companyId:'company-a',role:'contador',permissions:{ventas:'lectura'},version:3};
 h.rows.companyMembers.push(old);
 await h.manage('company-a',{...role,policy:policy('ventas',['view','create']),confirmed:true},'PUT');
 assert.equal(old.version,3);assert.deepEqual(old.permissions,{ventas:'lectura'});assert.equal(old.roleId,undefined);
 const shown=(await h.list('company-a')).members[0];assert.equal(shown.hasExceptions,true);assert.equal(shown.effectivePolicy.modules.ventas.create,false);
});

test('el guardado real rechaza editar y borrar registros con permiso solo de crear',()=>{
 const equal=(a,b)=>canonical(a)===canonical(b);
 const context=vm.createContext({allowed,accessError:fail,equal,ADVANCED_ARRAYS:{},TRADE_ARRAYS:{},
  accountingDocument:structuredClone,scopeBranch:data=>data,companyBranches:data=>data?.branches||[],entryAccessModule:e=>e.type==='venta'?'ventas':'contabilidad'});
 vm.runInContext(source.slice(source.indexOf('function guardRoleChanges'),source.indexOf('// Shared creation path')),context);
 const access={rolePolicy:policy('inventario',['view','create'])};
 const before={cfg:{},products:[{id:'p',price:5}]};
 assert.doesNotThrow(()=>context.guardRoleChanges(before,{...before,products:[...before.products,{id:'q',price:7}]},access,'Datos contables actualizados'));
 assert.throws(()=>context.guardRoleChanges(before,{...before,products:[{id:'p',price:8}]},access,'Datos contables actualizados'),/editar/);
 assert.throws(()=>context.guardRoleChanges(before,{...before,products:[]},access,'Datos contables actualizados'),/borrar/);
});
