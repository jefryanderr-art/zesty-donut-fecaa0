'use strict';
// Catálogo compartido por el editor y la validación de Functions.
(()=>{
 const profiles={
  NI:{name:'Nicaragua',authority:'Dirección General de Ingresos (DGI)',taxIdLabel:'RUC',taxName:'IVA',taxRate:15,authorizationLabel:'Número de autorización DGI',missingAuthorization:'DOCUMENTO NO FISCAL — SIN AUTORIZACIÓN DGI',mandatoryLegends:'',requiredFields:['legalName','ruc','dgiNumber'],electronic:false,imprint:true},
  generic:{name:'Genérico (otro país)',authority:'Autoridad tributaria',taxIdLabel:'Identificador fiscal',taxName:'Impuesto',taxRate:0,authorizationLabel:'Autorización fiscal',missingAuthorization:'DOCUMENTO SIN AUTORIZACIÓN FISCAL',mandatoryLegends:'',requiredFields:[],electronic:false,imprint:false}
 };
 const fiscalFields={authority:['Autoridad tributaria',200],taxIdLabel:['Etiqueta del identificador fiscal',80],taxName:['Nombre del impuesto',80],authorizationLabel:['Etiqueta de autorización',160],missingAuthorization:['Leyenda sin autorización',300],mandatoryLegends:['Leyendas obligatorias',2000]};
 const country=value=>{if(typeof value!=='string'||!value.trim()||value.length>80||/[\u0000-\u001f]/.test(value))throw new Error('Escribe un país válido (máximo 80 caracteres).');return /^(ni|nicaragua)$/i.test(value.trim())?'Nicaragua':value.trim()};
 const profile=(name='Nicaragua')=>({...(Object.values(profiles).find(p=>p.name===name)||profiles.generic),requiredFields:[...(Object.values(profiles).find(p=>p.name===name)||profiles.generic).requiredFields]});
 const fiscal=settings=>({...profile(settings.country),...settings.fiscalProfile});
 const switchCountry=(settings,name)=>{name=country(name);const next={...settings,country:name,fiscalProfile:profile(name)};for(const key of ['ruc','dgiNumber','dgiDate','printerRuc','printerOrder','printerDate','printerBooks','printerRange','legalText','notes'])next[key]='';return next};
 const fields={legalName:['Razón social',200],tradeName:['Nombre comercial',200],ruc:['RUC',80],address:['Dirección',1000],phone:['Teléfono',80],email:['Correo',254],website:['Sitio web',254],dgiNumber:['Número de autorización DGI',120],dgiDate:['Fecha de autorización DGI',10],printerRuc:['RUC de la imprenta',80],printerOrder:['Orden de trabajo',120],printerDate:['Fecha de imprenta',10],printerBooks:['Cantidad de libretas',20],printerRange:['Rango de numeración',120],title:['Título del documento',120],cashLegend:['Leyenda de contado',200],creditLegend:['Leyenda de crédito',200],creditTerms:['Condiciones de crédito',2000],legalText:['Texto legal',2000],thanks:['Agradecimiento',1000],notes:['Notas libres',2000]};
 const toggles={showCode:'Código',showUnit:'Unidad',showDiscount:'Descuento',showBranch:'Sucursal',showCashier:'Cajero',showWords:'Monto en letras',showSignature:'Firma Recibido por',showCustomerName:'Nombre del cliente',showCustomerTaxId:'RUC / cédula del cliente'};
 const defaults=(cfg={},name='')=>({...Object.fromEntries(Object.keys(fields).map(k=>[k,''])),country:cfg.invoiceCountry||'Nicaragua',fiscalProfile:profile(cfg.invoiceCountry),legalName:name,ruc:cfg.invoiceCountry&&cfg.invoiceCountry!=='Nicaragua'?'':cfg.ruc||'',address:cfg.addr||'',title:'FACTURA',cashLegend:'Contado',creditLegend:'Crédito',legalText:'Conserva este comprobante. Verifica los requisitos fiscales aplicables con tu contador.',thanks:'Gracias por tu compra.',format:'a4',copies:1,logo:cfg.pos?.logo||'',logoSize:90,logoPosition:'left',accent:'#234e40',showAcontec:true,...Object.fromEntries(Object.keys(toggles).map(k=>[k,true]))});
 const settings=(cfg={},name='')=>{const {versions,legacyInvoiceIds,...saved}=cfg.print||{};return {...defaults(cfg,name),...saved}};
 const resolve=(cfg,name,entry)=>{
  const history=cfg.print?.versions||[];
  const version=history.find(v=>v.id===entry?.printVersionId)||((cfg.print?.legacyInvoiceIds||[]).includes(entry?.id)?history[0]:[...history].reverse().find(v=>v.at<=(entry?.issuedAt||String(entry?.date||'9999')+'T23:59:59.999Z')));
  return version?{...defaults({},name),...version.settings}:settings(cfg,name);
 };
 globalThis.AcontecInvoiceDesign=Object.freeze({fields,toggles,defaults,settings,resolve,profiles,fiscalFields,country,profile,fiscal,switchCountry});
})();
