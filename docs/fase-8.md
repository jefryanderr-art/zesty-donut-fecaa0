# Fase 8 — Salud del sistema

Se añadió Salud del sistema al menú exclusivo de la empresa de plataforma. La ruta y la API reutilizan requirePlatform: rol real platform_admin, sin sesión de colaborador y empresa de plataforma activa en servidor. La pantalla consulta al abrir o pulsar Actualizar; no usa sondeo ni crea tareas programadas.

El correo muestra conteos globales por estado, errores y mensajes pendientes/en envío con más de una hora, ordenados por antigüedad desde creación. Presenta hasta 100 incidencias y avisa el recorte, conservando el conteo completo. Los errores solo salen mediante una lista de códigos permitidos; cualquier texto distinto se convierte en ERROR_REQUIRES_REVIEW.

Pagadito muestra autorizaciones creating/pending/unknown y autorizaciones con cargos VERIFYING/FAILED/UNCOLLECTABLE, su cantidad, estado y antigüedad. La unidad de conteo es la autorización, no cada cuota ni cada cliente. Puede incluir un cargo fallido que requiera revisión aunque la autorización esté activa. Conserva ambos entornos; no suma ingresos ni consulta al proveedor. No modifica, concilia, reintenta ni reenvía.

Las tres tareas existentes guardan inicio y último resultado en siteContent, protegida por su RLS existente. Las ejecuciones concurrentes no dejan que una más antigua sobrescriba a una nueva. Se distinguen ejecución, éxito, fallo parcial y fallo; solo se guardan códigos genéricos. Los lotes con promesas rechazadas de sync-subscriptions y resolve-payments se marcan con fallo parcial. Los errores SMTP que se gestionan internamente siguen reflejados en la cola, no se reinterpretan como excepción de la tarea. Antes de la primera ejecución observada se muestra Sin resultado registrado; no se reconstruyen resultados anteriores.

El semáforo usa texto, color y forma. Correo y Pagadito pasan a rojo por antigüedad de 24 horas; errores de correo y tareas fallidas también son rojos. Tareas sin resultado, en ejecución o sin actualización en 30 horas (seis para resolve-payments) dan alerta. Cada alerta tiene una explicación sencilla. No se imprimen excepciones, cuerpos, destinatarios, nombres ni importes de clientes; el generador se identifica con un hash truncado de su identidad interna.

Las migraciones se comparan con el manifiesto de SQL incluido en la versión. Se consulta netlify.migrations, o el registro Drizzle con hash si el primero no existe. Si el rol de Functions no permite inspección, se muestra No disponible con alerta, nunca una lista aplicada inventada. El mantenimiento de URL de caché regenera el manifiesto sin ejecutar SQL.

**Límite real de observabilidad:** los registros de aplicaciones confirmadas no contienen intentos fallidos de despliegue. El panel declara que las migraciones fallidas no están disponibles y remite a los registros de Netlify; una pendiente no se etiqueta como fallida ni se afirma que hubo cero fallos. No se incorporaron credenciales administrativas de Netlify a Functions para consultar registros de despliegue. Esta parte del requisito no puede acreditarse con las fuentes actuales.

PDF/CSV contienen fecha, generador seudonimizado, versión y secciones del informe; la solicitud de descarga queda en acontec_audit_events. Se usan jsPDF/autotable locales existentes y se neutralizan fórmulas CSV. Textos uiT y estilos aditivos conservan el tema y style.css.

No se añadieron dependencias ni migraciones y no se desplegó ni mezcló con main. Las pruebas escritas cubren autorización de plataforma antes de leer, proyección sin datos de clientes y semáforo. Se verificaron únicamente node --check y git diff --check; las pruebas no se ejecutaron. Falta validar con la plataforma el acceso real, las tres tareas tras ejecutarse, permisos sobre el registro de migraciones, PDF/CSV y diseño móvil/oscuro.

Archivos de integración existentes: api.mjs añadió la ruta; las tres tareas añadieron observación sin cambiar cron; billing.mjs devuelve el conteo de errores ya obtenido; index.html carga los recursos aditivos; version-assets.mjs mantiene además el manifiesto. La reversión retira ruta/interfaz y observación, conservando todos los registros almacenados.
