// Build no artifacts: maintain a SQL identity manifest alongside cache URL maintenance.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../netlify/database/migrations');
const rows=[];
for(const entry of readdirSync(root,{withFileTypes:true})){
 const file=entry.isDirectory()?resolve(root,entry.name,'migration.sql'):entry.name.endsWith('.sql')?resolve(root,entry.name):null;
 if(!file)continue;
 rows.push({name:entry.isDirectory()?entry.name:entry.name.slice(0,-4),hash:createHash('sha256').update(readFileSync(file)).digest('hex')});
}
rows.sort((a,b)=>a.name.localeCompare(b.name));
writeFileSync(resolve(import.meta.dirname,'../netlify/lib/health-migrations.mjs'),'// Manifest of immutable SQL files shipped with this version. No SQL is executed.\nexport const EXPECTED_MIGRATIONS='+JSON.stringify(rows,null,2)+';\n');
