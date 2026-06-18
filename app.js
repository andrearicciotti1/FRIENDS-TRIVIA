/* ════════════════════════════════════════════
   FRIENDS TRIVIA — game logic
════════════════════════════════════════════ */

const DIFFICULTIES = [
  { id:'easy',   label:'Easy',   emoji:'☕', desc:'Per i fan occasionali',      color:'#4a9e5c', light:'rgba(74,158,92,.16)',  time:20, count:15 },
  { id:'medium', label:'Medium', emoji:'🛋️', desc:"L'hai visto due volte",      color:'#e07a2b', light:'rgba(224,122,43,.16)', time:18, count:15 },
  { id:'hard',   label:'Hard',   emoji:'🦎', desc:'Tutte le stagioni a memoria', color:'#c0392b', light:'rgba(192,57,43,.16)',  time:15, count:12 },
  { id:'expert', label:'Expert', emoji:'📺', desc:'Hai memorizzato lo show',     color:'#7b5ea7', light:'rgba(123,94,167,.16)', time:12, count:10 },
  { id:'maniac', label:'MANIAC', emoji:'💡', desc:'Tu SEI lo show',              color:'#caa43a', light:'rgba(202,164,58,.18)', time:10, count:10 },
];

// Reaction pools (file in img/reactions/)
const REACT = {
  correct: [
    { img:'good-job.jpg',     quip:"Joey approva. Bravo." },
    { img:'oh-you.jpg',       quip:"Esatto! Could it BE any more giusto?" },
    { img:'how-you-doin.gif', quip:"How you doin'? Bene, a quanto pare." },
  ],
  wrong: [
    { img:'shut-up.jpg',      quip:"Pivot! ...no, era sbagliata." },
    { img:'delusion.jpg',     quip:"\"I've had a very long, hard day.\"" },
    { img:'desperation.jpg',  quip:"Anche Ross sbaglierebbe meno." },
    { img:'delusion-2.jpg',   quip:"Non proprio. Riprova alla prossima." },
    { img:'delusion-again.jpg',quip:"Eh... no." },
  ],
  // level-end by score bucket
  perfect:  { img:'how-you-doin.gif', title:'PERFETTO!',     quip:"Could this BE any more perfetto? Sei una leggenda." },
  great:    { img:'good-job.jpg',     title:'Grande!',        quip:"Joey ti fa il pollice in su." },
  ok:       { img:'sad-winner.jpg',   title:'Vincitore... ma triste', quip:"Hai vinto, ma a che prezzo?" },
  meh:      { img:'almost.jpg',       title:'Ci sei quasi',   quip:"Manca poco. Rigioca." },
  bad:      { img:'surprise.jpg',     title:'Ouch',           quip:"\"We were on a break!\" — anche dalla serie, a quanto pare." },
  terrible: { img:'mega-surprise.webp',title:'...',           quip:"Forse è il momento di rivedere lo show. Tutto." },
};

const GRADES = [
  [95, "Perfetto! How you doin'?! 🏆"],
  [80, "Could this BE any better?! 🎉"],
  [65, "We were on a break... 😅"],
  [50, "Su una scala da 1 a 10... 🤔"],
  [0,  "Ti serve una pausa dalla serie 😬"],
];

let state = {
  diff:'medium', questions:[], idx:0, score:0, streak:0, maxStreak:0,
  wrong:[], answered:false, timerVal:20, timerInt:null,
  lastReact:{correct:-1,wrong:-1}
};

// ── EPISODE CITATION ──
function episodeCitation(code){
  if(EP_TITLES[code]) return { tag:code, title:EP_TITLES[code] };
  if(SEASON_LABELS[code]) return { tag:code, title:SEASON_LABELS[code] };
  if(META_LABELS[code]) return { tag:'', title:META_LABELS[code] };
  return { tag:code||'', title:'' };
}

// ── INIT ──
function init(){
  const pool = document.getElementById('pool-stats');
  DIFFICULTIES.forEach(d=>{
    const n = ALL_QUESTIONS.filter(q=>q.difficulty===d.id).length;
    pool.innerHTML += `<div class="pool-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px">
      <span style="width:7px;height:7px;border-radius:50%;background:${d.color}"></span>
      <span style="flex:1;color:rgba(245,236,215,.55)">${d.emoji} ${d.label}</span>
      <span style="font-weight:800;font-family:ui-monospace,monospace;color:${d.color}">${n}</span></div>`;
  });

  const grid = document.getElementById('diff-grid');
  DIFFICULTIES.forEach(d=>{
    const n = ALL_QUESTIONS.filter(q=>q.difficulty===d.id).length;
    const q = Math.min(d.count,n);
    grid.innerHTML += `<div class="diff-card ${d.id==='medium'?'sel':''}" id="dc-${d.id}" style="--dc:${d.color}" onclick="selectDiff('${d.id}')">
      <span class="emoji">${d.emoji}</span>
      <div class="info"><h3>${d.label}</h3><p>${d.desc}</p></div>
      <span class="badge">${q}Q</span>
      <span class="chk">${d.id==='medium'?'●':'○'}</span></div>`;
  });
  selectDiff('medium');
}

