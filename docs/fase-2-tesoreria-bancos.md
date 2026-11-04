# Tesorería y bancos: estado de implementación

La implementación escrita de F2.3–F2.7 amplió la conciliación previa sin rehacerla. Ningún módulo nuevo se activa automáticamente. La validación funcional de toda la fase corresponde a la plataforma y no se afirmó como realizada. Fase 3 no se inició.

## Entrega F2.3–F2.7 — 2026-11-04

Se añadió el código de los cinco ítems, sus permisos independientes, pantallas en español, pruebas escritas, textos editoriales, informes PDF/CSV y documentación. Esta es una entrega de implementación revisada estáticamente: **funcionamiento, integración, concurrencia, RLS y presentación no verificados**. No se ejecutaron pruebas, servidores ni compilaciones, ni se desplegó. Fase 3 no se inició. PEPS y promedio ponderado no cambiaron.

### Acceso y persistencia compartidos

Los módulos `flujo_proyectado`, `pagos_lote`, `anticipos`, `revalorizacion` y `tipos_cambio` tienen sus tres niveles de permisos, exclusión por plan y acceso desde Más módulos. Son opcionales en los perfiles, sin cambiar el menú histórico de Comercio. Facturación los excluye también con planes guardados anteriores al catálogo; los otros planes respetan sus exclusiones actuales. Las fuentes de proyección se filtran por sus permisos y plan; el informe advierte las exclusiones. Contabilidad se exige además para leer los informes financieros y contabilizar; proveedores, ventas, caja y bancos se comprueban según la acción. Soporte temporal y empresas limitadas no escriben.

Todos los módulos nacen sin activación. Solo el dueño cambia su interruptor con confirmación, motivo y fecha efectiva de hoy en America/Managua. El primer inicio se conserva al reactivar. Desactivar conserva documentos, descargas y guardas. La fuente oficial tiene un segundo interruptor inicialmente apagado. No hay activaciones masivas, cobros, correos, transferencias externas ni tareas programadas nuevas.

Las mutaciones se despachan desde `runOperation`, bajo `updateCompany`: sesión y empresa, membresía, plan, sucursal de la sesión del servidor, fila de empresa bloqueada, revisión optimista, recibo idempotente por UUID/cuerpo/actor, auditoría, versiones y sincronización relacional en una transacción. El consolidado no admite mutaciones. Las aplicaciones y pagos vuelven a leer los saldos bloqueados; una operación con revisión antigua no puede pagar una deuda ya saldada. La preparación no reserva efectivo ni paga.

No se añadió esquema ni migración. Se reutilizaron `businessRecords`, `exchangeRates`, configuración y líneas de diario ya normalizados en Netlify Database, con sus índices por empresa/fecha y RLS existentes. Las nuevas magnitudes residuales se declararon como centavos enteros seguros en el codec; los débitos/créditos se almacenan en las columnas BIGINT existentes. No hubo persistencia local, servicios de base de datos externos ni dependencias nuevas. JSON/ZIP y PDF completo ya recorren configuración, fichas y campos; incluyen los nuevos registros y asignaciones. Los escenarios se mantienen solo en memoria durante la consulta y figuran en su descarga; no son un presupuesto guardado.

### F2.3 — Proyección y método indirecto

La consulta reúne facturas por cobrar/pagar, plantillas activas aún no contabilizadas por mes, períodos de Q sin facturar, nóminas pendientes de contabilizar, obligaciones fiscales pendientes y cuotas de préstamos sin asiento. Q descuenta su depósito disponible una sola vez de los próximos períodos; no duplica períodos facturados. La proyección inicia hoy o después, tiene horizonte máximo de 366 días y agrupación semanal (desde la fecha inicial) o mensual. Los escenarios editan retraso en días e incobrables en puntos básicos, con sus supuestos visibles y exportados. Se calculan saldos diarios, reserva base, semáforo y primer saldo negativo aunque la agrupación sea mensual. Un faltante inicial o intermedio no desaparece al recuperarse el saldo final.

La moneda base es NIO o USD. Los documentos originales en divisas y aperturas/movimientos bancarios confirmados permiten el desglose por moneda original; no se asigna una moneda supuesta a facturas históricas sin ella. Las obligaciones sin vencimiento se sitúan al inicio y se identifican. La reserva se expresa en moneda base; los desgloses originales muestran liquidez sin trasladarles arbitrariamente esa reserva. No se inventan nóminas, impuestos ni obligaciones que aún no existen. Los importes previstos usan las condiciones registradas, sin pronosticar tasas futuras. El informe advierte que no garantiza liquidez ni cobro.

