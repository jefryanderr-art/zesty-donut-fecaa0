# Perfiles de negocio y capacidades reutilizables

## Arquitectura y compatibilidad

La entrega incorpora las nueve fases en un único cambio. Conserva el frontend estático, la API, las pantallas anteriores y el núcleo contable. No aplica conversiones contables ni reinterpreta registros históricos. Las columnas nuevas asignan `comercio`, personalización vacía y arranque omitido a las empresas existentes. Los movimientos, cuentas, productos, permisos y formatos anteriores conservan sus identificadores y significado.

`public/profiles.js` es un catálogo de datos compartido con Functions mediante `netlify/lib/business-profile.mjs`. Cada entrada contiene identificador, nombre, descripción, grupo, capacidades recomendadas y opcionales, rutas visibles, etiquetas, flujo de venta, preguntas rápidas y sugerencias iniciales. Agregar un **perfil** requiere una entrada, sin una implementación por rubro. Una **capacidad** nueva sí necesita su operación, permisos, persistencia y proyección; agregar un perfil no debe inventar capacidades inexistentes.

`public/business.js` adapta la navegación y añade vistas de las capacidades. Comercio conserva todas las rutas habituales; las capacidades nuevas se encuentran en Más módulos y pueden incorporarse al menú desde Personalizar mi sistema. Los demás perfiles muestran las recomendaciones. Ocultar una ruta nunca es una autorización ni elimina sus datos. El dueño puede cambiar perfil, etiquetas y rutas desde Ajustes con revisión vigente y auditoría. El selector está disponible al registrarse por correo, con Google y al crear otra empresa. El nombre real de empresa sigue encabezando el panel.

Las capacidades recomendadas no conceden permisos. Los colaboradores requieren permisos explícitos, y las restricciones previas de sus roles permanecen. Los planes pueden bloquear individualmente las 16 capacidades; aparecen en la edición de planes y su matriz del Centro de control. No se cambiaron precios ni planes guardados ni se activaron suscripciones. Las operaciones que generan facturas también necesitan Facturación; el control de lotes, series y producción necesita Inventario. Los asientos financieros explícitos necesitan Contabilidad y un responsable de Caja autorizado; los costos asociados necesitan Costos y las comisiones necesitan Personal.

## Persistencia, dinero, sucursales y recuperación

La migración generada `20261029221943_add_business_profiles_capabilities` añade columnas a empresas y versiones y la tabla RLS `acontec_business_records`. No cambia migraciones aplicadas. Se consultó el estado antes de generarla; su aplicación corresponde a la plataforma.

La colección `businessRecords` está declarada en `db/accounting-model.mjs`, en el adaptador relacional, en la proyección de permisos y en la dimensión de sucursales. Comparte la clave empresa/identificador y el índice empresa/fecha. Sus importes principales usan columnas BIGINT de centavos. Las cantidades y tasas usan precisión numérica. Los importes anidados conocidos se convierten mediante el codec residual; `interestPaid` también está declarado. La representación compatible del frontend y la copia JSON mantienen unidades monetarias, como el resto del sistema.

Las mutaciones pasan por `runOperation` y `updateCompany`: sesión y membresía, plan y permisos, sucursal de la sesión del servidor, bloqueo de empresa, revisión optimista, identificador idempotente, versiones, bitácora y sincronización de ambas representaciones en una transacción. Los registros de rubro no se pueden sobrescribir mediante `PUT /api/data`. El consolidado sigue siendo de consulta. Las series se comprueban contra toda la empresa, no solo la sucursal visible. No se confía en una sucursal enviada por el cliente.

El respaldo JSON y el ZIP completo incluyen los registros nuevos, el perfil y la personalización; las versiones incluyen los metadatos del perfil. El informe PDF completo incluye las fichas operativas autorizadas. La restauración conserva su revisión y validaciones; el perfil de un archivo antiguo sin ese campo no se cambia por inferencia. Si existen registros de un módulo sin permiso, el servidor rechaza una exportación completa en lugar de presentar una copia parcial como completa. Una restauración nunca elimina tablas o migraciones. Los datos anteriores a la entrega no reciben nuevos registros operativos automáticamente.

