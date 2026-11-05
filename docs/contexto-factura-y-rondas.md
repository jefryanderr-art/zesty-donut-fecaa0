# Contexto de factura y rondas de alimentos

## Continuación del 5 de noviembre: tarjetas, operación de alimentos y hornadas

Este apartado reemplaza el estado pendiente de la entrega anterior. **La solicitud completa todavía no quedó terminada.** Se conservaron las funciones entregadas y los identificadores de perfiles; los apartados anteriores a esta continuación quedan como historia de alcance.

### Base incorporada

Facturación añadió Tarjetas, vales y lealtad. Un responsable con acceso a Facturación, Contabilidad y Caja vende una tarjeta o vale con código único por sucursal, importe, pasivo acreedor elegido y entrada a Caja general o Banco. Cliente y vencimiento son opcionales. El movimiento reconoce un pasivo, no una venta ni impuestos de consumo. El saldo y sus movimientos usan centavos enteros seguros. El vencimiento bloquea el canje según la fecha de factura; no cancela el pasivo ni reconoce ingreso automáticamente. No se crean cuentas contables automáticamente.

La factura directa permite un vale combinado con efectivo, tarjeta, transferencia o crédito, con canjes parciales. Las fichas facturables permiten elegir un vale para la factura completa, conservando el contexto del servidor. Solo se reconoce ingreso al facturar los productos o servicios. El canje reduce el pasivo dentro de la misma transacción de la factura. La nota de crédito reduce primero la deuda pendiente conforme al cálculo vigente y restituye el componente reembolsable de vale hasta lo efectivamente canjeado; solo el exceso requiere devolución monetaria y turno. El dueño puede devolver el saldo disponible por Caja general o Banco. Una posterior nota de crédito puede reabrir una tarjeta cuyo saldo anterior se devolvió, conservando los límites del canje original. La expiración se conserva.

El dueño activa lealtad por frecuencia en cada sucursal: entre 2 y 100 compras ordinarias habilitan un descuento configurable en una compra posterior. No se implementaron puntos; frecuencia es la alternativa elegida de las dos solicitadas. El programa comienza al configurarse y cambiarlo inicia un nuevo ciclo, conservando la configuración anterior. Las facturas totalmente devueltas no cuentan; las parcialmente devueltas siguen contando como compra. Una compra beneficiada no acumula otra compra ordinaria. La consulta y el uso se validan en servidor; el descuento conserva contraseña, roles, máximo, autorización de un uso y bitácora existentes. La interfaz de lealtad está en la factura directa; todavía no se añadió a la facturación de cuentas/fichas. No hay descuento ni facturación automática.

### Alimentos incorporado

Cuentas abiertas ofrece Mesas y reservas con nombre, zona libre, capacidad, estado libre/ocupada/por cobrar/reservada, mesero, comensales y minutos abiertos para cuentas nuevas. La reserva guarda teléfono y horario, rechaza solapamientos y capacidad excedida, permite cancelar con motivo y abre una sola cuenta al recibir al cliente. La llegada y la apertura directa comprueban ocupación en servidor. Las cuentas sin mesa continúan funcionando. Atención / por cobrar actualiza mesero, comensales y marca de cobro. La división existente conserva la mesa; no se implementó una nueva asignación estructurada por persona. Los traslados de cuentas nuevas con mesa asignada se rechazan para no dejar desincronizado el tablero; falta una operación dedicada de traslado entre mesas.

Despacho incorporó zonas vinculadas con servicios del catálogo y datos estructurados de domicilio/retiro para pedidos independientes: teléfono, dirección, referencia, zona, hora prometida, repartidor y cobro anticipado/contra entrega. Configurar el envío reemplaza su línea anterior, sin duplicarla. Después de facturar no se cambia esa configuración. Los estados En camino y No entregado se añadieron al final de los existentes, con transiciones validadas y motivo de no entrega. Salir con un pedido prepagado requiere factura y cobro; entregar requiere una factura sin deuda. Contra entrega reutiliza factura al cobrar o factura a crédito y abono sobre el mismo documento. No entregado no anula facturas ni repone stock automáticamente.

