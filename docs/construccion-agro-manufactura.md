# Construcción, agropecuario y manufactura

Se amplió únicamente estos tres rubros, en ese orden, sobre Proyectos, Lotes y Producción. Se conservaron perfiles, facturas, recetas, compras, costos y lotes previos. Las fichas nuevas usan operaciones específicas: la edición genérica no permite saltarse sus controles. No se añadieron tablas, columnas ni migraciones; los registros estructurados se conservaron en Netlify Database mediante la colección relacional existente y su codec residual. Los importes nuevos se declararon como centavos enteros. Las operaciones pasan por revisión optimista, transacción, recibo idempotente, plan, permisos de módulo, sucursal de sesión, versiones y auditoría existentes.

## Construcción

En Órdenes de trabajo y proyectos aparece Control de obra. Nueva obra identifica cliente y contrato sin IVA. El dueño aprueba una vez el presupuesto inicial mediante códigos, descripción, categoría e importe; las categorías son Mano de obra, Materiales, Equipo y Subcontratos. Las modificaciones posteriores son órdenes de cambio con motivo, confirmación del dueño y ajustes firmados del código y del contrato. Se conserva el historial. Avance registra el porcentaje acumulado de la obra y el avance de cada etapa, sin retroceso del porcentaje global.

Costo real utiliza el catálogo contable y su comprobante, IVA acreditable, dinero o crédito; registra la base sin IVA en el código. Compra de la obra vincula una compra existente y su código sin repetir el asiento. El informe distingue presupuesto, gasto real y saldo por código de las compras vinculadas: una adquisición de inventario no equivale automáticamente a gasto de obra. Los gastos revertidos por la operación normal se excluyen del informe.

Factura por avance exige una etapa registrada, servicio de catálogo y base acumulada no superior al contrato por el avance global aprobado. Cada referencia de etapa se factura una vez, a crédito, con el cliente y contexto del servidor. Conserva precios mínimos, IVA, límites de crédito y demás reglas existentes. El cobro se registra en Cuentas por cobrar. Los porcentajes de etapa son informativos; la cota monetaria usa el avance global. Las notas de crédito no liberan automáticamente capacidad para volver a facturar una etapa.

Retener garantía reclasifica saldo disponible de la factura a una cuenta separada de activo por garantías por cobrar. Liberar lo devuelve a la cuenta por cobrar de esa factura; no reconoce otra venta ni simula cobro. Se guardan saldos y movimientos por factura. Debe liberarse la retención antes de emitir una nota de crédito. El dueño registra contratos de subcontratistas con proveedor y código; aprueba avances y devenga costo contra un pasivo separado. Los pagos cancelan solo el saldo devengado, sin repetir gasto. Estos devengos directos no calculan IVA, retenciones fiscales ni planilla; usa los circuitos fiscales existentes y verifica con tu contador.

Bitácora diaria y Equipo / maquinaria registran detalle, referencia del equipo, horas o cantidad, responsable y plazo en la obra. El gasto del equipo se registra por su código y comprobante. No se integraron telemetría, depreciación automática ni nóminas por cuadrilla.

## Agropecuario

En Lotes y vencimientos aparece Campo y ganadería. Las parcelas tienen área en hectáreas, ubicación y suelo inicial; la bitácora conserva nuevos registros de suelo. Cada ciclo identifica parcela, producto, siembra y precio esperado por unidad. Registra siembras, insumos, aplicaciones, pérdidas con cantidad y causa, tareas, mantenimiento y evidencias para certificaciones. Los costos se contabilizan una sola vez con comprobante y clasificación; los registros operativos no generan consumos de stock ni otros costos implícitos.

Cosecha trazable genera entrada de inventario, asiento y lote con vencimiento y referencias al ciclo y parcela. Usa el costo de catálogo vigente confirmado del producto, no un reparto automático de todos los gastos del cultivo. La contrapartida contable debe elegirse y revisarse con el contador. El informe conserva por separado el costo real registrado del cultivo, rendimiento por hectárea, costo por hectárea y unidad, ingresos de ventas, resultado y unidades de equilibrio al precio esperado. Son indicadores de gestión acumulados; no calculan márgenes por costos variables/fijos, valorización biológica ni una utilidad fiscal certificada. Los costos registrados directamente en la parcela o en animales permanecen en esas fichas y no se distribuyen a ciclos automáticamente.

Venta a acopiador usa un cliente activo, cantidad, precio confirmado y factura del motor existente. Exige cosecha suficiente del ciclo y lotes propios disponibles; si FEFO debe tomar primero otro ciclo del mismo producto, se rechaza esa atribución. Las notas de crédito reducen ingresos y cantidad vendida del informe; la reposición física depende de la devolución normal. Efectivo y transferencia conservan la obligación de turno abierto. Puede emitirse a crédito y cobrarse después en Cuentas por cobrar. No se añaden descuentos por fuera de la política existente.

