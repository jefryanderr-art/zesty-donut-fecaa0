# Facturas registradas y aplicadas

Crear factura ofrece Aplicar y emitir como envío principal y Registrar como acción secundaria. Registrar conserva cliente, fecha de registro, líneas, precios confirmados y porcentaje de descuento propuesto. No conserva pagos ni autorización del descuento. No crea asiento, inventario, pago, numeración ni movimiento de turno; no reserva existencias. Solo requiere cliente y líneas válidas.

Facturación → Facturas registradas muestra estado, cliente, total y fecha. Editar permite continuar una registrada. Aplicar abre el mismo formulario con fecha actual y opciones actuales de serie, turno y pagos; la persona revisa y confirma Aplicar y emitir. El porcentaje propuesto exige nueva autorización del dueño. El total registrado es una referencia con IVA al registrar; al aplicar se recalcula con el catálogo vigente. Eliminar exige confirmación y solo admite Registrada. Aplicada enlaza al asiento y conserva la corrección existente mediante nota de crédito.

La colección invoiceDrafts está en el modelo monetario, esquema relacional, codec genérico, proyección de facturación y dimensión de sucursales. La migración generada es aditiva, con total en BIGINT de centavos, clave por empresa, índice empresa/fecha y RLS de servidor. Las líneas residuales usan el conversor compartido para sus precios. No se modificaron migraciones aplicadas.

Las operaciones reutilizan sesión, empresa, revisión optimista, transacción, versiones y bitácora de updateCompany. La sucursal proviene de la sesión. El guardado genérico no puede editar la colección. Los permisos granulares distinguen creación, edición y eliminación. Aplicar exige facturación y estado Registrada dentro de la transacción; la venta existente revalida precios, IVA, stock/valores negativos, serie, fecha, pagos y autorización de descuentos. Repetir el mismo recibo de operación conserva la idempotencia existente; otra operación sobre una ya Aplicada se rechaza.

## Selector y dimensiones: revisión estática

Se aplicaron las guías de backend, persistencia y diseño conservando la arquitectura existente y su presentación.

- **360 × 640:** factura como hoja inferior de ancho completo. Selector ajustado al alto visual disponible. Al abrir teclado se compactan cabecera, orden y paginación; buscar oculta temporalmente las líneas seleccionadas para dejar espacio al catálogo y al pie. Al editar cantidad se conserva la sección seleccionada. Listo y Cancelar permanecen en el pie flexible. Los controles táctiles conservan 44 px y los campos usan 16 px para evitar zoom automático de iOS.
- **768 px:** modal centrado de 520 px; selector de 96vw y listas desplazables. En horizontal con poca altura se reducen rellenos y alto de líneas seleccionadas. El foco inicial del selector va a Cerrar; tocar Buscar abre el teclado. Usar lector Bluetooth habilita foco con inputmode none, sin pretender detectar automáticamente el dispositivo conectado.
- **1024 px:** factura ampliada hasta 760 px desde 900 px; selector limitado a 1000 px y al alto visual disponible, conservando tabla y cantidades. El umbral de tablet del selector termina antes de 1024 px.
- **1440 px:** contenido principal hasta 1200 px desde 1280 px, factura de 760 px y selector hasta 1000 px. El foco automático de búsqueda se conserva con puntero fino para lectores USB.

Se concentraron los cambios de puntos de corte de esta entrega en 640/1024, conservando los umbrales explícitos de 900 para factura y 1280 para contenido solicitados. No se reescribieron los puntos de corte de módulos ajenos. Se sustituyeron alturas vh de modales por dvh. Se conservaron colores de tema, fuentes de impresión y reglas A4/Carta/ticket. El escáner evita enfocar un texto en táctiles al abrir; tocar su campo habilita escritura. La cámara conserva su implementación.

## Verificaciones y pendientes

Se consultó el estado de Database y se generó la migración con Drizzle. Se revisaron estáticamente integración, permisos, sucursales, escape, conversión monetaria y sintaxis de los JavaScript modificados. Se actualizaron la guía y las respuestas rápidas del asistente y las huellas de recursos estáticos. Se añadieron pruebas en tests/invoice-drafts.test.mjs para registro sin efectos, emisor real y asiento cuadrado, doble aplicación, bloqueo tras aplicar, permisos, empresas, sucursales, eliminación, stock/precios/IVA y codec.

No se ejecutaron pruebas, servidores ni compilaciones. Quedan pendientes por la plataforma y tras el despliegue: aplicar migración y comprobar RLS con el rol real de Functions; ejecutar pruebas; concurrencia entre pestañas y reintentos con revisión; permisos del plan y colaboradores; registrar, editar, eliminar y aplicar desde interfaz y API; reautorizar descuento; stock insuficiente con ambas políticas; series, cierres y turnos; empresas convertidas y no convertidas; auditoría y respaldos. Validar visualmente 360, 768, 1024 y 1440 px, tablet vertical/horizontal, teclado real iOS/Android, lector USB/Bluetooth, cámara, zoom, modo oscuro, ausencia de desplazamiento horizontal e impresión A4/Carta/ticket. La revisión estática no demuestra estas verificaciones funcionales o visuales.