El método indirecto parte del resultado neto, muestra las variaciones de cuentas no monetarias y las clasifica en capital de trabajo, inversión o financiación, hasta conciliar la variación total con el efectivo del método actual. Excluye aperturas igual que ese método. Muestra los ajustes por asiento/cuenta, diferencia y explicación; no la fuerza a cero. El efecto cambiario sobre efectivo se identifica separadamente y no representa movimiento de moneda original. No sustituye ni cambia el estado de flujo previo. PDF/CSV contienen escenarios, fuentes, ajustes, diferencias y metadatos; la descarga se audita.

### F2.4 — Lotes de proveedores

El dueño configura umbral en centavos y listas de preparadores/aprobadores entre dueño y miembros activos. La pantalla de configuración reutiliza la consulta de accesos, por lo que requiere además acceso a esa administración. Cada lote conserva la política de su preparación. Se eligen facturas, vencimientos e importes parciales. Si existen condiciones documentadas `earlyPaymentDiscount` con fecha límite e importe máximo, se permite un descuento dentro de ellas: se vuelve a comprobar al pagar y se descuenta lo consumido en otros lotes. No se crea un editor de términos de pago de Fase 3.

Al alcanzar el umbral se exige aprobación de una identidad autorizada distinta del preparador. Bajo el umbral puede ejecutarse sin aprobación adicional. Se admite rechazo antes de contabilizar. Un pago produce **un único asiento** con líneas identificadas por factura, una contrapartida de dinero y, cuando corresponda, descuento financiero. La deuda, antigüedad, historial y cobro/pago ordinario reconocen esas asignaciones sin duplicar asientos ni reinterpretar los que no las tienen.

Se paga desde Caja general, Banco NIO/USD incorporado o caja chica activa según permisos, responsable y límite del fondo. Se comprueba que no haya sobregiro en la fecha ni en fechas posteriores ya registradas; se conservan vales pendientes y se ajusta el efectivo del fondo. En un banco de otra moneda se confirman importe original, tasa, fuente y fecha: el equivalente debe coincidir exactamente con el total neto base del lote. Se comprueban ambos saldos y se añade el movimiento original vinculado al mismo asiento único, sin otro asiento. La reversa conserva el importe y la tasa originales con signo inverso. Los anticipos generales usan cuentas de moneda base; no se infieren importes originales. El dueño puede revertir un lote pagado una sola vez, con motivo y líneas inversas; el lote y asiento originales son inmutables. La constancia PDF imprimible y el CSV incluyen detalle, aprobadores, asientos y metadatos, con auditoría de descarga.

### F2.5 — Anticipos

Los anticipos generales se registran por tercero identificado y sucursal: cliente contra pasivo 2108, proveedor contra activo 1205, hasta aplicarlos. Se valida la naturaleza de cuentas existentes antes de usarlas. Su saldo pendiente y eventos figuran en el informe y descargas. Aplicar permite uno o varios documentos del mismo tercero, total o parcialmente, sin superar ningún saldo. Las aplicaciones se reflejan en las facturas mediante las líneas del único asiento de aplicación. Devolver solo admite saldo no aplicado y registra una devolución explícita, con controles de caja; no elimina documentos.

Los depósitos de Reservas, Contratos y Q aparecen vinculados. Su aplicación parcial utiliza **la misma ficha, saldo y cuenta originales**, con permiso adicional del módulo de origen; no crea otro anticipo. Q recibe además la referencia original de negocio para reconstruir su informe. La devolución sigue usando `businessRefund` o `recurringRefund`. Con Anticipos activado se habilita el registro de depósitos de Contratos mediante la operación de negocio existente; sin activación se conserva su disponibilidad anterior. Los mecanismos anteriores de facturación/aplicación automática permanecen. Con Anticipos activado no se permite finalizar/cancelar ni restaurar una ficha con depósito pendiente sin aplicarlo o devolverlo. Las aplicaciones contabilizadas no se borran ni editan; su corrección conserva el diario y requiere el documento contable autorizado, sin reabrir por interfaz un saldo consumido.

### F2.6 — Revalorización

El interruptor independiente nace apagado, solo hacia adelante. La vista previa requiere último día de un mes ya terminado, posterior a la activación, período abierto y tasa de ese mismo cierre con fuente. Incluye saldos originales de bancos/tarjetas y documentos por cobrar/pagar en `foreignDocuments`. No infiere divisas de documentos históricos sin original; no migra esos documentos. La diferencia entre valor a tasa de cierre y valor contable se lleva a ganancia/pérdida cambiaria no realizada. El asiento exige confirmar una huella recalculada en servidor. Hay un documento por sucursal/mes con todas las exposiciones por cuenta y documento; no se puede repetir una cuenta en ese cierre mediante otro lote.

