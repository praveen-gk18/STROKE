/**
 * app.js – Stroke arcade – discovery-first, tabs, adaptive quests, Three.js labs, Code Arena
 */

import { Sync, createSyncUI } from './sync.js';
import { Maths } from './maths.js';
import { Science } from './science.js';
import { CodeArena } from './codeArena.js';

const LEGACY_KEYS = ['learnquest_progress','stroke_legacy','stroke_v1'];
const CURRENT_KEY = 'stroke_progress';

function loadProgress(){
  try{
    const raw=localStorage.getItem(CURRENT_KEY);
    if(raw) return JSON.parse(raw);
    for(let k of LEGACY_KEYS){
      const legacy=localStorage.getItem(k);
      if(legacy){ try{ const p=JSON.parse(legacy); console.log(`[app] migrated from ${k}`); return p; }catch{} }
    }
  }catch{}
  return null;
}
function defaultProgress(){
  return {
    version:2,
    profile:{name:'',createdAt:new Date().toISOString()},
    xp:0,streak:1,hearts:5,coins:0,
    lastPlayed:new Date().toISOString().slice(0,10),
    topics:{
      maths:{algebra:{level:1,xp:0,completed:0},geometry:{level:1,xp:0,completed:0},calculus:{level:1,xp:0,completed:0},statistics:{level:1,xp:0,completed:0},trigonometry:{level:1,xp:0,completed:0}},
      science:{physics:{level:1,xp:0,completed:0},chemistry:{level:1,xp:0,completed:0},biology:{level:1,xp:0,completed:0},astronomy:{level:1,xp:0,completed:0}},
      coding:{basics:{level:1,xp:0,completed:0},algorithms:{level:1,xp:0,completed:0},dataStructures:{level:1,xp:0,completed:0}}
    },
    mistakes:[],flashcards:[],
    analytics:{totalAnswered:0,correct:0,byTopic:{},daily:{}},
    completedMissions:[],
    __revision:0,
    onboardingDone:false
  };
}
function saveProgress(p){
  try{
    p.lastSaved=new Date().toISOString();
    localStorage.setItem(CURRENT_KEY, JSON.stringify(p));
    localStorage.setItem('learnquest_progress', JSON.stringify(p));
    updateStatsUI();
    if(Sync.isEnabled()) debouncedPush();
  }catch(e){ console.error('saveProgress failed',e); }
}

let progress = loadProgress() || defaultProgress();
let currentHub='maths';
let currentTopic='algebra';
let currentQuest=null;
let questIndex=0;

const questBank={
  maths:{
    algebra:[
      {q:'Solve: 2x + 3 = 11',choices:['x=4','x=5','x=3','x=6'],answer:0,hint:'Subtract 3 then divide by 2'},
      {q:'Factor: x² - 9',choices:['(x-3)(x+3)','(x-9)(x+1)','(x-3)²','x(x-9)'],answer:0,hint:'Difference of squares'},
      {q:'If f(x)=2x², f(3)=?',choices:['6','9','18','12'],answer:2,hint:'Plug x=3'},
    ],
    geometry:[
      {q:'Area of circle r=3?',choices:['9π','6π','3π','12π'],answer:0,hint:'A=πr²'},
      {q:'Pythagoras: legs 3,4 hyp?',choices:['5','6','7','4'],answer:0,hint:'√(3²+4²)'},
    ],
    calculus:[
      {q:'Derivative of x²?',choices:['2x','x','x²','2'],answer:0,hint:'Power rule'},
      {q:'∫ 2x dx = ?',choices:['x² + C','2 + C','x + C','2x² + C'],answer:0,hint:'Reverse power rule'},
    ],
    statistics:[{q:'Mean of [2,4,6]?',choices:['4','3','6','2'],answer:0,hint:'(2+4+6)/3'}],
    trigonometry:[{q:'sin(90°) = ?',choices:['1','0','-1','0.5'],answer:0,hint:'Unit circle top'}]
  },
  science:{
    physics:[
      {q:'F=ma, if m=2, a=3, F=?',choices:['6N','5N','2N','3N'],answer:0,hint:'Multiply'},
      {q:'Speed of light ~?',choices:['3×10⁸ m/s','3×10⁶ m/s','3×10⁵ m/s','3×10¹⁰ m/s'],answer:0,hint:'299,792,458'},
    ],
    chemistry:[
      {q:'H2O is?',choices:['Water','Hydrogen','Oxygen','Helium'],answer:0,hint:'2 H + O'},
      {q:'Atomic number of Carbon?',choices:['6','12','8','4'],answer:0,hint:'Check periodic table'},
    ],
    biology:[{q:'DNA stands for?',choices:['Deoxyribonucleic Acid','Diribo...','...'],answer:0,hint:'Deoxy...'}],
    astronomy:[{q:'Closest planet to Sun?',choices:['Mercury','Venus','Earth','Mars'],answer:0,hint:'First planet'}]
  },
  coding:{
    basics:[{q:'What does `let x=5` do?',choices:['Declares variable','Loops','Function','Comment'],answer:0,hint:'Declaration'}],
    algorithms:[{q:'Big O of binary search?',choices:['O(log n)','O(n)','O(n²)','O(1)'],answer:0,hint:'Halves each time'}],
    dataStructures:[{q:'LIFO structure?',choices:['Stack','Queue','Array','Tree'],answer:0,hint:'Last In First Out'}]
  }
};

