// Preparadas para la plataforma; no ejecutar en la sesión gestionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {catalog} from '../netlify/lib/business-profile.mjs';
import {DEFAULT_PLANS,requirePlanModule} from '../netlify/lib/billing-rules.mjs';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=source('public/app.js'),access=source('public/access.js'),business=source('public/business.js');
const baseMenu=app.slice(app.indexOf('const MENU='),app.indexOf('function shell()'));
function browser(profile,plan,custom={},internalTest=false,profileOverride){
 const html=[];
 const context=vm.createContext({AcontecProfiles:profileOverride?{...catalog,get:()=>profileOverride}:catalog,CO:{owner:true,businessType:profile,billingPlan:structuredClone(plan),businessCustomization:custom,onboardingDone:true,entitlement:{access:true,state:internalTest?'prueba_interna':'activo',internalTest}},HOME:false,U:{},R:'businessMore',ACT:{},V:{panel(){}},BILLING_MODULES:[],READ_ACTIONS:new Set(),chrome(){},actionAllowed(){return true},$:()=>({insertAdjacentHTML:(_where,value)=>html.push(value)}),esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),view(){},html});
 vm.runInContext(baseMenu+access.slice(0,access.indexOf('function canSave()'))+business.slice(0,business.indexOf('const businessAuth='))+business.slice(business.indexOf('const businessPanel='),business.indexOf('ACT.businessOnboard=')),context);
 return {context,html,run:code=>vm.runInContext(code,context)};
}
const accounting=['apertura','diario','mayor','cuentas','balanza','resultados','balance','flujo'];
for(const id of ['basico','estandar','pro'])test('restaurante conserva contabilidad y bloqueos en '+id,()=>{
 const plan=DEFAULT_PLANS.find(p=>p.id===id),ui=browser('restaurante',plan);
 for(const route of accounting)assert.equal(ui.run(`businessVisible('${route}')`),true,route);
 assert.equal(ui.run("routeAllowed('businessMore')"),true);
 ui.run("MENU.push(['Gestión',[['personal','','Personal'],['sucursales','','Sucursales']]]);Object.assign(ROUTE_MODULE,{sucursales:'sucursales'});");
 for(const route of ['personal','sucursales'])assert.equal(ui.run(`businessVisible('${route}')`),!plan.blockedModules.includes(route));
 for(const module of catalog.all)assert.doesNotThrow(()=>requirePlanModule(plan,module));
 ui.run('V.panel()');
 for(const module of catalog.get('restaurante').capabilities)assert.ok(ui.html.join('').includes(`data-r="${module}"`));
 assert.ok(ui.html.join('').includes('>Contabilidad</button>'));
});
test('personalización conserva prioridad sin habilitar bloqueos del plan',()=>{
 const ui=browser('restaurante',DEFAULT_PLANS[1],{hidden:['diario'],shown:['personal','agenda']});
 assert.equal(ui.run("businessVisible('diario')"),false);
 assert.equal(ui.run("businessVisible('personal')"),false);
 assert.equal(ui.run("businessVisible('agenda')"),true);
});
for(const profile of catalog.profiles)test('Facturación limita '+profile.id+' incluso en prueba interna y con plan guardado anterior',()=>{
 for(const internal of [false,true]){
  const saved={...DEFAULT_PLANS[0],blockedModules:['contabilidad','finanzas','cajas','personal','control_personal','decisiones','sucursales']};
  const ui=browser(profile.id,saved,{shown:catalog.all},internal);
  assert.equal(ui.run("routeAllowed('businessMore')"),false);
  assert.equal(ui.run("businessVisible('businessMore')"),false);
  for(const module of catalog.all){
   const included=['documentos_venta','comprobantes'].includes(module);
   assert.equal(ui.run(`routeAllowed('${module}')`),included,module);
   if(included)assert.doesNotThrow(()=>requirePlanModule(saved,module));
   else assert.throws(()=>requirePlanModule(saved,module),error=>error.status===403);
  }
  for(const route of accounting)assert.equal(ui.run(`businessVisible('${route}')`),false);
  ui.run("V.businessMore();if(!routeAllowed(R))R=firstAllowedRoute();");
  assert.equal(ui.context.R,'panel');
  ui.run('V.panel()');
  const rendered=ui.html.join('');
  assert.ok(!rendered.includes('business-panel-modules'));
  assert.ok(!rendered.includes('Más módulos'));
  for(const module of ['documentos_venta','comprobantes'])assert.ok(rendered.includes(`data-r="${module}"`));
 }
});
test('comercio conserva menú base, respaldo y panel sin tarjetas de perfil',()=>{
 const ui=browser('comercio',DEFAULT_PLANS[3]);
 for(const route of accounting)assert.equal(ui.run(`businessVisible('${route}')`),true);
 for(const module of catalog.all)assert.equal(ui.run(`businessVisible('${module}')`),false);
 assert.equal(ui.run("routeAllowed('businessMore')"),true);
 ui.run('V.panel()');assert.deepEqual(ui.html,[]);
});
test('todas las tarjetas autorizadas se muestran sin límite de cuatro y escapan etiquetas',()=>{
 const ui=browser('restaurante',DEFAULT_PLANS[3],{},false,{id:'restaurante',group:'<grupo>',name:'<nombre>',salesFlow:'<flujo>',capabilities:catalog.all});
 ui.run('V.panel()');
 const rendered=ui.html.join('');
 for(const module of catalog.all)assert.ok(rendered.includes(`data-r="${module}"`));
 assert.ok(rendered.includes('&lt;nombre>'));assert.ok(!rendered.includes('<nombre>'));
});