La acción de reversa propone automáticamente el primer día del mes siguiente y exige confirmación y motivo; genera las líneas inversas exactamente una vez, sin cron. Un cierre posterior exige resolver la reversa anterior. Los períodos cerrados y las conciliaciones bancarias cerradas conservan su bloqueo; no se reabren. Se rechaza cerrar retroactivamente después de liquidaciones de divisas posteriores para no cambiar su significado. Los ajustes autorizados cambian valor en libros sin crear movimientos originales ficticios: la guarda bancaria solo exime esos asientos vinculados al documento confirmado; conserva todas las demás correspondencias, aperturas y cierres. Vista previa, documento y reversa tienen PDF/CSV. Verifica con tu contador.

### F2.7 — Tasas y fuente opcional

Archivo CSV/XLSX local de hasta 1 MB y 1000 filas o pegado separado por tabuladores, sin encabezado, con cuatro columnas: fecha ISO, moneda original NIO/USD, tasa base/original hasta seis decimales y fuente de 3–200 caracteres. Se exige vista previa vigente antes de confirmar; servidor vuelve a validar fechas reales, moneda distinta de la base, tasa positiva, rango, ausencia de duplicados tanto en el archivo como frente a lo guardado y ausencia de fechas futuras. Cada tasa conserva fecha de tasa, fuente, importador y hora. No se sobrescriben tasas importadas ni se recalculan operaciones registradas.

El adaptador manual utiliza el servicio público SOAP del Banco Central de Nicaragua: `https://servicios.bcn.gob.ni/Tc_Servicio/ServicioTC.asmx`, operación `RecuperaTC_Dia` con año, mes y día. Requiere dos activaciones por empresa y `BCN_RATES_ENABLED=true` en configuración de Functions; sin ello no solicita red. Para base USD calcula la inversa en millonésimas con enteros. No hay URL arbitraria ni credenciales. Se limita a una llamada de ocho segundos, sin reintentos ni redirecciones y con límite de respuesta de 200 KB. Rechaza entidades, fallos SOAP, formato desconocido o tasa inválida. Una falta de red/configuración devuelve disponibilidad falsa sin afectar datos. La consulta prepara filas para revisar/importar: no guarda automáticamente. La compatibilidad real del servicio oficial **no está verificada**; un cambio o indisponibilidad de su contrato deja disponible la importación manual, sin inventar tasas.

### Archivos y compatibilidad

Archivos añadidos: `netlify/lib/treasury.mjs` (operaciones y proyecciones), `netlify/lib/treasury-rates.mjs` (adaptador optativo), `public/treasury.js` (cinco pantallas, formularios y descargas) y `tests/treasury.test.mjs` (reglas y contratos de integración escritos).

Archivos existentes modificados y motivo:

- `public/accounting-math.mjs`: cálculos puros nuevos y selección de líneas asignadas a factura. Los asientos sin `allocationJournal` mantienen el significado anterior.
- `netlify/lib/operations.mjs`: despacho autorizado, informes auditados y reconocimiento aditivo de aplicaciones por factura; conserva emisor de ventas, secuencias y motor de asientos.
- `netlify/lib/access.mjs`: protección transversal de configuración/documentos/asientos y clasificación de asientos de tesorería; reutiliza sesión, plan, bloqueo y revisión.
- `netlify/lib/accounting-codec.mjs`: lista explícita de nuevos metadatos en centavos; conserva el formato anterior y las columnas BIGINT del diario.
- `netlify/lib/banks.mjs`: excepción acotada para ajustes de valor vinculados, conservando moneda original, aperturas, cierres e inmutabilidad.
- `netlify/lib/business.mjs`: valida fichas de tesorería con sus propias reglas, bloquea escritura genérica y reutiliza depósitos de Contratos solo con activación nueva.
- `netlify/lib/recurring.mjs`: con Anticipos activado impide cancelar Q con anticipo pendiente; no cambia prorrateos, períodos, numeración ni emisión.
- `netlify/lib/trade.mjs` y `public/accounting.js`: deudas e historial incluyen las asignaciones de los nuevos asientos únicos; documentos sin ese campo conservan su cálculo.
- `public/profiles.js` y `public/business.js`: capacidades opcionales, textos editoriales, permisos y accesos; no activan módulos en empresas existentes.
- `public/ui-texts.js` y `public/ui-text-catalog.mjs`: textos nuevos por `uiT`, sin sustituir los anteriores.
- `netlify/lib/assistant-guide.mjs`: cinco guías estáticas de las pantallas, sin enviar fichas ni cifras a la IA.
- `public/analytics.js` y `public/operations.js`: solo huellas de carga del módulo matemático compartido, sin alterar sus cálculos ni acciones.
- `public/index.html` y `scripts/version-assets.mjs`: carga clásica ordenada y huellas de recursos, sin compilación ni modificación de `style.css`.
- `tests/business-profiles.test.mjs`: conteo del catálogo actualizado para las cinco capacidades, sin eliminar pruebas previas.
- `docs/avance-mejoras.md`, este documento y `.netlify/results.md`: estado real, alcance, límites y matriz de verificación.