const placementQuestions=[
  {hub:'maths',topic:'algebra',q:'Solve x: 5x=20',choices:['4','5','20','2'],answer:0},
  {hub:'maths',topic:'geometry',q:'Triangle angles sum?',choices:['180°','90°','360°','270°'],answer:0},
  {hub:'science',topic:'physics',q:'Unit of force?',choices:['Newton','Joule','Watt','Volt'],answer:0},
  {hub:'coding',topic:'basics',q:'`===` checks?',choices:['Value & type','Value only','Assignment','Comment'],answer:0},
];

function updateStatsUI(){
  const xpEl=document.getElementById('stat-xp');
  const streakEl=document.getElementById('stat-streak');
  const heartsEl=document.getElementById('stat-hearts');
  const coinsEl=document.getElementById('stat-coins');
  if(xpEl) xpEl.textContent=progress.xp;
  if(streakEl) streakEl.textContent=progress.streak;
  if(heartsEl) heartsEl.textContent=progress.hearts;
  if(coinsEl) coinsEl.textContent=progress.coins;
  document.querySelectorAll('[data-progress]').forEach(el=>{
    const hub=el.getAttribute('data-progress');
    const topics=progress.topics[hub];
    if(!topics) return;
    const vals=Object.values(topics);
    const avg=vals.reduce((a,b)=>a+b.level,0)/vals.length;
    const pct=Math.min(100,(avg/10)*100);
    el.style.setProperty('--p',pct+'%');
    el.textContent=`Lv ${avg.toFixed(1)}`;
  });
}

