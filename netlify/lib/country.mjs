export function progressiveTax(annualIncome,bands){
 if(!Number.isFinite(annualIncome)||annualIncome<0)throw new Error('Base de IR inválida.');let previous=0,total=0;
 for(const band of bands){const limit=band.limit??Infinity,rate=band.rate;if(!(limit>previous)||!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Tramos de IR inválidos.');total+=Math.max(0,Math.min(annualIncome,limit)-previous)*rate/100;if(annualIncome<=limit)return Math.round((total+Number.EPSILON)*100)/100;previous=limit}
 throw new Error('Falta el último tramo abierto de IR.');
}
export function countryTemplate(body){
 const fiscal={};for(const key of ['socialRate','daysPerMonth','workingHours','overtimeFactor','bonusDays','vacationDays','dismissalDays','resignationDays','premiumDays']){const value=Number(body.fiscal?.[key]??0);if(!Number.isFinite(value)||value<0||value>366||(['daysPerMonth','workingHours'].includes(key)&&value===0))throw new Error('Parámetros laborales inválidos.');fiscal[key]=value}
 if(fiscal.socialRate>100)throw new Error('Tasa de seguro social inválida.');
 const employerRate=Number(body.employerRate),inatecRate=Number(body.inatecRate);if(![employerRate,inatecRate].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw new Error('Aportes patronales inválidos.');
 const bands=body.bands;if(!Array.isArray(bands)||bands.length<1||bands.length>20||bands.at(-1).limit!==null)throw new Error('Configura los tramos de IR con un último límite abierto.');progressiveTax(1e12,bands);
 if(body.confirmed!==true)throw new Error('Confirma la revisión de los parámetros.');
 return {country:'Nicaragua',label:'Revisar con el contador',fiscal,bands,employerRate,inatecRate,useProgressiveIR:body.useProgressiveIR===true,reviewedAt:new Date().toISOString()};
}
