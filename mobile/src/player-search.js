// Shared by mobile handicap, pairs and tournament registration.
window.VMGCPlayerSearch = (() => {
  const clients = new WeakMap();
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,100);
  async function search(db, value, limit=6) {
    const term=normalize(value); if(term.length<2)return [];
    const size=Math.max(1,Math.min(limit,15)),key=term+':'+size;
    let cache=clients.get(db); if(!cache){cache=new Map();clients.set(db,cache);}
    const hit=cache.get(key); if(hit && Date.now()-hit.time<15000)return hit.promise;
    const promise=(async()=>{
      const {data,error}=await db.rpc('mobile_player_search',{p_term:term,p_limit:size});
      if(error)throw error;
      return (data||[]).map(p=>({...p,is_club_member:p.is_club_member===true, ...(p.origen_busqueda==='aag_enrolleds'?{enrollment_number:p.aag_member_number}:{})}));
    })();
    cache.set(key,{time:Date.now(),promise});
    if(cache.size>40)cache.delete(cache.keys().next().value);
    try{return await promise;}catch(error){cache.delete(key);throw error;}
  }
  return {search,normalize};
})();