### Riesgos y reversión

Los principales riesgos son datos de origen incompletos, exclusiones por plan/permiso, clasificación `ef` incorrecta de cuentas de efectivo, condiciones de descuento históricas no documentadas y cambios del servicio oficial. No se ofrece asesoría fiscal ni se inventan formatos oficiales. Confirmar la clasificación contable con el contador antes de operar. Las proyecciones son estimaciones; las constancias no certifican una transferencia externa.

Para revertir disponibilidad, el dueño desactiva cada módulo y la fuente oficial con motivo. Se conservan lectura, documentos, tasas, referencias, versiones y bitácora. Un lote se revierte con su acción propia; una revalorización, con la reversa confirmada vinculada. Los anticipos pendientes se devuelven/aplican explícitamente. No borrar tablas, migraciones, documentos ni registros. No volver a código que ignore las asignaciones por factura o los metadatos nuevos al guardar. Los cierres ya existentes nunca se desbloquean al desactivar.

### Comprobaciones posteriores al despliegue — no verificadas

La plataforma debe ejecutar `tests/treasury.test.mjs`, las pruebas contables y bancarias existentes y los controles de acceso. La revisión estática y `node --check` no sustituyen esas pruebas.

- [ ] Cuatro planes: Facturación sin rutas/API de los cinco módulos; Básico con nómina excluida y aviso; Estándar y Pro según módulos/límites guardados. Cambiar exclusiones de cada módulo y comprobar URL, menú, informes y mutaciones.
- [ ] Dueño, colaborador lector/escritor/sin acceso, roles de caja, responsable ajeno de fondo, soporte temporal y empresa limitada. Verificar plan del dueño, permiso propio y permisos adicionales por fuente/operación; soporte y límites siempre solo lectura.
- [ ] Empresa ajena, sesión ausente, JSON/origen inválidos, sucursal manipulada, consolidado y miembro revocado; rechazar. Comprobar RLS con el rol real de Functions e índices existentes por empresa/fecha.
- [ ] Dos pestañas y peticiones concurrentes: preparar dos lotes sobre una factura, aprobar con distinta persona, ejecutar ambos, repetir el mismo UUID/cuerpo y reutilizar UUID con otro cuerpo. Solo un efecto; ninguna actualización parcial ante conflicto.
- [ ] Flujo: fuentes completas y excluidas, nómina/impuestos pendientes, Q con depósito y período ya facturado, cuotas atrasadas, NIO/USD, semanas/meses, supuestos 0/10000 puntos básicos, saldo inicial negativo, faltante intermedio y diferencia indirecta visible sin tocar asientos.
- [ ] Lotes: pagos parciales, varias facturas, descuento vigente/vencido/consumido y reversa, rechazo, aprobación por umbral, pago repetido, fondos sin saldo y saldo posterior insuficiente; constancia y asiento único contra mayor y auxiliares.
- [ ] Anticipos: cliente/proveedor, varias facturas del mismo tercero, exceso/tercero ajeno, aplicación parcial de Q/Reserva/Contrato, devolución desde origen, cancelación y restauración con depósito pendiente; comparar informes Q con diario sin duplicados.
- [ ] Revalorización: apagada antes de activar; cierre antes de activación, mes no terminado, período bloqueado, conciliación cerrada, tasa ausente y vista obsoleta rechazados. Confirmar cierre, originales intactos, rechazar repetición y confirmar reversa una vez en fecha propuesta.
- [ ] Tasas: CSV/XLSX/pegado, fechas inválidas/futuras, moneda base, tasa cero/fraccionamiento excesivo, duplicados internos/guardados. Sin fuente/configuración no debe haber red; con ella, probar BCN real, falta de red, timeout y formato distinto, sin guardados automáticos.
- [ ] PDF/CSV por informe, listado, constancia y vista previa: empresa, período real, sucursal, autor, fecha y versión; auditoría y neutralización de fórmulas. Comparar JSON/ZIP/PDF completo con fichas, configuración, tasas y referencias en lectura relacional y versión recuperable.
- [ ] Teléfono, tableta, laptop y PC; claro/oscuro, teclado, formularios largos y tablas; comprobar que `.bnav` no tape contenido y que los textos se puedan editar por `uiT`.
- [ ] Desactivar y reactivar sin perder historial; cerrar y volver a abrir la empresa; repetir los casos con dos empresas y sucursales para comprobar aislamiento y conservación de datos históricos.

