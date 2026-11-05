# Préstamos, microfinanzas y empeño

Esta ampliación reutiliza exclusivamente Créditos otorgados / cartera: calendario, métodos de amortización, devengo, desembolso, cobros y liberación anteriores. No modifica comercio, servicios, hotel ni alquileres.

## Evaluación y cobros

Cada borrador nuevo requiere evaluación aprobada por el dueño antes del desembolso. Documenta ingresos mensuales, gastos, cuotas de otras deudas, evidencia administrativa, garantía o ausencia de ella y fiador opcional. La capacidad compara el ingreso disponible con la cuota máxima mensual equivalente: diaria por 30, semanal por 52/12, quincenal por 2 y mensual por 1. Es una orientación administrativa, sin consulta a centrales de riesgo ni verificación externa de documentos. La aprobación usa el plan guardado; el simulador separado permite explorar capital, tasa, número de cuotas y método sin cambiarlo. La aprobación no permite desembolsar antes de la fecha documentada de evaluación. Los borradores históricos conservan su compatibilidad; al evaluarlos o configurar un grupo se exige aprobación.

Cada evento de cobro conserva su asiento, cuota, capital, interés/mora, referencia, medio y gestor al cobrar, e imprime un recibo desde Detalle. Los cobros históricos conservan los datos disponibles, sin inventar asignaciones. Caja general y Banco reutilizan las cuentas anteriores y sus permisos. No hay integración con pasarelas ni conciliación bancaria automática. Los avisos consultables muestran cuotas próximas a siete días y vencidas, prendas próximas o vencidas y promesas que requieren revisión. No envían mensajes externos.

El grupo solidario tiene de dos a cincuenta integrantes del directorio, incluido el titular, un contrato y un calendario común. Se configura antes de aprobar. Cada cobro identifica aportes por integrante; la suma se aplica a una sola cuota mediante el cobro anterior y conserva un asiento y recibo. Para varias cuotas se confirma cada cobro por separado. No distribuye automáticamente obligaciones individuales ni añade desembolsos por persona.

## Cobranza, mora y cierre

El dueño asigna un gestor identificado por texto a la cuenta. Llamadas, visitas y promesas registran fecha, resultado, operador y gestor; las promesas incluyen importe y fecha. No constituyen geolocalización, telefonía ni creación de usuarios. Los avisos de promesas son orientativos y requieren revisión ante varios pagos parciales o varias promesas. No cambian el vencimiento de la cuota.

Cada cuenta permite configurar tramos ordenados desde cero días, acción de escalamiento y porcentaje de provisión sobre todo el capital pendiente. El informe agrupa al día, 1–30, 31–60, 61–90 y más de 90 días y muestra el detalle por gestor/cuenta. La provisión es una estimación consultable e imprimible, sin asiento automático. Cualquier reconocimiento contable de provisión conserva el circuito de asientos existente y la revisión del contador. El escalamiento indica la fase; no inicia llamadas, demandas ni ejecuciones automáticamente.

Refinanciación y reestructuración reprograman únicamente capital pendiente, con tasa y plazo nuevos y la misma modalidad de amortización. Exigen cobrar primero intereses y mora existentes o calculados a la fecha. Conservan todos los asientos, cobros y una copia de los calendarios previos. No capitalizan intereses, no otorgan dinero adicional y no crean un crédito sustituto; esas variantes permanecen fuera del alcance. El cierre anticipado muestra una liquidación confirmada de capital, intereses ya devengados o vencidos y mora a la fecha; excluye interés futuro no devengado. Conserva el calendario previo y ejecuta los cobros por cuota en la misma transacción e identificador de operación.

El castigo exige dueño, motivo/documento, confirmación escrita CASTIGAR y cuenta de gasto por incobrabilidad. Cancela únicamente capital pendiente e intereses/mora ya reconocidos contra gasto, conserva calendario, historial y marca expresa de castigo. No contabiliza ingresos futuros, elimina datos, libera prendas ni reaplica provisiones contables anteriores automáticamente. Debe revisarse con el contador antes de confirmar, especialmente si se reconocieron provisiones mediante otros asientos.

## Empeño e informes

La garantía, valor y vencimiento existentes se conservan. El dueño registra avalúos con perito/referencia y constancia; cada valor anterior queda en el evento. La liberación existente permite imprimir constancia. El remate registra comprador/documento/condiciones y permite imprimir constancia solo tras liquidar la cuenta mediante cobros registrados. No organiza subastas, transfiere propiedad automáticamente, maneja inventario de prendas ni calcula excedentes del remate o déficits; un castigo no habilita liberar/rematar la prenda por este circuito.

La ficha del deudor reúne los créditos accesibles del mismo titular, sus garantías, fiador, evaluación, cobros y calendarios anteriores. El informe filtra colocaciones y recuperaciones por fechas; atribuye recuperación al gestor registrado cuando se cobró. Los saldos y la antigüedad se calculan sobre el estado actual evaluado a la fecha elegida, sin reconstrucción histórica de pagos posteriores. Los recibos vinculan cada cobro con el asiento en Contabilidad y su entrada en Caja general o Banco. No sustituye el libro mayor ni la conciliación de cuentas bancarias individuales.

## Persistencia y verificación

Los datos usan businessRecords en Netlify Database y el codec relacional/residual vigente. Los importes nuevos se expresan en centavos enteros declarados; la API conserva revisión optimista, transacción, idempotencia, propiedad, permisos por plan/módulo, sucursal del servidor, versiones y auditoría. No se cambian esquema ni migraciones aplicadas. Las conversaciones y los datos financieros no se envían a la guía del asistente.

Se revisaron estáticamente sintaxis, importaciones y conexiones de operaciones y recursos. Se prepararon casos para la plataforma sobre liquidación sin interés futuro, pagos parciales, capacidad, tramos, permisos y reestructuración. No se ejecutaron pruebas, servidores ni compilaciones locales. Quedan pendientes tras el despliegue empaquetado, pruebas funcionales y contables, concurrencia, revisión/idempotencia y rollback transaccional de cobros grupales/cierre, RLS y restauración, planes, roles, soporte de solo lectura y sucursales/consolidado, evaluación y cambios entre pestañas, cuotas e intereses/mora, castigos con provisiones previas, recibos, constancias, móvil, teclado y modo oscuro. La revisión estática no acredita estas comprobaciones.
