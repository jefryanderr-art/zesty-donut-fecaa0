// Pure local retrieval: no company data, provider, storage or daily quota.
import { assistantGuide } from './assistant-guide.mjs';
export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const stop = new Set('a al de el la un una unos unas del las los con por para mi mis le se me lo como que cuanto cuantos cuanta cuantas cual cuales donde cuando tengo hacer hago registrar registro quiero puedo esto esta este ayuda uso usar sistema acontec'.split(' '));
export function root(value) {
  let word = normalize(value);
  // Plurals first so trabajadores/trabajador and facturaciones/facturación agree.
  word = word.replace(/(?:es|s)$/u, suffix => word.length-suffix.length >= 4 ? '' : suffix);
  word = word.replace(/(?:aciones|acion|ciones|cion|mente|iendo|ando|ado|ido|dor|ar|er|ir)$/u, suffix => word.length-suffix.length >= 4 ? '' : suffix);
  return word.replace(/[ao]$/, ending => word.length > 4 ? '' : ending);
}
const synonyms = [
  ['fiado','credito'], ['plata','efectivo'], ['dinero','efectivo'], ['mercaderia','producto'], ['mercancia','producto'],
  ['planilla','nomina'], ['vender','venta'], ['vendo','venta'], ['cobro','cobrar'], ['cierro','cierre'], ['cerrar','cierre'],
  ['agrego','agregar'], ['anulo','anular'], ['borrar','nota de credito correccion'], ['eliminar','nota de credito correccion'],
  ['anular','nota de credito correccion'], ['backup','respaldo'], ['cliente que debe','cuentas por cobrar'],
  ['cuanto debo','cuentas por pagar'], ['cuanto le debo a proveedores','cuentas por pagar'], ['cerrar mes','cierre periodos'],
  ['cierro el mes','cierre periodos'], ['cobrar a un cliente','cuentas por cobrar'], ['cobro a un cliente','cuentas por cobrar'],
];
const tokens = text => normalize(text).split(' ').filter(word => word.length > 2 && !stop.has(word));
const contains = (text, phrase) => (' '+text+' ').includes(' '+phrase+' ');
function near(a,b) {
  if (a.length<5 || b.length<5 || Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,edits=0;
  while(i<a.length && j<b.length) {
    if(a[i]===b[j]) { i++;j++;continue; }
    if(++edits>1) return false;
    if(a.length>=b.length)i++;
    if(b.length>=a.length)j++;
  }
  return edits+(i<a.length||j<b.length?1:0)<=1;
}
export function rank(question) {
  const normalized = normalize(question);
  let expanded = normalized;
  for (const [phrase,replacement] of synonyms) if(contains(normalized,phrase)) expanded+=' '+replacement;
  const words = [...new Set(tokens(expanded))];
  return assistantGuide.map(section => {
    const labels = [section.titulo,section.id.replace(/-/g,' ')].map(normalize);
    const keys = section.palabras_clave.map(normalize);
    const vocabulary = new Set([...keys,...labels].flatMap(tokens));
    const roots = new Set([...vocabulary].map(root));
    let score=0;
    for (const word of words) {
      if(vocabulary.has(word)) score+=3;
      else if(roots.has(root(word))) score+=2;
      else if([...vocabulary].some(key=>near(word,key))) score+=1;
    }
    // Screen names are stronger evidence than incidental vocabulary in another section.
    const titleWords=labels.flatMap(tokens);
    for(const word of words) {
      if(titleWords.includes(word)) score+=2;
      else if(titleWords.some(key=>root(key)===root(word))) score+=1;
      else if(titleWords.some(key=>near(word,key))) score+=0.5;
    }
    // A phrase is one signal, even when editorial variants repeat it.
    if(keys.some(key=>tokens(key).length>1 && contains(expanded,key))) score+=6;
    if(labels.some(label=>contains(normalized,label))) score+=2;
    return {section,score};
  }).sort((a,b)=>b.score-a.score);
}
export function selectGuide(ranked, readable) {
  const best=ranked[0];
  const threshold=best?.score>=3?3:best?.score>=2 && best.score>(ranked[1]?.score||0)?2:Infinity;
  return ranked.filter(row=>row.score>=threshold && readable(row.section)).slice(0,3).map(row=>row.section);
}
export function suggestions(ranked, readable) {
  return ranked.filter(row=>row.score>=1 && readable(row.section)).slice(0,3).map(row=>row.section);
}
export function noMatchTopics(readable) {
  const areas = [
    ['Ventas',['facturacion','clientes','cobrar']], ['Compras',['compras','proveedores','pagar']],
    ['Inventario',['productos','kardex']], ['Contabilidad',['asientos','periodos','resultados']],
    ['Personal',['empleados','nomina']], ['Ajustes',['ajustes','respaldos','permisos']],
  ];
  const topics=areas.flatMap(([area,ids])=>{
    const section=ids.map(id=>assistantGuide.find(s=>s.id===id)).find(s=>s&&readable(s));
    return section?[area+': '+section.titulo]:[];
  });
  if(!topics.length) topics.push(...assistantGuide.filter(readable).slice(0,6).map(s=>s.titulo));
  return 'Puedes preguntar por estos temas:\n'+topics.map(topic=>'- '+topic).join('\n')+'\nTambién puedes usar las preguntas rápidas disponibles en el asistente.';
}
export function asksOwnFigures(question) {
  return /\b(mi|mis|cuanto|cuantos|cuanta|cuantas|cuales|muestrame|dame|dime|calcula)\b/.test(normalize(question)) && /\b(ventas|vendi|vendido|saldo|saldos|debe|deben|deuda|deudas|inventario|stock|productos|cobros|pagos|balance|patrimonio|resultado|ganancia|ganancias|utilidad|utilidades|efectivo|caja|banco|facturas|ingresos|gastos|cifras)\b/.test(normalize(question)) && !/\b(como|registrar|registro|agregar|leo|interpretar|leer)\b/.test(normalize(question));
}