function showOnboarding(){
  if(progress.onboardingDone) return;
  const modal=document.getElementById('onboard-modal');
  if(!modal) return;
  modal.classList.add('open');
  let step=0;
  const steps=modal.querySelectorAll('.step');
  const content=modal.querySelector('[data-role="onboard-content"]');
  function renderStep(){
    steps.forEach((s,i)=> s.classList.toggle('active', i<=step));
    if(step===0){
      content.innerHTML=`
        <h2 id="onboard-title">Welcome to Stroke</h2>
        <p class="muted">Discovery-first learning. Explore Maths, Science, Coding at your own pace. No test required to start.</p>
        <div class="grid3">
          <div class="hub" data-hub="maths"><h3>📐 Maths</h3><p class="muted">Algebra, geometry, calculus, graphs, interactive models.</p></div>
          <div class="hub" data-hub="science"><h3>🔬 Science</h3><p class="muted">Periodic table, molecules, solar system, physics.</p></div>
          <div class="hub" data-hub="coding"><h3>💻 Coding</h3><p class="muted">Code Arena with runnable JS missions in Web Workers.</p></div>
        </div>
        <p style="margin-top:12px"><button class="btn btn-primary" data-action="next">Continue – Explore</button> <button class="btn" data-action="skip">Skip onboarding</button></p>
      `;
    } else if(step===1){
      content.innerHTML=`
        <h2>How you learn</h2>
        <ul class="list-arcade">
          <li>Adaptive quests – difficulty adjusts to you</li>
          <li>Hints & confidence checks</li>
          <li>XP, streaks, hearts, coins</li>
          <li>Mistake notebook & flashcards auto-created</li>
          <li>Three.js atom, molecule, solar-system labs</li>
        </ul>
        <p><button class="btn btn-primary" data-action="next">Next</button> <button class="btn" data-action="placement">Optional placement (2 min)</button></p>
      `;
    } else if(step===2){
      content.innerHTML=`
        <h2>Placement – optional</h2>
        <p class="muted">Answer a few quick questions to set your starting level. You can skip and start anywhere.</p>
        <div id="placement-area"></div>
        <p><button class="btn" data-action="skip-placement">Skip – start exploring</button></p>
      `;
      initPlacement(content.querySelector('#placement-area'));
    }
    content.querySelectorAll('[data-action="next"]').forEach(b=> b.addEventListener('click', ()=>{ step++; if(step>2){ finish(); } else renderStep(); }));
    content.querySelectorAll('[data-action="skip"]').forEach(b=> b.addEventListener('click', finish));
    content.querySelectorAll('[data-action="placement"]').forEach(b=> b.addEventListener('click', ()=>{ step=2; renderStep(); }));
    const skipPlace=content.querySelector('[data-action="skip-placement"]');
    if(skipPlace) skipPlace.addEventListener('click', finish);
  }
  function finish(){
    progress.onboardingDone=true;
    saveProgress(progress);
    modal.classList.remove('open');
  }
  renderStep();
}

