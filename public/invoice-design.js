'use strict';
// Catálogo compartido por el editor y la validación de Functions.
(()=>{
 const profiles={
  NI:{name:'Nicaragua',authority:'Dirección General de Ingresos (DGI)',taxIdLabel:'RUC',taxName:'IVA',taxRate:15,authorizationDateLabel:'Fecha de autorización DGI',authorizationLabel:'Número de autorización DGI',missingAuthorization:'DOCUMENTO NO FISCAL — SIN AUTORIZACIÓN DGI',mandatoryLegends:'',requiredFields:['legalName','ruc','dgiNumber'],electronic:false,imprint:true},
  generic:{name:'Genérico (otro país)',authority:'Autoridad tributaria',taxIdLabel:'Identificador fiscal',taxName:'Impuesto',taxRate:0,authorizationDateLabel:'Fecha de autorización fiscal',authorizationLabel:'Autorización fiscal',missingAuthorization:'DOCUMENTO SIN AUTORIZACIÓN FISCAL',mandatoryLegends:'',requiredFields:[],electronic:false,imprint:false}
 };
 const fiscalFields={authorizationDateLabel:['Etiqueta de fecha de autorización',160],authority:['Autoridad tributaria',200],taxIdLabel:['Etiqueta del identificador fiscal',80],taxName:['Nombre del impuesto',80],authorizationLabel:['Etiqueta de autorización',160],missingAuthorization:['Leyenda sin autorización',300],mandatoryLegends:['Leyendas obligatorias',2000]};
 const country=value=>{if(typeof value!=='string'||!value.trim()||value.length>80||/[\u0000-\u001f]/.test(value))throw new Error('Escribe un país válido (máximo 80 caracteres).');return /^(ni|nicaragua)$/i.test(value.trim())?'Nicaragua':value.trim()};
 const profile=(name='Nicaragua')=>({...(Object.values(profiles).find(p=>p.name===name)||profiles.generic),requiredFields:[...(Object.values(profiles).find(p=>p.name===name)||profiles.generic).requiredFields]});
 const fiscal=settings=>({...profile(settings.country),...settings.fiscalProfile});
 const switchCountry=(settings,name)=>{name=country(name);const next={...settings,country:name,fiscalProfile:profile(name)};next.customFields=(settings.customFields||[]).map(f=>({...f,value:''}));for(const key of ['ruc','dgiNumber','dgiDate','printerRuc','printerOrder','printerDate','printerBooks','printerRange','legalText','notes'])next[key]='';return next};
 const fields={legalName:['Razón social',200],tradeName:['Nombre comercial',200],ruc:['RUC',80],address:['Dirección',1000],phone:['Teléfono',80],email:['Correo',254],website:['Sitio web',254],dgiNumber:['Número de autorización DGI',120],dgiDate:['Fecha de autorización DGI',10],printerRuc:['RUC de la imprenta',80],printerOrder:['Orden de trabajo',120],printerDate:['Fecha de imprenta',10],printerBooks:['Cantidad de libretas',20],printerRange:['Rango de numeración',120],title:['Título del documento',120],cashLegend:['Leyenda de contado',200],creditLegend:['Leyenda de crédito',200],creditTerms:['Condiciones de crédito',2000],legalText:['Texto legal',2000],thanks:['Agradecimiento',1000],notes:['Notas libres',2000]};
 const toggles={printMissingAuthorization:'Imprimir leyenda cuando no hay autorización',showCode:'Código',showUnit:'Unidad',showDiscount:'Descuento',showBranch:'Sucursal',showCashier:'Cajero',showWords:'Monto en letras',showSignature:'Firma Recibido por',showCustomerName:'Nombre del cliente',showCustomerTaxId:'RUC / cédula del cliente'};
 const defaults=(cfg={},name='')=>({...Object.fromEntries(Object.keys(fields).map(k=>[k,''])),country:cfg.invoiceCountry||'Nicaragua',fiscalProfile:profile(cfg.invoiceCountry),legalName:name,ruc:cfg.invoiceCountry&&cfg.invoiceCountry!=='Nicaragua'?'':cfg.ruc||'',address:cfg.addr||'',title:'FACTURA',cashLegend:'Contado',creditLegend:'Crédito',legalText:'Conserva este comprobante.',thanks:'Gracias por tu compra.',format:'a4',copies:1,logo:cfg.pos?.logo||'',logoSize:90,logoPosition:'left',accent:'#234e40',showAcontec:true,...Object.fromEntries(Object.keys(toggles).map(k=>[k,k!=='printMissingAuthorization']))});
 const settings=(cfg={},name='')=>{const {versions,legacyInvoiceIds,...saved}=cfg.print||{};return {...defaults(cfg,name),...saved}};
 const resolve=(cfg,name,entry)=>{
  const history=cfg.print?.versions||[];
  const version=history.find(v=>v.id===entry?.printVersionId)||((cfg.print?.legacyInvoiceIds||[]).includes(entry?.id)?history[0]:[...history].reverse().find(v=>v.at<=(entry?.issuedAt||String(entry?.date||'9999')+'T23:59:59.999Z')));
  return version?{...defaults({},name),...version.settings}:settings(cfg,name);
 };

 const blocks=['header','customer','items','totals','payment','footer'];
 const classic={template:'classic',font:'helvetica',baseSize:10,titleSize:18,companySize:22,boldLabels:true,boldTotals:true,accent:'#234e40',text:'#21342b',tableBackground:'#ffffff',tableText:'#21342b',stripe:'#f3f5f4',border:'#cccccc',totalBackground:'#ffffff',lines:'horizontal',striped:false,density:'normal',borderWidth:1,radius:0,margin:14,gap:8,order:blocks,header:'split',totals:'right',alignment:{header:'left',customer:'left',items:'left',totals:'right',payment:'left',footer:'left'},watermark:'none',watermarkText:'',opacity:0.08,formats:{a4:{baseSize:10,margin:14},letter:{baseSize:10,margin:14},thermal:{baseSize:9,margin:4}}};
 const templates={classic,modern:{...classic,template:'modern',accent:'#234e40',tableBackground:'#234e40',tableText:'#ffffff',striped:true},minimal:{...classic,template:'minimal',lines:'none',borderWidth:0},formal:{...classic,template:'formal',font:'times',lines:'grid',borderWidth:1},ticket:{...classic,template:'ticket',font:'courier',baseSize:9,header:'stacked',density:'compact',margin:4}};
 const contrast=(a,b)=>{const lum=c=>{const rgb=c.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722};const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
 const validateDesign=source=>{
  const fail=()=>{throw new Error('Diseño inválido: revisa las opciones, rangos y el contraste mínimo 4.5:1.')};
  if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).some(k=>!Object.hasOwn(classic,k)))fail();
  const d={...structuredClone(classic),...source};
  const choices={template:Object.keys(templates),font:['helvetica','times','courier'],lines:['none','horizontal','grid'],density:['compact','normal','wide'],header:['split','center','stacked'],totals:['left','right','full'],watermark:['none','text','logo']};
  for(const [k,list]of Object.entries(choices))if(!list.includes(d[k]))fail();
  for(const [k,min,max]of [['baseSize',7,14],['titleSize',10,36],['companySize',10,36],['borderWidth',0,3],['radius',0,12],['margin',4,25],['gap',0,24],['opacity',0.02,0.3]])if(typeof d[k]!=='number'||!Number.isFinite(d[k])||d[k]<min||d[k]>max)fail();
  for(const k of ['boldLabels','boldTotals','striped'])if(typeof d[k]!=='boolean')fail();
  for(const k of ['accent','text','tableBackground','tableText','stripe','border','totalBackground'])if(typeof d[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(d[k]))fail();
  if(typeof d.watermarkText!=='string'||d.watermarkText.length>200||/[\u0000-\u001f]/.test(d.watermarkText))fail();
  if(!Array.isArray(d.order)||d.order.length!==6||new Set(d.order).size!==6||d.order.some(k=>!blocks.includes(k)))fail();
  if(!d.alignment||Object.keys(d.alignment).length!==6||blocks.some(k=>!['left','center','right'].includes(d.alignment[k])))fail();
  if(!d.formats||Object.keys(d.formats).length!==3)fail();
  for(const k of ['a4','letter','thermal']){const f=d.formats[k];if(!f||Object.keys(f).some(x=>!['baseSize','margin'].includes(x))||typeof f.baseSize!=='number'||f.baseSize<7||f.baseSize>14||!Number.isFinite(f.baseSize)||typeof f.margin!=='number'||!Number.isFinite(f.margin)||f.margin<4||f.margin>25)fail()}
  for(const [a,b]of [[d.text,'#ffffff'],[d.tableText,d.tableBackground],[d.text,d.totalBackground],...(d.striped?[[d.text,d.stripe]]:[])])if(contrast(a,b)<4.5)fail();
  return d;
 };
 const validateCustom=source=>{
  if(!Array.isArray(source)||source.length>5)throw new Error('Máximo cinco campos fiscales personalizados.');
  return source.map((f,i)=>{if(!f||Object.keys(f).some(k=>!['label','value','required','position'].includes(k))||typeof f.label!=='string'||!f.label.trim()||f.label.length>200||typeof f.value!=='string'||f.value.length>200||/[\u0000-\u001f]/.test(f.label+f.value)||typeof f.required!=='boolean'||!['header','footer'].includes(f.position))throw new Error('Revisa el campo fiscal '+(i+1)+' (máximo 200 caracteres).');return {...f,label:f.label.trim(),value:f.value.trim()}});
 };
 const effectiveDesign=(cfg,format)=>{const selected=(cfg.savedDesigns||[]).find(d=>d.id===cfg.designDefaults?.[format]);const source=selected?.design||cfg.design;if(!source)return null;const d=validateDesign(source);return {...d,...d.formats[format]}};
 globalThis.AcontecInvoiceDesign=Object.freeze({fields,toggles,defaults,settings,resolve,profiles,fiscalFields,country,profile,fiscal,switchCountry,blocks,classic,templates,contrast,validateDesign,validateCustom,effectiveDesign});
})();
