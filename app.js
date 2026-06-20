/* ════════════════════════════════════════════
   FRIENDS TRIVIA — game logic (IT/EN)
════════════════════════════════════════════ */

const DIFFICULTIES = [
  { id:'easy',   label:'Easy',   emoji:'☕', color:'#4a9e5c', light:'rgba(74,158,92,.16)',  time:20, count:15, points:10 },
  { id:'medium', label:'Medium', emoji:'🛋️', color:'#e07a2b', light:'rgba(224,122,43,.16)', time:18, count:15, points:15 },
  { id:'hard',   label:'Hard',   emoji:'🦎', color:'#c0392b', light:'rgba(192,57,43,.16)',  time:15, count:12, points:25 },
  { id:'expert', label:'Expert', emoji:'📺', color:'#7b5ea7', light:'rgba(123,94,167,.16)', time:12, count:10, points:40 },
  { id:'maniac', label:'MANIAC', emoji:'💡', color:'#caa43a', light:'rgba(202,164,58,.18)', time:10, count:10, points:60 },
];

// Return question text/options/answer in the current language
function qLoc(q){
  if(LANG==='it' && q.question_it){
    return { question:q.question_it, options:q.options_it, answer:q.answer_it };
  }
  return { question:q.question, options:q.options, answer:q.answer };
}

// Randomize answer order (same permutation for EN+IT) so the correct
// answer isn't always in the same position; returns a shuffled copy.
function shuffleOptions(q){
  const order=[0,1,2,3];
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  const copy={...q};
  copy.options=order.map(i=>q.options[i]);
  if(q.options_it) copy.options_it=order.map(i=>q.options_it[i]);
  return copy;
}

// Reaction images per outcome (quips come from i18n)
const REACT_IMG = {
  correct:['good-job.jpg','oh-you.jpg','how-you-doin.gif'],
  wrong:['shut-up.jpg','delusion.jpg','desperation.jpg','delusion-2.jpg','delusion-again.jpg'],
  perfect:'how-you-doin.gif', great:'good-job.jpg', ok:'sad-winner.jpg',
  meh:'almost.jpg', bad:'surprise.jpg', terrible:'mega-surprise.webp',
};

let state = {
  diff:'medium', questions:[], idx:0, score:0, streak:0, maxStreak:0,
  wrong:[], answered:false, timerVal:20, timerInt:null,
  basePoints:0, lastReact:{correct:-1,wrong:-1}
};

// ── EPISODE CITATION ──
function episodeCitation(code){
  if(!code) return { tag:'', title:'' };
  const L=t();
  if(L.meta[code]) return { tag:'', title:L.meta[code] };
  const seasonOnly=code.match(/^S(\d{2})$/);
  if(seasonOnly) return { tag:code, title:L.season(parseInt(seasonOnly[1],10)) };
  return { tag:code, title:'' };
}

// ════════ LANGUAGE ════════
function setLang(lang){
  LANG = lang;
  try{ localStorage.setItem('ft_lang', lang); }catch(e){}
  applyLang();
}
function applyLang(){
  const L = t();
  // enter overlay
  setText('enter-sub', L.enter_sub);
  setHTML('enter-btn-txt', L.enter_btn);
  setText('enter-hint', L.enter_hint);
  // home
  setHTML('quote-q', L.quote);
  setText('quote-by', L.quote_by);
  setText('home-h2', L.home_h2);
  setText('home-p', L.home_p);
  setText('pool-title', L.pool_title);
  setText('propose-lbl', L.propose_btn);
  setHTML('home-footer', L.footer);
  // rebuild difficulty cards + pool (labels depend on lang)
  buildPool();
  buildDiffCards();
  selectDiff(state.diff);
  // modal
  setText('modal-title', L.modal_title);
  document.getElementById('modal-body').innerHTML = L.modal_p.map(p=>`<p>${p}</p>`).join('');
  setText('modal-close', L.modal_close);
  // active language button highlight
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active', b.dataset.lang===LANG));
  // player bar
  updatePlayerBar();
}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function setHTML(id,v){const e=document.getElementById(id);if(e)e.innerHTML=v;}

// ════════ PLAYERS (local "arcade cabinet" memory) ════════
const PROFILE_KEY='ft_players_v1';
const CURRENT_KEY='ft_current_v1';
const GUEST_KEY='ft_guest_ok_v1';
let players={};       // id -> profile
let currentId=null;   // null = guest

