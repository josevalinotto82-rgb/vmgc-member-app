(function (root) {
  'use strict';
  const number = v => v === null || v === undefined || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function holes(card) {
    const segment = normalize(card.hole_segment);
    if (['18','18h','18_holes'].includes(segment)) return 18;
    if (segment.includes('front') || segment.includes('back') || ['9','9h','9_holes'].includes(segment)) return 9;
    if (!segment && [9,18].includes(number(card.tournaments?.hole_count))) return number(card.tournaments.hole_count);
    return null;
  }
  const individual = card => normalize(card.tournaments?.game_modes?.name) === 'medal';
  const valid = card => normalize(card.card_status) === 'valid' && individual(card) && number(card.gross) !== null && number(card.gross) > 0;
  const summary = cards => {
    const validCards = cards.filter(valid);
    const gross = validCards.map(c => number(c.gross)).filter(n => n !== null);
    const net = validCards.map(c => number(c.net)).filter(n => n !== null);
    const avg = xs => xs.length ? xs.reduce((a,b) => a+b,0)/xs.length : null;
    return {count:validCards.length,grossCount:gross.length,netCount:net.length,gross:avg(gross),net:avg(net),bestGross:gross.length?Math.min(...gross):null,bestNet:net.length?Math.min(...net):null};
  };
  function startDate(period, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const d = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
    if (period === 'all') return null;
    if (period === 'year') return `${p.year}-01-01`;
    d.setUTCDate(d.getUTCDate() - Number(period) + 1);
    return d.toISOString().slice(0,10);
  }
  function filter(cards, period, count, now) {
    const start = startDate(period,now);
    return cards.filter(c => holes(c) === Number(count) && c.tournaments?.tournament_date && (!start || c.tournaments.tournament_date.slice(0,10) >= start));
  }
  function monthly(cards) {
    const groups = new Map();
    for (const c of cards.filter(valid)) {
      const value = number(c.gross), month = c.tournaments?.tournament_date?.slice(0,7);
      if (value === null || !month) continue;
      if (!groups.has(month)) groups.set(month,[]);
      groups.get(month).push(value);
    }
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([month,values])=>({month,count:values.length,value:values.reduce((a,b)=>a+b,0)/values.length}));
  }
  function holeData(card,hole) {
    const data=card.hole_scores;
    const value=Array.isArray(data)?data[hole-1]:data?.[hole] ?? data?.['H'+hole] ?? data?.['h'+hole];
    const strokes=number(value && typeof value==='object' ? value.strokes ?? value.stroke ?? value.score ?? value.golpes ?? value.value : value);
    let par=number(value && typeof value==='object' ? value.par_value ?? value.par ?? value.Par : null);
    if (par===null) {
      const rules=card.tournament_categories?.tee_rules || [], name=normalize(card.tee_name);
      let matching=rules.filter(r=>normalize(r.reference?.tee_name)===name && name);
      if (!matching.length && rules.length===1) matching=rules;
      if (matching.length===1) {const h=matching[0].reference?.holes?.find(h=>number(h.hole ?? h.HoleNumber ?? h.hole_number ?? h.number)===hole);par=number(h?.par ?? h?.Par);}
    }
    return {strokes:Number.isInteger(strokes)&&strokes>0?strokes:null,par:Number.isInteger(par)&&par>=3&&par<=6?par:null};
  }
  function analysis(cards) {
    const buckets=[0,0,0,0],front=[0,0,0,0],back=[0,0,0,0];
    const rows=Array.from({length:18},(_,i)=>({hole:i+1,count:0,sum:0,deltaSum:0,pars:new Set(),buckets:[0,0,0,0]}));
    const byPar=[3,4,5].map(par=>({par,count:0,sum:0}));let missing=0;
    for(const c of cards.filter(valid))for(let h=1;h<=18;h++){
      const {strokes,par}=holeData(c,h);if(strokes===null||par===null){missing++;continue;}
      const delta=strokes-par,index=delta<0?0:delta===0?1:delta===1?2:3;
      buckets[index]++;(h<=9?front:back)[index]++;const r=rows[h-1];r.count++;r.sum+=strokes;r.deltaSum+=delta;r.pars.add(par);r.buckets[index]++;
      const group=byPar.find(g=>g.par===par);if(group){group.count++;group.sum+=strokes;}
    }
    const result=rows.map(r=>({...r,pars:[...r.pars].sort(),average:r.count?r.sum/r.count:null,delta:r.count?r.deltaSum/r.count:null}));
    const ranked=result.filter(r=>r.count).sort((a,b)=>b.delta-a.delta || b.count-a.count || a.hole-b.hole);
    return {buckets,front,back,total:buckets.reduce((a,b)=>a+b,0),missing,rows:result,hardest:ranked[0]||null,byPar:byPar.map(g=>({...g,average:g.count?g.sum/g.count:null}))};
  }
  const api = {number,holes,individual,valid,summary,startDate,filter,monthly,holeData,analysis};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VMGCStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
