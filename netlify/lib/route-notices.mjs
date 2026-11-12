// Notice scope follows the current source assignment, including reassigned orders/trucks.
export function routeNoticeContext(records,notice){
 const source=records.find(r=>r.id===notice.sourceId&&r.module==='rutas'&&r.kind!=='route-notice');
 const parentId=source?.kind==='route-delivery'?source.orderId:source?.kind==='route-settlement'?source.loadId:null;
 const authority=parentId?records.find(r=>r.id===parentId&&r.module==='rutas'):source;
 return {source,authority};
}
export function routeNoticeAllowed(records,access,notice){
 if(!notice||notice.kind!=='route-notice'||notice.module!=='rutas'||notice.branchId!==access.branchId)return false;
 if(!access.routeRole||access.routeRole==='route_supervisor')return true;
 const {source,authority}=routeNoticeContext(records,notice),id=access.member?.id;
 return !!id&&!!source&&!!authority&&source.branchId===notice.branchId&&authority.branchId===notice.branchId&&(authority.operatorId===id||authority.assignedMemberId===id);
}