function selectDiff(id){
  state.diff=id;
  const d=DIFFICULTIES.find(x=>x.id===id);
  const n=ALL_QUESTIONS.filter(q=>q.difficulty===id).length;
  const q=Math.min(d.count,n);
  document.querySelectorAll('.diff-card').forEach(el=>{el.classList.remove('sel');el.querySelector('.chk').textContent='○'});
  const el=document.getElementById('dc-'+id);el.classList.add('sel');el.querySelector('.chk').textContent='●';
  document.getElementById('start-emoji').textContent=d.emoji;
  document.getElementById('start-label').textContent='Inizia '+d.label;
  document.getElementById('start-meta').textContent=q+' domande · timer '+d.time+'s';
  document.getElementById('start-btn').style.background=d.color;
  document.getElementById('start-btn').style.boxShadow=`0 6px 0 ${shade(d.color,-25)},0 10px 24px rgba(0,0,0,.4)`;
}

// ── GAME ──
function startGame(){
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  const pool=ALL_QUESTIONS.filter(q=>q.difficulty===state.diff);
  state.questions=[...pool].sort(()=>Math.random()-.5).slice(0,d.count);
  state.idx=0;state.score=0;state.streak=0;state.maxStreak=0;state.wrong=[];

  const pill=document.getElementById('g-diff-pill');
  pill.textContent=d.emoji+' '+d.label.toUpperCase();
  pill.style.background=d.light;pill.style.color=d.color;pill.style.border='1.5px solid '+d.color+'66';
  document.getElementById('prog-fill').style.background=d.color;

  music.duck(true);
  music.sting();
  goScreen('game');
  renderQuestion();
}

function renderQuestion(){
  const q=state.questions[state.idx];
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  state.answered=false;

  document.getElementById('q-counter').textContent='Domanda '+(state.idx+1)+' di '+state.questions.length;
  document.getElementById('prog-fill').style.width=(state.idx/state.questions.length*100)+'%';
  updateScore();
  document.getElementById('q-text').textContent=q.question;

  const letters=['A','B','C','D'];
  const a=document.getElementById('answers');a.innerHTML='';
  q.options.forEach((opt,i)=>{
    a.innerHTML+=`<button class="ans" id="ab-${i}" onclick="answer(${i})">
      <span class="ans-letter">${letters[i]}</span>
      <span class="ans-text">${esc(opt)}</span>
      <span class="ans-icon" id="ai-${i}"></span></button>`;
  });

  document.getElementById('reveal').className='reveal';
  document.getElementById('reveal').innerHTML='';
  document.getElementById('foot-left').innerHTML='<button class="skip-btn" onclick="skip()">Salta →</button>';
  document.getElementById('foot-right').innerHTML='<span class="hint">Premi 1–4 per rispondere</span>';

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
  const chosen=q.options[idx];
  const correct=chosen===q.answer;

  if(correct){state.score++;state.streak++;state.maxStreak=Math.max(state.maxStreak,state.streak);}
  else{state.streak=0;state.wrong.push({question:q,chosen});}
  updateScore();

  q.options.forEach((opt,i)=>{
    const btn=document.getElementById('ab-'+i),ic=document.getElementById('ai-'+i);
    btn.classList.add('revealed');btn.onclick=null;
    if(opt===q.answer){btn.classList.add('correct');ic.textContent='✓';}
    else if(i===idx&&!correct){btn.classList.add('wrong');ic.textContent='✗';}
    else btn.classList.add('dim');
  });

  showReveal(correct,q);

  const isLast=state.idx>=state.questions.length-1;
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  document.getElementById('foot-left').innerHTML='';
  document.getElementById('foot-right').innerHTML=
    `<button class="next-btn" style="background:${d.color}" onclick="next()">${isLast?'Risultati':'Avanti'} ${isLast?'✓':'→'}</button>`;
}