Los cálculos de cuotas, mora, comisiones, cargos y tarifas se comparten en `public/accounting-math.mjs`, importado por Functions. La vista de emisión usa el mismo cálculo de líneas y total; el servidor vuelve a validar todo. Los descuentos de las facturas anteriores conservan su autorización: una petición de rubro no puede introducir un descuento sin pasar por esa política. Los documentos de rubro conservan el precio confirmado, sujeto a las reglas vigentes del emisor; para cambiar el precio de catálogo o autorizar un descuento se usan las herramientas existentes.

## Catálogo completo

| Perfil | Capacidades recomendadas | Opcionales |
|---|---|---|
| Comercio general | Flujos actuales | Todas desde Más módulos |
| Minorista, pulpería y supermercado | G, O | K |
| Ropa, calzado y accesorios | E, O | — |
| Ferretería, materiales y repuestos | O, E | K |
| Farmacia y productos naturales | D, E, O | — |
| Electrónica y tecnología | E, C, O | — |
| Restaurante, bar y cafetería | A, F, L, M | — |
| Comida rápida y panadería | L, F, G | — |
| Catering y eventos | O, C, F | I |
| Servicios profesionales | B, C, I, O | — |
| Belleza, barbería y spa | B, M | A |
| Salud y veterinaria | B, A | D |
| Educación | I, B | — |
| Gimnasio y recreación | I, B, J | — |
| Talleres y reparaciones | C, E, O | D |
| Autolavado y lavandería | A, G, L | — |
| Hotel y alquiler vacacional | J, A, I | — |
| Alquiler de propiedades y equipos | I, J | — |
| Préstamos y empeño | H | I |
| Construcción | C, O | — |
| Agropecuario | D, G, F | — |
| Manufactura | F, O | D |
| Distribución mayorista | K, O | E |
| Transporte y logística | C, I | — |
| Organizaciones e iglesias | N, I | — |
| Personalizado | Selección manual | Todas |

P (impresión) está disponible como capacidad independiente; se puede bloquear por plan. Las demás capacidades se pueden abrir desde Más módulos cuando el plan y los permisos lo permiten.

## Uso y alcance por fase

### Fase 1: perfil y arranque

Elegir rubro en la creación o en Ajustes → Personalizar mi sistema. Automático sigue el catálogo; Visible y Oculto personalizan el menú. Las etiquetas de cliente, producto y documento se usan en las pantallas nuevas; se adaptan las etiquetas inequívocas de las pantallas anteriores sin renombrar cuentas o documentos guardados ni cambiar el significado fiscal de una factura.

El arranque aparece solo en empresas creadas después de esta entrega. Se puede omitir. Agregar ejemplos exige catálogo y libro vacíos y agrega categorías, unidades y productos/servicios sin precios, IVA ni existencias. Los ejemplos se editan con las herramientas habituales. Un servicio nuevo no tiene existencias ni costo inventariable; no se convierten productos históricos en servicios.

La ayuda local cambia con el perfil. El asistente conserva su disponibilidad del servidor, guía estática, límites de 20 por usuario y 100 por empresa por día, y preguntas rápidas sin IA. Solo se incorpora el nombre público del perfil al contexto de la guía; no se envían fichas, horarios, cartera ni contabilidad al proveedor.

### Fase 2: documentos, impresión, variantes y medidas

Documentos de venta permite preparar cotización, proforma, pedido, nota de entrega y solicitud de anticipo. Su creación no contabiliza. Emitir factura reutiliza el emisor, serie, turno y pagos existentes; el documento se vincula y no se convierte por segunda vez. Las cotizaciones y órdenes de compra anteriores siguen disponibles en su pantalla original.

Comprobantes adaptados imprime fichas, cuentas, órdenes, contratos y tablas de cartera mediante las opciones existentes A4, Carta y ticket. Los formatos de facturas anteriores permanecen. Estos comprobantes operativos no certifican un documento fiscal o contrato legal.

