import {readSession} from './api.mjs';
import {processPackage} from '../lib/package-jobs.mjs';
export const config={background:true};
export default async request=>{
 try{
  if(request.method!=='POST'||!request.headers.get('content-type')?.startsWith('application/json')||request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
  const session=await readSession(request,false);if(!session)return new Response(null,{status:401});
  const raw=await request.text();if(raw.length>1000)return new Response(null,{status:413});const body=JSON.parse(raw);
  await processPackage(session,body.companyId,body.id);
 }catch{ /* El estado persistido informa el fallo sin registrar contenido privado. */ }
};