function loadPlayers(){
  try{ players=JSON.parse(localStorage.getItem(PROFILE_KEY))||{}; }catch(e){ players={}; }
  try{ currentId=localStorage.getItem(CURRENT_KEY)||null; }catch(e){ currentId=null; }
  if(currentId && !players[currentId]) currentId=null;
  // migrate any profile missing fields
  Object.values(players).forEach(p=>{
    if(!p.seen) p.seen={};
    DIFFICULTIES.forEach(d=>{ if(!Array.isArray(p.seen[d.id])) p.seen[d.id]=[]; });
    if(!p.bestByDiff) p.bestByDiff={};
    ['games','totalPoints','best','correct','answered'].forEach(k=>{ if(typeof p[k]!=='number') p[k]=0; });
  });
}
function savePlayers(){ try{ localStorage.setItem(PROFILE_KEY,JSON.stringify(players)); }catch(e){} }
function saveCurrent(){ try{ currentId?localStorage.setItem(CURRENT_KEY,currentId):localStorage.removeItem(CURRENT_KEY); }catch(e){} }
function normId(name){ return name.trim().toLowerCase().replace(/\s+/g,' '); }
function curProfile(){ return currentId?players[currentId]:null; }
function newProfile(name){
  const seen={}; DIFFICULTIES.forEach(d=>seen[d.id]=[]);
  return { name:name.trim(), created:Date.now(), games:0, totalPoints:0, best:0,
           correct:0, answered:0, seen, bestByDiff:{} };
}

function updatePlayerBar(){
  const L=t(), prof=curProfile();
  const av=document.getElementById('player-av');
  const nameEl=document.getElementById('player-name');
  const asEl=document.getElementById('player-as');
  if(!nameEl) return;
  if(prof){
    av.textContent='☕';
    nameEl.textContent=prof.name;
    nameEl.classList.remove('guest');
    asEl.textContent=`${L.player_playing_as} · ${prof.totalPoints} ${L.pts}`;
  }else{
    av.textContent='🕶️';
    nameEl.textContent=L.player_guest_name;
    nameEl.classList.add('guest');
    asEl.textContent=L.player_playing_as;
  }
  setText('player-switch-lbl', L.player_switch);
  setText('leaderboard-lbl', L.leaderboard_btn.replace('🏆 ',''));
}

// ── player modal ──
function openPlayerModal(){
  const L=t();
  setText('pm-title', L.player_title);
  setText('pm-sub', L.player_sub);
  setText('pm-existing-h', L.player_existing);
  setText('pm-guest', L.player_guest);
  setText('pm-go', L.player_register);
  setText('pm-err','');
  const inp=document.getElementById('pm-input');
  inp.placeholder=L.player_new_ph; inp.value='';
  renderPlayerList();
  document.getElementById('player-modal').classList.add('show');
  setTimeout(()=>inp.focus(),100);
}
function closePlayerModal(){ document.getElementById('player-modal').classList.remove('show'); }
function renderPlayerList(){
  const L=t();
  const wrap=document.getElementById('pm-existing-wrap');
  const list=document.getElementById('pm-list');
  const ids=Object.keys(players).sort((a,b)=>players[b].totalPoints-players[a].totalPoints);
  if(ids.length===0){ wrap.style.display='none'; list.innerHTML=''; return; }
  wrap.style.display='block';
  list.innerHTML=ids.map(id=>{
    const p=players[id];
    return `<div class="pm-player" onclick="selectPlayer('${id.replace(/'/g,"\\'")}')">
      <span class="ppi">☕</span>
      <span class="ppn"><b>${esc(p.name)}</b><span>${p.totalPoints} ${L.pts} · ${p.games} ${L.lb_col_games.toLowerCase()}</span></span>
      <button class="ppdel" title="${L.player_delete}" onclick="event.stopPropagation();deletePlayer('${id.replace(/'/g,"\\'")}')">🗑</button>
    </div>`;
  }).join('');
}
function registerPlayer(){
  const L=t();
  const inp=document.getElementById('pm-input');
  const name=inp.value.trim();
  if(!name){ inp.focus(); return; }
  const id=normId(name);
  if(players[id]){ setText('pm-err', L.player_name_taken); return; }
  players[id]=newProfile(name);
  currentId=id;
  savePlayers(); saveCurrent();
  try{ localStorage.removeItem(GUEST_KEY); }catch(e){}
  closePlayerModal(); updatePlayerBar();
}
function selectPlayer(id){
  if(!players[id]) return;
  currentId=id; saveCurrent();
  try{ localStorage.removeItem(GUEST_KEY); }catch(e){}
  closePlayerModal(); updatePlayerBar();
}
function deletePlayer(id){
  const L=t(); const p=players[id]; if(!p) return;
  if(!confirm(L.player_delete_confirm(p.name))) return;
  delete players[id];
  if(currentId===id){ currentId=null; saveCurrent(); }
  savePlayers(); renderPlayerList(); updatePlayerBar();
}
function playAsGuest(){
  currentId=null; saveCurrent();
  try{ localStorage.setItem(GUEST_KEY,'1'); }catch(e){}
  closePlayerModal(); updatePlayerBar();
}
function maybeShowPlayerPrompt(){
  let guestOk=false;
  try{ guestOk=localStorage.getItem(GUEST_KEY)==='1'; }catch(e){}
  const prof=curProfile();
  if(prof){ toast(t().player_welcome(prof.name)); }
  else if(!guestOk){ openPlayerModal(); }
}

