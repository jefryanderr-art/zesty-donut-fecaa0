import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { assistantGuide } from '../netlify/lib/assistant-guide.mjs';
import { rank, root, selectGuide, suggestions, noMatchTopics, asksOwnFigures } from '../netlify/lib/assistant-search.mjs';

const questions = [
  ['Como uso facturación','facturacion'],
  ['como cobro a un cliente','cobrar'],
  ['cuánto le debo a proveedores','pagar'],
  ['cómo hago un respaldo','respaldos'],
  ['como cierro el mes','periodos'],
  ['como agrego un empleado','empleados'],
  ['como anulo una factura','corregir-factura'],
];
for (const [question,id] of questions) {
  test('selección local: '+question,()=>{
    const ranked=rank(question);
    assert.equal(ranked[0].section.id,id);
    assert.equal(selectGuide(ranked,()=>true)[0].id,id);
  });
}
test('raíces, variantes, sinónimos y un error leve',()=>{
  assert.equal(new Set(['facturación','factura','facturar','facturas','facturaciones'].map(root)).size,1);
  assert.equal(rank('Como uso facturacio')[0].section.id,'facturacion');
  assert.equal(rank('como proceso la planilla')[0].section.id,'nomina');
  assert.equal(rank('como vendo fiado')[0].section.modulo,'facturacion');
});
test('umbral bajo solo con ganador claro y sugerencias limitadas',()=>{
  const a=assistantGuide[0],b=assistantGuide[1];
  assert.deepEqual(selectGuide([{section:a,score:2},{section:b,score:1}],()=>true),[a]);
  assert.deepEqual(selectGuide([{section:a,score:2},{section:b,score:2}],()=>true),[]);
  assert.deepEqual(suggestions([{section:a,score:1},{section:b,score:1}],s=>s.id===b.id),[b]);
});
test('sin permisos no se seleccionan ni sugieren secciones restringidas',()=>{
  const readable=s=>s.modulo==='general';
  for (const [question] of questions) {
    assert.ok(selectGuide(rank(question),readable).every(readable));
    assert.ok(suggestions(rank(question),readable).every(readable));
  }
  assert.doesNotMatch(noMatchTopics(readable),/Facturación|Nómina|Cuentas por pagar/);
  const topics=noMatchTopics(()=>true);
  assert.equal((topics.match(/^- /gm)||[]).length,6);
  for(const area of ['Ventas','Compras','Inventario','Contabilidad','Personal','Ajustes'])assert.ok(topics.includes(area+':'));
  assert.match(topics,/preguntas rápidas/);
});
test('la guía mantiene estructura, extensión, palabras clave y aviso profesional',()=>{
  assert.equal(new Set(assistantGuide.map(s=>s.id)).size,assistantGuide.length);
  for(const section of assistantGuide) {
    assert.ok(section.texto.length>=600 && section.texto.length<=1400,section.id+' extensión');
    assert.ok(section.palabras_clave.length>=15 && section.palabras_clave.length<=30,section.id+' claves');
    assert.ok(section.texto.split('\n').every(line=>/^\d+\. /.test(line)),section.id+' pasos');
    if(['fiscal','contabilidad','personal','finanzas'].includes(section.modulo))assert.ok(section.texto.endsWith('verifica con tu contador'),section.id);
  }
});

// Exercise the real answer orchestration with isolated dependencies; no database or network.
const source=(await readFile(new URL('../netlify/lib/assistant.mjs',import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
function harness(modules,settings={}) {
  let reservations=0,calls=0;
  const access={company:{assistantEnabled:true},support:false};
  const values={ASSISTANT_ENABLED:'true',...settings};
  const context=vm.createContext({
    rank,selectGuide,suggestions,noMatchTopics,asksOwnFigures,
    Netlify:{env:{get:key=>values[key]}},
    allowed:(_access,module)=>modules.includes(module),
    companyAccess:async()=>access,
    db:{execute:async()=>{reservations++;throw new Error('No debe reservar cupo');}},
    fetch:async()=>{calls++;throw new Error('No debe llamar al proveedor');},
    accessError:message=>{throw new Error(message);},
  });
  vm.runInContext(source+'\nglobalThis.answer = assistantAnswer;',context);
  return {answer:question=>context.answer('company',{}, {question,screen:'panel'}),counts:()=>[reservations,calls]};
}
for(const settings of [{},{ASSISTANT_PROVIDER:'invalid',ASSISTANT_API_KEY:'test-placeholder'}]) {
  test('respuestas de guía sin cupo ni proveedor '+(settings.ASSISTANT_PROVIDER||'sin clave'),async()=>{
    const app=harness([...new Set(assistantGuide.map(s=>s.modulo))],settings);
    for(const [question,id] of questions) {
      const result=await app.answer(question);
      assert.ok(result.answer.includes('**'+assistantGuide.find(s=>s.id===id).titulo+'**'),question);
    }
    assert.deepEqual(app.counts(),[0,0]);
  });
}
test('orquestación rechaza un módulo no autorizado',async()=>{
  const app=harness([]);
  assert.match((await app.answer('Como uso facturación')).answer,/no tiene acceso/);
  assert.deepEqual(app.counts(),[0,0]);
});
test('las cifras propias conservan aviso y no consultan datos',async()=>{
  const app=harness([...new Set(assistantGuide.map(s=>s.modulo))]);
  assert.match((await app.answer('cuánto vendí este mes')).answer,/no consulto datos de tu empresa/);
  assert.deepEqual(app.counts(),[0,0]);
});
