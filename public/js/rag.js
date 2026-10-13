export const RAG = {
  async init(container){
    container.innerHTML=`
      <div class="card card-cream">
        <h2>📚 My Materials – AI Tutor (RAG)</h2>
        <p class="muted small">Upload your Class 10 chapters, notes, PDFs. AI will generate explanations, quizzes, flashcards from YOUR material.</p>
        <input type="file" id="mat-file" accept=".pdf,.txt" class="input-arcade"/>
        <button class="btn btn-primary" id="mat-upload">Upload & Index</button>
        <div id="mat-list" style="margin-top:12px"></div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Ask your material</h3>
        <input id="rag-q" class="input-arcade" placeholder="e.g. Explain photosynthesis from my notes"/>
        <button class="btn" id="rag-ask">Ask</button>
        <div id="rag-ans" style="margin-top:12px;white-space:pre-wrap"></div>
        <div id="rag-quiz"></div>
      </div>
    `;
    const list=container.querySelector('#mat-list');
    const refresh=async()=>{
      const r=await fetch('/api/materials'); const mats=await r.json();
      list.innerHTML=mats.map(m=>`<div class="badge">${m.name} – ${m.text.length} chars</div>`).join('');
    };
    await refresh();
    container.querySelector('#mat-upload').onclick=async()=>{
      const f=container.querySelector('#mat-file').files[0]; if(!f) return alert('Pick file');
      const fd=new FormData(); fd.append('file',f);
      const r=await fetch('/api/materials',{method:'POST',body:fd}); const j=await r.json();
      alert('Indexed: '+j.material.name); refresh();
    };
    container.querySelector('#rag-ask').onclick=async()=>{
      const q=container.querySelector('#rag-q').value;
      const r=await fetch('/api/rag/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q})});
      const j=await r.json();
      container.querySelector('#rag-ans').innerHTML=`<b>Explanation:</b><br/>${j.explanation}<br/><br/><b>Flashcards:</b><br/>${j.flashcards.map(f=>`Q: ${f.front}<br/>A: ${f.back}<br/>`).join('<hr/>')}`;
      container.querySelector('#rag-quiz').innerHTML=`<h4>Quiz</h4>${j.quiz.map((q,i)=>`<div>${i+1}. ${q.q}<br/>${q.options.map(o=>`<label><input type=radio name=q${i}> ${o}</label><br/>`).join('')}</div>`).join('')}`;
    };
  }
};
