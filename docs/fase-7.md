# Fase 7: personal y nómina

Se implementaron los cinco módulos solicitados de forma aditiva. Las constancias existentes se conservaron sin rehacerlas. Las casillas indican código y pruebas escritas, no validación funcional ejecutada.

- [x] Adelantos/préstamos: desembolso, cuotas exactas, organización de saldos históricos confirmados, reserva y descuento al pagar planilla.
- [x] Vacaciones: calendario mensual, solicitud, aprobación/rechazo, saldo y pasivo estimado.
- [x] Planillas por sucursal y área: preparación, reservas, pago transaccional, cancelación pendiente y costo de salarios, cargas y provisiones.
- [x] Comisiones por meta: mínimo, escalas marginales por tramo, resultado confirmado y vinculación única a planilla.
- [x] Constancias anteriores: conservadas sin rehacer.
- [x] Parámetros laborales por país: versiones editables con vigencia y sin tasas legales predefinidas.
- [ ] Verificación funcional, permisos desplegados, concurrencia, RLS y revisión visual.

## Alcance y límites

Constancias laborales está en Más módulos. Comienza apagado por sucursal. Solo el dueño, con escritura en Constancias laborales y Personal, configura ambos textos, activa o desactiva, confirma e indica motivo. La operación usa runOperation/updateCompany: revisión, identificador idempotente, transacción, bitácora y respaldos existentes. La configuración tiene versión e historial de motivos; las versiones completas se conservan mediante el respaldo existente. Guardados generales y operaciones genéricas de negocio no pueden cambiarla.

Las consultas y descargas requieren lectura en ambos módulos y plan que los permita. El permiso propio ofrece Sin acceso / Lectura / Lectura y escritura mediante el catálogo existente. Personal también limita roles y planes. Soporte temporal y empresas limitadas mantienen solo lectura. Se exige una sucursal del servidor y no se acepta la del navegador como autorización; el consolidado queda excluido. Los endpoints entregan únicamente selección de nombres y datos del empleado requerido, sin documento de identidad, cuentas bancarias ni números de seguridad social.

Ingresos significa percepciones **brutas** de nóminas pagadas según fecha de pago inclusiva; excluye pendientes, adelantos y liquidaciones. Se suman en centavos seguros en accounting-math; no se recalculan salarios ni tasas históricos y se rechazan fracciones de centavo. No constituye certificación oficial ni asesoría laboral: verifica con tu contador. Los importes descargados se identifican explícitamente como centavos y moneda. La constancia de trabajo no expone ingresos.

El texto es literal, sin HTML ni variables; se escapa en los formularios. PDF y CSV incluyen empresa, sucursal, período, fecha, generador, versión del formato y del texto. Ambas descargas registran auditoría antes de devolver datos: el evento acredita la solicitud autorizada, no que el navegador guardó el archivo. CSV protege fórmulas. No hay firma digital, envío externo, almacenamiento de PDF ni numeración nueva. Se reutilizan las librerías locales. Los controles usan los estilos existentes, sin modificar style.css ni agregar CSS. Responsive, oscuro y separación de .bnav requieren comprobación visual.

## Persistencia, migración y reversión

Migraciones: **ninguna**. La configuración usa businessRecords en Netlify Database, con su tabla, índice por empresa, RLS, codec, filtrado de sucursal, respaldo y versiones existentes. No se agregaron campos monetarios persistidos: incomeCents es una proyección efímera calculada en el servidor. No se modificó esquema ni migración aplicada. Desactivar conserva datos y bloquea nuevas descargas; una reversión debe conservar documentos, filas y versiones.

## Archivos

Nuevos: netlify/lib/employment-certificates.mjs, public/employment-certificates.js y tests/employment-certificates.test.mjs.

Modificados: public/accounting-math.mjs añadió solo la suma pura de ingresos; netlify/lib/operations.mjs incorporó rutas protegidas y guardas; netlify/lib/business.mjs validó y reservó configuración; public/profiles.js incorporó el permiso y ruta al catálogo; public/business.js agregó textos editables del acceso; public/ui-texts.js y public/ui-text-catalog.mjs incorporaron uiT; public/index.html cargó el módulo. netlify/lib/assistant-guide.mjs añadió instrucciones sin datos de empleados. public/analytics.js y public/operations.js cambiaron únicamente huellas de dependencias; docs/avance-mejoras.md y este documento registraron el alcance. scripts/version-assets.mjs actualizó URL de caché sin compilar.

## Comprobaciones

