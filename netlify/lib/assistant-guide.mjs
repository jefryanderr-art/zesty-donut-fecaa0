// Guía editorial basada en las vistas y formularios del sitio; sin datos de clientes.
export const assistantGuide = [
  {
    "id":"perfiles_negocio","modulo":"general","titulo":"Tipos de negocio y capacidades reutilizables",
    "palabras_clave":["perfil","rubro","tipo de negocio","personalizar","más módulos","restaurante","farmacia","taller","colegio","alumno","paciente","hotel","inquilino","prestamista","empeño","receta","agenda","reserva","comensal","donante","producción","cuenta abierta","despacho"],
    "texto":"En Ajustes y respaldo, Mi tipo de negocio muestra el perfil de la empresa. Solo el dueño puede abrir Personalizar mi sistema, elegir otro rubro, cambiar las etiquetas y decidir qué módulos aparecen en el menú. Automático sigue las recomendaciones del catálogo; Oculto conserva el acceso desde Más módulos. El plan y los permisos del colaborador siempre siguen vigentes. Comercio general conserva la organización habitual. Cambiar de perfil no convierte ni borra ventas, compras, existencias o asientos. Las empresas nuevas pueden omitir el arranque o agregar ejemplos sin precios, impuestos ni saldos.\nLas capacidades se abren desde Mi negocio o Más módulos. Nuevo registro prepara la ficha; Ver ficha conserva sus detalles e historial. Facturar emite mediante Facturación y exige confirmar productos, precios, IVA, serie, turno cuando corresponda y forma de pago. Un documento ya facturado no se convierte otra vez. Los proyectos identifican cada etapa y los contratos cada período. Los anticipos se registran como pasivos y se aplican contra una factura a crédito. Los recordatorios aparecen en la aplicación y no significan que se envió un correo.\nLotes registra existencias previamente compradas o producidas y la venta usa primero los lotes vigentes que vencen antes. Una receta necesita insumos y rendimiento; Producir requiere confirmación. Cartera registra préstamos otorgados y sus cobros, separados de los préstamos recibidos existentes. Antes de desembolsar configura frecuencia, tasa por período, método, mora y cuentas. No hay reglas legales implícitas: verifica con tu contador. Las preguntas rápidas cambian con el rubro y no consumen IA. El asistente solo explica pantallas; no consulta expedientes ni ejecuta estas operaciones."
  },

  {
    "id": "inicio",
    "modulo": "general",
    "titulo": "Empresa y primeros pasos",
    "palabras_clave": [
      "empezar",
      "inicio",
      "crear empresa",
      "primeros pasos",
      "configurar empresa",
      "nombre de empresa"
    ],
    "texto": "Al ingresar, selecciona la empresa que vas a utilizar. Desde Menú, Cambiar o crear empresa permite elegir entre las empresas disponibles. Crear otra empresa depende del plan y de los permisos del dueño; un usuario de colaborador no puede crear empresas con su acceso asignado. Las empresas previas se conservan cuando cambia el plan. El nombre de la empresa identifica el espacio de trabajo y encabeza su panel.\nEn Panel aparece Resumen del periodo. Los controles Diario, Semanal, Mensual, Anual, Todo y Rango cambian el período consultado; Rango permite indicar fechas. Antes de interpretar una cifra, revisa empresa, sucursal y período. El asistente únicamente enseña el uso: no consulta cifras ni realiza operaciones.\nPara comenzar, el dueño revisa Datos de la empresa en Ajustes y respaldo. Allí se configuran nombre, RUC y moneda. El inventario inicial se registra en Productos, mientras los saldos contables iniciales corresponden al Asiento de apertura. Cada uno requiere sus permisos específicos. No dupliques el inventario inicial mediante ambas rutas. La disponibilidad de módulos depende tanto del rol como del plan; si falta un menú, consulta al dueño en lugar de intentar abrirlo por URL."
  },
  {
    "id": "productos",
    "modulo": "inventario",
    "titulo": "Productos e inventario",
    "palabras_clave": [
      "producto",
      "productos",
      "inventario",
      "stock",
      "existencia",
      "agregar productos",
      "mercaderia",
      "almacen",
      "precio",
      "costo"
    ],
    "texto": "Abre Productos e inventario desde Productos o Menú y pulsa + Producto. Revisa código, nombre, unidad, costo, precio, existencia inicial y mínimo. Los códigos identifican productos y los códigos de barras se gestionan dentro de la misma empresa. El precio y el costo cumplen funciones distintas: el precio sirve para vender y el costo para valorar el inventario y reconocer el costo de venta. Los precios de catálogo se manejan sin IVA; el impuesto se calcula conforme a la configuración del producto al registrar el documento.\nLa tabla muestra Existencia y Valor según los permisos del perfil. El aviso junto a un producto señala existencias iguales o inferiores al mínimo. Editar modifica la ficha; Ajustar es la ruta de corrección de existencias. No presentes un ajuste como una compra si en realidad necesitas registrar la factura del proveedor y su deuda o pago.\nEl catálogo es compartido por las sucursales y las existencias se consultan por sucursal. Antes de registrar inventario inicial, verifica la sucursal activa y evita cargarlo dos veces. Kardex permite revisar movimientos. El precio y la existencia válidos se verifican al confirmar la operación, aunque una búsqueda local haya mostrado antes el producto."
  },
  {
    "id": "compras",
    "modulo": "compras",
    "titulo": "Compras",
    "palabras_clave": [
      "compra",
      "comprar",
      "compras",
      "ingresar compra",
      "factura proveedor",
      "mercancia recibida"
    ],
    "texto": "En Compras pulsa + Nueva compra. El formulario solicita Fecha, Proveedor y Forma de pago, y permite incluir líneas de productos mediante + Agregar producto. Revisa cantidades y costos de cada línea antes de confirmar. Una compra incorpora existencias y reconoce la contrapartida de pago o deuda según la forma elegida; no equivale a crear únicamente la ficha del producto. Los costos base se registran sin IVA y el impuesto depende de la configuración aplicable.\nPara compras a crédito, revisa la cuenta por pagar y su vencimiento en el flujo de documentos. El botón Registrar pago a proveedor sirve para los pagos correspondientes; un abono reduce una deuda existente, no registra otra compra. Conserva la referencia de la factura del proveedor para identificarla y evitar duplicados.\nDevoluciones y notas de compras ofrece Devolución a proveedor, Nota de débito y Costo de desembarque. Una devolución conserva el documento original y retira existencias; una nota de débito aumenta la deuda sin duplicar el inventario. El costo de desembarque distribuye costos conforme a las validaciones del sistema. Estas operaciones dependen de los permisos y no deben sustituirse borrando asientos históricos. Para su tratamiento contable o fiscal, verifica con tu contador."
  },
  {
    "id": "proveedores",
    "modulo": "proveedores",
    "titulo": "Proveedores",
    "palabras_clave": [
      "proveedor",
      "proveedores",
      "ficha proveedor",
      "abonar proveedor"
    ],
    "texto": "El módulo Proveedores conserva las fichas comerciales de quienes abastecen a la empresa. Utiliza el catálogo para identificar al proveedor al registrar documentos y consulta los movimientos vinculados desde sus acciones disponibles. El catálogo pertenece a la empresa y no constituye un acceso a la información de otra empresa. Crear una ficha no registra automáticamente una compra, una entrada de inventario ni un pago.\nFacturas y abonos muestra documentos del proveedor, Forma de pago, Total y Deuda. Los documentos a crédito con deuda permiten Abonar; Historial permite revisar los abonos. Los documentos manuales históricos se relacionan por coincidencia exacta del nombre, por lo que conviene mantener nombres consistentes y revisar el documento correcto antes de pagar. Una factura al contado no representa por sí misma una deuda pendiente.\nEl registro del pago debe corresponder a una obligación real, su fecha y el origen del dinero. No cargues otra compra para reflejar el abono de la primera. Si el menú no aparece, revisa con el dueño el permiso de Proveedores y el plan. Para explicar compras, impuestos o cuentas por pagar, consulta también los módulos correspondientes; esta guía no accede a los saldos particulares ni confirma que una factura esté pagada. Al conciliar diferencias contables, verifica con tu contador."
  },
  {
    "id": "ventas",
    "modulo": "facturacion",
    "titulo": "Ventas y facturas",
    "palabras_clave": [
      "venta",
      "ventas",
      "vender",
      "factura",
      "facturar",
      "registrar venta",
      "crear factura",
      "pago mixto"
    ],
    "texto": "En Facturación pulsa + Crear factura. También existe + Nueva venta en Ventas para los perfiles autorizados; el flujo actual utiliza Crear factura. Toda venta con pago inmediato requiere un turno abierto, incluso si se inicia desde Ventas. En Facturación puedes pulsar Abrir turno y revisar después el efectivo esperado. No inventes un turno ni utilices el de otra persona sin autorización.\nEn Crear factura revisa Fecha, Turno de caja, Serie / sucursal, cliente y Vencimiento del crédito. Agrega productos con + Agregar producto y confirma cantidad y precio por línea. Los precios base son sin IVA; la vista previa calcula el impuesto y el total. La factura conserva el precio confirmado, el catálogo y el costo histórico correspondientes a la operación.\nEn Pago mixto distribuye el total entre los medios disponibles. Completar saldo en efectivo ayuda a completar esa parte. Un descuento requiere la Contraseña de autorización y Autorizar descuento, incluso si lo solicita el dueño. Cambiar líneas o porcentaje exige autorizar de nuevo. Revisa la vista previa antes de emitir. Una factura emitida es inmutable: para corregirla se utiliza Nota de crédito autorizada. El asistente no emite facturas ni revisa tus ventas."
  },
  {
    "id": "credito",
    "modulo": "facturacion",
    "titulo": "Venta a crédito y cobros",
    "palabras_clave": [
      "credito",
      "fiado",
      "fiar",
      "vender fiado",
      "venta a credito",
      "cobro",
      "cobrar",
      "abono cliente",
      "cuentas por cobrar"
    ],
    "texto": "Una venta a crédito se prepara en Crear factura, dentro de Facturación, con el cliente identificado y la fecha de Vencimiento del crédito revisada. Agrega los productos, confirma cantidades y precios y revisa IVA y total. En Pago mixto se distingue la porción a crédito de los pagos inmediatos. El reparto completo debe coincidir con el total; no uses un importe inmediato ficticio para simular una venta fiada. Si hay pago inmediato, el flujo requiere un turno abierto.\nLa porción a crédito genera la cuenta por cobrar del cliente. Cobrar una factura después es una operación diferente de volver a vender el producto: el cobro reduce la deuda y registra el ingreso de dinero. Ventas incluye Registrar cobro de cliente para los perfiles autorizados. Las pantallas de cuentas por cobrar muestran los documentos y sus abonos según los permisos y el plan. Verifica siempre el cliente y documento al que se aplica el pago.\nEl Historial del documento permite revisar los movimientos disponibles. Antigüedad de saldos organiza las deudas según su vencimiento cuando ese módulo está habilitado. El asistente solo explica el procedimiento; no sabe cuánto te debe un cliente ni puede confirmar un cobro. Para revisar una diferencia entre venta, deuda y dinero recibido, verifica con tu contador."
  },
  {
    "id": "gastos",
    "modulo": "gastos",
    "titulo": "Gastos",
    "palabras_clave": [
      "gasto",
      "gastos",
      "egreso",
      "registrar gasto",
      "alquiler",
      "servicio"
    ],
    "texto": "En Gastos pulsa + Nuevo gasto. Revisa fecha, concepto, cuenta y forma de pago antes de guardar. Un gasto representa un consumo o servicio y no agrega productos al inventario. Si recibes mercadería para vender, utiliza Compras; si solo necesitas crear una ficha, utiliza Productos. La clasificación elegida influye en los reportes porque las cuentas de gasto forman parte del resultado del período.\nLos importes base se registran sin IVA y el impuesto acreditable depende de la configuración y del documento. No supongas que todo egreso permite crédito fiscal ni que el sistema certifica la deducibilidad del gasto. Si el gasto queda a crédito, revisa la deuda y registra después el pago correspondiente, evitando duplicar el gasto cuando salga el dinero.\nLa lista de Gastos puede filtrarse con los controles de período. Comprueba empresa, sucursal, fecha y referencia antes de interpretar el total. Los permisos de lectura permiten consultar, mientras los de escritura habilitan las acciones admitidas por el rol y plan. Costos y Caja chica son flujos separados con sus propias reglas y comprobantes; no dupliques el mismo gasto en varias pantallas. El asistente no consulta los egresos de tu empresa ni recomienda importes concretos. Para la clasificación y tratamiento fiscal, verifica con tu contador."
  },
  {
    "id": "cajas",
    "modulo": "cajas",
    "titulo": "Cajas y bancos",
    "palabras_clave": [
      "caja",
      "cajas",
      "banco",
      "bancos",
      "efectivo",
      "turno",
      "caja chica",
      "arqueo",
      "tesoreria"
    ],
    "texto": "Facturación usa turnos de caja para atribuir ventas y pagos inmediatos a su responsable. Abrir turno registra el fondo inicial; Cerrar mi turno permite comparar lo esperado con lo contado. No confundas fondo inicial con ingreso por ventas. La vista de turnos conserva su estado y las diferencias del cierre. Los permisos de caja limitan qué turnos y acciones están disponibles para cada persona.\nCaja chica trabaja con fondos, vales, reposiciones y arqueos. + Vale registra el gasto documentado según el fondo y su límite. Reponer agrupa vales pendientes por el importe documentado; no admite reposiciones mayores al gasto. Arqueo compara el dinero y los vales con lo esperado. Regularizar fondo restablece el fondo autorizado conforme a las validaciones, sin reconocer otra vez el faltante o sobrante.\nReportes de caja incluye ventas por cajero o vendedor, caja chica por categoría y persona, flujo diario e historial de arqueos. Las transferencias entre Caja general, Banco, turnos y fondos no se duplican como ingresos o egresos externos del flujo. Los movimientos de dinero no equivalen siempre a ingreso o gasto contable. El asistente no conoce el efectivo real ni concilia bancos. Revisa el documento y su contrapartida antes de registrar una corrección; verifica con tu contador."
  },
  {
    "id": "iva",
    "modulo": "fiscal",
    "titulo": "IVA, renta y agenda fiscal",
    "palabras_clave": [
      "iva",
      "impuesto",
      "impuestos",
      "renta",
      "fiscal",
      "declaracion",
      "tributo",
      "anticipo"
    ],
    "texto": "IVA mensual y renta anual presenta cálculos orientativos. En IVA mensual elige Período y revisa Ventas sin IVA, Compras y gastos sin IVA, IVA cobrado / débito e IVA acreditable / crédito. Su diferencia se muestra como IVA a pagar o Saldo a favor. Registrar cierre de IVA crea el registro fiscal mediante confirmación; leer la pantalla no equivale a declarar ante una autoridad.\nLa Proyección de renta anual utiliza ingresos, costos y gastos contables anteriores al impuesto sobre ganancias, con la tasa configurada. Registrar proyección anual conserva ese cálculo. Los parámetros comienzan sin asumir automáticamente normativa ni país; Reglas laborales y fiscales permite Editar parámetros. Los precios base del sistema son sin IVA, y las operaciones separan base e impuesto conforme a lo configurado.\nCalendario y agenda fiscal permite + Obligación, revisar vencimientos, registrar pagos y descargar CSV. Las alertas se muestran al abrir el panel, sin prometer envíos automáticos. El Anticipo mensual de IR es opcional: requiere país, porcentaje y vencimiento confirmados por el dueño; no se genera por defecto. Los libros internos y exportaciones configurables no son formularios oficiales certificados. El asistente no determina tus obligaciones ni consulta cifras tributarias. Antes de declarar, ajustar deducibilidad o aplicar tasas, verifica con tu contador."
  },
  {
    "id": "retenciones",
    "modulo": "fiscal",
    "titulo": "Retenciones y libros fiscales",
    "palabras_clave": [
      "retencion",
      "retenciones",
      "constancia",
      "libro fiscal",
      "libros fiscales"
    ],
    "texto": "En Retenciones y constancias pulsa Registrar retención. El registro distingue retenciones practicadas de recibidas, tercero, referencia, base, tasa e importe. Una retención practicada reduce una cuenta por pagar y reconoce una obligación fiscal; una recibida reduce una cuenta por cobrar y registra un crédito fiscal. Selecciona el documento y revisa el tratamiento antes de confirmar: no es un descuento comercial ni un pago de dinero adicional.\nLa lista muestra las retenciones y ofrece Imprimir / PDF para la constancia. La existencia de esa impresión no certifica que cumpla todos los requisitos oficiales del país. Revisa datos, concepto y exigencias formales con tu asesor. El asistente no puede generar la constancia ni verificar tu situación fiscal.\nLibros fiscales contiene Libro de ventas, Libro de compras y Libro de IVA a partir de los asientos confirmados y del período seleccionado. Las notas de crédito reducen sus bases e impuestos en esos libros. Los totales de IVA cobrado y acreditable permiten comprender la diferencia del período, pero no sustituyen la revisión legal de documentos, exenciones y ajustes. Puedes exportar tablas o utilizar la exportación fiscal configurable cuando esté habilitada. Son libros internos y no formularios oficiales; verifica con tu contador."
  },
  {
    "id": "asientos",
    "modulo": "contabilidad",
    "titulo": "Asientos y catálogo de cuentas",
    "palabras_clave": [
      "asiento",
      "asientos",
      "diario",
      "mayor",
      "catalogo de cuentas",
      "cuenta contable",
      "apertura",
      "debe",
      "haber"
    ],
    "texto": "Libro diario muestra los asientos del período y ofrece + Asiento para registros manuales con permiso de escritura. Cada asiento debe estar cuadrado: la suma del Debe debe coincidir con la suma del Haber. Selecciona cuentas existentes y una descripción que permita entender la operación. No uses un asiento manual para repetir ventas o compras que el sistema ya contabilizó al confirmarlas.\nCatálogo de cuentas permite + Cuenta y presenta código, nombre y tipo. Las cuentas protegidas no se eliminan mediante Borrar. La naturaleza y tipo de cuenta afectan la presentación de saldos y reportes, por lo que crear cuentas requiere criterio contable. Libro mayor permite seleccionar Cuenta y revisar Saldo inicial del período, movimientos, Debe, Haber y Saldo.\nAsiento de apertura registra los saldos iniciales de efectivo, bancos, activos, deudas y capital. El inventario inicial se registra desde Productos; no lo dupliques en la apertura. Una apertura con movimientos de dinero queda protegida y sus correcciones se documentan como nuevos asientos, conservando el original. Los períodos cerrados bloquean modificaciones y anulaciones conforme al control de cierres. El asistente explica las pantallas, pero no crea asientos ni valida saldos de tu empresa. Para elegir cuentas o corregir diferencias, verifica con tu contador."
  },
  {
    "id": "balanza",
    "modulo": "finanzas",
    "titulo": "Balanza de comprobación",
    "palabras_clave": [
      "balanza",
      "comprobacion",
      "saldo deudor",
      "saldo acreedor",
      "debitos",
      "creditos",
      "descuadre"
    ],
    "texto": "Abre Balanza de comprobación desde los estados financieros y selecciona el período o fecha de corte con los controles disponibles. La balanza presenta los movimientos acumulados hasta la fecha final, no únicamente la actividad entre dos fechas. Su encabezado indica Al y la fecha de corte. Revisa también empresa y sucursal; el consolidado y una sucursal individual pueden mostrar saldos distintos.\nCada fila identifica Código y Cuenta, Débitos, Créditos, Saldo deudor y Saldo acreedor. Un saldo deudor se obtiene cuando los débitos superan los créditos; el saldo acreedor refleja la situación inversa. Los totales permiten comprobar la igualdad contable. El mensaje La balanza está cuadrada señala igualdad entre saldos deudores y acreedores según el cálculo del sistema.\nQue esté cuadrada no garantiza que todas las cuentas, fechas o clasificaciones sean correctas: una operación duplicada o registrada en la cuenta equivocada puede mantener la igualdad. Si no cuadra, revisa el Libro diario y luego el Libro mayor de las cuentas afectadas, sin modificar importes al azar. Imprimir abre las opciones de impresión o PDF. El asistente no accede a tu balanza ni identifica diferencias específicas; solo orienta su lectura. Para investigar un descuadre o reclasificar, verifica con tu contador."
  },
  {
    "id": "resultados",
    "modulo": "finanzas",
    "titulo": "Estado de resultados",
    "palabras_clave": [
      "estado de resultados",
      "resultado",
      "resultados",
      "utilidad",
      "perdida",
      "ganancia",
      "rentabilidad",
      "reporte"
    ],
    "texto": "Estado de resultados explica el desempeño del período seleccionado. Usa Diario, Semanal, Mensual, Anual, Todo o Rango y confirma las fechas del encabezado. A diferencia del Balance general, este reporte muestra ingresos, costos y gastos del intervalo. Revisa la sucursal activa: consultar una sucursal no equivale al consolidado de la empresa.\nComienza por Ingresos y Total ingresos. Costo de ventas representa el costo de los productos vendidos; restarlo de los ingresos produce Utilidad bruta. Después lee Gastos de operación y Total gastos. UTILIDAD (PÉRDIDA) NETA es el resultado de restar costos y gastos a los ingresos. Un importe negativo indica pérdida para el período mostrado. Los reportes se basan en la clasificación de las cuentas y en los registros confirmados.\nUtilidad no significa dinero disponible: una venta a crédito puede reconocer ingreso sin haber sido cobrada, y una compra puede quedar pendiente de pago. El IVA registrado en sus cuentas no debe interpretarse automáticamente como ingreso de ventas o gasto. Para comprender el efectivo, consulta Estado de flujo de efectivo; para recursos y deudas, Balance general. Imprimir permite obtener el reporte con las opciones de papel existentes. El asistente no conoce tus ingresos, utilidad ni márgenes. Para clasificaciones, cierres o interpretación contable, verifica con tu contador."
  },
  {
    "id": "balance",
    "modulo": "finanzas",
    "titulo": "Balance general",
    "palabras_clave": [
      "balance",
      "balance general",
      "situacion financiera",
      "activo",
      "pasivo",
      "patrimonio",
      "capital"
    ],
    "texto": "Balance general presenta la situación acumulada de la empresa hasta la fecha final seleccionada. Su encabezado indica Al y la fecha correspondiente. No mide solo las ventas del mes. Antes de comparar saldos, confirma empresa, sucursal y fecha de corte. Los controles de período determinan esa fecha final, mientras los saldos parten del historial acumulado.\nActivos reúne recursos y derechos registrados, como efectivo, bancos, inventario y cuentas por cobrar. Pasivos muestra obligaciones frente a terceros. Patrimonio recoge las cuentas patrimoniales, y Resultado acumulado del ejercicio incorpora el resultado pendiente conforme a los asientos. Total patrimonio suma esas partidas. La comparación final es Total activos frente a PASIVO + PATRIMONIO.\nEl mensaje Activos = Pasivos + Patrimonio indica igualdad contable. Esa igualdad no certifica la existencia física del inventario ni que todas las deudas estén completas: depende de los registros realizados. Un activo no es necesariamente dinero disponible; una cuenta por cobrar requiere cobro y el inventario requiere venta. Para analizar el resultado usa Estado de resultados y para entradas o salidas usa Estado de flujo de efectivo. Imprimir ofrece formatos de papel y guardado en PDF. El asistente no consulta este balance ni calcula tu patrimonio. Ante diferencias o clasificación de cuentas, verifica con tu contador."
  },
  {
    "id": "flujo",
    "modulo": "finanzas",
    "titulo": "Estado de flujo de efectivo",
    "palabras_clave": [
      "flujo",
      "flujo de efectivo",
      "entrada",
      "salida",
      "liquidez",
      "dinero disponible"
    ],
    "texto": "Estado de flujo de efectivo organiza las entradas y salidas de efectivo y equivalentes del período. Primero selecciona las fechas y revisa el saldo inicial mostrado. Después lee las secciones de operación, inversión y financiación y sus flujos netos. El resultado se interpreta junto con el efectivo inicial y final, no como una segunda medida de ventas.\nLa operación corresponde a actividades habituales del negocio; inversión y financiación distinguen otros movimientos según la clasificación contable del sistema. Un cobro de una venta anterior puede entrar en este período aunque el ingreso de la venta se reconociera antes. Una venta a crédito sin cobro no debe confundirse con entrada de efectivo. Asimismo, pagar una deuda anterior puede producir una salida sin representar otro gasto del mismo período.\nLos traslados entre cuentas de efectivo o entre cajas no deben contarse dos veces como ingreso externo. Reportes de caja ofrece además un flujo diario con entradas externas, salidas externas y flujo neto, bajo sus permisos. Confirma la sucursal o consolidado antes de comparar con otro reporte y revisa las cuentas en Libro mayor si necesitas rastrear un movimiento. El asistente no conoce el dinero disponible de tu empresa ni proyecta cifras particulares. Para revisar la clasificación y conciliación, verifica con tu contador."
  },
  {
    "id": "sucursales",
    "modulo": "sucursales",
    "titulo": "Sucursales y traslados",
    "palabras_clave": [
      "sucursal",
      "sucursales",
      "traslado",
      "traslados",
      "bodega",
      "principal",
      "consolidado"
    ],
    "texto": "Cambiar de sucursal permite elegir la sucursal de trabajo. El dueño y los perfiles autorizados pueden consultar Todas las sucursales · consolidado; esa vista es de consulta para movimientos. Para registrar operaciones selecciona una sucursal concreta. Principal identifica la sucursal histórica y conserva los registros anteriores. Los catálogos de productos, clientes y proveedores pertenecen a la empresa, mientras existencias y movimientos se separan por sucursal.\nSucursales ofrece Crear sucursal y Editar al dueño. Revisa nombre, código corto y datos de contacto. El límite depende de la configuración y del plan: reducirlo no elimina sucursales existentes. Los colaboradores reciben sucursales asignadas y no obtienen acceso simplemente enviando un identificador desde el navegador. Cambiar asignaciones revoca sesiones anteriores.\nLos traslados de inventario distinguen envío y recepción; no son dos compras ni dos ventas. El inventario en tránsito debe recibirse en el destino mediante el flujo autorizado, sin duplicar la recepción. Los traslados de dinero también requieren validaciones explícitas. Comparativo entre sucursales permite contrastar resultados cuando el plan y permisos lo admiten. La consolidación de empresas es una función distinta: suma empresas autorizadas con la misma moneda, sin eliminar automáticamente operaciones entre ellas. El asistente no consulta existencias ni ejecuta traslados. Para saldos intersucursal y consolidaciones, verifica con tu contador."
  },
  {
    "id": "barras",
    "modulo": "inventario",
    "titulo": "Códigos de barras y cámara",
    "palabras_clave": [
      "codigo de barras",
      "codigos de barras",
      "escaner",
      "escanear",
      "camara",
      "lector",
      "ean",
      "usb",
      "bluetooth"
    ],
    "texto": "Los códigos de barras identifican productos dentro de cada empresa. Se validan al guardar y deben ser únicos por empresa; un código utilizado en una empresa no concede acceso al catálogo de otra. Revisa el producto encontrado antes de agregarlo a una factura o compra. El código no contiene una autorización ni garantiza por sí solo precio o existencias disponibles.\nLos lectores USB o Bluetooth funcionan como entrada de teclado en los controles compatibles. Mantén el foco en el buscador correspondiente; no se deben capturar lecturas mientras escribes en otro campo. Los flujos principales compatibles están en facturación, compras, productos y conteo. No se promete que todo buscador de la aplicación ni los traslados tengan un flujo específico de cámara.\nLa cámara se abre desde el control de lectura disponible y requiere permiso del navegador. Su respaldo local de lectura se carga al abrirla, sin una biblioteca externa desde CDN. Si deniegas el permiso, usa el código escrito o un lector físico en el control correspondiente. Al cerrar la cámara debe finalizar la captura. El buscador temporal no sustituye la validación del servidor: el precio y las existencias se confirman al registrar el documento. Los dispositivos táctiles conservan su comportamiento de foco adaptado. El asistente no activa la cámara ni lee productos particulares."
  },
  {
    "id": "impresion",
    "modulo": "general",
    "titulo": "Impresión y PDF",
    "palabras_clave": [
      "imprimir",
      "impresion",
      "pdf",
      "ticket",
      "carta",
      "a4",
      "papel",
      "80 mm"
    ],
    "texto": "Las acciones Imprimir de reportes y facturas abren Opciones de impresión. Allí puedes elegir Color de impresión entre Blanco y negro y A color, Tamaño de papel entre A4, Carta y Ticket 80 mm, y Orientación entre Vertical y Horizontal cuando corresponda. En ticket se utiliza orientación vertical. Después pulsa Imprimir / guardar PDF para abrir el diálogo del navegador.\nSelecciona también el mismo papel en la impresora o diálogo del sistema y desactiva encabezados y pies del navegador. Guardar como PDF depende de las opciones que ofrezca el navegador. Para tablas con muchas columnas se recomienda A4 o Carta horizontal, porque el ticket puede quedar apretado. Revisa la vista previa y textos largos antes de imprimir.\nEl dueño puede utilizar Configurar impresión en Ajustes y respaldo para revisar datos de contacto, condiciones y formato sugerido de facturas. Es posible elegir otro formato en cada impresión. Los datos comerciales se toman de la configuración vigente y las facturas conservan sus operaciones históricas. La impresión no envía automáticamente comprobantes a una autoridad ni garantiza una certificación fiscal. Solo puedes imprimir documentos y reportes a los que tu perfil tenga acceso. El asistente explica las opciones generales; no descarga documentos ni conoce el contenido de tus facturas."
  },
  {
    "id": "importar",
    "modulo": "inventario",
    "titulo": "Importación de productos",
    "palabras_clave": [
      "importar",
      "importacion",
      "csv",
      "excel",
      "xlsx",
      "cargar productos",
      "plantilla csv"
    ],
    "texto": "Importar CSV o Excel permite agregar filas sin reemplazar los registros existentes. Elige el Catálogo disponible para tu perfil: Productos y otros catálogos solo aparecen con su permiso de escritura. Descargar plantilla CSV ayuda a preparar las columnas del catálogo seleccionado. Revisa Fecha contable y selecciona el archivo CSV o Excel.\nPulsa Leer y revisar archivo para ver las filas antes de confirmar. La opción Revisé las filas y confirmo su importación es obligatoria antes de Importar filas revisadas. Una fila inválida cancela toda la importación; corrige el archivo y revisa otra vez. El límite es 1,000 filas y 5 MB. Guarda como texto en Excel los códigos que tengan ceros iniciales para evitar que la hoja los elimine.\nLa importación agrega registros y no reemplaza una restauración de respaldo. No repitas existencias iniciales ya registradas, porque podrías duplicar inventario. Para saldos iniciales se requieren cuentas válidas, importes admitidos y un asiento cuadrado; utiliza ese catálogo únicamente si tienes permisos de contabilidad. Importar clientes o proveedores también exige sus permisos específicos. El asistente no recibe archivos, no procesa filas ni confirma la carga; solo orienta el uso de la pantalla. Verifica empresa y sucursal antes de confirmar cualquier importación."
  },
  {
    "id": "respaldos",
    "modulo": "ajustes",
    "titulo": "Respaldos y restauración",
    "palabras_clave": [
      "respaldo",
      "respaldos",
      "backup",
      "restaurar",
      "restauracion",
      "copia",
      "json",
      "zip",
      "conexion",
      "guardar"
    ],
    "texto": "En Ajustes y respaldo está Descargar respaldo (JSON). También existen exportaciones completas y versiones recuperables según permisos. Conserva una copia antes de una restauración importante. Descargar una copia no cambia la empresa ni confirma que cualquier archivo externo sea compatible. Las contraseñas y credenciales no forman parte de los respaldos para clientes.\nRestaurar respaldo exige los permisos completos necesarios y la revisión actual del documento. El sistema conserva versiones y auditoría, y sincroniza las representaciones contables cuando corresponde. Una restauración no debe utilizarse para saltarse períodos cerrados, permisos o validaciones. Revisa con cuidado empresa, fecha y contenido de la copia; no confundas importar filas con reemplazar información desde un respaldo.\nEl autoguardado informa su estado y conserva los cambios pendientes en la memoria de la pestaña. Si se pierde la conexión, evita cerrar la pestaña antes de confirmar el guardado. Un cierre forzado puede perder cambios que nunca llegaron al servidor. Ante un conflicto entre pestañas, el sistema puede pedir conservar cambios locales o descargar la copia local y usar la nube. No se guardan documentos ni tokens de sesión en almacenamiento local. El asistente tampoco almacena su conversación y no restaura información. Para revisar registros contables después de recuperar una copia, verifica con tu contador."
  },
  {
    "id": "permisos",
    "modulo": "accesibilidad",
    "titulo": "Colaboradores, roles y accesibilidad",
    "palabras_clave": [
      "colaborador",
      "colaboradores",
      "permiso",
      "permisos",
      "rol",
      "roles",
      "accesibilidad",
      "usuario",
      "acceso",
      "contador",
      "cajero",
      "vendedor"
    ],
    "texto": "Accesibilidad es la pantalla de administración de personas, cargos y permisos; no debe confundirse con ajustes visuales del dispositivo. Crear acceso permite asignar nombre, rol, correo o nombre de usuario, contraseña cuando corresponde, sucursales y permisos por módulo. Los niveles son ninguno, lectura y escritura. Editar permisos modifica un acceso y Desactivar impide su uso conforme a las reglas del servidor.\nEl rol limita la matriz: dueño y contador pueden ver Ventas; cajero y vendedor trabajan en Facturación. El supervisor dispone de correcciones autorizadas dentro de su alcance. Un permiso marcado no habilita un módulo excluido por el rol o el plan. El contador puede abarcar todas las sucursales, mientras otros colaboradores requieren asignaciones. Cambiarlas revoca sesiones anteriores.\nLos accesos por correo utilizan el registro habitual y la confirmación del correo. Los usuarios asignados ingresan mediante Ingresar como colaborador. El dueño conserva su acceso protegido. Ajustes y bitácora exigen acceso completo según sus reglas; restaurar requiere escritura completa. No compartas contraseñas ni las escribas en el asistente. Una sesión de soporte temporal es siempre de lectura y no puede utilizar este asistente. Si falta una pantalla, consulta al dueño para revisar rol, módulos del plan y sucursales. El chat no concede accesos ni modifica permisos."
  },
  {
    "id": "auditoria",
    "modulo": "auditoria",
    "titulo": "Bitácora de auditoría",
    "palabras_clave": [
      "bitacora",
      "auditoria",
      "historial de cambios",
      "quien cambio",
      "registro de cambios"
    ],
    "texto": "Bitácora de auditoría conserva acciones y cambios de la empresa que el sistema registra. Su consulta depende de los permisos completos exigidos por el módulo; disponer de una sesión o conocer una URL no autoriza la lectura. Revisa fecha, persona, acción y los detalles disponibles al investigar un cambio. Las acciones para avanzar y retroceder recorren los registros de la consulta.\nLa auditoría ayuda a seguir guardados, restauraciones y operaciones relevantes, pero no sustituye los documentos contables. Para entender un saldo, parte del documento y su asiento, y usa la bitácora para revisar la trazabilidad. No presentes un evento de auditoría como un comprobante fiscal o una certificación independiente.\nLos cierres, reaperturas y operaciones avanzadas conservan motivos o confirmaciones cuando corresponde. El asistente añade únicamente metadatos de uso: identidad interna del usuario, empresa, fecha y secciones de guía consultadas, sin preguntas ni respuestas. Esa información permite aplicar límites diarios sin almacenar conversaciones. El historial del chat permanece solo en la pantalla y puede limpiarse; no es un registro recuperable de auditoría. El asistente no consulta la bitácora ni responde quién cambió un importe particular. Para revisar un caso real, abre la pantalla autorizada y contrasta la operación con su documento; verifica con tu contador."
  },
  {
    "id": "plan",
    "modulo": "general",
    "titulo": "Suscripción y plan",
    "palabras_clave": [
      "suscripcion",
      "plan",
      "planes",
      "pago del servicio",
      "renovar",
      "prueba",
      "limite de empresas"
    ],
    "texto": "La suscripción determina módulos y límites disponibles para las empresas del dueño y también limita a sus colaboradores. Consulta la pantalla de planes y suscripción disponible en tu cuenta para revisar las condiciones actuales, los módulos incluidos y la modalidad mensual o anual. No se deben suponer precios ni capacidades por el nombre de un plan; el sistema utiliza los planes vigentes guardados.\nUn cambio de plan no borra las empresas históricas. Cuando existe un límite explícito, las empresas excedentes se conservan como consulta. La creación de empresas y sucursales depende del acceso actual y de los límites aplicables. Si falta una pantalla, el dueño debe revisar tanto el plan como el rol y los permisos del colaborador.\nLa prueba se inicia una sola vez por correo según las reglas del servicio. Un pago en entorno de prueba no activa producción ni representa ingresos reales. Los cobros ambiguos requieren verificación y no deben repetirse a ciegas. El dueño administra los cambios comerciales y los comprobantes del servicio conforme a sus autorizaciones; los colaboradores no reciben acceso a credenciales del proveedor. El asistente no consulta tu suscripción, procesa pagos ni confirma cobros o entrega de correo. Para conocer fechas, disponibilidad y precios concretos utiliza la pantalla de tu cuenta y consulta al dueño."
  },
  {
    "id": "avanzado",
    "modulo": "contabilidad",
    "titulo": "Herramientas contables avanzadas",
    "palabras_clave": [
      "avanzado",
      "avanzadas",
      "cierre",
      "cerrar mes",
      "cerrar ejercicio",
      "depreciacion",
      "activo fijo",
      "prestamo",
      "multimoneda",
      "devengo",
      "recurrente"
    ],
    "texto": "Cierres y períodos permite al dueño Cerrar mes, Reabrir con motivo y Cerrar ejercicio con confirmación. Un mes cerrado bloquea altas, modificaciones y anulaciones de asientos. El cierre anual traslada ingresos, costos y gastos a Utilidades acumuladas y bloquea los doce meses de la sucursal, conservando documentos. Revisa reportes y respaldos antes de confirmar.\nActivos fijos y depreciación ofrece Registrar activo, Depreciar mes y Dar de baja. Incluye línea recta y saldo decreciente doble; la depreciación mensual empieza en el mes de adquisición, sin prorrateo diario. La vida útil, residual y tratamiento fiscal necesitan revisión profesional. Préstamos y amortización conserva los datos del préstamo y sus pagos mediante operaciones validadas; no confundas capital amortizado con gasto por intereses.\nMultimoneda y Plantillas y devengos son herramientas contables separadas. Revisa tipo de cambio y documento antes de liquidar una operación en moneda extranjera. Las plantillas no autorizan duplicar un asiento ya registrado y las confirmaciones protegen devengos y provisiones. Cada herramienta depende del módulo y del período abierto. El asistente solo explica estas pantallas y no calcula cuotas, depreciaciones o diferencias de tu empresa. Para cerrar, reabrir, reconocer provisiones o escoger criterios contables, verifica con tu contador."
  },
  {
    "id": "analisis",
    "modulo": "finanzas",
    "titulo": "Análisis y presupuestos",
    "palabras_clave": [
      "analisis",
      "indicador",
      "indicadores",
      "presupuesto",
      "presupuestos",
      "margen",
      "escenario",
      "proyeccion"
    ],
    "texto": "Análisis financiero muestra indicadores y comparación con el mismo período del año anterior o con el período inmediatamente anterior. Selecciona las fechas antes de comparar. Los cocientes sin denominador se muestran como una raya: no deben interpretarse como cero ni como un resultado favorable. El EBITDA es aproximado y depende de la clasificación de cuentas; el estado de cambios utiliza las cuentas patrimoniales registradas.\nPresupuesto y flujo de caja permite Definir presupuesto para una cuenta y mes. La pantalla compara Presupuesto, Real acumulado y Diferencia para el mes actual. La proyección por escenarios utiliza saldos de facturas pendientes y no garantiza su cobro. Los escenarios se basan en porcentajes de cobros y pagos que la propia pantalla describe; no incluyen automáticamente todos los movimientos futuros posibles.\nEl Calendario de cobros y pagos pendientes organiza documentos por vencimiento. Antigüedad de saldos es otra pantalla, sujeta a permiso contable, para separar Por vencer, 1–30 días, 31–60 días, 61–90 días y Más de 90 días. Estos análisis requieren registros completos y revisar empresa y sucursal. El asistente no lee indicadores, hace pronósticos particulares ni aconseja decisiones basadas en cifras desconocidas. Para interpretar márgenes y ratios o revisar supuestos de presupuesto, verifica con tu contador."
  },
  {
    "id": "personal",
    "modulo": "personal",
    "titulo": "Personal y herramientas laborales",
    "palabras_clave": [
      "nomina",
      "personal",
      "empleado",
      "empleados",
      "salario",
      "liquidacion",
      "vacaciones",
      "asistencia",
      "provision",
      "inss",
      "inatec",
      "aguinaldo"
    ],
    "texto": "Personal, Procesamiento de nómina y Liquidaciones y finiquitos separan expediente, cálculo y pago. En Procesamiento de nómina, + Nómina prepara el registro; Cerrar y pagar confirma la operación y conserva su asiento. No confundas un borrador pendiente con una nómina pagada. Detalle y la boleta de impresión permiten revisar el documento según el acceso disponible.\nLas reglas laborales y fiscales dependen de los parámetros de la empresa. La plantilla Nicaragua contiene valores de referencia editables y requiere revisión y confirmación; no certifica cumplimiento legal ni cambia nóminas ya pagadas. Si se activa IR progresivo, utiliza las reglas y tramos confirmados. INSS patronal e INATEC aparecen en el costo de personal cuando corresponda a la configuración.\nProvisiones mensuales muestra una reserva orientativa y su simple lectura no mueve dinero ni genera asientos automáticamente. Los devengos que sí generan asientos utilizan su confirmación específica. Asistencia y vacaciones incorpora registros de control del personal, sujeto al plan y permisos. No supongas aprobación de una solicitud solo porque fue registrada. El asistente no lee expedientes, calcula salarios ni modifica asistencia. Las tasas, prestaciones, fechas y base de cálculo necesitan revisión según el caso y la normativa vigente; verifica con tu contador."
  }
];