// ── leaderboard ──
function openLeaderboard(){
  const L=t();
  setText('lb-title', L.leaderboard_title);
  setText('lb-sub', L.leaderboard_sub);
  setText('lb-close', L.close);
  const list=document.getElementById('lb-list');
  const ids=Object.keys(players).filter(id=>players[id].games>0)
    .sort((a,b)=>players[b].totalPoints-players[a].totalPoints);
  if(ids.length===0){
    list.innerHTML=`<div class="lb-empty">${L.leaderboard_empty}</div>`;
  }else{
    list.innerHTML=ids.map((id,i)=>{
      const p=players[id];
      const rank=i+1;
      const medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank;
      const me=id===currentId;
      const acc=p.answered?Math.round(p.correct/p.answered*100):0;
      return `<div class="lb-row ${me?'me':''} r${rank}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-info"><b>${esc(p.name)}${me?`<span class="lb-you-tag">${L.lb_you}</span>`:''}</b>
          <span>${p.games} ${L.lb_col_games.toLowerCase()} · ${acc}% · 🏅${p.best}</span></span>
        <span class="lb-pts">${p.totalPoints}<small>${L.pts}</small></span>
      </div>`;
    }).join('');
  }
  document.getElementById('lb-modal').classList.add('show');
}
function closeLeaderboard(){ document.getElementById('lb-modal').classList.remove('show'); }