function showReveal(correct,q){
  const pool=correct?REACT.correct:REACT.wrong;
  // avoid repeating same reaction twice in a row
  let i;const key=correct?'correct':'wrong';
  do{i=Math.floor(Math.random()*pool.length)}while(pool.length>1&&i===state.lastReact[key]);
  state.lastReact[key]=i;
  const r=pool[i];
  const cit=episodeCitation(q.episode);
  const epHtml = cit.tag||cit.title
    ? `<div class="reveal-ep">📺 ${cit.tag?`<span class="tag">${cit.tag}</span>`:''}${cit.title?`<span class="title">${esc(cit.title)}</span>`:''}</div>`
    : '';
  const rev=document.getElementById('reveal');
  rev.innerHTML=`
    <img class="reveal-img" src="img/reactions/${r.img}" alt="" onerror="this.style.display='none'">
    <div class="reveal-body">
      <div class="reveal-verdict ${correct?'ok':'no'}">${correct?'GIUSTO!':'SBAGLIATO'}</div>
      <div class="reveal-quip">${r.quip}</div>
      <div class="reveal-ep" style="margin-bottom:4px">✔︎ Risposta: <span class="title" style="color:#5cba6e">${esc(q.answer)}</span></div>
      ${epHtml}
    </div>`;
  rev.className='reveal show';
}

function skip(){
  if(state.answered)return;
  clearInterval(state.timerInt);state.answered=true;
  const q=state.questions[state.idx];
  state.streak=0;state.wrong.push({question:q,chosen:'—'});
  q.options.forEach((opt,i)=>{
    const btn=document.getElementById('ab-'+i);btn.classList.add('revealed');btn.onclick=null;
    if(opt===q.answer)btn.classList.add('correct');else btn.classList.add('dim');
  });
  showReveal(false,q);
  const isLast=state.idx>=state.questions.length-1;
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  document.getElementById('foot-left').innerHTML='';
  document.getElementById('foot-right').innerHTML=
    `<button class="next-btn" style="background:${d.color}" onclick="next()">${isLast?'Risultati':'Avanti'} ${isLast?'✓':'→'}</button>`;
}

function next(){
  flash();
  music.sting();
  setTimeout(()=>{
    state.idx++;
    if(state.idx>=state.questions.length){showResults();return;}
    renderQuestion();
  },160);
}

function updateScore(){
  document.getElementById('g-score').firstElementChild.nextElementSibling;
  document.getElementById('score-txt').textContent=state.score+' / '+(state.answered?state.idx+1:state.idx);
  const s=document.getElementById('streak');
  if(state.streak>1){s.style.display='flex';document.getElementById('streak-n').textContent=state.streak;}
  else s.style.display='none';
}

// ── RESULTS ──
function showResults(){
  clearInterval(state.timerInt);
  music.duck(false);
  const total=state.questions.length;
  const pct=total?state.score/total*100:0;
  const grade=GRADES.find(g=>pct>=g[0])[1];
  const d=DIFFICULTIES.find(x=>x.id===state.diff);
  const gc=pct>=90?'#5cba6e':pct>=70?'#e07a2b':pct>=50?'#d4a02a':'#e0594d';

  // pick reaction bucket
  let bucket;
  if(pct===100)bucket=REACT.perfect;
  else if(pct>=85)bucket=REACT.great;
  else if(pct>=70)bucket=REACT.ok;
  else if(pct>=50)bucket=REACT.meh;
  else if(pct>=30)bucket=REACT.bad;
  else bucket=REACT.terrible;

  document.getElementById('res-reaction').src='img/reactions/'+bucket.img;
  document.getElementById('res-score').textContent=state.score;
  document.getElementById('res-score').style.color=gc;
  document.getElementById('res-total').textContent='/ '+total;
  document.getElementById('res-pct').textContent=Math.round(pct)+'%';
  document.getElementById('res-pct').style.color=gc;
  document.getElementById('res-grade').textContent=grade;
  document.getElementById('res-correct').textContent=state.score;
  document.getElementById('res-wrong').textContent=state.wrong.length;
  document.getElementById('res-streak').textContent=state.maxStreak+'🔥';

  const circ=2*Math.PI*70;
  const ring=document.getElementById('ring-fill');
  ring.style.stroke=gc;ring.style.strokeDasharray=circ;ring.style.strokeDashoffset=circ;
  setTimeout(()=>{ring.style.strokeDashoffset=circ*(1-pct/100)},100);

  const rb=document.getElementById('replay-btn');
  rb.textContent='↻ Rigioca '+d.label;rb.style.background=d.color;rb.style.boxShadow=`0 4px 0 ${shade(d.color,-25)}`;

  // review
  const list=document.getElementById('review-list');
  const meta=document.getElementById('review-meta');
  list.innerHTML='';
  if(state.wrong.length===0){
    meta.textContent='';
    list.innerHTML=`<div class="perfect">
      <img src="img/reactions/how-you-doin.gif" alt="">
      <h3>${bucket.title}</h3><p>${bucket.quip}</p></div>`;
  }else{
    meta.textContent=state.wrong.length+' da rivedere';
    state.wrong.forEach((w,i)=>{
      const cit=episodeCitation(w.question.episode);
      const epHtml=(cit.tag||cit.title)?`<div class="rev-ep">📺 ${cit.tag?`<span class="tag">${cit.tag}</span>`:''}${cit.title?esc(cit.title):''}</div>`:'';
      list.innerHTML+=`<div class="rev-card">
        <div class="rev-q" onclick="togRev(${i})">
          <span class="rev-idx">${i+1}</span>
          <span class="rev-text">${esc(w.question.question)}</span>
          <span class="rev-tog" id="rt-${i}">▸</span></div>
        <div class="rev-detail" id="rd-${i}">
          <div class="rev-correct">✓ ${esc(w.question.answer)}</div>
          ${w.chosen!=='—'?`<div class="rev-chosen">✗ Hai scelto: ${esc(w.chosen)}</div>`:'<div class="rev-chosen">⏱ Tempo scaduto</div>'}
          ${epHtml}</div></div>`;
    });
  }
  goScreen('results');
}
function togRev(i){
  const el=document.getElementById('rd-'+i),t=document.getElementById('rt-'+i);
  const open=el.classList.toggle('open');t.textContent=open?'▾':'▸';
}
function replay(){startGame();}
function goHome(){clearInterval(state.timerInt);music.duck(false);goScreen('home');}

