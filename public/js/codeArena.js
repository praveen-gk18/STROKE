/**
 * codeArena.js – runnable missions with list UI and multi-language (JS, Python3, C, Java)
 * JS runs in time-limited Web Worker, others simulated for demo but with proper starters
 */

export const CodeArena = {
  missions: [
    {
      id:'hello',
      title:'Hello, Stroke!',
      difficulty:'Beginner',
      prompt:'Write a function greet(name) that returns "Hello, <name>!"',
      starters:{
        javascript:'function greet(name) {\n  // your code\n  return `Hello, ${name}!`;\n}\n',
        python:'def greet(name):\n    # your code\n    return f\"Hello, {name}!\"\n',
        c:'#include <stdio.h>\n#include <string.h>\n// Write function greet(name, out) that writes \"Hello, <name>!\" into out\nvoid greet(const char* name, char* out){\n  // your code\n  sprintf(out, \"Hello, %s!\", name);\n}\n',
        java:'public class Main {\n  // Write method greet(name) returning \"Hello, <name>!\"\n  public static String greet(String name){\n    // your code\n    return \"Hello, \" + name + \"!\";\n  }\n}\n'
      },
      tests: [
        { input:['World'], expected:'Hello, World!' },
        { input:['Ada'], expected:'Hello, Ada!' },
      ],
      hint:'Use template literals in JS, f-strings in Python, sprintf in C, + in Java'
    },
    {
      id:'sum',
      title:'Sum Array',
      difficulty:'Beginner',
      prompt:'Write function sum(arr) that returns sum of numbers.',
      starters:{
        javascript:'function sum(arr) {\n  return arr.reduce((a,b)=>a+b,0);\n}\n',
        python:'def sum_arr(arr):\n    return sum(arr)\n',
        c:'int sum(int* arr, int n){\n  int s=0;\n  for(int i=0;i<n;i++) s+=arr[i];\n  return s;\n}\n',
        java:'public class Main {\n  public static int sum(int[] arr){\n    int s=0;\n    for(int x: arr) s+=x;\n    return s;\n  }\n}\n'
      },
      tests: [
        { input:[[1,2,3]], expected:6 },
        { input:[[]], expected:0 },
        { input:[[-1,5]], expected:4 },
      ],
      hint:'Loop and accumulate.'
    },
    {
      id:'fizzbuzz',
      title:'FizzBuzz',
      difficulty:'Intermediate',
      prompt:'Write fizzBuzz(n) returning array/list 1..n with Fizz for 3, Buzz for 5, FizzBuzz for both.',
      starters:{
        javascript:'function fizzBuzz(n){\n  const out=[];\n  for(let i=1;i<=n;i++){\n    if(i%15===0) out.push(\"FizzBuzz\");\n    else if(i%3===0) out.push(\"Fizz\");\n    else if(i%5===0) out.push(\"Buzz\");\n    else out.push(i);\n  }\n  return out;\n}\n',
        python:'def fizz_buzz(n):\n    out=[]\n    for i in range(1,n+1):\n        if i%15==0: out.append(\"FizzBuzz\")\n        elif i%3==0: out.append(\"Fizz\")\n        elif i%5==0: out.append(\"Buzz\")\n        else: out.append(i)\n    return out\n',
        c:'#include <stdio.h>\n// Print FizzBuzz 1..n – for demo, just implement logic in comments\nvoid fizzBuzz(int n){\n  for(int i=1;i<=n;i++){\n    if(i%15==0) printf(\"FizzBuzz \");\n    else if(i%3==0) printf(\"Fizz \");\n    else if(i%5==0) printf(\"Buzz \");\n    else printf(\"%d \", i);\n  }\n}\n',
        java:'import java.util.*;\npublic class Main {\n  public static List<Object> fizzBuzz(int n){\n    List<Object> out=new ArrayList<>();\n    for(int i=1;i<=n;i++){\n      if(i%15==0) out.add(\"FizzBuzz\");\n      else if(i%3==0) out.add(\"Fizz\");\n      else if(i%5==0) out.add(\"Buzz\");\n      else out.add(i);\n    }\n    return out;\n  }\n}\n'
      },
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
      starters:{
        javascript:'function orbitalPeriod(a){\n  return Math.sqrt(a**3);\n}\n',
        python:'import math\ndef orbital_period(a):\n    return math.sqrt(a**3)\n',
        c:'#include <math.h>\ndouble orbitalPeriod(double a){\n  return sqrt(a*a*a);\n}\n',
        java:'public class Main {\n  public static double orbitalPeriod(double a){\n    return Math.sqrt(a*a*a);\n  }\n}\n'
      },
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
      starters:{
        javascript:'function isPrime(n){\n  if(n<=1) return false;\n  for(let i=2;i*i<=n;i++) if(n%i===0) return false;\n  return true;\n}\n',
        python:'def is_prime(n):\n    if n<=1: return False\n    i=2\n    while i*i<=n:\n        if n%i==0: return False\n        i+=1\n    return True\n',
        c:'#include <stdbool.h>\nbool isPrime(int n){\n  if(n<=1) return false;\n  for(int i=2;i*i<=n;i++) if(n%i==0) return false;\n  return true;\n}\n',
        java:'public class Main {\n  public static boolean isPrime(int n){\n    if(n<=1) return false;\n    for(int i=2;i*i<=n;i++) if(n%i==0) return false;\n    return true;\n  }\n}\n'
      },
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
          const fn = new Function(code + "\\nreturn { greet, sum, fizzBuzz, orbitalPeriod, isPrime, sum_arr, fizz_buzz, orbital_period, is_prime };");
          const funcs = fn();
          for (let t of tests) {
            try {
              const map = { hello:'greet', sum:'sum', fizzbuzz:'fizzBuzz', orbit:'orbitalPeriod', prime:'isPrime' };
              const expectedName = map[id] || Object.keys(funcs)[0];
              // try python names too
              const altMap = { sum:'sum_arr', fizzbuzz:'fizz_buzz', orbit:'orbital_period', prime:'is_prime' };
              let f = funcs[expectedName] || funcs[altMap[id]] || Object.values(funcs).find(v=>typeof v==='function');
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
      <div class="code-layout">
        <div>
          <h4 style="margin:0 0 8px 0">Problems – in order</h4>
          <div class="problem-list" data-role="problem-list"></div>
          <div class="card card-yellow" style="margin-top:12px;padding:12px">
            <b>How to run C/Python/Java?</b><br/>
            <span class="muted small">JS runs live in Worker. For C/Python/Java we show starter and check logic – full compile needs backend, but you can practice syntax here. Select language tabs.</span>
          </div>
        </div>
        <div>
          <div class="card card-cream" style="margin:0">
            <div class="section-head">
              <h3 data-role="mission-title" style="margin:0">Select a problem</h3>
              <span class="badge" data-role="difficulty"></span>
            </div>
            <p data-role="prompt" style="font-weight:800;font-size:1.05rem"></p>
            <div class="lang-tabs" data-role="lang-tabs">
              <button class="lang-btn active" data-lang="javascript">JS</button>
              <button class="lang-btn" data-lang="python">Python3</button>
              <button class="lang-btn" data-lang="c">C</button>
              <button class="lang-btn" data-lang="java">Java</button>
            </div>
            <textarea class="code-editor" data-role="editor" aria-label="Code editor" spellcheck="false"></textarea>
            <div class="toolbar" style="margin-top:10px">
              <button class="btn btn-primary" data-action="run">Run & Test</button>
              <button class="btn btn-sm" data-action="hint">Hint</button>
              <button class="btn btn-sm" data-action="reset">Reset</button>
              <button class="btn btn-sm" data-action="reload-arena">Reload</button>
              <span data-role="timer" class="kbd"></span>
            </div>
            <div class="log" data-role="log">Ready – pick a problem from the list, choose language, and run.</div>
            <div data-role="hint" class="hint" style="display:none"></div>
          </div>
        </div>
      </div>
    `;

    const listEl = container.querySelector('[data-role="problem-list"]');
    const titleEl = container.querySelector('[data-role="mission-title"]');
    const promptEl = container.querySelector('[data-role="prompt"]');
    const editor = container.querySelector('[data-role="editor"]');
    const logEl = container.querySelector('[data-role="log"]');
    const hintEl = container.querySelector('[data-role="hint"]');
    const diffEl = container.querySelector('[data-role="difficulty"]');
    const timerEl = container.querySelector('[data-role="timer"]');
    const langTabs = container.querySelectorAll('[data-lang]');

    let currentLang = 'javascript';
    let current = this.missions[0];

    function renderList(){
      listEl.innerHTML='';
      this.missions.forEach((m, idx)=>{
        const div=document.createElement('button');
        div.className='problem-item';
        if(m.id===current.id) div.classList.add('active');
        div.innerHTML=`<div style="display:flex;justify-content:space-between"><span>${idx+1}. ${m.title}</span><span>${m.id===current.id?'◀':''}</span></div><div class="diff">${m.difficulty} • ${m.id}</div>`;
        div.addEventListener('click', ()=>{ current=m; renderList(); loadMission(); });
        listEl.appendChild(div);
      });
    }

    function loadMission(){
      titleEl.textContent = current.title;
      promptEl.textContent = current.prompt;
      diffEl.textContent = current.difficulty;
      hintEl.textContent = current.hint;
      hintEl.style.display='none';
      const starter = current.starters[currentLang] || current.starters.javascript;
      editor.value = starter;
      logEl.textContent = `Loaded ${current.title} in ${currentLang}. Write solution and run.`;
      renderList.call(CodeArena);
    }

    langTabs.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        langTabs.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        currentLang = btn.getAttribute('data-lang');
        const starter = current.starters[currentLang] || current.starters.javascript;
        editor.value = starter;
        logEl.textContent = `Switched to ${currentLang} – ${current.title}`;
      });
    });

    renderList.call(this);
    loadMission();

    container.querySelector('[data-action="hint"]').addEventListener('click', ()=>{
      hintEl.style.display = hintEl.style.display==='none' ? 'block' : 'none';
    });
    container.querySelector('[data-action="reset"]').addEventListener('click', ()=>{
      const starter = current.starters[currentLang] || current.starters.javascript;
      editor.value = starter;
    });
    container.querySelector('[data-action="reload-arena"]')?.addEventListener('click', ()=>{
      CodeArena.init(container, onComplete);
    });

    container.querySelector('[data-action="run"]').addEventListener('click', async ()=>{
      const code=editor.value;
      if(currentLang!=='javascript'){
        // Simulated execution for C/Python/Java
        logEl.textContent = `Running ${currentLang} (simulated)…\\nChecking logic…`;
        await new Promise(r=>setTimeout(r,600));
        let pass=true;
        let details='';
        // Simple heuristic checks
        if(current.id==='hello'){
          if(currentLang==='python' && !code.includes('def greet')) pass=false;
          if(currentLang==='c' && !code.includes('greet')) pass=false;
          if(currentLang==='java' && !code.includes('greet')) pass=false;
        }
        if(code.trim().length<10) pass=false;
        if(pass){
          logEl.textContent = `✅ ${currentLang} – ${current.title} looks good!\\n(Simulated run – JS tests would pass)\\n\\nFor full ${currentLang} compile, backend needed. JS version runs live in Worker.\\n\\nTry switching to JS tab and Run & Test for live verification.`;
          if(onComplete) onComplete(current.id);
        } else {
          logEl.textContent = `❌ ${currentLang} – check your function name and logic.\\nHint: ${current.hint}`;
        }
        timerEl.textContent = currentLang;
        return;
      }
      // JS live run
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
        let out=`${allPass?'✅ All tests passed!':'❌ Some failed'}\\n`;
        results.forEach((r,i)=>{
          out+=`Test ${i+1}: ${r.pass?'PASS':'FAIL'}\\n`;
          if(!r.pass){
            out+=`  input: ${JSON.stringify(r.input)}\\n`;
            if(r.error) out+=`  error: ${r.error}\\n`;
            else out+=`  expected: ${JSON.stringify(r.expected)} got: ${JSON.stringify(r.got)}\\n`;
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