// ════════ REPORT / PROPOSE (via email) ════════
const OWNER_EMAIL='andrearicciotti1@gmail.com';
function mailto(subject,body){
  window.location.href='mailto:'+OWNER_EMAIL+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
function reportQuestion(id){
  const q=ALL_QUESTIONS.find(x=>x.id===id); if(!q)return;
  const L=t(); const ql=qLoc(q);
  const body=
    L.report_intro+'\n\n'+
    'ID: #'+id+'\n'+
    'Difficoltà/Difficulty: '+q.difficulty+'\n'+
    'Episodio/Episode: '+(q.episode||'-')+'\n'+
    'Lingua/Language: '+LANG.toUpperCase()+'\n\n'+
    (ql.question)+'\n'+
    ql.options.map((o,i)=>String.fromCharCode(65+i)+') '+o+(o===ql.answer?'  ✓':'')).join('\n')+'\n\n'+
    L.report_desc+'\n';
  mailto('[Friends Trivia] Report #'+id, body);
}
function openPropose(){
  const L=t();
  setText('pr-title', L.propose_title);
  setText('pr-sub', L.propose_sub);
  setText('pr-l-q', L.pr_l_q);
  setText('pr-l-o', L.pr_l_o);
  setText('pr-l-d', L.pr_l_d);
  setText('pr-l-e', L.pr_l_e);
  setText('pr-send', L.pr_send);
  setText('pr-close', L.close);
  setText('pr-err','');
  document.getElementById('pr-q').placeholder=L.pr_ph_q;
  ['A','B','C','D'].forEach((lt,i)=>{const e=document.getElementById('pr-o'+i);if(e)e.placeholder=L.pr_ph_o(lt);});
  document.getElementById('pr-ep').placeholder=L.pr_ph_e;
  document.getElementById('propose-modal').classList.add('show');
}
function closePropose(){ document.getElementById('propose-modal').classList.remove('show'); }
function submitProposal(){
  const L=t();
  const q=document.getElementById('pr-q').value.trim();
  const opts=[0,1,2,3].map(i=>document.getElementById('pr-o'+i).value.trim());
  if(!q || opts.some(o=>!o)){ setText('pr-err', L.pr_fill); return; }
  const ci=parseInt((document.querySelector('input[name="pr-correct"]:checked')||{}).value||'0',10);
  const diff=document.getElementById('pr-diff').value;
  const ep=document.getElementById('pr-ep').value.trim();
  const body=
    L.pr_intro+'\n\n'+
    'Domanda/Question: '+q+'\n'+
    opts.map((o,i)=>String.fromCharCode(65+i)+') '+o+(i===ci?'  ✓ ('+L.base_points+')':'')).join('\n')+'\n\n'+
    'Risposta corretta/Correct: '+opts[ci]+'\n'+
    'Difficoltà/Difficulty: '+diff+'\n'+
    'Episodio/Episode: '+(ep||'-')+'\n'+
    'Lingua/Language: '+LANG.toUpperCase()+'\n';
  mailto('[Friends Trivia] Proposta domanda / Question suggestion', body);
  closePropose();
}

// ── BUILD UI ──
function buildPool(){
  const pool=document.getElementById('pool-stats');if(!pool)return;
  pool.innerHTML='';
  DIFFICULTIES.forEach(d=>{
    const n=ALL_QUESTIONS.filter(q=>q.difficulty===d.id).length;
    pool.innerHTML+=`<div class="pool-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px">
      <span style="width:7px;height:7px;border-radius:50%;background:${d.color}"></span>
      <span style="flex:1;color:rgba(245,236,215,.55)">${d.emoji} ${d.label}</span>
      <span style="font-weight:800;font-family:ui-monospace,monospace;color:${d.color}">${n}</span></div>`;
  });
}
function buildDiffCards(){
  const grid=document.getElementById('diff-grid');if(!grid)return;
  const L=t();
  grid.innerHTML='';
  DIFFICULTIES.forEach(d=>{
    const n=ALL_QUESTIONS.filter(q=>q.difficulty===d.id).length;
    const q=Math.min(d.count,n);
    const desc=L.diff[d.id][0];
    grid.innerHTML+=`<div class="diff-card ${d.id===state.diff?'sel':''}" id="dc-${d.id}" style="--dc:${d.color}" onclick="selectDiff('${d.id}')">
      <span class="emoji">${d.emoji}</span>
      <div class="info"><h3>${d.label}</h3><p>${desc}</p></div>
      <span class="badge">${q}Q</span>
      <span class="chk">${d.id===state.diff?'●':'○'}</span></div>`;
  });
}

function init(){
  // restore lang
  try{ const s=localStorage.getItem('ft_lang'); if(s)LANG=s; }catch(e){}
  loadPlayers();
  // Enter key registers a new player
  const inp=document.getElementById('pm-input');
  if(inp)inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();registerPlayer();} });
}

function selectDiff(id){
  state.diff=id;
  const d=DIFFICULTIES.find(x=>x.id===id);const L=t();
  const n=ALL_QUESTIONS.filter(q=>q.difficulty===id).length;
  const q=Math.min(d.count,n);
  document.querySelectorAll('.diff-card').forEach(el=>{el.classList.remove('sel');const c=el.querySelector('.chk');if(c)c.textContent='○';});
  const el=document.getElementById('dc-'+id);
  if(el){el.classList.add('sel');el.querySelector('.chk').textContent='●';}
  setText('start-emoji', d.emoji);
  setText('start-label', L.start+' '+d.label);
  setText('start-meta', L.start_meta(q,d.time));
  const sb=document.getElementById('start-btn');
  if(sb){sb.style.background=d.color;sb.style.boxShadow=`0 6px 0 ${shade(d.color,-25)},0 10px 24px rgba(0,0,0,.4)`;}
}

// ════════ GAME ════════
function startGame(){
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  const pool=ALL_QUESTIONS.filter(q=>q.difficulty===state.diff);
  const prof=curProfile();
  const shuf=arr=>[...arr].sort(()=>Math.random()-.5);

  if(prof){
    // prefer questions this player hasn't seen yet
    const seen=new Set(prof.seen[state.diff]||[]);
    let unseen=pool.filter(q=>!seen.has(q.id));
    if(unseen.length===0){
      // exhausted — reset this level's history and reshuffle
      prof.seen[state.diff]=[]; savePlayers();
      unseen=pool.slice();
      toast(t().all_seen);
    }
    let chosen=shuf(unseen).slice(0,d.count);
    if(chosen.length<d.count){
      // not enough fresh ones: top up with already-seen questions
      const fill=shuf(pool.filter(q=>seen.has(q.id))).slice(0,d.count-chosen.length);
      chosen=chosen.concat(fill);
    }
    state.questions=chosen.map(shuffleOptions);
  }else{
    state.questions=shuf(pool).slice(0,d.count).map(shuffleOptions);
  }

  state.idx=0;state.score=0;state.streak=0;state.maxStreak=0;state.wrong=[];state.basePoints=0;

  const pill=document.getElementById('g-diff-pill');
  pill.textContent=d.emoji+' '+d.label.toUpperCase();
  pill.style.background=d.light;pill.style.color=d.color;pill.style.border='1.5px solid '+d.color+'66';
  document.getElementById('prog-fill').style.background=d.color;

  music.pauseTheme();   // metti in pausa la musica del menu
  music.sting();        // stacchetto d'ingresso
  goScreen('game');
  renderQuestion();
}

