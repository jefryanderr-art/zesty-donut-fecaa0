'use strict';
// Plantillas de país compartidas por el navegador y Functions. Valores de referencia editables; verifica con tu contador.
// Nicaragua conserva exactamente los valores que antes estaban en country.js; no se afirma vigencia legal.
(() => {
 const NI={code:'NI',country:'Nicaragua',vatRate:15,labels:{taxId:'RUC',taxName:'IVA',authority:'DGI',currency:'NIO'},
  fiscal:{socialRate:7,daysPerMonth:30,workingHours:8,overtimeFactor:2,bonusDays:30,vacationDays:30,dismissalDays:30,resignationDays:0,premiumDays:0},
  employerRate:21.5,inatecRate:2,
  bands:[{limit:100000,rate:0},{limit:200000,rate:15},{limit:350000,rate:20},{limit:500000,rate:25},{limit:null,rate:30}],
  useProgressiveIR:false,calendar:[]};
 const clone=value=>JSON.parse(JSON.stringify(value));
 globalThis.AcontecCountryTemplates={defaults:{NI},get:code=>code==='NI'?clone(NI):null,clone};
})();