Cada animal conserva identificación única, especie o raza, nacimiento, progenitor y registros de cría, sanidad, tratamientos, producción y pastoreo. Los registros pueden identificar lotes y documentos mediante referencia. Son fichas administrativas: no sustituyen receta veterinaria, trazabilidad oficial o certificación. La producción animal y las pérdidas anotadas no modifican inventario automáticamente. Las tareas tienen fecha, responsable, estado y cierre enlazado; el informe presenta calendario ordenado y vencimientos internos. Mantenimiento identifica el equipo en la referencia, el trabajo y su costo mediante Costo real; no automatiza cargos ni envía avisos externos.

## Manufactura y artesanal

Se mantienen las recetas de Producción. Para listas multinivel se crea una receta por producto y por subensamble; el motor expande hasta insumos finales, suma materiales comunes y rechaza ciclos o más de doce niveles. Las rutas añaden pasos, minutos y costo previsto. Una orden elige receta, pedido de venta opcional, cantidad y fecha programada. Conserva la ruta al crear y la receta completa al iniciar. No reserva existencias antes del inicio ni convierte automáticamente el pedido en factura.

MRP agrupa órdenes programadas y resta una sola vez la existencia actual por insumo final de la sucursal. Es planificación de compra sugerida, sin crear órdenes, pagos o reservas. No considera plazos de proveedor, compras en tránsito, restricciones de máquina ni disponibilidad de subensambles ya fabricados: los subensambles siempre se explotan hasta materia prima. Se muestran programación, estado y activo en proceso. La fecha es diaria, no un planificador de turnos o de capacidad finita.

Iniciar consume materiales y lotes vigentes FEFO, conserva sus referencias y reconoce su costo en una cuenta separada de activo en proceso. Las existencias comprometidas en consignación no se consumen. Se bloquean series y PEPS por los límites del motor existente. Agregar costo real al proceso capitaliza mano de obra u otro concepto contra caja, banco o deuda; no calcula IVA y no debe repetirse un gasto o nómina ya contabilizado. Los costos previstos de ruta nunca generan asientos. Completar paso registra responsable, minutos reales y resultado, en orden. Inspección en proceso conserva inspector, muestra, rechazos observados y acción correctiva, sin duplicar bajas.

Terminar exige ruta completa, inspección final, lote único y cantidades buenas, rechazadas y merma que sumen la orden. Cancela el activo en proceso, incorpora solo las buenas al inventario y lleva rechazos, merma y diferencias de valoración al costo elegido. El terminado conserva costo promedio y la restricción existente sobre cambios de costo que afectarían otras sucursales. El informe por unidad buena divide el costo total de la orden entre unidades buenas; el valor capitalizado separa la parte de pérdidas. Se conservan costo real, inspecciones, pasos y trazabilidad desde los lotes de insumo al lote terminado y las asignaciones FEFO de venta existentes. No se automatiza reproceso ni reversión de órdenes en proceso o terminadas.

## Verificación

Se prepararon casos en `tests/sectors.test.mjs` para ejecución por la plataforma. No se ejecutaron pruebas, servidores ni compilaciones locales. La revisión estática de sintaxis y diferencias no demuestra funcionamiento desplegado.

Después del despliegue verificar:

- Empaquetado e importaciones, sincronización JSON/relacional y persistencia tras recarga, respaldo, versiones y restauración; conservación de documentos y perfiles anteriores.
- Permisos efectivos del dueño, colaboradores, soporte de solo lectura y planes; sucursal activa, sucursales ajenas y consolidado. Comprobar rechazo de la API genérica y de datos monetarios fraccionarios o fuera de rango.
- Reintento con el mismo identificador, solicitud distinta y dos pestañas; un solo asiento, factura, consumo, lote o movimiento de retención.
- Cambios de presupuesto negativos y positivos, límite del contrato por avance, etapas únicas, IVA, mínimos de catálogo y límites de crédito. Retención parcial, liberación, cobros, notas de crédito y saldo por factura. Contrato, devengo parcial y pagos de subcontratistas sin duplicar costo.
- Costos y reversas, compras asociadas sin doble contabilización, bitácora y maquinaria. Parcelas, suelo, tareas vencidas/completadas, animales, cría y evidencias de certificación.
- Cosechas parciales, inventario y contrapartida, vencimientos, FEFO entre ciclos, ventas y devoluciones, costos/rendimiento por hectárea y equilibrio sin precio configurado.
- Listas multinivel compartidas, ciclos, precisión de cantidades, MRP con varias órdenes, lotes insuficientes/vencidos, series, PEPS y consignación. Producto en proceso, costos reales adicionales, pasos e inspecciones, terminación con merma/rechazos, todos rechazados y diferencias de centavos.
- Kardex y mayor de inventario/proceso, costo promedio con saldo previo, rechazo si afecta otras sucursales y ausencia de duplicación de nómina/costos. Comprobar impresión de fichas, texto escapado, teclado, móvil y claro/oscuro.

La reversión de la interfaz debe conservar registros, referencias y asientos; no eliminar tablas, migraciones ni documentos.
