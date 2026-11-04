# Fase 9 — Ampliación de la auditoría existente

Se añadieron Ejecutar auditoría, umbrales, recordatorio e historial a la ruta auditoria y junto a Integridad contable. La bitácora y la verificación de integridad anteriores se conservaron; no se creó una pantalla contable alternativa ni se cambiaron los hechos que registran.

Se implementaron 27 reglas con explicaciones, registros de origen, gravedad y puntajes por área e identidad, informes inmutables con período/fecha/solicitante/alcance/versión, PDF/CSV auditados y seguimiento separado. Cada cierre requiere comentario y responsable. Las evidencias enlazan comprobantes existentes, sin ampliar sus permisos. Los umbrales y el recordatorio interno son configurables por el dueño con confirmación, motivo y auditoría. La guía de ayuda documenta los controles nuevos.

El permiso propio audita únicamente fuentes autorizadas por el plan y la sesión; se respeta la sucursal del servidor y se excluye soporte temporal. El dueño y el contador tienen acceso inicial salvo denegación explícita. Se protege el historial también en las respuestas genéricas y frente a restauraciones que intenten borrarlo. Ejecutar no corrige asientos, inventario, nóminas ni cifras: solo añade historial y metadatos de revisión/bitácora mediante runOperation/updateCompany. La combinación especial conserva incluso el orden y la asignación histórica de los registros ajenos al informe.

Las reglas y los valores sugeridos, límites de interpretación, cobertura y falsos positivos están en [auditoria-ampliada.md](auditoria-ampliada.md). Es ayuda interna, no auditoría externa ni prueba legal; verifica con tu contador. Datos históricos incompletos pueden impedir evaluar reglas; no se inventan horas, actores, comprobantes, feriados ni precios históricos. Los catálogos se observan en su estado disponible al ejecutar.

Se reutilizaron businessRecords y cfg en Netlify Database, sus tablas relacionales, campos residuales, RLS, revisión, versiones y respaldo. No hubo migraciones ni dependencias nuevas. Los montos nuevos de umbrales se declararon como centavos nativos en el codec. No hubo llamadas externas ni IA, correos, tareas programadas, despliegue ni mezcla con main.

Se añadieron los motores/reglas, interfaz y CSS propios; se tocaron puntos de integración en operations.mjs, access.mjs, policies.mjs, business.mjs, billing-rules.mjs, accounting-codec.mjs, public/access.js, public/billing.js, index.html, assistant-guide.mjs y el mantenimiento de recursos. Estos cambios habilitan permisos, preservan/proyectan el historial y cargan los controles adicionales; las operaciones monetarias previas y style.css se conservaron.

Se escribieron pruebas positivas y negativas para cada regla, separación de funciones, ausencia de modificación, combinación entre sucursales, puntajes, falta de permisos e inmutabilidad. Solo se ejecutaron node --check y git diff --check. No se ejecutaron pruebas, servidor ni compilación. La validación funcional, permisos reales de cuatro planes y colaboradores, concurrencia/idempotencia, tiempos con volúmenes grandes, RLS, exportaciones, evidencias, respaldos/restauración y móvil/oscuro quedó sin verificar en esta sesión.

Para revertir, se pueden retirar los controles y el despacho de operaciones nuevas, conservando registros, tablas y la protección de inmutabilidad. No se borra historia para revertir la entrega.
