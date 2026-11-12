// Field suggestions never authorize prices, stock or fiscal documents.
export function usualProducts(orders,customerId){const counts=new Map();for(const o of orders)if(o.customerId===customerId&&o.status!=='Cancelado')for(const i of o.items||[])counts.set(i.p,(counts.get(i.p)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10).map(([p])=>p)}
export function nearbyOrder(clients,visits){
 const locations=new Map();for(const v of [...visits].sort((a,b)=>(a.proof?.at||a.date).localeCompare(b.proof?.at||b.date))){const l=v.location||v.proof?.location;if(l&&Number.isFinite(l.latitude)&&Number.isFinite(l.longitude))locations.set(v.customerId,l)}
 const pending=[...clients].sort((a,b)=>(a.routeOrder||0)-(b.routeOrder||0)||a.id.localeCompare(b.id)),result=[];
 const distance=(a,b)=>{const rad=x=>x*Math.PI/180,dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);return Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2};
 while(pending.length){const previous=locations.get(result.at(-1)?.id);let index=0;if(previous){let best=Infinity;pending.forEach((c,i)=>{const l=locations.get(c.id),d=l?distance(previous,l):Infinity;if(d<best){best=d;index=i}})}result.push(pending.splice(index,1)[0])}return result.map(c=>c.id);
}
export function pickingRows(load){return (load.pickingOrders||[]).flatMap(o=>o.items.map(i=>({orderId:o.orderId,customerId:o.customerId,deliveryOrder:o.deliveryOrder,...i}))).sort((a,b)=>a.deliveryOrder-b.deliveryOrder)}
export function scheduledDays(days,from,to){const a=Date.parse(from+'T00:00:00Z'),b=Date.parse(to+'T00:00:00Z');if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return 0;const n=Math.floor((b-a)/86400000)+1,first=new Date(a).getUTCDay();return [...new Set(days)].reduce((sum,d)=>sum+Math.floor(n/7)+Number((d-first+7)%7<n%7),0)}
