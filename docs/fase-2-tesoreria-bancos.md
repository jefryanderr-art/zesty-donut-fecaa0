# Tesorería y bancos: estado de implementación

Esta fase aún no está cerrada y permanece **desactivada de forma fija** en servidor (`BANKS_READY=false`) e interfaz (`BANKS_UI_READY=false`). No existe acción de usuario ni variable de entorno que la habilite. Las rutas validan sesión/permiso y rechazan antes de cualquier mutación. Los helpers quedan preparados para pruebas de plataforma, pero no tienen efecto sobre las empresas. El código escrito cubre incorporación de cuentas y tarjetas **en moneda base** y conciliación CSV/XLSX. No se implementaron todavía proyección, lotes de proveedores, anticipos generales, revaluación ni carga masiva de tasas. No se consideran esos entregables terminados. No hay cambios de esquema ni migraciones nuevas; no se ejecutaron pruebas funcionales.

## Conciliación escrita

Bancos y conciliación tiene permiso independiente `bancos`, bloqueable por plan, disponible de forma opcional en Más módulos. El plan Facturación lo excluye incluso si su configuración guardada precede al módulo. No añade cuentas ni movimientos automáticamente. El dueño incorpora cada entidad con fecha de inicio, nombre, banco, últimos cuatro dígitos, moneda base y una cuenta contable exclusiva. Tarjetas usan un pasivo y conservan días de corte/pago de 1 a 31; son parámetros, no instrucciones de pago automático. No se guarda el número completo ni datos de tarjeta. Las secuencias largas de dígitos en referencias importadas se enmascaran antes de persistir.

CSV y XLSX reutilizan la biblioteca local ya instalada. OFX no se ofrece. El archivo no se transmite ni persiste; el navegador produce una matriz de hasta 1000 movimientos, 50 columnas y 5 MB de archivo. El servidor valida la matriz, mapeo, fechas reales y cantidades en centavos. Un importe tiene signo, separador decimal explícito y agrupación de miles válida; fracciones de centavo se rechazan. Fechas ISO o DD/MM/AAAA. La vista previa muestra hasta 50 filas y exige volver a leer tras modificar el mapeo o archivo. El dueño puede guardar posiciones/formato por banco; una importación puede usar otro mapeo confirmado sin reemplazar el guardado.

El primer extracto empieza en la fecha de incorporación; cada siguiente exige cierre del anterior, día siguiente y saldo inicial igual al saldo final anterior. No se admiten solapamientos ni saldos finales que no igualen saldo inicial más movimientos. La incorporación exige revisar con el contador el saldo inicial de corte y las partidas anteriores; no se interpreta cada asiento previo como movimiento de otra moneda ni como conciliación histórica.

Las sugerencias comparan el mismo importe, distancia máxima de tres días y referencia normalizada; priorizan coincidencia de referencia, días y después identificador. Nunca aplican emparejamientos. El usuario confirma una partida y un asiento no usado de la misma cuenta/sucursal y de igual importe, incluso si su fecha queda fuera de la tolerancia sugerida. No hay emparejamientos parciales o múltiples por partida: requieren un asiento agregado documentado apropiado. Las partidas emparejadas no se reasignan desde esta interfaz; las correcciones son documentadas, sin reescribir el libro.

Una partida sin asiento puede generar, con permiso adicional de Contabilidad, un asiento confirmado contra gasto o ingreso (comisiones o intereses). Conserva referencia, extracto y banco; no registra cobros o pagos automáticos.

El informe separa conciliadas, pendientes del banco y tránsito del libro. En tarjetas, el saldo positivo es deuda: el libro usa crédito menos débito. En bancos usa débito menos crédito. Libro ajustado = saldo libro + pendientes banco. Banco ajustado = saldo banco + tránsito libro. La diferencia compara ambos; se muestran los saldos sin ajustar para que el ajuste no oculte partidas. El cierre exige diferencia cero y ninguna partida bancaria sin contabilizar; admite tránsito identificado. Solo dueño o contador con escritura puede cerrar, mediante confirmación y motivo. No se modifica ninguna conciliación histórica de empresas que no incorporaron esta función.

El interruptor por empresa `cfg.bankControls.closingEnabled` nace apagado; solo el dueño puede cambiarlo con confirmación y motivo mediante `bankLockEnable`. Desactivarlo impide futuros cierres, sin levantar bloqueos anteriores. Esta configuración no supera el apagado fijo de la fase incompleta. El cierre conserva una instantánea inmutable con autor/fecha/motivo. La guarda transversal en `updateCompany` bloquea edición/eliminación de asientos emparejados, cambios de conciliaciones cerradas y cualquier cambio de libro que afecte esta cuenta/sucursal hasta la fecha cerrada, incluido el saldo de apertura. También se conserva la naturaleza contable de la entidad y la moneda base. Las correcciones se registran en fechas posteriores. No se bloquean otras cuentas ni sucursales. No hay reapertura en esta entrega.

## Autorización y almacenamiento

`bankLockEnable`, `bankCreate`, `bankMapping`, `bankStatement`, `bankMatch`, `bankPost` y `bankClose` usan la ruta de operaciones existente, identificador idempotente obligatorio, revisión, sesión, membresía, permiso/plan, sucursal del servidor, bloqueo de empresa, transacción, auditoría, versiones y sincronización relacional. Soporte temporal y empresas limitadas siguen en consulta. `bankReport` autoriza lectura antes de proyectar la sucursal; no acepta una sucursal enviada como autorización. Las operaciones genéricas de negocio rechazan editar bancos. El guardado/restauración genéricos tampoco pueden cambiar las fichas de Q o bancos ni el interruptor de cierre: no permiten inyectar datos para superar el apagado fijo. Las pantallas escapan datos y usan `uiT`; no se cambió `style.css` ni se añadieron colores.

Se reutiliza `businessRecords`, tabla relacional con RLS e índices por empresa existentes. El codec declara los metadatos monetarios nativos en centavos; no redondea datos históricos. JSON y ZIP conservan la colección. La descarga de respaldo PDF completo recorre todos los campos de la proyección autorizada y exige lectura de todos los módulos/sucursales. El directorio y cada conciliación se exportan en PDF y CSV con empresa, moneda, período o fecha de generación del directorio, sucursal, autor, fecha, versión y revisión. Las solicitudes de descarga quedan auditadas; VIEW no simula una descarga. CSV neutraliza fórmulas.

## Límites que impiden cerrar la fase

El motivo exacto del apagado es alcance de implementación incompleto: falta cerrar el tratamiento de otra moneda y desarrollar F2.3–F2.7. No es un impedimento externo resuelto ni una excepción de secuencia. La cuenta de conciliación escrita solo admite moneda base. El libro histórico no desglosa moneda original por línea bancaria: inferirla reinterpretaría históricos. Se conserva Multimoneda previo. El soporte de entidades/conciliación en otra moneda no está completo y no se marca F2.2 como terminado. Para continuarlo, completar esos criterios con pruebas escritas, permisos, uiT, respaldo, informes y documentación antes de cambiar ambos interruptores fijos. Incorporar saldos originales y conversiones explícitas solo hacia adelante, con pruebas de redondeo y revaluación, sin inferir moneda de asientos previos ni modificar el emisor. No se presenta este límite como autorización para omitir otro requisito.

Las restantes partes F2.3–F2.7 no tienen rutas ni acciones nuevas y no tienen efecto. No existe adaptador de red, cargo, envío ni tarea nueva. PEPS conserva la excepción específica autorizada por el dueño y no afecta esta fase.

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
