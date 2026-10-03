(function(){
  'use strict';
  const $=id=>document.getElementById(id), core=window.VMGCStats;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>n==null?'—':new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(n);
  const date=d=>new Intl.DateTimeFormat('es-AR').format(new Date(d.slice(0,10)+'T12:00:00Z'));
  let tournaments=[],selected=null,draft=new Set(),onChange=()=>{},storageKey='',loadedKey='';
  function visible(){const q=$('tournamentSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return tournaments.filter(t=>(t.name+' '+date(t.date)).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));}
  function paint(){
    const list=visible();
    $('tournamentList').innerHTML=list.length?list.map(t=>`<label class="tournament-option"><input type="checkbox" value="${esc(t.id)}" ${draft.has(t.id)?'checked':''}><span><strong>${esc(t.name)}</strong><small>${date(t.date)} · ${esc(t.mode)} · 18 hoyos</small><span class="tournament-result">${t.count} tarjeta${t.count===1?'':'s'} · Gross ${fmt(t.summary.gross)} · Neto ${fmt(t.summary.net)}</span>${t.excluded?`<em>${t.excluded} tarjeta${t.excluded===1?'':'s'} fuera de promedios</em>`:''}${t.missing?`<em>${t.missing} hoyos sin golpes o par verificables</em>`:''}</span></label>`).join(''):'<p class="muted">No hay torneos que coincidan con la búsqueda.</p>';
    $('selectionCount').textContent=`${draft.size} de ${tournaments.length} torneos seleccionados`;
    $('applyTournaments').textContent=`Aplicar selección (${draft.size})`;
  }
  function updateSummary(){
    const total=tournaments.length,count=selected===null?total:tournaments.filter(t=>selected.has(t.id)).length;
    $('tournamentSummary').textContent=selected===null?'Todos los torneos del período':`${count} torneos seleccionados de ${total}`;
    $('tournamentChips').innerHTML=selected===null?'<span class="scope-chip">Historial completo del período</span>':tournaments.filter(t=>selected.has(t.id)).slice(0,3).map(t=>`<span class="scope-chip">${esc(t.name)}</span>`).join('')+(count>3?`<span class="scope-chip">+${count-3} más</span>`:'');
    $('resetTournaments').hidden=selected===null;
    $('chooseTournaments').disabled=!total;
    $('selectionScope').textContent=selected===null?'Analizando todos los torneos del período.':`${count} torneos elegidos: todas las tortas, promedios, hoyos y tarjetas se recalcularon con esa selección. El club se compara en los mismos torneos.`;
  }
  function persist(){sessionStorage.setItem(storageKey,JSON.stringify(selected===null?null:[...selected]));}
  function close(){ $('tournamentDialog').close();$('chooseTournaments').focus(); }
  $('chooseTournaments').addEventListener('click',()=>{draft=new Set(selected===null?tournaments.map(t=>t.id):tournaments.filter(t=>selected.has(t.id)).map(t=>t.id));$('tournamentSearch').value='';paint();$('tournamentDialog').showModal();$('tournamentSearch').focus();});
  $('closeTournaments').addEventListener('click',close);
  $('tournamentSearch').addEventListener('input',paint);
  $('tournamentList').addEventListener('change',event=>{if(event.target.type!=='checkbox')return;if(event.target.checked)draft.add(event.target.value);else draft.delete(event.target.value);$('selectionCount').textContent=`${draft.size} de ${tournaments.length} torneos seleccionados`;$('applyTournaments').textContent=`Aplicar selección (${draft.size})`;});
  $('allTournaments').addEventListener('click',()=>{visible().forEach(t=>draft.add(t.id));paint();});
  $('clearTournaments').addEventListener('click',()=>{draft.clear();paint();});
  $('applyTournaments').addEventListener('click',()=>{selected=draft.size===tournaments.length?null:new Set(draft);persist();updateSummary();close();onChange();});
  $('resetTournaments').addEventListener('click',()=>{selected=null;persist();updateSummary();onChange();});
  window.VMGCTournamentSelector={
    init(cards,callback,key){
      onChange=callback;storageKey='vmgc_stats_tournaments_'+key;
      if(loadedKey!==storageKey){selected=null;try{const raw=JSON.parse(sessionStorage.getItem(storageKey));if(Array.isArray(raw))selected=new Set(raw.map(String));}catch{}loadedKey=storageKey;}
      const groups=new Map();for(const c of cards){const id=String(c.tournament_id);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(c);}
      tournaments=[...groups].map(([id,rows])=>{const summary=core.summary(rows),analysis=core.analysis(rows),t=rows[0].tournaments;return {id,name:t.name,date:t.tournament_date,mode:t.game_modes?.name||'Sin modalidad',count:rows.length,summary,excluded:rows.length-summary.count,missing:analysis.missing};}).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name));
      // Una selección vacía significa sin torneos, nunca volver silenciosamente a todos.
      if(selected!==null)selected=new Set(tournaments.filter(t=>selected.has(t.id)).map(t=>t.id));
      updateSummary();
    },
    filter(cards){return selected===null?cards:cards.filter(c=>selected.has(String(c.tournament_id)));},
    isFiltered(){return selected!==null;}
  };
})();
