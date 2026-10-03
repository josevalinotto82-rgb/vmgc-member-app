(async function () {
'use strict';
const $=id=>document.getElementById(id),core=window.VMGCStats;
const fmt=n=>n==null?'—':new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(n);
const signed=n=>n==null?'—':(n>0?'+':'')+fmt(n);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=d=>new Intl.DateTimeFormat('es-AR').format(new Date(d.slice(0,10)+'T12:00:00Z'));
const preview=new URLSearchParams(location.search).get('vista')==='demo';
const labels=['Birdie o menos','Par','Bogey','Doble bogey o más'],colors=['#2d8b68','#9ebd59','#e4ad52','#bd654f'];
let mine=[],filteredMine=[],shown=20,ready=false,clubState='loading',club=[],generation=0;
const clubCache=new Map(),saved=sessionStorage.getItem('vmgc_stats_period');
if(['365','90','year','all'].includes(saved))$('period').value=saved;
function base(fields,count=false,period=$('period').value){
let q=db.from('scorecards').select(fields+',tournaments!inner(id,name,tournament_date,hole_count,game_modes!inner(name))',count?{count:'exact'}:{})
.eq('tournaments.data_schema_version',2).eq('tournaments.published',true).eq('tournaments.hole_count',18)
.in('tournaments.status',['officialized','archived']).order('id',{ascending:true});
const start=core.startDate(period);if(start)q=q.gte('tournaments.tournament_date',start);return q;
}
async function all(factory,progress){
const first=await factory(true).range(0,499);if(first.error)throw first.error;
const pages=[first.data||[]];if(progress)progress(pages[0].length,first.count);
if(first.count==null){while(pages.at(-1).length===500){const start=pages.length*500,r=await factory(false).range(start,start+499);if(r.error)throw r.error;pages.push(r.data||[]);}return pages.flat();}
let next=1,loaded=pages[0].length;const total=Math.ceil(first.count/500);
await Promise.all(Array.from({length:Math.min(4,Math.max(0,total-1))},async()=>{while(next<total){const i=next++,r=await factory(false).range(i*500,i*500+499);if(r.error)throw r.error;pages[i]=r.data||[];loaded+=pages[i].length;if(progress)progress(loaded,first.count);}}));return pages.flat();
}
function donut(values,title){
const total=values.reduce((a,b)=>a+b,0);let offset=0;
const arcs=values.map((v,i)=>{const p=total?v/total*100:0,s=`<circle cx="60" cy="60" r="44" fill="none" stroke="${colors[i]}" stroke-width="17" pathLength="100" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${-offset}"/>`;offset+=p;return s;}).join('');
return `<div class="donut-group"><h3>${title}</h3><div class="donut-layout"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(title)}: ${total} hoyos"><circle cx="60" cy="60" r="44" fill="none" stroke="#eef2e9" stroke-width="17"/><g transform="rotate(-90 60 60)">${arcs}</g><text x="60" y="59" text-anchor="middle" class="donut-total">${total}</text><text x="60" y="75" text-anchor="middle" class="donut-label">hoyos</text></svg><ul class="legend">${values.map((v,i)=>`<li><i style="background:${colors[i]}"></i><span>${labels[i]}</span><b>${v} <small>${total?fmt(v/total*100):'0'}%</small></b></li>`).join('')}</ul></div></div>`;
}
function history(){
$('history').innerHTML=filteredMine.slice(0,shown).map(c=>`<a class="history-item" ${preview?'':`href="torneos.html?id=${encodeURIComponent(c.tournament_id)}&origen=estadisticas"`}><strong>${esc(c.tournaments.name)}</strong><span>${date(c.tournaments.tournament_date)} · ${esc(c.tournaments.game_modes?.name||'Sin modalidad')}</span><div class="scores">Gross <b>${fmt(core.number(c.gross))}</b> Neto <b>${fmt(core.number(c.net))}</b></div><span>${core.valid(c)?'Tarjeta computada':'Fuera de promedios: '+esc(c.card_status||'otra modalidad o sin gross')}${preview?'':' · Ver tarjeta →'}</span></a>`).join('')||'<p class="muted">No tenés tarjetas de 18 hoyos publicadas en este período.</p>';
$('more').hidden=shown>=filteredMine.length;
}
function comparison(){
const p=core.summary(filteredMine),c=core.summary(window.VMGCTournamentSelector.filter(club)),loaded=clubState==='ready';
$('comparison').innerHTML=[['Tarjetas válidas',p.count,c.count],['Promedio gross',p.gross,c.gross],['Promedio neto',p.net,c.net]].map(([label,a,b])=>`<tr><td>${label}</td><td>${fmt(a)}</td><td>${loaded?fmt(b):clubState==='loading'?'Cargando…':'No disponible'}</td></tr>`).join('');
$('comparisonNote').textContent=loaded?`${c.count} tarjetas individuales ${window.VMGCTournamentSelector.isFiltered()?"en los mismos torneos seleccionados":"en el período elegido"}. El promedio incluye tu participación. Las salidas y hándicaps pueden variar.`:clubState==='error'?'No se pudo cargar el club. Tus estadísticas personales siguen disponibles.':'El comparativo se carga por separado; ya podés consultar tus datos.';
}
function render(){
if(!ready)return;
filteredMine=window.VMGCTournamentSelector.filter(core.filter(mine,$('period').value,18)).sort((a,b)=>b.tournaments.tournament_date.localeCompare(a.tournaments.tournament_date)||String(a.id).localeCompare(String(b.id)));
const p=core.summary(filteredMine),a=core.analysis(filteredMine),values=filteredMine.filter(core.valid).map(c=>core.number(c.gross));
const baseline=core.summary(core.filter(mine,$('period').value,18));
$('auditBaseline').hidden=!window.VMGCTournamentSelector.isFiltered();
$('auditRows').innerHTML=[['Tarjetas válidas',p.count,baseline.count],['Promedio gross',p.gross,baseline.gross],['Promedio neto',p.net,baseline.net]].map(([label,a,b])=>`<tr><td>${label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td></tr>`).join('');
const sd=values.length?Math.sqrt(values.reduce((s,v)=>s+(v-p.gross)**2,0)/values.length):null;
$('metrics').innerHTML=[['Tarjetas válidas',p.count,'18 hoyos · Medal individual'],['Promedio gross',fmt(p.gross),'Golpes por vuelta'],['Promedio neto',fmt(p.net),'Con hándicap histórico'],['Mejor vuelta gross',fmt(p.bestGross),'Menor cantidad de golpes'],['Mejor vuelta neto',fmt(p.bestNet),'Menor resultado neto'],['Regularidad',fmt(sd),'Desvío gross · menor es más estable']].map(([label,value,note])=>`<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
$('distribution').innerHTML=donut(a.buckets,'Toda la vuelta');$('nines').innerHTML=donut(a.front,'Ida · hoyos 1 a 9')+donut(a.back,'Vuelta · hoyos 10 a 18');
$('coverage').textContent=`${a.total} hoyos con golpes y par verificables.${a.missing?' '+a.missing+' hoyos sin información suficiente quedaron fuera de porcentajes y promedios por hoyo.':''}`;
$('difficulty').textContent=a.hardest?`Tu mayor dificultad: hoyo ${a.hardest.hole}, ${signed(a.hardest.delta)} golpes respecto del par, en ${a.hardest.count} registros.`:'Todavía no hay golpes y par suficientes para identificar el hoyo más difícil.';
$('holeRows').innerHTML=a.rows.map(r=>`<tr class="${a.hardest?.hole===r.hole?'hardest':''}"><td><b>${r.hole}</b></td><td>${r.pars.length?r.pars.join('/'):'—'}</td><td>${fmt(r.average)}</td><td class="${r.delta>0?'over':'under'}">${signed(r.delta)}</td><td>${r.count}</td></tr>`).join('');
$('parStats').innerHTML=a.byPar.map(r=>`<div><span>Par ${r.par}</span><strong>${fmt(r.average)}</strong><small>${r.count} hoyos · ${signed(r.average===null?null:r.average-r.par)} vs. par</small></div>`).join('');
const trend=core.monthly(filteredMine),maximum=Math.max(1,...trend.map(t=>t.value));$('trend').innerHTML=trend.map(t=>`<div class="trend-row"><span>${t.month.slice(5)+'/'+t.month.slice(2,4)}</span><div class="bar-track"><div class="bar" style="width:${t.value/maximum*100}%"></div></div><strong>${fmt(t.value)}</strong></div>`).join('')||'<p class="muted">Sin vueltas individuales válidas.</p>';
const recent=values.slice(0,5),previous=values.slice(5,10),avg=xs=>xs.reduce((s,v)=>s+v,0)/xs.length;
$('recent').textContent=recent.length===5&&previous.length===5?`Últimas 5 vueltas: ${fmt(avg(recent))} gross. Las 5 anteriores: ${fmt(avg(previous))}. Cambio: ${signed(avg(recent)-avg(previous))} golpes.`:'Con 10 tarjetas válidas vas a poder comparar tus últimas 5 vueltas con las 5 anteriores.';
shown=20;history();comparison();$('content').hidden=false;
}
async function loadClub(token){
const period=$('period').value;clubState='loading';club=[];comparison();
if(clubCache.has(period)){club=clubCache.get(period);clubState='ready';$('clubStatus').textContent='Comparativo actualizado.';comparison();return;}
try{
const rows=await all(count=>base('id,tournament_id,gross,net,card_status,hole_segment',count,period).eq('card_status','valid').gt('gross',0).eq('tournaments.game_modes.name','Medal'),(loaded,total)=>{if(token===generation)$('clubStatus').textContent=`Cargando comparativo: ${loaded}${total==null?'':' de '+total} tarjetas…`;});
const selected=core.filter(rows,period,18);clubCache.set(period,selected);if(token!==generation)return;club=selected;clubState='ready';$('clubStatus').textContent='Comparativo actualizado.';comparison();
}catch(e){if(token!==generation)return;clubState='error';$('clubStatus').textContent='Comparativo no disponible.';comparison();}
}
function demoCards(){
const pars=[4,4,3,4,3,4,4,4,5,4,3,5,3,4,4,4,5,4];
return Array.from({length:12},(_,i)=>{const d=new Date(core.startDate('1')+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-i*15);const scores=Object.fromEntries(pars.map((par,h)=>{let delta=(i+h)%6===0?-1:(i+h)%4===0?2:(i+h)%3===0?1:0;if(h===5)delta+=1;return [h+1,{strokes:par+delta,par_value:par}];}));const gross=Object.values(scores).reduce((s,h)=>s+h.strokes,0);return {id:'demo-'+i,tournament_id:'demo-'+i,gross,net:gross-12,card_status:'valid',hole_segment:'18',hole_scores:scores,tournaments:{name:['Medal del sábado','Copa del Club','Torneo Primavera','Medal de septiembre','Copa Aniversario','Torneo de socios'][i%6],tournament_date:d.toISOString().slice(0,10),hole_count:18,game_modes:{name:'Medal'}}};});
}
async function load(){
const token=++generation;ready=false;$('retry').hidden=true;$('status').textContent='Cargando tus tarjetas…';$('period').disabled=true;
try{
if(preview){mine=demoCards();ready=true;window.VMGCTournamentSelector.init(core.filter(mine,$('period').value,18),render,'demo');club=mine.map(c=>({...c,gross:c.gross+3,net:c.net+2}));clubState='ready';$('demo').hidden=false;$('member').textContent='Socio de ejemplo · Datos ficticios';render();$('status').textContent='Vista de diseño con datos ficticios.';return;}
const {data,error}=await db.auth.getUser();if(error||!data.user){location.replace('login.html');return;}
const linked=await db.from('players').select('id,aag_member_number,full_name').eq('profile_id',data.user.id).maybeSingle();if(linked.error)throw linked.error;const p=linked.data;
if(!p){$('status').textContent='El club debe vincular tu cuenta a un jugador para mostrar tus tarjetas.';return;}
$('member').textContent=(p.full_name||'Socio VMGC')+' · Vueltas de 18 hoyos';
const fields='id,tournament_id,gross,net,card_status,hole_segment,hole_scores,tee_name,player_gender,tournament_categories(tee_rules)';
const jobs=[all(count=>base(fields,count).eq('linked_player_id',p.id))];const member=String(p.aag_member_number||'').trim();if(member)jobs.push(all(count=>base(fields,count).eq('aag_member_number',member).is('linked_player_id',null)));
mine=[...new Map((await Promise.all(jobs)).flat().map(c=>[c.id,c])).values()];if(token!==generation)return;ready=true;window.VMGCTournamentSelector.init(core.filter(mine,$('period').value,18),render,data.user.id);clubState='loading';render();$('status').textContent='Tus estadísticas ya están disponibles.';void loadClub(token);
}catch(e){if(token!==generation)return;console.error('Estadísticas:',e);$('status').textContent='No pudimos cargar tus tarjetas. Revisá la conexión y volvé a intentar.';$('retry').hidden=false;}
finally{if(token===generation)$('period').disabled=false;}
}
$('period').addEventListener('change',()=>{sessionStorage.setItem('vmgc_stats_period',$('period').value);void load();});$('more').addEventListener('click',()=>{shown+=20;history();});$('retry').addEventListener('click',load);await load();
})();