Pruebas escritas: apagado, activación, motivo y confirmación, restricciones de dueño/soporte/límite, ambos permisos, separación de sucursal, versiones, desactivación sin borrar, selección de empleado, período, suma solo de pagos, rechazo de fracciones y contrato de integración. No se ejecutaron pruebas, servidor, build ni npm test.

Tras el despliegue, **no verificado**: permisos reales con los cuatro planes y colaboradores (sin acceso/lectura/escritura), soporte y empresas limitadas; sesión y origen; activación por sucursal; revisión vencida e idempotencia concurrente; bloqueo de guardado genérico; filtrado entre empresas/sucursales; PDF largo con tildes; CSV con fórmulas; ingresos por fecha y nóminas históricas; auditoría; respaldo/restauración relacional y RLS usando el rol real de Functions; teléfono, laptop, oscuro y .bnav. Comprobar conservación de datos al desactivar. Riesgos: confundir bruto con neto, texto laboral incorrecto y formatos visuales aún sin verificar.

Verificación ligera realizada: `node --check` pasó en cada JS/MJS modificado o nuevo, incluidas las pruebas escritas. `git diff --check` pasó. Esto acredita sintaxis y formato, no ejecución de pruebas ni funcionamiento.


## Entrega de los cinco módulos (2026-11-04)

Se añadieron `netlify/lib/personnel.mjs`, `public/personnel.js`, `public/personnel.css` y cinco pruebas breves `tests/personnel-*.test.mjs`. La integración aditiva modificó operations, access, business, accounting-codec, el catálogo de perfiles, el índice, los catálogos uiT y la guía del asistente. Se actualizaron las huellas de caché mediante el script existente; style.css, las constancias, el motor monetario y las fórmulas de nómina histórica no se modificaron. No hubo dependencias, tablas, columnas ni migraciones nuevas.

Los cinco permisos propios son prestamos_personal, vacaciones_personal, planillas_area, comisiones_meta y parametros_laborales. El catálogo los incorpora a Accesibilidad, rutas y módulos bloqueables por plan. También se exige Personal. Cada módulo comienza sin configuración y apagado; solamente el dueño lo activa/desactiva por sucursal con motivo y confirmación. Toda escritura usa runOperation/updateCompany, UUID idempotente, revisión, transacción y bitácora existentes. Los permisos, el plan, el límite de consulta y el soporte se comprueban en servidor. Desembolsos y pagos requieren además Contabilidad y responsable autorizado de Cajas. No se acepta la sucursal del navegador.

La persistencia usa businessRecords en Netlify Database, con dimensión de sucursal, RLS, proyección, versiones y respaldos existentes. Los nuevos metadatos monetarios están declarados como centavos nativos en el codec residual; las columnas monetarias del diario y de payrolls conservan BIGINT. Las planillas guardan una representación compatible en payrolls para consultas y constancias existentes. guardPersonnel bloquea escrituras genéricas de estas fichas, cierre clásico de planillas extendidas y cambios o eliminación de cualquier nómina pagada. Los registros históricos no reciben tasas, recalculados ni descuentos nuevos.

### Flujo operativo