## Conciliación previa conservada
La disponibilidad del código (`BANKS_READY=true`, `BANKS_UI_READY=true`) no concede acceso: `cfg.bankControls.enabled` debe ser exactamente `true`, guardado mediante `bankEnable`. La acción exige dueño, permiso/plan Bancos con escritura, sucursal activa, fecha, confirmación y motivo de 3–500 caracteres. Se reutilizan revisión, operación idempotente, transacción y auditoría. El guardado/restauración genéricos no pueden cambiar este interruptor. Desactivarlo impide nuevas operaciones, conservando consulta, descargas, movimientos y todos los bloqueos de cierres anteriores.

## Conciliación escrita

Bancos y conciliación tiene permiso independiente `bancos`, bloqueable por plan, disponible de forma opcional en Más módulos. El plan Facturación lo excluye incluso si su configuración guardada precede al módulo. No añade cuentas ni movimientos automáticamente. El dueño incorpora cada entidad con fecha de inicio, nombre, banco, últimos cuatro dígitos, NIO o USD y una cuenta contable exclusiva. Tarjetas usan un pasivo y conservan días de corte/pago de 1 a 31; son parámetros, no instrucciones de pago automático. No se guarda el número completo ni datos de tarjeta. Las secuencias largas de dígitos en referencias importadas se enmascaran antes de persistir.

CSV y XLSX reutilizan la biblioteca local ya instalada. OFX no se ofrece. El archivo no se transmite ni persiste; el navegador produce una matriz de hasta 1000 movimientos, 50 columnas y 5 MB de archivo. El servidor valida la matriz, mapeo, fechas reales y cantidades en centavos. Un importe tiene signo, separador decimal explícito y agrupación de miles válida; fracciones de centavo se rechazan. Fechas ISO o DD/MM/AAAA. La vista previa muestra hasta 50 filas y exige volver a leer tras modificar el mapeo o archivo. El dueño puede guardar posiciones/formato por banco; una importación puede usar otro mapeo confirmado sin reemplazar el guardado.

El primer extracto empieza en la fecha de incorporación; cada siguiente exige cierre del anterior, día siguiente y saldo inicial igual al saldo final anterior. No se admiten solapamientos ni saldos finales que no igualen saldo inicial más movimientos. La incorporación exige revisar con el contador el saldo inicial de corte y las partidas anteriores; no se interpreta cada asiento previo como movimiento de otra moneda ni como conciliación histórica.

Las sugerencias comparan el mismo importe, distancia máxima de tres días y referencia normalizada; priorizan coincidencia de referencia, días y después identificador. Nunca aplican emparejamientos. El usuario confirma una partida y un asiento no usado de la misma cuenta/sucursal y de igual importe, incluso si su fecha queda fuera de la tolerancia sugerida. No hay emparejamientos parciales o múltiples por partida: requieren un asiento agregado documentado apropiado. Las partidas emparejadas no se reasignan desde esta interfaz; las correcciones son documentadas, sin reescribir el libro.

Una partida sin asiento puede generar, con permiso adicional de Contabilidad, un asiento confirmado contra gasto o ingreso (comisiones o intereses). Conserva referencia, extracto y banco; no registra cobros o pagos automáticos.

El informe separa conciliadas, pendientes del banco y tránsito del libro. En tarjetas, el saldo positivo es deuda: el libro usa crédito menos débito. En bancos usa débito menos crédito. Libro ajustado = saldo libro + pendientes banco. Banco ajustado = saldo banco + tránsito libro. La diferencia compara ambos; se muestran los saldos sin ajustar para que el ajuste no oculte partidas. El cierre exige diferencia cero y ninguna partida bancaria sin contabilizar; admite tránsito identificado. Solo dueño o contador con escritura puede cerrar, mediante confirmación y motivo. No se modifica ninguna conciliación histórica de empresas que no incorporaron esta función.

El interruptor por empresa `cfg.bankControls.closingEnabled` nace apagado; solo el dueño puede cambiarlo con confirmación y motivo mediante `bankLockEnable`. Desactivarlo impide futuros cierres, sin levantar bloqueos anteriores. Esta configuración es independiente de la activación de Bancos: ambas empiezan apagadas. El cierre conserva una instantánea inmutable con autor/fecha/motivo. La guarda transversal en `updateCompany` bloquea edición/eliminación de asientos emparejados, cambios de conciliaciones cerradas y cualquier cambio de libro que afecte esta cuenta/sucursal hasta la fecha cerrada, incluido el saldo de apertura. También se conserva la naturaleza contable de la entidad y la moneda base. Las correcciones se registran en fechas posteriores. No se bloquean otras cuentas ni sucursales. No hay reapertura en esta entrega.

## Autorización y almacenamiento