function initPlacement(container){
  let idx=0, correct=0;
  function render(){
    if(idx>=placementQuestions.length){
      container.innerHTML=`<p>Done! You got ${correct}/${placementQuestions.length}. Setting your levels...</p>`;
      const level=correct>=3?3:correct>=2?2:1;
      Object.keys(progress.topics).forEach(hub=>{
        Object.keys(progress.topics[hub]).forEach(t=>{
          progress.topics[hub][t].level=level;
        });
      });
      saveProgress(progress);
      setTimeout(()=>{
        document.getElementById('onboard-modal')?.classList.remove('open');
        progress.onboardingDone=true;
        saveProgress(progress);
      },1200);
      return;
    }
    const q=placementQuestions[idx];
    container.innerHTML=`
      <div class="quest">
        <div class="q">${q.q} <span class="badge">${q.hub}/${q.topic}</span></div>
        <div class="choices">
          ${q.choices.map((c,i)=>`<button class="choice" data-i="${i}">${c}</button>`).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.choice').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const i=parseInt(btn.getAttribute('data-i'),10);
        if(i===q.answer) correct++;
        idx++;
        render();
      });
    });
  }
  render();
}

function renderHubs(){
  const hubContainer=document.getElementById('hubs');
  if(!hubContainer) return;
  hubContainer.innerHTML=`
    <div class="hub" data-hub="maths" role="listitem" tabindex="0"><div style="display:flex;justify-content:space-between;align-items:center"><h2>📐 Maths</h2><div class="progress-ring" data-progress="maths"></div></div><p class="muted">Adaptive quests, interactive models, graph visualizer.</p><div class="meta"><span class="badge">5 topics</span><span class="badge">Placement optional</span></div></div>
    <div class="hub" data-hub="science" role="listitem" tabindex="0"><div style="display:flex;justify-content:space-between;align-items:center"><h2>🔬 Science</h2><div class="progress-ring" data-progress="science"></div></div><p class="muted">Periodic table (118), atoms, molecules, solar system.</p><div class="meta"><span class="badge">4 topics</span><span class="badge">Three.js labs</span></div></div>
    <div class="hub" data-hub="coding" role="listitem" tabindex="0"><div style="display:flex;justify-content:space-between;align-items:center"><h2>💻 Coding</h2><div class="progress-ring" data-progress="coding"></div></div><p class="muted">Code Arena with Web Worker JS missions.</p><div class="meta"><span class="badge">3 topics</span><span class="badge">Run code</span></div></div>
  `;
  hubContainer.querySelectorAll('.hub').forEach(el=>{
    const go=()=>{
      currentHub=el.getAttribute('data-hub');
      renderTopics();
      // switch to explore tab if not already
      if(window.switchToTab) window.switchToTab('explore');
      document.getElementById('topics-title')?.scrollIntoView({behavior:'smooth'});
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); go(); } });
  });
  updateStatsUI();
}

function renderTopics(){
  const topicsEl=document.getElementById('topics');
  const titleEl=document.getElementById('topics-title');
  if(!topicsEl || !titleEl) return;
  titleEl.textContent=`${currentHub.toUpperCase()} – Topics`;
  const topics=progress.topics[currentHub];
  topicsEl.innerHTML=Object.entries(topics).map(([name,info])=>`
    <div class="topic" data-topic="${name}" role="listitem" tabindex="0">
      <div><b>${name}</b><div class="lvl">Level ${info.level} – ${info.xp} XP – ${info.completed} done</div></div>
      <button class="btn btn-sm">Start</button>
    </div>
  `).join('');
  topicsEl.querySelectorAll('.topic').forEach(el=>{
    const go=()=>{
      currentTopic=el.getAttribute('data-topic');
      questIndex=0;
      renderQuest();
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); go(); } });
  });
}

function renderQuest(){
  const questEl=document.getElementById('quest-area');
  if(!questEl) return;
  const bank=questBank[currentHub]?.[currentTopic];
  if(!bank || bank.length===0){
    questEl.innerHTML=`<div class="card card-cream"><p class="muted">No quests yet for ${currentTopic}. More coming!</p></div>`;
    return;
  }
  const q=bank[questIndex % bank.length];
  currentQuest=q;
  questEl.innerHTML=`
    <div class="card card-yellow">
      <h3>${currentHub} / ${currentTopic} – Quest ${questIndex+1}</h3>
      <div class="quest">
        <div class="q">${q.q}</div>
        <div class="choices">
          ${q.choices.map((c,i)=>`<button class="choice" data-i="${i}">${c}</button>`).join('')}
        </div>
        <div class="confidence">
          <button class="btn btn-sm" data-conf="low">😕 Not sure</button>
          <button class="btn btn-sm" data-conf="mid">🙂 Think so</button>
          <button class="btn btn-sm" data-conf="high">🔥 Confident</button>
        </div>
        <div class="hint" style="display:none" data-role="hint">${q.hint}</div>
        <div style="margin-top:8px"><button class="btn btn-sm" data-action="hint">Show hint</button> <button class="btn btn-sm btn-ghost" data-action="skip">Skip</button></div>
      </div>
    </div>
  `;
  let answered=false;
  questEl.querySelectorAll('.choice').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(answered) return;
      answered=true;
      const i=parseInt(btn.getAttribute('data-i'),10);
      const correct=i===q.answer;
      btn.classList.add(correct?'correct':'wrong');
      questEl.querySelectorAll('.choice').forEach((b, idx)=>{ if(idx===q.answer) b.classList.add('correct'); });
      handleAnswer(correct,q);
    });
  });
  questEl.querySelector('[data-action="hint"]')?.addEventListener('click', ()=>{
    const h=questEl.querySelector('[data-role="hint"]');
    h.style.display=h.style.display==='none'?'block':'none';
  });
  questEl.querySelector('[data-action="skip"]')?.addEventListener('click', ()=>{
    questIndex++;
    renderQuest();
  });
  questEl.querySelectorAll('[data-conf]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const conf=b.getAttribute('data-conf');
      progress.analytics.byTopic[`${currentHub}/${currentTopic}`]=progress.analytics.byTopic[`${currentHub}/${currentTopic}`]||{confidence:[]};
      progress.analytics.byTopic[`${currentHub}/${currentTopic}`].confidence.push(conf);
      saveProgress(progress);
      b.style.borderColor='var(--ink)';
      b.classList.add('state-success');
    });
  });
}

function handleAnswer(correct,q){
  progress.analytics.totalAnswered++;
  if(correct) progress.analytics.correct++;
  const key=`${currentHub}/${currentTopic}`;
  progress.analytics.byTopic[key]=progress.analytics.byTopic[key]||{correct:0,total:0};
  progress.analytics.byTopic[key].total++;
  if(correct) progress.analytics.byTopic[key].correct++;
  const today=new Date().toISOString().slice(0,10);
  progress.analytics.daily[today]=progress.analytics.daily[today]||{correct:0,total:0};
  progress.analytics.daily[today].total++;
  if(correct) progress.analytics.daily[today].correct++;
  if(progress.lastPlayed!==today){
    const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
    if(progress.lastPlayed===yesterday) progress.streak++;
    else progress.streak=1;
    progress.lastPlayed=today;
  }
  if(correct){
    progress.xp+=10;
    progress.coins+=2;
    progress.topics[currentHub][currentTopic].xp+=10;
    progress.topics[currentHub][currentTopic].completed++;
    const xp=progress.topics[currentHub][currentTopic].xp;
    progress.topics[currentHub][currentTopic].level=Math.floor(xp/50)+1;
    progress.flashcards.unshift({q:q.q,a:q.choices[q.answer],topic:key,created:new Date().toISOString()});
    if(progress.flashcards.length>100) progress.flashcards.pop();
  } else {
    progress.hearts=Math.max(0,progress.hearts-1);
    progress.mistakes.unshift({q:q.q,chosen:q.choices,correct:q.choices[q.answer],topic:key,at:new Date().toISOString()});
    if(progress.mistakes.length>100) progress.mistakes.pop();
    if(progress.hearts===0){
      setTimeout(()=>{ progress.hearts=5; saveProgress(progress); },5000);
    }
  }
  saveProgress(progress);
  updateAnalyticsUI();
  renderMistakes();
  renderFlashcards();
  setTimeout(()=>{ questIndex++; renderQuest(); },1200);
}

function renderMistakes(){
  const el=document.getElementById('mistakes');
  if(!el) return;
  if(progress.mistakes.length===0){ el.innerHTML='<p class="muted">No mistakes yet – keep going!</p>'; return; }
  el.innerHTML=progress.mistakes.slice(0,10).map(m=>`
    <div class="note"><b>${m.topic}</b>: ${m.q}<br/><span class="muted">Correct: ${m.correct}</span></div>
  `).join('');
}
function renderFlashcards(){
  const el=document.getElementById('flashcards');
  if(!el) return;
  if(progress.flashcards.length===0){ el.innerHTML='<p class="muted">Flashcards appear when you answer correctly.</p>'; return; }
  el.innerHTML=progress.flashcards.slice(0,6).map((f,i)=>`
    <div class="flashcard" data-i="${i}" tabindex="0"><div><b>${f.q}</b><div class="back" style="display:none">${f.a}</div></div></div>
  `).join('');
  el.querySelectorAll('.flashcard').forEach(card=>{
    const toggle=()=>{
      const back=card.querySelector('.back');
      back.style.display=back.style.display==='none'?'block':'none';
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); } });
  });
}
function updateAnalyticsUI(){
  const el=document.getElementById('analytics');
  if(!el) return;
  const total=progress.analytics.totalAnswered||0;
  const correct=progress.analytics.correct||0;
  const acc=total?(correct/total*100).toFixed(1):0;
  el.innerHTML=`
    <div>Answered: ${total} – Correct: ${correct} (${acc}%)</div>
    <div class="grid2" style="margin-top:8px">
      ${Object.entries(progress.analytics.byTopic).map(([k,v])=>`<div class="note"><b>${k}</b><br/>${v.correct||0}/${v.total||0}</div>`).join('')}
    </div>
    <div style="margin-top:8px"><b>Streak:</b> ${progress.streak} days <b>Hearts:</b> ${progress.hearts} <b>Coins:</b> ${progress.coins}</div>
  `;
}
function renderHubPreviews(){
  const container=document.getElementById('hub-previews');
  if(!container) return;
  container.innerHTML=`
    <div class="grid3">
      <div class="card card-mint"><h3>Maths Preview – Graph</h3><div class="canvas-wrap"><canvas data-preview="graph"></canvas></div><p class="muted small">Plot f(x)=sin(x). Adjust range.</p></div>
      <div class="card card-sky"><h3>Science Preview – Atom</h3><div class="canvas-wrap" style="height:200px"><canvas data-preview="atom"></canvas></div><p class="muted small">Hydrogen atom shell.</p></div>
      <div class="card card-lavender"><h3>Coding Preview – Run</h3><textarea class="code-editor" data-preview="code">console.log('Stroke!');\n[1,2,3].map(x=>x*x)</textarea><div class="log" data-preview="code-out">Click Run</div><button class="btn btn-sm" data-action="run-preview">Run</button></div>
    </div>
  `;
  const graphCanvas=container.querySelector('[data-preview="graph"]');
  if(graphCanvas){
    const g=Maths.initGraph(graphCanvas);
    g.setFunction('Math.sin(x)');
  }
  const atomCanvas=container.querySelector('[data-preview="atom"]');
  if(atomCanvas){
    const ctx=atomCanvas.getContext('2d');
    function drawAtom(){
      const rect=atomCanvas.getBoundingClientRect();
      if(rect.width===0){ requestAnimationFrame(drawAtom); return; }
      atomCanvas.width=rect.width*2; atomCanvas.height=rect.height*2;
      ctx.setTransform(2,0,0,2,0,0);
      const w=rect.width,h=rect.height;
      ctx.fillStyle='#0e1a2b'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#f6f2e6'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(w/2,h/2,50,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#adf075'; ctx.beginPath(); ctx.arc(w/2+50*Math.cos(Date.now()/500),h/2+50*Math.sin(Date.now()/500),6,0,Math.PI*2); ctx.fill();
      requestAnimationFrame(drawAtom);
    }
    drawAtom();
  }
  const codeArea=container.querySelector('[data-preview="code"]');
  const out=container.querySelector('[data-preview="code-out"]');
  container.querySelector('[data-action="run-preview"]')?.addEventListener('click', ()=>{
    try{
      const logs=[];
      const origLog=console.log;
      console.log=(...args)=> logs.push(args.join(' '));
      const fn=new Function(codeArea.value);
      const res=fn();
      console.log=origLog;
      out.textContent=logs.join('\\n') + (res!==undefined ? '\\n=> '+JSON.stringify(res) : '');
    }catch(e){ out.textContent='Error: '+e.message; }
  });
}

let pushTimeout=null;
function debouncedPush(){
  if(pushTimeout) clearTimeout(pushTimeout);
  pushTimeout=setTimeout(async ()=>{
    try{
      const localData={...progress};
      await Sync.push(localData);
      console.log('[sync] auto-push ok rev', Sync.getStoredRevision());
    }catch(e){
      console.warn('[sync] auto-push failed', e);
      if(e.status===409){
        const banner=document.getElementById('sync-conflict-banner');
        if(banner){ banner.style.display='block'; banner.textContent=`Sync conflict: server has newer progress (rev ${e.currentRevision}). Open Manage sync to resolve.`; }
      }
    }
  },1500);
}
function initSyncUI(){
  const btn=document.getElementById('manage-sync-btn');
  const modal=document.getElementById('sync-modal');
  const closeBtn=document.getElementById('close-sync-modal');
  if(!btn || !modal) return;
  const syncContainer=document.getElementById('sync-ui-container');
  function getLocal(){ return progress; }
  function setLocal(data,rev){
    progress={...defaultProgress(), ...data};
    if(rev!==undefined) progress.__revision=rev;
    saveProgress(progress);
    renderAll();
  }
  function renderSync(){
    if(!syncContainer) return;
    syncContainer.innerHTML='';
    const ui=createSyncUI({ getLocalProgress:getLocal, setLocalProgress:setLocal, onStatusChange:updateStatsUI });
    syncContainer.appendChild(ui);
  }
  btn.addEventListener('click', ()=>{ renderSync(); modal.classList.add('open'); });
  closeBtn?.addEventListener('click', ()=> modal.classList.remove('open'));
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('open'); });
}
function renderAll(){
  renderHubs();
  renderTopics();
  updateStatsUI();
  renderMistakes();
  renderFlashcards();
  updateAnalyticsUI();
  renderHubPreviews();
}

/* Tabs – separate subjects */
function initTabs(){
  const tabBtns=document.querySelectorAll('[role=\"tab\"][data-tab]');
  const panels=document.querySelectorAll('[data-tab-panel]');
  function switchTab(tabName){
    tabBtns.forEach(btn=>{
      const isActive=btn.getAttribute('data-tab')===tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive?'true':'false');
    });
    panels.forEach(panel=>{
      const isActive=panel.getAttribute('data-tab-panel')===tabName;
      panel.hidden=!isActive;
      panel.classList.toggle('active', isActive);
    });
    try{ localStorage.setItem('stroke_active_tab', tabName); }catch{}
    // Trigger resize for Three.js after visible
    setTimeout(()=>{
      window.dispatchEvent(new Event('resize'));
      document.querySelectorAll('.tab-panel.active canvas').forEach(c=>{
        const parent=c.parentElement;
        if(parent && parent.getBoundingClientRect().width===0) return;
        // force reflow
        c.style.display='none';
        void c.offsetHeight;
        c.style.display='block';
      });
      if(tabName==='science' && !window._strokeScienceInited){
        initScienceSections();
        window._strokeScienceInited=true;
      }
      if(tabName==='labs' && !window._strokeLabsInited){
        initLabsSections();
        window._strokeLabsInited=true;
      }
      if(tabName==='maths' && window._strokeMathsGraph){
        try{ window._strokeMathsGraph.redraw(); }catch{}
      }
      if(tabName==='coding' && !window._strokeCodingInited){
        initCodeArena();
        window._strokeCodingInited=true;
      }
    }, 120);
  }
  tabBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const tab=btn.getAttribute('data-tab');
      switchTab(tab);
    });
    btn.addEventListener('keydown', e=>{
      if(e.key==='ArrowRight' || e.key==='ArrowLeft'){
        e.preventDefault();
        const idx=Array.from(tabBtns).indexOf(btn);
        const dir=e.key==='ArrowRight'?1:-1;
        const next=(idx+dir+tabBtns.length)%tabBtns.length;
        tabBtns[next].focus();
        tabBtns[next].click();
      }
    });
  });
  let lastTab='explore';
  try{ lastTab=localStorage.getItem('stroke_active_tab')||'explore'; }catch{}
  switchTab(lastTab);
  window.switchToTab=switchTab;
}

let _scienceInstances=[];
let _labsInstances=[];

async function initScienceSections(){
  const periodicContainer=document.getElementById('periodic-table');
  const atomContainer=document.getElementById('atom-view');
  if(periodicContainer && periodicContainer.children.length===0){
    let currentAtomDestroy=null;
    try{
      const elements=await Science.initPeriodic(periodicContainer, async (el)=>{
        if(currentAtomDestroy) try{ currentAtomDestroy.destroy(); }catch{}
        if(atomContainer){
          try{
            const inst=await Science.initAtomViewer(atomContainer, el);
            currentAtomDestroy=inst;
            _scienceInstances.push(inst);
          }catch(err){ console.warn('atom viewer failed',err); }
        }
      });
      if(elements[0] && atomContainer && atomContainer.children.length===0){
        try{
          const inst=await Science.initAtomViewer(atomContainer, elements[0]);
          currentAtomDestroy=inst;
          _scienceInstances.push(inst);
        }catch(err){ console.warn('initial atom failed',err); }
      }
      window._strokeScienceInited=true;
    }catch(err){ console.warn('periodic init failed',err); }
  }
}
async function initLabsSections(){
  const molContainer=document.getElementById('molecule-explorer');
  if(molContainer && molContainer.children.length===0){
    try{
      const inst=await Science.initMoleculeExplorer(molContainer);
      _labsInstances.push(inst);
    }catch(err){ console.warn('molecule explorer failed',err); }
  }
  const solarContainer=document.getElementById('solar-system');
  if(solarContainer && solarContainer.children.length===0){
    try{
      const inst=await Science.initSolarSystem(solarContainer);
      _labsInstances.push(inst);
    }catch(err){ console.warn('solar system failed',err); }
  }
  window._strokeLabsInited=true;
}

function initMathsSections(){
  const graphCanvas=document.getElementById('graph-canvas');
  if(graphCanvas){
    try{
      const g=Maths.initGraph(graphCanvas);
      window._strokeMathsGraph=g;
      const funcInput=document.getElementById('graph-func');
      const xMinInput=document.getElementById('graph-xmin');
      const xMaxInput=document.getElementById('graph-xmax');
      if(funcInput) funcInput.addEventListener('change', e=> g.setFunction(e.target.value));
      function updateRange(){
        const xmin=parseFloat(xMinInput?.value||-10), xmax=parseFloat(xMaxInput?.value||10);
        g.setRange(xmin,xmax,-2,2);
      }
      xMinInput?.addEventListener('change', updateRange);
      xMaxInput?.addEventListener('change', updateRange);
    }catch(err){ console.warn('graph init failed',err); }
  }
  const modelsContainer=document.getElementById('maths-models');
  if(modelsContainer && modelsContainer.children.length===0){
    try{ Maths.createInteractiveModels(modelsContainer); }catch(err){ console.warn('models failed',err); }
  }
}
function initCodeArena(){
  const arena=document.getElementById('code-arena');
  if(arena && arena.children.length===0){
    try{
      CodeArena.init(arena, (missionId)=>{
        progress.completedMissions=[...new Set([...(progress.completedMissions||[]), missionId])];
        progress.xp+=20;
        progress.coins+=5;
        saveProgress(progress);
      });
      window._strokeCodingInited=true;
    }catch(err){ console.warn('code arena failed',err); }
  }
}
function initSettings(){
  const nameInput=document.getElementById('learner-name');
  if(nameInput){
    nameInput.value=progress.profile.name||'';
    nameInput.addEventListener('change', e=>{
      progress.profile.name=e.target.value;
      saveProgress(progress);
    });
  }
  document.getElementById('reset-progress')?.addEventListener('click', ()=>{
    if(confirm('Reset all local progress? This cannot be undone.')){
      progress=defaultProgress();
      saveProgress(progress);
      renderAll();
    }
  });
  document.getElementById('export-progress')?.addEventListener('click', ()=>{
    const blob=new Blob([JSON.stringify(progress,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='stroke-progress.json'; a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('import-progress')?.addEventListener('change', e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        progress={...defaultProgress(), ...data};
        saveProgress(progress);
        renderAll();
        alert('Progress imported');
      }catch(err){ alert('Invalid file'); }
    };
    reader.readAsText(file);
  });
}
function initPWA(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').then(reg=>{
      console.log('[pwa] sw registered', reg.scope);
    }).catch(err=> console.warn('[pwa] sw failed', err));
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  renderAll();
  showOnboarding();
  initTabs();
  initSyncUI();
  // Lazy init – only init visible tab, others on demand via initTabs
  initMathsSections(); // will init if container visible, otherwise retry on tab switch
  initCodeArena();
  initSettings();
  initPWA();
  // Don't eagerly init science/labs when hidden – initTabs will handle
  // But try to init if user lands directly on those tabs (from localStorage)
  const savedTab = (()=>{ try{ return localStorage.getItem('stroke_active_tab'); }catch{ return null; } })();
  if(savedTab==='science'){ await initScienceSections(); window._strokeScienceInited=true; }
  if(savedTab==='labs'){ await initLabsSections(); window._strokeLabsInited=true; }
  if(savedTab==='coding'){ initCodeArena(); window._strokeCodingInited=true; }
  try{
    const res=await fetch('/api/health');
    const data=await res.json();
    const el=document.getElementById('health-status');
    if(el) el.textContent=`API ${data.status} – storage ${data.storage}`;
  }catch{
    const el=document.getElementById('health-status');
    if(el) el.textContent='API offline – local mode';
  }
  document.addEventListener('keydown', e=>{
    if(e.key==='k' && (e.metaKey||e.ctrlKey)){
      e.preventDefault();
      document.getElementById('manage-sync-btn')?.click();
    }
  });
});
