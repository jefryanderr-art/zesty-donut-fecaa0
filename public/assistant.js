'use strict';
(() => {
  // Only the acknowledgement flag survives a reload. Conversation stays in this closure.
  const privacyKey='acontec-assistant-privacy-v1';
  let acknowledged=false;
  try{acknowledged=localStorage.getItem(privacyKey)==='seen'}catch{}
  let messages=[],identity='',opened=false,pending=false,request=null,generation=0;
  const quick=[
    ['facturacion','¿Cómo registro una venta?','1. Abre Facturación y pulsa Abrir turno si hay pago inmediato.\n2. Pulsa + Crear factura.\n3. Revisa fecha, cliente y serie; agrega productos y confirma cantidades y precios sin IVA.\n4. Revisa IVA y total; distribuye Pago mixto.\n5. Pulsa Emitir factura y registrar asiento. Una corrección posterior requiere Nota de crédito autorizada.'],
    ['facturacion','¿Cómo registro una venta a crédito?','1. Abre Facturación y pulsa + Crear factura.\n2. Identifica al cliente y revisa Vencimiento del crédito.\n3. Agrega productos y revisa cantidades, precios sin IVA, impuesto y total.\n4. En Pago mixto indica la parte a crédito y cualquier pago inmediato; este requiere turno abierto.\n5. Revisa el reparto y pulsa Emitir factura y registrar asiento. El cobro posterior reduce la deuda; no es otra venta.\n\nverifica con tu contador'],
    ['inventario','¿Cómo agrego productos?','1. Abre Productos e inventario y pulsa + Producto.\n2. Revisa código, nombre, unidad, costo y precio sin IVA.\n3. Indica existencia inicial y mínimo cuando corresponda.\n4. Revisa la sucursal y guarda con el botón del formulario.\n5. No repitas inventario inicial ya registrado. Usa Compras para ingresar mercadería comprada después.'],
    ['compras','¿Cómo registro una compra?','1. Abre Compras y pulsa + Nueva compra.\n2. Revisa Fecha, Proveedor y Forma de pago.\n3. Usa + Agregar producto para completar las líneas.\n4. Revisa cantidades, costos sin IVA, impuesto y total antes de confirmar.\n5. Si queda deuda, el pago posterior debe aplicarse al documento; no registres otra compra.\n\nverifica con tu contador'],
    ['finanzas','¿Cómo leo el estado de resultados?','1. Abre Estado de resultados y elige el período.\n2. Revisa Total ingresos.\n3. Resta Costo de ventas para comprender Utilidad bruta.\n4. Revisa Total gastos y UTILIDAD (PÉRDIDA) NETA.\n5. Una utilidad no equivale a efectivo: puede incluir ventas pendientes de cobro. Confirma empresa y sucursal.\n\nverifica con tu contador'],
  ];
  const assistantQuick=()=>{const profile=globalThis.AcontecProfiles?.get(CO?.businessType);return profile&&profile.id!=='comercio'?[...profile.quickQuestions.map(([module,label,answer])=>[module,label,answer]),...quick]:quick;};
  const ready=()=>!!U&&!!CO&&R==='panel'&&!HOME&&CO.assistantAvailable&&!CO.support;
  const context=()=>[U?.email,CO?.id,CO?.memberId,CO?.branchId].join(':');
  function reset(){request?.abort();request=null;messages=[];opened=false;pending=false;generation++;document.getElementById('assistant-sheet')?.remove()}
  // Escape before applying a deliberately tiny formatting grammar. No HTML/links from AI.
  function format(text){
    const bold=line=>esc(line).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
    let type='',html='';
    for(const line of String(text).split('\n')){
      const match=line.match(/^\s*(?:(\d+)[.)]|([-*]))\s+(.+)$/),next=match?(match[1]?'ol':'ul'):'';
      if(type&&type!==next){html+='</'+type+'>';type=''}
      if(next){if(!type){type=next;html+='<'+type+'>'}html+='<li>'+bold(match[3])+'</li>'}
      else if(line.trim())html+='<p>'+bold(line)+'</p>';
    }
    return html+(type?'</'+type+'>':'');
  }
  function geometry(){
    const sheet=document.getElementById('assistant-sheet');if(!sheet)return;
    const nav=document.querySelector('.bnav'),rect=nav?.getBoundingClientRect(),navBottom=rect&&nav.getClientRects().length?Math.max(0,innerHeight-rect.top):0;
    const keyboard=window.visualViewport?Math.max(0,innerHeight-visualViewport.height-visualViewport.offsetTop):0;
    sheet.style.setProperty('--assistant-bottom',Math.max(navBottom,keyboard)+12+'px');
  }
  function draw(){
    if(!ready()){reset();return}
    const root=document.getElementById('assistant-sheet');if(!root)return;
    root.hidden=!opened;
    document.querySelector('[data-assistant="open"]')?.setAttribute('aria-expanded',String(opened));
    root.innerHTML=`<header class="assistant-head"><div><span class="assistant-eyebrow">GUÍA DE USO</span><h2 id="assistant-title">Pregúntale a Acontec</h2></div><button type="button" class="assistant-icon" data-assistant="close" aria-label="Cerrar asistente">×</button></header>
      <p class="assistant-intro">Solo orientación. No consulta tus cifras ni realiza cambios.</p>
      ${!acknowledged?'<div class="assistant-privacy"><p>Tu pregunta y hasta 4 mensajes se envían a un proveedor de IA. No escribas datos contables, personales ni contraseñas. La conversación vive solo en esta pantalla.</p><a href="/privacidad.html" target="_blank" rel="noopener">Privacidad</a> <button type="button" class="btn ghost" id="assistant-privacy-accept" data-assistant="privacy">Entendido</button></div>':''}
      <div class="assistant-chips" aria-label="Preguntas rápidas sin IA">${assistantQuick().map(([module,label],index)=>permission(module)?`<button type="button" data-assistant="quick" data-index="${esc(index)}" ${pending||!acknowledged?'disabled':''}>${esc(label)}</button>`:'').join('')}</div>
      <div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversación de ayuda">${messages.map(message=>`<article class="assistant-message ${message.role==='user'?'assistant-user':''}"><b>${esc(message.role==='user'?'Tú':'Acontec')}</b>${format(message.content)}</article>`).join('')}${pending?'<p role="status">Consultando la guía…</p>':''}</div>
      <form id="assistant-form"><label for="assistant-question">Tu pregunta sobre Acontec</label><textarea id="assistant-question" name="question" maxlength="400" rows="2" placeholder="¿Cómo uso…?" required ${pending||!acknowledged?'disabled':''}></textarea><div class="assistant-form-foot"><small>Máx. 400 caracteres · 20 al día por usuario</small><button class="btn" ${pending||!acknowledged?'disabled':''}>Enviar</button></div></form>
      <footer class="assistant-footer"><span>Las preguntas rápidas no consumen IA.</span><button type="button" class="lk" data-assistant="clear">Limpiar conversación</button></footer>`;
    root.querySelector('#assistant-form').addEventListener('submit',send);
    geometry();const log=root.querySelector('.assistant-messages');log.scrollTop=log.scrollHeight;
  }
  function show(){if(!ready())return;opened=true;draw();document.getElementById(acknowledged?'assistant-question':'assistant-privacy-accept')?.focus()}
  function close(){opened=false;draw();document.querySelector('[data-assistant="open"]')?.setAttribute('aria-expanded','false');document.querySelector('[data-assistant="open"]')?.focus()}
  async function send(event){
    event.preventDefault();if(pending||!ready()||!acknowledged)return;
    const question=event.target.elements.question.value.trim();if(!question||question.length>400)return;
    const history=messages.slice(-4).map(message=>({role:message.role,content:message.content.slice(0,500)})),companyId=CO.id,key=context(),turn=++generation;
    messages.push({role:'user',content:question});pending=true;request=new AbortController();draw();
    try{
      // Independent of the accounting retry queue: exactly one attempt, never replayed.
      const response=await fetch('/api/assistant?c='+encodeURIComponent(companyId),{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},signal:request.signal,body:JSON.stringify({question,history,screen:'panel'})});
      const result=await response.json();
      if(turn!==generation||key!==context()||!ready())return;
      messages.push({role:'assistant',content:response.ok&&typeof result.answer==='string'?result.answer:result.error||'No pude consultar la guía. Inténtalo más tarde.'});
      if(response.status===403||response.status===404){CO.assistantAvailable=false;reset();document.getElementById('assistant-entry')?.remove();return}
    }catch(error){
      if(turn===generation&&key===context()&&ready()&&error.name!=='AbortError')messages.push({role:'assistant',content:'No hay conexión con la ayuda. Usa las preguntas rápidas o vuelve a intentarlo más tarde.'});
    }finally{
      if(turn===generation&&key===context()){pending=false;request=null;if(ready()){draw();if(opened)document.getElementById('assistant-question')?.focus()}}
    }
  }
  const panel=V.panel;
  V.panel=function(){
    const key=context();if(identity!==key){reset();identity=key}
    panel();if(!ready())return;
    const anchor=document.querySelector('#main > .hero, #main > .ph')||document.getElementById('main').firstElementChild;
    anchor.insertAdjacentHTML('afterend','<section class="card assistant-entry noprint" id="assistant-entry"><div><span class="assistant-eyebrow">APRENDE A USAR TU SISTEMA</span><h3>Una guía, paso a paso</h3><p>Desde tu primera factura hasta la lectura de reportes.</p></div><button type="button" class="btn" data-assistant="open" aria-controls="assistant-sheet" aria-expanded="false">Pregúntale a Acontec <span aria-hidden="true">↗</span></button></section><aside id="assistant-sheet" class="assistant-sheet noprint" role="dialog" aria-labelledby="assistant-title" hidden></aside>');
    draw();
  };
  const previousChrome=chrome;
  chrome=function(){if(R!=='panel'||!CO||identity!==context()||!CO.assistantAvailable||CO.support)reset();previousChrome()};
  for(const action of ['logout','switch','opencomp']){
    const original=ACT[action];if(original)ACT[action]=function(...args){reset();return original.apply(this,args)};
  }
  // Supplement the published privacy document without replacing its approved text.
  const policy=ACT.policy;
  ACT.policy=async function(data,...args){
    const result=policy.call(this,data,...args),article=document.querySelector('#modal article');
    await result;
    if(data.id==='privacidad'&&article?.isConnected)article.insertAdjacentHTML('beforeend','<p>'+esc('Asistente de ayuda opcional: envía tu pregunta y hasta cuatro mensajes recortados a Anthropic, junto con hasta tres secciones de guía y la pantalla Panel. No consulta ni envía datos contables de la empresa. No compartas datos personales ni credenciales. La conversación permanece solo en pantalla; guardamos únicamente metadatos de uso y en el navegador que viste el aviso. Puedes limpiar el chat; el dueño puede desactivar la función en Ajustes y respaldo.')+'</p>');
  };
  const settings=V.ajustes;
  V.ajustes=async function(){
    const id=CO.id;await settings();
    if(R!=='ajustes'||CO?.id!==id||!CO.owner||CO.support||!CO.assistantGlobalEnabled||!permission('ajustes',true))return;
    document.getElementById('main').insertAdjacentHTML('afterbegin',`<section class="card assistant-settings"><h3>Asistente de ayuda</h3><p>Guía de uso sin acceso a cifras. Desactivado por defecto. Máximo 20 preguntas por usuario y 100 por empresa al día.</p><form id="assistant-settings-form"><label class="ck"><input type="checkbox" name="enabled" ${CO.assistantEnabled?'checked':''}> Activar Pregúntale a Acontec en el Panel</label><label>Zona horaria del límite diario<input name="timeZone" maxlength="80" required value="${esc(CO.assistantTimeZone||'America/Managua')}" placeholder="America/Managua"></label><p class="mut">Usa la zona de tu empresa; por ejemplo, America/Managua. El cambio conserva el consumo ya registrado para cada fecha.</p><p class="err" role="status"></p><button class="btn">Guardar configuración del asistente</button></form></section>`);
    document.getElementById('assistant-settings-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;
      try{
        if(!await flush())throw new Error('Guarda primero los cambios pendientes.');
        if(CO?.id!==id||R!=='ajustes')return;
        const result=await api('assistant-settings?c='+encodeURIComponent(id),'POST',{revision:REV,enabled:form.elements.enabled.checked,timeZone:form.elements.timeZone.value.trim()});
        if(CO?.id!==id)return;
        REV=result.revision;CO.assistantEnabled=result.enabled;CO.assistantTimeZone=result.timeZone;CO.assistantAvailable=result.enabled&&CO.assistantGlobalEnabled;
        reset();form.querySelector('.err').textContent='Configuración guardada.';
      }catch(error){form.querySelector('.err').textContent=error.message||'No se pudo guardar la configuración.'}
      finally{button.disabled=false}
    });
  };
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-assistant]');if(!button)return;
    switch(button.dataset.assistant){
      case'open':show();break;
      case'close':close();break;
      case'privacy':acknowledged=true;try{localStorage.setItem(privacyKey,'seen')}catch{}draw();document.getElementById('assistant-question')?.focus();break;
      case'clear':request?.abort();generation++;pending=false;messages=[];draw();document.getElementById('assistant-question')?.focus();break;
      case'quick':{
        if(!ready()||!acknowledged||pending)return;
        const item=assistantQuick()[Number(button.dataset.index)];if(!item||!permission(item[0]))return;
        messages.push({role:'user',content:item[1]},{role:'assistant',content:item[2]});draw();break;
      }
    }
    const trigger=document.querySelector('[data-assistant="open"]');trigger?.setAttribute('aria-expanded',String(opened));
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();close()}});
  addEventListener('resize',geometry);window.visualViewport?.addEventListener('resize',geometry);
  if(typeof ResizeObserver==='function')new ResizeObserver(geometry).observe(document.body);
})();
