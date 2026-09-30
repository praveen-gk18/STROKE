/**
 * maths.js – interactive maths models and graph visualizer
 */

export const Maths = {
  initGraph(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      draw();
    }
    let funcStr = 'Math.sin(x)';
    let xMin = -10, xMax = 10, yMin = -2, yMax = 2;

    function safeEval(x) {
      try {
        // allow Math, x
        const fn = new Function('x','Math', `return ${funcStr};`);
        return fn(x, Math);
      } catch {
        return NaN;
      }
    }

    function draw() {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = '#0e1422';
      ctx.fillRect(0,0,w,h);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.lineWidth = 1;
      const xStep = (xMax-xMin)/10;
      const yStep = (yMax-yMin)/10;
      for (let i=0;i<=10;i++) {
        const x = ((i/10)*w);
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
        const y = ((i/10)*h);
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      }

      // axes
      const x0 = ((-xMin)/(xMax-xMin))*w;
      const y0 = ((yMax)/(yMax-yMin))*h;
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(w,y0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0,0); ctx.lineTo(x0,h); ctx.stroke();

      // function
      ctx.strokeStyle = '#6cf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let first=true;
      for (let px=0; px<w; px++) {
        const x = xMin + (px/w)*(xMax-xMin);
        const y = safeEval(x);
        if (!isFinite(y)) { first=true; continue; }
        const py = yMax - y;
        const sy = (py/(yMax-yMin))*h;
        if (first) { ctx.moveTo(px,sy); first=false; }
        else ctx.lineTo(px,sy);
      }
      ctx.stroke();

      // labels
      ctx.fillStyle = '#9aa8bd';
      ctx.font = '12px ui-monospace';
      ctx.fillText(`f(x)=${funcStr}`, 10, 20);
      ctx.fillText(`x:[${xMin},${xMax}] y:[${yMin},${yMax}]`, 10, h-8);
    }

    window.addEventListener('resize', resize);
    resize();

    return {
      setFunction(str) { funcStr=str; draw(); },
      setRange(x0,x1,y0,y1){ xMin=x0; xMax=x1; yMin=y0; yMax=y1; draw(); },
      redraw: draw,
      destroy(){ window.removeEventListener('resize', resize); }
    };
  },

  createInteractiveModels(container) {
    container.innerHTML = `
      <div class="grid2">
        <div class="card">
          <h3>Pythagoras Visual Proof</h3>
          <div class="canvas-wrap"><canvas data-model="pythag"></canvas></div>
          <div class="toolbar">
            <label>a <input type="range" data-param="a" min="1" max="10" value="3" step="0.5"></label>
            <label>b <input type="range" data-param="b" min="1" max="10" value="4" step="0.5"></label>
          </div>
          <p class="muted">Drag sliders – c = √(a²+b²). Areas animate.</p>
        </div>
        <div class="card">
          <h3>Unit Circle & Sine Wave</h3>
          <div class="canvas-wrap"><canvas data-model="unit"></canvas></div>
          <div class="toolbar">
            <label>θ <input type="range" data-param="theta" min="0" max="6.28" value="1" step="0.01"></label>
            <span class="kbd" data-out="theta"></span>
          </div>
        </div>
        <div class="card">
          <h3>Quadratic Explorer</h3>
          <div class="canvas-wrap"><canvas data-model="quad"></canvas></div>
          <div class="toolbar">
            <label>a <input type="range" data-param="qa" min="-2" max="2" value="1" step="0.1"></label>
            <label>b <input type="range" data-param="qb" min="-5" max="5" value="0" step="0.2"></label>
            <label>c <input type="range" data-param="qc" min="-5" max="5" value="-2" step="0.2"></label>
          </div>
        </div>
        <div class="card">
          <h3>Derivative Visualizer</h3>
          <div class="canvas-wrap"><canvas data-model="deriv"></canvas></div>
          <p class="muted">Shows f(x)=x³/10 and its derivative slope.</p>
        </div>
      </div>
    `;

    const canvases = container.querySelectorAll('canvas');
    const states = {};

    function setupPythag(canvas) {
      const ctx = canvas.getContext('2d');
      let a=3,b=4;
      function draw(){
        const rect=canvas.getBoundingClientRect();
        canvas.width=rect.width*2; canvas.height=rect.height*2;
        ctx.setTransform(2,0,0,2,0,0);
        const w=rect.width,h=rect.height;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle='#0e1422'; ctx.fillRect(0,0,w,h);
        const c=Math.sqrt(a*a+b*b);
        const scale=Math.min(w,h)/(c+ a + b +2);
        const ox=w/2, oy=h/2;
        // draw right triangle
        ctx.strokeStyle='#6cf'; ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(ox,oy);
        ctx.lineTo(ox+a*scale*10, oy);
        ctx.lineTo(ox+a*scale*10, oy-b*scale*10);
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle='rgba(108,207,255,.15)'; ctx.fill();
        ctx.fillStyle='#9aa8bd'; ctx.font='12px monospace';
        ctx.fillText(`a=${a} b=${b} c=${c.toFixed(2)}`,10,20);
        ctx.fillText(`a²+b²=${(a*a+b*b).toFixed(1)} c²=${(c*c).toFixed(1)}`,10,36);
      }
      draw();
      return { setA(v){a=parseFloat(v);draw()}, setB(v){b=parseFloat(v);draw()} };
    }

    function setupUnit(canvas){
      const ctx=canvas.getContext('2d');
      let theta=1;
      function draw(){
        const rect=canvas.getBoundingClientRect();
        canvas.width=rect.width*2; canvas.height=rect.height*2;
        ctx.setTransform(2,0,0,2,0,0);
        const w=rect.width,h=rect.height;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle='#0e1422'; ctx.fillRect(0,0,w,h);
        const cx=w*0.35, cy=h/2, r=Math.min(w,h)*0.3;
        ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(cx-r-10,cy); ctx.lineTo(cx+r+10,cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,cy-r-10); ctx.lineTo(cx,cy+r+10); ctx.stroke();
        const x=Math.cos(theta)*r, y=Math.sin(theta)*r;
        ctx.strokeStyle='#ff7ae8'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+x,cy - y); ctx.stroke();
        ctx.fillStyle='#8af5ff'; ctx.beginPath(); ctx.arc(cx+x,cy - y,4,0,Math.PI*2); ctx.fill();
        // sine wave on right
        const waveX=w*0.65, waveW=w*0.3;
        ctx.strokeStyle='rgba(108,207,255,.3)'; ctx.beginPath();
        for(let i=0;i<waveW;i++){
          const t=(i/waveW)*Math.PI*2;
          const wy=cy - Math.sin(t)*r*0.6;
          if(i===0) ctx.moveTo(waveX+i,wy); else ctx.lineTo(waveX+i,wy);
        }
        ctx.stroke();
        ctx.fillStyle='#6cf'; ctx.beginPath(); ctx.arc(waveX + (theta/(Math.PI*2))*waveW % waveW, cy - Math.sin(theta)*r*0.6,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#9aa8bd'; ctx.font='12px monospace';
        ctx.fillText(`θ=${theta.toFixed(2)} sin=${Math.sin(theta).toFixed(2)} cos=${Math.cos(theta).toFixed(2)}`,10,20);
      }
      draw();
      return { setTheta(v){theta=parseFloat(v);draw()} };
    }

    function setupQuad(canvas){
      const ctx=canvas.getContext('2d');
      let a=1,b=0,c=-2;
      function draw(){
        const rect=canvas.getBoundingClientRect();
        canvas.width=rect.width*2; canvas.height=rect.height*2;
        ctx.setTransform(2,0,0,2,0,0);
        const w=rect.width,h=rect.height;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle='#0e1422'; ctx.fillRect(0,0,w,h);
        const xMin=-5,xMax=5,yMin=-6,yMax=6;
        function sx(x){return (x-xMin)/(xMax-xMin)*w}
        function sy(y){return (1-(y-yMin)/(yMax-yMin))*h}
        ctx.strokeStyle='rgba(255,255,255,.08)';
        for(let i=-5;i<=5;i++){ ctx.beginPath(); ctx.moveTo(sx(i),0); ctx.lineTo(sx(i),h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,sy(i)); ctx.lineTo(w,sy(i)); ctx.stroke(); }
        ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(0,sy(0)); ctx.lineTo(w,sy(0)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx(0),0); ctx.lineTo(sx(0),h); ctx.stroke();
        ctx.strokeStyle='#6cf'; ctx.lineWidth=2; ctx.beginPath();
        let first=true;
        for(let px=0;px<w;px++){
          const x=xMin+(px/w)*(xMax-xMin);
          const y=a*x*x+b*x+c;
          const py=sy(y);
          if(first){ctx.moveTo(px,py);first=false}else ctx.lineTo(px,py);
        }
        ctx.stroke();
        const disc=b*b-4*a*c;
        ctx.fillStyle='#9aa8bd'; ctx.font='12px monospace';
        ctx.fillText(`y=${a}x²+${b}x+${c} D=${disc.toFixed(2)}`,10,20);
        if(disc>=0 && a!==0){
          const r1=(-b+Math.sqrt(disc))/(2*a), r2=(-b-Math.sqrt(disc))/(2*a);
          ctx.fillText(`roots ${r1.toFixed(2)}, ${r2.toFixed(2)}`,10,36);
          ctx.fillStyle='#ff7ae8'; ctx.beginPath(); ctx.arc(sx(r1),sy(0),4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(sx(r2),sy(0),4,0,Math.PI*2); ctx.fill();
        }
      }
      draw();
      return { setA(v){a=parseFloat(v);draw()}, setB(v){b=parseFloat(v);draw()}, setC(v){c=parseFloat(v);draw()} };
    }

    function setupDeriv(canvas){
      const ctx=canvas.getContext('2d');
      function draw(){
        const rect=canvas.getBoundingClientRect();
        canvas.width=rect.width*2; canvas.height=rect.height*2;
        ctx.setTransform(2,0,0,2,0,0);
        const w=rect.width,h=rect.height;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle='#0e1422'; ctx.fillRect(0,0,w,h);
        const xMin=-5,xMax=5,yMin=-5,yMax=5;
        function sx(x){return (x-xMin)/(xMax-xMin)*w}
        function sy(y){return (1-(y-yMin)/(yMax-yMin))*h}
        ctx.strokeStyle='rgba(255,255,255,.1)';
        for(let i=-5;i<=5;i++){ ctx.beginPath(); ctx.moveTo(sx(i),0); ctx.lineTo(sx(i),h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,sy(i)); ctx.lineTo(w,sy(i)); ctx.stroke(); }
        // f
        ctx.strokeStyle='#6cf'; ctx.lineWidth=2; ctx.beginPath();
        for(let px=0;px<w;px++){
          const x=xMin+(px/w)*(xMax-xMin);
          const y=Math.pow(x,3)/10;
          const py=sy(y);
          if(px===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke();
        // derivative
        ctx.strokeStyle='#ff7ae8'; ctx.setLineDash([4,4]); ctx.beginPath();
        for(let px=0;px<w;px++){
          const x=xMin+(px/w)*(xMax-xMin);
          const y=3*x*x/10;
          const py=sy(y);
          if(px===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#9aa8bd'; ctx.font='12px monospace';
        ctx.fillText('f(x)=x³/10 (blue) f\'(x)=3x²/10 (pink dashed)',10,20);
      }
      draw();
      return {};
    }

    const map={};
    canvases.forEach(c=>{
      const m=c.getAttribute('data-model');
      if(m==='pythag') map.pythag=setupPythag(c);
      if(m==='unit') map.unit=setupUnit(c);
      if(m==='quad') map.quad=setupQuad(c);
      if(m==='deriv') map.deriv=setupDeriv(c);
    });

    container.addEventListener('input', e=>{
      const t=e.target;
      const p=t.getAttribute('data-param');
      if(!p) return;
      const v=t.value;
      if(p==='a') map.pythag?.setA(v);
      if(p==='b') map.pythag?.setB(v);
      if(p==='theta'){ map.unit?.setTheta(v); const out=container.querySelector('[data-out="theta"]'); if(out) out.textContent=v; }
      if(p==='qa') map.quad?.setA(v);
      if(p==='qb') map.quad?.setB(v);
      if(p==='qc') map.quad?.setC(v);
    });
  }
};
