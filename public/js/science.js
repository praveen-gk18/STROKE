/**
 * science.js – robust Three.js labs – guaranteed visible
 */

function hasWebGL(){
  try{
    const c=document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  }catch{ return false; }
}
async function waitVisible(el){
  for(let i=0;i<30;i++){
    const r=el.getBoundingClientRect();
    if(r.width>100 && r.height>100) return r;
    await new Promise(res=>setTimeout(res,100));
  }
  return el.getBoundingClientRect();
}

export const Science = {
  async initPeriodic(container, onSelect){
    try{
      const r=await fetch('/data/elements.json');
      const elements=await r.json();
      const colors={
        'alkali metal':'#ff9e9c',
        'alkaline earth metal':'#f4d36c',
        'transition metal':'#90cce9',
        'post-transition metal':'#b8a4ef',
        'metalloid':'#adf075',
        'nonmetal':'#adf075',
        'halogen':'#ff9e9c',
        'noble gas':'#90cce9',
        'lanthanide':'#f4d36c',
        'actinide':'#ff9e9c'
      };
      const table=document.createElement('div');
      table.className='periodic';
      elements.forEach(el=>{
        const d=document.createElement('button');
        d.className='elem';
        d.type='button';
        d.innerHTML=`<span style="font-size:.65rem">${el.number}</span><span class="sym">${el.symbol}</span><span style="font-size:.6rem">${el.name.slice(0,5)}</span>`;
        d.style.background=colors[el.category]||'#f6f2e6';
        d.title=`${el.name} – ${el.category}`;
        d.addEventListener('click',()=>{
          table.querySelectorAll('.elem').forEach(e=>e.classList.remove('selected'));
          d.classList.add('selected');
          if(onSelect) onSelect(el);
        });
        table.appendChild(d);
      });
      container.innerHTML='';
      container.appendChild(table);
      return elements;
    }catch(e){
      container.innerHTML=`<div class="banner banner-warn">Periodic table failed: ${e.message}</div>`;
      return [];
    }
  },

  async initAtomViewer(container, element){
    container.innerHTML=`
      <div class="canvas-wrap atom-view front" style="background:#101b29;border:4px solid #101b29">
        <canvas style="background:#101b29"></canvas>
        <div style="position:absolute;top:8px;left:8px;z-index:30;background:#f6f2e6;border:3px solid #101b29;border-radius:999px;padding:4px 10px;font-weight:900;font-size:.8rem;box-shadow:3px 3px 0 #101b29">3D ATOM – ${element.symbol}</div>
      </div>
      <div class="card card-cream" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <h3 style="margin:0">${element.name} (${element.symbol}) #${element.number}</h3>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" data-action="front-atom">⬆ Front</button>
            <button class="btn btn-sm btn-primary" data-action="reload-atom">Reload 3D</button>
          </div>
        </div>
        <p class="muted small">Mass ${element.mass} – ${element.category} – ${element.electronConfig}<br/>Drag to orbit, scroll to zoom. If blank, click Reload 3D. Canvas is forced to front (z-index 9999) so UI doesn't hide it.</p>
        <div data-role="atom-log" class="log" style="display:none"></div>
      </div>`;
    const wrap=container.querySelector('.canvas-wrap');
    const canvas=container.querySelector('canvas');
    const log=container.querySelector('[data-role="atom-log"]');
    const reloadBtn=container.querySelector('[data-action="reload-atom"]');
    const frontBtn=container.querySelector('[data-action="front-atom"]');

    await waitVisible(wrap);

    function showLog(msg){
      log.style.display='block';
      log.textContent=msg;
    }

    if(!hasWebGL()){
      showLog('WebGL not available – 2D fallback');
      const ctx=canvas.getContext('2d');
      const rect=wrap.getBoundingClientRect();
      canvas.width=rect.width*2; canvas.height=rect.height*2;
      ctx.setTransform(2,0,0,2,0,0);
      ctx.fillStyle='#101b29'; ctx.fillRect(0,0,rect.width,rect.height);
      ctx.fillStyle='#adf075'; ctx.beginPath(); ctx.arc(rect.width/2,rect.height/2,40,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#101b29'; ctx.font='900 14px sans-serif'; ctx.fillText(element.symbol,rect.width/2-10,rect.height/2+5);
      return { destroy(){} };
    }

    try{
      const THREE=(await import('three')).default;
      let OrbitControls=null;
      try{ OrbitControls=(await import('/vendor/OrbitControls.js')).OrbitControls; }catch{}

      // Force visible size
      const rect=wrap.getBoundingClientRect();
      canvas.width=rect.width; canvas.height=rect.height;
      canvas.style.width=rect.width+'px'; canvas.style.height=rect.height+'px';

      const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.setClearColor(0x101b29,1);

      const scene=new THREE.Scene();
      scene.background=new THREE.Color(0x101b29);

      const camera=new THREE.PerspectiveCamera(50, rect.width/rect.height, 0.1, 100);
      camera.position.set(0,3,7);

      const controls=OrbitControls? new OrbitControls(camera, renderer.domElement):null;
      if(controls){ controls.enableDamping=true; controls.target.set(0,0,0); }

      // Lights – bright for visibility
      scene.add(new THREE.AmbientLight(0xffffff,1.2));
      const dl=new THREE.DirectionalLight(0xffffff,1); dl.position.set(3,5,4); scene.add(dl);
      const dl2=new THREE.DirectionalLight(0xadf075,0.6); dl2.position.set(-3,-2,2); scene.add(dl2);

      // Nucleus – big, bright, emissive
      const nucGeo=new THREE.SphereGeometry(0.6,32,32);
      const nucMat=new THREE.MeshStandardMaterial({ color:0xff9e9c, emissive:0xff9e9c, emissiveIntensity:0.4, roughness:0.3 });
      const nucleus=new THREE.Mesh(nucGeo,nucMat);
      scene.add(nucleus);

      // Electrons – bright mint and sky
      const total=element.number;
      const caps=[2,8,18,32,32,18,8];
      const shells=[];
      let rem=total;
      for(let c of caps){ if(rem<=0) break; const take=Math.min(c,rem); shells.push(take); rem-=take; }

      const electrons=[];
      shells.forEach((count, sIdx)=>{
        const radius=1.1 + sIdx*0.75;
        // Ring
        const ringGeo=new THREE.TorusGeometry(radius,0.02,8,64);
        const ringMat=new THREE.MeshBasicMaterial({ color:0xf6f2e6, transparent:true, opacity:0.25 });
        const ring=new THREE.Mesh(ringGeo,ringMat);
        ring.rotation.x=Math.PI/2 + sIdx*0.3;
        scene.add(ring);
        for(let i=0;i<count;i++){
          const geo=new THREE.SphereGeometry(0.12,16,16);
          const mat=new THREE.MeshStandardMaterial({ 
            color: sIdx%2===0?0xadf075:0x90cce9, 
            emissive: sIdx%2===0?0xadf075:0x90cce9, 
            emissiveIntensity:0.5 
          });
          const m=new THREE.Mesh(geo,mat);
          m.userData={ radius, angle:(i/count)*Math.PI*2 + sIdx, speed:0.8+Math.random()*0.5 };
          electrons.push(m);
          scene.add(m);
        }
      });

      function resize(){
        const r=wrap.getBoundingClientRect();
        if(r.width<50 || r.height<50) return;
        renderer.setSize(r.width, r.height, true);
        camera.aspect=r.width/r.height;
        camera.updateProjectionMatrix();
      }
      const ro=new ResizeObserver(resize);
      ro.observe(wrap);
      window.addEventListener('resize', resize);
      resize();

      let raf=null;
      const clock=new THREE.Clock();
      function animate(){
        raf=requestAnimationFrame(animate);
        electrons.forEach(e=>{
          e.userData.angle+=0.02*e.userData.speed;
          e.position.x=Math.cos(e.userData.angle)*e.userData.radius;
          e.position.z=Math.sin(e.userData.angle)*e.userData.radius;
          e.position.y=Math.sin(e.userData.angle*0.8)*0.3;
        });
        nucleus.rotation.y+=0.01;
        nucleus.rotation.x+=0.005;
        if(controls) controls.update();
        renderer.render(scene,camera);
      }
      animate();
      showLog(`✅ 3D Atom ${element.symbol} – ${electrons.length} electrons – drag to orbit, scroll to zoom – canvas ${Math.round(wrap.getBoundingClientRect().width)}x${Math.round(wrap.getBoundingClientRect().height)} – renderer in front (z-index 9999)`);

      frontBtn.addEventListener('click', ()=>{
        wrap.classList.toggle('front');
        document.querySelectorAll('.card').forEach(c=>{
          if(c!==container.closest('.card') && !c.closest('.canvas-wrap')) c.classList.toggle('front-behind', wrap.classList.contains('front'));
        });
        setTimeout(resize,100);
      });
      reloadBtn.addEventListener('click', async ()=>{
        if(raf) cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('resize', resize);
        renderer.dispose();
        await Science.initAtomViewer(container, element);
      });

      return {
        destroy(){ if(raf) cancelAnimationFrame(raf); try{ ro.disconnect(); }catch{} window.removeEventListener('resize', resize); try{ renderer.dispose(); }catch{} },
        resize
      };
    }catch(err){
      console.error('atom viewer failed',err);
      showLog('❌ 3D failed: '+err.message+'\n'+err.stack);
      return { destroy(){} };
    }
  },

  async initMoleculeExplorer(container){
    container.innerHTML=`
      <div class="toolbar">
        <select data-role="mol-select" class="input-arcade" style="flex:1;max-width:200px">
          <option value="water">Water H2O</option>
          <option value="methane">Methane CH4</option>
          <option value="co2">CO2</option>
          <option value="benzene">Benzene</option>
          <option value="dna">DNA</option>
        </select>
        <button class="btn btn-sm" data-action="spin">Spin</button>
        <button class="btn btn-sm" data-action="explode">Explode</button>
        <button class="btn btn-sm" data-action="front-mol">⬆ Front</button>
        <button class="btn btn-sm btn-primary" data-action="reload-mol">Reload 3D</button>
      </div>
      <div class="canvas-wrap molecule-view front" style="background:#101b29"><canvas></canvas><div style="position:absolute;top:8px;left:8px;z-index:30;background:#adf075;border:3px solid #101b29;border-radius:999px;padding:4px 10px;font-weight:900;font-size:.8rem;box-shadow:3px 3px 0 #101b29">3D MOLECULE</div></div>
      <div data-role="mol-log" class="log" style="margin-top:8px"></div>
    `;
    const wrap=container.querySelector('.canvas-wrap');
    const canvas=wrap.querySelector('canvas');
    const select=container.querySelector('[data-role="mol-select"]');
    const log=container.querySelector('[data-role="mol-log"]');

    await waitVisible(wrap);
    if(!hasWebGL()){ log.textContent='WebGL not available'; return { destroy(){} }; }

    try{
      const THREE=(await import('three')).default;
      let OrbitControls=null; try{ OrbitControls=(await import('/vendor/OrbitControls.js')).OrbitControls; }catch{}
      const rect=wrap.getBoundingClientRect();
      canvas.width=rect.width; canvas.height=rect.height;
      canvas.style.width=rect.width+'px'; canvas.style.height=rect.height+'px';

      const renderer=new THREE.WebGLRenderer({ canvas, antialias:true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.setClearColor(0x101b29,1);
      const scene=new THREE.Scene(); scene.background=new THREE.Color(0x101b29);
      const camera=new THREE.PerspectiveCamera(45, rect.width/rect.height, 0.1, 100); camera.position.set(0,2,6);
      const controls=OrbitControls? new OrbitControls(camera, renderer.domElement):null; if(controls) controls.enableDamping=true;
      scene.add(new THREE.AmbientLight(0xffffff,1));
      const dl=new THREE.DirectionalLight(0xffffff,1); dl.position.set(2,3,2); scene.add(dl);

      let group=new THREE.Group(); scene.add(group);
      let spinning=true, exploded=false;
      const colors={ H:0xf6f2e6, O:0xff9e9c, C:0x101b29, N:0x90cce9, P:0xf4d36c };
      function clear(){ while(group.children.length) group.remove(group.children[0]); }
      function atom(pos, el){
        const geo=new THREE.SphereGeometry(el==='H'?0.32:0.5,24,24);
        const mat=new THREE.MeshStandardMaterial({ color:colors[el]||0xadf075, roughness:0.3, emissive:colors[el]||0xadf075, emissiveIntensity:0.2 });
        const m=new THREE.Mesh(geo,mat); m.position.copy(pos); m.userData.originalPos=pos.clone(); group.add(m); return m;
      }
      function bond(a,b){
        const dir=new THREE.Vector3().subVectors(b,a); const len=dir.length();
        const geo=new THREE.CylinderGeometry(0.07,0.07,len,12);
        const mat=new THREE.MeshStandardMaterial({ color:0xf6f2e6 });
        const mesh=new THREE.Mesh(geo,mat);
        mesh.position.copy(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
        mesh.userData.originalPos=mesh.position.clone(); mesh.userData.isBond=true; mesh.userData.a=a.clone(); mesh.userData.b=b.clone();
        group.add(mesh);
      }
      function water(){ clear(); const o=new THREE.Vector3(0,0,0), h1=new THREE.Vector3(0.9,0.7,0), h2=new THREE.Vector3(-0.9,0.7,0); atom(o,'O'); atom(h1,'H'); atom(h2,'H'); bond(o,h1); bond(o,h2); }
      function methane(){ clear(); const c=new THREE.Vector3(0,0,0); atom(c,'C'); [new THREE.Vector3(1,1,1),new THREE.Vector3(-1,-1,1),new THREE.Vector3(-1,1,-1),new THREE.Vector3(1,-1,-1)].forEach(p=>{ const v=p.clone().normalize().multiplyScalar(1.2); atom(v,'H'); bond(c,v); }); }
      function co2(){ clear(); const c=new THREE.Vector3(0,0,0), o1=new THREE.Vector3(1.4,0,0), o2=new THREE.Vector3(-1.4,0,0); atom(c,'C'); atom(o1,'O'); atom(o2,'O'); bond(c,o1); bond(c,o2); }
      function benzene(){ clear(); const r=1.4, pts=[]; for(let i=0;i<6;i++){ const a=(i/6)*Math.PI*2, p=new THREE.Vector3(Math.cos(a)*r, Math.sin(a)*r,0); pts.push(p); atom(p,'C'); } for(let i=0;i<6;i++){ const a=pts[i], b=pts[(i+1)%6]; bond(a,b); const h=a.clone().multiplyScalar(1.7); atom(h,'H'); bond(a,h); } }
      function dna(){ clear(); for(let i=0;i<10;i++){ const y=i*0.5-2.2, ang=i*0.7, x1=Math.cos(ang), z1=Math.sin(ang), x2=Math.cos(ang+Math.PI), z2=Math.sin(ang+Math.PI); const p1=new THREE.Vector3(x1,y,z1), p2=new THREE.Vector3(x2,y,z2); atom(p1,i%2?'P':'C'); atom(p2,i%2?'C':'P'); if(i>0){ const py=(i-1)*0.5-2.2, pa=(i-1)*0.7; bond(new THREE.Vector3(Math.cos(pa),py,Math.sin(pa)), p1); bond(new THREE.Vector3(Math.cos(pa+Math.PI),py,Math.sin(pa+Math.PI)), p2); } if(i%2===0) bond(p1,p2); } }
      const builders={ water, methane, co2, benzene, dna };
      function rebuild(){ (builders[select.value]||water)(); log.textContent=`✅ 3D Molecule ${select.value} – drag to orbit, scroll to zoom – in front of UI`; }
      rebuild(); select.addEventListener('change', rebuild);
      container.querySelector('[data-action="spin"]').addEventListener('click', ()=> spinning=!spinning);
      container.querySelector('[data-action="explode"]').addEventListener('click', ()=>{
        exploded=!exploded;
        group.children.forEach(ch=>{ if(!ch.userData.originalPos) return; if(exploded){ const dir=ch.userData.originalPos.clone().normalize().multiplyScalar(1.3); ch.position.copy(ch.userData.originalPos.clone().add(dir)); }else{ ch.position.copy(ch.userData.originalPos); if(ch.userData.isBond){ const mid=new THREE.Vector3().addVectors(ch.userData.a,ch.userData.b).multiplyScalar(0.5); ch.position.copy(mid); } } });
      });
      container.querySelector('[data-action="front-mol"]').addEventListener('click', ()=>{ wrap.classList.toggle('front'); setTimeout(resize,50); });
      container.querySelector('[data-action="reload-mol"]').addEventListener('click', async ()=>{ if(raf) cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize',resize); renderer.dispose(); await Science.initMoleculeExplorer(container); });

      function resize(){ const r=wrap.getBoundingClientRect(); if(r.width<50) return; renderer.setSize(r.width,r.height,true); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); }
      const ro=new ResizeObserver(resize); ro.observe(wrap); window.addEventListener('resize', resize); resize();
      let raf=null; function animate(){ raf=requestAnimationFrame(animate); if(spinning) group.rotation.y+=0.01; if(controls) controls.update(); renderer.render(scene,camera); } animate();
      return { destroy(){ if(raf) cancelAnimationFrame(raf); try{ ro.disconnect(); }catch{} window.removeEventListener('resize',resize); try{ renderer.dispose(); }catch{} } };
    }catch(err){ log.textContent='❌ '+err.message; console.error(err); return { destroy(){} }; }
  },

  async initSolarSystem(container){
    container.innerHTML=`
      <div class="toolbar">
        <select data-role="planet-select" class="input-arcade" style="max-width:140px"><option value="all">All planets</option><option value="earth">Earth</option><option value="mars">Mars</option><option value="jupiter">Jupiter</option></select>
        <button class="btn btn-sm" data-action="front-solar">⬆ Front</button>
        <button class="btn btn-sm btn-primary" data-action="reload-solar">Reload 3D</button>
      </div>
      <div class="canvas-wrap solar-view front" style="background:#050a14"><canvas></canvas><div style="position:absolute;top:8px;left:8px;z-index:30;background:#90cce9;border:3px solid #101b29;border-radius:999px;padding:4px 10px;font-weight:900;font-size:.8rem;box-shadow:3px 3px 0 #101b29">3D SOLAR SYSTEM</div></div>
      <div data-role="solar-log" class="log" style="margin-top:8px">Loading solar system…</div>
    `;
    const wrap=container.querySelector('.canvas-wrap');
    const canvas=wrap.querySelector('canvas');
    const log=container.querySelector('[data-role="solar-log"]');
    await waitVisible(wrap);
    if(!hasWebGL()){ log.textContent='WebGL not available'; return { destroy(){} }; }
    try{
      const THREE=(await import('three')).default;
      let OrbitControls=null; try{ OrbitControls=(await import('/vendor/OrbitControls.js')).OrbitControls; }catch{}
      const rect=wrap.getBoundingClientRect();
      canvas.width=rect.width; canvas.height=rect.height; canvas.style.width=rect.width+'px'; canvas.style.height=rect.height+'px';
      const renderer=new THREE.WebGLRenderer({ canvas, antialias:true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); renderer.setClearColor(0x050a14,1);
      const scene=new THREE.Scene(); scene.background=new THREE.Color(0x050a14);
      const camera=new THREE.PerspectiveCamera(50, rect.width/rect.height, 0.1,1000); camera.position.set(0,14,20);
      const controls=OrbitControls? new OrbitControls(camera, renderer.domElement):null; if(controls){ controls.enableDamping=true; }
      scene.add(new THREE.AmbientLight(0xffffff,0.6));
      const sunLight=new THREE.PointLight(0xf4d36c,2.5,100); sunLight.position.set(0,0,0); scene.add(sunLight);
      const sunGeo=new THREE.SphereGeometry(1.4,32,32); const sunMat=new THREE.MeshBasicMaterial({ color:0xf4d36c }); const sun=new THREE.Mesh(sunGeo,sunMat); scene.add(sun);
      const planets=[
        { name:'earth', radius:0.5, distance:5.5, period:1, color:0x4488ff },
        { name:'mars', radius:0.35, distance:7, period:1.88, color:0xff6644 },
        { name:'jupiter', radius:1, distance:10, period:11.86, color:0xffaa66 },
      ];
      const meshes=[];
      planets.forEach(p=>{
        const geo=new THREE.SphereGeometry(p.radius,24,24);
        const mat=new THREE.MeshStandardMaterial({ color:p.color, emissive:p.color, emissiveIntensity:0.2 });
        const m=new THREE.Mesh(geo,mat); m.position.x=p.distance; m.userData=p; meshes.push(m); scene.add(m);
      });
      function resize(){ const r=wrap.getBoundingClientRect(); if(r.width<50) return; renderer.setSize(r.width,r.height,true); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); }
      const ro=new ResizeObserver(resize); ro.observe(wrap); window.addEventListener('resize', resize); resize();
      container.querySelector('[data-action="front-solar"]').addEventListener('click', ()=>{ wrap.classList.toggle('front'); setTimeout(resize,50); });
      container.querySelector('[data-action="reload-solar"]').addEventListener('click', async ()=>{ if(raf) cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize',resize); renderer.dispose(); await Science.initSolarSystem(container); });
      let raf=null; const clock=new THREE.Clock();
      function animate(){ raf=requestAnimationFrame(animate); const t=clock.getElapsedTime()*0.4; meshes.forEach(m=>{ const p=m.userData; const ang=(t/p.period)*Math.PI*2; m.position.x=Math.cos(ang)*p.distance; m.position.z=Math.sin(ang)*p.distance; m.rotation.y+=0.02; }); sun.rotation.y+=0.005; if(controls) controls.update(); renderer.render(scene,camera); } animate();
      log.textContent='✅ 3D Solar – 3 planets demo – drag to orbit, scroll to zoom – in front of UI (z-index 9999)';
      return { destroy(){ if(raf) cancelAnimationFrame(raf); try{ ro.disconnect(); }catch{} window.removeEventListener('resize',resize); try{ renderer.dispose(); }catch{} } };
    }catch(err){ log.textContent='❌ '+err.message; return { destroy(){} }; }
  }
};
