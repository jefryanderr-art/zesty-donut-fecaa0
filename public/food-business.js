'use strict';
// Consultar el tipo actual en cada vista y acción también cubre cambios en Ajustes.
function isFoodBusiness(){
 const type=CO?.businessType==='personalizado'?businessOperationalType():CO?.businessType;
 return ['restaurante','comida_rapida','catering','panaderia'].includes(type);
}
function guardFoodActions(names){
 const allowed=actionAllowed;
 actionAllowed=function(name,data={}){if(names.includes(name)&&!isFoodBusiness())return false;return allowed(name,data);};
 for(const name of names){const original=ACT[name];ACT[name]=function(...args){if(!isFoodBusiness()||!actionAllowed(name,args[0]||{}))return;return original.apply(this,args);};}
}