function renderQuestion(){
  const q=state.questions[state.idx];
  const d=DIFFICULTIES.find(x=>x.id===state.diff);const L=t();
  state.answered=false;

  const ql=qLoc(q);
  setText('q-counter', `${L.question} ${state.idx+1} ${L.of} ${state.questions.length}`);
  document.getElementById('prog-fill').style.width=(state.idx/state.questions.length*100)+'%';
  updateScore();
  document.getElementById('q-text').textContent=ql.question;

  // optional still/frame image
  const imgEl=document.getElementById('q-image');
  if(imgEl){
    if(q.image){ imgEl.src=q.image; imgEl.style.display='block'; imgEl.onerror=()=>{imgEl.style.display='none';}; }
    else { imgEl.style.display='none'; imgEl.removeAttribute('src'); }
  }
  // id badge + report button
  const meta=document.getElementById('q-meta');
  if(meta) meta.innerHTML=`<span class="q-id">#${q.id}</span>`+
    `<button class="report-btn" onclick="reportQuestion(${q.id})">⚠ ${L.report}</button>`;

  const letters=['A','B','C','D'];
  const a=document.getElementById('answers');a.innerHTML='';
  ql.options.forEach((opt,i)=>{
    a.innerHTML+=`<button class="ans" id="ab-${i}" onclick="answer(${i})">
      <span class="ans-letter">${letters[i]}</span>
      <span class="ans-text">${esc(opt)}</span>
      <span class="ans-icon" id="ai-${i}"></span></button>`;
  });

  document.getElementById('reveal').className='reveal';
  document.getElementById('reveal').innerHTML='';
  document.getElementById('foot-left').innerHTML=`<button class="skip-btn" onclick="skip()">${L.skip}</button>`;
  document.getElementById('foot-right').innerHTML=`<span class="hint">${L.hint}</span>`;

  startTimer(d.time);
}

function startTimer(sec){
  clearInterval(state.timerInt);
  state.timerVal=sec;updateTimer();
  state.timerInt=setInterval(()=>{
    state.timerVal-=0.1;updateTimer();
    if(state.timerVal<=0){clearInterval(state.timerInt);if(!state.answered)skip();}
  },100);
}
function updateTimer(){
  const el=document.getElementById('timer');const v=Math.max(0,Math.ceil(state.timerVal));
  el.textContent=v+'s';el.className='timer'+(v<=5?' warn':'');
}

function answer(idx){
  if(state.answered)return;
  clearInterval(state.timerInt);state.answered=true;
  const q=state.questions[state.idx];
  const ql=qLoc(q);
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  const chosen=ql.options[idx];
  const correct=chosen===ql.answer;

  if(correct){
    state.score++;state.streak++;state.maxStreak=Math.max(state.maxStreak,state.streak);
    state.basePoints+=d.points;bumpPoints();
  }
  else{state.streak=0;state.wrong.push({question:q,chosen});}
  updateScore();

  ql.options.forEach((opt,i)=>{
    const btn=document.getElementById('ab-'+i),ic=document.getElementById('ai-'+i);
    btn.classList.add('revealed');btn.onclick=null;
    if(opt===ql.answer){btn.classList.add('correct');ic.textContent='✓';}
    else if(i===idx&&!correct){btn.classList.add('wrong');ic.textContent='✗';}
    else btn.classList.add('dim');
  });

  showReveal(correct,q);

  const isLast=state.idx>=state.questions.length-1;
  const L=t();
  document.getElementById('foot-left').innerHTML='';
  document.getElementById('foot-right').innerHTML=
    `<button class="next-btn" style="background:${d.color}" onclick="next()">${isLast?L.results_btn:L.next} ${isLast?'✓':'→'}</button>`;
}