La impresión operativa existente añade los datos de despacho. El aviso de atraso se calcula al abrir Despacho. El informe diario de repartidores requiere Facturación y Contabilidad o Finanzas: separa efectivo de pedidos contra entrega y comisión propuesta sobre el servicio de envío sin impuestos. Es propuesta, no pago ni liquidación; las devoluciones posteriores a la entrega requieren revisar manualmente esa propuesta. Las entregas se agrupan por fecha UTC y los cobros por fecha contable. Las rondas vinculadas a cocina conservan su flujo anterior y no se convierten en pedidos independientes de domicilio.

Ventas y Facturación añadieron Caja rápida por categoría con botones grandes; reutiliza precios, autorización y factura existentes. Su turno impreso usa la referencia que asigna el servidor a la factura. Pedidos listos muestra los tickets cargados y autorizados; no es una pantalla pública ni una conexión en tiempo real. Informes de alimentos muestra ventas netas por hora, productos vendidos ordenados por cantidad y anulaciones de consumos autorizadas. Las horas usan la zona configurada y los históricos sin hora se identifican. Con permisos de Producción, Inventario y Contabilidad/Finanzas muestra costo estimado de insumos por receta, margen bruto y faltantes de insumos. La disponibilidad es una consulta; no sustituye las validaciones de inventario de la venta ni agrega un bloqueo nuevo por falta de ingredientes cuando ya hay producto terminado. Solo se señala margen negativo; falta un umbral configurable de alerta.

### Panadería incorporado

Producción ofrece Hornadas y mostrador. La planificación consulta pedidos pendientes autorizados de cuentas/documentos de venta con fecha o vencimiento del día y ventas netas de los ocho días anteriores del mismo día de semana, incluyendo ceros. Sugiere el mayor entre pedidos y promedio menos existencia. No es un pronóstico de demanda y no produce ni compra automáticamente; depende de los permisos y documentos cargados. Todavía no hay un modelo especializado de encargos ni un enlace que descuente pedidos ya producidos de la planificación.

Registrar hornada reutiliza la producción y cálculo compartidos: escala los insumos para unidades antes del descarte y conserva la merma de receta. El descarte adicional de terminados exige motivo, cuenta de gasto/costo y permiso contable, genera su movimiento vinculado y deja cantidad apta, merma y referencia de producción. Un vencimiento opcional crea un lote del terminado por la cantidad apta, usando el FEFO existente. No se calcula una vida útil automática. Se conserva el bloqueo de producción para empresas con PEPS activado: todavía no distribuye el costo de las capas de insumos. La etiqueta conserva una instantánea de ingredientes y alérgenos declarados, lote, elaboración y vencimiento; se imprime con el flujo existente. No se deducen alérgenos ni se afirma cumplimiento normativo.

El conteo de mostrador registra apertura/cierre por zona y fecha una sola vez, con cantidad observada, existencia contable y notas. No cambia inventario ni interpreta automáticamente diferencias como merma: se debe investigar y registrar la corrección correspondiente. No se añadió aún conciliación completa de producción, venta, sobrante y desperdicio.

### Persistencia, permisos y comprobaciones

Los datos opcionales usan businessRecords, asientos y metadatos relacionales existentes en Netlify Database. Los importes nuevos utilizan nombres de centavos declarados en el conversor residual; el total de vales del cierre se declaró como importe monetario adicional. No se modificaron esquema ni migraciones aplicadas. Las operaciones nuevas usan actualización transaccional de empresa, permisos, plan, sucursal del servidor, revisión optimista, identificador idempotente, versiones y auditoría. Las tarjetas no se comparten entre sucursales en esta entrega. Las configuraciones auxiliares se excluyen de las listas y acciones contables genéricas. No se añadieron servicios externos, almacenamiento local ni fotos.

Se revisaron sintaxis y diferencias estáticamente. Se prepararon pruebas de tarjetas, frecuencia, reservas, cargos de envío y conteos para la plataforma; **no se ejecutaron pruebas, servidores ni compilaciones locales**. Las URL de recursos se renovaron con el script existente. La guía y respuestas rápidas del asistente se actualizaron sin enviar datos operativos nuevos a IA.

