import {createHash} from 'node:crypto';
import {sql,eq,inArray} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {siteContent} from '../../db/schema.ts';
import {requirePlatform} from './platform.mjs';
import {audit} from './access.mjs';
import {JOBS,healthId,healthCode,healthRows,healthAlerts} from './system-health-rules.mjs';
import {EXPECTED_MIGRATIONS} from './health-migrations.mjs';
const rows=r=>r.rows||r;
async function migrationHealth(){
 const result={state:'unavailable',applied:[],pending:[],failed:null,failureVisibility:'unavailable'};
 try{
  const [native]=rows(await db.execute(sql`select to_regclass('netlify.migrations') is not null as available`));
  if(native.available){
   const applied=rows(await db.execute(sql`select name,applied_at from netlify.migrations order by applied_at,name`));
   const names=new Set(applied.map(r=>r.name));
   result.applied=applied.map(r=>r.name).filter(n=>/^[0-9]+_[a-z0-9_-]+$/.test(n));
   result.pending=EXPECTED_MIGRATIONS.filter(m=>!names.has(m.name)).map(m=>m.name);
   result.state='verified';return result;
  }
  const candidates=rows(await db.execute(sql`select table_schema,table_name from information_schema.columns where table_name like '%migration%' and column_name='hash' and table_schema not in ('pg_catalog','information_schema')`));
  if(candidates.length!==1)return result;
  const t=candidates[0],records=rows(await db.execute(sql`select hash from ${sql.identifier(t.table_schema)}.${sql.identifier(t.table_name)}`));
  const hashes=new Set(records.map(r=>r.hash));
  result.applied=EXPECTED_MIGRATIONS.filter(m=>hashes.has(m.hash)).map(m=>m.name);
  result.pending=EXPECTED_MIGRATIONS.filter(m=>!hashes.has(m.hash)).map(m=>m.name);
  result.state='verified';
 }catch{/* Failure logs belong to deployment; no raw SQL errors leave this endpoint. */}
 return result;
}
export async function systemHealth(session,companyId,format='VIEW'){
 await requirePlatform(session,companyId);
 if(!['VIEW','PDF','CSV'].includes(format))throw Object.assign(new Error('Formato inválido.'),{status:400,publicMessage:'Formato inválido.'});
 const mailCounts=rows(await db.execute(sql`select state,count(*)::int as count from acontec_service_messages group by state`));
 const issues=rows(await db.execute(sql`select id,state,created_at as "createdAt",last_error as code from acontec_service_messages where last_error is not null or state='error' or (state in ('pending','sending') and created_at<now()-interval '1 hour') order by created_at limit 101`));
 const mailTotal=rows(await db.execute(sql`select count(*)::int as count from acontec_service_messages where last_error is not null or state='error' or (state in ('pending','sending') and created_at<now()-interval '1 hour')`))[0].count;
 const pending=sql`state in ('creating','pending','unknown') or exists(select 1 from jsonb_array_elements(charges) c where c->>'status' in ('VERIFYING','FAILED','UNCOLLECTABLE'))`;
 const paymentTotals=rows(await db.execute(sql`select count(*)::int as count,min(created_at) as oldest from acontec_billing_checkouts where ${pending}`))[0];
 const paymentRows=rows(await db.execute(sql`select id,state,created_at as "createdAt" from acontec_billing_checkouts where ${pending} order by created_at limit 101`));
 const taskRows=await db.select({content:siteContent.content}).from(siteContent).where(inArray(siteContent.id,JOBS.map(j=>'system-task:'+j)));
 const jobs=JOBS.map(name=>{const r=taskRows.find(r=>r.content?.name===name)?.content;return {name,state:['running','success','failed'].includes(r?.state)?r.state:'unknown',startedAt:r?.startedAt||null,finishedAt:r?.finishedAt||null,code:healthCode(r?.code),stale:!r?.startedAt||Date.now()-Date.parse(r.startedAt)>(name==='resolve-payments'?6:30)*3600000}});
 const migrations=await migrationHealth();
 const report={version:1,generatedAt:new Date().toISOString(),generatedBy:createHash('sha256').update(session.memberId||session.email).digest('hex').slice(0,8),mail:{counts:mailCounts.map(r=>({state:healthRows([{id:'',state:r.state,createdAt:new Date()}])[0].state,count:r.count})),issues:healthRows(issues.slice(0,100)),total:mailTotal,truncated:issues.length>100},payments:{total:paymentTotals.count,oldestHours:paymentTotals.oldest?Math.max(0,Math.floor((Date.now()-new Date(paymentTotals.oldest))/3600000)):0,issues:healthRows(paymentRows.slice(0,100)),truncated:paymentRows.length>100},jobs,migrations};
 report.summary=healthAlerts(report);
 if(format!=='VIEW')await audit(db,companyId,session,'Descarga salud del sistema '+format,[{area:'salud_sistema',version:1,generatedAt:report.generatedAt}]);
 return report;
}
