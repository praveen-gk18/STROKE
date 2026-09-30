/**
 * science.js – periodic table, atom viewer, molecule explorer, solar system
 */

export const Science = {
  async initPeriodic(container, onSelect) {
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

    // create 118 slots with positioning
    // simplified layout: we use grid 18 columns, but lanthanides/actinides separate
    // For simplicity, just render in order but with gaps via empty divs
    const posMap = {};
    // approximate positions
    elements.forEach(el=>{
      const div=document.createElement('div');
      div.className='elem';
      div.dataset.number=el.number;
      div.innerHTML=`<span>${el.number}</span><span class="sym">${el.symbol}</span><span>${el.name.slice(0,4)}</span>`;
      div.style.borderLeft=`3px solid ${categories[el.category]||'#666'}`;
      div.title=`${el.name} (${el.symbol}) #${el.number}`;
      div.addEventListener('click', ()=>{
        table.querySelectorAll('.elem').forEach(e=>e.classList.remove('selected'));
        div.classList.add('selected');
        if(onSelect) onSelect(el);
      });
      table.appendChild(div);
    });

    container.innerHTML='';
    container.appendChild(table);

    // also return list
    return elements;
  },

  async initAtomViewer(container, element) {
    // Three.js atom view – nucleus + electrons in shells
    container.innerHTML = `<div class="canvas-wrap atom-view"><canvas></canvas></div>
      <div class="card card-cream" style="margin-top:12px"><h3>${element.name} (${element.symbol})</h3>
      <p class="muted">Atomic #${element.number} – Mass ${element.mass} – ${element.category}<br/>
      Config: ${element.electronConfig} – Discovered: ${element.discovered}</p>
      <p class="muted small">Electrons arranged in shells. Three.js atom model with orbiting electrons. Drag to orbit, scroll to zoom.</p></div>`;
    const canvas = container.querySelector('canvas');
    // Wait for container to be visible (tabs)
    for(let i=0;i<10;i++){
      const rect=canvas.parentElement.getBoundingClientRect();
      if(rect.width>50 && rect.height>50) break;
      await new Promise(r=>setTimeout(r,150));
    }

    const { default: THREE } = await import('/vendor/three.module.js');
    // Use dynamic import for OrbitControls
    let OrbitControls;
    try {
      const mod = await import('/vendor/OrbitControls.js');
      OrbitControls = mod.OrbitControls;
    } catch { OrbitControls=null; }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(window.devicePixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0e1422');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 2, 6);
    const controls = OrbitControls ? new OrbitControls(camera, renderer.domElement) : null;
    if (controls) { controls.enableDamping=true; }

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2,3,2);
    scene.add(dir);

    // nucleus
    const nucleusGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const nucleusMat = new THREE.MeshStandardMaterial({ color: 0xff7ae8, emissive: 0x441133, roughness:0.3 });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    scene.add(nucleus);

    // electrons – parse electron config roughly to get total electrons = atomic number
    const totalElectrons = element.number;
    // simple shell distribution 2,8,18,32...
    const shells = [];
    let remaining = totalElectrons;
    const shellCaps = [2,8,18,32,32,18,8];
    for (let cap of shellCaps) {
      if (remaining<=0) break;
      const take = Math.min(cap, remaining);
      shells.push(take);
      remaining -= take;
    }

    const electronGroups = [];
    shells.forEach((count, shellIdx)=>{
      const radius = 0.8 + shellIdx*0.6;
      // shell ring
      const ringGeo = new THREE.TorusGeometry(radius, 0.01, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x6cf, transparent:true, opacity:0.15 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI/2 + (shellIdx*0.2);
      scene.add(ring);

      for(let i=0;i<count;i++){
        const geo = new THREE.SphereGeometry(0.07, 12,12);
        const mat = new THREE.MeshStandardMaterial({ color: 0x8af5ff, emissive:0x113344 });
        const mesh = new THREE.Mesh(geo, mat);
        const angle = (i/count)*Math.PI*2 + shellIdx;
        mesh.userData = { radius, angle, speed: 0.5 + Math.random()*0.5 + shellIdx*0.1, shellIdx };
        electronGroups.push(mesh);
        scene.add(mesh);
      }
    });

    function resize(){
      const rect = canvas.parentElement.getBoundingClientRect();
      const w=rect.width, h=rect.height;
      renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    let raf;
    const clock = new THREE.Clock();
    function animate(){
      raf=requestAnimationFrame(animate);
      const t=clock.getElapsedTime();
      electronGroups.forEach(e=>{
        e.userData.angle += 0.01*e.userData.speed;
        const r=e.userData.radius;
        const shellTilt = e.userData.shellIdx*0.3;
        e.position.x = Math.cos(e.userData.angle + shellTilt)*r;
        e.position.z = Math.sin(e.userData.angle + shellTilt)*r;
        e.position.y = Math.sin(e.userData.angle*0.7 + e.userData.shellIdx)*0.2;
      });
      nucleus.rotation.y += 0.005;
      if(controls) controls.update();
      renderer.render(scene,camera);
    }
    animate();

    return { destroy(){ cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); } };
  },

  async initMoleculeExplorer(container) {
    container.innerHTML = `
      <div class="toolbar">
        <select data-role="mol-select" class="input-arcade" style="flex:1;max-width:200px">
          <option value="water">Water H2O</option>
          <option value="methane">Methane CH4</option>
          <option value="co2">Carbon Dioxide CO2</option>
          <option value="benzene">Benzene C6H6</option>
          <option value="dna">DNA fragment</option>
        </select>
        <button class="btn btn-sm" data-action="spin">Toggle spin</button>
        <button class="btn btn-sm" data-action="explode">Explode / Assemble</button>
      </div>
      <div class="canvas-wrap molecule-view"><canvas></canvas></div>
      <p class="muted small">Three.js molecule explorer – atoms as spheres, bonds as cylinders. Orbit to inspect. If blank, switch tabs and back – it will resize.</p>
    `;
    const canvas = container.querySelector('canvas');
    const select = container.querySelector('[data-role="mol-select"]');
    for(let i=0;i<10;i++){
      const rect=canvas.parentElement.getBoundingClientRect();
      if(rect.width>50) break;
      await new Promise(r=>setTimeout(r,150));
    }

    const THREE = (await import('/vendor/three.module.js')).default;
    let OrbitControls;
    try { OrbitControls = (await import('/vendor/OrbitControls.js')).OrbitControls; } catch {}

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(window.devicePixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0e1422');
    const camera = new THREE.PerspectiveCamera(45,1,0.1,100);
    camera.position.set(0,2,6);
    const controls = OrbitControls ? new OrbitControls(camera, renderer.domElement) : null;
    if (controls) controls.enableDamping=true;

    scene.add(new THREE.AmbientLight(0xffffff,0.7));
    const dl = new THREE.DirectionalLight(0xffffff,0.8); dl.position.set(2,3,2); scene.add(dl);

    let group = new THREE.Group();
    scene.add(group);
    let spinning=true, exploded=false;

    const atomColors = { H:0xffffff, O:0xff5555, C:0x444444, N:0x5555ff, P:0xffaa00 };

    function clearGroup(){
      while(group.children.length) group.remove(group.children[0]);
    }

    function atom(pos, element){
      const geo = new THREE.SphereGeometry(element==='H'?0.25:0.4, 24,24);
      const mat = new THREE.MeshStandardMaterial({ color: atomColors[element]||0x8af5ff, roughness:0.3 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      m.userData.originalPos = pos.clone();
      group.add(m);
      return m;
    }
    function bond(a,b){
      const dir = new THREE.Vector3().subVectors(b,a);
      const len = dir.length();
      const geo = new THREE.CylinderGeometry(0.05,0.05,len,12);
      const mat = new THREE.MeshStandardMaterial({ color:0x9aa8bd });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      mesh.userData.originalPos = mesh.position.clone();
      mesh.userData.isBond=true;
      mesh.userData.a=a.clone(); mesh.userData.b=b.clone();
      group.add(mesh);
      return mesh;
    }

    function buildWater(){
      clearGroup();
      const oPos = new THREE.Vector3(0,0,0);
      const h1 = new THREE.Vector3(0.7,0.5,0);
      const h2 = new THREE.Vector3(-0.7,0.5,0);
      atom(oPos,'O'); atom(h1,'H'); atom(h2,'H');
      bond(oPos,h1); bond(oPos,h2);
    }
    function buildMethane(){
      clearGroup();
      const c = new THREE.Vector3(0,0,0);
      atom(c,'C');
      const positions=[new THREE.Vector3(0.8,0.8,0.8),new THREE.Vector3(-0.8,-0.8,0.8),new THREE.Vector3(-0.8,0.8,-0.8),new THREE.Vector3(0.8,-0.8,-0.8)];
      positions.forEach(p=>{ atom(p,'H'); bond(c,p); });
    }
    function buildCO2(){
      clearGroup();
      const c=new THREE.Vector3(0,0,0);
      const o1=new THREE.Vector3(1.2,0,0), o2=new THREE.Vector3(-1.2,0,0);
      atom(c,'C'); atom(o1,'O'); atom(o2,'O');
      bond(c,o1); bond(c,o2);
    }
    function buildBenzene(){
      clearGroup();
      const r=1.2;
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
        const hPos = a.clone().multiplyScalar(1.5);
        atom(hPos,'H'); bond(a,hPos);
      }
    }
    function buildDNA(){
      clearGroup();
      // simple double helix fragment
      for(let i=0;i<10;i++){
        const y=i*0.4-2;
        const ang=i*0.6;
        const x1=Math.cos(ang)*0.8, z1=Math.sin(ang)*0.8;
        const x2=Math.cos(ang+Math.PI)*0.8, z2=Math.sin(ang+Math.PI)*0.8;
        const p1=new THREE.Vector3(x1,y,z1), p2=new THREE.Vector3(x2,y,z2);
        atom(p1,i%2?'P':'C'); atom(p2,i%2?'C':'P');
        if(i>0){
          const prevY=(i-1)*0.4-2;
          const prevAng=(i-1)*0.6;
          const px1=Math.cos(prevAng)*0.8, pz1=Math.sin(prevAng)*0.8;
          bond(new THREE.Vector3(px1,prevY,pz1), p1);
          const px2=Math.cos(prevAng+Math.PI)*0.8, pz2=Math.sin(prevAng+Math.PI)*0.8;
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
          const dir=ch.userData.originalPos.clone().normalize().multiplyScalar(1.5);
          ch.position.copy(ch.userData.originalPos.clone().add(dir));
        } else {
          ch.position.copy(ch.userData.originalPos);
          if(ch.userData.isBond){
            // recenter bond
            const mid=new THREE.Vector3().addVectors(ch.userData.a, ch.userData.b).multiplyScalar(0.5);
            ch.position.copy(mid);
          }
        }
      });
    });

    function resize(){
      const rect=canvas.parentElement.getBoundingClientRect();
      renderer.setSize(rect.width,rect.height,false);
      camera.aspect=rect.width/rect.height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    let raf;
    function animate(){
      raf=requestAnimationFrame(animate);
      if(spinning) group.rotation.y+=0.005;
      if(controls) controls.update();
      renderer.render(scene,camera);
    }
    animate();

    return { destroy(){ cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); } };
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
        <button class="btn btn-sm btn-primary" data-action="rocket">Rocket launch lab</button>
      </div>
      <div class="canvas-wrap solar-view"><canvas></canvas></div>
      <div class="grid2" style="margin-top:12px">
        <div class="card card-cream"><h4>Orbit comparison</h4><canvas data-role="orbit-chart" height="120"></canvas></div>
        <div class="card card-cream"><h4>Planet mission</h4><div data-role="mission"></div></div>
      </div>
    `;
    const canvas = container.querySelector('canvas');
    for(let i=0;i<10;i++){
      const rect=canvas.parentElement.getBoundingClientRect();
      if(rect.width>50) break;
      await new Promise(r=>setTimeout(r,150));
    }
    const THREE = (await import('/vendor/three.module.js')).default;
    let OrbitControls;
    try { OrbitControls = (await import('/vendor/OrbitControls.js')).OrbitControls; } catch {}

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(window.devicePixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050a14');
    const camera = new THREE.PerspectiveCamera(50,1,0.1,1000);
    camera.position.set(0,12,18);
    const controls = OrbitControls ? new OrbitControls(camera, renderer.domElement) : null;
    if (controls) { controls.enableDamping=true; controls.minDistance=2; controls.maxDistance=50; }

    scene.add(new THREE.AmbientLight(0xffffff,0.4));
    const sunLight = new THREE.PointLight(0xffeeaa, 2, 100);
    sunLight.position.set(0,0,0);
    scene.add(sunLight);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starCount=2000;
    const starPos=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){
      starPos[i*3]=(Math.random()-0.5)*200;
      starPos[i*3+1]=(Math.random()-0.5)*200;
      starPos[i*3+2]=(Math.random()-0.5)*200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,3));
    const starMat=new THREE.PointsMaterial({ color:0xffffff, size:0.3, sizeAttenuation:true });
    scene.add(new THREE.Points(starGeo, starMat));

    // sun
    const sunGeo=new THREE.SphereGeometry(1.2,32,32);
    const sunMat=new THREE.MeshBasicMaterial({ color:0xffcc33 });
    const sun=new THREE.Mesh(sunGeo,sunMat);
    scene.add(sun);

    const planets = [
      { name:'mercury', radius:0.2, distance:2.5, period:0.24, color:0xaaaaaa, gravity:3.7, mission:'Mercury is tiny but has extreme temperature swings. Mission: survive a solar day (176 Earth days).' },
      { name:'venus', radius:0.4, distance:3.8, period:0.62, color:0xffcc88, gravity:8.87, mission:'Venus has crushing pressure. Mission: design a probe that lasts 2 hours.' },
      { name:'earth', radius:0.42, distance:5.2, period:1, color:0x4488ff, gravity:9.81, mission:'Earth – home. Mission: calculate orbital velocity: v = √(GM/r).' },
      { name:'mars', radius:0.3, distance:6.8, period:1.88, color:0xff6644, gravity:3.71, mission:'Mars has 38% gravity. Mission: plan a rocket launch with lower escape velocity.' },
      { name:'jupiter', radius:0.9, distance:9, period:11.86, color:0xffaa66, gravity:24.79, mission:'Jupiter is a gas giant. Mission: understand why it protects inner planets.' },
      { name:'saturn', radius:0.8, distance:11.5, period:29.46, color:0xddcc88, gravity:10.44, mission:'Saturn rings are ice. Mission: model ring particle orbits.' },
      { name:'uranus', radius:0.6, distance:14, period:84.01, color:0x88ccff, gravity:8.69, mission:'Uranus rotates sideways. Mission: explain axial tilt.' },
      { name:'neptune', radius:0.6, distance:16.5, period:164.8, color:0x4466ff, gravity:11.15, mission:'Neptune has supersonic winds. Mission: compute wind energy.' },
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

      // orbit line
      const orbitGeo=new THREE.BufferGeometry();
      const points=[];
      for(let i=0;i<=64;i++){
        const ang=(i/64)*Math.PI*2;
        points.push(Math.cos(ang)*p.distance,0,Math.sin(ang)*p.distance);
      }
      orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(points,3));
      const orbitMat=new THREE.LineBasicMaterial({ color:0x6cf, transparent:true, opacity:0.2 });
      const line=new THREE.Line(orbitGeo,orbitMat);
      line.userData.isOrbit=true;
      scene.add(line);
      p.orbitLine=line;
    });

    let showOrbits=true, gravityLab=false, rocket=null;

    function resize(){
      const rect=canvas.parentElement.getBoundingClientRect();
      renderer.setSize(rect.width,rect.height,false);
      camera.aspect=rect.width/rect.height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    // orbit chart
    const orbitChartCanvas=container.querySelector('[data-role="orbit-chart"]');
    function drawOrbitChart(){
      const ctx=orbitChartCanvas.getContext('2d');
      const rect=orbitChartCanvas.getBoundingClientRect();
      orbitChartCanvas.width=rect.width*2; orbitChartCanvas.height=rect.height*2;
      ctx.setTransform(2,0,0,2,0,0);
      const w=rect.width,h=rect.height;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle='#0e1422'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#9aa8bd'; ctx.font='11px monospace';
      ctx.fillText('Orbital period vs distance (log)',10,14);
      // simple plot
      const maxDist=Math.max(...planets.map(p=>p.distance));
      const maxPer=Math.max(...planets.map(p=>p.period));
      ctx.strokeStyle='#6cf'; ctx.beginPath();
      planets.forEach((p,i)=>{
        const x=(p.distance/maxDist)*(w-40)+20;
        const y=h-20 - (Math.log(p.period+0.1)/Math.log(maxPer+1))*(h-40);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#9aa8bd'; ctx.fillText(p.name[0],x-3,y-6);
      });
      ctx.stroke();
    }
    drawOrbitChart();

    const missionEl=container.querySelector('[data-role="mission"]');
    function setMission(name){
      const p=planets.find(pl=>pl.name===name);
      if(!p){ missionEl.innerHTML='<span class="muted">Select a planet to see its mission.</span>'; return; }
      missionEl.innerHTML=`<b>${p.name.toUpperCase()}</b><br/>Gravity: ${p.gravity} m/s²<br/>Distance: ${p.distance} AU scaled<br/>Period: ${p.period} Earth years<br/><br/>${p.mission}<br/><br/><button class="btn" data-mission="calc">Calculate weight of 70kg person</button> <span data-role="weight-out" class="kbd"></span>`;
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
      missionEl.innerHTML = gravityLab ? `<div class="sync-warning">Gravity lab: F = G*m1*m2/r². Try different planets – gravity changes jump height. Jump height ∝ 1/g.</div>` : '';
      if(!gravityLab) setMission(container.querySelector('[data-role="planet-select"]').value);
    });

    container.querySelector('[data-action="rocket"]').addEventListener('click', ()=>{
      // simple rocket launch simulation
      if(rocket) { scene.remove(rocket); rocket=null; }
      const geo=new THREE.CylinderGeometry(0.05,0.05,0.4,12);
      const mat=new THREE.MeshStandardMaterial({ color:0xffffff });
      rocket=new THREE.Mesh(geo,mat);
      rocket.position.set(5.2,0.5,0); // earth position
      scene.add(rocket);
      let vy=0, y=0.5, fuel=100;
      const g=9.81;
      const interval=setInterval(()=>{
        if(fuel>0){ vy+=0.05; fuel-=1; } else { vy-=0.01*g*0.1; }
        y+=vy*0.05;
        rocket.position.y=y;
        rocket.rotation.z+=0.02;
        if(y>10){ clearInterval(interval); scene.remove(rocket); rocket=null; }
        if(y<0.4){ y=0.4; vy=0; }
      }, 50);
      missionEl.innerHTML=`<b>Rocket Lab</b><br/>Thrusting... fuel ${fuel}%<br/><span class="muted">Escape velocity from Earth ~11.2 km/s, from Mars ~5 km/s. Our scaled sim shows fuel burn vs gravity.</span>`;
    });

    let raf;
    const clock=new (await import('/vendor/three.module.js')).default.Clock();
    function animate(){
      raf=requestAnimationFrame(animate);
      const t=clock.getElapsedTime()*0.3;
      planetMeshes.forEach(m=>{
        const p=m.userData;
        const ang=(t / p.period)*Math.PI*2;
        m.position.x=Math.cos(ang)*p.distance;
        m.position.z=Math.sin(ang)*p.distance;
        m.rotation.y+=0.01;
      });
      sun.rotation.y+=0.001;
      if(controls) controls.update();
      renderer.render(scene,camera);
    }
    animate();

    return { destroy(){ cancelAnimationFrame(raf); window.removeEventListener('resize', resize); renderer.dispose(); } };
  }
};