Después del despliegue quedan pendientes las pruebas reales de concurrencia e idempotencia contra Database; permisos por rol, plan, sucursal, consolidado y soporte; libro de pasivo e ingreso con canjes/NC parciales y mixtos; caja y arqueo sin sumar vales como efectivo; expiración y fechas; autorización y reversión de frecuencia; solapamientos y doble llegada; estados, cobros, no entrega, tarifa única y comisiones; stock/costos de hornadas con PEPS y FEFO; exportación/restauración y vistas con proyección limitada; impresión, móvil, oscuro, teclado y escape de contenido. Las comprobaciones estáticas no prueban esos resultados.

### Pendientes para continuar

- Base: integrar la selección de lealtad en facturas desde fichas/cuentas y pagos mixtos con vale en ese formulario. La factura directa ya permite ambas operaciones.
- Alimentos: modificadores estructurados y extras con opciones; asignación/división por persona; propina sugerida y reparto; traslado de cuentas entre mesas; ampliar domicilio desde cuentas/rondas vinculadas y liquidación real del repartidor; alerta configurable de margen; combos y menú del día; consumo interno y mermas generales con motivo; conteos de cocina/barra/bodega y compras de insumos por proveedor; rotación de mesas, productos nunca vendidos e informes de propinas. Los informes nuevos son consultables, sin nuevas exportaciones específicas.
- Catering: cotización por evento/invitados con insumos, calendario de anticipos/pagos, checklist, costos integrados, hoja de producción y lista de compras, entrega y facturación por etapas en una vista especializada. Los proyectos, anticipos y recetas anteriores se conservan, pero no equivalen a completar catering.
- Panadería: conversiones peso/unidad/docena/caja y porciones vinculadas; descuento de producto anterior autorizado; encargos de pasteles con foto/anticipo/saldo y tablero; mayoristas con programación; vida útil automática, reposición crítica; combos/cajas y precios de temporada; informes completos de producción contra venta, desperdicio y margen. El peso y FEFO anteriores y las hornadas nuevas no equivalen a implementar todas esas funciones.


## Historial de entregas anteriores

## Ampliación del 5 de noviembre: base común, avance parcial

Se completó una unidad de trabajo de la base común: ficha de cliente e historial consultable, tablero diario y alertas. **La base común todavía no está completa; alimentos y panadería no recibieron nuevas ampliaciones en esta continuación.** El siguiente trabajo comienza por tarjetas de regalo, vales y lealtad antes de pasar a alimentos y, finalmente, panadería. Las listas históricas siguientes describen la entrega anterior; este apartado actualiza su estado.

### Implementado

La ficha conserva crédito, notas y condiciones anteriores y añade cumpleaños opcional, validado en navegador y servidor. Editar conserva otros campos opcionales de la ficha. Historial y estado de cuenta reúne compras del cliente y servicios facturados, notas de crédito y cobros enlazados por identificador, incluidas las asignaciones de anticipos registradas en el libro. No se infieren vínculos por nombre. El saldo reutiliza la selección compartida del cálculo de crédito existente; requiere permiso de Contabilidad o Finanzas. Los usuarios con acceso a Ventas pueden consultar el historial autorizado. La sucursal y la moneda se indican expresamente; el consolidado conserva el alcance del servidor. No se convierten límites de crédito entre monedas.

El estado de cuenta se imprime o guarda como PDF con el flujo existente y se descarga como Excel. Notas internas y cumpleaños quedan fuera de ambos documentos. No se reemiten facturas ni se registran cobros al abrir o exportar la ficha. Los saldos iniciales y documentos históricos sin identificador del cliente continúan sin asignación automática.

El Panel ofrece Abrir tablero del día con el nombre del perfil existente, ventas con impuestos netas de notas de crédito, comparación con ayer y con los mismos días transcurridos del mes anterior, diferencias monetarias, cantidad de facturas y ticket promedio neto. El dueño puede guardar una meta diaria opcional por sucursal concreta, quitarla con cero y consultar el importe faltante. La meta se conserva en Netlify Database mediante la configuración existente, en centavos enteros seguros y con las revisiones y auditoría del guardado habitual. El servidor impide a colaboradores cambiar metas. No se conceden permisos o módulos al abrir el tablero.

