'use strict';
(() => {
  // Only the acknowledgement flag survives a reload. Conversation stays in this closure.
  const privacyKey='acontec-assistant-privacy-v1';
  let acknowledged=false;
  try{acknowledged=localStorage.getItem(privacyKey)==='seen'}catch{}
  let messages=[],identity='',opened=false,pending=false,request=null,generation=0;
  const quick=[
  ["diseno_factura","¿Cómo personalizo mi factura?","1. Abre Edición de factura y pulsa Editar diseño. El dueño puede conceder lectura o escritura desde Accesibilidad; las plantillas no lo conceden automáticamente.\n2. Selecciona el país (solo el dueño) y configura su perfil fiscal, autorización y pie de imprenta opcional; ajusta logo, textos, visibilidad, formato y copias. Nicaragua usa RUC, IVA y autorización DGI; otros países usan etiquetas genéricas editables. Verifica con tu contador los requisitos de tu autoridad tributaria.\n3. Revisa la muestra en vivo y pulsa Guardar diseño. Restablecer valores por defecto prepara los campos sin guardar todavía.\n4. Las facturas emitidas conservan su versión. El historial empieza con la configuración existente y no reconstruye cambios anteriores. Solo el administrador de plataforma cambia el pie Sistema Acontec.\n5. Una devolución completa imprime ANULADA en original y copia, conserva el documento y requiere supervisor. Verifica con tu contador."],
  [
    "facturacion",
    "¿Cómo registro una venta al contado?",
    "1. Abre Facturación y revisa la empresa y la sucursal. Para un pago inmediato, pulsa Abrir turno y completa la apertura antes de emitir.\n2. Pulsa + Crear factura. Revisa Fecha, Turno de caja, Serie / sucursal, cliente y Vencimiento del crédito (visible al marcar Crédito).\n3. Usa + Agregar producto; confirma Producto, Cantidad y Precio unitario sin IVA. Revisa la base, el IVA y el total mostrados.\n4. En Formas de pago marca las pastillas de los métodos usados; Efectivo está marcado al empezar. El último método marcado recibe el saldo restante. Revisa Pendiente por asignar, Recibido y Cambio a dar. Exacto completa el efectivo neto; Completar saldo en efectivo ajusta ese reparto. Recibido no aumenta el pago registrado.\n5. Pulsa Emitir factura y registrar asiento. La factura emitida queda inmutable; Imprimir y Detalle permiten revisarla. Una corrección requiere Anular, con motivo y autorización de supervisor."
  ],
  [
    "facturacion",
    "¿Cómo registro una venta a crédito?",
    "1. Una venta a crédito se prepara en Crear factura, dentro de Facturación, con el cliente identificado y la fecha de Vencimiento del crédito revisada. Agrega los productos, confirma cantidades y precios y revisa IVA y total. En Formas de pago marca Crédito para ver su importe y vencimiento. Exige un cliente real activo, distinto de Cliente general; revisa el límite y crédito disponible.\n2. El reparto completo debe coincidir con el total; no uses un importe inmediato ficticio para simular una venta fiada. Si hay pago inmediato, el flujo requiere un turno abierto. La porción a crédito genera la cuenta por cobrar del cliente.\n3. Cobrar una factura después es una operación diferente de volver a vender el producto: el cobro reduce la deuda y registra el ingreso de dinero.\n4. Ventas incluye Registrar cobro de cliente para los perfiles autorizados. Las pantallas de cuentas por cobrar muestran los documentos y sus abonos según los permisos y el plan.\n5. Verifica siempre el cliente y documento al que se aplica el pago. El Historial del documento permite revisar los movimientos disponibles.\n6. Antigüedad de saldos organiza las deudas según su vencimiento cuando ese módulo está habilitado. El asistente solo explica el procedimiento; no sabe cuánto te debe un cliente ni puede confirmar un cobro."
  ],
  [
    "contabilidad",
    "¿Cómo cobro a un cliente?",
    "1. Abre Cuentas por cobrar. Localiza la factura por cliente, referencia, fecha y vencimiento; revisa Crédito original, Abonado y Deuda.\n2. En la factura pendiente pulsa Cobrar / abonar. Completa Fecha, Abono, la cuenta de dinero y Referencia del pago.\n3. El abono debe ser positivo, no superar el saldo y no tener fecha anterior a la factura. Revisa el documento antes de guardar.\n4. Consulta Historial para revisar los abonos vinculados. No crees otra venta para reflejar el cobro de una venta anterior.\n5. + Factura / saldo inicial es para documentos no registrados en Ventas o Compras; no mueve inventario. El saldo del mayor puede incluir movimientos históricos sin factura vinculada.\n6. verifica con tu contador"
  ],
  [
    "inventario",
    "¿Cómo agrego un producto?",
    "1. Abre Productos e inventario desde Productos o Menú y pulsa + Producto. Revisa código, nombre, unidad, costo, precio, existencia inicial y mínimo. Los códigos identifican productos y los códigos de barras se gestionan dentro de la misma empresa.\n2. El precio y el costo cumplen funciones distintas: el precio sirve para vender y el costo para valorar el inventario y reconocer el costo de venta.\n3. Los precios de catálogo se manejan sin IVA; el impuesto se calcula conforme a la configuración del producto al registrar el documento.\n4. La tabla muestra Existencia y Valor según los permisos del perfil. El aviso junto a un producto señala existencias iguales o inferiores al mínimo.\n5. Editar modifica la ficha; Ajustar es la ruta de corrección de existencias. No presentes un ajuste como una compra si en realidad necesitas registrar la factura del proveedor y su deuda o pago.\n6. El catálogo es compartido por las sucursales y las existencias se consultan por sucursal. Antes de registrar inventario inicial, verifica la sucursal activa y evita cargarlo dos veces. Kardex permite revisar movimientos."
  ],
  [
    "inventario",
    "¿Cómo importo productos?",
    "1. Importar CSV o Excel permite agregar filas sin reemplazar los registros existentes.\n2. Elige el Catálogo disponible para tu perfil: Productos y otros catálogos solo aparecen con su permiso de escritura. Descargar plantilla CSV ayuda a preparar las columnas del catálogo seleccionado.\n3. Revisa Fecha contable y selecciona el archivo CSV o Excel. Pulsa Leer y revisar archivo para ver las filas antes de confirmar.\n4. La opción Revisé las filas y confirmo su importación es obligatoria antes de Importar filas revisadas. Una fila inválida cancela toda la importación; corrige el archivo y revisa otra vez. El límite es 1,000 filas y 5 MB.\n5. Guarda como texto en Excel los códigos que tengan ceros iniciales para evitar que la hoja los elimine. La importación agrega registros y no reemplaza una restauración de respaldo. No repitas existencias iniciales ya registradas, porque podrías duplicar inventario.\n6. Para saldos iniciales se requieren cuentas válidas, importes admitidos y un asiento cuadrado; utiliza ese catálogo únicamente si tienes permisos de contabilidad. Importar clientes o proveedores también exige sus permisos específicos."
  ],
  [
    "compras",
    "¿Cómo registro una compra?",
    "1. En Compras pulsa + Nueva compra. El formulario solicita Fecha, Proveedor y Forma de pago, y permite incluir líneas de productos mediante + Agregar producto.\n2. Revisa cantidades y costos de cada línea antes de confirmar. Una compra incorpora existencias y reconoce la contrapartida de pago o deuda según la forma elegida; no equivale a crear únicamente la ficha del producto.\n3. Los costos base se registran sin IVA y el impuesto depende de la configuración aplicable. Para compras a crédito, revisa la cuenta por pagar y su vencimiento en el flujo de documentos.\n4. El botón Registrar pago a proveedor sirve para los pagos correspondientes; un abono reduce una deuda existente, no registra otra compra.\n5. Conserva la referencia de la factura del proveedor para identificarla y evitar duplicados. Devoluciones y notas de compras ofrece Devolución a proveedor, Nota de débito y Costo de desembarque.\n6. Una devolución conserva el documento original y retira existencias; una nota de débito aumenta la deuda sin duplicar el inventario. El costo de desembarque distribuye costos conforme a las validaciones del sistema."
  ],
  [
    "contabilidad",
    "¿Cómo pago a un proveedor?",
    "1. Abre Cuentas por pagar para localizar la obligación por factura, fecha, vencimiento y proveedor. Compara Crédito original, Abonado y Deuda.\n2. Pulsa Pagar / abonar en el documento pendiente. Completa Fecha, Abono, cuenta de dinero y Referencia del pago; indica el número de comprobante del egreso.\n3. Comprueba que el abono no supere el saldo ni tenga fecha anterior al documento. Confirma únicamente después de revisar el origen del dinero.\n4. Abre Historial para revisar los abonos. Pagar una deuda previa no es registrar otra compra ni reconocer de nuevo el gasto.\n5. El Saldo en el libro mayor puede incluir aperturas o movimientos históricos sin factura vinculada. Revisa la causa de una diferencia antes de cargar un saldo inicial.\n6. verifica con tu contador"
  ],
  [
    "gastos",
    "¿Cómo registro un gasto?",
    "1. En Gastos pulsa + Nuevo gasto. Revisa fecha, concepto, cuenta y forma de pago antes de guardar. Un gasto representa un consumo o servicio y no agrega productos al inventario.\n2. Si recibes mercadería para vender, utiliza Compras; si solo necesitas crear una ficha, utiliza Productos. La clasificación elegida influye en los reportes porque las cuentas de gasto forman parte del resultado del período.\n3. Los importes base se registran sin IVA y el impuesto acreditable depende de la configuración y del documento. No supongas que todo egreso permite crédito fiscal ni que el sistema certifica la deducibilidad del gasto.\n4. Si el gasto queda a crédito, revisa la deuda y registra después el pago correspondiente, evitando duplicar el gasto cuando salga el dinero.\n5. La lista de Gastos puede filtrarse con los controles de período. Comprueba empresa, sucursal, fecha y referencia antes de interpretar el total.\n6. Los permisos de lectura permiten consultar, mientras los de escritura habilitan las acciones admitidas por el rol y plan. Costos y Caja chica son flujos separados con sus propias reglas y comprobantes; no dupliques el mismo gasto en varias pantallas."
  ],
  [
    "facturacion",
    "¿Cómo abro y cierro caja?",
    "1. Abre Facturación y pulsa Abrir turno.\n2. Revisa Fecha, comprobante, Fondo inicial y origen del fondo; confirma con Abrir turno. El fondo se transfiere desde Caja general o Banco, no crea ingresos.\n3. Al terminar, pulsa Cerrar mi turno.\n4. Revisa las formas de pago, Fecha, comprobante, Efectivo contado y Entrega del efectivo. Las diferencias requieren supervisor.\n5. Pulsa Confirmar cierre después de revisar. Resumen permite consultar el turno; cerrar el turno no cierra el mes contable."
  ],
  [
    "finanzas",
    "¿Cómo leo el estado de resultados?",
    "1. Estado de resultados explica el desempeño del período seleccionado. Usa Diario, Semanal, Mensual, Anual, Todo o Rango y confirma las fechas del encabezado.\n2. A diferencia del Balance general, este reporte muestra ingresos, costos y gastos del intervalo. Revisa la sucursal activa: consultar una sucursal no equivale al consolidado de la empresa. Comienza por Ingresos y Total ingresos.\n3. Costo de ventas representa el costo de los productos vendidos; restarlo de los ingresos produce Utilidad bruta. Después lee Gastos de operación y Total gastos. UTILIDAD (PÉRDIDA) NETA es el resultado de restar costos y gastos a los ingresos.\n4. Un importe negativo indica pérdida para el período mostrado. Los reportes se basan en la clasificación de las cuentas y en los registros confirmados. Utilidad no significa dinero disponible: una venta a crédito puede reconocer ingreso sin haber sido cobrada, y una compra puede quedar pendiente de pago.\n5. El IVA registrado en sus cuentas no debe interpretarse automáticamente como ingreso de ventas o gasto. Para comprender el efectivo, consulta Estado de flujo de efectivo; para recursos y deudas, Balance general.\n6. verifica con tu contador"
  ],
  [
    "finanzas",
    "¿Cómo leo el balance?",
    "1. Balance general presenta la situación acumulada de la empresa hasta la fecha final seleccionada. Su encabezado indica Al y la fecha correspondiente. No mide solo las ventas del mes. Antes de comparar saldos, confirma empresa, sucursal y fecha de corte.\n2. Los controles de período determinan esa fecha final, mientras los saldos parten del historial acumulado. Activos reúne recursos y derechos registrados, como efectivo, bancos, inventario y cuentas por cobrar. Pasivos muestra obligaciones frente a terceros.\n3. Patrimonio recoge las cuentas patrimoniales, y Resultado acumulado del ejercicio incorpora el resultado pendiente conforme a los asientos. Total patrimonio suma esas partidas. La comparación final es Total activos frente a PASIVO + PATRIMONIO. El mensaje Activos = Pasivos + Patrimonio indica igualdad contable.\n4. Esa igualdad no certifica la existencia física del inventario ni que todas las deudas estén completas: depende de los registros realizados.\n5. Un activo no es necesariamente dinero disponible; una cuenta por cobrar requiere cobro y el inventario requiere venta. Para analizar el resultado usa Estado de resultados y para entradas o salidas usa Estado de flujo de efectivo.\n6. verifica con tu contador"
  ],
  [
    "sucursales",
    "¿Cómo cambio de sucursal?",
    "1. Abre Menú y usa Cambiar o crear empresa para elegir una empresa disponible. Un colaborador elige su Empresa asignada; no crea empresas desde ese acceso.\n2. Para la sucursal, pulsa Cambiar de sucursal en el menú o el selector junto a la marca. Elige una de las sucursales autorizadas.\n3. Todas las sucursales · consolidado aparece para perfiles autorizados y es una vista de consulta; elige una sucursal concreta para registrar movimientos.\n4. Antes de cambiar, espera a que se confirmen los cambios pendientes. Revisa el nombre de empresa y la sucursal después del cambio.\n5. Para salir usa Salir en el menú. Cerrar el asistente con la cruz solo cierra la ayuda, no la sesión. No compartas la sesión de una cuenta con otras personas."
  ],
  [
    "accesibilidad",
    "¿Cómo creo un colaborador y sus permisos?",
    "1. Accesibilidad es la pantalla de administración de personas, cargos y permisos; no debe confundirse con ajustes visuales del dispositivo.\n2. Crear acceso permite asignar nombre, rol, correo o nombre de usuario, contraseña cuando corresponde, sucursales y permisos por módulo.\n3. Los niveles son ninguno, lectura y escritura. Editar permisos modifica un acceso y Desactivar impide su uso conforme a las reglas del servidor. El rol limita la matriz: dueño y contador pueden ver Ventas; cajero y vendedor trabajan en Facturación.\n4. El supervisor dispone de correcciones autorizadas dentro de su alcance. Un permiso marcado no habilita un módulo excluido por el rol o el plan.\n5. El contador puede abarcar todas las sucursales, mientras otros colaboradores requieren asignaciones. Cambiarlas revoca sesiones anteriores. Los accesos por correo utilizan el registro habitual y la confirmación del correo.\n6. Los usuarios asignados ingresan mediante Ingresar como colaborador. El dueño conserva su acceso protegido. Ajustes y bitácora exigen acceso completo según sus reglas; restaurar requiere escritura completa. No compartas contraseñas ni las escribas en el asistente."
  ],
  [
    "ajustes",
    "¿Cómo hago un respaldo?",
    "1. En Ajustes y respaldo está Descargar respaldo JSON. También existen exportaciones completas y versiones recuperables según permisos.\n2. Conserva una copia antes de una restauración importante. Descargar una copia no cambia la empresa ni confirma que cualquier archivo externo sea compatible.\n3. Las contraseñas y credenciales no forman parte de los respaldos para clientes. Restaurar respaldo exige los permisos completos necesarios y la revisión actual del documento.\n4. El sistema conserva versiones y auditoría, y sincroniza las representaciones contables cuando corresponde. Una restauración no debe utilizarse para saltarse períodos cerrados, permisos o validaciones.\n5. Revisa con cuidado empresa, fecha y contenido de la copia; no confundas importar filas con reemplazar información desde un respaldo. El autoguardado informa su estado y conserva los cambios pendientes en la memoria de la pestaña.\n6. Si se pierde la conexión, evita cerrar la pestaña antes de confirmar el guardado. Un cierre forzado puede perder cambios que nunca llegaron al servidor. Ante un conflicto entre pestañas, el sistema puede pedir conservar cambios locales o descargar la copia local y usar la nube."
  ],
  [
    "contabilidad",
    "¿Cómo cierro el mes?",
    "1. Abre Cierres y períodos y confirma la sucursal. Revisa los reportes y conserva un respaldo antes de cerrar.\n2. El dueño pulsa Cerrar mes. En Cerrar período selecciona Mes e indica Motivo para la bitácora; revisa la confirmación antes de continuar.\n3. La tabla muestra Período, Sucursal, Estado y Motivo. Un mes cerrado bloquea altas, modificaciones y anulaciones de asientos.\n4. Para corregir un período cerrado, el dueño utiliza Reabrir e indica el motivo. No cambies fechas para eludir el bloqueo.\n5. Cerrar ejercicio es otra operación confirmada: traslada resultados a utilidades acumuladas y cierra los meses de la sucursal. Revisa sus efectos antes de aceptar; cerrar una pestaña no cierra el mes contable.\n6. verifica con tu contador"
  ],
  [
    "facturacion",
    "¿Cómo anulo una factura?",
    "1. Abre Facturación y localiza el documento emitido. Las facturas no se editan directamente: se corrigen con una nota de crédito autorizada.\n2. El perfil supervisor autorizado utiliza Anular en la lista de ventas para abrir Anular factura. Si la acción no aparece, consulta al dueño; el asistente no concede esa autorización.\n3. En Anular factura revisa Fecha y elige Anulación total, marcada por defecto, o Devolución parcial para ajustar las cantidades por producto. Elige el motivo con las pastillas; Detalle del motivo aparece solo con Otro. La anulación total devuelve todas las cantidades pendientes.\n4. Revisa siempre Se reduce la cuenta por cobrar y Se devuelve en dinero. Solo si hay dinero que devolver aparecen Efectivo, Tarjeta y Transferencia y el turno; se usa tu turno abierto y el selector aparece con varios turnos disponibles. Pulsa Autorizar nota de crédito después de revisar.\n5. La nota conserva la factura y revierte los conceptos de las cantidades devueltas. Revisa el estado ANULADA (con sello en original y copia) o Devolución parcial; no registres otro cobro para simular la corrección."
  ]
];
const assistantQuick=()=>{const profile=globalThis.AcontecProfiles?.get(CO?.businessType);return profile&&profile.id!=='comercio'?[...profile.quickQuestions.map(([module,label,answer])=>[module,label,CO?.billingPlan?.id==='facturacion'?answer.replace(' Usa Más módulos para consultar otras herramientas.',''):answer]),...quick]:quick;};
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
  const typeFocus=()=>{try{if(!matchMedia('(pointer:coarse)').matches)document.getElementById('assistant-question')?.focus()}catch{}};
  function draw(){
    if(!ready()){reset();return}
    const root=document.getElementById('assistant-sheet');if(!root)return;
    root.hidden=!opened;
    document.querySelector('[data-assistant="open"]')?.setAttribute('aria-expanded',String(opened));
    root.innerHTML=`<header class="assistant-head"><div><span class="assistant-eyebrow">GUÍA DE USO</span><h2 id="assistant-title">Pregúntale a Acontec</h2></div><button type="button" class="assistant-icon" data-assistant="close" aria-label="Cerrar asistente">×</button></header>
      <p class="assistant-intro">Solo orientación. No consulta tus cifras ni realiza cambios.</p>
${!acknowledged?'<div class="assistant-privacy"><p>Solo si el sitio tiene una clave de IA configurada y un proveedor válido, tu pregunta y hasta 4 mensajes se envían a ese proveedor. Sin clave, responde nuestra guía sin IA ni cupo diario. No escribas datos contables, personales ni contraseñas. La conversación vive solo en esta pantalla.</p><a href="/privacidad.html" target="_blank" rel="noopener">Privacidad</a> <button type="button" class="btn ghost" id="assistant-privacy-accept" data-assistant="privacy">Entendido</button></div>':''}
      <div class="assistant-body"><div class="assistant-chips" aria-label="Preguntas rápidas sin IA">${assistantQuick().map(([module,label],index)=>permission(module)?`<button type="button" data-assistant="quick" data-index="${esc(index)}" ${pending||!acknowledged?'disabled':''}>${esc(label)}</button>`:'').join('')}</div>
      <div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversación de ayuda">${messages.map(message=>`<article class="assistant-message ${message.role==='user'?'assistant-user':''}"><b>${esc(message.role==='user'?'Tú':'Acontec')}</b>${format(message.content)}</article>`).join('')}${pending?'<p role="status">Consultando la guía…</p>':''}</div></div>
      <form id="assistant-form"><label for="assistant-question">Tu pregunta sobre Acontec</label><textarea id="assistant-question" name="question" maxlength="400" rows="2" placeholder="¿Cómo uso…?" required ${pending||!acknowledged?'disabled':''}></textarea><div class="assistant-form-foot"><small>Máx. 400 caracteres · Con IA: 20 al día por usuario</small><button class="btn" ${pending||!acknowledged?'disabled':''}>Enviar</button></div></form>
      <footer class="assistant-footer"><span>Las preguntas rápidas no consumen IA.</span><button type="button" class="lk" data-assistant="clear">Limpiar conversación</button></footer>`;
    root.querySelector('#assistant-form').addEventListener('submit',send);
    geometry();const body=root.querySelector('.assistant-body');const message=messages[messages.length-1],last=body.querySelector('.assistant-message:last-of-type');
    if(message?.role==='assistant'&&!pending&&last)body.scrollTop+=last.getBoundingClientRect().top-body.getBoundingClientRect().top-8;else body.scrollTop=body.scrollHeight;
  }
  function show(){if(!ready())return;opened=true;draw();if(acknowledged)typeFocus();else document.getElementById('assistant-privacy-accept')?.focus()}
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
      if(turn===generation&&key===context()){pending=false;request=null;if(ready()){draw();if(opened)typeFocus()}}
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
    if(data.id==='privacidad'&&article?.isConnected)article.insertAdjacentHTML('beforeend','<p>'+esc('Asistente de ayuda opcional: solo si el sitio tiene una clave de IA configurada y un proveedor válido, envía tu pregunta y hasta cuatro mensajes recortados a Anthropic, junto con hasta tres secciones de guía y la pantalla Panel. Sin clave o con proveedor no válido responde desde nuestra guía, sin envío a IA ni consumo de cupo. No consulta ni envía datos contables de la empresa. No compartas datos personales ni credenciales. La conversación permanece solo en pantalla; guardamos únicamente metadatos de uso cuando se intenta una llamada a IA y en el navegador que viste el aviso. Puedes limpiar el chat; el dueño puede desactivar la función en Ajustes y respaldo.')+'</p>');
  };
  const settings=V.ajustes;
  V.ajustes=async function(){
    const id=CO.id;await settings();
    if(R!=='ajustes'||CO?.id!==id||!CO.owner||CO.support||!CO.assistantGlobalEnabled||!permission('ajustes',true))return;
    document.getElementById('main').insertAdjacentHTML('afterbegin',`<section class="card assistant-settings"><h3>Asistente de ayuda</h3><p>Guía de uso sin acceso a cifras. Desactivado por defecto. Sin IA, responde desde la guía sin cupo diario. Con IA: máximo 20 preguntas por usuario y 100 por empresa al día.</p><form id="assistant-settings-form"><label class="ck"><input type="checkbox" name="enabled" ${CO.assistantEnabled?'checked':''}> Activar Pregúntale a Acontec en el Panel</label><label>Zona horaria del límite diario<input name="timeZone" maxlength="80" required value="${esc(CO.assistantTimeZone||'America/Managua')}" placeholder="America/Managua"></label><p class="mut">Usa la zona de tu empresa; por ejemplo, America/Managua. El cambio conserva el consumo ya registrado para cada fecha.</p><p class="err" role="status"></p><button class="btn">Guardar configuración del asistente</button></form></section>`);
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
      case'privacy':acknowledged=true;try{localStorage.setItem(privacyKey,'seen')}catch{}draw();typeFocus();break;
      case'clear':request?.abort();generation++;pending=false;messages=[];draw();typeFocus();break;
      case'quick':{
        if(!ready()||!acknowledged||pending)return;
        const item=assistantQuick()[Number(button.dataset.index)];if(!item||!permission(item[0]))return;
        messages.push({role:'user',content:item[1]},{role:'assistant',content:item[2]});draw();break;
      }
    }
    const trigger=document.querySelector('[data-assistant="open"]');trigger?.setAttribute('aria-expanded',String(opened));
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&opened){event.preventDefault();close()}
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.target.id==='assistant-question'){
      event.preventDefault();if(event.target.value.trim())event.target.form.requestSubmit();
    }
  });
  addEventListener('resize',geometry);window.visualViewport?.addEventListener('resize',geometry);
  if(typeof ResizeObserver==='function')new ResizeObserver(geometry).observe(document.body);
})();
