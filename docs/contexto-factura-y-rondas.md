# Contexto de factura y rondas de alimentos

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
