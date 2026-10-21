# Gestión, sucursales y despliegue

## Decisiones y alcance

La base sigue siendo Netlify Database (Postgres), por respuesta expresa del propietario. Se conservaron Identity, Google, sesiones seguras, permisos por módulo, revisión optimista y auditoría. La entrega amplía la aplicación; no completa todas las funciones de las nueve fases solicitadas. Las reglas fiscales son referencias editables y deben revisarse con el contador.

### Funciones incorporadas

- Facturación: precio unitario editable junto a cantidad, valor inicial del producto, recálculo de base, IVA y total. Se conserva el precio confirmado por línea, sin modificar el catálogo. Los límites de descuento del colaborador también consideran rebajas manuales.
- Impresión: selección al imprimir entre A4, Carta y ticket de 80 mm; encabezado, cliente, detalle, descuentos, IVA, total en letras, pagos, saldo, firmas y pie Sistema Acontec. Preferencias de empresa y texto legal editable. La impresión PDF utiliza el navegador.
- Legal: cuatro documentos en modales, sección lateral y banner flotante de cookies técnicas; aceptación en localStorage. La privacidad identifica la base efectivamente utilizada.
- Sucursales: Principal histórica, selector de sesión, lectura consolidada, catálogos compartidos, movimientos separados, asignaciones de colaboradores y revocación de sesiones. Las escrituras se filtran y fusionan en servidor. El límite inicial es cinco sucursales, configurable entre una y cien por el administrador.
- Empresas: una empresa propia nueva por cliente; las empresas históricas se conservan. La excepción corresponde a jefryanderr@gmail.com. Borrar una empresa propia seleccionada significa archivarla conservando documentos, respaldos y auditoría. Acontec está protegida. No se incorporó una pantalla de recuperación de empresas archivadas.
- Traslados: inventario enviado, cuenta de tránsito, recepción única y validación de existencias y destinos autorizados; dinero con asientos de origen y destino que se compensan en el consolidado.
- Contabilidad: cierre mensual por sucursal, reapertura del dueño con motivo, cierre anual a utilidades acumuladas, activos y depreciación lineal o doble saldo decreciente, bajas, préstamos y cuotas, tasas manuales por fecha, documentos en moneda extranjera y diferencias al liquidar. Plantillas recurrentes, provisiones confirmadas y ampliación del plan de cuentas.
- Gestión: razones, comparativos, movimientos patrimoniales, presupuesto mensual, escenarios orientativos de caja, calendario de facturas pendientes, antigüedad 30/60/90, cotizaciones y órdenes convertibles, gráficos y resultados por centro de costo o proyecto.
- Compras y capital: devoluciones, notas de débito, prorrateo de desembarque, retenciones y constancias internas imprimibles, libros internos de compras/ventas/IVA, cheques/letras/pagarés y movimientos de socios/reserva.
- Reportes: comparativo entre sucursales y suma de hasta veinte empresas autorizadas con igual moneda. No hay eliminación de operaciones entre empresas. Diario y mayor incluyen sucursal; respaldo y exportación indican el contexto seleccionado.
- Análisis: VAN, TIR orientativa, recuperación simple, simulador de préstamo/leasing, precio objetivo, equilibrio, escenarios de utilidad, rentabilidad con costo histórico, ABC, reorden y pronóstico sencillo con alertas deterministas. No se agregaron llamadas a IA.
- Personal: registro de asistencia/ausencias/permisos y vacaciones, plantilla nicaragüense editable, IR progresivo configurable, aportes patronales, provisiones, boleta imprimible y costos por empleado/área.
- Importaciones: CSV/XLSX para productos, clientes, proveedores, cuentas y saldos iniciales, vista previa y confirmación, inserción atómica sin sobrescribir registros. Máximo mil filas y 5 MB. Excel se carga localmente bajo demanda.
- Códigos de barras: varios por producto, únicos por empresa, validación transaccional, ingreso por Enter y cámara continua con respaldo ZXing local, linterna cuando está disponible y mensajes de permisos. Facturación incrementa cantidad, compras permite alta rápida autorizada, inventario busca y ofrece conteo físico con diferencias confirmadas.
- Integridad: diagnóstico de descuadres, duplicados, cuentas inexistentes/sin movimiento, documentos sin líneas y existencias negativas, sin corregir datos automáticamente.

### Límites y funciones pendientes

No se implementaron bodegas dentro de una sucursal, lotes/vencimientos, capas de inventario PEPS ni cambio configurable de costeo, recetas/kits, etiquetas opcionales, ajuste por inflación/deslizamiento, carga automática de tasa oficial, indicadores externos del sector, metas y comisiones, cobranza automática por correo/WhatsApp, límite de crédito dinámico, eliminaciones intercompañía ni asistente IA. No existe un motor completo de flujo indirecto o de tesorería futura. Los escenarios de caja se basan en facturas pendientes; el pronóstico y EBITDA son aproximaciones identificadas en pantalla.

El registro de adelantos tiene soporte de servidor, pero falta completar la interfaz y la automatización de préstamos/cuotas a empleados. El registro de vacaciones no constituye un calendario integral con aprobación. La exportación de tablas a Excel y libros internos no equivale a una exportación fiscal oficial configurable y homologada por país.

El cierre anual requiere reabrir previamente los meses cerrados; cada reapertura queda auditada. No modifica ni elimina documentos originales. El desembarque está limitado a compras cuyo inventario no se haya vendido o distribuido a otras sucursales. Las operaciones fiscales y constancias internas requieren revisión profesional antes de su presentación oficial.

