'use strict';
(() => {
  // Only the acknowledgement flag survives a reload. Conversation stays in this closure.
  const privacyKey='acontec-assistant-privacy-v1';
  let acknowledged=false;
  try{acknowledged=localStorage.getItem(privacyKey)==='seen'}catch{}
  let messages=[],identity='',opened=false,pending=false,request=null,generation=0;
  const quick=[
["cartera", "¿Cómo evalúo y cobro un préstamo?", "1. Abre Créditos otorgados / cartera, crea el borrador y consulta Simulador de cuotas. Evalúa ingresos, deudas, garantía y fiador; el dueño aprueba antes del desembolso nuevo. 2. Cobrar cuota registra Caja o Banco y permite imprimir cada recibo desde Detalle. 3. Gestión de cobranza conserva gestor, llamadas, visitas y promesas; Mora e informes muestra recuperación y provisión sugerida. Los avisos son internos; verifica con tu contador."],
['reservas','¿Cómo opero habitaciones, limpieza y consumos?','1. En Reservas y ocupación usa Habitaciones y estancias para agregar unidades y reservar una habitación o grupo. 2. Registra al huésped; la entrada exige habitación lista. Agrega consumos a la ficha y factura con el contexto de habitación existente. La salida crea una tarea de limpieza. 3. Consulta ocupación, ADR y RevPAR o confirma el cierre diario. El calendario iCal comparte solo fechas ocupadas. Verifica con tu contador.'],
['contratos','¿Cómo separo la garantía y habilito al inquilino?','1. Vincula la unidad desde Contrato y firma y configura renovación y ajuste. 2. Garantía separada registra un pasivo; factura daños antes de aplicarla al saldo. 3. El dueño habilita Acceso del inquilino para un correo. El enlace exige iniciar sesión con ese correo y permite consultar contrato, movimientos y solicitudes. Los avisos son internos y cada factura se confirma. Verifica con tu contador.'],
['documentos_venta','¿Cómo uso precios y reposición en comercio?','1. Abre Operación de comercio. El dueño configura presentaciones, listas, mínimos, máximos y temporadas por sucursal. 2. En factura prepara la línea por presentación o peso con tara. Las promociones requieren autorización. 3. Revisa la sugerencia por proveedor y confirma su orden y recepción en Cotizaciones y órdenes. Verifica con tu contador.'],
['documentos_venta','¿Cómo reservo un pedido o cambio una talla?','1. Crea el pedido en Operación de comercio y registra el anticipo desde su ficha; solo el anticipo completo reserva existencias. 2. Factura una sola vez para aplicar el anticipo. 3. Para un cambio, registra la nota de crédito con vale de cambio y factura la nueva variante canjeando el vale. Verifica con tu contador.'],
["facturacion", "¿Cómo canjeo una tarjeta de regalo?", "1. En Crear factura abre Tarjetas, vales y lealtad. 2. Selecciona la tarjeta y activa su forma de pago; asigna el importe y completa con otro medio si hace falta. 3. En facturas desde fichas también puedes consultar y autorizar lealtad. Confirma una sola factura. El canje reduce el pasivo y la nota de crédito restituye el saldo utilizado. Verifica con tu contador."],
["cuentas_abiertas", "¿Cómo recibo una reserva de mesa?", "1. Abre Mesas y reservas en Cuentas abiertas. 2. Selecciona Recibir y abrir cuenta en la reserva. 3. Agrega consumos desde la cuenta; la reserva no emite factura al llegar."],
["produccion", "¿Dónde registro una hornada?", "1. En Producción abre Hornadas y mostrador. 2. Selecciona una receta y registra unidades, merma y motivo; revisa los insumos. 3. Con vencimiento se crea el lote terminado. Las etiquetas usan los ingredientes y alérgenos declarados. Verifica con tu contador."],

    ["ajustes","¿Cómo completo el perfil inicial de mi empresa?","1. En Completa tu empresa confirma nombre, modelo de negocio, país, moneda e identificación. Google autentica antes de crear la empresa. Si interrumpes el formulario, vuelve a ingresar y complétalo.\n2. Un perfil pendiente conserva sus datos. Cuando hay movimientos, se conserva el plan de cuentas. Verifica con tu contador.\n3. Si no se puede abrir la empresa, utiliza Reintentar y conserva el código de soporte si aparece; evita duplicar operaciones."],
["declaraciones", "¿Cómo uso declaraciones y paquete del período?", "Abre Fiscal y selecciona Declaraciones. El dueño activa este módulo con confirmación y motivo; el interruptor de Cierre anual permanece independiente. Selecciona un mes, trimestre o año. La consulta necesita lectura de todas las fuentes del paquete y una sucursal autorizada. Si falta acceso, revisa permisos y plan.\nConfigura la plantilla de país al final de la misma pantalla. Nicaragua incluye estructura, sin tasas ni vencimientos oficiales. El contador agrega fuente, vigencia, entidad, canal y reglas. Guarda una nueva versión o importa JSON. Revisa cada cifra y abre sus documentos de origen antes de preparar. Los borradores y las preparadas consultan los datos actuales; una presentada conserva sus cifras y avisa diferencias posteriores.\nPara marcar presentada, registra referencia, fecha y comprobante. El pago exige otro comprobante, banco, fecha e importe. Una rectificativa crea una versión vinculada. Descargar todo prepara PDF, Excel, CSV y adjuntos en un ZIP con manifiesto; los faltantes se indican. El sistema no presenta electrónicamente. Los archivos son borradores de apoyo: verifica con tu contador."],
["cierre_anual", "¿Cómo uso cierre anual automático y apertura?", "Abre Fiscal y selecciona Cierre anual. El dueño activa este módulo con motivo y confirmación, aunque Declaraciones permanezca apagado. Selecciona un año terminado y una sucursal. La consulta exige lectura de las fuentes contables del paquete. El cierre requiere al dueño o contador con escritura contable.\nCompleta el checklist F4.7 anual y revisa conciliaciones, nómina, depreciaciones, provisiones e impuestos. Los ejercicios anteriores con movimientos deben estar cerrados. Revisa la vista previa: cierre de ingresos, costos y gastos, traspaso a utilidades acumuladas y apertura del siguiente año. Confirma con motivo únicamente después de comprobar el cuadre. Antes de guardar se conserva un respaldo completo y se prepara el paquete anual.\nLa apertura sustituye la acumulación anterior desde su fecha; no elimina movimientos posteriores. Las empresas sin cierre automático mantienen su cálculo histórico. Los doce meses quedan bloqueados. Solo el dueño reabre con motivo: se agregan contrasientos y se conserva el historial. El mismo año no admite otra ejecución automática; los ajustes requieren revisión contable. Descarga respaldo y paquete desde esta pantalla y verifica con tu contador."],
['inventario',uiT('fifo.quickQuestion','¿Cómo activo PEPS y consulto sus capas?'),uiT('fifo.quickAnswer','1. En Productos e inventario, el dueño abre Método de costeo, selecciona PEPS, escribe el motivo y confirma. Promedio ponderado sigue seleccionado hasta ese cambio.\n2. Capas PEPS muestra cantidades y valores. Solo afecta operaciones futuras; las existencias actuales forman las capas iniciales. Las devoluciones requieren una venta con capas de origen.\n3. Traslados, lotes, series, recetas, consumibles y revalorizaciones quedan bloqueados por falta de trazabilidad compatible. Una diferencia de inventario rechaza el guardado completo. Verifica con tu contador.')],
['cobranza',uiT('clients.quickQuestion','¿Cómo apruebo un recordatorio de cobro?'),uiT('clients.quickAnswer','1. Abre Gestión de cobranza. 2. Genera propuestas. 3. Revisa cada deuda y aprueba individualmente el envío; no se envía al generar. Verifica con tu contador.')],
["suscripciones",uiT("recurring.quickQuestion","¿Cómo confirmo una suscripción del cliente?"),uiT("recurring.quickAnswer","1. Abre Suscripciones y facturación recurrente. El dueño crea el plan del cliente con periodicidad y motivo. Revisa precio, IVA y sucursal.\n2. Vista previa de emisión muestra el prorrateo; confirma para emitir a crédito. Los anticipos se aplican sin cargos automáticos. Pausar o cancelar un período emitido requiere confirmar su nota de crédito; reanudar empieza en el siguiente período.\n3. Reconocer ingreso crea un asiento solo cuando lo confirmas. Consulta MRR, ARR, churn y antigüedad, o descarga PDF/CSV. Verifica con tu contador.")],
["inventario",uiT("serviceCatalog.quickQuestion","¿Cómo configuro duración, paquetes y consumibles?"),uiT("serviceCatalog.quickAnswer","1. Crea el servicio y pulsa Editar y Configurar características del servicio. Activa la ampliación, configura duración, unidad, IVA o exención con motivo y comisión; confirma con un motivo del cambio.\n2. Un paquete contiene servicios sin paquetes anidados y utiliza su propio precio. Los consumibles requieren artículos inventariables con stock libre en la sucursal. No se consumen automáticamente lotes, series o producción.\n3. Al emitir, confirma la prestación y sus consumibles. El costo queda vinculado a la factura; la reposición requiere recuperar los insumos y confirmarla al devolver todos los servicios. Las comisiones individuales requieren Personal y no generan pagos ni nómina automáticamente. Verifica con tu contador.")],
["proyectos", "¿Cómo controlo una obra y su garantía?", "1. En Órdenes de trabajo y proyectos crea una obra y aprueba códigos y presupuesto como dueño. 2. Registra costos, compras, cambios aprobados y avance. Factura cada etapa a crédito dentro del avance del contrato. 3. Retener y Liberar reclasifican la garantía; cobra desde Cuentas por cobrar. Subcontratistas separa contrato, devengo y pago. Verifica con tu contador."],
["lotes", "¿Cómo registro parcelas, ganado y cosechas?", "1. En Lotes y vencimientos crea parcela, ciclo o animal. 2. Registra labores, suelo, pérdidas con causa, tareas, mantenimiento y costos. Cosecha trazable agrega lote y existencias a costo de catálogo con contrapartida confirmada. 3. Venta a acopiador respeta el ciclo y FEFO. Informe del rubro muestra rendimiento por hectárea y equilibrio; la bitácora no mueve stock automáticamente. Verifica con tu contador."],
["produccion", "¿Cómo produzco por pedido con control de calidad?", "1. Crea recetas de producto y subensambles; configura Ruta de producción y Orden contra pedido. 2. Revisa MRP e inicia para consumir materiales y reconocer producto en proceso. Añade costos reales sin repetir gastos anteriores y completa los pasos. 3. Registra inspecciones y termina con unidades buenas, rechazos, merma y lote trazable. No admite PEPS ni series. Verifica con tu contador."],
  ["diseno_factura","¿Cómo personalizo mi factura?","1. Abre Edición de factura y pulsa Editar diseño. El dueño puede conceder lectura o escritura desde Accesibilidad; las plantillas no lo conceden automáticamente.\n2. Selecciona el país (solo el dueño) y configura su perfil fiscal, autorización y pie de imprenta opcional; ajusta logo, textos, visibilidad, formato y copias. Nicaragua usa RUC, IVA y autorización DGI; otros países usan etiquetas genéricas editables. Verifica con tu contador los requisitos de tu autoridad tributaria.\n3. Revisa la muestra en vivo y pulsa Guardar diseño. Restablecer valores por defecto prepara los campos sin guardar todavía.\n4. Las facturas emitidas conservan su versión. El historial empieza con la configuración existente y no reconstruye cambios anteriores. Solo el administrador de plataforma cambia el pie Sistema Acontec.\n5. Una devolución completa imprime ANULADA en original y copia, conserva el documento y requiere supervisor. Verifica con tu contador."],
  [
    "facturacion",
    "¿Cómo registro una venta al contado?",
    "1. Abre Facturación y revisa la empresa y la sucursal. Para un pago inmediato, pulsa Abrir turno y completa la apertura antes de emitir.\n2. Pulsa + Crear factura. Revisa Fecha, Turno de caja, Serie / sucursal, cliente y Vencimiento del crédito (visible al marcar Crédito).\n3. Usa + Agregar producto para buscar por nombre, código o código de barras. Toca una fila o escanea; cada repetición suma una unidad. Revisa En la factura (editable) y pulsa Listo. Cancelar descarta la selección provisional. Confirma Cantidad y Precio unitario sin IVA. Revisa la base, el IVA y el total mostrados.\n4. En Formas de pago marca las pastillas de los métodos usados; Efectivo está marcado al empezar. El último método marcado recibe el saldo restante. Revisa Pendiente por asignar, Recibido y Cambio a dar. Exacto completa el efectivo neto; Completar saldo en efectivo ajusta ese reparto. Recibido no aumenta el pago registrado.\n5. Pulsa Emitir factura y registrar asiento. La factura emitida queda inmutable; Imprimir y Detalle permiten revisarla. Una corrección requiere Anular, con motivo y autorización de supervisor."
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
    "1. Accesibilidad administra personas, cargos y permisos de la empresa seleccionada. Solo el dueño o un cargo con Administrar accesos puede abrirla; ocultar la pantalla no sustituye la validación de la API.\n2. En Cargos y permisos, pulsa + Nuevo cargo, escribe nombre y descripción corta y marca Ver, Crear, Editar o Borrar en los módulos existentes. Para modificar se requiere Ver. El plan y las protecciones contables siguen aplicándose.\n3. Los permisos especiales incluyen autorizar descuentos y correcciones, administrar ventas y caja y acceder a todas las sucursales. Los descuentos conservan la contraseña del dueño y sus controles actuales; conceder un permiso no sustituye las confirmaciones contables.\n4. Crear acceso permite seleccionar un cargo, indicar nombre, correo o usuario, contraseña y sucursales. Los cinco cargos iniciales se conservan como plantillas editables. Los accesos anteriores conservan exactamente sus diferencias individuales, señaladas como excepciones; no se reemplazan automáticamente al editar un cargo.\n5. Editar permisos permite conservar esas excepciones, usar los permisos del cargo o definir otras. Confirma antes de reemplazarlas. Los cambios de acceso cierran sus sesiones anteriores. Al borrar un cargo personalizado con personas asignadas, selecciona otro cargo y confirma la reasignación.\n6. El dueño mantiene acceso completo y protegido. Un administrador no puede modificar su propio acceso ni conceder permisos superiores a los suyos. Las configuraciones de una empresa no afectan a las demás. No compartas contraseñas ni las escribas en el asistente."
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
const assistantQuick=()=>{const type=typeof businessOperationalType==='function'?businessOperationalType():CO?.businessType,activeQuick=quick.filter(([module,label],i)=>{const sector={'¿Cómo controlo una obra y su garantía?':'construccion','¿Cómo registro parcelas, ganado y cosechas?':'agro','¿Cómo produzco por pedido con control de calidad?':'manufactura'};if(sector[label])return sector[label]===type;if(label==='¿Cómo opero habitaciones, limpieza y consumos?')return type==='hotel';if(module==='reservas'&&label.includes('alquiler'))return type==='alquiler';return i>1||module==='cartera';});const profile=globalThis.AcontecProfiles?.get(CO?.businessType);return profile&&profile.id!=='comercio'?[...profile.quickQuestions.map(([module,label,answer])=>[module,label,CO?.billingPlan?.id==='facturacion'?answer.replace(' Usa Más módulos para consultar otras herramientas.',''):answer]),...activeQuick]:activeQuick;};
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
    root.innerHTML=`<header class="assistant-head"><div><span class="assistant-eyebrow">${esc(uiT("assistant.5","GUÍA DE USO"))}</span><h2 id="assistant-title">${esc(uiT("assistant.6","Pregúntale a Acontec"))}</h2></div><button type="button" class="assistant-icon" data-assistant="close" aria-label="Cerrar asistente">×</button></header>
      <p class="assistant-intro">${esc(uiT("assistant.7","Solo orientación. No consulta tus cifras ni realiza cambios."))}</p>
${!acknowledged?`<div class="assistant-privacy"><p>${esc(uiT("assistant.1","Solo si el sitio tiene una clave de IA configurada y un proveedor válido, tu pregunta y hasta 4 mensajes se envían a ese proveedor. Sin clave, responde nuestra guía sin IA ni cupo diario. No escribas datos contables, personales ni contraseñas. La conversación vive solo en esta pantalla."))}</p><a href="/privacidad.html" target="_blank" rel="noopener">${esc(uiT("assistant.2","Privacidad"))}</a> <button type="button" class="btn ghost" id="assistant-privacy-accept" data-assistant="privacy">${esc(uiT("assistant.3","Entendido"))}</button></div>`:''}
      <div class="assistant-body"><div class="assistant-chips" aria-label="Preguntas rápidas sin IA">${assistantQuick().map(([module,label],index)=>permission(module)?`<button type="button" data-assistant="quick" data-index="${esc(index)}" ${pending||!acknowledged?'disabled':''}>${esc(label)}</button>`:'').join('')}</div>
      <div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversación de ayuda">${messages.map(message=>`<article class="assistant-message ${message.role==='user'?'assistant-user':''}"><b>${esc(message.role==='user'?'Tú':'Acontec')}</b>${format(message.content)}</article>`).join('')}${pending?`<p role="status">${esc(uiT("assistant.4","Consultando la guía…"))}</p>`:''}</div></div>
      <form id="assistant-form"><label for="assistant-question">${esc(uiT("assistant.8","Tu pregunta sobre Acontec"))}</label><textarea id="assistant-question" name="question" maxlength="400" rows="2" placeholder="¿Cómo uso…?" required ${pending||!acknowledged?'disabled':''}></textarea><div class="assistant-form-foot"><small>${esc(uiT("assistant.9","Máx. 400 caracteres · Con IA: 20 al día por usuario"))}</small><button class="btn" ${pending||!acknowledged?'disabled':''}>${esc(uiT("assistant.10","Enviar"))}</button></div></form>
      <footer class="assistant-footer"><span>${esc(uiT("assistant.11","Las preguntas rápidas no consumen IA."))}</span><button type="button" class="lk" data-assistant="clear">${esc(uiT("assistant.12","Limpiar conversación"))}</button></footer>`;
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
    anchor.insertAdjacentHTML('afterend',`<section class="card assistant-entry noprint" id="assistant-entry"><div><span class="assistant-eyebrow">${esc(uiT("assistant.13","APRENDE A USAR TU SISTEMA"))}</span><h3>${esc(uiT("assistant.14","Una guía, paso a paso"))}</h3><p>${esc(uiT("assistant.15","Desde tu primera factura hasta la lectura de reportes."))}</p></div><button type="button" class="btn" data-assistant="open" aria-controls="assistant-sheet" aria-expanded="false">${esc(uiT("assistant.16","Pregúntale a Acontec"))} <span aria-hidden="true">↗</span></button></section><aside id="assistant-sheet" class="assistant-sheet noprint" role="dialog" aria-labelledby="assistant-title" hidden></aside>`);
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
    document.getElementById('main').insertAdjacentHTML('afterbegin',`<section class="card assistant-settings"><h3>${esc(uiT("assistant.17","Asistente de ayuda"))}</h3><p>${esc(uiT("assistant.18","Guía de uso sin acceso a cifras. Desactivado por defecto. Sin IA, responde desde la guía sin cupo diario. Con IA: máximo 20 preguntas por usuario y 100 por empresa al día."))}</p><form id="assistant-settings-form"><label class="ck"><input type="checkbox" name="enabled" ${CO.assistantEnabled?'checked':''}> ${esc(uiT("assistant.19","Activar Pregúntale a Acontec en el Panel"))}</label><label>${esc(uiT("assistant.20","Zona horaria del límite diario"))}<input name="timeZone" maxlength="80" required value="${esc(CO.assistantTimeZone||'America/Managua')}" placeholder="America/Managua"></label><p class="mut">${esc(uiT("assistant.21","Usa la zona de tu empresa; por ejemplo, America/Managua. El cambio conserva el consumo ya registrado para cada fecha."))}</p><p class="err" role="status"></p><button class="btn">${esc(uiT("assistant.22","Guardar configuración del asistente"))}</button></form></section>`);
    document.getElementById('assistant-settings-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;
      try{
        if(!await flush())throw new Error(uiT("assistant.extra.1","Guarda primero los cambios pendientes."));
        if(CO?.id!==id||R!=='ajustes')return;
        const result=await api('assistant-settings?c='+encodeURIComponent(id),'POST',{revision:REV,enabled:form.elements.enabled.checked,timeZone:form.elements.timeZone.value.trim()});
        if(CO?.id!==id)return;
        REV=result.revision;CO.assistantEnabled=result.enabled;CO.assistantTimeZone=result.timeZone;CO.assistantAvailable=result.enabled&&CO.assistantGlobalEnabled;
        reset();form.querySelector('.err').textContent=uiT("assistant.extra.2","Configuración guardada.");
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
