# Costeo PEPS optativo

El dueño autorizó modificar el motor de costeo. El método predeterminado, tanto para empresas existentes como nuevas, sigue siendo promedio ponderado. El despliegue no activa PEPS para ninguna empresa. D.22 está implementado; F5.1 conserva alcance limitado y no se marca como cobertura integral.

En Productos e inventario, Método de costeo exige dueño real sin sesión de colaborador, escritura en Ajustes, Inventario y Contabilidad, confirmación y motivo de 3–500 caracteres. El cambio usa runOperation/updateCompany, revisión optimista, bloqueo de empresa, operación idempotente, respaldo y bitácora. Se guarda autor, fecha, motivo y método anterior/nuevo. Las capas iniciales se crean por producto y sucursal al costo promedio vigente, sin modificar ventas, asientos o Kardex históricos. Una diferencia preexistente con la cuenta 1301 impide activar; no se fabrica un ajuste para hacerla desaparecer. Las fechas efectivas usan UTC, conservando además el instante exacto.

Cada compra posterior usa la operación fifoPurchase con permisos de Compras e Inventario; cantidades, costos, IVA, vencimiento y asiento se calculan o validan en servidor. Cada entrada crea capa con fecha, cantidad original/restante, costo unitario en centavos, valor original/restante, sucursal y documento. Las salidas consumen capas por fecha y orden de entrada, incluidas varias capas en una misma venta. Cada movimiento guarda identificadores de capa, cantidades y centavos consumidos. Los valores exactos de Productos y Kardex proceden de las capas/asignaciones; el costo unitario visible es informativo y redondeado.

Las devoluciones de ventas PEPS crean capas nuevas a partir de las asignaciones originales. Las devoluciones parciales consecutivas recorren las unidades originales y recuperan sus centavos, conservando el enlace a la capa de origen. Las devoluciones de ventas anteriores a PEPS se rechazan por no tener asignaciones verificables. El último consumo absorbe el residuo de centavos de su capa; el reparto proporcional usa aritmética entera compartida. Los ajustes positivos crean capas al costo vigente; los negativos y conteos consumen capas y reemplazan únicamente la valoración del asiento nuevo. No se recostean documentos anteriores. No se admiten movimientos anteriores a la activación ni al último movimiento de inventario de la sucursal. Se exige una sola línea por producto en cada documento PEPS.

Antes de guardar, se valida la identidad de productos y sucursales, cantidades y centavos seguros, el saldo de cada capa frente a su historial de consumos y la suma de cantidades por producto/sucursal frente a existencias. El valor total por sucursal debe igualar exactamente el saldo de 1301. La validación ocurre dentro de la misma transacción, antes de respaldos/escrituras definitivas. Cualquier error revierte también los efectos auxiliares de esa transacción. No se aceptan capas ni cambios de método por el guardado genérico.

## Casos bloqueados y motivo exacto

| Caso bajo PEPS | Motivo del bloqueo |
| --- | --- |
| Traslado saliente o recepción | El recorrido actual contabiliza inventario en tránsito sin conservar asignaciones por capa de origen y destino. Un traslado pendiente impide activar PEPS. |
| Lotes | La salida física actual selecciona FEFO por vencimiento y no enlaza cada lote con su capa de costo. Cualquier registro de lotes impide activar; tampoco se pueden introducir lotes después. |
| Series | La selección física individual no enlaza la serie con una capa de costo. Los productos serializados impiden activar o incorporarlos con PEPS vigente. |
| Recetas y producción manual/automática | El motor actual revaloriza el terminado y distribuye diferencias sin trazabilidad por capa de insumo. Una receta impide activar; no se admiten nuevas recetas ni producción con PEPS. |
| Consumo o reposición de insumos de servicios | El asiento vinculado y su reversión conservan el costo promedio de la prestación y no las capas originales de cada insumo. Se rechaza toda la operación, incluida la venta asociada. |
| Revalorización manual y anulación de compras con stock | Cambiar o invertir el costo histórico no determina qué capas disponibles corresponden al documento. No se acepta ese recorrido automático. |
| Restauración que cambia capas o Kardex | Descartaría consumos ya emitidos o sus fuentes. El respaldo debe conservar las capas y el método vigente; el recorrido actual rechaza reescrituras históricas. |

Estos bloqueos aplican solo cuando PEPS está activo. Promedio ponderado conserva sus recorridos previos. No se activa automáticamente un módulo incompatible ni se usa promedio como sustituto silencioso de PEPS.

El dueño puede regresar a promedio con motivo y confirmación solo si el costo promedio redondeado resultante conserva exactamente el valor de cada producto en cada sucursal. Si deja diferencias, el cambio se rechaza y debe conservarse PEPS hasta agotar esas existencias. Las capas históricas se retienen; una activación posterior abre otra época sin borrar las anteriores.

## Persistencia y respaldo

inventoryLayers está declarado en accounting-model, esquema Drizzle, codec relacional, adaptador de almacenamiento, proyección por permisos y dimensión de sucursal. Los valores nativos de centavos usan BIGINT y no se multiplican de nuevo en el codec. Las asignaciones anidadas usan campos de centavos ya declarados. La migración add_fifo_inventory_layers se generó con drizzle-kit tras consultar el estado de la base; solo agrega una tabla, claves, índice por empresa/fecha y RLS conforme a las tablas contables existentes. No se modificaron migraciones aplicadas ni se aplicó SQL localmente.

Las versiones, respaldos JSON y exportaciones completas conservan configuración, capas y asignaciones. Las restauraciones pasan por los permisos y revisión existentes y por la nueva conciliación; no pueden omitir capas o cambiar a promedio por cargar un respaldo anterior. El archivo descargado no constituye autorización para editar la trazabilidad.

## Verificación

Se escribieron pruebas de compatibilidad promedio, activación/denegación, capas iniciales por sucursal, compras, venta con varias capas, devoluciones parciales, ajustes, centavos residuales, conciliación, historial de consumos, aislamiento de sucursales, codec/exportación/restauración y bloqueos de traslados, lotes, series y recetas. No se ejecutaron pruebas, servidores ni compilaciones. Solo se comprobó sintaxis con node --check.

Queda pendiente en la plataforma: ejecutar la suite, aplicar la migración, confirmar RLS con el rol real de Functions, comprobar rollback transaccional y concurrencia/idempotencia, revisar todos los permisos y planes, comparar empresas promedio sin cambios monetarios, verificar UI móvil/oscuro, respaldos y rechazos de restauraciones incompatibles. No se afirma validación funcional ni aprobación de las pruebas.
