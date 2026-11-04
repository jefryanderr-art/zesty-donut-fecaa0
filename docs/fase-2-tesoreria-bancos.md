# Tesorería y bancos: estado de implementación

La fase completa **no está terminada**. Se completó por escrito el tratamiento de bancos/tarjetas NIO y USD y se sustituyó el bloqueo fijo por activación explícita del dueño por empresa. Ninguna empresa se activa durante el despliegue. F2.3–F2.7 siguen sin implementación nueva: proyección, lotes de proveedores, anticipos generales, revaluación y carga masiva/adaptador de tasas. No existe un impedimento técnico externo demostrado que justifique omitirlos; esta entrega es parcial respecto de la solicitud de cierre completo. No se presentan como imposibles ni terminados. Fase 3 no se inició, respetando su dependencia del cierre de Fase 2.

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

## Alcance que sigue sin implementar

F2.3a–c: faltan integración de todas las fuentes proyectadas, escenarios, semáforo y reconciliación del método indirecto. No se añadió una proyección incompleta ni se modificó el estado de flujo actual. Continuación: construir cálculos compartidos, proyección autorizada por cada fuente, interfaz, informes auditados y pruebas.

F2.4: faltan selección de obligaciones, aprobación por monto, constancia y asiento único por lote. No existen rutas ni lotes parciales. Continuación: integrar los saldos vinculados a las facturas bajo la misma transacción y revisión, evitando duplicar pagos.

F2.5: faltan anticipos generales a clientes/proveedores, aplicación y devolución. Los anticipos de Q y las funciones anteriores permanecen intactos; no se presentan como este entregable. Continuación: modelar fichas inmutables, saldos por tercero y aplicaciones vinculadas sin tocar facturas previas.

F2.6: falta revaluación mensual con activación independiente apagada, asiento confirmado y reversa confirmada. Las tasas informativas de esta entrega no la sustituyen. Continuación: distinguir saldo original de valor en libros y mantener intactas las cantidades originales, con pruebas de cierre y reversión.

F2.7: faltan importación masiva/pegado y adaptador opcional oficial tolerante a errores de red, con activación apagada. La tasa explícita por movimiento no satisface ese requisito. Continuación: catálogo versionado de tasas con fuentes documentadas y vista previa antes de escritura. No se añadió llamada externa alguna.

Estos faltantes son trabajo de implementación sin concluir, no excepciones aprobadas ni límites externos demostrados. El único ítem exceptuado por el dueño sigue siendo PEPS. Todos los faltantes permanecen sin efecto nuevo sobre empresas.

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
