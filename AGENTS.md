# Acontec: arquitectura y convenciones

La aplicación procede de un archivo adjunto y conserva `public/index.html`, `public/style.css`, `public/app.js`, `netlify/functions/api.mjs` y `netlify.toml`. No renombrar esos archivos ni introducir un paso de compilación para el frontend.

## Directorios

- `public/`: aplicación estática en español. La navegación, los formularios y las pantallas contables están en `app.js`; conservar las convenciones existentes y escapar contenido antes de insertarlo en HTML.
- `netlify/functions/`: API ESM de Netlify Functions. `api.mjs` usa rutas personalizadas `/api/*`. Netlify empaqueta sus importaciones TypeScript mediante esbuild.
- `db/`: esquema y cliente Drizzle con el adaptador `drizzle-orm/netlify-db`. `db/schema.ts` es la fuente de verdad; `db/accounting-model.mjs` declara campos, colecciones y unidades para la normalización contable.
- `netlify/database/migrations/`: migraciones Drizzle, aplicadas por la plataforma durante los despliegues.
- `.netlify/features/`: marcador que activa Netlify Identity. Los archivos adjuntos y otros metadatos internos de `.netlify` no se publican.

## Persistencia y permisos

Usar Netlify Database para usuarios, empresas, documentos contables, contenido público y límites de acceso. Usar Netlify Blobs para imágenes de portada WebP y, por autorización del propietario, comprobantes fiscales privados PDF, JPG, PNG o WebP. Los comprobantes tienen un máximo de 1 MB, uno por obligación y un límite por empresa de 100 archivos o 50 MB; su referencia y metadatos se guardan en Netlify Database y su descarga siempre valida la sesión y la propiedad de la empresa. Cada lectura y escritura contable valida la propiedad de la empresa por el correo de la sesión. Mantener la revisión optimista para impedir sobrescrituras accidentales entre pestañas.

El editor modifica contenido global, no el nombre de empresa de los clientes. El nombre de empresa siempre encabeza el panel de cada cliente; un título editorial nunca lo reemplaza. Los cambios públicos se recargan al abrir el sitio.

## Fase 0: normalización contable

Por decisión del propietario se adaptó la Fase 0 a Netlify Database (Postgres), conservando el adaptador Drizzle actual. No se migró a Supabase ni se agregaron credenciales externas. Se incorporaron módulos de gestión, sucursales, códigos de barras e impresión; su alcance y sus límites se documentan en `docs/gestion-y-sucursales.md`. No se agregó un asistente de IA.

Las tablas relacionales contables usan claves por empresa e identificador histórico e índices por empresa y fecha. Guardar los importes en columnas BIGINT de centavos enteros, dentro del rango entero seguro de JavaScript; cantidades y tasas conservan su precisión. El frontend mantiene importes en unidades monetarias por compatibilidad. Declarar todo campo monetario nuevo en `db/accounting-model.mjs` o en el conversor residual; no introducir importes flotantes en metadatos nuevos.

La conversión es explícita por empresa después del despliegue: `scripts/migrate-accounting.mjs`, sin opciones de escritura, solo verifica. `--apply` copia, vuelve a leer y verifica antes de activar la lectura relacional. Exige revisión vigente y transacción con bloqueo de la empresa. No redondear ni corregir silenciosamente datos históricos: rechazar asientos descuadrados, duplicados, cuentas inexistentes o fracciones de centavo. Normalizar automáticamente las empresas nuevas al guardar por primera vez desde un documento nulo. Mantener JSON vigente, copia inicial independiente de la rotación de versiones, revisión optimista y bitácora. Los guardados de empresas convertidas sincronizan ambas representaciones en la misma transacción y solo escriben diferencias relacionales. La restauración existente también se sincroniza. `--rollback` vuelve a la copia JSON vigente sin eliminar tablas ni deshacer operaciones contables. Consultar `docs/migracion-contable.md`.

RLS se habilita en las tablas de la aplicación y permite solo roles de base de datos previamente autorizados a escribir empresas; los roles de navegador quedan excluidos. Validar además sesión, propiedad o membresía y permisos por módulo en Functions antes de consultar información de la empresa. No exponer conexión SQL al frontend. Comprobar el rol real de Functions después del despliegue; una conexión de inspección de solo lectura no representa ese permiso. La ruta `/api/storage-migration` solo permite operar al dueño de la empresa y exige JSON, mismo origen y revisión vigente. Los scripts con acceso al servidor son herramientas administrativas, no permisos para clientes.

## Autenticación y seguridad