Variantes relaciona talla, color y modelo con un producto; para existencias y precios distintos se crean productos distintos. Las series/IMEI son únicas por empresa, se seleccionan al facturar, conservan garantía y se restituyen en una devolución identificada. La venta por medida registra bruto, tara, neto y precio por la unidad del producto. Se introduce la lectura manualmente o mediante un dispositivo que escribe como teclado; no se añadió un controlador de balanza.

### Fase 3: cuentas abiertas y despacho

Una cuenta abierta guarda consumos sin descontar inventario ni registrar ingreso hasta facturar. Agregar consumo admite nuevas líneas; Mover cambia recurso y responsable; Unir conserva una cuenta y el historial de la otra; Dividir admite cantidades por línea. No se unen o dividen cuentas con anticipos pendientes. El cargo de servicio o propina acordada se configura mediante porcentaje y un servicio del catálogo, con el IVA que haya definido la empresa: verifica con tu contador.

Despacho conserva modalidad, dirección, ticket correlativo por sucursal y estados Recibido, Preparando, Listo y Entregado. Su tablero permite preparación desde el teléfono o escritorio; emitir la factura es una acción explícita separada y no se repite al cambiar de estado.

### Fase 4: agenda, proyectos y comisiones

Agenda muestra calendario mensual y lista por recurso/horario; valida solapamientos en el servidor. Tiene duración, confirmación, atención, cancelación y recordatorio interno. Se puede registrar un anticipo y facturar la atención. La ficha y sus notas permiten referencias operativas simples; no constituyen un expediente clínico especializado. No introducir información sensible innecesaria.

Las órdenes de trabajo/proyectos conservan recepción, diagnóstico, etapas, materiales, mano de obra, subcontratos y unidad/vehículo. Facturar etapa exige una referencia única y selección explícita de conceptos; conserva todas las facturas parciales. Vincular compra asocia una compra existente a una sola obra sin modificar su asiento ni sus importes. Registrar costo asociado reutiliza Costos y conserva vínculo con la obra, viaje, lote o fondo. Las facturas, IVA, stock y libros permanecen únicos.

Comisiones vincula empleado, venta y tasa. Devengar toma el subtotal menos devoluciones ya registradas, impide duplicar la misma venta/empleado y conserva el pasivo; Liquidar paga una sola vez. Personal muestra las comisiones vinculadas. No se debe incluir de nuevo el mismo concepto en una nómina; una devolución posterior a un devengo requiere revisión y corrección contable documentada. No se inventaron reglas de contratación o prestaciones.

### Fase 5: lotes y producción

Los lotes distribuyen existencias ya compradas o producidas; no crean otra entrada de stock. Se guardan vencimiento, referencia opcional de receta/prescripción, ciclo y proyecto. La venta asigna FEFO entre lotes vigentes y rechaza cantidades sin lotes suficientes. Los lotes vencidos siguen visibles como alerta, pero no se venden. Las devoluciones conservan la procedencia.

Producción define terminado, insumos, rendimiento y merma. Producir descuenta ingredientes, agrega terminado y conserva el asiento de valoración y su referencia. Preparar automáticamente al vender produce únicamente el faltante del terminado. El costo sale del inventario, no del precio escrito en una receta. Se puede configurar una cuenta de diferencia de costo para los centavos de valoración. Una revalorización que afecte existencias de otras sucursales requiere revisión; no se hace silenciosamente. Los insumos con lotes usan FEFO; los insumos serializados requieren selección específica y se rechazan en la preparación automática. Un terminado con trazabilidad por lotes se produce y se asigna a su lote antes de vender.

### Fase 6: cartera y empeño

Cartera representa préstamos **otorgados**, separada de los préstamos recibidos anteriores. El borrador define deudor, capital, tasa por período, cuotas, frecuencia diaria/semanal/cada 15 días/mensual, método francés/capital constante/interés plano y mora diaria configurable sobre el capital de la cuota vencida. La tasa no se interpreta como anual. El último vencimiento y los centavos de capital se conservan en el plan. Revisar condiciones y cuentas: verifica con tu contador.