La restauración ZIP recupera empresa.json y utiliza las validaciones y revisiones existentes. No reimporta los archivos binarios del ZIP: los comprobantes deben permanecer en el almacenamiento privado de la empresa. Las protecciones de períodos y de documentos gestionados pueden rechazar restauraciones que intenten modificar operaciones protegidas. No se implementó una restauración integral de desastre ni recuperación de empresas archivadas.

La configuración de impresión es por empresa, sin sustitución independiente por sucursal. Los datos de contacto empresariales de impresión se toman de la configuración actual. La cobertura de búsquedas y escaneo se concentra en facturación, compras, productos y conteo; faltan flujos de cámara específicos en traslados y reconocimiento transversal de todos los buscadores.

## Persistencia y reversión

Se conservaron las cuatro migraciones aplicadas y la migración pendiente de normalización existente. Se generaron cuatro migraciones nuevas aditivas: sucursales/códigos/archivo, gestión contable, traslados y documentos comerciales. La plataforma debe aplicarlas durante el despliegue; esta sesión no las aplicó a producción.

La sucursal Principal existe virtualmente para datos históricos y se materializa al guardar correctamente cada empresa, sin cambiar sus importes. La conversión relacional por empresa conserva la copia JSON, compara reconstrucción, conteos y totales, y mantiene el procedimiento descrito en migracion-contable.md. No ejecutar conversión sobre datos reales sin revisar el informe y la revisión vigente.

Antes de producción, conservar un respaldo verificado. Para revertir la funcionalidad, restaurar la versión anterior del código conservando las migraciones ya aplicadas y todas las tablas y documentos nuevos. No revertir esquema mediante DROP ni retirar migraciones aplicadas. El rollback de normalización vuelve a la copia JSON vigente y no borra documentos. Volver al código previo puede ocultar módulos nuevos: comprobar su preservación antes de permitir nuevas escrituras. No se generaron migraciones destructivas de bajada.

## Rendimiento y caché

HTML, API y rutas de Functions tienen no-cache/no-store. JavaScript, CSS, imágenes y fuentes admiten caché anual inmutable. Las referencias de scripts y estilos y las dependencias locales cargadas dinámicamente llevan huellas de contenido; ejecutar `node scripts/version-assets.mjs` después de cambios. No es una compilación. Las imágenes dinámicas deben continuar utilizando URL distintas al reemplazarlas.

El índice temporal de referencias de productos caduca a los cinco minutos y depende de empresa, usuario y revisión. No restaura saldos, permisos, existencias, precios ni tokens. No sustituye la descarga autorizada del documento contable. Cámara y Excel se cargan al usarlos; los simuladores son locales y no consumen inferencia. El ahorro efectivo de créditos requiere observar métricas tras el despliegue; no está cuantificado.

## Comprobaciones y pruebas pendientes

Se comprobaron estáticamente la sintaxis de JavaScript y TypeScript, la compatibilidad de declaraciones de los scripts clásicos cargados juntos y espacios de los cambios. Se prepararon pruebas unitarias de cálculo, IVA, nómina, devolución, amortización, depreciación, centavos, importación, cierre, permisos de sucursal, aislamiento y traslados. No se ejecutaron pruebas, servidores ni compilaciones locales; no se acredita aún una validación funcional.

La plataforma y el responsable deben comprobar en una vista previa HTTPS antes de producción:

1. Aplicación de migraciones y rol real de Functions con RLS, inicio con Identity y Google, cierre de sesión, revocación y revisiones concurrentes.
2. Totales y conteos antes/después de normalizar y materializar Principal, guardado/lectura relacional, preservación de otras sucursales y recuperación de copia.
3. Aislamiento entre empresas y sucursales mediante peticiones directas; dueño/contador frente a colaboradores asignados; cambios de asignación y revocación; límite de empresas y sucursales; protección de Acontec.
4. Traslados enviados/recibidos una sola vez, inventario en tránsito, costo, disponibilidad, fechas y saldos futuros de caja; consolidado sin duplicar flujo, comparación y lectura sin escritura en Todas las sucursales.
5. Precio manual mayor/menor/cero, cantidades fraccionarias, descuento permitido, IVA y notas de crédito parciales/finales, pagos mixtos, crédito, existencias y asiento cuadrado.
6. Cierre/reapertura y restauración contra período cerrado, cierre anual, depreciación y baja, cuotas de préstamo, diferencial cambiario y provisiones sin duplicación.
7. Impresión A4/Carta/80 mm, factura multipágina, encabezados repetidos, firmas, textos largos, logos, monedas, móvil y contenido malicioso escapado.
8. EAN-13 real, código repetido por empresa, empresa distinta, producto inexistente, alta sin permiso, stock agotado, veinte lecturas continuas, lector USB/Bluetooth y retorno de foco.
9. Cámara Android/iPhone, respaldo local en Safari, permiso denegado, linterna, cierre de cámara y ausencia de cargas externas del lector.
10. Importación CSV/XLSX inválida, duplicados, atomicidad, saldos cuadrados, restauración ZIP con protecciones y límites, exportaciones y comprobantes existentes.
11. IR/INSS/INATEC/beneficios y aportes contra cálculo del contador; permisos de libros/constancias, retenciones, devoluciones de compras y desembarque.
12. Banner inicial/aceptación y navegador sin almacenamiento, CSP de Google y cámara, cabeceras reales de API/HTML/recursos y actualización de recursos entre dos despliegues.