Las alertas reúnen inventario al mínimo o por debajo, excluyendo servicios; lotes disponibles con cantidad positiva vencidos o próximos a vencer en treinta días; citas pendientes de hoy según el calendario del dispositivo; y facturas vinculadas con saldo vencido. Cada fuente exige su permiso y conserva el filtrado del servidor. Los cobros pendientes requieren Contabilidad o Finanzas. PDF y Excel incluyen el alcance, fecha, moneda y criterios. No se añadieron notificaciones externas ni automatismos de cobro, compra o descuento.

Se revisó estáticamente el cierre de turno existente: ya calcula efectivo esperado y contado, diferencia, autorización de supervisor para diferencias y entrega a Caja general o Banco, con referencias y movimientos. Se conservó sin crear un segundo cierre o asiento. Esto no sustituye su comprobación funcional posterior al despliegue.

No se cambiaron identificadores de perfiles, planes, datos históricos ni migraciones. Cumpleaños y metas utilizan el residual y la configuración existentes, sin nuevas columnas ni tablas. Se actualizó la guía local del asistente y se renovaron las URL de los recursos estáticos.

### Pendiente, en el orden solicitado

1. **Base común:** venta, saldo, canje y reversión de tarjetas de regalo y vales; lealtad opcional por puntos o frecuencia integrada con la política de descuentos. Requiere completar la operación transaccional, permisos, pasivo/saldos, canjes parciales y notas de crédito; todavía no se ofrece como forma de pago. No se declaró terminada la base.
2. **Alimentos:** catálogo y tablero de mesas con zona/capacidad/estados, reservas y llegada, modificadores y extras, división por persona, propinas y reparto, domicilio/retiro completo, costos y disponibilidad por receta, combos, menú diario, mermas, consumo y conteo por zona, informes especializados, caja rápida/pantalla de listos y catering por evento con producción, compras, pagos y facturación por etapas. Se conservan contexto, rondas, pre-cuenta y operaciones anteriores; no equivalen a completar estos requisitos.
3. **Panadería:** hornadas y sugerencia semanal, conversiones de presentaciones y porciones, mostrador, descuento de sobrantes, encargos con foto y anticipos, mayoristas programados, vida útil y ampliación FEFO, combos/cajas, temporada, etiquetas e informes especializados. El perfil `panaderia` se conserva intacto.

Las pasarelas, canales de reservas y burós continúan como conexiones opcionales futuras; esta continuación no añadió adaptadores ni reglas fiscales o legales.

### Comprobaciones pendientes después del despliegue

Solo se realizó revisión estática; no se ejecutaron pruebas, servidores ni compilaciones locales. Verificar guardado y recarga de cumpleaños en fichas antiguas/nuevas, fechas imposibles y futuras, conservación de campos opcionales y conflictos entre pestañas. Comparar el estado con ventas al contado/crédito mixto, cobros parciales, devoluciones, anticipos aplicados y saldos sin vínculo; revisar usuarios de solo lectura, cajeros, colaboradores con/sin permisos contables, planes limitados, sucursales y consolidado. Confirmar que notas y cumpleaños no salgan en PDF/Excel y que todo texto se escape.

Verificar comparación diaria/mensual en cambio de año, febrero y meses de distinta duración; citas cerca de medianoche en la zona del dispositivo; lotes vencidos, vacíos o cancelados; productos sin mínimo, servicios y existencias por sucursal; metas del dueño y rechazo por API de cambios de colaboradores, importes fraccionarios y fuera de rango. Confirmar guardado concurrente, PDF/Excel en móvil/oscuro y ausencia de facturas/asientos/descuentos de stock nuevos al consultar. El cierre original requiere revisar arqueo, diferencias, autorización y transferencia una sola vez. La plataforma realiza la validación y el despliegue.

Esta entrega cubre el contexto opcional de facturación, el informe por atención, las rondas de despacho vinculadas a cuentas, la anulación de consumos antes de facturar, la presentación de los perfiles de alimentos y el escalado visible de recetas. **No completa la solicitud de sistema empresarial de once secciones.** No debe presentarse el catálogo existente como implementación de todas las ampliaciones solicitadas.

