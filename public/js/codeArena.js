/**
 * codeArena.js – runnable JavaScript missions in time-limited Web Worker
 */

export const CodeArena = {
  missions: [
    {
      id:'hello',
      title:'Hello, Stroke!',
      difficulty:'Beginner',
      prompt:'Write a function greet(name) that returns "Hello, <name>!"',
      starter:'function greet(name) {\n  // your code\n}\n',
      tests: [
        { input:['World'], expected:'Hello, World!' },
        { input:['Ada'], expected:'Hello, Ada!' },
      ],
      hint:'Use template literals: `Hello, ${name}!`'
    },
    {
      id:'sum',
      title:'Sum Array',
      difficulty:'Beginner',
      prompt:'Write function sum(arr) that returns sum of numbers.',
      starter:'function sum(arr) {\n  \n}\n',
      tests: [
        { input:[[1,2,3]], expected:6 },
        { input:[[]], expected:0 },
        { input:[[-1,5]], expected:4 },
      ],
      hint:'Use reduce or loop.'
    },
    {
      id:'fizzbuzz',
      title:'FizzBuzz',
      difficulty:'Intermediate',
      prompt:'Write fizzBuzz(n) returning array 1..n with Fizz for 3, Buzz for 5, FizzBuzz for both.',
      starter:'function fizzBuzz(n){\n  \n}\n',
      tests: [
        { input:[3], expected:[1,2,'Fizz'] },
        { input:[5], expected:[1,2,'Fizz',4,'Buzz'] },
        { input:[15], check:(out)=> out[14]==='FizzBuzz' },
      ],
      hint:'Loop 1..n, check %3 and %5.'
    },
    {
      id:'orbit',
      title:'Orbit Period',
      difficulty:'Intermediate',
      prompt:'Given semi-major axis a (AU), return orbital period in Earth years using Kepler 3rd law: period = sqrt(a^3). Function orbitalPeriod(a).',
      starter:'function orbitalPeriod(a){\n  \n}\n',
      tests: [
        { input:[1], expected:1 },
        { input:[4], expected:8 },
        { input:[9], check:(o)=> Math.abs(o-27)<0.01 },
      ],
      hint:'Math.pow or ** operator.'
    },
    {
      id:'prime',
      title:'Prime Check',
      difficulty:'Advanced',
      prompt:'Write isPrime(n) returning true if n is prime.',
      starter:'function isPrime(n){\n  \n}\n',
      tests: [
        { input:[2], expected:true },
        { input:[15], expected:false },
        { input:[17], expected:true },
        { input:[1], expected:false },
      ],
      hint:'Check divisibility up to sqrt(n).'
    },
  ],

  createWorker() {
    const workerCode = `
      self.onmessage = function(e){
        const { code, tests, id } = e.data;
        const results=[];
        try {
          // create isolated context
          const fn = new Function(code + "\\nreturn { greet, sum, fizzBuzz, orbitalPeriod, isPrime };");
          const funcs = fn();
          for (let t of tests) {
            try {
              let funcName = Object.keys(funcs).find(k=> typeof funcs[k]==='function' && code.includes(k)) || Object.keys(funcs)[0];
              // try to guess function name from mission id mapping
              const map = { hello:'greet', sum:'sum', fizzbuzz:'fizzBuzz', orbit:'orbitalPeriod', prime:'isPrime' };
              const expectedName = map[id] || funcName;
              const f = funcs[expectedName] || funcs[funcName];
              if (!f) throw new Error('Function '+expectedName+' not found');
              const out = f(...t.input);
              let pass=false;
              if (t.check) pass = t.check(out);
              else pass = JSON.stringify(out)===JSON.stringify(t.expected);
              results.push({ pass, input:t.input, expected:t.expected, got:out });
            } catch (err) {
              results.push({ pass:false, error: err.message, input:t.input });
            }
          }
          self.postMessage({ ok:true, results });
        } catch (err) {
          self.postMessage({ ok:false, error: err.message });
        }
      };
    `;
    const blob = new Blob([workerCode], { type:'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  },

  init(container, onComplete) {
    container.innerHTML = `
      <div class="card card-cream" style="margin:0">
        <div class="section-head">
          <h3 style="margin:0">Code Arena – Runnable JS Missions</h3>
          <span class="badge badge-arcade">Worker • 2s limit</span>
        </div>
        <p class="muted small">Your code runs in a time-limited Web Worker (2s timeout). No DOM access. If editor is blank, switch tabs and back – it will restore.</p>
        <div class="toolbar">
          <select data-role="mission-select" class="input-arcade" style="flex:1;max-width:260px"></select>
          <span class="badge" data-role="difficulty"></span>
          <button class="btn btn-sm" data-action="reload-arena">Reload</button>
        </div>
        <p data-role="prompt" style="font-weight:800;font-size:1.1rem"></p>
        <textarea class="code-editor" data-role="editor" aria-label="Code editor"></textarea>
        <div class="toolbar" style="margin-top:10px">
          <button class="btn btn-primary" data-action="run">Run & Test (Worker)</button>
          <button class="btn btn-sm" data-action="hint">Hint</button>
          <button class="btn btn-sm btn-ghost" data-action="reset">Reset</button>
          <span data-role="timer" class="kbd"></span>
        </div>
        <div class="log" data-role="log">Ready – select a mission and run.</div>
        <div data-role="hint" class="hint" style="display:none"></div>
      </div>
    `;

    const select = container.querySelector('[data-role="mission-select"]');
    const promptEl = container.querySelector('[data-role="prompt"]');
    const editor = container.querySelector('[data-role="editor"]');
    const logEl = container.querySelector('[data-role="log"]');
    const hintEl = container.querySelector('[data-role="hint"]');
    const diffEl = container.querySelector('[data-role="difficulty"]');
    const timerEl = container.querySelector('[data-role="timer"]');

    this.missions.forEach(m=>{
      const opt=document.createElement('option');
      opt.value=m.id; opt.textContent=`${m.title} – ${m.difficulty}`;
      select.appendChild(opt);
    });

    let current = this.missions[0];
    function loadMission(id){
      current = CodeArena.missions.find(m=>m.id===id) || CodeArena.missions[0];
      promptEl.textContent=current.prompt;
      editor.value=current.starter;
      diffEl.textContent=current.difficulty;
      hintEl.style.display='none';
      hintEl.textContent=current.hint;
      logEl.textContent=`Loaded ${current.title}. Write your solution and run.`;
    }
    loadMission(current.id);
    select.addEventListener('change', e=> loadMission(e.target.value));

    container.querySelector('[data-action="hint"]').addEventListener('click', ()=>{
      hintEl.style.display = hintEl.style.display==='none' ? 'block' : 'none';
    });
    container.querySelector('[data-action="reset"]').addEventListener('click', ()=>{
      editor.value=current.starter;
    });
    container.querySelector('[data-action="reload-arena"]')?.addEventListener('click', ()=>{
      CodeArena.init(container, onComplete);
    });

    container.querySelector('[data-action="run"]').addEventListener('click', async ()=>{
      const code=editor.value;
      logEl.textContent='Running in Worker... (2s limit)';
      const worker=CodeArena.createWorker();
      let timedOut=false;
      const timeout=setTimeout(()=>{
        timedOut=true;
        worker.terminate();
        logEl.textContent='⏱️ Timeout – 2s limit exceeded. Check infinite loops.';
        timerEl.textContent='timeout';
      }, 2000);

      const start=performance.now();
      worker.onmessage = (e)=>{
        clearTimeout(timeout);
        if(timedOut) return;
        const elapsed=(performance.now()-start).toFixed(1);
        timerEl.textContent=`${elapsed}ms`;
        const data=e.data;
        if(!data.ok){
          logEl.textContent=`❌ Error: ${data.error}`;
          worker.terminate();
          return;
        }
        const results=data.results;
        const allPass=results.every(r=>r.pass);
        let out=`${allPass?'✅ All tests passed!':'❌ Some failed'}\n`;
        results.forEach((r,i)=>{
          out+=`Test ${i+1}: ${r.pass?'PASS':'FAIL'}\n`;
          if(!r.pass){
            out+=`  input: ${JSON.stringify(r.input)}\n`;
            if(r.error) out+=`  error: ${r.error}\n`;
            else out+=`  expected: ${JSON.stringify(r.expected)} got: ${JSON.stringify(r.got)}\n`;
          }
        });
        logEl.textContent=out;
        if(allPass && onComplete) onComplete(current.id);
        worker.terminate();
      };
      worker.onerror = (err)=>{
        clearTimeout(timeout);
        logEl.textContent=`Worker error: ${err.message}`;
        worker.terminate();
      };
      worker.postMessage({ code, tests: current.tests, id: current.id });
    });
  }
};
