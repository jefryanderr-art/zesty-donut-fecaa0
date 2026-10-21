// Ejecutar exclusivamente en un entorno de servidor con acceso Netlify Database.
// No acepta cadenas de conexión, contraseñas ni cookies como argumentos.
import { eq } from 'drizzle-orm';
import { db, database } from '../db/index.ts';
import { companies } from '../db/schema.ts';
import { migrateAccountingStorage } from '../netlify/lib/access.mjs';

const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
const companyId = args.includes('--company') ? option('--company') : '';
const revision = args.includes('--revision') ? Number(option('--revision')) : NaN;
const apply = args.includes('--apply'), rollback = args.includes('--rollback');
if (!/^[a-f0-9-]{36}$/.test(companyId) || !Number.isInteger(revision) || revision < 0 || (apply && rollback)
  || args.some(arg => arg.startsWith('--') && !['--company', '--revision', '--apply', '--rollback'].includes(arg))) {
  console.error('Uso: npm run storage:migrate -- --company UUID --revision N [--apply | --rollback]. Sin opción: solo verificar.');
  process.exit(1);
}
try {
  const [company] = await db.select({ ownerEmail: companies.ownerEmail }).from(companies).where(eq(companies.id, companyId));
  if (!company) throw new Error('missing');
  const report = await migrateAccountingStorage(companyId, { email: company.ownerEmail }, { revision, action: rollback ? 'rollback' : apply ? 'apply' : 'verify' });
  // Solo estado, revisión, conteos y totales; nunca registros, correos ni credenciales.
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.publicMessage || 'No se pudo completar la operación de almacenamiento. Verifica el despliegue, el acceso del servidor y la revisión de la empresa.');
  process.exitCode = 1;
} finally {
  await database.pool.end();
}

