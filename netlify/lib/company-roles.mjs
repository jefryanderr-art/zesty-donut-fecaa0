import {and,eq,or} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {companyRoles,companyMembers,sessions} from '../../db/schema.ts';
import {companyAccess,allowed,accessError,audit,MODULES,validateRolePolicy,safeMember} from './access.mjs';
import {roleRules} from './policies.mjs';
const defaults=['cajero','vendedor','supervisor','contador','observador',...Object.keys(roleRules.routeRoles)];
export const requireAccessAdmin=access=>{if(access.support||!allowed(access,'accesibilidad',true))accessError('Solo el dueño o un administrador autorizado administra los accesos.');};
async function roleList(client,companyId){
  // The caller locks the company, serializing initial seed and all role/member edits.
  let roles=await client.select().from(companyRoles).where(eq(companyRoles.companyId,companyId));
  for(const key of defaults)if(!roles.some(role=>role.key===key)){
    const [role]=await client.insert(companyRoles).values({companyId,key,name:roles.some(r=>r.name===(roleRules.routeRoles[key]||key))?(roleRules.routeRoles[key]||key)+' (base)':roleRules.routeRoles[key]||key,description:'Cargo inicial. Los accesos previos conservan sus excepciones individuales.',policy:roleRules.preset(key,MODULES)}).returning();roles.push(role);
  }
  return roles;
}
export async function listCompanyRoles(companyId,session){
  return db.transaction(async client=>{
    const access=await companyAccess(client,companyId,session,true,false);requireAccessAdmin(access);
    const roles=await roleList(client,companyId);
    const members=await client.select().from(companyMembers).where(eq(companyMembers.companyId,companyId)).orderBy(companyMembers.createdAt);
    return {owner:access.company.ownerEmail,roles,modules:MODULES,members:members.map(member=>{
      const role=roles.find(r=>r.id===member.roleId);
      const effectivePolicy=role?member.permissionExceptions||role.policy:roleRules.legacyPolicy(member.role,member.permissions,MODULES);
      return {...safeMember(member),role:role?.name||member.role,routeRole:roleRules.routeRoles[role?.key]?role.key:null,effectivePolicy,hasExceptions:!member.roleId||!!member.permissionExceptions};
    })};
  });
}
async function revoke(client,member){await client.delete(sessions).where(or(eq(sessions.memberId,member.id),...(member.email?[eq(sessions.email,member.email)]:[])));}
export async function manageCompanyRole(companyId,session,body,method){
  return db.transaction(async client=>{
    const access=await companyAccess(client,companyId,session,true,false);requireAccessAdmin(access);
    if(body.confirmed!==true)accessError('Confirma el cambio del cargo.',400);
    const roles=await roleList(client,companyId),previous=roles.find(role=>role.id===body.id);
    if(method!=='POST'&&(!previous||previous.version!==body.version))accessError('El cargo cambió o ya no existe. Recarga la lista.',409);
    const members=await client.select().from(companyMembers).where(eq(companyMembers.companyId,companyId));
    // Legacy members retain their individual permissions but still count as assigned.
    const assigned=previous?members.filter(m=>m.roleId===previous.id||!m.roleId&&m.role.toLowerCase()===(previous.key||previous.name.toLowerCase())):[];
    if(previous&&!access.owner){
      validateRolePolicy(previous.policy,access);
      if(assigned.some(m=>m.id===access.member?.id||m.email===session.email))accessError('No puedes modificar tu propio cargo.');
      for(const m of assigned)validateRolePolicy(m.roleId?m.permissionExceptions||previous.policy:roleRules.legacyPolicy(m.role,m.permissions,MODULES),access);
    }
    if(method==='DELETE'){
      if(previous.key)accessError('Los cargos iniciales se conservan; puedes editar sus permisos.');
      const target=roles.find(r=>r.id===body.reassignRoleId&&r.id!==previous.id);
      if(assigned.length&&!target)accessError('Reasigna los accesos a otro cargo antes de borrar.',400);
      if(target)validateRolePolicy(target.policy,access);
      for(const m of assigned){
        await client.update(companyMembers).set({roleId:target.id,role:target.name,permissions:roleRules.levels(target.policy),permissionExceptions:null,version:m.version+1}).where(eq(companyMembers.id,m.id));await revoke(client,m);
      }
      await client.delete(companyRoles).where(and(eq(companyRoles.companyId,companyId),eq(companyRoles.id,previous.id)));
      await audit(client,companyId,session,'Cargo eliminado',[{area:'accesibilidad',before:previous,reassigned:assigned.map(m=>m.id),targetRoleId:target?.id||null}]);return {deleted:true};
    }
    const name=String(body.name||'').trim(),description=String(body.description||'').trim();
    if(!name||name.length>80||description.length>300||['dueño','dueno','propietario','owner'].includes(name.toLowerCase()))accessError('Indica un nombre de cargo válido (hasta 80 caracteres) y una descripción de hasta 300.',400);
    if(roles.some(r=>r.id!==previous?.id&&r.name.toLowerCase()===name.toLowerCase()))accessError('Ya existe un cargo con ese nombre.',409);
    if(!previous&&roles.length>=100)accessError('Límite de 100 cargos por empresa.',400);
    const policy=validateRolePolicy(body.policy,access);
    const values={name,description,policy,version:previous?previous.version+1:0};
    const [role]=previous?await client.update(companyRoles).set(values).where(and(eq(companyRoles.companyId,companyId),eq(companyRoles.id,previous.id))).returning():await client.insert(companyRoles).values({...values,companyId}).returning();
    for(const m of assigned)if(m.roleId){await client.update(companyMembers).set({role:name,version:m.version+1}).where(eq(companyMembers.id,m.id));await revoke(client,m);}
    await audit(client,companyId,session,previous?'Cargo modificado':'Cargo creado',[{area:'accesibilidad',before:previous||null,after:role,exceptionsPreserved:assigned.filter(m=>!m.roleId||m.permissionExceptions).map(m=>m.id)}]);
    return {role};
  });
}