## Compatibilidad y persistencia

Los identificadores históricos, incluidos `restaurante`, `comida_rapida` y `catering`, se conservaron. Los tres recomiendan Cuentas abiertas, Despacho, Producción, Comisiones y Documentos de venta, sin conceder permisos ni modificar planes guardados. Catering conserva Proyectos y su presentación de servicios. Se añadió `panaderia` como perfil independiente de inventario. Cambió únicamente el nombre visible de comida rápida para separar panadería; no se movieron empresas.

Los datos opcionales se guardan mediante las colecciones existentes de Netlify Database. `entries.saleContext` es una instantánea no monetaria con recurso, etiqueta, persona que atendió, modalidad, ticket, origen y proyecto. Los registros operativos conservan modalidad, notas por línea, identificador de línea, cantidades enviadas/anuladas y referencias de despacho. El codec residual existente conserva estos campos junto con las columnas relacionales y convierte los importes existentes de líneas y eventos. No se añadieron tablas ni columnas, no se requirió migración y no se editaron migraciones aplicadas. No se cambiaron saldos ni campos históricos al cargar empresas.

La factura directa acepta contexto opcional validado en servidor. Facturar una ficha construye la instantánea desde el registro del servidor, ignorando el contexto enviado por el navegador. Las notas de crédito copian la instantánea original. La impresión la incluye en el bloque del cliente en los tres formatos, incluso con diseño personalizado. El respaldo, las versiones y la restauración usan el documento y el codec existentes; su comprobación real sigue pendiente.

## Operación de alimentos

Las líneas de una cuenta admiten notas y modificadores. Los extras con precio se añaden como líneas de catálogo y conservan la política de precios actual. Enviar ronda exige Cuentas abiertas y Despacho, confirmación, revisión vigente, sucursal activa e identificador idempotente. Se seleccionan consumos pendientes y estación: cocina, barra o postres. El despacho guarda ticket, ronda, recurso y responsable, sin emitir factura, asiento ni movimiento de stock. Solo la cuenta factura. El servidor impide convertir un despacho vinculado en independiente mediante edición y rechaza facturarlo por separado. Las cantidades enviadas acompañan las divisiones parciales para evitar reenvíos.

Un despacho vinculado avanza una etapa cada vez. Cancelar la preparación requiere supervisor y motivo, pero no elimina el consumo de la cuenta. Anular consumo con motivo es una acción diferente: retira la línea completa de una cuenta abierta, marca las cantidades anuladas en los despachos, conserva la instantánea y el motivo en eventos y no repone stock. Después de facturar se usan notas de crédito. Abrir o mover una cuenta a un recurso ocupado requiere confirmación explícita. La pre-cuenta se identifica como documento no fiscal.

Producción comparte con la interfaz el cálculo puro `businessRecipePlan`: escala insumos según unidades terminadas, rendimiento y merma, mostrando existencia y faltantes antes de confirmar. La confirmación conserva las validaciones existentes de permisos, lotes FEFO, stock, costo y asiento. El perfil Panadería reutiliza estas operaciones; todavía no implementa planificación automática de hornadas ni todos los procesos especializados pedidos.

## Informe

Ventas por atención se abre desde Ventas o Facturación. Filtra fechas, recurso, persona y modalidad; incluye ventas históricas sin contexto y notas de crédito, permite Excel y la impresión/PDF del navegador. El total incluye impuestos y resta devoluciones; no representa cobros ni rentabilidad. Solo utiliza datos ya proyectados por permisos y sucursales. No es un nuevo estado financiero ni consulta información adicional del servidor. No se agregaron conexiones externas.

## Verificación pendiente en plataforma

Se comprobaron estáticamente la sintaxis y el formato del diff. Se prepararon pruebas nuevas, sin ejecutarlas. No se ejecutaron pruebas funcionales, servidores, compilaciones, migraciones ni despliegues manuales.

