import {sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {siteContent} from '../../db/schema.ts';
import {JOBS} from './system-health-rules.mjs';
export async function observeTask(name,work){
 if(!JOBS.includes(name))throw new Error('Unknown task');
 const startedAt=new Date().toISOString();
 const save=async(state,code=null)=>{const content={name,state,code,startedAt,finishedAt:state==='running'?null:new Date().toISOString()};await db.insert(siteContent).values({id:'system-task:'+name,content,updatedAt:new Date(startedAt)}).onConflictDoUpdate({target:siteContent.id,set:{content,updatedAt:new Date(startedAt)},setWhere:sql`${siteContent.updatedAt}<=${startedAt}::timestamp`})};
 await save('running');
 try{const result=await work();await save(result?.errors?'failed':'success',result?.errors?'PARTIAL_FAILURE':null);return result}catch(error){await save('failed','TASK_FAILED');throw error}
}
