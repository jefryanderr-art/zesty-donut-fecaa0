import {eq,desc,sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {siteContent,servicePlans} from '../../db/schema.ts';
import {isPlatformAdmin} from './customer-admin.mjs';
import {billingError} from './billing-rules.mjs';
import {event} from './billing.mjs';
import {UI_CATALOG} from '../../public/ui-text-catalog.mjs';
const defaults=()=>({texts:{},appearance:{},navigation:{},sections:[],seo:{}});
export async function publishedEditor(){const [r]=await db.select().from(siteContent).where(eq(siteContent.id,'ui-textos'));return r?.content?.published||defaults()}
const text=(v,max)=>{if(typeof v!=='string'||v.length>max||/[<>\u0000-\u0008]/.test(v))billingError('Usa solo texto, sin HTML, dentro del máximo permitido.');return v};
function validate(input){
 const out=defaults();if(!input||typeof input!=='object')billingError('Contenido inválido.');
 for(const [key,value] of Object.entries(input.texts||{})){const field=UI_CATALOG[key];if(!field)billingError('Texto no reconocido.');out.texts[key]=text(value,field.max)}
 const a=input.appearance||{};
 for(const mode of ['light','dark']){out.appearance[mode]={};for(const [k,v] of Object.entries(a[mode]||{})){if(!['bg','card','ink','mut','line','g','gold'].includes(k)||!/^#[0-9a-f]{6}$/i.test(v))billingError('Color inválido.');out.appearance[mode][k]=v}
 const colors={...(mode==='dark'?{bg:'#17211b',card:'#202c24',ink:'#f2f0e9',mut:'#b8c1b8',g:'#9bc9a4'}:{bg:'#f8f6f2',card:'#ffffff',ink:'#1c2420',mut:'#6b746f',g:'#1f4d3a'}),...out.appearance[mode]};for(const fg of ['ink','mut'])for(const bg of ['bg','card'])if(contrast(colors[fg],colors[bg])<4.5)billingError('El contraste de texto debe ser al menos 4.5:1.');}
 if(a.font&&!['default','system','georgia','arial'].includes(a.font))billingError('Fuente inválida.');out.appearance.font=a.font||'default';
 if(a.radius!==undefined&&(!Number.isInteger(a.radius)||a.radius<0||a.radius>28))billingError('Radio inválido.');if(a.radius!==undefined)out.appearance.radius=a.radius;
 for(const k of ['logoLight','logoDark','favicon'])if(a[k]){if(!/^\/api\/image\?key=[a-f0-9-]+\.webp$/.test(a[k]))billingError('Usa imágenes WebP del editor existente.');out.appearance[k]=a[k]}
 for(const [route,n] of Object.entries(input.navigation||{})){if(!/^[a-z][a-z0-9_]{0,50}$/.test(route))billingError('Ruta inválida.');out.navigation[route]={label:text(n.label||'',100),icon:text(n.icon||'',12),group:text(n.group||'',100),order:Number.isInteger(n.order)?Math.max(0,Math.min(1000,n.order)):0,hidden:n.hidden===true}}
 if(!Array.isArray(input.sections)||input.sections.length>12)billingError('Secciones inválidas.');
 const seen=new Set();for(const s of input.sections){if(!['hero','benefits','how','plans','faq','contact'].includes(s.id)||seen.has(s.id))billingError('Sección inválida o duplicada.');seen.add(s.id);out.sections.push({id:s.id,visible:s.visible!==false,title:text(s.title||'',200),description:text(s.description||'',2000),items:(s.items||[]).slice(0,12).map(i=>({title:text(i.title||'',200),description:text(i.description||'',2000)}))})}
 out.seo={title:text(input.seo?.title||'',200),description:text(input.seo?.description||'',320)};return out;
}
function contrast(a,b){const lum=x=>{const c=x.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722},x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export async function editorRoute(session,method,body){
 if(!await isPlatformAdmin(session))billingError('Solo ADMIN_EMAIL puede editar la plataforma.',403);
 if(method==='GET'){const [row]=await db.select().from(siteContent).where(eq(siteContent.id,'ui-textos'));const history=await db.select({id:siteContent.id,updatedAt:siteContent.updatedAt}).from(siteContent).where(sql`${siteContent.id} LIKE 'ui-version:%'`).orderBy(desc(siteContent.updatedAt)).limit(50);return {revision:0,published:defaults(),draft:defaults(),...row?.content,history}}
 if(method!=='POST')billingError('Método no permitido.',405);
 if(body.confirmed!==true||typeof body.reason!=='string'||body.reason.trim().length<3)billingError('Confirma e indica el motivo.');
 return db.transaction(async client=>{
  await client.insert(siteContent).values({id:'ui-textos',content:{revision:0,published:defaults(),draft:defaults()}}).onConflictDoNothing();const [row]=await client.select().from(siteContent).where(eq(siteContent.id,'ui-textos')).for('update');if(row.content.revision!==body.revision)billingError('El editor cambió en otra pestaña. Recarga antes de guardar.',409);
  const before=row.content;let draft;
  if(body.operation==='restore'){if(!/^ui-version:\d+$/.test(body.id||''))billingError('Versión inválida.');const [version]=await client.select().from(siteContent).where(eq(siteContent.id,body.id));if(!version)billingError('Versión no encontrada.',404);draft=validate(version.content)}else draft=validate(body.content);
  if(!['draft','publish','restore'].includes(body.operation))billingError('Operación inválida.');
  const revision=before.revision+1;const published=body.operation==='publish'?draft:before.published;
  if(body.operation==='publish')await client.insert(siteContent).values({id:'ui-version:'+revision,content:published});
  const content={revision,published,draft};await client.update(siteContent).set({content,updatedAt:new Date()}).where(eq(siteContent.id,'ui-textos'));await event(client,session.email,session.email,'Editor de plataforma · '+body.operation,{revision,reason:body.reason.slice(0,1000)});return content;
 });
}
export async function publicPlans(){return db.select({id:servicePlans.id,name:servicePlans.name,monthlyCents:servicePlans.monthlyCents,annualCents:servicePlans.annualCents,currency:servicePlans.currency}).from(servicePlans).where(eq(servicePlans.active,true))}
export async function trialSettings(session,method,body){
 if(!await isPlatformAdmin(session))billingError('Solo ADMIN_EMAIL configura la prueba.',403);
 if(method==='GET'){const [row]=await db.select().from(siteContent).where(eq(siteContent.id,'platform-trial-settings'));return row?.content||{hours:24,revision:0}}
 if(method!=='POST')billingError('Método no permitido.',405);
 if(body.confirmed!==true||String(body.reason||'').trim().length<3||!Number.isInteger(body.hours)||body.hours<1||body.hours>720)billingError('Confirma el motivo y usa entre 1 y 720 horas.');
 return db.transaction(async client=>{await client.insert(siteContent).values({id:'platform-trial-settings',content:{hours:24,revision:0}}).onConflictDoNothing();const [row]=await client.select().from(siteContent).where(eq(siteContent.id,'platform-trial-settings')).for('update');if(row.content.revision!==body.revision)billingError('La configuración cambió.',409);const content={hours:body.hours,revision:row.content.revision+1};await client.update(siteContent).set({content,updatedAt:new Date()}).where(eq(siteContent.id,row.id));await event(client,session.email,session.email,'Duración de prueba configurada',{...content,reason:String(body.reason).slice(0,1000)});return content});
}