`bankLockEnable`, `bankCreate`, `bankMapping`, `bankStatement`, `bankMatch`, `bankPost` y `bankClose` usan la ruta de operaciones existente, identificador idempotente obligatorio, revisión, sesión, membresía, permiso/plan, sucursal del servidor, bloqueo de empresa, transacción, auditoría, versiones y sincronización relacional. Soporte temporal y empresas limitadas siguen en consulta. `bankReport` autoriza lectura antes de proyectar la sucursal; no acepta una sucursal enviada como autorización. Las operaciones genéricas de negocio rechazan editar bancos. El guardado/restauración genéricos tampoco pueden cambiar las fichas de Q o bancos ni el interruptor de cierre: no permiten activar el módulo ni inyectar datos originales al margen de sus operaciones. Las pantallas escapan datos y usan `uiT`; no se cambió `style.css` ni se añadieron colores.

Se reutiliza `businessRecords`, tabla relacional con RLS e índices por empresa existentes. El codec declara los metadatos monetarios nativos en centavos; no redondea datos históricos. JSON y ZIP conservan la colección. La descarga de respaldo PDF completo recorre todos los campos de la proyección autorizada y exige lectura de todos los módulos/sucursales. El directorio y cada conciliación se exportan en PDF y CSV con empresa, moneda, período o fecha de generación del directorio, sucursal, autor, fecha, versión y revisión. Las solicitudes de descarga quedan auditadas; VIEW no simula una descarga. CSV neutraliza fórmulas.

## Incorporación de otra moneda: solo hacia adelante

La cuenta bancaria se expresa en NIO o USD, con moneda base tomada de la configuración histórica (`C$` equivale a NIO sin cambiar el dato). En otra moneda se requiere una cuenta exclusiva distinta de las cuentas automáticas de ventas, cartera, inventario, nómina, impuestos, anticipos y préstamos. La fecha de incorporación debe ser posterior a todos sus movimientos existentes en la sucursal. El dueño confirma un saldo original firmado en centavos y el saldo base del libro previo, que el servidor verifica; ambos conservan su signo. No se deriva el saldo original aplicando una tasa al libro histórico. La tasa informativa de incorporación conserva fuente y fecha y no revaloriza ni cambia el saldo base previo.

Los movimientos futuros se crean mediante `bankEntry`, con importe original con signo, tasa expresa de unidades base por unidad original (hasta seis decimales), fuente y fecha no posterior al movimiento. Los importes originales y base son centavos enteros; `bankRateMicros` y `bankConvertCents` calculan con BigInt y redondeo simétrico al centavo más cercano. La tasa usa millonésimas enteras; no se persisten importes nuevos en decimales. Una conversión cero o fuera de rango se rechaza. Se admite NIO sobre base USD y USD sobre base NIO, además de cuentas en moneda base.

`bankEntry` exige también Contabilidad y registra un asiento y una ficha `movement` en la misma transacción. No permite usar como contrapartida otra entidad bancaria incorporada, cartera, inventario ni cajas de turno: no constituye un cobro/pago vinculado a factura ni una transferencia entre entidades. Esas operaciones conservan sus rutas actuales. Las operaciones automáticas existentes conservan sus cuentas originales. Una comisión/interés del extracto usa `bankPost` con la misma conversión explícita. No existe conexión bancaria, liquidación automática ni adaptador de tasas nuevo.

El primer extracto extranjero exige saldo inicial igual a la apertura original confirmada. El libro de conciliación usa la apertura original más los movimientos originales. El informe v2 identifica la moneda de conciliación y muestra separadamente saldo contable base. Los movimientos exportados conservan importe original, equivalente base, tasa, fuente y fecha. En tarjetas un saldo positivo indica deuda; se invierte el signo contable al generar el pasivo. PDF y CSV conservan metadatos de empresa, período, generación, autor, revisión y versión; la auditoría registra la versión real del informe. JSON, ZIP y PDF completo recorren las fichas existentes y sus campos nuevos.

La guarda transversal requiere correspondencia uno a uno entre movimientos originales y asientos de la cuenta/sucursal desde su incorporación. Rechaza asientos sin detalle original, duplicados y asientos de neto cero que mencionen esa cuenta. Conserva las fichas y los asientos originales, apertura, cuenta, moneda y libro previo. No se permite editar un movimiento aunque aún no esté conciliado; la corrección utiliza un asiento nuevo explícito. Los cierres conservan su protección adicional. Restaurar no permite eludir estas reglas. Una cuenta extranjera con partidas anteriores en tránsito requiere resolver y documentar su corte antes de incorporarse; no se adivinan monedas de esas partidas.

## Alcance ampliado en esta entrega

F2.3–F2.7 se describen en la sección de entrega actual, junto con sus límites, permisos, pruebas escritas y verificaciones posteriores al despliegue.