// ── SCREEN TRANSITIONS (channel-flip) ──
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

// ── AUDIO ──
const music={
  el:null,muted:false,baseVol:0.5,_ducked:false,started:false,
  trans:[], _lastTrans:-1,
  init(){
    this.el=document.getElementById('bg-music');
    this.el.volume=this.baseVol;
    // preload transition sounds
    for(let i=1;i<=8;i++){
      const a=new Audio('audio/transitions/t'+i+'.mp3');
      a.preload='auto';a.volume=0.55;
      this.trans.push(a);
    }
  },
  // called after user clicks "entra" — autoplay policy satisfied
  start(){
    if(this.started)return;
    this.started=true;
    this.el.play().catch(()=>{});
    this.updateBtn();
  },
  toggle(){
    if(this.el.paused)this.el.play().catch(()=>{});else this.el.pause();
    this.updateBtn();
  },
  mute(){
    this.muted=!this.muted;this.el.muted=this.muted;
    // also mute transitions
    this.trans.forEach(a=>a.muted=this.muted);
    document.getElementById('mute-btn').classList.toggle('muted',this.muted);
    document.getElementById('mute-btn').textContent=this.muted?'🔇':'🔊';
  },
  setVol(v){
    this.baseVol=parseFloat(v);
    if(!this._ducked)this.el.volume=this.baseVol;
    this.trans.forEach(a=>a.volume=Math.min(1,this.baseVol+0.1));
  },
  duck(on){ // lower theme volume during gameplay
    this._ducked=on;
    if(this.el)this.el.volume=on?this.baseVol*0.5:this.baseVol;
  },
  // play a random transition sting (between questions / screen changes)
  sting(){
    if(this.muted||!this.started||this.trans.length===0)return;
    let i;do{i=Math.floor(Math.random()*this.trans.length)}while(this.trans.length>1&&i===this._lastTrans);
    this._lastTrans=i;
    const a=this.trans[i];
    try{a.currentTime=0;a.play().catch(()=>{});}catch(e){}
  },
  updateBtn(){
    const b=document.getElementById('play-btn');
    if(b)b.textContent=this.el.paused?'▶':'⏸';
  }
};

// ── MODAL ──
function showModal(){document.getElementById('modal').classList.add('show')}
function hideModal(){document.getElementById('modal').classList.remove('show')}

// ── UTILS ──
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function shade(hex,pct){
  const n=parseInt(hex.slice(1),16);let r=(n>>16)+pct,g=(n>>8&255)+pct,b=(n&255)+pct;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return'#'+(r<<16|g<<8|b).toString(16).padStart(6,'0');
}

// keyboard
document.addEventListener('keydown',e=>{
  const sc=document.querySelector('.screen.active')?.id;
  if(sc==='game'){
    if(!state.answered){
      if(['1','2','3','4'].includes(e.key))answer(parseInt(e.key)-1);
    }else if(e.key==='Enter'||e.key===' '){e.preventDefault();next();}
  }
});

function enterSite(){
  document.getElementById('enter-overlay').classList.add('hide');
  setTimeout(()=>{const o=document.getElementById('enter-overlay');if(o)o.style.display='none';},600);
  music.start();
}
window.addEventListener('DOMContentLoaded',()=>{init();music.init();});