test('Más módulos ofrece acciones independientes solo al dueño con ajustes y sin bloqueos',()=>{
 const ui=browser('restaurante',DEFAULT_PLANS[3],{hidden:['diario']});
 ui.context.main=html=>ui.html.push(html);ui.context.pageHead=()=>'';ui.context.notice=text=>text;
 ui.run('V.businessMore()');
 let rendered=ui.html.pop();
 assert.match(rendered,/data-a="businessMenu" data-r="diario">Agregar a mi menú/);
 assert.match(rendered,/data-a="businessMenu" data-r="mayor">Quitar de mi menú/);
 assert.match(rendered,/data-a="nav" data-r="diario"/);
 assert.ok(!rendered.includes('<button class="card business-module"'));
 ui.run('CO.owner=false;V.businessMore()');assert.ok(!ui.html.pop().includes('data-a="businessMenu"'));
 ui.run('CO.owner=true;CO.readOnlyLimit=true;V.businessMore()');assert.ok(!ui.html.pop().includes('data-a="businessMenu"'));
 const limited=browser('restaurante',DEFAULT_PLANS[1]);
 limited.context.main=html=>limited.html.push(html);limited.context.pageHead=()=>'';limited.context.notice=text=>text;
 limited.run("MENU.push(['Gestión',[['personal','','Personal']]]);V.businessMore()");
 assert.ok(!limited.html.pop().includes('data-a="businessMenu" data-r="personal"'));
});

test('agregar y quitar reutiliza guardado con revisión, conserva preferencias y no cambia accesos',async()=>{
 const custom={hidden:['diario'],shown:['agenda'],labels:{customer:'Paciente'},timeZone:'America/Managua'};
 const ui=browser('restaurante',DEFAULT_PLANS[3],structuredClone(custom));
 const requests=[],messages=[];let chromeCalls=0;
 Object.assign(ui.context,{REV:7,S:{},flush:async()=>true,rememberCloud(){},chrome(){chromeCalls++},api:async(path,method,body)=>{
  requests.push({path,method,body});
  if(method==='POST')return {revision:8};
  return {company:{...ui.context.CO,businessCustomization:structuredClone(requests.at(-2).body.businessCustomization)},data:{},revision:8};
 }});
 ui.context.CO.id='company';ui.context.V.businessMore=message=>messages.push(message);
 const button={disabled:false};ui.context.button=button;
 await ui.run("ACT.businessMenu({r:'diario'},button)");
 assert.equal(requests[0].path,'business-profile?c=company');assert.equal(requests[0].body.revision,7);
 assert.equal(requests[0].body.businessType,'restaurante');
 assert.deepEqual(JSON.parse(JSON.stringify(requests[0].body.businessCustomization)),{...custom,hidden:[],shown:['agenda','diario']});
 assert.equal(ui.run("businessVisible('diario')"),true);assert.equal(button.disabled,false);
 await ui.run("ACT.businessMenu({r:'diario'},button)");
 assert.equal(requests[2].body.revision,8);
 assert.equal(ui.run("businessVisible('diario')"),false);assert.equal(ui.run("routeAllowed('diario')"),true);
 assert.deepEqual(messages,['Agregado a tu menú','Quitado de tu menú']);assert.equal(chromeCalls,2);
 const saved=JSON.stringify(ui.context.CO);const previousRevision=ui.context.REV;
 ui.context.api=async()=>{throw new Error('Revisión desactualizada')};
 await assert.rejects(ui.run("ACT.businessMenu({r:'diario'},button)"),/Revisión desactualizada/);
 assert.equal(JSON.stringify(ui.context.CO),saved);assert.equal(ui.context.REV,previousRevision);
 assert.equal(button.disabled,false);assert.equal(chromeCalls,2);assert.equal(messages.length,2);
 ui.context.flush=async()=>false;
 await assert.rejects(ui.run("ACT.businessMenu({r:'diario'},button)"),/Guarda los cambios pendientes/);
 assert.equal(JSON.stringify(ui.context.CO),saved);
 ui.run('CO.owner=false');
 await ui.run("ACT.businessMenu({r:'diario'},button)");
 assert.equal(button.disabled,false);
});
