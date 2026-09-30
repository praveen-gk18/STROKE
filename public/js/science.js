/**
 * science.js – periodic table, atom viewer, molecule explorer, solar system
 * Robust version – handles hidden tabs, WebGL fallback, resize on tab switch
 */

function isWebGLAvailable(){
  try{
    const c=document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  }catch{ return false; }
}

async function waitForVisible(el, maxTries=20){
  for(let i=0;i<maxTries;i++){
    const r=el.getBoundingClientRect();
    if(r.width>80 && r.height>80) return r;
    await new Promise(res=>setTimeout(res,120));
  }
  return el.getBoundingClientRect();
}

export const Science = {
  async initPeriodic(container, onSelect) {
    try{
      const res = await fetch('/data/elements.json');
      const elements = await res.json();

      const categories = {
        'alkali metal':'#ff7a7a',
        'alkaline earth metal':'#ffb86a',
        'transition metal':'#8af5ff',
        'post-transition metal':'#6cf',
        'metalloid':'#b18cff',
        'nonmetal':'#3dd68c',
        'halogen':'#ff7ae8',
        'noble gas':'#7ae8ff',
        'lanthanide':'#ffd86a',
        'actinide':'#ff8a8a'
      };

      const table = document.createElement('div');
      table.className='periodic';

      elements.forEach(el=>{
        const div=document.createElement('div');
        div.className='elem';
        div.dataset.number=el.number;
        div.tabIndex=0;
        div.innerHTML=`<span>${el.number}</span><span class="sym">${el.symbol}</span><span>${el.name.slice(0,4)}</span>`;
        div.style.borderLeft=`4px solid ${categories[el.category]||'#101b29'}`;
        div.title=`${el.name} (${el.symbol}) #${el.number} – ${el.category}`;
        const activate=()=>{
          table.querySelectorAll('.elem').forEach(e=>e.classList.remove('selected'));
          div.classList.add('selected');
          if(onSelect) onSelect(el);
        };
        div.addEventListener('click', activate);
        div.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); activate(); } });
        table.appendChild(div);
      });

      container.innerHTML='';
      container.appendChild(table);
      return elements;
    }catch(err){
      console.error('periodic init failed',err);
      container.innerHTML=`<div class="banner banner-warn">Periodic table failed to load: ${err.message}</div>`;
      return [];
    }
  },

  async initAtomViewer(container, element) {
    container.innerHTML = `
      <div class="canvas-wrap atom-view"><canvas aria-label="Atom 3D view"></canvas></div>
      <div class="card card-cream" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <h3 style="margin:0">${element.name} (${element.symbol})</h3>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" data-action="front-atom">⬆ Front</button>
            <button class="btn btn-sm" data-action="reload-atom">Reload 3D</button>
          </div>
        </div>
        <p class="muted small">Atomic #${element.number} – Mass ${element.mass} – ${element.category}<br/>
        Config: ${element.electronConfig} – Discovered: ${element.discovered}</p>
        <p class="muted small">Drag to orbit, scroll to zoom. If blank, click Reload 3D – it will resize for the tab.</p>
        <div data-role="atom-log" class="log" style="display:none"></div>
      </div>`;
    const canvas = container.querySelector('canvas');
    const logEl = container.querySelector('[data-role="atom-log"]');
    const reloadBtn = container.querySelector('[data-action="reload-atom"]');

    await waitForVisible(canvas.parentElement, 30);

    if(!isWebGLAvailable()){
      logEl.style.display='block';
      logEl.textContent='WebGL not available – showing 2D fallback.';
      // 2D fallback
      const ctx=canvas.getContext('2d');
      const rect=canvas.parentElement.getBoundingClientRect();
      canvas.width=rect.width*2; canvas.height=rect.height*2;
      ctx.setTransform(2,0,0,2,0,0);
      ctx.fillStyle='#0e1a2b'; ctx.fillRect(0,0,rect.width,rect.height);
      ctx.fillStyle='#f6f2e6'; ctx.font='bold 16px sans-serif';
      ctx.fillText(`${element.name} – ${element.number} electrons`,10,30);
      return { destroy(){} };
    }

    try{
      const THREE = (await import('/vendor/three.module.js')).default;
      let OrbitControls=null;
      try{
        const mod=await import('/vendor/OrbitControls.js');
        OrbitControls=mod.OrbitControls;
      }catch(e){ console.warn('OrbitControls failed, continuing without',e); }

      const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0e1a2b');
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(0, 2.5, 6);
      const controls = OrbitControls ? new OrbitControls(camera, renderer.domElement) : null;
      if(controls){ controls.enableDamping=true; controls.dampingFactor=0.1; }

      scene.add(new THREE.AmbientLight(0xffffff,0.7));
      const dir=new THREE.DirectionalLight(0xffffff,0.9); dir.position.set(2,3,2); scene.add(dir);

      const nucleusGeo=new THREE.SphereGeometry(0.45, 32,32);
      const nucleusMat=new THREE.MeshStandardMaterial({ color:0xff9e9c, roughness:0.4 });
      const nucleus=new THREE.Mesh(nucleusGeo,nucleusMat);
      scene.add(nucleus);

      const totalElectrons=element.number;
      const shells=[];
      let remaining=totalElectrons;
      const caps=[2,8,18,32,32,18,8];
      for(let cap of caps){ if(remaining<=0) break; const take=Math.min(cap,remaining); shells.push(take); remaining-=take; }

      const electronMeshes=[];
      shells.forEach((count, shellIdx)=>{
        const radius=0.9+shellIdx*0.65;
        const ringGeo=new THREE.TorusGeometry(radius,0.015,8,64);
        const ringMat=new THREE.MeshBasicMaterial({ color:0xf6f2e6, transparent:true, opacity:0.12 });
        const ring=new THREE.Mesh(ringGeo,ringMat);
        ring.rotation.x=Math.PI/2 + shellIdx*0.25;
        scene.add(ring);
        for(let i=0;i<count;i++){
          const geo=new THREE.SphereGeometry(0.08,12,12);
          const mat=new THREE.MeshStandardMaterial({ color: shellIdx%2?0xadf075:0x90cce9, emissive:0x112233, emissiveIntensity:0.3 });
          const mesh=new THREE.Mesh(geo,mat);
          mesh.userData={ radius, angle:(i/count)*Math.PI*2, speed:0.6+Math.random()*0.6+shellIdx*0.15, shellIdx };
          electronMeshes.push(mesh);
          scene.add(mesh);
        }
      });

      function resize(){
        const rect=canvas.parentElement.getBoundingClientRect();
        if(rect.width<10 || rect.height<10) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect=rect.width/rect.height;
        camera.updateProjectionMatrix();
      }
      const ro=new ResizeObserver(resize);
      ro.observe(canvas.parentElement);
      window.addEventListener('resize', resize);
      resize();

      let raf=null;
      const clock=new THREE.Clock();
      function animate(){
        raf=requestAnimationFrame(animate);
        const t=clock.getElapsedTime();
        electronMeshes.forEach(e=>{
          e.userData.angle+=0.015*e.userData.speed;
          const r=e.userData.radius;
          e.position.x=Math.cos(e.userData.angle)*r;
          e.position.z=Math.sin(e.userData.angle)*r;
          e.position.y=Math.sin(e.userData.angle*0.7+e.userData.shellIdx)*0.25;
        });
        nucleus.rotation.y+=0.008;
        if(controls) controls.update();
        renderer.render(scene,camera);
      }
      animate();

      const frontBtn=container.querySelector('[data-action="front-atom"]');
      function toggleFront(){
        const wrap=canvas.parentElement;
        wrap.classList.toggle('front');
        document.querySelectorAll('.card').forEach(c=>{
          if(c!==container.closest('.card')) c.classList.toggle('front-behind', wrap.classList.contains('front'));
        });
        setTimeout(resize, 50);
      }
      frontBtn.addEventListener('click', toggleFront);

      const reload=async ()=>{
        if(raf) cancelAnimationFrame(raf);
        try{ ro.disconnect(); }catch{}
        window.removeEventListener('resize', resize);
        renderer.dispose();
        await Science.initAtomViewer(container, element);
      };
      reloadBtn.addEventListener('click', reload);

      return {
        destroy(){
          if(raf) cancelAnimationFrame(raf);
          try{ ro.disconnect(); }catch{}
          window.removeEventListener('resize', resize);
          try{ renderer.dispose(); }catch{}
        },
        resize
      };
    }catch(err){
      console.error('atom viewer error',err);
      logEl.style.display='block';
      logEl.textContent='3D failed: '+err.message+' – showing fallback.';
      const ctx=canvas.getContext('2d');
      const rect=canvas.parentElement.getBoundingClientRect();
      canvas.width=rect.width*2; canvas.height=rect.height*2;
      ctx.setTransform(2,0,0,2,0,0);
      ctx.fillStyle='#0e1a2b'; ctx.fillRect(0,0,rect.width,rect.height);
      ctx.fillStyle='#f6f2e6'; ctx.fillText('Fallback: '+element.symbol,10,20);
      return { destroy(){} };
    }
  },

  async initMoleculeExplorer(container) {
    container.innerHTML = `
      <div class="toolbar">
        <select data-role="mol-select" class="input-arcade" style="flex:1;max-width:220px">
          <option value="water">Water H2O</option>
          <option value="methane">Methane CH4</option>
          <option value="co2">Carbon Dioxide CO2</option>
          <option value="benzene">Benzene C6H6</option>
          <option value="dna">DNA fragment</option>
        </select>
        <button class="btn btn-sm" data-action="spin">Toggle spin</button>
        <button class="btn btn-sm" data-action="explode">Explode / Assemble</button>
        <button class="btn btn-sm" data-action="front-mol">⬆ Front</button>
        <button class="btn btn-sm" data-action="reload-mol">Reload 3D</button>
      </div>
      <div class="canvas-wrap molecule-view"><canvas aria-label="Molecule 3D"></canvas></div>
      <p class="muted small">Three.js molecule explorer – atoms as spheres, bonds as cylinders. Drag to orbit. If blank after tab switch, click Reload 3D.</p>
      <div data-role="mol-log" class="log" style="display:none"></div>
    `;
    const canvas=container.querySelector('canvas');
    const select=container.querySelector('[data-role="mol-select"]');
    const logEl=container.querySelector('[data-role="mol-log"]');

    await waitForVisible(canvas.parentElement, 30);

    if(!isWebGLAvailable()){
      logEl.style.display='block';
      logEl.textContent='WebGL not available – molecule viewer needs WebGL.';
      return { destroy(){} };
    }

    try{
      const THREE=(await import('/vendor/three.module.js')).default;
      let OrbitControls=null;
      try{ OrbitControls=(await import('/vendor/OrbitControls.js')).OrbitControls; }catch{}

      const renderer=new THREE.WebGLRenderer({ canvas, antialias:true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      const scene=new THREE.Scene();
      scene.background=new THREE.Color('#0e1a2b');
      const camera=new THREE.PerspectiveCamera(45,1,0.1,100);
      camera.position.set(0,2.5,6);
      const controls=OrbitControls? new OrbitControls(camera, renderer.domElement):null;
      if(controls) controls.enableDamping=true;

      scene.add(new THREE.AmbientLight(0xffffff,0.8));
      const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(2,3,2); scene.add(dl);

      let group=new THREE.Group();
      scene.add(group);
      let spinning=true, exploded=false;
      const atomColors={ H:0xf6f2e6, O:0xff9e9c, C:0x101b29, N:0x90cce9, P:0xf4d36c };

      function clearGroup(){ while(group.children.length) group.remove(group.children[0]); }
      function atom(pos, element){
        const geo=new THREE.SphereGeometry(element==='H'?0.28:0.45,24,24);
        const mat=new THREE.MeshStandardMaterial({ color:atomColors[element]||0xadf075, roughness:0.4 });
        const m=new THREE.Mesh(geo,mat);
        m.position.copy(pos);
        m.userData.originalPos=pos.clone();
        group.add(m);
        return m;
      }
      function bond(a,b){
        const dir=new THREE.Vector3().subVectors(b,a);
        const len=dir.length();
        const geo=new THREE.CylinderGeometry(0.06,0.06,len,12);
        const mat=new THREE.MeshStandardMaterial({ color:0xf6f2e6 });
        const mesh=new THREE.Mesh(geo,mat);
        mesh.position.copy(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
        mesh.userData.originalPos=mesh.position.clone();
        mesh.userData.isBond=true;
        mesh.userData.a=a.clone(); mesh.userData.b=b.clone();
        group.add(mesh);
        return mesh;
      }
      function buildWater(){
        clearGroup();
        const oPos=new THREE.Vector3(0,0,0);
        const h1=new THREE.Vector3(0.8,0.6,0);
        const h2=new THREE.Vector3(-0.8,0.6,0);
        atom(oPos,'O'); atom(h1,'H'); atom(h2,'H');
        bond(oPos,h1); bond(oPos,h2);
      }
      function buildMethane(){
        clearGroup();
        const c=new THREE.Vector3(0,0,0);
        atom(c,'C');
        const positions=[new THREE.Vector3(0.9,0.9,0.9),new THREE.Vector3(-0.9,-0.9,0.9),new THREE.Vector3(-0.9,0.9,-0.9),new THREE.Vector3(0.9,-0.9,-0.9)];
        positions.forEach(p=>{ atom(p,'H'); bond(c,p); });
      }
      function buildCO2(){
        clearGroup();
        const c=new THREE.Vector3(0,0,0);
        const o1=new THREE.Vector3(1.3,0,0), o2=new THREE.Vector3(-1.3,0,0);
        atom(c,'C'); atom(o1,'O'); atom(o2,'O');
        bond(c,o1); bond(c,o2);
      }
      function buildBenzene(){
        clearGroup();
        const r=1.3;
        const carbons=[];
        for(let i=0;i<6;i++){
          const ang=(i/6)*Math.PI*2;
          const pos=new THREE.Vector3(Math.cos(ang)*r, Math.sin(ang)*r,0);
          carbons.push(pos);
          atom(pos,'C');
        }
        for(let i=0;i<6;i++){
          const a=carbons[i], b=carbons[(i+1)%6];
          bond(a,b);
          const hPos=a.clone().multiplyScalar(1.6);
          atom(hPos,'H'); bond(a,hPos);
        }
      }
      function buildDNA(){
        clearGroup();
        for(let i=0;i<10;i++){
          const y=i*0.45-2;
          const ang=i*0.6;
          const x1=Math.cos(ang)*0.9, z1=Math.sin(ang)*0.9;
          const x2=Math.cos(ang+Math.PI)*0.9, z2=Math.sin(ang+Math.PI)*0.9;
          const p1=new THREE.Vector3(x1,y,z1), p2=new THREE.Vector3(x2,y,z2);
          atom(p1,i%2?'P':'C'); atom(p2,i%2?'C':'P');
          if(i>0){
            const prevY=(i-1)*0.45-2;
            const prevAng=(i-1)*0.6;
            const px1=Math.cos(prevAng)*0.9, pz1=Math.sin(prevAng)*0.9;
            bond(new THREE.Vector3(px1,prevY,pz1), p1);
            const px2=Math.cos(prevAng+Math.PI)*0.9, pz2=Math.sin(prevAng+Math.PI)*0.9;
            bond(new THREE.Vector3(px2,prevY,pz2), p2);
          }
          if(i%2===0) bond(p1,p2);
        }
      }
      const builders={ water:buildWater, methane:buildMethane, co2:buildCO2, benzene:buildBenzene, dna:buildDNA };
      function rebuild(){ (builders[select.value]||buildWater)(); }
      rebuild();
      select.addEventListener('change', rebuild);

      container.querySelector('[data-action="spin"]').addEventListener('click', ()=> spinning=!spinning);
      container.querySelector('[data-action="explode"]').addEventListener('click', ()=>{
        exploded=!exploded;
        group.children.forEach(ch=>{
          if(!ch.userData.originalPos) return;
          if(exploded){
            const dir=ch.userData.originalPos.clone().normalize().multiplyScalar(1.2);
            ch.position.copy(ch.userData.originalPos.clone().add(dir));
          }else{
            ch.position.copy(ch.userData.originalPos);
            if(ch.userData.isBond){
              const mid=new THREE.Vector3().addVectors(ch.userData.a, ch.userData.b).multiplyScalar(0.5);
              ch.position.copy(mid);
            }
          }
        });
      });
      container.querySelector('[data-action="front-mol"]')?.addEventListener('click', ()=>{
        const wrap=canvas.parentElement;
        wrap.classList.toggle('front');
        document.querySelectorAll('.card').forEach(c=>{ if(c!==container.closest('.card')) c.classList.toggle('front-behind', wrap.classList.contains('front')); });
        setTimeout(resize,50);
      });
      container.querySelector('[data-action="reload-mol"]').addEventListener('click', async ()=>{
        if(raf) cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('resize', resize);
        renderer.dispose();
        await Science.initMoleculeExplorer(container);
      });

      function resize(){
        const rect=canvas.parentElement.getBoundingClientRect();
        if(rect.width<10 || rect.height<10) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect=rect.width/rect.height;
        camera.updateProjectionMatrix();
      }
      const ro=new ResizeObserver(resize);
      ro.observe(canvas.parentElement);
      window.addEventListener('resize', resize);
      resize();

      let raf=null;
      function animate(){
        raf=requestAnimationFrame(animate);
        if(spinning) group.rotation.y+=0.008;
        if(controls) controls.update();
        renderer.render(scene,camera);
      }
      animate();

      return {
        destroy(){ if(raf) cancelAnimationFrame(raf); try{ ro.disconnect(); }catch{} window.removeEventListener('resize', resize); try{ renderer.dispose(); }catch{} },
        resize
      };
    }catch(err){
      console.error('molecule explorer error',err);
      logEl.style.display='block';
      logEl.textContent='3D failed: '+err.message;
      return { destroy(){} };
    }
  },

  async initSolarSystem(container) {
    container.innerHTML = `
      <div class="toolbar">
        <select data-role="planet-select" class="input-arcade" style="max-width:160px">
          <option value="all">All planets</option>
          <option value="mercury">Mercury</option>
          <option value="venus">Venus</option>
          <option value="earth">Earth</option>
          <option value="mars">Mars</option>
          <option value="jupiter">Jupiter</option>
          <option value="saturn">Saturn</option>
          <option value="uranus">Uranus</option>
          <option value="neptune">Neptune</option>
        </select>
        <button class="btn btn-sm" data-action="toggle-orbit">Toggle orbits</button>
        <button class="btn btn-sm" data-action="toggle-gravity">Gravity lab</button>
        <button class="btn btn-sm btn-primary" data-action="rocket">Rocket lab</button>
        <button class="btn btn-sm" data-action="front-solar">⬆ Front</button>
        <button class="btn btn-sm" data-action="reload-solar">Reload 3D</button>
      </div>
      <div class="canvas-wrap solar-view"><canvas aria-label="Solar system 3D"></canvas></div>
      <div class="grid2" style="margin-top:12px">
        <div class="card card-cream"><h4>Orbit comparison</h4><canvas data-role="orbit-chart" height="120"></canvas></div>
        <div class="card card-cream"><h4>Planet mission</h4><div data-role="mission"></div></div>
      </div>
      <div data-role="solar-log" class="log" style="display:none"></div>
    `;
    const canvas=container.querySelector('canvas');
    const logEl=container.querySelector('[data-role="solar-log"]');

    await waitForVisible(canvas.parentElement, 30);

    if(!isWebGLAvailable()){
      logEl.style.display='block';
      logEl.textContent='WebGL not available.';
      return { destroy(){} };
    }

    try{
      const THREE=(await import('/vendor/three.module.js')).default;
      let OrbitControls=null;
      try{ OrbitControls=(await import('/vendor/OrbitControls.js')).OrbitControls; }catch{}

      const renderer=new THREE.WebGLRenderer({ canvas, antialias:true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      const scene=new THREE.Scene();
      scene.background=new THREE.Color('#050a14');
      const camera=new THREE.PerspectiveCamera(50,1,0.1,1000);
      camera.position.set(0,14,20);
      const controls=OrbitControls? new OrbitControls(camera, renderer.domElement):null;
      if(controls){ controls.enableDamping=true; controls.minDistance=2; controls.maxDistance=60; }

      scene.add(new THREE.AmbientLight(0xffffff,0.5));
      const sunLight=new THREE.PointLight(0xffeeaa, 2.5, 100);
      sunLight.position.set(0,0,0);
      scene.add(sunLight);

      const starGeo=new THREE.BufferGeometry();
      const starCount=2000;
      const starPos=new Float32Array(starCount*3);
      for(let i=0;i<starCount;i++){
        starPos[i*3]=(Math.random()-0.5)*200;
        starPos[i*3+1]=(Math.random()-0.5)*200;
        starPos[i*3+2]=(Math.random()-0.5)*200;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
      const starMat=new THREE.PointsMaterial({ color:0xffffff, size:0.35, sizeAttenuation:true });
      scene.add(new THREE.Points(starGeo, starMat));

      const sunGeo=new THREE.SphereGeometry(1.3,32,32);
      const sunMat=new THREE.MeshBasicMaterial({ color:0xf4d36c });
      const sun=new THREE.Mesh(sunGeo,sunMat);
      scene.add(sun);

      const planets=[
        { name:'mercury', radius:0.22, distance:2.8, period:0.24, color:0xaaaaaa, gravity:3.7, mission:'Mercury is tiny but has extreme temperature swings. Mission: survive a solar day (176 Earth days).' },
        { name:'venus', radius:0.42, distance:4.1, period:0.62, color:0xffcc88, gravity:8.87, mission:'Venus has crushing pressure. Mission: design a probe that lasts 2 hours.' },
        { name:'earth', radius:0.45, distance:5.5, period:1, color:0x4488ff, gravity:9.81, mission:'Earth – home. Mission: calculate orbital velocity: v = √(GM/r).' },
        { name:'mars', radius:0.32, distance:7.1, period:1.88, color:0xff6644, gravity:3.71, mission:'Mars has 38% gravity. Mission: plan a rocket launch with lower escape velocity.' },
        { name:'jupiter', radius:0.95, distance:9.5, period:11.86, color:0xffaa66, gravity:24.79, mission:'Jupiter is a gas giant. Mission: understand why it protects inner planets.' },
        { name:'saturn', radius:0.85, distance:12, period:29.46, color:0xddcc88, gravity:10.44, mission:'Saturn rings are ice. Mission: model ring particle orbits.' },
        { name:'uranus', radius:0.62, distance:14.5, period:84.01, color:0x88ccff, gravity:8.69, mission:'Uranus rotates sideways. Mission: explain axial tilt.' },
        { name:'neptune', radius:0.62, distance:17, period:164.8, color:0x4466ff, gravity:11.15, mission:'Neptune has supersonic winds. Mission: compute wind energy.' },
      ];

      const planetMeshes=[];
      planets.forEach(p=>{
        const geo=new THREE.SphereGeometry(p.radius,24,24);
        const mat=new THREE.MeshStandardMaterial({ color:p.color, roughness:0.6 });
        const mesh=new THREE.Mesh(geo,mat);
        mesh.userData=p;
        mesh.position.x=p.distance;
        planetMeshes.push(mesh);
        scene.add(mesh);

        const orbitGeo=new THREE.BufferGeometry();
        const points=[];
        for(let i=0;i<=64;i++){
          const ang=(i/64)*Math.PI*2;
          points.push(Math.cos(ang)*p.distance,0,Math.sin(ang)*p.distance);
        }
        orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(points,3));
        const orbitMat=new THREE.LineBasicMaterial({ color:0x90cce9, transparent:true, opacity:0.25 });
        const line=new THREE.Line(orbitGeo,orbitMat);
        line.userData.isOrbit=true;
        scene.add(line);
        p.orbitLine=line;
      });

      let showOrbits=true, gravityLab=false, rocket=null;

      function resize(){
        const rect=canvas.parentElement.getBoundingClientRect();
        if(rect.width<10 || rect.height<10) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect=rect.width/rect.height;
        camera.updateProjectionMatrix();
      }
      const ro=new ResizeObserver(resize);
      ro.observe(canvas.parentElement);
      window.addEventListener('resize', resize);
      resize();

      const orbitChartCanvas=container.querySelector('[data-role="orbit-chart"]');
      function drawOrbitChart(){
        const ctx=orbitChartCanvas.getContext('2d');
        const rect=orbitChartCanvas.getBoundingClientRect();
        if(rect.width<10) return;
        orbitChartCanvas.width=rect.width*2; orbitChartCanvas.height=rect.height*2;
        ctx.setTransform(2,0,0,2,0,0);
        const w=rect.width,h=rect.height;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle='#f6f2e6'; ctx.fillRect(0,0,w,h);
        ctx.strokeStyle='#101b29'; ctx.lineWidth=3; ctx.strokeRect(0,0,w,h);
        ctx.fillStyle='#101b29'; ctx.font='bold 11px sans-serif';
        ctx.fillText('Orbital period vs distance',10,14);
        const maxDist=Math.max(...planets.map(p=>p.distance));
        const maxPer=Math.max(...planets.map(p=>p.period));
        ctx.strokeStyle='#101b29'; ctx.lineWidth=3; ctx.beginPath();
        planets.forEach((p,i)=>{
          const x=(p.distance/maxDist)*(w-40)+20;
          const y=h-20 - (Math.log(p.period+0.1)/Math.log(maxPer+1))*(h-40);
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();
        planets.forEach(p=>{
          const x=(p.distance/maxDist)*(w-40)+20;
          const y=h-20 - (Math.log(p.period+0.1)/Math.log(maxPer+1))*(h-40);
          ctx.fillStyle='#101b29'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
        });
      }
      drawOrbitChart();
      window.addEventListener('resize', drawOrbitChart);

      const missionEl=container.querySelector('[data-role="mission"]');
      function setMission(name){
        const p=planets.find(pl=>pl.name===name);
        if(!p){ missionEl.innerHTML='<span class="muted">Select a planet to see its mission.</span>'; return; }
        missionEl.innerHTML=`<b>${p.name.toUpperCase()}</b><br/>Gravity: ${p.gravity} m/s²<br/>Distance: ${p.distance} AU scaled<br/>Period: ${p.period} Earth years<br/><br/>${p.mission}<br/><br/><button class="btn btn-sm" data-mission="calc">Calculate weight of 70kg person</button> <span data-role="weight-out" class="kbd"></span>`;
        missionEl.querySelector('[data-mission="calc"]')?.addEventListener('click', ()=>{
          const w=70*p.gravity;
          missionEl.querySelector('[data-role="weight-out"]').textContent=`${w.toFixed(1)} N`;
        });
      }
      setMission('earth');

      container.querySelector('[data-role="planet-select"]').addEventListener('change', e=>{
        const v=e.target.value;
        if(v==='all'){ planetMeshes.forEach(m=>m.visible=true); planets.forEach(p=>p.orbitLine.visible=showOrbits); setMission('earth'); }
        else {
          planetMeshes.forEach(m=>m.visible=m.userData.name===v);
          planets.forEach(p=>p.orbitLine.visible=(p.name===v && showOrbits));
          setMission(v);
        }
      });
      container.querySelector('[data-action="toggle-orbit"]').addEventListener('click', ()=>{
        showOrbits=!showOrbits;
        planets.forEach(p=>p.orbitLine.visible=showOrbits);
      });
      container.querySelector('[data-action="toggle-gravity"]').addEventListener('click', ()=>{
        gravityLab=!gravityLab;
        missionEl.innerHTML = gravityLab ? `<div class="banner banner-warn" style="margin:0">Gravity lab: F = G*m1*m2/r². Jump height ∝ 1/g.</div>` : '';
        if(!gravityLab) setMission(container.querySelector('[data-role="planet-select"]').value);
      });
      container.querySelector('[data-action="rocket"]').addEventListener('click', ()=>{
        if(rocket){ scene.remove(rocket); rocket=null; }
        const geo=new THREE.CylinderGeometry(0.06,0.06,0.5,12);
        const mat=new THREE.MeshStandardMaterial({ color:0xf6f2e6 });
        rocket=new THREE.Mesh(geo,mat);
        rocket.position.set(5.5,0.6,0);
        scene.add(rocket);
        let vy=0, y=0.6, fuel=100;
        const g=9.81;
        const interval=setInterval(()=>{
          if(fuel>0){ vy+=0.06; fuel-=1; } else { vy-=0.01*g*0.1; }
          y+=vy*0.06;
          rocket.position.y=y;
          rocket.rotation.z+=0.03;
          if(y>12){ clearInterval(interval); scene.remove(rocket); rocket=null; }
          if(y<0.5){ y=0.5; vy=0; }
        }, 50);
        missionEl.innerHTML=`<b>Rocket Lab</b><br/>Thrusting... fuel ${fuel}%<br/><span class="muted small">Escape velocity Earth ~11.2 km/s, Mars ~5 km/s.</span>`;
      });
      container.querySelector('[data-action="front-solar"]')?.addEventListener('click', ()=>{
        const wrap=canvas.parentElement;
        wrap.classList.toggle('front');
        document.querySelectorAll('.card').forEach(c=>{ if(c!==container.closest('.card')) c.classList.toggle('front-behind', wrap.classList.contains('front')); });
        setTimeout(resize,50);
      });
      container.querySelector('[data-action="reload-solar"]').addEventListener('click', async ()=>{
        if(raf) cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('resize', resize);
        renderer.dispose();
        await Science.initSolarSystem(container);
      });

      let raf=null;
      const clock=new THREE.Clock();
      function animate(){
        raf=requestAnimationFrame(animate);
        const t=clock.getElapsedTime()*0.3;
        planetMeshes.forEach(m=>{
          const p=m.userData;
          const ang=(t / p.period)*Math.PI*2;
          m.position.x=Math.cos(ang)*p.distance;
          m.position.z=Math.sin(ang)*p.distance;
          m.rotation.y+=0.012;
        });
        sun.rotation.y+=0.002;
        if(controls) controls.update();
        renderer.render(scene,camera);
      }
      animate();

      return {
        destroy(){ if(raf) cancelAnimationFrame(raf); try{ ro.disconnect(); }catch{} window.removeEventListener('resize', resize); window.removeEventListener('resize', drawOrbitChart); try{ renderer.dispose(); }catch{} },
        resize
      };
    }catch(err){
      console.error('solar system error',err);
      logEl.style.display='block';
      logEl.textContent='3D failed: '+err.message;
      return { destroy(){} };
    }
  }
};
