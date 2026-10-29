import '../../public/profiles.js';
export const catalog=globalThis.AcontecProfiles;
const invalid=message=>{throw Object.assign(new Error(message),{status:400,publicMessage:message})};
export function validateProfile(type='comercio',custom={}) {
 if(!catalog.profiles.some(p=>p.id===type))invalid('Selecciona un tipo de negocio válido.');
 if(!custom||typeof custom!=='object'||Array.isArray(custom))invalid('Personalización inválida.');
 const result={};
 if(custom.timeZone!==undefined){if(typeof custom.timeZone!=='string'||custom.timeZone.length>80)invalid('Zona horaria inválida.');try{new Intl.DateTimeFormat('es',{timeZone:custom.timeZone}).format()}catch{invalid('Zona horaria inválida.')}result.timeZone=custom.timeZone;}
 for(const key of ['shown','hidden'])if(custom[key]!==undefined){if(!Array.isArray(custom[key])||custom[key].length>150||custom[key].some(v=>typeof v!=='string'||!/^[a-z_]{1,50}$/.test(v)))invalid('Lista de módulos inválida.');result[key]=[...new Set(custom[key])];}
 if(custom.labels!==undefined){if(!custom.labels||typeof custom.labels!=='object'||Array.isArray(custom.labels))invalid('Etiquetas inválidas.');result.labels={};for(const key of ['customer','product','document']){const value=custom.labels[key];if(value!==undefined){if(typeof value!=='string'||!value.trim()||value.length>40)invalid('Etiqueta inválida.');result.labels[key]=value.trim()}}}
 return {businessType:type,businessCustomization:result};
}