El desembolso confirmado reconoce el activo y la salida de dinero. Requiere subcuentas de activo exclusivas para capital e intereses y cuentas de ingreso distintas. Devengar vencidas reconoce interés y mora nuevos sin registrar dinero. Cobrar cuota aplica a la primera pendiente: primero interés/mora, luego capital; admite cobros parciales y evita cobrar más de su saldo. La mora no se vuelve a devengar por el mismo tramo; el cobro no repite intereses ya devengados. La ficha muestra amortización, cobros y estado de cuenta; los indicadores separan capital pendiente y cuotas vencidas.

La variante de empeño guarda prenda, valoración y vencimiento, y permite dejar constancia de su liberación tras liquidar el préstamo. No se presume transferencia de propiedad ni se ejecuta o vende automáticamente una garantía por mora: cualquier ejecución depende del contrato y la ley. No se implementaron refinanciación, condonación o ejecución judicial automáticas.

### Fase 7: contratos y reservas

Los contratos definen conceptos, frecuencia, períodos, mora opcional con un servicio de catálogo, recordatorio interno y umbral de suspensión de generación. Generar cobro exige un período vencido y confirmación, sin duplicar una factura anterior. La mora de facturas previas impagas se calcula al generar el siguiente cobro y guarda hasta qué fecha se aplicó. No hay cargos a tarjetas ni cobros o correos automáticos. La suspensión impide generar nuevas facturas según el umbral; no borra facturas ni bloquea la sesión del cliente.

Reservas mantiene recurso, horarios, disponibilidad, tarifas opcionales por temporada y unidad hora/día/noche. La emisión usa duración y tarifa compartidas con la vista previa. Un servicio de tarifa se agrega además de los consumos seleccionados; no agregarlo también como consumo si ya lo cubre la tarifa. Entrada y salida conservan historial. La salida exige factura confirmada y depósito aplicado.

Los anticipos y depósitos son pasivos, no ingresos. Se pueden devolver explícitamente. Para aplicarlos, emitir una factura a crédito con saldo suficiente. No se cancelan registros con depósitos pendientes sin devolverlos o aplicarlos.

### Fase 8: distribución y organizaciones

Preventa y rutas mantiene vendedor, ruta, pedido y consignación. Preparar una consignación reserva las cantidades; otra venta no puede consumirlas. El inventario continúa siendo propiedad de la empresa hasta la venta y la ubicación operativa queda en el pedido. La factura de entrega libera su propia reserva; cancelar un pedido sin factura libera la reserva sin asientos. Las devoluciones de ventas pasan por Notas de crédito. Con una comisión configurada, la venta crea una ficha de comisión para el empleado vinculado, sujeta a los permisos de Personal y Comisiones.

Aportes conserva socio/donante, fondo/proyecto y recibo. Confirmar reconoce dinero e ingreso con cuentas seleccionadas y permite asociar costos del fondo por el módulo existente. La impresión y los indicadores distinguen los aportes confirmados de borradores. Una cuota periódica usa Contratos con el concepto configurado; no se inventa exención fiscal ni deducibilidad.

### Fase 9: indicadores y guía

Las pantallas de capacidades muestran indicadores específicos (citas, cuentas, despacho, lotes, producción, cartera, contratos, consignación, comisiones y aportes). Finanzas y Decisiones incorporan un resumen por capacidades recomendadas del perfil y permisos reales. Las cifras operativas no sustituyen estados financieros. Los costos asociados se muestran cuando existe permiso de Costos; no se otorga acceso por elegir perfil. El filtro de fecha o búsqueda organiza la lista; los indicadores se rotulan sobre los registros del módulo, no como cierre fiscal del período.

## Verificaciones pendientes después del despliegue