## Archivos y compatibilidad

- `public/accounting-math.mjs` agregó importación monetaria exacta, mapeo, sugerencias y totales, sin modificar funciones previas.
- `public/profiles.js` agregó la capacidad opcional Bancos. Conservó perfiles y las otras capacidades. Q corrigió su identificador a `suscripciones`, preservando la ruta anterior `recurrentes` de plantillas de asientos.
- `netlify/lib/operations.mjs` agregó despacho e informes autorizados. No cambió los cuerpos de venta/nota de crédito, el costeo ni numeración.
- `netlify/lib/access.mjs` agregó guardas condicionadas a cuentas/conciliaciones nuevas; sin ellas no actúan.
- `netlify/lib/business.mjs` agregó validación bancaria y protección contra edición genérica.
- `netlify/lib/accounting-codec.mjs` declaró claves nuevas de centavos sin cambiar conversiones existentes.
- `public/business.js` agregó etiquetas editables. `public/index.html` agregó `banks.js`; `scripts/version-assets.mjs` incluyó sus dependencias en las huellas.
- `public/ui-texts.js` y `public/ui-text-catalog.mjs` agregaron textos. `public/recurring.js` agregó respaldo PDF autorizado y corrigió la colisión con la ruta de plantillas históricas; se documentó en el cierre de Fase 1.

Los archivos nuevos son `netlify/lib/banks.mjs`, `public/banks.js` y `tests/banks.test.mjs`. No se borró ni modificó ninguna migración aplicada, tabla o dato histórico. No hay dependencias nuevas.

## Pruebas y verificaciones de vista previa

Se escribieron casos de importes exactos, formatos inválidos, fechas, sugerencias deterministas sin mutación, confirmación, saldos, solapamiento, continuidad, creación de asiento, cierre, intento de edición posterior, corrección futura, permisos, planes, dueño, sucursal, máscaras y bloqueo de ruta genérica. Las pruebas no se ejecutaron. `node --check` y revisión de diff son comprobaciones estáticas y no prueban funcionamiento.

La plataforma debe ejecutar las pruebas e inspeccionar RLS con el rol real de Functions. En vista previa: dueño y contador, colaboradores sin acceso/lectura/escritura, soporte y empresas limitadas; cuatro planes, incluidos guardados antes de Bancos; API directa, otra empresa y otra sucursal, consolidado de consulta; importación dos veces/reintentos concurrentes; cierres con pendientes/tránsito y cambios de libro/restauración posteriores; PDF/CSV/JSON/ZIP/PDF completo, bitácora, símbolos monetarios y referencias maliciosas. Verificar teléfono/tableta/laptop/PC en claro/oscuro, teclado, tabla extensa y controles por encima de `.bnav`.

## Reversión

No se crearon commits manuales ni migraciones nuevas. Para retirar la interfaz, bloquear nuevas operaciones por plan/permiso y conservar registros, instantáneas y guardas de inmutabilidad para las empresas que la utilizaron. No revertir a una versión que ignore las fichas nuevas al guardar. Compensar asientos mediante nuevas operaciones fechadas después del cierre; nunca eliminar ni reescribirlos. La plataforma asigna el identificador de commit antes de una reversión concreta.

## Archivos modificados en esta ampliación

- `netlify/lib/banks.mjs`: activación por empresa, apertura original explícita, movimientos futuros, conversión y guardas. Sin bancos incorporados las guardas no intervienen; no se reescriben funciones de venta ni costeo.
- `netlify/lib/operations.mjs`: mantuvo la ruta existente; autorizó activación, movimiento bancario e informes con permiso, plan y sucursal. Las otras operaciones conservan sus ramas. Las descargas desactivadas siguen siendo de consulta y auditadas.
- `netlify/lib/accounting-codec.mjs`: declaró `baseOpeningCents` y `baseBookCents` como centavos nativos, sin alterar nombres ni conversiones anteriores. No cambia esquema SQL: se reutilizan `businessRecords`, sus índices por empresa, RLS y sincronización relacional.
- `public/accounting-math.mjs`: añadió funciones puras de tasa/conversión; no cambió los cálculos existentes.
- `public/banks.js`: añadió activación del dueño, movimientos originales y moneda explícita al mostrar/exportar importes. Reutilizó estilos existentes; no modificó `style.css`.
- `public/ui-texts.js`, `public/ui-text-catalog.mjs`: textos nuevos editables por `uiT`; conservó las claves existentes.
- `netlify/lib/assistant-guide.mjs`: actualizó la guía de bancos sin ampliar datos enviados al asistente ni proveedores.
- `tests/banks.test.mjs`: actualizó el requisito de activación y conservó los casos base. `tests/banks-foreign.test.mjs` añadió casos de tasa, centavos, moneda inversa, tarjeta, apertura, rechazo de escritura sin original, permisos, sucursal, cierres, desactivación y contrapartidas protegidas. Son pruebas escritas **no ejecutadas**.
- `README.md`, `docs/avance-mejoras.md` y este documento: actualizaron el estado real sin reescribir la implementación de Fase 1. `docs/fase-3-facturacion-cobranza.md` registró el alcance no iniciado.
- `public/index.html`, `public/analytics.js`, `public/operations.js`: solo huellas de recursos actualizadas mediante el script, sin nuevos scripts, compilación ni cambio de orden.

