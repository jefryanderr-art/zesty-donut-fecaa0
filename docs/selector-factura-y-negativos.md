# Selector de factura y saldos negativos por empresa

La factura conserva sus filas internas, precios confirmados, IVA, contraseña de descuento, métodos de pago, numeración y emisión mediante la operación de venta existente. Agregar producto abre una selección provisional con búsqueda local del catálogo autorizado de la empresa y sucursal, columnas ordenables, páginas de 40 artículos, edición de cantidades y total de productos antes de descuentos e IVA. Listo aplica las filas y exige autorizar nuevamente cualquier descuento; Cancelar y Escape descartan la selección provisional. Los precios de temporada y las listas de cliente conservan su propuesta existente. El catálogo del panel no autoriza precios ni existencias: el servidor vuelve a validarlos al emitir.

Los lectores USB y Bluetooth escriben en el buscador y Enter busca código de barras o código interno exacto. La cámara reutiliza BarcodeDetector y ZXing local, cargado al abrir el escáner, con permisos y detección de cámara existentes. No se intercepta escritura en otros campos. Un código desconocido muestra un aviso y permite continuar. Las líneas repetidas suman cantidad y conservan el precio confirmado. El total del selector suma cantidades y subtotales de productos; el total fiscal sigue calculándose en la factura.

La columna booleana de empresa `allow_negative_values` tiene valor inicial false y es la autoridad del servidor. Su copia `cfg.allowNegativeValues` es una proyección para los motores contables y la interfaz; enviar otra copia en un guardado o respaldo no cambia la columna. El dueño la cambia desde Ajustes, mediante la operación settings con sesión, permisos, revisión optimista, transacción y auditoría existentes. No cambia la configuración de otras empresas y no habilita escritura a colaboradores sin permisos. Al quitarla se conservan los saldos históricos.

Con la opción activa se omiten los controles de saldo negativo de caja/bancos, existencia general, consumibles, disponibilidad comprometida, traslados y abonos superiores a la deuda. Se conservan los controles de validez de documentos, importes de operación positivos, cuentas, asientos cuadrados, unidades, permisos, trazabilidad de series/lotes, fechas, límites por movimiento y autorización de descuentos. Las pérdidas del período ya se calculaban con signo; no se cambió su fórmula ni las reglas fiscales.

PEPS registra un faltante autorizado como una capa identificada con cantidad y valor negativos al costo vigente, vinculada al consumo; no modifica las capas históricas. Las entradas y devoluciones siguen registrando sus capas con valor real. La validación conserva igualdad entre capas, Kardex y cuenta 1301. Los costos unitarios siguen siendo no negativos; los saldos contables pueden ser negativos. Los límites históricos de PEPS para traslados, producción y otras operaciones sin soporte de capas permanecen vigentes.

## Comprobaciones pendientes en plataforma

Se revisó estáticamente el código y se comprobó sintaxis de los archivos modificados; no se ejecutaron pruebas, servidor ni compilación local. Las pruebas nuevas quedaron preparadas para la plataforma. La migración se generó después de consultar el estado de Database y no se aplicó manualmente.

Tras desplegar, comprobar aislamiento con dos empresas, valor inicial apagado en empresa actual/nueva, rechazo de cambios por colaboradores, soporte de consulta y API manipulada, conflicto de revisión y permanencia tras recargar. Activar en una empresa y verificar venta sin stock, consumibles, gasto/pago sin fondos, abono excedente, Kardex, reportes, PEPS y devolución; contrastar debe/haber y confirmar comportamiento estricto en la otra empresa. Desactivar sin cambiar documentos históricos.

Verificar visualmente a 360, 768, 1024 y 1440 px, con tablet vertical/horizontal, modo oscuro y zoom: ausencia de desplazamiento horizontal, controles de 44 px, encabezado/buscador/escáner y total accesibles, navegación con Tab/flechas/Enter/Escape, cancelar sin cambios, precios editados conservados, cantidad repetida acumulada y autorización de descuento invalidada solo al confirmar cambios. Probar cámara real con permiso concedido/denegado y equipo sin cámara, lector USB y Bluetooth, código inexistente y varios escaneos seguidos. Confirmar emisión, asiento, IVA, totales, numeración y descuento con las pruebas habituales del proyecto.

## Buscar clientes y plazos personalizados

Crear factura y Nueva venta conservan el selector de cartera, Cliente manual / general y Otro (escribir nombre). Buscar cliente abre un diálogo sobre la factura y bloquea temporalmente su formulario. La búsqueda ignora tildes y mayúsculas y consulta nombre, RUC/cédula y teléfono. Los filtros Todos, Crédito y Contado usan el tipo de la ficha; Crédito se preselecciona si la factura ya lo tiene marcado. Se muestran solo clientes activos, 40 por página, con plazo y límite para crédito; en móvil aparecen tarjetas. Elegir un cliente dispara el evento change del selector existente para completar la información y el vencimiento sin duplicar reglas de pago. Cerrar y Escape conservan el borrador y devuelven el foco al botón.

Con permiso de creación, + Nuevo cliente abre la ficha existente sobre el buscador. Guardar incorpora el cliente activo a la selección; cancelar devuelve al buscador. Se conserva el guardado habitual en la nube, con su estado y revisión optimista, sin navegar ni reconstruir la factura. Una ficha creada inactiva o suspendida no se selecciona para una venta nueva.

Cartera de clientes ofrece 1, 3, 7 (1 semana), 15, 30 (1 mes), 45, 60, 90, 180 (6 meses) y 365 días (1 año). Otro (escribir) habilita Días de plazo, un entero entre 1 y 3650. Al editar, un plazo fuera de la lista se abre como Otro con su valor. Se conserva el campo creditDays sin migraciones ni cambios de documentos históricos. La validación del servidor admite el mismo intervalo. La importación de clientes mantiene su valor predeterminado de 30 días y no restringe otros plazos existentes. Verifica con tu contador las condiciones comerciales.

Verificaciones pendientes tras el despliegue (revisión estática, sin ejecutar pruebas, servidores ni compilaciones locales):

1. En Crear factura, abrir Buscar cliente, filtrar Crédito y elegir una ficha; revisar nombre, información y vencimiento. Repetir en Nueva venta contable.
2. Crear un cliente desde el panel y comprobar que queda seleccionado sin perder fecha, productos, precios, pagos ni descuento. Cancelar la ficha y el buscador con botones y Escape; comprobar retorno de foco.
3. Guardar clientes con 1, 7, 365 y Otro con 5 días; rechazar vacío, cero, negativos, decimales y más de 3650.
4. Editar una ficha de 30 días y otra personalizada de 6 días; conservar sus condiciones.
5. Emitir una venta a crédito con plazo personalizado y revisar el vencimiento guardado.
6. Comprobar búsqueda con tildes/mayúsculas, RUC y teléfono; paginación con más de 40 clientes; excluir inactivos/suspendidos, permisos de creación, tarjetas móviles y modo oscuro. Elegir contado con crédito previamente marcado conserva la regla de pago existente.