No se ejecutaron pruebas, servidor ni compilaciones locales. Se revisaron estáticamente rutas, permisos, migración, codec, proyección, importaciones, escape y sintaxis. Las pruebas preparadas para la plataforma no se declararon aprobadas.

1. Confirmar migración aplicada, RLS y rol real de Functions. Comparar una empresa histórica antes/después: nombre, rutas, saldos, stock, documentos y permisos; debe seguir en comercio y sin ejemplos nuevos.
2. Crear empresas con correo y Google y seleccionar perfiles de los 26 rubros. Omitir o aplicar el arranque una sola vez; rechazarlo en empresa histórica o con movimientos. Editar los ejemplos sin saldos automáticos.
3. Cambiar perfil repetidamente; personalizar etiquetas y mostrar/ocultar módulos. Confirmar que Más módulos conserva acceso permitido y que no cambian registros.
4. Para cada una de las 16 capacidades: dueño, colaborador con lectura, con escritura y sin permiso; bloquear por plan y probar URL/API directa. Probar soporte temporal y empresas limitadas como solo lectura. Verificar aislamiento entre empresas y sucursales, y consolidado sin escritura.
5. Probar cotización/proforma/pedido/nota de entrega → factura con IVA, crédito, pagos y turno. Repetir petición con igual operación y forzar conflicto entre pestañas; confirmar una sola factura, numeración, asiento y revisión. Probar descuento inyectado, serie ocupada y permisos insuficientes.
6. Registrar variantes, series duplicadas entre sucursales, venta por medida, devoluciones parciales con serie y lote. Confirmar precio, unidad, costo histórico y Kardex.
7. Abrir/mover/unir/dividir cuentas, incluyendo cantidades parciales, y facturar. Probar cargo configurado, anticipo, devolución y aplicación; impedir cancelar o unir con depósito pendiente.
8. Despacho: correlativos y cambios concurrentes; verificar tablero y que entregar no factura dos veces. Agenda/reservas: horarios superpuestos, recursos distintos, duración, recordatorios, temporadas, entrada/salida y depósito.
9. Proyectos: diagnóstico, etapas únicas, facturas parciales, compras vinculadas sin duplicar asientos y costos asociados. Comisiones: devolución previa, devengo duplicado, liquidación duplicada y consulta en Personal; revisar corrección si hay una devolución posterior al devengo.
10. Lotes: cantidades contra stock, vencidos, FEFO, devolución y alertas. Producción: faltantes, rendimiento, merma, lote de insumo, costo, centavos de diferencia y rechazo de revalorización entre sucursales. Confirmar ingredientes/terminado/asientos sin duplicación.
11. Cartera: los tres métodos, las cuatro frecuencias, tasa cero, centavos finales, desembolso, devengo, cobro parcial, mora por fecha, pago duplicado, vencidas, liquidación y liberación de prenda. Comparar con un cálculo independiente aprobado por el contador.
12. Contratos: período repetido o futuro, cambio de fecha, mora ya aplicada, facturas pagadas y suspensión. No debe ocurrir ningún cargo o correo automático.
13. Rutas: reservas en consignación, otra venta que compite por stock, cancelación, factura, devolución y comisión del vendedor. Aportes: fondos, recibos, costos y asientos sin duplicación.
14. Descargar JSON, ZIP con versiones y PDF; verificar todos los campos nuevos y perfil. Restaurar una versión compatible y un archivo antiguo, conservando los controles previos sobre documentos contabilizados. Probar exportación denegada si falta acceso a un módulo que contiene datos.
15. Probar móvil, laptop, teclado, oscuro y orientación horizontal; la barra inferior no debe cubrir formularios ni acciones. Imprimir A4, Carta y ticket, y comparar las facturas anteriores.
16. Comprobar asistente desactivado/activado según sus controles existentes, preguntas rápidas por perfil sin consumo, cuotas intactas y ausencia de datos operativos en su solicitud.

Para revertir la presentación, seleccionar Comercio y personalización automática. No eliminar la tabla, documentos o migraciones. Los datos de las capacidades siguen accesibles desde Más módulos conforme a permisos y plan.