No hubo migraciones nuevas, dependencias nuevas, cambios de esquema, datos reales, pagos, correo, variables, commits manuales ni despliegues. El frontend siguió siendo estático. Las comprobaciones de sintaxis y diff son estáticas y no sustituyen pruebas funcionales. La plataforma debe ejecutar los casos escritos y verificar RLS con el rol real de Functions.

## Matriz adicional de vista previa: no verificada

1. Abrir una empresa existente en cada uno de los cuatro planes: Bancos debe empezar apagado, sin cuentas nuevas ni cambio de asientos. Con permiso/plan bloqueado, rechazar tanto UI como API; verificar también planes guardados antes de incorporar Bancos.
2. Activar como dueño con motivo/confirmación/revisión; rechazar como colaborador, soporte, empresa limitada, consolidado, sesión ausente, origen ajeno y JSON inválido. Repetir lectura/escritura de colaboradores y selección de otra empresa/sucursal. Verificar permisos independientes de Contabilidad para crear bancos o asientos.
3. Crear banco y tarjeta base, USD sobre NIO y NIO sobre USD. Rechazar cuentas automáticas para otra moneda, fecha con movimientos posteriores, apertura base incorrecta, tasa cero, fracción de centavo y falta de fuente/fecha. Comparar libro histórico byte a byte.
4. Crear un movimiento original y una comisión desde extracto. Confirmar importes/signos, máscara, moneda y equivalentes base. Repetir solicitudes concurrentes con el mismo identificador, otro cuerpo y revisión obsoleta: no duplicar ni dejar escrituras parciales.
5. Intentar asiento genérico, restauración, cambio de apertura, edición/eliminación de movimiento, cambio de moneda y asientos de neto cero en cuenta extranjera: rechazar. Corregir con movimiento nuevo explícito, sin eliminar el previo.
6. Importar, sugerir sin confirmar, emparejar y cerrar. Consultar y descargar tras desactivar; rechazar nuevas mutaciones. Revalidar cierres previos y fechas futuras de corrección. Probar dos pestañas.
7. Comparar PDF/CSV/JSON/ZIP/PDF completo y auditoría: empresa, sucursal, período, autor, fecha, versión, moneda, saldo base, aperturas y fuente/fecha de tasas. Probar referencias largas y fórmulas en CSV.
8. Revisar teléfono/tableta/laptop/PC, claro/oscuro, teclado y modal largo, sin controles detrás de `.bnav`. Confirmar que no cambia el diseño existente ni aparecen símbolos base en importes originales.

Para revertir esta ampliación, desactivar Bancos por empresa con motivo; la consulta y los cierres se conservan. Retirar después la interfaz manteniendo fichas, guardas y lector del codec. No volver a una versión que ignore esos campos al guardar. No borrar datos ni migraciones. No deshacer asientos: corregir mediante movimientos nuevos posteriores a cierres. No se proporciona una reversión automática de datos históricos.

Comprobaciones estáticas finales de esta ampliación: `node --check` finalizó correctamente en los 12 archivos JavaScript nuevos/modificados, `node scripts/version-assets.mjs` actualizó las huellas y `git diff --check` no detectó errores. No se ejecutaron las pruebas escritas ni verificaciones funcionales o visuales.

### Evidencia estática final de F2.3–F2.7

Se recorrieron las casillas de la tarea contra cálculos, despacho transaccional, guardas, permisos, formularios, informes, respaldo, catálogos y documentación. Se escribieron 31 casos nuevos en `tests/treasury.test.mjs` y se actualizó el conteo del catálogo en la prueba de perfiles. `node --check` terminó sin errores en los 22 archivos JavaScript añadidos/modificados; después de los últimos ajustes se volvió a comprobar la sintaxis afectada. `node scripts/version-assets.mjs` actualizó las huellas y `git diff --check` terminó sin errores. No se ejecutaron las pruebas ni se validó funcionamiento por esa comprobación de sintaxis. No hubo migraciones, dependencias, activaciones de empresas, compilaciones, servidores, commits manuales, mezclas ni despliegues.
