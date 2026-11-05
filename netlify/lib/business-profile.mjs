import {completeCompanyDocument} from '../../db/accounting-model.mjs';
import '../../public/chart-templates.js';
import '../../public/invoice-design.js';
import '../../public/profiles.js';
export const catalog=globalThis.AcontecProfiles;
const invalid=message=>{throw Object.assign(new Error(message),{status:400,publicMessage:message})};
export function validateProfile(type='comercio',custom={}) {
 if(!catalog.profiles.some(p=>p.id===type))invalid('Selecciona un tipo de negocio válido.');
 if(!custom||typeof custom!=='object'||Array.isArray(custom))invalid('Personalización inválida.');
 const result={};
 if(custom.invoiceCountry!==undefined){try{result.invoiceCountry=globalThis.AcontecInvoiceDesign.country(custom.invoiceCountry)}catch(error){invalid(error.message)}}
 if(custom.timeZone!==undefined){if(typeof custom.timeZone!=='string'||custom.timeZone.length>80)invalid('Zona horaria inválida.');try{new Intl.DateTimeFormat('es',{timeZone:custom.timeZone}).format()}catch{invalid('Zona horaria inválida.')}result.timeZone=custom.timeZone;}
 for(const key of ['shown','hidden'])if(custom[key]!==undefined){if(!Array.isArray(custom[key])||custom[key].length>150||custom[key].some(v=>typeof v!=='string'||!/^[a-z_]{1,50}$/.test(v)))invalid('Lista de módulos inválida.');result[key]=[...new Set(custom[key])];}
 if(custom.labels!==undefined){if(!custom.labels||typeof custom.labels!=='object'||Array.isArray(custom.labels))invalid('Etiquetas inválidas.');result.labels={};for(const key of ['customer','product','document']){const value=custom.labels[key];if(value!==undefined){if(typeof value!=='string'||!value.trim()||value.length>40)invalid('Etiqueta inválida.');result.labels[key]=value.trim()}}}
 return {businessType:type,businessCustomization:result};
}

export function fixedBusinessProfile(company,body,isAdmin) {
 if(!isAdmin&&body.businessType!==company.businessType)throw Object.assign(new Error('El tipo de negocio queda fijo. Para cambiarlo, contacta a Acontec.'),{status:403,publicMessage:'El tipo de negocio queda fijo. Para cambiarlo, contacta a Acontec.'});
 return validateProfile(body.businessType,{...body.businessCustomization,invoiceCountry:company.businessCustomization?.invoiceCountry||'Nicaragua'});
}
export function restoredBusinessProfile(company,backup,isAdmin) {
 return validateProfile(isAdmin?backup.businessType:company.businessType,backup.businessCustomization);
}

export function initialCompanyDocument(options){
 const data=completeCompanyDocument(null,options);
 return addProfileCatalog(data,options.businessType||'comercio');
}
export function addProfileCatalog(data,type){
 const profile=catalog.get(type),template=globalThis.AcontecChartTemplates.get(type,profile.serviceFirst?'servicios':'comercio');
 for(const account of template?.accounts||[])if(!data.accounts.some(a=>a.code===account.code))data.accounts.push(account);
 data.cfg.businessCategories=structuredClone(profile.startup.categories);
 data.cfg.businessUnits=structuredClone(profile.startup.units);
 return data;
}

export function finishCompanyProfile(company,body){
 if(company.data?.cfg?.profilePending!==true||body.confirmed!==true)invalid('El perfil no está pendiente o falta confirmación.');
 const name=String(body.name||'').trim().slice(0,80),cur=String(body.cur||'').trim();
 if(!name||!cur||cur.length>20||/[<>&"'`]/.test(cur)||!body.country||!body.businessType)invalid('Completa los datos de empresa.');
 const profile=validateProfile(body.businessType,{...company.businessCustomization,invoiceCountry:body.country});
 const data=structuredClone(company.data);
 const moved=(data.entries||[]).length||(data.products||[]).some(p=>Number(p.stock)!==0)||(data.businessRecords||[]).length||(data.payrolls||[]).length||(data.foreignDocuments||[]).length;
 data.cfg={...data.cfg,name,cur,ruc:String(body.ruc||'').trim().slice(0,100),invoiceCountry:profile.businessCustomization.invoiceCountry,profilePending:false,profileCompletedAt:new Date().toISOString(),profileChartPreserved:!!moved};
 if(!moved)addProfileCatalog(data,body.businessType);
 return {name,...profile,data};
}

export function validateCompanyDetails({name,businessType='comercio',country='Nicaragua',cur='C$',ruc=''}){
 const cleanName=String(name||'').trim().slice(0,80);
 if(!cleanName)invalid('Escribe un nombre de empresa.');
 if(typeof cur!=='string'||!cur.trim()||cur.length>20||/[<>&"'`]/.test(cur))invalid('Escribe una moneda válida.');
 if(typeof ruc!=='string'||ruc.length>100)invalid('Identificación inválida.');
 const profile=validateProfile(businessType,{invoiceCountry:country});
 return {name:cleanName,cur:cur.trim(),ruc:ruc.trim(),businessType:profile.businessType,country:profile.businessCustomization.invoiceCountry};
}
