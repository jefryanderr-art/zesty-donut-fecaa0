'use strict';
// Sugerencias aditivas; nunca sustituyen cuentas históricas ni reglas fiscales.
(() => {
 const rows=[
  ['comercio','Comercio','4108','Ingresos comerciales adicionales','5108','Costos comerciales adicionales'],
  ['servicios','Servicios','4108','Ingresos por servicios','5108','Costos directos de servicios'],
  ['industria','Industria','4108','Ingresos de producción','5108','Costos de producción'],
  ['agro','Agro','4108','Ingresos agropecuarios','5108','Costos agropecuarios'],
  ['construccion','Construcción','4108','Ingresos de obras','5108','Costos directos de obras'],
  ['financiero','Financiero','4108','Ingresos financieros de operación','5108','Costos financieros de operación'],
  ['sin_fines_de_lucro','Sin fines de lucro','4108','Aportes y donaciones de operación','5108','Costos de programas']
 ];
 const sectors=rows.map(([id,name,income,incomeName,cost,costName])=>({id,name,accounts:[{code:income,name:incomeName,tipo:'ingreso',nat:'C',sub:''},{code:cost,name:costName,tipo:'costo',nat:'D',sub:''}]}));
 globalThis.AcontecSectors=Object.freeze({version:1,sectors,get:id=>sectors.find(s=>s.id===id)});
})();