function showReveal(correct,q){
  const L=t();
  const ql=qLoc(q);
  const imgs=correct?REACT_IMG.correct:REACT_IMG.wrong;
  const quips=correct?L.quip_ok:L.quip_no;
  const key=correct?'correct':'wrong';
  let i;do{i=Math.floor(Math.random()*imgs.length)}while(imgs.length>1&&i===state.lastReact[key]);
  state.lastReact[key]=i;
  const img=imgs[i];
  const quip=quips[i%quips.length];
  const cit=episodeCitation(q.episode);
  const epHtml=(cit.tag||cit.title)
    ? `<div class="reveal-ep">📺 ${cit.tag?`<span class="tag">${cit.tag}</span>`:''}${cit.title?`<span class="title">${esc(cit.title)}</span>`:''}</div>`
    : '';
  const rev=document.getElementById('reveal');
  rev.innerHTML=`
    <img class="reveal-img" src="img/reactions/${img}" alt="" onerror="this.style.display='none'">
    <div class="reveal-body">
      <div class="reveal-verdict ${correct?'ok':'no'}">${correct?L.correct:L.wrong}</div>
      <div class="reveal-quip">${quip}</div>
      <div class="reveal-ep" style="margin-bottom:4px">✔︎ ${L.answer_label} <span class="title" style="color:#5cba6e">${esc(ql.answer)}</span></div>
      ${epHtml}
    </div>`;
  rev.className='reveal show';
}

function skip(){
  if(state.answered)return;
  clearInterval(state.timerInt);state.answered=true;
  const q=state.questions[state.idx];const L=t();const ql=qLoc(q);
  state.streak=0;state.wrong.push({question:q,chosen:'—'});
  ql.options.forEach((opt,i)=>{
    const btn=document.getElementById('ab-'+i);btn.classList.add('revealed');btn.onclick=null;
    if(opt===ql.answer)btn.classList.add('correct');else btn.classList.add('dim');
  });
  showReveal(false,q);
  const isLast=state.idx>=state.questions.length-1;
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  document.getElementById('foot-left').innerHTML='';
  document.getElementById('foot-right').innerHTML=
    `<button class="next-btn" style="background:${d.color}" onclick="next()">${isLast?L.results_btn:L.next} ${isLast?'✓':'→'}</button>`;
}

function next(){
  flash();
  music.sting();
  setTimeout(()=>{
    state.idx++;
    if(state.idx>=state.questions.length){showResults();return;}
    renderQuestion();
  },210);
}

function updateScore(){
  document.getElementById('score-txt').textContent=state.score+' / '+(state.answered?state.idx+1:state.idx);
  const p=document.getElementById('g-points');
  if(p)p.innerHTML=state.basePoints+' <small>'+t().pts+'</small>';
  const s=document.getElementById('streak');
  if(state.streak>1){s.style.display='flex';document.getElementById('streak-n').textContent=state.streak;}
  else s.style.display='none';
}
function bumpPoints(){
  const p=document.getElementById('g-points');if(!p)return;
  p.classList.remove('bump');void p.offsetWidth;p.classList.add('bump');
}
// lightweight transient toast
function toast(msg){
  let el=document.getElementById('ft-toast');
  if(!el){
    el=document.createElement('div');el.id='ft-toast';
    el.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);'+
      'background:rgba(20,13,6,.95);border:1.5px solid rgba(224,122,43,.5);color:#f5ecd7;'+
      'padding:11px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;'+
      'box-shadow:0 8px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .3s,transform .3s;max-width:90vw;text-align:center';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='translateX(-50%) translateY(0)';});
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(-50%) translateY(20px)';},3200);
}