El registro y el acceso normales usan `@netlify/identity`; la confirmación de correo y la recuperación de contraseñas mediante enlace en la web están soportadas. Google usa ID tokens verificados criptográficamente por `google-auth-library`. Todos los usuarios, clientes y el administrador pueden acceder indistintamente mediante correo y contraseña o con Google.

La sesión de la API usa un identificador aleatorio de 256 bits, cuyo hash y caducidad se guardan en Netlify Database. El identificador se guarda exclusivamente en una cookie HttpOnly, Secure y SameSite=Strict; no requiere `JWT_SECRET`. Los tokens de Identity no se persisten en el navegador. No almacenar tokens en localStorage. Las mutaciones exigen JSON y un origen igual al sitio. No escribir contraseñas, claves ni valores privados en archivos, documentación o logs. Los errores del servidor no deben revelar detalles internos.

## Cambios futuros

Mantener `drizzle-orm@beta` y `drizzle-kit@beta` mientras esa línea sea necesaria para el adaptador Netlify. Todo cambio de esquema requiere una migración generada con `npx drizzle-kit generate --name nombre_descriptivo`, previa consulta de `netlify db status`. No modificar migraciones ya aplicadas. La decisión confirmada del propietario mantiene Netlify Database (Postgres), sin migración a Supabase. No usar archivos locales como persistencia ni exponer conexiones al navegador.

Las dependencias se instalan con npm. No ejecutar compilaciones, servidores ni pruebas locales en sesiones gestionadas por la plataforma: ella valida y despliega. Revisar código y documentación de forma estática, y distinguir comprobaciones reales de verificaciones pendientes posteriores al despliegue. No cambiar la protección del equipo de Netlify de forma global para publicar este proyecto.


## Gestión, sucursales y facturación

Los módulos clásicos adicionales de `public/` se cargan en orden desde `index.html`; conservan los objetos `ACT`, `V`, las funciones de permisos y el escape `esc`. `public/accounting-math.mjs` comparte cálculos puros con Functions mediante `netlify/lib/accounting-engine.mjs`. No duplicar reglas monetarias en nuevas operaciones. `advanced.mjs`, `trade.mjs`, `transfers.mjs`, `country.mjs` e `importer.mjs` contienen operaciones validadas en el servidor. Conservar confirmaciones y bitácora en asientos de cierre, provisiones y conversiones.

La sucursal histórica se identifica como `principal`. La asignación histórica se materializa en el siguiente guardado satisfactorio, sin alterar importes. `branches.mjs` limita lecturas y fusiona escrituras conservando las demás sucursales. Los catálogos son por empresa; las existencias se derivan por sucursal. `activeBranchId` pertenece a la sesión del servidor. El consolidado es de consulta; solo operaciones explícitas y validadas admiten escritura entre sucursales. No aceptar la sucursal enviada por el navegador como autorización. Cambiar asignaciones revoca sesiones. Nuevas dimensiones requieren declarar colección, campos monetarios, proyección por módulo y filtrado por sucursal.

Los clientes conservan todas sus empresas previas y solo pueden crear una empresa propia. La excepción de creación ilimitada y archivo de empresas propias corresponde exclusivamente a `jefryanderr@gmail.com`; Acontec está protegida. La acción de borrar archiva y conserva datos, versiones y auditoría. No convertirla en borrado físico. El límite global de sucursales se configura por esa cuenta; reducirlo no elimina sucursales.

Los códigos de barras se validan y sincronizan en la transacción de la empresa, con unicidad por empresa y permisos de inventario. La cámara carga un respaldo local de ZXing únicamente al abrirse. No agregar CDN ni capturar lectores mientras el usuario escribe en otro control. La factura utiliza el precio confirmado por línea y conserva precio de catálogo y costo histórico. La impresión ofrece A4, Carta y ticket; escapar datos y validar las fuentes de imagen.

Los archivos estáticos tienen caché inmutable. Después de editar recursos o dependencias locales ejecutar `node scripts/version-assets.mjs`: actualiza huellas en URL sin compilar. HTML y API nunca deben reutilizar datos contables en caché. El índice local de productos caduca a los cinco minutos y no es fuente de precios, existencias, permisos ni sesiones. No guardar tokens en localStorage.

Las pruebas de `tests/` están preparadas para ejecución por la plataforma; no afirmar que pasaron por haber comprobado sintaxis. Las migraciones nuevas son aditivas. Revertir funcionalidad conservando tablas y documentos, nunca eliminar datos para revertir una entrega. Consultar la guía de despliegue para verificaciones reales, pendientes y límites del alcance.
