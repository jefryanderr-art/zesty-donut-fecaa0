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

Por decisión del propietario se adaptó la Fase 0 a Netlify Database (Postgres), conservando el adaptador Drizzle actual. No se migró a Supabase ni se agregaron credenciales externas. Las fases posteriores, la interfaz solicitada, las sucursales y el asistente de IA quedan pendientes.

Las tablas relacionales contables usan claves por empresa e identificador histórico e índices por empresa y fecha. Guardar los importes en columnas BIGINT de centavos enteros, dentro del rango entero seguro de JavaScript; cantidades y tasas conservan su precisión. El frontend mantiene importes en unidades monetarias por compatibilidad. Declarar todo campo monetario nuevo en `db/accounting-model.mjs` o en el conversor residual; no introducir importes flotantes en metadatos nuevos.

La conversión es explícita por empresa después del despliegue: `scripts/migrate-accounting.mjs`, sin opciones de escritura, solo verifica. `--apply` copia, vuelve a leer y verifica antes de activar la lectura relacional. Exige revisión vigente y transacción con bloqueo de la empresa. No redondear ni corregir silenciosamente datos históricos: rechazar asientos descuadrados, duplicados, cuentas inexistentes o fracciones de centavo. Normalizar automáticamente las empresas nuevas al guardar por primera vez desde un documento nulo. Mantener JSON vigente, copia inicial independiente de la rotación de versiones, revisión optimista y bitácora. Los guardados de empresas convertidas sincronizan ambas representaciones en la misma transacción y solo escriben diferencias relacionales. La restauración existente también se sincroniza. `--rollback` vuelve a la copia JSON vigente sin eliminar tablas ni deshacer operaciones contables. Consultar `docs/migracion-contable.md`.

RLS se habilita en las tablas de la aplicación y permite solo roles de base de datos previamente autorizados a escribir empresas; los roles de navegador quedan excluidos. Validar además sesión, propiedad o membresía y permisos por módulo en Functions antes de consultar información de la empresa. No exponer conexión SQL al frontend. Comprobar el rol real de Functions después del despliegue; una conexión de inspección de solo lectura no representa ese permiso. La ruta `/api/storage-migration` solo permite operar al dueño de la empresa y exige JSON, mismo origen y revisión vigente. Los scripts con acceso al servidor son herramientas administrativas, no permisos para clientes.

## Autenticación y seguridad

El registro y el acceso normales usan `@netlify/identity`; la confirmación de correo y la recuperación de contraseñas mediante enlace en la web están soportadas. Google usa ID tokens verificados criptográficamente por `google-auth-library`. Todos los usuarios, clientes y el administrador pueden acceder indistintamente mediante correo y contraseña o con Google.

La sesión de la API usa un identificador aleatorio de 256 bits, cuyo hash y caducidad se guardan en Netlify Database. El identificador se guarda exclusivamente en una cookie HttpOnly, Secure y SameSite=Strict; no requiere `JWT_SECRET`. Los tokens de Identity no se persisten en el navegador. No almacenar tokens en localStorage. Las mutaciones exigen JSON y un origen igual al sitio. No escribir contraseñas, claves ni valores privados en archivos, documentación o logs. Los errores del servidor no deben revelar detalles internos.

## Cambios futuros

Mantener `drizzle-orm@beta` y `drizzle-kit@beta` mientras esa línea sea necesaria para el adaptador Netlify. Todo cambio de esquema requiere una migración generada con `npx drizzle-kit generate --name nombre_descriptivo`, previa consulta de `netlify db status`. No modificar migraciones ya aplicadas. No usar bases de datos externas ni archivos locales para información persistente.

Las dependencias se instalan con npm. No ejecutar compilaciones, servidores ni pruebas locales en sesiones gestionadas por la plataforma: ella valida y despliega. Revisar código y documentación de forma estática, y distinguir comprobaciones reales de verificaciones pendientes posteriores al despliegue. No cambiar la protección del equipo de Netlify de forma global para publicar este proyecto.