// ════════ RESULTS ════════
function showResults(){
  clearInterval(state.timerInt);
  music.resumeTheme();
  const L=t();
  const total=state.questions.length;
  const pct=total?state.score/total*100:0;
  const grade=L.grades.find(g=>pct>=g[0])[1];
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  const gc=pct>=90?'#5cba6e':pct>=70?'#e07a2b':pct>=50?'#d4a02a':'#e0594d';

  // ── points ──
  const allCorrect = total>0 && state.score===total;
  const bonus = allCorrect ? Math.round(total*d.points*0.5) : 0;
  const earned = state.basePoints + bonus;

  // ── persist to player profile + mark questions as seen ──
  const prof=curProfile();
  let isRecord=false;
  if(prof){
    prof.games++;
    prof.totalPoints+=earned;
    prof.correct+=state.score;
    prof.answered+=total;
    if(earned>prof.best){ prof.best=earned; isRecord=prof.games>1; }
    const bd=prof.bestByDiff[state.diff]||{points:0,pct:0};
    bd.points=Math.max(bd.points,earned); bd.pct=Math.max(bd.pct,Math.round(pct));
    prof.bestByDiff[state.diff]=bd;
    const set=new Set(prof.seen[state.diff]||[]);
    state.questions.forEach(q=>set.add(q.id));
    prof.seen[state.diff]=[...set];
    savePlayers();
    updatePlayerBar();
  }

  // ── points breakdown UI ──
  const rp=document.getElementById('res-points');
  if(rp){
    rp.innerHTML=
      `<div class="rp-label">${L.points_earned}</div>`+
      `<div class="rp-total">+${earned}<small>${L.pts}</small></div>`+
      `<div class="rp-break">`+
        `<div class="rp-row"><span>${L.base_points} (${state.score}×${d.points})</span><b>+${state.basePoints}</b></div>`+
        (bonus>0?`<div class="rp-row bonus"><span>★ ${L.perfect_bonus}</span><b>+${bonus}</b></div>`:'')+
      `</div>`+
      (isRecord?`<div class="rp-record">${L.new_record}</div>`:'');
  }

  let bucketKey;
  if(pct===100)bucketKey='perfect';
  else if(pct>=85)bucketKey='great';
  else if(pct>=70)bucketKey='ok';
  else if(pct>=50)bucketKey='meh';
  else if(pct>=30)bucketKey='bad';
  else bucketKey='terrible';
  const bImg=REACT_IMG[bucketKey];
  const bText=L.buckets[bucketKey];

  document.getElementById('res-reaction').src='img/reactions/'+bImg;
  document.getElementById('res-score').textContent=state.score;
  document.getElementById('res-score').style.color=gc;
  document.getElementById('res-total').textContent='/ '+total;
  document.getElementById('res-pct').textContent=Math.round(pct)+'%';
  document.getElementById('res-pct').style.color=gc;
  document.getElementById('res-grade').textContent=grade;
  document.getElementById('res-correct').textContent=state.score;
  document.getElementById('res-wrong').textContent=state.wrong.length;
  document.getElementById('res-streak').textContent=state.maxStreak+'🔥';
  setText('res-correct-l', L.correct_stat);
  setText('res-wrong-l', L.wrong_stat);
  setText('res-streak-l', L.streak_stat);
  setText('review-h', L.review);

  const circ=2*Math.PI*70;
  const ring=document.getElementById('ring-fill');
  ring.style.stroke=gc;ring.style.strokeDasharray=circ;ring.style.strokeDashoffset=circ;
  setTimeout(()=>{ring.style.strokeDashoffset=circ*(1-pct/100)},100);

  const rb=document.getElementById('replay-btn');
  rb.textContent=L.replay+' '+d.label;rb.style.background=d.color;rb.style.boxShadow=`0 4px 0 ${shade(d.color,-25)}`;
  setText('home-link', L.change_diff);

  const list=document.getElementById('review-list');
  const meta=document.getElementById('review-meta');
  list.innerHTML='';
  if(state.wrong.length===0){
    meta.textContent='';
    list.innerHTML=`<div class="perfect">
      <img src="img/reactions/how-you-doin.gif" alt="">
      <h3>${bText[0]}</h3><p>${bText[1]}</p></div>`;
  }else{
    meta.textContent=L.to_review(state.wrong.length);
    state.wrong.forEach((w,i)=>{
      const wl=qLoc(w.question);
      const cit=episodeCitation(w.question.episode);
      const epHtml=(cit.tag||cit.title)?`<div class="rev-ep">📺 ${cit.tag?`<span class="tag">${cit.tag}</span>`:''}${cit.title?esc(cit.title):''}</div>`:'';
      list.innerHTML+=`<div class="rev-card">
        <div class="rev-q" onclick="togRev(${i})">
          <span class="rev-idx">${i+1}</span>
          <span class="rev-text">${esc(wl.question)}</span>
          <span class="rev-tog" id="rt-${i}">▸</span></div>
        <div class="rev-detail" id="rd-${i}">
          <div class="rev-correct">✓ ${esc(wl.answer)}</div>
          ${w.chosen!=='—'?`<div class="rev-chosen">✗ ${L.you_chose} ${esc(w.chosen)}</div>`:`<div class="rev-chosen">${L.time_out}</div>`}
          ${epHtml}</div></div>`;
    });
  }
  goScreen('results');
}
function togRev(i){
  const el=document.getElementById('rd-'+i),tg=document.getElementById('rt-'+i);
  const open=el.classList.toggle('open');tg.textContent=open?'▾':'▸';
}
function replay(){startGame();}
function goHome(){clearInterval(state.timerInt);music.resumeTheme();goScreen('home');}