1. Ejecutar las pruebas de la plataforma, incluidas `tests/operating-context.test.mjs`, `tests/business-profiles.test.mjs`, codec, permisos y sucursales. Verificar idempotencia y conflicto entre dos pestañas contra Database real.
2. Comparar una empresa histórica antes/después: mismo perfil, documentos, permisos, saldos e inventario; factura sin contexto con apariencia habitual. Confirmar las 33 opciones de perfil sin reasignar empresas.
3. Emitir factura directa con y sin contexto; facturar cuenta, cita, proyecto, reserva y documento de venta. Intentar inyectar contexto diferente al de la ficha: debe prevalecer el servidor. Revisar crédito, anticipos, turnos, numeración y un solo asiento/descuento de stock.
4. Descargar ticket, Carta y A4 en los diseños disponibles. Revisar ambos ejemplares, diseñador, PDF descargable y nota de crédito parcial/total. Verificar escape de nombres y notas con caracteres HTML.
5. Filtrar Ventas por atención y comparar Excel/PDF con los documentos. Repetir con colaborador de lectura, plan limitado, sucursal individual y consolidado. El informe no debe conceder acceso adicional.
6. Crear cuenta sin mesa y dos cuentas en la misma mesa: la segunda debe exigir confirmación. Probar traslado a recurso ocupado y consumo con notas; imprimir pre-cuenta.
7. Enviar una ronda de cocina y otra de barra; reintentar la misma solicitud, repetir con otro identificador y competir desde otra pestaña. Solo deben enviarse cantidades pendientes. Comprobar que no cambian stock, caja, bancos ni asientos.
8. Intentar editar o facturar un despacho vinculado por API. Debe rechazarse. Dividir cantidades parcialmente enviadas, unir cuentas y agregar nuevos consumos; verificar que no se reenvíen cantidades preparadas.
9. Anular un consumo enviado con supervisor y motivo, también tras dividir/unir. Revisar cantidades anuladas, total de cuenta, eventos y comprobante. Intentar hacerlo con mesero sin autorización o sobre cuenta facturada: debe rechazarse. Cancelar solo un envío no debe eliminar el consumo del cobro.
10. Escalar una receta a varias tandas; revisar merma, faltantes y confirmación con lotes vencidos/insuficientes, series y sucursales. Comparar receta existente antes/después y confirmar un solo consumo y asiento.
11. Exportar/restaurar JSON y ZIP con contexto, notas, referencias, cantidades enviadas/anuladas y nuevo perfil. Confirmar sincronización relacional y versiones. Probar móvil, claro/oscuro, teclado y barra inferior.

## Alcance que permanece sin implementar en esta entrega

- Base: tarjetas de regalo, canje y lealtad; ampliación completa de ficha y cumpleaños; nuevas plantillas de roles; metas y tablero diario integral. Documentos, anticipos, límites de crédito, cobranza, sucursales y turnos anteriores se conservaron, sin afirmar que cubren todos los detalles nuevos.
- Alimentos: catálogo de mesas/zona/capacidad y reservas vinculadas, comensales y rotación; reparto de propinas, entrega por zonas/repartidor, combos y menú diario, conteos por zona y funciones completas de catering por invitados y calendario de pagos.
- Panadería: sugerencia por día de semana, hornadas programadas, mostrador de apertura/cierre, conversiones de porciones y presentaciones, vida útil automática, etiquetas de alérgenos, descuentos de sobrantes y encargos con foto.
- Comercio y servicios: todas las ampliaciones específicas nuevas de los puntos 4 y 5, más allá de las operaciones anteriores y del contexto compartido.
- Suscripciones: no se amplió Q en esta entrega; quedan pendientes los requisitos nuevos que no cubra su implementación anterior.
- Alquileres, hotel, financieros, producción y organizaciones: se conservaron sus módulos previos; no se implementaron aquí las ampliaciones especializadas de los puntos 7–10.
- Personalizado conserva la selección de capacidades implementadas y autorizadas; no ofrece como funcionales capacidades pendientes.

Pasarelas de pago, canales de reservas y burós de crédito permanecen como conexiones opcionales futuras, sin cargos, consultas ni sincronizaciones externas añadidos. Esta entrega no implementa todavía sus adaptadores internos completos. No se establecieron reglas legales o fiscales nuevas.