1. En Más módulos, activar Parámetros laborales por país y guardar país, vigencia, días del mes/año, días anuales de vacaciones y tasas en puntos básicos. Cien puntos básicos equivalen a uno por ciento. Cero se introduce explícitamente; no hay tasas legales de respaldo. Cada nueva versión conserva las anteriores. La última versión aplicable a la sucursal define su país/reglas; no hay mezcla simultánea de jurisdicciones dentro de una planilla.
2. Activar por separado los demás módulos. Adelantos registra empleado, concepto, capital, cuenta y cuotas; el residuo se distribuye en centavos sin perder capital. Organizar cuotas históricas requiere confirmar el saldo conciliado, hasta el capital original; no modifica el adelanto anterior ni repite desembolso. Los descuentos históricos manuales no se infieren: el usuario concilia el saldo y evita repetirlo en la nómina clásica. Préstamos son de capital sin interés, acorde con el alcance previo de adelantos del servidor.
3. Vacaciones registra fechas naturales inclusivas. Aprobar revalida solapamientos y saldo. El saldo usa días completos devengados según antigüedad, días anuales/año configurados, vacaciones utilizadas históricas y nuevas aprobaciones. Solicitudes pendientes no consumen saldo; una segunda aprobación relee todas las aprobadas. El calendario muestra el mes de la fecha inicial del período. El pasivo es saldo de días por salario diario configurado; no es liquidación legal ni crea provisión contable automáticamente. Las solicitudes aprobadas conservan una copia de reglas; el informe estima con las vigentes al corte. No suma otra vez vacationRequests históricos ya contabilizados en vacationsUsed.
4. Comisiones registra empleado, período, resultado confirmado, meta mínima y tramos crecientes desde cero. La comisión es marginal por tramo, con redondeo al centavo por tramo, y vale cero si no alcanza la meta. La atribución del resultado es manual con motivo, no una inferencia automática de ventas. Se impiden metas superpuestas y metas sobre períodos con nómina. La inclusión en planilla rechaza comisiones fijas registradas en el mismo período para exigir conciliación y evitar duplicación. Las comisiones fijas previas siguen usando sus operaciones existentes.
5. Planillas por área prepara cada empleado en la sucursal activa y área indicada. Conserva salario del período, reglas vigentes al inicio, cargas, provisiones, metas y cuotas seleccionadas. La frecuencia/horas extra/bonos de la nómina clásica permanecen en su flujo previo: esta nueva preparación recibe el salario del período confirmado. Las cuotas quedan reservadas; no se descuentan de caja antes de pagar. Pagar confirma fecha, banco/caja y cuentas de gasto/pasivo para cargas y provisiones. Crea un único asiento por salario bruto, retenciones, cuotas, neto, cargas y provisiones; no admite segundo pago. Cancelar pendiente conserva la ficha, libera cuotas/metas y elimina solo el borrador compatible no pagado. El reporte muestra detalle y totales por área/estado; separa pendientes y pagadas. Se rechazan períodos superpuestos con planillas extendidas, también al guardar desde la nómina clásica.

### Informes, interfaz y reversión

Los cinco módulos ofrecen PDF y CSV mediante las librerías locales existentes. Los archivos incluyen empresa, sucursal, período, autor, fecha, revisión, versión y aviso; los importes se identifican en centavos. Vacaciones agrega solicitudes y fechas al reporte de saldos/pasivo, y planillas incluye totales por área y estado. Las descargas pasan por autorización y auditoría antes de entregar datos. CSV neutraliza fórmulas. No se almacenan PDF ni se envían correos. Los formularios y tablas usan uiT/escape, estilos existentes y CSS nuevo acotado para el calendario y los tramos, con adaptación móvil y colores heredados para oscuro. Las configuraciones, cuotas, solicitudes y copias de tasas están incluidas en respaldos JSON/ZIP y PDF completo mediante businessRecords existentes.

Desactivar conserva filas, asientos, versiones e historial y bloquea operaciones nuevas. Para volver atrás se retira la interfaz o se desactivan los módulos conservando tablas y documentos. Las guardas impiden restaurar un respaldo que cambie fichas gestionadas o nóminas pagadas: no se debe usar restauración para deshacer pagos. Un pago registrado requiere una corrección contable documentada; no se añadió reversa automática ni borrado de pagos. No hubo despliegue, mezcla con principal ni commits manuales.

### Comprobaciones de esta entrega

Se escribieron cinco pruebas: reparto exacto de cuotas e inmutabilidad histórica; saldo/pasivo con aprobaciones; costo de planilla y pago único; comisión marginal; parámetros obligatorios y activación de dueño. No se ejecutaron pruebas, npm test, servidores ni compilaciones. La revisión permitida fue node --check y git diff --check, además de actualizar las URL de recursos sin compilar.

Pendiente tras validación de la plataforma: ejecutar las cinco pruebas y regresiones existentes; validar rol real/RLS y persistencia relacional; probar dueño y colaboradores con sin acceso/lectura/escritura en los cuatro planes, soporte temporal y empresa limitada; aislamiento entre empresas/sucursales y rechazo del consolidado; sesión/origen/JSON; revisión vencida y reintentos idempotentes concurrentes; dos pagos y dos aprobaciones simultáneas; reservas y cancelaciones; nóminas clásicas y pagadas exactamente iguales; saldos históricos conciliados; versiones de país con vigencias; PDF largo/tildes y CSV; respaldo y guardas de restauración; teléfono/laptop, claro/oscuro y separación de navegación móvil. Estas verificaciones no se acreditan por sintaxis.

Resultado de verificación ligera: node --check pasó en los 16 archivos JS/MJS nuevos o modificados revisados (incluidas las cinco pruebas, sin ejecutarlas). git diff --check pasó. Se actualizaron las huellas con el script existente.
