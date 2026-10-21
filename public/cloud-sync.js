// Shared, pure record differences. Missing values are represented explicitly.
(() => {
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const equal=(a,b)=>canonical(a)===canonical(b);
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const safe=key=>typeof key==='string'&&!['__proto__','constructor','prototype'].includes(key);
  const identity=rows=>rows.every(row=>row&&typeof row==='object'&&typeof (row.id??row.code)==='string')&&new Set(rows.map(row=>row.id??row.code)).size===rows.length;
  function diff(base={},next={}){
    const changes=[];
    for(const key of new Set([...Object.keys(base||{}),...Object.keys(next||{})])){
      if(!safe(key)||equal(base?.[key],next?.[key]))continue;
      const a=base?.[key],b=next?.[key];
      if(Array.isArray(a)&&Array.isArray(b)&&identity(a)&&identity(b)){
        const old=new Map(a.map(row=>[row.id??row.code,row])),fresh=new Map(b.map(row=>[row.id??row.code,row]));
        for(const id of new Set([...old.keys(),...fresh.keys()]))if(!equal(old.get(id),fresh.get(id)))changes.push({key,id,before:old.get(id)??null,after:fresh.get(id)??null});
      }else changes.push({key,before:a??null,after:b??null});
    }
    return clone(changes);
  }
  function apply(base,changes,force=false){
    if(!Array.isArray(changes)||changes.length>100000)throw new Error('Diferencias inválidas.');
    const data=clone(base||{}),conflicts=[];
    for(const change of changes){
      if(!change||!safe(change.key)||!Object.hasOwn(change,'before')||!Object.hasOwn(change,'after'))throw new Error('Diferencias inválidas.');
      const {key,id,before,after}=change;
      let current=data[key]??null,index=-1;
      if(id!==undefined){
        if(typeof id!=='string'||(data[key]!==undefined&&!Array.isArray(data[key])))throw new Error('Registro inválido.');
        data[key]||=[];index=data[key].findIndex(row=>(row.id??row.code)===id);current=index<0?null:data[key][index];
        if(after!==null&&(!after||typeof after!=='object'||(after.id??after.code)!==id))throw new Error('Identificador inválido.');
      }
      if(!equal(current,before)&&!equal(current,after)&&!force){conflicts.push({key,id});continue}
      if(id===undefined){if(after===null)delete data[key];else data[key]=clone(after)}
      else if(after===null){if(index>=0)data[key].splice(index,1)}
      else if(index<0)data[key].push(clone(after));else data[key][index]=clone(after);
    }
    return {data,conflicts};
  }
  globalThis.AcontecSync={diff,apply,clone};
})();
