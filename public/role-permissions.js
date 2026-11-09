'use strict';
// Pure permission helpers shared by the browser and Functions.
(() => {
  const actions=['view','create','edit','delete'];
  const specials=['discounts','corrections','salesAdmin','cashAdmin','allBranches'];
  const legacyGate=(role,module)=>{
    if(['diseno_factura','auditoria_revision'].includes(module))return true;
    if(module==='ventas'&&role!=='contador')return false;
    if(['cajero','vendedor','supervisor'].includes(role)&&['contabilidad','finanzas','personal','fiscal','ajustes','auditoria','accesibilidad'].includes(module))return false;
    if(['cajero','vendedor'].includes(role)&&!['tableros_rol','facturacion','inventario','cajas','cuentas_abiertas','agenda','despacho','documentos_venta','comprobantes','medidas','rutas'].includes(module))return false;
    return ['cajero','vendedor'].includes(role)&&module==='inventario'?'lectura':true;
  };
  function legacyPolicy(role,permissions,modules){
    role=String(role||'').toLowerCase();
    const fallback={facturacion:'ventas',cajas:'contabilidad',costos:'gastos',proveedores:'compras'};
    const grants=Object.fromEntries(modules.map(module=>{
      const gate=legacyGate(role,module),level=permissions?.[module]??(module==='auditoria_revision'&&role==='contador'?'escritura':undefined)??(role==='contador'?permissions?.[fallback[module]]:undefined);
      const view=!!gate&&(module!=='accesibilidad'||level==='escritura')&&['lectura','escritura'].includes(level),write=view&&gate!=='lectura'&&level==='escritura';
      return [module,{view,create:write,edit:write,delete:write}];
    }));
    grants.panel={view:true,create:false,edit:false,delete:false};
    return {modules:grants,specials:{discounts:true,corrections:role==='supervisor',salesAdmin:role==='contador',cashAdmin:['contador','supervisor'].includes(role),allBranches:role==='contador'},ownOperations:['cajero','vendedor'].includes(role)};
  }
  function levels(policy){return Object.fromEntries(Object.entries(policy.modules||{}).map(([key,p])=>[key,p.create||p.edit||p.delete?'escritura':p.view?'lectura':'ninguno']))}
  function permits(policy,module,action='view'){return policy?.modules?.[module]?.[action]===true}
  function within(candidate,ceiling){
    return Object.entries(candidate.modules||{}).every(([module,grants])=>actions.every(action=>!grants[action]||permits(ceiling,module,action)))&&specials.every(key=>!candidate.specials?.[key]||ceiling.specials?.[key]===true)&&(!ceiling.ownOperations||candidate.ownOperations===true);
  }
  function preset(role,modules){
    const permissions=Object.fromEntries(modules.map(module=>{
      let level='ninguno';
      if(['cajero','vendedor','supervisor'].includes(role)&&module==='facturacion')level='escritura';
      if(['cajero','vendedor'].includes(role)&&module==='inventario')level='lectura';
      if(['cajero','vendedor'].includes(role)&&module==='cajas')level='escritura';
      if(role==='supervisor'&&['cajas','inventario','costos','proveedores','compras','gastos'].includes(module))level='escritura';
      if(role==='contador'&&!['accesibilidad','diseno_factura'].includes(module))level=module==='auditoria'?'lectura':'escritura';
      if(role==='observador'&&!['accesibilidad','diseno_factura'].includes(module))level='lectura';
      return [module,level];
    }));
    return legacyPolicy(role,permissions,modules);
  }
  globalThis.AcontecRoles=Object.freeze({actions,specials,legacyPolicy,levels,permits,within,preset});
})();
