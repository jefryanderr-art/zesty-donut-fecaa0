# Revisión de secretos

Revisión estática del árbol disponible, incluidos archivos ocultos de `.netlify`, sin consultar variables privadas. Los valores se omiten: `****`. El historial y los commits no se pudieron revisar porque esta sesión prohíbe acceder a `.git`; no se afirma que estén limpios. La contraseña administrativa anterior no se conoce y no se pudo descartar en el historial.

Apariciones del correo administrativo fijo antes del cambio (`****`):

- `README.md:41`
- `README.md:84`
- `AGENTS.md:48`
- `public/branches.js:2`
- `public/legal.js:9`
- `docs/gestion-y-sucursales.md:13`
- `netlify/lib/policies.mjs:1`
- `netlify/lib/legal-templates.mjs:3`
- `netlify/lib/legal-templates.mjs:4`
- `netlify/lib/legal-templates.mjs:5`
- `netlify/database/migrations/20261022223000_publish_approved_payment_policies.sql:10`
- `netlify/database/migrations/20261022223000_publish_approved_payment_policies.sql:16`
- `netlify/database/migrations/20261022223000_publish_approved_payment_policies.sql:17`
- `netlify/database/migrations/20261022223000_publish_approved_payment_policies.sql:18`
- `netlify/database/migrations/20261022223000_publish_approved_payment_policies.sql:26`

Candidatos por patrones de credenciales (incluyen ejemplos de pruebas; no prueban que sean secretos activos):

- `tests/email-auth.test.mjs:56` — valor omitido (`****`).
- `tests/email-auth.test.mjs:63` — valor omitido (`****`).
- `tests/email-auth.test.mjs:68` — valor omitido (`****`).
- `tests/email-auth.test.mjs:76` — valor omitido (`****`).
- `tests/email-auth.test.mjs:90` — valor omitido (`****`).
- `tests/email-auth.test.mjs:99` — valor omitido (`****`).
- `tests/email-auth.test.mjs:103` — valor omitido (`****`).
- `tests/email-auth.test.mjs:107` — valor omitido (`****`).
- `tests/assistant-guide.test.mjs:77` — valor omitido (`****`).
- `public/vendor/xlsx.js:114` — valor omitido (`****`).

La migración aplicada se conservó intacta. Los documentos legales ya guardados en Database y el historial requieren revisión separada; no se reescribieron contratos publicados. No se encontró contraseña administrativa literal en el código de acceso actual: usaba ADMIN_PASSWORD o Identity. Un identificador público de cliente Google no es una clave privada.