// ════════ SCREEN TRANSITIONS ════════
function goScreen(id){
  const cur=document.querySelector('.screen.active');
  const nxt=document.getElementById(id);
  if(cur&&cur!==nxt){
    cur.classList.add('tv-out');
    setTimeout(()=>{
      cur.classList.remove('active','tv-out');
      nxt.classList.add('active','tv-in');
      setTimeout(()=>nxt.classList.remove('tv-in'),600);
    },300);
  }else{
    nxt.classList.add('active','tv-in');
    setTimeout(()=>nxt.classList.remove('tv-in'),600);
  }
}
function flash(){
  const f=document.getElementById('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');
}

// ════════ AUDIO ════════
const music={
  el:null,muted:false,baseVol:0.5,_ducked:false,started:false,_wasPlaying:false,
  trans:[], _lastTrans:-1,
  init(){
    this.el=document.getElementById('bg-music');
    this.el.volume=this.baseVol;
    for(let i=1;i<=8;i++){
      const a=new Audio('audio/transitions/t'+i+'.mp3');
      a.preload='auto';a.volume=0.55;this.trans.push(a);
    }
  },
  start(){
    if(this.started)return;
    this.started=true;
    this.el.play().catch(()=>{});this.updateBtn();
  },
  toggle(){ if(this.el.paused)this.el.play().catch(()=>{});else this.el.pause(); this.updateBtn(); },
  mute(){
    this.muted=!this.muted;this.el.muted=this.muted;
    this.trans.forEach(a=>a.muted=this.muted);
    document.getElementById('mute-btn').classList.toggle('muted',this.muted);
    document.getElementById('mute-btn').textContent=this.muted?'🔇':'🔊';
  },
  setVol(v){
    this.baseVol=parseFloat(v);
    if(!this._ducked)this.el.volume=this.baseVol;
    this.trans.forEach(a=>a.volume=Math.min(1,this.baseVol+0.1));
  },
  duck(on){ this._ducked=on; if(this.el)this.el.volume=on?this.baseVol*0.5:this.baseVol; },
  pauseTheme(){
    if(this.el && !this.el.paused){ this._wasPlaying=true; this.el.pause(); this.updateBtn(); }
    else { this._wasPlaying=false; }
  },
  resumeTheme(){
    if(this.el && this._wasPlaying && !this.muted){ this.el.play().catch(()=>{}); this.updateBtn(); }
  },
  sting(){
    if(this.muted||!this.started||this.trans.length===0)return;
    let i;do{i=Math.floor(Math.random()*this.trans.length)}while(this.trans.length>1&&i===this._lastTrans);
    this._lastTrans=i;
    const a=this.trans[i];
    try{a.currentTime=0;a.play().catch(()=>{});}catch(e){}
  },
  updateBtn(){ const b=document.getElementById('play-btn'); if(b)b.textContent=this.el.paused?'▶':'⏸'; }
};

// ════════ MODAL ════════
function showModal(){document.getElementById('modal').classList.add('show')}
function hideModal(){document.getElementById('modal').classList.remove('show')}

// ════════ ENTER ════════
function enterSite(){
  document.getElementById('lang-overlay').classList.add('hide');
  setTimeout(()=>{const o=document.getElementById('lang-overlay');if(o)o.style.display='none';},600);
  music.start();
  // ask the player to register (or continue as guest) on first entry
  setTimeout(maybeShowPlayerPrompt,500);
}
// language picked from the very first overlay
function pickLang(lang){
  setLang(lang);
  music.start();   // la musica parte già qui, sul menu di scelta lingua
  // swap from lang screen to enter screen
  document.getElementById('lang-choose').style.display='none';
  document.getElementById('lang-enter').style.display='block';
}

// ════════ UTILS ════════
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function shade(hex,pct){
  const n=parseInt(hex.slice(1),16);let r=(n>>16)+pct,g=(n>>8&255)+pct,b=(n&255)+pct;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return'#'+(r<<16|g<<8|b).toString(16).padStart(6,'0');
}

document.addEventListener('keydown',e=>{
  const sc=document.querySelector('.screen.active')?.id;
  if(sc==='game'){
    if(!state.answered){ if(['1','2','3','4'].includes(e.key))answer(parseInt(e.key)-1); }
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();next();}
  }
});

window.addEventListener('DOMContentLoaded',()=>{
  init();
  music.init();
  applyLang();   // render UI in stored/default language
});
