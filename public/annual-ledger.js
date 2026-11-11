'use strict';
// Cortes por sucursal. Una reapertura aditiva anula el corte, sin editar la apertura.
(() => {
 // Las aperturas históricas, anula-apertura y versiones corregidas se acumulan
 // por sus líneas; solo apertura-anual establece un corte de arrastre.
 const select=(entries=[],through='9999')=>{
  const canceled=new Set(entries.filter(e=>e.type==='anula-apertura-anual'&&e.date<=through).map(e=>e.openingId));
  const cuts=new Map();
  for(const e of entries)if(e.type==='apertura-anual'&&e.date<=through&&!canceled.has(e.id)){
   const b=e.branchId||'principal',old=cuts.get(b);if(!old||e.date>old.date)cuts.set(b,e);
  }
  return entries.filter(e=>{if(e.date>through)return false;const cut=cuts.get(e.branchId||'principal');return !cut||e.date>=cut.date;});
 };
 globalThis.AcontecAnnualLedger=Object.freeze({select});
})();
