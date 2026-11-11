# Correcciones contables con historial

Se agregó `correctEntry` dentro de `runOperation`/`updateCompany`. La API conserva las validaciones de sesión, JSON, mismo origen, propiedad o membresía, revisión vigente, bloqueo de empresa y operación idempotente. `reverseLegacyCash` se conservó como alias de servidor del mismo mecanismo y de sus permisos, sin llamadas desde la interfaz nueva. No hubo cambios de esquema ni migraciones: referencias, motivos y relaciones usan los metadatos existentes de asientos, sin nuevos importes flotantes.

El original no se modifica. `reversalOf` enlaza su contrasiento; `correctionOf` enlaza la versión corregida, que conserva su tipo. `reason`, `correctionReference`, actor y bitácora permiten seguir la operación. Originales anulados y contrasientos no admiten una segunda corrección. La nueva versión vigente sí. Compras y gastos se recalculan con las reglas compartidas. Los cambios de stock y valoración se aplican por diferencias, sin usar el costo actual como supuesto del costo histórico. Si falta ese costo se rechaza; el inventario inicial de un único producto permite recuperarlo de su importe documentado y cantidad.

La apertura usa `anula-apertura`. Caja inicial, flujo, exportaciones de efectivo y paquete de período reconocen apertura, apertura importada e inverso. Diario, mayor y balanza mantienen todas sus líneas. Resultados excluye las aperturas y sus inversos de la actividad del período. El selector anual conserva la suma de estas líneas; solo las aperturas anuales existentes crean cortes. La creación/importación y la corrección controlan una apertura vigente por sucursal. No se reescriben asientos de cierre ni su reapertura.

## Fase 2 implementada

**Pago fiscal histórico:** permite anular, conservando el pago y su contrasiento. El cálculo existente de pagos vigentes excluye pagos con `reversalOf`; así la obligación recupera su saldo sin sobrescribir su ficha o comprobante. Se vuelve a pagar desde la Agenda fiscal. No se reemplazan pagos en una única operación. Se bloquean pagos gestionados y referencias vinculadas a Declaraciones; la presentación congelada solo cambia mediante la rectificativa existente.

**Inventario inicial (`invini`) con costo promedio:** permite anular, invirtiendo las cantidades y su valor histórico. Rechaza stock insuficiente, valoración negativa o valor residual sin existencias; no ignora esas validaciones aunque la empresa permita valores negativos. Una nueva entrada se registra desde el módulo de origen, sin borrar el inventario histórico. Las compras históricas no gestionadas pueden corregirse con sus artículos desde el formulario existente; PEPS permanece protegido.

## Piezas pendientes por seguridad

**Nómina cerrada:** el cierre usa `entryId`, reduce deudas de empleados y puede coexistir con adelantos aplicados, comisiones y registros gestionados del módulo Personal. Un inverso contable no basta para reponer las aplicaciones ni permitir editar sin reconocerlas otra vez. Quedó bloqueada hasta definir una reversión transaccional de esos vínculos y sus estados, con sus pruebas específicas.

**Liquidación cerrada:** el pago conserva `entryId` y cambia el expediente del empleado a inactivo. Reabrir exige distinguir esa baja de cambios posteriores, nóminas y adelantos. No se reactiva el empleado ni se retira el vínculo del pago sin un historial de reversión compatible. Quedó pendiente junto con nómina, en lugar de habilitar un contrasiento incompleto.

**Des-conciliar:** las conciliaciones cerradas conservan instantáneas inmutables y bloquean todos los asientos de la cuenta hasta su fecha. Retirar un emparejamiento o agregar un inverso no reabre esa instantánea; exige diseñar una reapertura versionada de conciliación sin retirar el historial congelado. No se habilitó un botón que pudiera eludir esos controles. Los movimientos conciliados y las cuentas de otra moneda siguen bloqueados.

**Inventario PEPS:** sus capas y asignaciones no admiten una inversión genérica de `stock`. Se rechazan correcciones con inventario PEPS antes de alterar productos o capas. Requiere una operación específica que conserve las asignaciones originales, los consumos posteriores y el valor por sucursal.

## Verificación

Se añadieron pruebas para permisos especiales, apertura y saldo neto, corrección repetida, cuenta/fecha/cuadre, caja negativa, período cerrado, abonos vinculados, tipos excluidos, guardado genérico, aislamiento, normalización relacional, corrección de compras/gastos, pagos fiscales históricos, conciliación bloqueada e inventario inicial. Se adaptó el arnés existente para importar el mismo control de caja compartido. No se ejecutaron pruebas, servidores ni compilaciones locales.

Tras desplegar queda pendiente ejecutar la suite de plataforma y verificar transacciones sin escrituras parciales, revisiones obsoletas, reintentos idempotentes, permisos revocados, sesiones ajenas y llamadas API directas sin origen/JSON válidos. Comparar apertura, mayor, balanza, flujo, libros fiscales, paquete y exportaciones antes/después, en dos empresas y dos sucursales. Confirmar el pago fiscal recuperado sin tocar declaraciones presentadas, stock/costo disponible e insuficiente, y rechazo de PEPS. Revisar formularios en móvil, modo oscuro y teclado. No se afirmó validación funcional por la revisión estática.
