
window.addEventListener('error', function(e) {
  const msg = e.message || e;
  if(typeof toast === 'function') {
    toast(t('Sistem Hatası: ') + msg);
  } else {
    alert('Sistem Hatası: ' + msg);
  }
  const overlay = document.getElementById('loadingOverlay');
  if(overlay) overlay.classList.remove('visible');
});
window.addEventListener('unhandledrejection', function(e) {
  if(typeof toast === 'function') toast('Promise Hatası: ' + (e.reason&&e.reason.message?e.reason.message:e.reason));
});





(function(){
'use strict';
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function toast(msg,dur=2200){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}

/* ═══ RENDERER ═══ */
const canvas=document.getElementById('scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x121113);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,100);
function resize(){if(window.isRecording)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();updateARFrame();}
window.addEventListener('resize',resize);

/* ═══ ORBIT ═══ */
const CT=new THREE.Vector3(0,1.25,0);
let camR=8.2,camTh=Math.PI/4,camPh=Math.PI/2.6;
function updateCam(){camera.position.set(CT.x+camR*Math.sin(camPh)*Math.sin(camTh),CT.y+camR*Math.cos(camPh),CT.z+camR*Math.sin(camPh)*Math.cos(camTh));camera.lookAt(CT);}
const ptrs=new Map();let turntableActive=false;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});});
canvas.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return;
  const o=ptrs.get(e.pointerId),c={x:e.clientX,y:e.clientY};
  if(ptrs.size===1&&!turntableActive){camTh-=(c.x-o.x)*.006;camPh=clamp(camPh-(c.y-o.y)*.006,.25,Math.PI/2-.03);trans=null;updateCam();}
  else if(ptrs.size===2){const op=[...ptrs.entries()].find(([id])=>id!==e.pointerId)[1];camR=clamp(camR-(Math.hypot(c.x-op.x,c.y-op.y)-Math.hypot(o.x-op.x,o.y-op.y))*.02,3.2,18);trans=null;updateCam();}
  ptrs.set(e.pointerId,c);
});
['pointerup','pointercancel'].forEach(ev=>canvas.addEventListener(ev,e=>ptrs.delete(e.pointerId)));
canvas.addEventListener('wheel',e=>{e.preventDefault();camR=clamp(camR+e.deltaY*.01,3.2,18);trans=null;updateCam();},{passive:false});
const CP={front:{th:0,ph:Math.PI/2.25,r:7.6},threeQuarter:{th:Math.PI/4,ph:Math.PI/2.6,r:8.2},top:{th:Math.PI/3.4,ph:.42,r:9.2},side:{th:Math.PI/2,ph:Math.PI/2.8,r:7.8},back:{th:Math.PI,ph:Math.PI/2.6,r:7.6},low:{th:Math.PI/4,ph:Math.PI/1.7,r:7.2}};
let trans=null;
function goPreset(n){const p=CP[n]||CP.threeQuarter;trans={fTh:camTh,fPh:camPh,fR:camR,tTh:p.th,tPh:p.ph,tR:p.r,t:0};}
document.querySelectorAll('.preset-btn').forEach(b=>b.addEventListener('click',()=>goPreset(b.dataset.preset)));

/* ═══ HEMISPHERE ═══ */
let hemi=new THREE.HemisphereLight(0x4a4a52,0x0b0b0c,.35);scene.add(hemi);

/* ═══ SCENE GEOMETRY ═══ */
const floorMat=new THREE.MeshStandardMaterial({color:0xe9e5db,roughness:.95,metalness:0});
let fl=new THREE.Mesh(new THREE.PlaneGeometry(18,18),floorMat);fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;scene.add(fl);
let bw=new THREE.Mesh(new THREE.PlaneGeometry(18,10),new THREE.MeshStandardMaterial({color:0xe9e5db,roughness:.95,metalness:0}));bw.position.set(0,5,-3.4);bw.receiveShadow=true;scene.add(bw);
let sweepMesh=null;

// Mirror floor (CubeCamera based)
let mirrorActive=false,cubeRT=null,cubeCamera2=null,mirrorFloorMesh=null;
function buildMirrorFloor(){
  if(cubeRT)cubeRT.dispose();
  cubeRT=new THREE.WebGLCubeRenderTarget(256,{format:THREE.RGBFormat,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  cubeCamera2=new THREE.CubeCamera(.05,30,cubeRT);cubeCamera2.position.set(0,.01,0);scene.add(cubeCamera2);
  const mirMat=new THREE.MeshStandardMaterial({metalness:1,roughness:+document.getElementById('ctrlMirrorBlur').value,envMap:cubeRT.texture});
  mirrorFloorMesh=new THREE.Mesh(new THREE.PlaneGeometry(18,18),mirMat);mirrorFloorMesh.rotation.x=-Math.PI/2;mirrorFloorMesh.receiveShadow=false;
  scene.add(mirrorFloorMesh);
}
function destroyMirrorFloor(){if(cubeCamera2){scene.remove(cubeCamera2);cubeRT&&cubeRT.dispose();cubeCamera2=null;cubeRT=null;}if(mirrorFloorMesh){scene.remove(mirrorFloorMesh);mirrorFloorMesh.geometry.dispose();mirrorFloorMesh.material.dispose();mirrorFloorMesh=null;}}

function buildSweepMesh(sweepColor){
  if(sweepMesh){scene.remove(sweepMesh);sweepMesh.geometry.dispose();sweepMesh.material.dispose();sweepMesh=null;}
  const R=2.2,curveStart=-3.4-R,wallH=7,floorStart=-9;
  const profile=[];
  for(let i=0;i<=6;i++)profile.push([floorStart+(i/6)*(curveStart-floorStart),0]);
  const curveSegs=20;
  for(let i=0;i<=curveSegs;i++){const a=-Math.PI/2+(i/curveSegs)*Math.PI/2;profile.push([curveStart+Math.cos(a)*R,R+Math.sin(a)*R]);}
  for(let i=1;i<=8;i++)profile.push([curveStart+R-R,-R+R+(i/8)*wallH]); // z=0 wall going up
  const N=profile.length;const xSegs=4;const W=18;
  const verts=[],uvs=[],inds=[];
  for(let xi=0;xi<=xSegs;xi++){const x=-W/2+(xi/xSegs)*W;for(let pi=0;pi<N;pi++){verts.push(x,profile[pi][1],profile[pi][0]);uvs.push(xi/xSegs,pi/(N-1));}}
  for(let xi=0;xi<xSegs;xi++){for(let pi=0;pi<N-1;pi++){const a=xi*N+pi,b=xi*N+pi+1,c=(xi+1)*N+pi,d=(xi+1)*N+pi+1;inds.push(a,b,c);inds.push(b,d,c);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(inds);geo.computeVertexNormals();
  sweepMesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(sweepColor),roughness:.93,metalness:0,side:THREE.DoubleSide}));sweepMesh.receiveShadow=true;scene.add(sweepMesh);
}

function setSweepMode(mode){
  fl.visible=mode==='flat';bw.visible=mode==='flat';
  if(mode==='sweep'){buildSweepMesh(document.getElementById('sweepColorPick').value);if(sweepMesh)sweepMesh.visible=true;}
  else if(mode==='dome'){if(sweepMesh){scene.remove(sweepMesh);sweepMesh.geometry.dispose();sweepMesh.material.dispose();sweepMesh=null;}const dg=new THREE.SphereGeometry(12,32,24,0,Math.PI*2,0,Math.PI/2);const dm=new THREE.MeshStandardMaterial({color:new THREE.Color(document.getElementById('sweepColorPick').value),roughness:.95,metalness:0,side:THREE.BackSide});sweepMesh=new THREE.Mesh(dg,dm);scene.add(sweepMesh);}
  else{if(sweepMesh){scene.remove(sweepMesh);sweepMesh.geometry.dispose();sweepMesh.material.dispose();sweepMesh=null;}}
}
document.querySelectorAll('[data-sweep]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-sweep]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');setSweepMode(btn.dataset.sweep);}));
document.getElementById('sweepColorPick').addEventListener('input',e=>{if(sweepMesh)sweepMesh.material.color.set(e.target.value);});

/* ═══ HDRI/IBL ═══ */
let pmremGen=null,envMapCache={},rgbeLoaded=false;
function getPMREM(){if(!pmremGen){pmremGen=new THREE.PMREMGenerator(renderer);pmremGen.compileEquirectangularShader();}return pmremGen;}
const HDRI_CONFIGS={
  neutral:{sky:[0.28,0.28,0.32],horizon:[0.18,0.18,0.20],ground:[0.05,0.04,0.06]},
  studio:{sky:[0.35,0.35,0.40],horizon:[0.28,0.28,0.32],ground:[0.09,0.08,0.10]},
  warm:{sky:[0.42,0.28,0.12],horizon:[0.30,0.18,0.08],ground:[0.08,0.05,0.02]},
  cool:{sky:[0.15,0.20,0.40],horizon:[0.10,0.14,0.28],ground:[0.03,0.04,0.08]},
  sunset:{sky:[0.60,0.18,0.06],horizon:[0.45,0.22,0.10],ground:[0.05,0.03,0.01]},
  night:{sky:[0.04,0.04,0.10],horizon:[0.03,0.03,0.07],ground:[0.01,0.01,0.02]},
  cloudy:{sky:[0.32,0.32,0.34],horizon:[0.28,0.28,0.30],ground:[0.12,0.12,0.13]},
  outdoor:{sky:[0.20,0.35,0.55],horizon:[0.30,0.40,0.50],ground:[0.10,0.15,0.08]},
};
function buildEnvTexture(cfg){
  const W=256,H=128;const data=new Float32Array(W*H*4);
  for(let y=0;y<H;y++){const t=y/H;
    let r,g,b;
    if(t<0.35){const a=t/0.35;r=lerp(cfg.sky[0],cfg.horizon[0],a);g=lerp(cfg.sky[1],cfg.horizon[1],a);b=lerp(cfg.sky[2],cfg.horizon[2],a);}
    else{const a=(t-0.35)/0.65;r=lerp(cfg.horizon[0],cfg.ground[0],a);g=lerp(cfg.horizon[1],cfg.ground[1],a);b=lerp(cfg.horizon[2],cfg.ground[2],a);}
    for(let x=0;x<W;x++){const i=(y*W+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=1;}
  }
  const tex=new THREE.DataTexture(data,W,H,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping;tex.needsUpdate=true;
  return getPMREM().fromEquirectangular(tex).texture;
}
function applyHDRI(key){
  const cfg=HDRI_CONFIGS[key];if(!cfg)return;
  if(!envMapCache[key])envMapCache[key]=buildEnvTexture(cfg);
  const intensity=+document.getElementById('ctrlHdriInt').value;
  scene.environment=envMapCache[key];
  renderer.toneMappingExposure=intensity;
}
function removeHDRI(){scene.environment=null;renderer.toneMappingExposure=1;}
document.getElementById('hdriToggle').addEventListener('change',e=>{
  const c=document.getElementById('hdriControls');c.style.opacity=e.target.checked?'1':'.3';c.style.pointerEvents=e.target.checked?'auto':'none';
  if(e.target.checked)applyHDRI(document.querySelector('.hdri-btn.active')?.dataset.hdri||'neutral');else removeHDRI();
});
document.querySelectorAll('.hdri-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.hdri-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  if(document.getElementById('hdriToggle').checked)applyHDRI(b.dataset.hdri);
}));
document.getElementById('ctrlHdriInt').addEventListener('input',e=>{document.getElementById('vHdriInt').textContent=parseFloat(e.target.value).toFixed(2);if(document.getElementById('hdriToggle').checked)renderer.toneMappingExposure=+e.target.value;});
document.getElementById('hdriBgToggle').addEventListener('change',e=>{
  if(e.target.checked&&window.currentHdriTexture){
    scene.background=window.currentHdriTexture;
    bw.visible=false;if(typeof sweepMesh!=='undefined'&&sweepMesh)sweepMesh.visible=false;
  }else{
    if(typeof bgImageTexture!=='undefined'&&bgImageTexture){
      scene.background=bgImageTexture;
      bw.visible=false;if(typeof sweepMesh!=='undefined'&&sweepMesh)sweepMesh.visible=false;
    }else{
      scene.background=new THREE.Color(0x121113);
      bw.visible=true;if(document.getElementById('envModeSel')&&document.getElementById('envModeSel').value==='sweep'&&typeof sweepMesh!=='undefined'&&sweepMesh)sweepMesh.visible=true;
    }
  }
});

let bgTexSel = document.getElementById('bgTextureSel');
if(bgTexSel) {
  bgTexSel.addEventListener('change', e => {
    const val = e.target.value;
    if(val === 'none') {
      if(sweepMesh) { sweepMesh.material.map = null; sweepMesh.material.needsUpdate = true; }
      floorMat.map = null; floorMat.needsUpdate = true;
    } else {
      const tex = buildFloorTexture(val);
      if(sweepMesh) { sweepMesh.material.map = tex; sweepMesh.material.needsUpdate = true; }
      floorMat.map = tex; floorMat.needsUpdate = true;
    }
  });
}

document.getElementById('hdriFileBtn').addEventListener('click',()=>document.getElementById('hdriFileInput').click());
document.getElementById('hdriFileInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const doLoad=(LoaderClass)=>{
    const loader=new THREE[LoaderClass]();
    const url=URL.createObjectURL(f);
    document.getElementById('loadingText').textContent='HDRI yükleniyor…';
    document.getElementById('loadingOverlay').classList.add('visible');
    loader.load(url,tex=>{
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      tex.mapping=THREE.EquirectangularReflectionMapping;
      const envMap=getPMREM().fromEquirectangular(tex).texture;
      if(window.currentHdriTexture)window.currentHdriTexture.dispose();
      window.currentHdriTexture=tex;
      scene.environment=envMap;
      
      document.getElementById('hdriBgToggleRow').style.display='flex';
      if(document.getElementById('hdriBgToggle').checked){
         scene.background=window.currentHdriTexture;
         bw.visible=false;if(typeof sweepMesh!=='undefined'&&sweepMesh)sweepMesh.visible=false;
      }
      
      renderer.toneMappingExposure=+document.getElementById('ctrlHdriInt').value;
      document.getElementById('loadingOverlay').classList.remove('visible');
      toast('HDRI yüklendi ✓');
    },null,err=>{
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      document.getElementById('loadingOverlay').classList.remove('visible');
      toast('HDR hatası — dosya bozuk veya desteklenmiyor');
    });
  };
  const ext=f.name.toLowerCase().split('.').pop();
  if(ext!=='hdr'&&ext!=='exr'){
    toast('Hata: Yalnızca .hdr veya .exr formatları desteklenir!');
    return;
  }
  const isEXR=ext==='exr';
  const loaderName=isEXR?'exr':'rgbe';
  const LoaderClass=isEXR?'EXRLoader':'RGBELoader';
  
  const ensureFflate=(cb)=>{
    if(!isEXR||window.fflate){cb();return;}
    const s=document.createElement('script');
    s.src='https://unpkg.com/fflate@0.6.9/umd/index.js';
    s.onload=cb;s.onerror=()=>toast('fflate yüklenemedi!');
    document.head.appendChild(s);
  };
  
  if(window[loaderName+'Loaded']){ensureFflate(()=>doLoad(LoaderClass));e.target.value='';return;}
  let s=document.querySelector(`script[data-loader="${loaderName}"]`);
  if(!s){
    s=document.createElement('script');
    s.setAttribute('data-loader',loaderName);
    s.src=`https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/${LoaderClass}.js`;
    s.onload=()=>{window[loaderName+'Loaded']=true;ensureFflate(()=>doLoad(LoaderClass));};
    s.onerror=()=>{
      const s2=document.createElement('script');
      s2.src=`https://unpkg.com/three@0.128.0/examples/js/loaders/${LoaderClass}.js`;
      s2.onload=()=>{window[loaderName+'Loaded']=true;ensureFflate(()=>doLoad(LoaderClass));};
      s2.onerror=()=>{document.getElementById('loadingOverlay').classList.remove('visible');toast(LoaderClass+' yüklenemedi!');};
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  } else if(window[loaderName+'Loaded']){ensureFflate(()=>doLoad(LoaderClass));}
  e.target.value='';
});


/* ═══ ŞIŞE (Varsayılan Ürün) ═══ */
const mainProductWrapper=new THREE.Group();
scene.add(mainProductWrapper);
const bottleGroup=new THREE.Group();
const glassMat=new THREE.MeshPhysicalMaterial({color:0x7a4318,transparent:true,opacity:.8,roughness:.08,metalness:0,clearcoat:1,clearcoatRoughness:.08});
const capMat=new THREE.MeshStandardMaterial({color:0xc9a227,metalness:1,roughness:.3});
const BH=1.6;
[[new THREE.CylinderGeometry(.55,.6,BH,32),BH/2,glassMat],[new THREE.CylinderGeometry(.18,.55,.45,32),BH+.225,glassMat],[new THREE.CylinderGeometry(.155,.18,.55,24),BH+.725,glassMat],[new THREE.CylinderGeometry(.185,.185,.12,24),BH+1.06,capMat]].forEach(([g,y,m])=>{const ms=new THREE.Mesh(g,m);ms.position.y=y;ms.castShadow=true;bottleGroup.add(ms);});
mainProductWrapper.add(bottleGroup);

/* ═══ MATERYAl SİSTEMİ ═══ */
const MAT_P={glass:{roughness:.08,metalness:0,clearcoat:1,opacity:.8},metal:{roughness:.22,metalness:.95,clearcoat:.3,opacity:1},plastic:{roughness:.65,metalness:0,clearcoat:.15,opacity:1},ceramic:{roughness:.35,metalness:0,clearcoat:.8,opacity:1},wood:{roughness:.85,metalness:0,clearcoat:.05,opacity:1},chrome:{roughness:.02,metalness:1,clearcoat:1,opacity:1},silicone:{roughness:.55,metalness:0,clearcoat:.6,opacity:.92},fabric:{roughness:.92,metalness:0,clearcoat:0,opacity:1}};
const FABRIC_TYPES=[{key:'cotton',name:'Pamuk',desc:'Doğal, mat',color:'#e8dcc8',roughness:.95,clearcoat:0},{key:'silk',name:'İpek',desc:'Parlak, yüksek',color:'#f0e8e0',roughness:.45,clearcoat:.35},{key:'leather',name:'Deri',desc:'Düzgün, sertçe',color:'#7a5040',roughness:.55,clearcoat:.25},{key:'velvet',name:'Kadife',desc:'Derin, mat',color:'#8a6a7a',roughness:.98,clearcoat:0},{key:'denim',name:'Denim',desc:'Kaba örgü',color:'#4a5a78',roughness:.96,clearcoat:0},{key:'wool',name:'Yün',desc:'Çok mat',color:'#b8a898',roughness:.99,clearcoat:0}];
let curMatKey='glass',curColor='#7a4318',curFabricKey='cotton',loadedGroup=null,usingDefault=true;
let productTexture=null;

function applyMat(){
  const r=+document.getElementById('ctrlRoughness').value,m=+document.getElementById('ctrlMetalness').value,cc=+document.getElementById('ctrlClearcoat').value,op=+document.getElementById('ctrlOpacity').value;
  const col=new THREE.Color(curColor);
  const applyToMesh=(mt)=>{if(!(mt instanceof THREE.MeshPhysicalMaterial)){mt=new THREE.MeshPhysicalMaterial();}mt.color.set(col);mt.roughness=r;mt.metalness=m;mt.clearcoat=cc;mt.clearcoatRoughness=cc*.15;mt.transparent=op<1;mt.opacity=op;if(productTexture){mt.map=productTexture;mt.needsUpdate=true;}else{mt.map=null;mt.needsUpdate=true;}};
  if(usingDefault){for(let i=0;i<3;i++)applyToMesh(bottleGroup.children[i].material);}
  else if(loadedGroup){loadedGroup.traverse(n=>{if(!n.isMesh)return;if(!(n.material instanceof THREE.MeshPhysicalMaterial))n.material=new THREE.MeshPhysicalMaterial();applyToMesh(n.material);});}
}
function applyPreset(key){curMatKey=key;const p=MAT_P[key];document.getElementById('ctrlRoughness').value=p.roughness;document.getElementById('vRoughness').textContent=p.roughness.toFixed(2);document.getElementById('ctrlMetalness').value=p.metalness;document.getElementById('vMetalness').textContent=p.metalness.toFixed(2);document.getElementById('ctrlClearcoat').value=p.clearcoat;document.getElementById('vClearcoat').textContent=p.clearcoat.toFixed(2);document.getElementById('ctrlOpacity').value=p.opacity;document.getElementById('vOpacity').textContent=p.opacity.toFixed(2);document.querySelectorAll('.mat-btn').forEach(b=>b.classList.toggle('active',b.dataset.mat===key));const fp=document.getElementById('fabricPanel');if(key==='fabric'){fp.classList.add('visible');applyFabricPreset(curFabricKey);}else{fp.classList.remove('visible');applyMat();}}
function applyFabricPreset(fkey){curFabricKey=fkey;const f=FABRIC_TYPES.find(x=>x.key===fkey);if(!f)return;curColor=f.color;document.getElementById('productColor').value=f.color;document.getElementById('ctrlRoughness').value=f.roughness;document.getElementById('vRoughness').textContent=f.roughness.toFixed(2);document.getElementById('ctrlMetalness').value=0;document.getElementById('vMetalness').textContent='0.00';document.getElementById('ctrlClearcoat').value=f.clearcoat;document.getElementById('vClearcoat').textContent=f.clearcoat.toFixed(2);document.getElementById('ctrlOpacity').value=1;document.getElementById('vOpacity').textContent='1.00';document.querySelectorAll('.fabric-item').forEach(el=>el.classList.toggle('active',el.dataset.fabric===fkey));applyMat();}
(function(){const list=document.getElementById('fabricList');FABRIC_TYPES.forEach(f=>{const item=document.createElement('div');item.className='fabric-item';item.dataset.fabric=f.key;const sw=document.createElement('div');sw.className='fabric-swatch';sw.style.background=f.color;const info=document.createElement('div');info.className='fabric-info';info.innerHTML='<div class="fabric-name">'+t(f.name)+'</div><div class="fabric-desc">'+t(f.desc)+'</div>';item.append(sw,info);item.addEventListener('click',()=>applyFabricPreset(f.key));list.appendChild(item);});})();
['ctrlRoughness','ctrlMetalness','ctrlClearcoat','ctrlOpacity'].forEach(id=>{const el=document.getElementById(id);const vid={ctrlRoughness:'vRoughness',ctrlMetalness:'vMetalness',ctrlClearcoat:'vClearcoat',ctrlOpacity:'vOpacity'}[id];el.addEventListener('input',()=>{document.getElementById(vid).textContent=parseFloat(el.value).toFixed(2);applyMat();});});
document.getElementById('productColor').addEventListener('input',e=>{curColor=e.target.value;applyMat();});
document.querySelectorAll('.mat-btn').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.mat)));

/* ═══ TEXTURE YÜKLEME ═══ */
function loadProductTexture(file){
  const url=URL.createObjectURL(file);const loader=new THREE.TextureLoader();
  loader.load(url,tex=>{URL.revokeObjectURL(url);if(productTexture)productTexture.dispose();tex.wrapS=tex.wrapT=THREE.RepeatWrapping;const sc=+document.getElementById('ctrlTexScale').value;tex.repeat.set(sc,sc);productTexture=tex;applyMat();document.getElementById('textureInfo').style.display='flex';document.getElementById('textureName').textContent=file.name.replace(/\.[^.]+$/,'');const img=document.getElementById('texturePreviewImg');img.src=URL.createObjectURL(file);img.style.display='block';document.getElementById('textureDropLabel').style.display='none';document.getElementById('textureDropIcon').style.display='none';document.getElementById('textureControls').style.display='block';toast('Doku yüklendi ✓');});
}
function removeProductTexture(){if(productTexture){productTexture.dispose();productTexture=null;}applyMat();document.getElementById('textureInfo').style.display='none';document.getElementById('texturePreviewImg').style.display='none';document.getElementById('textureDropLabel').style.display='block';document.getElementById('textureDropIcon').style.display='block';document.getElementById('textureControls').style.display='none';}
const tz=document.getElementById('textureZone'),ti=document.getElementById('textureInput');
tz.addEventListener('click',()=>ti.click());
ti.addEventListener('change',e=>{const f=e.target.files[0];if(f)loadProductTexture(f);ti.value='';});
tz.addEventListener('dragover',e=>{e.preventDefault();tz.classList.add('over');});
tz.addEventListener('dragleave',()=>tz.classList.remove('over'));
tz.addEventListener('drop',e=>{e.preventDefault();tz.classList.remove('over');const f=e.dataTransfer.files[0];if(f)loadProductTexture(f);});
document.getElementById('textureRemoveBtn').addEventListener('click',removeProductTexture);
document.getElementById('ctrlTexScale').addEventListener('input',e=>{document.getElementById('vTexScale').textContent=parseFloat(e.target.value).toFixed(1);if(productTexture){const sc=+e.target.value;productTexture.repeat.set(sc,sc);productTexture.needsUpdate=true;}});

/* ═══ OBJ PARSER ═══ */
function parseOBJ(text){const verts=[],norms=[],uvs=[],pos=[],normArr=[],uvArr=[];for(const line of text.split('\n')){const p=line.trim().split(/\s+/);if(p[0]==='v')verts.push(+p[1],+p[2],+p[3]);else if(p[0]==='vn')norms.push(+p[1],+p[2],+p[3]);else if(p[0]==='vt')uvs.push(+p[1],+(p[2]||0));else if(p[0]==='f'){const pts=[];for(let j=1;j<p.length;j++){const t=p[j].split('/');const vi=+t[0]||0,ti=+t[1]||0,ni=+t[2]||0;const v3=(vi>0?vi-1:verts.length/3+vi)*3,t2=(ti>0?ti-1:uvs.length/2+ti)*2,n3=(ni>0?ni-1:norms.length/3+ni)*3;pts.push({p:[verts[v3],verts[v3+1],verts[v3+2]],uv:ti?[uvs[t2],uvs[t2+1]]:[],n:ni?[norms[n3],norms[n3+1],norms[n3+2]]:[]});}for(let k=1;k<pts.length-1;k++){[pts[0],pts[k],pts[k+1]].forEach(v=>{pos.push(...v.p);if(v.n.length)normArr.push(...v.n);if(v.uv.length)uvArr.push(...v.uv);});}}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));if(normArr.length===pos.length)geo.setAttribute('normal',new THREE.Float32BufferAttribute(normArr,3));if(uvArr.length===pos.length/3*2)geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvArr,2));if(!geo.attributes.normal||!geo.attributes.normal.count)geo.computeVertexNormals();return geo;}
function fitModel(g){const box=new THREE.Box3().setFromObject(g);const sz=box.getSize(new THREE.Vector3());g.scale.setScalar(2.8/Math.max(sz.x,sz.y,sz.z));const b2=new THREE.Box3().setFromObject(g);const c=b2.getCenter(new THREE.Vector3());g.position.set(-c.x,-b2.min.y,-c.z);}
function placeModel(g,name){if(loadedGroup){mainProductWrapper.remove(loadedGroup);loadedGroup=null;}bottleGroup.visible=false;usingDefault=false;loadedGroup=g;fitModel(g);g.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});mainProductWrapper.add(g);applyMat();let mc=0,tc=0;g.traverse(n=>{if(n.isMesh){mc++;tc+=(n.geometry.index?n.geometry.index.count/3:n.geometry.attributes.position.count/3);}});document.getElementById('piName').textContent=name;document.getElementById('piMeta').textContent=mc+' parça · '+(tc/1000).toFixed(1)+'K üçgen';document.getElementById('productInfo').classList.add('visible');document.getElementById('dropZone').style.display='none';updTitle();document.getElementById('loadingOverlay').classList.remove('visible');}

document.getElementById('fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)loadModel(f);e.target.value='';});
document.getElementById('piRemove').addEventListener('click',()=>{
  usingDefault=true;
  bottleGroup.visible=true;
  if(loadedGroup){mainProductWrapper.remove(loadedGroup);loadedGroup=null;}
  document.getElementById('productInfo').style.display='none';
  document.getElementById('dropZone').style.display='flex';
  document.getElementById('piName').textContent='-';
  updTitle();
  ['X','Y','Z'].forEach(a=>{
    document.getElementById('ctrlMainObj'+a).value=0;
    document.getElementById('vMainObj'+a).textContent='0.00';
  });
  mainProductWrapper.position.set(0,0,0);
  CT.set(0, 1.25, 0);
  if(typeof updateCam==='function') updateCam();
});

['X','Y','Z'].forEach(axis=>{
  document.getElementById('ctrlMainObj'+axis).addEventListener('input', e=>{
    const val=parseFloat(e.target.value);
    document.getElementById('vMainObj'+axis).textContent=val.toFixed(2);
    const p=axis.toLowerCase();
    mainProductWrapper.position[p]=val;
    
    if(typeof CT!=='undefined' && typeof updateCam==='function') {
      if(p==='x') CT.x = val;
      if(p==='y') CT.y = 1.25 + val;
      if(p==='z') CT.z = val;
      updateCam();
    }
  });
});

/* ── ODAK / TARGET ── */
let gltfLoader=null;
function loadModel(file){const ext=file.name.split('.').pop().toLowerCase();if(ext==='obj')loadOBJ(file);else loadGLB(file);}
function loadOBJ(file){document.getElementById('loadingText').textContent=file.name+' okunuyor…';document.getElementById('loadingOverlay').classList.add('visible');const reader=new FileReader();reader.onload=e=>{try{const g=new THREE.Group();g.add(new THREE.Mesh(parseOBJ(e.target.result),new THREE.MeshPhysicalMaterial({color:new THREE.Color(curColor),roughness:.08,metalness:0,clearcoat:1})));placeModel(g,file.name);}catch(err){document.getElementById('loadingOverlay').classList.remove('visible');alert('OBJ hatası: '+err.message);}};reader.readAsText(file);}
function loadGLB(file){document.getElementById('loadingText').textContent=file.name+' okunuyor…';document.getElementById('loadingOverlay').classList.add('visible');if(gltfLoader){const url=URL.createObjectURL(file);gltfLoader.load(url,gltf=>{URL.revokeObjectURL(url);placeModel(gltf.scene,file.name);},null,err=>{document.getElementById('loadingOverlay').classList.remove('visible');alert('GLB hatası: '+err);});return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';s.onload=()=>{gltfLoader=new THREE.GLTFLoader();loadGLB(file);};s.onerror=()=>{document.getElementById('loadingOverlay').classList.remove('visible');toast('GLTFLoader yüklenemedi');};document.head.appendChild(s);}
const dz=document.getElementById('dropZone');
dz.addEventListener('click',()=>document.getElementById('fileInput').click());
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');const f=e.dataTransfer.files[0];if(f)loadModel(f);});

/* ═══ PANEL TOGGLE / TABS ═══ */
let ppCol=false;
document.getElementById('ppHeader').addEventListener('click',()=>{ppCol=!ppCol;document.getElementById('productPanel').classList.toggle('collapsed',ppCol);document.getElementById('ppToggle').textContent=ppCol?'›':'‹';});
document.querySelectorAll('.pp-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.pp-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.pp-pane').forEach(p=>p.classList.remove('active'));btn.classList.add('active');document.getElementById('pane-'+btn.dataset.tab).classList.add('active');}));
document.querySelectorAll('.sheet-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.sheet-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.sheet-pane').forEach(p=>p.classList.remove('active'));btn.classList.add('active');document.getElementById('spane-'+btn.dataset.stab).classList.add('active');}));

/* ═══ SAHNE ÖZELLİKLERİ ═══ */
const BG_COLORS={studio:0x121113,warm:0x1a1208,cool:0x080d1a,sunset:0x150508,grey:0x2a2a2a,white:0xe0ddd8,outdoor:0x0a1520};
document.querySelectorAll('.bg-swatch').forEach(sw=>{sw.addEventListener('click',()=>{document.querySelectorAll('.bg-swatch').forEach(s=>s.classList.remove('active'));sw.classList.add('active');const bgColorRow=document.getElementById('bgColorRow');if(sw.dataset.bg==='custom'){bgColorRow.style.display='flex';scene.background=new THREE.Color(document.getElementById('bgColorPick').value);}else{bgColorRow.style.display='none';scene.background=new THREE.Color(BG_COLORS[sw.dataset.bg]);}});});
document.getElementById('bgColorPick').addEventListener('input',e=>{scene.background=new THREE.Color(e.target.value);});

let curFloorMode='mat';
document.querySelectorAll('[data-floor]').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('[data-floor]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');curFloorMode=btn.dataset.floor;const mr=document.getElementById('mirrorRow');mr.style.display=curFloorMode==='mirror'?'flex':'none';if(curFloorMode==='mirror'){fl.visible=false;if(!mirrorActive){mirrorActive=true;buildMirrorFloor();}}else{fl.visible=true;if(mirrorActive){mirrorActive=false;destroyMirrorFloor();}if(curFloorMode==='mat'){floorMat.roughness=.95;floorMat.metalness=0;}else if(curFloorMode==='glossy'){floorMat.roughness=.05;floorMat.metalness=.1;}else if(curFloorMode==='colored'){floorMat.roughness=.8;floorMat.metalness=0;}}});});
document.getElementById('floorColorPick').addEventListener('input',e=>{floorMat.color.set(e.target.value);bw.material.color.set(e.target.value);if(sweepMesh)sweepMesh.material.color.set(e.target.value);});
document.getElementById('ctrlMirrorBlur').addEventListener('input',e=>{document.getElementById('vMirrorBlur').textContent=parseFloat(e.target.value).toFixed(2);if(mirrorFloorMesh)mirrorFloorMesh.material.roughness=+e.target.value;});
document.getElementById('fogToggle').addEventListener('change',e=>{const fc=document.getElementById('fogControls');if(e.target.checked){scene.fog=new THREE.FogExp2(0x121113,+document.getElementById('ctrlFog').value);fc.style.opacity='1';fc.style.pointerEvents='auto';}else{scene.fog=null;fc.style.opacity='.3';fc.style.pointerEvents='none';}});
document.getElementById('ctrlFog').addEventListener('input',e=>{document.getElementById('vFog').textContent=parseFloat(e.target.value).toFixed(3);if(scene.fog)scene.fog.density=+e.target.value;});

/* ═══ PROPS (UPLOAD) ═══ */
// Panel toggle
document.getElementById('toggleLDP').addEventListener('click',()=>{
  const p=document.getElementById('lightDetailPanel');
  const btn=document.getElementById('toggleLDP');
  const vis=!p.classList.contains('visible');
  p.classList.toggle('visible',vis);btn.classList.toggle('active',vis);
});
document.getElementById('toggleDiag').addEventListener('click',()=>{
  const p=document.getElementById('diagramPanel');
  const btn=document.getElementById('toggleDiag');
  const vis=!p.classList.contains('visible');
  p.classList.toggle('visible',vis);btn.classList.toggle('active',vis);
  if(vis) setTimeout(updateDiagCanvasSize, 10);
});
document.getElementById('togglePLP').addEventListener('click',()=>{
  const p=document.getElementById('propLayerPanel');
  const btn=document.getElementById('togglePLP');
  const vis=!p.classList.contains('visible');
  p.classList.toggle('visible',vis);btn.classList.toggle('active',vis);
});
document.getElementById('diagClose').addEventListener('click',()=>{
  document.getElementById('diagramPanel').classList.remove('visible');
  document.getElementById('toggleDiag').classList.remove('active');
});

// Props: uploaded 3D objects
const uploadedLayers={};let layerSel=null,layerIdCnt=0;
let plpGltfLoader=null;

function getPLPGltfLoader(cb){
  if(plpGltfLoader){cb(plpGltfLoader);return;}
  if(typeof THREE.GLTFLoader!=='undefined'){plpGltfLoader=new THREE.GLTFLoader();cb(plpGltfLoader);return;}
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  s.onload=()=>{plpGltfLoader=new THREE.GLTFLoader();cb(plpGltfLoader);};
  s.onerror=()=>toast('GLTFLoader yüklenemedi');
  document.head.appendChild(s);
}

document.getElementById('plpUploadBtn').addEventListener('click',()=>document.getElementById('plpFileInput').click());
document.getElementById('plpFileInput').addEventListener('change',e=>{
  Array.from(e.target.files).forEach(f=>loadLayerFile(f));
  e.target.value='';
});

function loadLayerFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  layerIdCnt++;const id='lay'+layerIdCnt;
  if(ext==='obj'){
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const g=new THREE.Group();
        g.add(new THREE.Mesh(parseOBJ(ev.target.result),new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:.7})));
        addLayer(id,g,file.name);
      }catch(err){toast('OBJ hatası: '+err.message);}
    };
    reader.readAsText(file);
  } else {
    const url=URL.createObjectURL(file);
    getPLPGltfLoader(loader=>{
      loader.load(url,gltf=>{
        URL.revokeObjectURL(url);
        gltf.scene.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
        addLayer(id,gltf.scene,file.name);
      },null,err=>{URL.revokeObjectURL(url);toast('Yükleme hatası: '+err);});
    });
  }
}

function addLayer(id,group,name){
  // Fit to ~1 unit
  const box=new THREE.Box3().setFromObject(group);
  const sz=box.getSize(new THREE.Vector3());
  const sc=1.2/Math.max(sz.x,sz.y,sz.z);
  group.scale.setScalar(sc);
  const b2=new THREE.Box3().setFromObject(group);
  group.position.y=-b2.min.y;
  scene.add(group);
  uploadedLayers[id]={group,name,visible:true,file:name};
  document.getElementById('plpEmpty').style.display='none';
  // Build list item
  const li=document.createElement('div');li.className='layer-item';li.dataset.id=id;
  const shortName=name.replace(/\.[^.]+$/,'').substring(0,18);
  li.innerHTML=
    '<span class="layer-icon">📦</span>'+
    '<div class="layer-info"><div class="layer-name">'+shortName+'</div><div class="layer-sub">GLB obje</div></div>'+
    '<button class="layer-vis-btn" title="Göster/Gizle">👁</button>'+
    '<button class="layer-del-btn" title="Sil">✕</button>';
  li.addEventListener('click',e=>{
    if(e.target.classList.contains('layer-vis-btn')){toggleLayerVis(id);return;}
    if(e.target.classList.contains('layer-del-btn')){deleteLayer(id);return;}
    selectLayer(id);
  });
  document.getElementById('layerList').appendChild(li);
  selectLayer(id);
  // Open prop layer panel
  document.getElementById('propLayerPanel').classList.add('visible');
  document.getElementById('togglePLP').classList.add('active');
  toast('✅ '+shortName+' eklendi');
}

function toggleLayerVis(id){
  const l=uploadedLayers[id];if(!l)return;
  l.visible=!l.visible;l.group.visible=l.visible;
  const btn=document.querySelector('.layer-item[data-id="'+id+'"] .layer-vis-btn');
  if(btn)btn.textContent=l.visible?'👁':'🚫';
}

function deleteLayer(id){
  const l=uploadedLayers[id];if(!l)return;
  scene.remove(l.group);l.group.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){const m=Array.isArray(n.material)?n.material:[n.material];m.forEach(mat=>mat.dispose());}});
  delete uploadedLayers[id];
  const li=document.querySelector('.layer-item[data-id="'+id+'"]');if(li)li.remove();
  if(layerSel===id){layerSel=null;document.getElementById('layerCtrl').classList.remove('open');}
  if(Object.keys(uploadedLayers).length===0)document.getElementById('plpEmpty').style.display='block';
}

function selectLayer(id){
  layerSel=id;
  document.querySelectorAll('.layer-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  const l=uploadedLayers[id];if(!l){document.getElementById('layerCtrl').classList.remove('open');return;}
  const ctrl=document.getElementById('layerCtrl');ctrl.classList.add('open');
  document.getElementById('layerCtrlTitle').textContent=l.name.replace(/\.[^.]+$/,'');
  document.getElementById('ctrlLcX').value=l.group.position.x;
  document.getElementById('vLcX').textContent=l.group.position.x.toFixed(2);
  document.getElementById('ctrlLcY').value=l.group.position.y;
  document.getElementById('vLcY').textContent=l.group.position.y.toFixed(2);
  document.getElementById('ctrlLcZ').value=l.group.position.z;
  document.getElementById('vLcZ').textContent=l.group.position.z.toFixed(2);
  const rot=Math.round(THREE.MathUtils.radToDeg(l.group.rotation.y));
  document.getElementById('ctrlLcRot').value=rot;document.getElementById('vLcRot').textContent=rot+'°';
  document.getElementById('ctrlLcScale').value=l.group.scale.x;
  document.getElementById('vLcScale').textContent=l.group.scale.x.toFixed(2);
}

[['ctrlLcX','vLcX','x'],['ctrlLcY','vLcY','y'],['ctrlLcZ','vLcZ','z']].forEach(([ci,vi,ax])=>{
  document.getElementById(ci).addEventListener('input',e=>{
    document.getElementById(vi).textContent=parseFloat(e.target.value).toFixed(2);
    if(layerSel&&uploadedLayers[layerSel])uploadedLayers[layerSel].group.position[ax]=+e.target.value;
  });
});
document.getElementById('ctrlLcRot').addEventListener('input',e=>{
  document.getElementById('vLcRot').textContent=e.target.value+'°';
  if(layerSel&&uploadedLayers[layerSel])uploadedLayers[layerSel].group.rotation.y=THREE.MathUtils.degToRad(+e.target.value);
});
document.getElementById('ctrlLcScale').addEventListener('input',e=>{
  document.getElementById('vLcScale').textContent=parseFloat(e.target.value).toFixed(2);
  if(layerSel&&uploadedLayers[layerSel])uploadedLayers[layerSel].group.scale.setScalar(+e.target.value);
});
document.getElementById('layerDelBtn').addEventListener('click',()=>{if(layerSel)deleteLayer(layerSel);});

function buildPropGeo(type){
  if(type==='leaf'){const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(.3,.5,.2,1,0,1.4);s.bezierCurveTo(-.2,1,-.3,.5,0,0);return new THREE.ShapeGeometry(s,12);}
  if(type==='stone'){const g=new THREE.SphereGeometry(.3,8,6);const pos=g.attributes.position;for(let i=0;i<pos.count;i++){pos.setXYZ(i,pos.getX(i)*(1+Math.random()*.18),pos.getY(i)*(1+Math.random()*.12),pos.getZ(i)*(1+Math.random()*.18));}pos.needsUpdate=true;g.computeVertexNormals();return g;}
  if(type==='fabric'){return new THREE.PlaneGeometry(1.2,1.2,12,12);}
  if(type==='crystal'){return new THREE.OctahedronGeometry(.35,0);}
  if(type==='block'){return new THREE.BoxGeometry(.6,.4,.4);}
  if(type==='sphere'){return new THREE.SphereGeometry(.25,20,20);}
  return new THREE.BoxGeometry(.4,.4,.4);
}
function addProp(type){
  propIdCnt++;const id='p'+propIdCnt;
  const geo=buildPropGeo(type);
  const def=PROP_DEFAULTS[type]||{color:'#aaaaaa'};
  const mat=new THREE.MeshStandardMaterial({color:def.color,roughness:.7,metalness:type==='crystal'?.1:0,transparent:type==='crystal',opacity:type==='crystal'?.75:1,side:type==='fabric'?THREE.DoubleSide:THREE.FrontSide});
  const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;
  const names={leaf:'Yaprak',stone:'Taş',fabric:'Kumaş',crystal:'Kristal',block:'Blok',sphere:'Küre'};
  const g=new THREE.Group();g.add(mesh);scene.add(g);
  propsMap[id]={type,group:g,mesh,name:(names[type]||type)+' '+(propIdCnt)};
  // Add to list
  const li=document.createElement('div');li.className='prop-item';li.dataset.id=id;
  li.innerHTML='<span class="prop-item-name">'+t(names[type]||type)+' '+propIdCnt+'</span><button class="prop-rm-btn" title="'+t('Sil')+'">✕</button>';
  li.addEventListener('click',e=>{if(e.target.classList.contains('prop-rm-btn'))return;selectProp(id);});
  li.querySelector('.prop-rm-btn').addEventListener('click',e=>{e.stopPropagation();removeProp(id);});
  document.getElementById('propList').appendChild(li);
  selectProp(id);toast((names[type]||type)+' eklendi');
}
function removeProp(id){
  const p=propsMap[id];if(!p)return;scene.remove(p.group);p.mesh.geometry.dispose();p.mesh.material.dispose();delete propsMap[id];
  const li=document.querySelector('.prop-item[data-id="'+id+'"]');if(li)li.remove();
  if(propSel===id){propSel=null;document.getElementById('propCtrlBox').style.display='none';}
}
function selectProp(id){
  propSel=id;document.querySelectorAll('.prop-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  const p=propsMap[id];if(!p){document.getElementById('propCtrlBox').style.display='none';return;}
  document.getElementById('propCtrlBox').style.display='block';document.getElementById('propCtrlTitle').textContent=p.name;
  document.getElementById('ctrlPropX').value=p.group.position.x;document.getElementById('vPropX').textContent=p.group.position.x.toFixed(1);
  document.getElementById('ctrlPropY').value=p.group.position.y;document.getElementById('vPropY').textContent=p.group.position.y.toFixed(2);
  document.getElementById('ctrlPropZ').value=p.group.position.z;document.getElementById('vPropZ').textContent=p.group.position.z.toFixed(1);
  const deg=Math.round(THREE.MathUtils.radToDeg(p.group.rotation.y));document.getElementById('ctrlPropRot').value=deg;document.getElementById('vPropRot').textContent=deg+'°';
  document.getElementById('ctrlPropScale').value=p.group.scale.x;document.getElementById('vPropScale').textContent=p.group.scale.x.toFixed(2);
  document.getElementById('propColorPick').value='#'+p.mesh.material.color.getHexString();
}
document.querySelectorAll('.prop-add-btn').forEach(b=>b.addEventListener('click',()=>addProp(b.dataset.prop)));
[['ctrlPropX','vPropX','x',1],['ctrlPropY','vPropY','y',2],['ctrlPropZ','vPropZ','z',1]].forEach(([ci,vi,ax,dp])=>{document.getElementById(ci).addEventListener('input',e=>{const v=+e.target.value;document.getElementById(vi).textContent=v.toFixed(dp);if(propSel&&propsMap[propSel])propsMap[propSel].group.position[ax]=v;});});
document.getElementById('ctrlPropRot').addEventListener('input',e=>{document.getElementById('vPropRot').textContent=e.target.value+'°';if(propSel&&propsMap[propSel])propsMap[propSel].group.rotation.y=THREE.MathUtils.degToRad(+e.target.value);});
document.getElementById('ctrlPropScale').addEventListener('input',e=>{const v=+e.target.value;document.getElementById('vPropScale').textContent=v.toFixed(2);if(propSel&&propsMap[propSel])propsMap[propSel].group.scale.setScalar(v);});
document.getElementById('propColorPick').addEventListener('input',e=>{if(propSel&&propsMap[propSel])propsMap[propSel].mesh.material.color.set(e.target.value);});

/* ═══ SAHNE METNİ ═══ */
const textObjs={};let textIdCnt=0;
function addSceneText(txt,size,yPos,color){
  if(!txt.trim())return;
  textIdCnt++;const id='t'+textIdCnt;
  const c=document.createElement('canvas');c.width=512;c.height=128;const cx=c.getContext('2d');
  cx.clearRect(0,0,512,128);cx.fillStyle=color;cx.font='bold 64px Arial,sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(txt,256,64);
  const tex=new THREE.CanvasTexture(c);tex.needsUpdate=true;
  const geo=new THREE.PlaneGeometry(size*2,size*.5);const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(0,yPos,0);mesh.rotation.x=-Math.PI/12;scene.add(mesh);
  textObjs[id]={mesh,tex,txt};
  const li=document.createElement('div');li.className='text-item';li.dataset.id=id;
  li.innerHTML='<span class="text-item-label">'+txt+'</span><button class="text-rm-btn" title="'+t('Sil')+'">✕</button>';
  li.querySelector('.text-rm-btn').addEventListener('click',()=>removeSceneText(id));
  document.getElementById('textList').appendChild(li);
}
function removeSceneText(id){const t=textObjs[id];if(!t)return;scene.remove(t.mesh);t.mesh.geometry.dispose();t.mesh.material.dispose();t.tex.dispose();delete textObjs[id];const li=document.querySelector('.text-item[data-id="'+id+'"]');if(li)li.remove();}
document.getElementById('sceneTextAddBtn').addEventListener('click',()=>{const txt=document.getElementById('sceneTextInput').value.trim();if(!txt)return;addSceneText(txt,+document.getElementById('ctrlTextSize').value,+document.getElementById('ctrlTextY').value,document.getElementById('textColorPick').value);document.getElementById('sceneTextInput').value='';});
document.getElementById('ctrlTextSize').addEventListener('input',e=>document.getElementById('vTextSize').textContent=parseFloat(e.target.value).toFixed(1));
document.getElementById('ctrlTextY').addEventListener('input',e=>document.getElementById('vTextY').textContent=parseFloat(e.target.value).toFixed(2));

/* ═══ POST ═══ */
let postState={bloom:false,bloomStr:.4,vig:false,vigAmt:.5,grain:false,grainAmt:.35,bright:1,contrast:1,sat:1,hue:0};
function applyPost(){let f=`brightness(${postState.bright}) contrast(${postState.contrast}) saturate(${postState.sat}) hue-rotate(${postState.hue}deg)`;if(postState.bloom)f+=` drop-shadow(0 0 ${postState.bloomStr*14}px rgba(255,240,180,${postState.bloomStr*.35}))`;canvas.style.filter=f;document.getElementById('vignetteOverlay').style.opacity=postState.vig?postState.vigAmt:'0';}
const grainCanvas=document.getElementById('grainCanvas');let grainCtx=grainCanvas.getContext('2d'),grainAnimId=null;
function drawGrain(){grainCanvas.width=innerWidth;grainCanvas.height=innerHeight;const id=grainCtx.createImageData(innerWidth,innerHeight);const d=id.data;const amt=postState.grainAmt*200;for(let i=0;i<d.length;i+=4){const v=Math.random()*amt-amt/2;d[i]=128+v;d[i+1]=128+v;d[i+2]=128+v;d[i+3]=255;}grainCtx.putImageData(id,0,0);if(postState.grain)grainAnimId=requestAnimationFrame(drawGrain);}
function startGrain(){grainCanvas.style.opacity=postState.grainAmt*.6;if(!grainAnimId)drawGrain();}
function stopGrain(){grainCanvas.style.opacity=0;cancelAnimationFrame(grainAnimId);grainAnimId=null;}
document.getElementById('bloomToggle').addEventListener('change',e=>{postState.bloom=e.target.checked;const bc=document.getElementById('bloomControls');bc.style.opacity=e.target.checked?'1':'.3';bc.style.pointerEvents=e.target.checked?'auto':'none';applyPost();});
document.getElementById('ctrlBloomStr').addEventListener('input',e=>{postState.bloomStr=+e.target.value;document.getElementById('vBloomStr').textContent=(+e.target.value).toFixed(2);applyPost();});
document.getElementById('vigToggle').addEventListener('change',e=>{postState.vig=e.target.checked;const vc=document.getElementById('vigControls');vc.style.opacity=e.target.checked?'1':'.3';vc.style.pointerEvents=e.target.checked?'auto':'none';applyPost();});
document.getElementById('ctrlVig').addEventListener('input',e=>{postState.vigAmt=+e.target.value;document.getElementById('vVig').textContent=(+e.target.value).toFixed(2);applyPost();});
document.getElementById('grainToggle').addEventListener('change',e=>{postState.grain=e.target.checked;const gc=document.getElementById('grainControls');gc.style.opacity=e.target.checked?'1':'.3';gc.style.pointerEvents=e.target.checked?'auto':'none';if(e.target.checked)startGrain();else stopGrain();});
document.getElementById('ctrlGrain').addEventListener('input',e=>{postState.grainAmt=+e.target.value;document.getElementById('vGrain').textContent=(+e.target.value).toFixed(2);if(postState.grain)grainCanvas.style.opacity=postState.grainAmt*.6;});
document.getElementById('ctrlBright').addEventListener('input',e=>{postState.bright=+e.target.value;document.getElementById('vBright').textContent=(+e.target.value).toFixed(2);applyPost();});
document.getElementById('ctrlContrast').addEventListener('input',e=>{postState.contrast=+e.target.value;document.getElementById('vContrast').textContent=(+e.target.value).toFixed(2);applyPost();});
document.getElementById('ctrlSat').addEventListener('input',e=>{postState.sat=+e.target.value;document.getElementById('vSat').textContent=(+e.target.value).toFixed(2);applyPost();});
document.getElementById('ctrlHue').addEventListener('input',e=>{postState.hue=+e.target.value;document.getElementById('vHue').textContent=e.target.value+'°';applyPost();});
document.getElementById('btnResetPost').addEventListener('click',()=>{postState={bloom:false,bloomStr:.4,vig:false,vigAmt:.5,grain:false,grainAmt:.35,bright:1,contrast:1,sat:1,hue:0};['bloomToggle','vigToggle','grainToggle'].forEach(id=>document.getElementById(id).checked=false);document.getElementById('bloomControls').style.opacity='.3';document.getElementById('bloomControls').style.pointerEvents='none';document.getElementById('vigControls').style.opacity='.3';document.getElementById('vigControls').style.pointerEvents='none';document.getElementById('grainControls').style.opacity='.3';document.getElementById('grainControls').style.pointerEvents='none';stopGrain();applyPost();toast('Post sıfırlandı');});

/* ═══ KAMERA ═══ */
document.getElementById('ctrlFov').addEventListener('input',e=>{camera.fov=+e.target.value;camera.updateProjectionMatrix();document.getElementById('vFov').textContent=e.target.value+'°';});
let curAR='free';
const AR_RATIOS={'1:1':[1,1],'4:5':[4,5],'3:2':[3,2],'16:9':[16,9],'free':null};
document.querySelectorAll('.ar-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.ar-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');curAR=btn.dataset.ar;updateARFrame();});});
function updateARFrame(){const frame=document.getElementById('arFrame');const ratio=AR_RATIOS[curAR];const showFrame=document.getElementById('arFrameToggle').checked&&ratio;if(!showFrame){frame.style.display='none';return;}frame.style.display='block';const W=innerWidth,H=innerHeight;const [rw,rh]=ratio;const ar=rw/rh;let fw,fh;if(W/H>ar){fh=H;fw=fh*ar;}else{fw=W;fh=fw/ar;}frame.style.width=fw+'px';frame.style.height=fh+'px';frame.style.left=((W-fw)/2)+'px';frame.style.top=((H-fh)/2)+'px';}
document.getElementById('thirdsToggle').addEventListener('change',e=>{document.getElementById('thirdsGrid').style.display=e.target.checked?'block':'none';});
document.getElementById('arFrameToggle').addEventListener('change',updateARFrame);

/* ═══ HİSTOGRAM ═══ */
let histAnimId=null;
const histCanvas=document.getElementById('histCanvas');const histCtx=histCanvas.getContext('2d');
const histWrap=document.getElementById('histWrap');
function drawHistogram(){
  const w=histCanvas.width=histCanvas.offsetWidth*devicePixelRatio||200;const h=histCanvas.height=52*devicePixelRatio;
  const R=new Array(256).fill(0),G=new Array(256).fill(0),B=new Array(256).fill(0);
  try{
    const pw=Math.min(canvas.width,320),ph=Math.min(canvas.height,240);
    const tmpC=document.createElement('canvas');tmpC.width=pw;tmpC.height=ph;
    const tmpX=tmpC.getContext('2d');tmpX.drawImage(canvas,0,0,pw,ph);
    const imgd=tmpX.getImageData(0,0,pw,ph).data;
    for(let i=0;i<imgd.length;i+=4){R[imgd[i]]++;G[imgd[i+1]]++;B[imgd[i+2]]++;}
  }catch(e){}
  const mx=Math.max(...R,...G,...B)||1;
  histCtx.fillStyle='rgba(0,0,0,.7)';histCtx.fillRect(0,0,w,h);
  [R,G,B].forEach((arr,ci)=>{
    histCtx.beginPath();histCtx.strokeStyle=['rgba(220,60,60,.8)','rgba(60,220,60,.8)','rgba(60,100,220,.8)'][ci];histCtx.lineWidth=1;
    for(let i=0;i<256;i++){const x=(i/255)*w;const y=h-(arr[i]/mx)*h;i===0?histCtx.moveTo(x,y):histCtx.lineTo(x,y);}histCtx.stroke();
  });
  if(histAnimId)histAnimId=requestAnimationFrame(drawHistogram);
}
document.getElementById('histToggle').addEventListener('change',e=>{
  histWrap.style.display=e.target.checked?'block':'none';
  if(e.target.checked){histAnimId=1;drawHistogram();}else{histAnimId=null;}
});

/* ═══ IŞIK SİSTEMİ ═══ */
const LT=new THREE.Vector3(0,1.15,0);let lCnt=0;const lightObjects={};let equipHidden=false;let beams=true;let activeId=null;const ldp=document.getElementById('lightDetailPanel');

/* === PROPS - önceden tanımla, animate(0)'dan önce === */
const propObjects={};
let propIdCounter=0;
const propGroup=new THREE.Group();
scene.add(propGroup);

/* === BOKEH - önceden tanımla === */
let composer=null;
let bokehPass=null;
function kelvinToHex(K){K=Math.max(1000,Math.min(10000,K));const t=K/100;let r,g,b;if(t<=66){r=255;g=Math.round(99.4708025861*Math.log(t)-161.1195681661);b=t<=19?0:Math.round(138.5177312231*Math.log(t-10)-305.0447927307);}else{r=Math.round(329.698727446*Math.pow(t-60,-0.1332047592));g=Math.round(288.1221695283*Math.pow(t-60,-0.0755148492));b=255;}return '#'+[Math.min(255,Math.max(0,r)),Math.min(255,Math.max(0,g)),Math.min(255,Math.max(0,b))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function kelvinToThreeColor(K){return new THREE.Color(kelvinToHex(K));}
function p2p(h,v,d){const hr=THREE.MathUtils.degToRad(h),vr=THREE.MathUtils.degToRad(v);return new THREE.Vector3(d*Math.cos(vr)*Math.sin(hr),d*Math.sin(vr),d*Math.cos(vr)*Math.cos(hr));}
const DIFF_OFFSETS=[[0,0],[1,0],[-1,0],[0,1],[0,-1]];

function buildLight(sp){
  lCnt++;const id='l'+lCnt;const kelvin=sp.kelvin??5600;const col=kelvinToThreeColor(kelvin);
  const cfg={id,label:sp.label,color:col,kelvin,maxI:6,defPow:sp.power,ps:sp.ps||[1.1,1.4]};
  const params={hAngle:sp.hAngle,vAngle:sp.vAngle,dist:sp.dist,spread:sp.spread,pen:sp.pen??0.45,blur:sp.blur??6,decay:sp.decay??1,diffOn:sp.diffOn??false,diffR:sp.diffR??0.6,diffD:sp.diffD??0.5,diffO:sp.diffO??0.55};
  const defs=Object.assign({},params);
  const pos=p2p(params.hAngle,params.vAngle,params.dist);
  const ang=THREE.MathUtils.degToRad(params.spread);
  const dir=LT.clone().sub(pos).normalize();
  const sg=new THREE.Group();
  const boxDepth=0.5;const backGeo=new THREE.CylinderGeometry(0.05,0.707,boxDepth,4);
  backGeo.rotateX(Math.PI/2);backGeo.rotateZ(Math.PI/4);backGeo.translate(0,0,-boxDepth/2);backGeo.scale(cfg.ps[0],cfg.ps[1],1);
  sg.add(new THREE.Mesh(backGeo,new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9,metalness:0.2})));
  const mountGeo=new THREE.CylinderGeometry(0.04,0.04,0.15,16);mountGeo.rotateX(Math.PI/2);mountGeo.translate(0,0,-boxDepth-0.075);
  sg.add(new THREE.Mesh(mountGeo,new THREE.MeshStandardMaterial({color:0x333333,roughness:0.6,metalness:0.8})));
  const pm=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.81});
  sg.add(new THREE.Mesh(new THREE.PlaneGeometry(cfg.ps[0]*.96,cfg.ps[1]*.96),pm));
  sg.position.copy(pos);sg.lookAt(LT);scene.add(sg);
  const lh=Math.max(.05,pos.y);const leg=new THREE.Group();
  const legMat=new THREE.MeshStandardMaterial({color:0x111111,metalness:0.7,roughness:0.4});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.015,.03,lh,8),legMat);pole.position.set(0,lh/2,0);leg.add(pole);
  const tMat=new THREE.MeshStandardMaterial({color:0x222222,metalness:0.8,roughness:0.5});
  for(let i=0;i<3;i++){const tLeg=new THREE.Mesh(new THREE.CylinderGeometry(.015,.01,0.4,8),tMat);tLeg.rotation.x=Math.PI/2.5;tLeg.position.set(0,0.15,0.15);const pivot=new THREE.Group();pivot.rotation.y=(i*Math.PI*2)/3;pivot.add(tLeg);leg.add(pivot);}
  leg.position.set(pos.x,0,pos.z);scene.add(leg);
  const spot=new THREE.SpotLight(cfg.color,cfg.defPow/100*cfg.maxI,22,ang,params.pen,params.decay);spot.position.copy(pos);
  const tgt=new THREE.Object3D();tgt.position.copy(LT);scene.add(tgt);spot.target=tgt;
  spot.castShadow=true;spot.shadow.mapSize.set(4096,4096);spot.shadow.bias=-0.0004;spot.shadow.normalBias=0.06;spot.shadow.radius=Math.max(5,params.blur);spot.shadow.camera.near=0.5;spot.shadow.camera.far=20;scene.add(spot);
  const bl=pos.distanceTo(LT),br=Math.tan(ang)*bl;
  const coneGeo=new THREE.ConeGeometry(br,bl,28,1,true);coneGeo.translate(0,-bl/2,0);
  const coneMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const cone=new THREE.Mesh(coneGeo,coneMat);cone.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir));cone.position.copy(pos);scene.add(cone);
  const up=new THREE.Vector3(0,1,0);const right=new THREE.Vector3().crossVectors(dir,up).normalize();const upDir=new THREE.Vector3().crossVectors(right,dir).normalize();
  const areaSpots=[];for(let i=0;i<5;i++){const as=new THREE.SpotLight(cfg.color,0,22,ang+0.18,0.9,params.decay);as.castShadow=false;const at=new THREE.Object3D();at.position.copy(LT);scene.add(at);as.target=at;scene.add(as);areaSpots.push({spot:as,tgt:at});}
  const diffMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:params.diffO,side:THREE.DoubleSide,depthWrite:false});
  const diffRingMat=new THREE.MeshBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.6,side:THREE.DoubleSide});
  const diffGroup=new THREE.Group();diffGroup.add(new THREE.Mesh(new THREE.CircleGeometry(params.diffR,48),diffMat),new THREE.Mesh(new THREE.RingGeometry(params.diffR,params.diffR+.018,48),diffRingMat));
  const dpos=pos.clone().lerp(LT,params.diffD);diffGroup.position.copy(dpos);diffGroup.lookAt(pos);diffGroup.visible=params.diffOn&&!equipHidden;scene.add(diffGroup);
  lightObjects[id]={spot,pm,cone,sg,leg,cfg,params,defs,curPow:cfg.defPow,diffGroup,diffMat,diffRingMat,areaSpots,right,upDir};_updateAreaSpots(id);return id;
}
function _updateAreaSpots(id){const o=lightObjects[id];const{params,areaSpots,cfg,curPow}=o;const pos=p2p(params.hAngle,params.vAngle,params.dist);const dir=LT.clone().sub(pos).normalize();const up=new THREE.Vector3(0,1,0);const r=new THREE.Vector3().crossVectors(dir,up).normalize();const u=new THREE.Vector3().crossVectors(r,dir).normalize();o.right.copy(r);o.upDir.copy(u);const dpos=pos.clone().lerp(LT,params.diffD);const baseI=(curPow/100)*cfg.maxI;const t=params.diffOn?params.diffO:0;o.spot.intensity=baseI*(1-t*0.7);o.spot.penumbra=params.pen;areaSpots.forEach((as,i)=>{const off=DIFF_OFFSETS[i];const spread=params.diffR*(i===0?0:1);const spos=dpos.clone().addScaledVector(r,off[0]*spread).addScaledVector(u,off[1]*spread);as.spot.position.copy(spos);as.tgt.position.copy(LT);as.spot.color.set(cfg.color);as.spot.intensity=t*(baseI/5)*1.4;as.spot.penumbra=0.95;as.spot.angle=THREE.MathUtils.degToRad(params.spread+12);as.spot.decay=params.decay;as.spot.visible=params.diffOn&&o.spot.visible;});}
function destroyLight(id){const o=lightObjects[id];if(!o)return;[o.sg,o.leg,o.spot,o.cone,o.diffGroup].forEach(x=>scene.remove(x));o.areaSpots.forEach(as=>{scene.remove(as.spot);scene.remove(as.tgt);});delete lightObjects[id];}
let goboCanvas = document.createElement('canvas');
goboCanvas.width = 512; goboCanvas.height = 512;
let goboCtx = goboCanvas.getContext('2d');
let goboTextures = {};

function getGoboTexture(type) {
  if (type === 'none') return null;
  if (goboTextures[type]) return goboTextures[type];
  goboCtx.fillStyle = 'black';
  goboCtx.fillRect(0,0,512,512);
  goboCtx.fillStyle = 'white';
  if (type === 'window') {
    for(let i=0; i<4; i++) {
      goboCtx.fillRect(50, 50 + i*110, 412, 80);
    }
  } else if (type === 'stripes') {
    for(let i=0; i<10; i++) {
      goboCtx.fillRect(10 + i*50, 0, 30, 512);
    }
  } else if (type === 'leaf') {
    goboCtx.beginPath();
    goboCtx.ellipse(256, 256, 100, 200, Math.PI/4, 0, Math.PI*2);
    goboCtx.ellipse(156, 356, 60, 120, -Math.PI/6, 0, Math.PI*2);
    goboCtx.fill();
    goboCtx.fillStyle = 'black';
    goboCtx.beginPath(); goboCtx.arc(220, 220, 20, 0, Math.PI*2); goboCtx.fill();
    goboCtx.beginPath(); goboCtx.arc(280, 280, 15, 0, Math.PI*2); goboCtx.fill();
  }
  let tex = new THREE.CanvasTexture(goboCanvas);
  goboTextures[type] = tex;
  return tex;
}

function buildLight(sp){
  lCnt++;const id='l'+lCnt;const kelvin=sp.kelvin??5600;const col=kelvinToThreeColor(kelvin);
  const cfg={id,label:sp.label,color:col,kelvin,maxI:6,defPow:sp.power,ps:sp.ps||[1.1,1.4]};
  const params={hAngle:sp.hAngle,vAngle:sp.vAngle,dist:sp.dist,spread:sp.spread,pen:sp.pen??0.45,blur:sp.blur??6,decay:sp.decay??1,diffOn:sp.diffOn??false,diffR:sp.diffR??0.6,diffD:sp.diffD??0.5,diffO:sp.diffO??0.55,lType:sp.lType??'rect',gobo:sp.gobo??'none'};
  const defs=Object.assign({},params);
  const pos=p2p(params.hAngle,params.vAngle,params.dist);
  const ang=THREE.MathUtils.degToRad(params.spread);
  const dir=LT.clone().sub(pos).normalize();
  const sg=new THREE.Group();
  const pm=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.81});
  sg.position.copy(pos);sg.lookAt(LT);scene.add(sg);
  const lh=Math.max(.05,pos.y);const leg=new THREE.Group();
  const legMat=new THREE.MeshStandardMaterial({color:0x111111,metalness:0.7,roughness:0.4});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.015,.03,lh,8),legMat);pole.position.set(0,lh/2,0);leg.add(pole);
  const tMat=new THREE.MeshStandardMaterial({color:0x222222,metalness:0.8,roughness:0.5});
  for(let i=0;i<3;i++){const tLeg=new THREE.Mesh(new THREE.CylinderGeometry(.015,.01,0.4,8),tMat);tLeg.rotation.x=Math.PI/2.5;tLeg.position.set(0,0.15,0.15);const pivot=new THREE.Group();pivot.rotation.y=(i*Math.PI*2)/3;pivot.add(tLeg);leg.add(pivot);}
  leg.position.set(pos.x,0,pos.z);scene.add(leg);
  const spot=new THREE.SpotLight(cfg.color,cfg.defPow/100*cfg.maxI,22,ang,params.pen,params.decay);spot.position.copy(pos);
  const tgt=new THREE.Object3D();tgt.position.copy(LT);scene.add(tgt);spot.target=tgt;
  spot.castShadow=true;spot.shadow.mapSize.set(4096,4096);spot.shadow.bias=-0.0004;spot.shadow.normalBias=0.06;spot.shadow.radius=Math.max(5,params.blur);spot.shadow.camera.near=0.5;spot.shadow.camera.far=20;scene.add(spot);
  const bl=pos.distanceTo(LT),br=Math.tan(ang)*bl;
  const coneGeo=new THREE.ConeGeometry(br,bl,28,1,true);coneGeo.translate(0,-bl/2,0);
  const coneMat=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const cone=new THREE.Mesh(coneGeo,coneMat);cone.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir));cone.position.copy(pos);scene.add(cone);
  const diffMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:params.diffO,side:THREE.DoubleSide,depthWrite:false});
  const diffRingMat=new THREE.MeshBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.6,side:THREE.DoubleSide});
  const diffGroup=new THREE.Group();diffGroup.add(new THREE.Mesh(new THREE.CircleGeometry(params.diffR,48),diffMat),new THREE.Mesh(new THREE.RingGeometry(params.diffR,params.diffR+.018,48),diffRingMat));
  const dpos=pos.clone().lerp(LT,params.diffD);diffGroup.position.copy(dpos);diffGroup.lookAt(pos);diffGroup.visible=params.diffOn&&!equipHidden;scene.add(diffGroup);
  lightObjects[id]={spot,pm,cone,sg,leg,cfg,params,defs,curPow:cfg.defPow,diffGroup,diffMat,diffRingMat,areaSpots:[],right:new THREE.Vector3(),upDir:new THREE.Vector3()};
  updateLP(id);return id;
}

function updateLP(id){const o=lightObjects[id];const{params,sg,leg,spot,cone,diffGroup,diffMat,cfg}=o;const pos=p2p(params.hAngle,params.vAngle,params.dist);const ang=THREE.MathUtils.degToRad(params.spread);const dir=LT.clone().sub(pos).normalize();sg.position.copy(pos);sg.lookAt(LT);
  while(sg.children.length > 0){ let child = sg.children[0]; if(child.geometry) child.geometry.dispose(); sg.remove(child); }
  const boxDepth=0.5;
  const mountGeo=new THREE.CylinderGeometry(0.04,0.04,0.15,16);mountGeo.rotateX(Math.PI/2);mountGeo.translate(0,0,-boxDepth-0.075);
  sg.add(new THREE.Mesh(mountGeo,new THREE.MeshStandardMaterial({color:0x333333,roughness:0.6,metalness:0.8})));
  if (params.lType === 'rect') {
    const backGeo=new THREE.CylinderGeometry(0.05,0.707,boxDepth,4);
    backGeo.rotateX(Math.PI/2);backGeo.rotateZ(Math.PI/4);backGeo.translate(0,0,-boxDepth/2);backGeo.scale(cfg.ps[0],cfg.ps[1],1);
    sg.add(new THREE.Mesh(backGeo,new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9,metalness:0.2})));
    sg.add(new THREE.Mesh(new THREE.PlaneGeometry(cfg.ps[0]*.96,cfg.ps[1]*.96),o.pm));
    diffGroup.visible=params.diffOn&&!equipHidden&&o.spot.visible;
  } else if (params.lType === 'ring') {
    const ringGeo = new THREE.TorusGeometry(cfg.ps[0]/2, 0.1, 16, 48);
    sg.add(new THREE.Mesh(ringGeo,new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9,metalness:0.2})));
    const lightRing = new THREE.Mesh(new THREE.TorusGeometry(cfg.ps[0]/2, 0.09, 16, 48), o.pm);
    lightRing.position.z = 0.02;
    sg.add(lightRing);
    diffGroup.visible = false;
  } else if (params.lType === 'octa') {
    const octaGeo = new THREE.ConeGeometry(cfg.ps[0]/1.5, boxDepth, 8);
    octaGeo.rotateX(-Math.PI/2); octaGeo.translate(0,0,-boxDepth/2);
    sg.add(new THREE.Mesh(octaGeo,new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9,metalness:0.2})));
    sg.add(new THREE.Mesh(new THREE.CircleGeometry(cfg.ps[0]/1.55, 8), o.pm));
    diffGroup.visible=params.diffOn&&!equipHidden&&o.spot.visible;
  } else if (params.lType === 'hard') {
    const hardGeo = new THREE.ConeGeometry(cfg.ps[0]/2.5, boxDepth/2, 16);
    hardGeo.rotateX(-Math.PI/2); hardGeo.translate(0,0,-boxDepth/4);
    sg.add(new THREE.Mesh(hardGeo,new THREE.MeshStandardMaterial({color:0x222222,roughness:0.3,metalness:0.9, side:THREE.DoubleSide})));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), o.pm);
    bulb.position.z = 0.05;
    sg.add(bulb);
    diffGroup.visible = false;
  }
  const lh=Math.max(.05,pos.y);if(leg.children[0].geometry) leg.children[0].geometry.dispose();leg.children[0].geometry=new THREE.CylinderGeometry(.015,.03,lh,8);leg.children[0].position.set(0,lh/2,0);leg.position.set(pos.x,0,pos.z);spot.position.copy(pos);
  if (params.lType === 'hard') { spot.angle=Math.min(ang, THREE.MathUtils.degToRad(30)); spot.penumbra=0.05; } else { spot.angle=ang; spot.penumbra=params.pen; }
  spot.decay=params.decay;spot.shadow.radius=Math.max(5,params.blur);spot.shadow.normalBias=0.06;
  spot.map = getGoboTexture(params.gobo);
  cone.geometry.dispose();const bl=pos.distanceTo(LT),br=Math.tan(ang)*bl;const ng=new THREE.ConeGeometry(br,bl,28,1,true);ng.translate(0,-bl/2,0);cone.geometry=ng;cone.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir));cone.position.copy(pos);const dpos=pos.clone().lerp(LT,params.diffD);diffGroup.position.copy(dpos);diffGroup.lookAt(pos);diffGroup.children[0].geometry.dispose();diffGroup.children[0].geometry=new THREE.CircleGeometry(params.diffR,48);diffGroup.children[1].geometry.dispose();diffGroup.children[1].geometry=new THREE.RingGeometry(params.diffR,params.diffR+.018,48);diffMat.opacity=params.diffO;_updateAreaSpots(id);}

function syncLDP(){if(!activeId||!lightObjects[activeId])return;const o=lightObjects[activeId];const{params,cfg}=o;document.getElementById('cHA').value=params.hAngle;document.getElementById('vHA').textContent=params.hAngle+'°';document.getElementById('cVA').value=params.vAngle;document.getElementById('vVA').textContent=params.vAngle+'°';document.getElementById('cDist').value=params.dist;document.getElementById('vDist').textContent=params.dist.toFixed(1)+'m';document.getElementById('cSpread').value=params.spread;document.getElementById('vSpread').textContent=params.spread+'°';document.getElementById('cPen').value=params.pen;document.getElementById('vPen').textContent=params.pen.toFixed(2);document.getElementById('cBlur').value=params.blur;document.getElementById('vBlur').textContent=params.blur.toFixed(1);document.getElementById('cDecay').value=params.decay;document.getElementById('vDecay').textContent=params.decay.toFixed(1);document.getElementById('cDiffOn').checked=params.diffOn;document.getElementById('diffControls').classList.toggle('disabled',!params.diffOn);document.getElementById('cDiffR').value=params.diffR;document.getElementById('vDiffR').textContent=params.diffR.toFixed(2)+'m';document.getElementById('cDiffD').value=params.diffD;document.getElementById('vDiffD').textContent=Math.round(params.diffD*100)+'%';document.getElementById('cDiffO').value=params.diffO;document.getElementById('vDiffO').textContent=params.diffO.toFixed(2);document.getElementById('cLightType').value=params.lType;document.getElementById('cGobo').value=params.gobo;const hx='#'+cfg.color.getHexString();document.getElementById('ldpDot').style.cssText='background:'+hx+';color:'+hx;document.getElementById('ldpName').textContent=cfg.label;}
function openLDP(id){activeId=id;ldp.classList.add('visible');syncLDP();document.querySelectorAll('.light-card').forEach(c=>c.classList.toggle('active',c.dataset.id===id));}
function closeLDP(){activeId=null;ldp.classList.remove('visible');document.querySelectorAll('.light-card').forEach(c=>c.classList.remove('active'));}
document.getElementById('ldpClose').addEventListener('click',closeLDP);
[['cHA','vHA','hAngle','°'],['cVA','vVA','vAngle','°'],['cDist','vDist','dist','m'],['cSpread','vSpread','spread','°'],['cPen','vPen','pen',''],['cBlur','vBlur','blur',''],['cDecay','vDecay','decay','']].forEach(([ci,vi,pk,u])=>{document.getElementById(ci).addEventListener('input',()=>{if(!activeId||!lightObjects[activeId])return;const v=+document.getElementById(ci).value;lightObjects[activeId].params[pk]=v;document.getElementById(vi).textContent=u==='m'?v.toFixed(1)+'m':u==='°'?v+'°':v.toFixed(2);updateLP(activeId);});});
if (document.getElementById('cLightType')) {
  document.getElementById('cLightType').addEventListener('change', e=>{
    if(!activeId||!lightObjects[activeId])return;
    lightObjects[activeId].params.lType = e.target.value;
    updateLP(activeId);
  });
}
if (document.getElementById('cGobo')) {
  document.getElementById('cGobo').addEventListener('change', e=>{
function buildCard(id){const o=lightObjects[id];const hx='#'+o.cfg.color.getHexString();const card=document.createElement('div');card.className='light-card';card.dataset.id=id;const head=document.createElement('div');head.className='light-card-head';const dot=document.createElement('span');dot.className='dot';dot.style.background=hx;dot.style.color=hx;const ni=document.createElement('input');ni.type='text';ni.className='light-name';ni.value=t(o.cfg.label);ni.addEventListener('click',e=>e.stopPropagation());ni.addEventListener('input',e=>{o.cfg.label=e.target.value;if(activeId===id)document.getElementById('ldpName').textContent=e.target.value;});ni.addEventListener('keydown',e=>{if(e.key==='Enter')ni.blur();});const sl=document.createElement('label');sl.className='switch';sl.addEventListener('click',e=>e.stopPropagation());const si=document.createElement('input');si.type='checkbox';si.checked=true;const ss=document.createElement('span');ss.className='slider-toggle';sl.append(si,ss);head.append(dot,ni,sl);const ar=document.createElement('div');ar.className='card-actions';const db=document.createElement('button');db.className='card-action-btn';db.textContent='📋 '+t('Kopya');const dlb=document.createElement('button');dlb.className='card-action-btn del';dlb.textContent='🗑 '+t('Sil');db.addEventListener('click',e=>{e.stopPropagation();dupL(id);});dlb.addEventListener('click',e=>{e.stopPropagation();delL(id);});ar.append(db,dlb);const pr=document.createElement('div');pr.className='power-row';const ps2=document.createElement('input');ps2.type='range';ps2.min=0;ps2.max=100;ps2.value=o.cfg.defPow;ps2.addEventListener('click',e=>e.stopPropagation());const pv=document.createElement('span');pv.className='power-value';pv.textContent=o.cfg.defPow+'%';pr.append(ps2,pv);const kr=document.createElement('div');kr.className='kelvin-row';const klRow=document.createElement('div');klRow.className='kelvin-label-row';const klLabel=document.createElement('span');klLabel.className='kelvin-label';klLabel.textContent='🌡️ '+t('Renk Sıcaklığı');const klVal=document.createElement('span');klVal.className='kelvin-val';klVal.textContent=(o.cfg.kelvin||5600)+'K';klRow.append(klLabel,klVal);const kt=document.createElement('div');kt.className='kelvin-track';const ks=document.createElement('input');ks.type='range';ks.min=1000;ks.max=10000;ks.step=50;ks.value=o.cfg.kelvin||5600;ks.addEventListener('click',e=>e.stopPropagation());ks.addEventListener('input',e=>{e.stopPropagation();const K=+e.target.value;o.cfg.kelvin=K;klVal.textContent=K+'K';const col=kelvinToThreeColor(K);o.cfg.color=col;o.spot.color.copy(col);o.pm.color.copy(col);o.cone.material.color.copy(col);o.areaSpots.forEach(as=>as.spot.color.copy(col));const hx2='#'+col.getHexString();dot.style.background=hx2;dot.style.color=hx2;if(activeId===id)document.getElementById('ldpDot').style.cssText='background:'+hx2+';color:'+hx2;});kt.append(ks);kr.append(klRow,kt);card.append(head,ar,pr,kr);card.addEventListener('click',()=>openLDP(id));si.addEventListener('change',e=>{const on=e.target.checked,ob=lightObjects[id];if(!ob)return;ob.spot.visible=on;ob.cone.visible=on&&beams&&!equipHidden;ob.sg.visible=on&&!equipHidden;ob.leg.visible=on&&!equipHidden;ob.diffGroup.visible=on&&ob.params.diffOn&&!equipHidden;ob.areaSpots.forEach(as=>{as.spot.visible=on&&ob.params.diffOn;});if(on){ob.pm.color.set(ob.cfg.color);ob.pm.opacity=.2+(ob.curPow/100)*.7;}else{ob.pm.color.set(0x222222);ob.pm.opacity=.5;}});ps2.addEventListener('input',e=>{const val=+e.target.value,ob=lightObjects[id];if(!ob)return;ob.curPow=val;if(ob.spot.visible)ob.pm.opacity=.2+(val/100)*.7;pv.textContent=val+'%';_updateAreaSpots(id);});return card;}
function addDOM(id){const ab=pc.querySelector('.add-card');pc.insertBefore(buildCard(id),ab);pc.querySelector('.light-card[data-id="'+id+'"]').scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});}
function delL(id){if(Object.keys(lightObjects).length<=1)return;if(activeId===id)closeLDP();destroyLight(id);const c=pc.querySelector('.light-card[data-id="'+id+'"]');if(c)c.remove();updTitle();}
function dupL(id){const o=lightObjects[id];if(!o)return;const nid=buildLight({label:o.cfg.label+' Kopya',kelvin:o.cfg.kelvin||5600,power:o.curPow,hAngle:o.params.hAngle+20,vAngle:o.params.vAngle,dist:o.params.dist,spread:o.params.spread,pen:o.params.pen,blur:o.params.blur,decay:o.params.decay,diffOn:o.params.diffOn,diffR:o.params.diffR,diffD:o.params.diffD,diffO:o.params.diffO,ps:o.cfg.ps.slice()});addDOM(nid);updTitle();setTimeout(()=>openLDP(nid),80);}
function addL(){const ha=[120,-120,0,60,-60,160,-160,90,-90];const used=Object.values(lightObjects).map(o=>o.params.hAngle);let best=ha.find(a=>!used.some(u=>Math.abs(u-a)<30))||(Math.random()*360-180);const K=[5600,4500,6500,3200,7000][Math.floor(Math.random()*5)];const id=buildLight({label:'Yeni Işık',kelvin:K,power:60,hAngle:Math.round(best),vAngle:35,dist:4,spread:35,pen:.45,blur:6,decay:1,diffOn:false,diffR:.6,diffD:.5,diffO:.55,ps:[1.1,1.4]});addDOM(id);updTitle();setTimeout(()=>openLDP(id),80);}

/* ═══ SEKTÖREL PRESETLER ═══ */
const IND_PRESETS={
  cosmetics:[{label:'Key Light',kelvin:4500,power:70,hAngle:35,vAngle:40,dist:3.8,spread:45,pen:.8,blur:10,decay:1,diffOn:true,diffR:1.0,diffD:.45,diffO:.6,ps:[1.4,1.8]},{label:'Fill Light',kelvin:4500,power:35,hAngle:-40,vAngle:25,dist:3.5,spread:50,pen:.9,blur:10,decay:1,diffOn:true,diffR:1.2,diffD:.4,diffO:.55,ps:[1.2,1.5]},{label:'Top Light',kelvin:5600,power:45,hAngle:0,vAngle:75,dist:3.5,spread:40,pen:.7,blur:8,decay:1,diffOn:true,diffR:.8,diffD:.5,diffO:.5,ps:[1.0,1.4]}],
  electronics:[{label:'Key Light',kelvin:6500,power:90,hAngle:65,vAngle:45,dist:4.0,spread:25,pen:.2,blur:3,decay:1,diffOn:false,diffR:.5,diffD:.5,diffO:.5,ps:[1.2,1.6]},{label:'Rim Light',kelvin:7000,power:70,hAngle:-150,vAngle:55,dist:3.5,spread:20,pen:.15,blur:2,decay:1,diffOn:false,diffR:.4,diffD:.5,diffO:.5,ps:[1.0,1.2]},{label:'Accent',kelvin:6000,power:30,hAngle:0,vAngle:80,dist:5,spread:30,pen:.3,blur:4,decay:1,diffOn:false,diffR:.5,diffD:.5,diffO:.5,ps:[1.0,1.3]}],
  beverage:[{label:'Backlight',kelvin:3200,power:100,hAngle:180,vAngle:35,dist:4.5,spread:40,pen:.5,blur:5,decay:1,diffOn:true,diffR:.9,diffD:.4,diffO:.7,ps:[1.2,1.8]},{label:'Key Light',kelvin:4000,power:60,hAngle:55,vAngle:40,dist:4.0,spread:35,pen:.6,blur:7,decay:1,diffOn:true,diffR:.8,diffD:.45,diffO:.6,ps:[1.2,1.6]},{label:'Fill Light',kelvin:4000,power:30,hAngle:-60,vAngle:25,dist:3.8,spread:45,pen:.7,blur:8,decay:1,diffOn:false,diffR:.7,diffD:.5,diffO:.5,ps:[1.0,1.3]}],
  jewelry:[{label:'Top Spot',kelvin:6500,power:100,hAngle:0,vAngle:80,dist:3.5,spread:20,pen:.1,blur:2,decay:1,diffOn:false,diffR:.5,diffD:.5,diffO:.5,ps:[1.0,1.2]},{label:'Front Fill',kelvin:5600,power:80,hAngle:20,vAngle:35,dist:3.8,spread:30,pen:.2,blur:3,decay:1,diffOn:false,diffR:.5,diffD:.5,diffO:.5,ps:[1.0,1.3]},{label:'Left Rim',kelvin:7000,power:90,hAngle:-80,vAngle:45,dist:3.5,spread:25,pen:.15,blur:2,decay:1,diffOn:false,diffR:.4,diffD:.5,diffO:.5,ps:[1.0,1.2]},{label:'Right Rim',kelvin:7000,power:85,hAngle:100,vAngle:45,dist:3.5,spread:25,pen:.15,blur:2,decay:1,diffOn:false,diffR:.4,diffD:.5,diffO:.5,ps:[1.0,1.2]}],
  fashion:[{label:'Skylight',kelvin:5600,power:75,hAngle:0,vAngle:70,dist:5,spread:60,pen:.9,blur:12,decay:.8,diffOn:true,diffR:1.5,diffD:.4,diffO:.65,ps:[1.6,2.0]},{label:'Front Fill',kelvin:5600,power:40,hAngle:10,vAngle:25,dist:4.5,spread:55,pen:.85,blur:10,decay:.8,diffOn:true,diffR:1.2,diffD:.45,diffO:.6,ps:[1.4,1.8]}],
  dramatic:[{label:'Key Light',kelvin:3400,power:90,hAngle:90,vAngle:45,dist:4.2,spread:25,pen:.2,blur:3,decay:1.5,diffOn:false,diffR:.5,diffD:.5,diffO:.5,ps:[1.2,1.6]},{label:'Rim Light',kelvin:5600,power:30,hAngle:-170,vAngle:60,dist:4.0,spread:20,pen:.1,blur:2,decay:1.5,diffOn:false,diffR:.4,diffD:.5,diffO:.5,ps:[1.0,1.2]}],
};
function applyIndPreset(name){
  const lights=IND_PRESETS[name];if(!lights)return;
  Object.keys(lightObjects).forEach(id=>destroyLight(id));document.querySelectorAll('.light-card').forEach(c=>c.remove());
  lights.forEach(s=>{const id=buildLight(s);pc.insertBefore(buildCard(id),pc.querySelector('.add-card'));});
  updTitle();document.querySelectorAll('.ind-btn').forEach(b=>b.classList.toggle('active',b.dataset.ind===name));
  toast(({cosmetics:'💄 Kozmetik',electronics:'📱 Elektronik',beverage:'🍾 İçecek',jewelry:'💍 Takı',fashion:'👗 Moda',dramatic:'🎭 Dramatik'})[name]+' preset uygulandı');
  pushUndo();
}
document.querySelectorAll('.ind-btn').forEach(b=>b.addEventListener('click',()=>applyIndPreset(b.dataset.ind)));

/* INIT Lights */
const INIT=[
  {label:'Ana Işık (Key)',kelvin:5600,power:80,hAngle:58,vAngle:47,dist:4.4,spread:35,pen:.45,blur:6,decay:1,diffOn:false,diffR:.6,diffD:.5,diffO:.55,ps:[1.3,1.7]},
  {label:'Dolgu Işığı (Fill)',kelvin:4800,power:40,hAngle:-62,vAngle:28,dist:3.8,spread:42,pen:.65,blur:8,decay:1,diffOn:false,diffR:.7,diffD:.5,diffO:.55,ps:[1.0,1.3]},
  {label:'Kenar Işığı (Rim)',kelvin:6500,power:60,hAngle:180,vAngle:52,dist:4.0,spread:30,pen:.35,blur:5,decay:1,diffOn:false,diffR:.5,diffD:.5,diffO:.55,ps:[1.2,.5]},
];
INIT.forEach(s=>{const id=buildLight(s);pc.appendChild(buildCard(id));});
const ab=document.createElement('div');ab.className='add-card';ab.innerHTML='<svg width="20" height="20" viewBox="0 0 20 20"><line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>'+t('Işık')+'<br>'+t('Ekle')+'</span>';ab.addEventListener('click',addL);pc.appendChild(ab);updTitle();
document.getElementById('beamToggle').addEventListener('change',e=>{beams=e.target.checked;Object.values(lightObjects).forEach(o=>{o.cone.visible=beams&&o.spot.visible&&!equipHidden;});});
document.getElementById('beamToggle2').addEventListener('change',e=>{beams=e.target.checked;document.getElementById('beamToggle').checked=e.target.checked;Object.values(lightObjects).forEach(o=>{o.cone.visible=beams&&o.spot.visible&&!equipHidden;});});
document.getElementById('sheetPull').addEventListener('click',()=>document.getElementById('bottomSheet').classList.toggle('collapsed'));

/* === EKİPMAN GİZLE BUTONU === */
document.getElementById('hideEquipBtn').addEventListener('click',function(){
  equipHidden=!equipHidden;
  const btn=document.getElementById('hideEquipBtn');
  btn.classList.toggle('active',equipHidden);
  btn.textContent=equipHidden?'📂 Ekipmanı Göster':'📁 Ekipmanı Gizle';
  Object.values(lightObjects).forEach(function(o){
    const on=o.spot.visible;
    o.sg.visible=on&&!equipHidden;
    o.leg.visible=on&&!equipHidden;
    o.cone.visible=on&&beams&&!equipHidden;
    o.diffGroup.visible=on&&o.params.diffOn&&!equipHidden;
  });
  toast(equipHidden?'Ekipman gizlendi':'Ekipman görünür');
});

/* ═══ MULTI-ANGLE EXPORT ═══ */
const MA_PRESETS={front:{th:0,ph:Math.PI/2.25,r:7.6},tq:{th:Math.PI/4,ph:Math.PI/2.6,r:8.2},top:{th:Math.PI/3.4,ph:.42,r:9.2},side:{th:Math.PI/2,ph:Math.PI/2.8,r:7.8},back:{th:Math.PI,ph:Math.PI/2.6,r:7.6},low:{th:Math.PI/4,ph:Math.PI/1.7,r:7.2}};
const MA_LABELS={front:'önden',tq:'34-aci',top:'üstten',side:'yandan',back:'arkadan',low:'alçak'};
async function renderShot(W,th,ph,r){
  let H=W;
  if(typeof exportAspect!=='undefined'&&exportAspect){
    const [rw,rh]=exportAspect.split(':').map(Number);
    H=Math.round((W/rw)*rh);
  }
  const origW=innerWidth, origH=innerHeight;
  renderer.setSize(W,H,false);
  const prevSM=[];Object.values(lightObjects).forEach(o=>{prevSM.push({spot:o.spot,r:o.spot.shadow.radius});o.spot.shadow.mapSize.set(4096,4096);if(o.spot.shadow.map)o.spot.shadow.map.dispose();o.spot.shadow.map=null;});
  const sc=new THREE.PerspectiveCamera(camera.fov,W/H,.1,100);
  const CT2=new THREE.Vector3(0,1.25,0);sc.position.set(CT2.x+r*Math.sin(ph)*Math.sin(th),CT2.y+r*Math.cos(ph),CT2.z+r*Math.sin(ph)*Math.cos(th));sc.lookAt(CT2);
  renderer.render(scene,sc);
  const blob=await new Promise(res=>renderer.domElement.toBlob(res,'image/png'));
  prevSM.forEach(({spot,r})=>{spot.shadow.mapSize.set(4096,4096);if(spot.shadow.map)spot.shadow.map.dispose();spot.shadow.map=null;});
  renderer.setSize(origW,origH,false);
  return blob;
}
document.getElementById('maExportBtn').addEventListener('click',async()=>{
  const checks={front:'ma-front',tq:'ma-tq',top:'ma-top',side:'ma-side',back:'ma-back',low:'ma-low'};
  const selected=Object.entries(checks).filter(([,id])=>document.getElementById(id).checked).map(([k])=>k);
  if(!selected.length){toast('En az bir açı seçin');return;}
  const btn=document.getElementById('maExportBtn');btn.textContent='⏳ Hazırlanıyor…';btn.disabled=true;
  const W=parseInt(document.getElementById('qualitySelect').value,10);
  const prodName=usingDefault?'urun':(document.getElementById('piName').textContent.replace(/\.[^.]+$/,'').replace(/\s+/g,'_')||'urun');
  for(const key of selected){
    const p=MA_PRESETS[key];btn.textContent=`📷 ${MA_LABELS[key]}…`;
    const blob=await renderShot(W,p.th,p.ph,p.r);
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=prodName+'_'+MA_LABELS[key]+'_'+W+'px.png';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),3000);
    await new Promise(r=>setTimeout(r,400));
  }
  btn.textContent='✓ Tamamlandı!';setTimeout(()=>{btn.textContent='📤 Tüm Açıları Dışa Aktar';btn.disabled=false;},2000);toast(selected.length+' görüntü indirildi ✓');
});

/* ═══ ANİMASYON ═══ */
let turntableDir=1,turntableSpeed=1,lightPulseSpeed=0,pulseT=0;
let mediaRecorder=null,recChunks=[];
document.getElementById('ctrlTTSpeed').addEventListener('input',e=>{turntableSpeed=+e.target.value;document.getElementById('vTTSpeed').textContent=e.target.value+' rpm';});
document.getElementById('ctrlPulseSpeed').addEventListener('input',e=>{lightPulseSpeed=+e.target.value;document.getElementById('vPulseSpeed').textContent=e.target.value;});
document.getElementById('btnTTPlay').addEventListener('click',()=>{turntableActive=!turntableActive;document.getElementById('btnTTPlay').textContent=turntableActive?'⏸ Durdur':'▶ Döndür';document.getElementById('btnTTPlay').classList.toggle('active',turntableActive);});
document.getElementById('btnTTDir').addEventListener('click',()=>{turntableDir*=-1;toast(turntableDir>0?'↻ Saat yönü':'↺ Ters yön');});
document.getElementById('recBtn').addEventListener('click',()=>{
  if(!mediaRecorder||mediaRecorder.state==='inactive'){
    window.isRecording=true;
    const vq = document.getElementById('videoQuality').value;
    let rw=1920, rh=1080, fps=60, bps=15000000, label="1080p 60FPS";
    if(vq === '2k60'){ rw=2560; rh=1440; fps=60; bps=25000000; label="2K 60FPS"; }
    else if(vq === '4k30'){ rw=3840; rh=2160; fps=30; bps=50000000; label="4K 30FPS"; }

    const oldAspect=camera.aspect;
    camera.aspect=16/9;camera.updateProjectionMatrix();
    renderer.setSize(rw,rh,false);
    renderer.setPixelRatio(1);
    canvas.style.objectFit='contain';
    
    setTimeout(()=>{
      const stream=canvas.captureStream(fps);
      let mimeType='video/mp4',ext='.mp4';
      if(!MediaRecorder.isTypeSupported('video/mp4')){mimeType='video/webm;codecs=vp9';ext='.webm';}
      mediaRecorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:bps});
      recChunks=[];
      mediaRecorder.ondataavailable=e=>{if(e.data.size>0)recChunks.push(e.data);};
      mediaRecorder.onstop=()=>{
        window.isRecording=false;
        // Eski boyuta geri dön
        camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
        renderer.setSize(innerWidth,innerHeight);
        renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
        canvas.style.objectFit='fill';
        
        const blob=new Blob(recChunks,{type:mimeType});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download=`studio_${label.replace(' ','_')}_${Date.now()}${ext}`;
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        setTimeout(()=>URL.revokeObjectURL(url),3000);
        toast(`${label} Video kaydedildi 🎬`);
      };
      mediaRecorder.start();
      document.getElementById('recBtn').textContent='⏹ Durdur';
      document.getElementById('recBtn').classList.add('recording');
      if(!turntableActive){turntableActive=true;document.getElementById('btnTTPlay').textContent='⏸ Durdur';document.getElementById('btnTTPlay').classList.add('active');}
      toast(`🔴 ${label} Video kaydediliyor...`);
    },100);
  } else {
    mediaRecorder.stop();
    mediaRecorder=null;
    document.getElementById('recBtn').textContent='⏺ Video';
    document.getElementById('recBtn').classList.remove('recording');
  }
});

/* ═══ UNDO / REDO ═══ */
const undoStack=[],redoStack=[];
function captureState(){return JSON.stringify(Object.values(lightObjects).map(o=>({label:o.cfg.label,kelvin:o.cfg.kelvin||5600,power:o.curPow,hAngle:o.params.hAngle,vAngle:o.params.vAngle,dist:o.params.dist,spread:o.params.spread,pen:o.params.pen,blur:o.params.blur,decay:o.params.decay,diffOn:o.params.diffOn,diffR:o.params.diffR,diffD:o.params.diffD,diffO:o.params.diffO,ps:o.cfg.ps.slice()})));}
function pushUndo(){undoStack.push(captureState());if(undoStack.length>20)undoStack.shift();redoStack.length=0;updateUndoUI();}
function updateUndoUI(){document.getElementById('btnUndo').disabled=undoStack.length<2;document.getElementById('btnRedo').disabled=redoStack.length===0;}
function restoreState(s){const lights=JSON.parse(s);Object.keys(lightObjects).forEach(id=>destroyLight(id));document.querySelectorAll('.light-card').forEach(c=>c.remove());lights.forEach(sp=>{const id=buildLight(sp);pc.insertBefore(buildCard(id),pc.querySelector('.add-card'));});updTitle();}
document.getElementById('btnUndo').addEventListener('click',()=>{if(undoStack.length<2)return;redoStack.push(undoStack.pop());restoreState(undoStack[undoStack.length-1]);updateUndoUI();toast('Geri alındı');});
document.getElementById('btnRedo').addEventListener('click',()=>{if(!redoStack.length)return;const s=redoStack.pop();undoStack.push(s);restoreState(s);updateUndoUI();toast('İleri alındı');});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();document.getElementById('btnUndo').click();}if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();document.getElementById('btnRedo').click();}});
setTimeout(pushUndo,100);

/* ═══ KARŞILAŞTIRMA MODU ═══ */
let compareActive=false,comparePct=50;
const compCanvas=document.getElementById('comparisonCanvas');
const compLeft=document.getElementById('comparisonLeft');
const compDiv=document.getElementById('comparisonDivider');
function takeSnapshot(){
  const W=canvas.width,H=canvas.height;compCanvas.width=W;compCanvas.height=H;
  const cx=compCanvas.getContext('2d');cx.drawImage(canvas,0,0);
  compCanvas.style.width=innerWidth+'px';compCanvas.style.height=innerHeight+'px';
}
function setComparePct(p){comparePct=clamp(p,5,95);compLeft.style.width=comparePct+'%';compDiv.style.left=comparePct+'%';}
function toggleCompare(){
  compareActive=!compareActive;
  const ov=document.getElementById('comparisonOverlay');
  if(compareActive){takeSnapshot();ov.classList.add('active');setComparePct(50);document.getElementById('btnCompare').classList.add('active');}
  else{ov.classList.remove('active');document.getElementById('btnCompare').classList.remove('active');}
}
document.getElementById('btnCompare').addEventListener('click',toggleCompare);
document.getElementById('comparisonCloseBtn').addEventListener('click',()=>{compareActive=false;document.getElementById('comparisonOverlay').classList.remove('active');document.getElementById('btnCompare').classList.remove('active');});
let divDragging=false;
compDiv.addEventListener('pointerdown',e=>{divDragging=true;compDiv.setPointerCapture(e.pointerId);e.preventDefault();});
document.addEventListener('pointermove',e=>{if(!divDragging)return;setComparePct((e.clientX/innerWidth)*100);});
document.addEventListener('pointerup',()=>{divDragging=false;});

/* ═══ KAYDET / YÜKLE ═══ */
function getSceneJSON(){return JSON.stringify({version:10,lights:Object.values(lightObjects).map(o=>({label:o.cfg.label,kelvin:o.cfg.kelvin||5600,power:o.curPow,ps:o.cfg.ps.slice(),hAngle:o.params.hAngle,vAngle:o.params.vAngle,dist:o.params.dist,spread:o.params.spread,pen:o.params.pen,blur:o.params.blur,decay:o.params.decay,diffOn:o.params.diffOn,diffR:o.params.diffR,diffD:o.params.diffD,diffO:o.params.diffO})),material:{key:curMatKey,color:curColor,roughness:+document.getElementById('ctrlRoughness').value,metalness:+document.getElementById('ctrlMetalness').value,clearcoat:+document.getElementById('ctrlClearcoat').value,opacity:+document.getElementById('ctrlOpacity').value},camera:{fov:+document.getElementById('ctrlFov').value,th:camTh,ph:camPh,r:camR},post:Object.assign({},postState)},null,2);}
function loadSceneJSON(json){try{const d=JSON.parse(json);if(d.lights){Object.keys(lightObjects).forEach(id=>destroyLight(id));document.querySelectorAll('.light-card').forEach(c=>c.remove());d.lights.forEach(s=>{const id=buildLight(s);pc.insertBefore(buildCard(id),pc.querySelector('.add-card'));});updTitle();}if(d.material){curColor=d.material.color||curColor;curMatKey=d.material.key||curMatKey;document.getElementById('productColor').value=curColor;['roughness','metalness','clearcoat','opacity'].forEach(k=>{if(d.material[k]!==undefined){document.getElementById('ctrl'+k[0].toUpperCase()+k.slice(1)).value=d.material[k];document.getElementById('v'+k[0].toUpperCase()+k.slice(1)).textContent=d.material[k].toFixed(2);}});applyMat();}if(d.camera){camera.fov=d.camera.fov||40;camera.updateProjectionMatrix();document.getElementById('ctrlFov').value=d.camera.fov||40;document.getElementById('vFov').textContent=(d.camera.fov||40)+'°';if(d.camera.th!==undefined)camTh=d.camera.th;if(d.camera.ph!==undefined)camPh=d.camera.ph;if(d.camera.r!==undefined)camR=d.camera.r;updateCam();}toast(t('Sahne yüklendi ✓'));pushUndo();}catch(e){alert(t('Hata: ')+e.message);}}
document.getElementById('btnSave').addEventListener('click',async()=>{const blob=new Blob([getSceneJSON()],{type:'application/json'});try{const fh=await window.showSaveFilePicker({suggestedName:'studio_scene.json',types:[{description:'Studio Sahne',accept:{'application/json':['.json']}}]});const w=await fh.createWritable();await w.write(blob);await w.close();toast(t('Sahne kaydedildi ✓'));}catch(e){if(e.name!=='AbortError'){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='studio_scene.json';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),3000);toast(t('İndirildi ✓'));}}});
document.getElementById('btnLoad').addEventListener('click',()=>document.getElementById('sceneFileInput').click());
document.getElementById('sceneFileInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=ev=>loadSceneJSON(ev.target.result);reader.readAsText(f);e.target.value='';});
document.getElementById('btnShare').addEventListener('click',()=>{try{const b64=btoa(unescape(encodeURIComponent(getSceneJSON())));const url=location.href.split('#')[0]+'#scene='+b64;navigator.clipboard.writeText(url).then(()=>toast(t('Bağlantı kopyalandı ✓'))).catch(()=>toast(t('URL oluşturuldu')));} catch(e){toast(t('Paylaşım hatası'));}});
(function(){const h=location.hash;if(!h.startsWith('#scene='))return;try{const json=decodeURIComponent(escape(atob(h.slice(7))));setTimeout(()=>loadSceneJSON(json),300);}catch(e){}})();

/* ═══ AYDINLATMA DIYAGRAMI ═══ */
const diagCanvas=document.getElementById('diagCanvas');
let diagDragging=null;
function drawDiagram(ctx=null, isExport=false){
  if(!ctx) ctx = diagCanvas.getContext('2d');
  const W=ctx.canvas.width;
  const H=ctx.canvas.height;
  const CX=W/2, CY=H/2;
  const R=Math.min(W,H)/2 - (isExport?40:20);
  const maxDist = 8;
  const scale = R / maxDist;
  
  ctx.clearRect(0,0,W,H);
  
  // Arkaplan kılavuz çizgileri
  if(isExport){
    ctx.strokeStyle='rgba(0,0,0,0.08)';
    ctx.lineWidth=2;
    [2,4,6,8].forEach(d=>{
      ctx.beginPath();ctx.arc(CX,CY,d*scale,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.font='16px Arial';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText(`${d*100}cm`, CX, CY-d*scale-5);
    });
    // Merkez çaprazlar
    ctx.beginPath();ctx.moveTo(CX, CY-R);ctx.lineTo(CX, CY+R);ctx.stroke();
    ctx.beginPath();ctx.moveTo(CX-R, CY);ctx.lineTo(CX+R, CY);ctx.stroke();
  } else {
    ctx.strokeStyle='rgba(255,255,255,0.1)';
    ctx.lineWidth=1;
    [2,4,6,8].forEach(d=>{
      ctx.beginPath();ctx.arc(CX,CY,d*scale,0,Math.PI*2);ctx.stroke();
    });
  }
  
  // Ürün (Merkez)
  ctx.fillStyle='#d4912f';
  ctx.beginPath();
  ctx.arc(CX,CY,isExport?15:6,0,Math.PI*2);
  ctx.fill();
  
  // Işıklar
  Object.entries(lightObjects).forEach(([id,o])=>{
    if(!o.spot.visible) return;
    const hr = o.params.hAngle * Math.PI/180;
    const d = o.params.dist;
    const lx = CX + Math.sin(hr)*d*scale;
    const ly = CY + Math.cos(hr)*d*scale;
    
    // Çizgi
    ctx.strokeStyle=isExport?'rgba(0,0,0,0.2)':'rgba(255,255,255,0.3)';
    ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(lx,ly);ctx.stroke();
    ctx.setLineDash([]);
    
    // Nokta
    const c = o.cfg.color;
    ctx.fillStyle = `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
    ctx.beginPath();
    ctx.arc(lx,ly,isExport?14:7,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle=isExport?'#000':(diagDragging===id?'#d4912f':'#fff');
    ctx.lineWidth=isExport?3:2;
    ctx.stroke();
    
    // Etiket
    ctx.fillStyle = isExport?'#000':'#fff';
    ctx.font = isExport?'bold 24px Arial':'10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.cfg.label, lx, ly - (isExport?28:15));
    
    // Mesafe ve Açı (sadece exportta mesafe)
    if(isExport){
      ctx.fillStyle = '#555';
      ctx.font = '18px Arial';
      ctx.fillText(`${Math.round(d*100)}cm / ${Math.round(o.params.hAngle)}°`, lx, ly + 28);
    }
  });
}

function updateDiagCanvasSize(){
  const w=diagCanvas.offsetWidth;
  diagCanvas.width=w;diagCanvas.height=w;
  drawDiagram();
}
window.addEventListener('resize',()=>{
  if(document.getElementById('diagramPanel').classList.contains('visible')) updateDiagCanvasSize();
});
function getDiagPos(e){
  const r=diagCanvas.getBoundingClientRect();
  return {x:e.clientX-r.left, y:e.clientY-r.top};
}
diagCanvas.addEventListener('pointerdown', e=>{
  const {x,y}=getDiagPos(e);
  const W=diagCanvas.width, H=diagCanvas.height;
  const CX=W/2, CY=H/2;
  const scale = (Math.min(W,H)/2 - 20) / 8;
  let closest=null, minDist=999;
  Object.entries(lightObjects).forEach(([id,o])=>{
    if(!o.spot.visible) return;
    const hr = o.params.hAngle * Math.PI/180;
    const lx = CX + Math.sin(hr)*o.params.dist*scale;
    const ly = CY + Math.cos(hr)*o.params.dist*scale;
    const distSq = (x-lx)**2 + (y-ly)**2;
    if(distSq<20*20 && distSq<minDist){ minDist=distSq; closest=id; }
  });
  if(closest){
    diagDragging=closest;
    diagCanvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    drawDiagram();
  }
});
window.addEventListener('pointermove', e=>{
  if(!diagDragging||!lightObjects[diagDragging]) return;
  const {x,y}=getDiagPos(e);
  const W=diagCanvas.width, H=diagCanvas.height;
  const CX=W/2, CY=H/2;
  const scale = (Math.min(W,H)/2 - 20) / 8;
  const dx = x-CX, dy = y-CY;
  let dist = Math.sqrt(dx*dx + dy*dy) / scale;
  dist = clamp(dist, 2, 8);
  let angle = Math.atan2(dx, dy) * 180/Math.PI;
  const o = lightObjects[diagDragging];
  o.params.hAngle = Math.round(angle);
  o.params.dist = dist;
  updateLP(diagDragging);
  if(activeId===diagDragging) syncLDP();
  drawDiagram();
});
window.addEventListener('pointerup', ()=>{
  if(diagDragging){ diagDragging=null; drawDiagram(); }
});
window.addEventListener('pointercancel', ()=>{
  if(diagDragging){ diagDragging=null; drawDiagram(); }
});

document.getElementById('btnExportDiag').addEventListener('click', async()=>{
  const btn=document.getElementById('btnExportDiag');
  btn.textContent=t('Oluşturuluyor...');
  await new Promise(r=>setTimeout(r,50));
  const EW=2400;
  const activeLights=Object.values(lightObjects).filter(o=>o.spot.visible);
  const EH=EW + 250 + activeLights.length*75;
  const c=document.createElement('canvas');c.width=EW;c.height=EH;
  const ctx=c.getContext('2d');
  
  ctx.fillStyle='#f8f9fa';
  ctx.fillRect(0,0,EW,EH);
  
  ctx.save();
  ctx.translate(0, 50);
  ctx.beginPath();ctx.rect(0,0,EW,EW);ctx.clip();
  const dctx=document.createElement('canvas').getContext('2d');
  dctx.canvas.width=EW;dctx.canvas.height=EW;
  drawDiagram(dctx, true);
  ctx.drawImage(dctx.canvas,0,0);
  ctx.restore();
  
  let y = EW + 120;
  ctx.fillStyle='#111';
  ctx.font='bold 52px Arial';
  ctx.textAlign='left';
  ctx.fillText(t('Aydınlatma Stüdyosu - Rapor'), 80, y);
  
  y+=100;
  ctx.font='bold 28px Arial';
  ctx.fillStyle='#555';
  ctx.fillText(t('IŞIK'), 80, y);
  ctx.fillText(t('UZAKLIK'), 500, y);
  ctx.fillText(t('YATAY AÇI'), 750, y);
  ctx.fillText(t('DİKEY AÇI'), 1000, y);
  ctx.fillText(t('ŞİDDET'), 1250, y);
  ctx.fillText(t('RENK (K)'), 1500, y);
  ctx.fillText(t('DİĞER'), 1750, y);
  
  y+=25;
  ctx.beginPath();ctx.moveTo(80,y);ctx.lineTo(EW-80,y);ctx.strokeStyle='#ddd';ctx.lineWidth=3;ctx.stroke();
  y+=60;
  
  ctx.font='28px Arial';
  activeLights.forEach(o=>{
    ctx.fillStyle='#111';
    ctx.fillText(o.cfg.label, 80, y);
    ctx.fillText(`${Math.round(o.params.dist*100)} cm`, 500, y);
    ctx.fillText(`${Math.round(o.params.hAngle)}°`, 750, y);
    ctx.fillText(`${Math.round(o.params.vAngle)}°`, 1000, y);
    ctx.fillText(`${Math.round(o.curPow)}%`, 1250, y);
    ctx.fillText(`${Math.round(o.cfg.kelvin||5600)}K`, 1500, y);
    const sp = Math.round(o.params.spread);
    const pn = o.params.pen.toFixed(2);
    ctx.fillText(`${t('Açı')}: ${sp}°, ${t('Yumuşatma')}: ${pn}`, 1750, y);
    y+=75;
  });
  
  const blob = await new Promise(res=>c.toBlob(res,'image/jpeg',0.95));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');a.href=url;
  const prodName=usingDefault?'urun':(document.getElementById('piName').textContent.replace(/\.[^.]+$/,'').replace(/\s+/g,'_')||'urun');
  a.download=prodName + '_Aydinlatma_Raporu.jpg';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  btn.textContent=t('RAPORU İNDİR (JPG)');
});

/* ═══ TAKE A SHOT ═══ */
document.getElementById('shotBtn').addEventListener('click',async function(){
  const btn=this;btn.classList.add('shooting');btn.innerHTML='<span class="shot-icon">⏳</span> '+t('Render alınıyor…');
  await new Promise(r=>setTimeout(r,60));
  const W=parseInt(document.getElementById('qualitySelect').value,10);
  let H=W;
  if(typeof exportAspect!=='undefined'&&exportAspect){
    const [rw,rh]=exportAspect.split(':').map(Number);
    H=Math.round((W/rw)*rh);
  }
  const prevW=innerWidth, prevH=innerHeight;
  const prevAspect=camera.aspect;
  renderer.setSize(W,H,false);
  camera.aspect=W/H;camera.updateProjectionMatrix();
  const prevSM=[];Object.values(lightObjects).forEach(o=>{prevSM.push({spot:o.spot,r:o.spot.shadow.radius});o.spot.shadow.mapSize.set(8192,8192);o.spot.shadow.bias=-0.0003;o.spot.shadow.normalBias=0.05;o.spot.shadow.radius=8;if(o.spot.shadow.map)o.spot.shadow.map.dispose();o.spot.shadow.map=null;});
  
  renderer.render(scene,camera);
  const rb=await new Promise(res=>renderer.domElement.toBlob(res,'image/png'));
  
  prevSM.forEach(({spot,r})=>{spot.shadow.mapSize.set(4096,4096);spot.shadow.bias=-0.0004;spot.shadow.normalBias=0.06;spot.shadow.radius=Math.max(5,r);if(spot.shadow.map)spot.shadow.map.dispose();spot.shadow.map=null;});
  renderer.setSize(prevW,prevH,false);
  camera.aspect=prevAspect;camera.updateProjectionMatrix();
  
  const ppm=Math.round(300/0.0254);function u32BE(n){return[(n>>24)&255,(n>>16)&255,(n>>8)&255,n&255];}function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++){c^=b[i];for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  const ra=new Uint8Array(await rb.arrayBuffer());
  const phys=new Uint8Array([...u32BE(9),0x70,0x48,0x59,0x73,...u32BE(ppm),...u32BE(ppm),1,...u32BE(crc32([0x70,0x48,0x59,0x73,...u32BE(ppm),...u32BE(ppm),1]))]);
  const ins=33;const out=new Uint8Array(ra.length+phys.length);out.set(ra.slice(0,ins));out.set(phys,ins);out.set(ra.slice(ins),ins+phys.length);
  const blob=new Blob([out],{type:'image/png'});
  
  const prodName=usingDefault?'urun':(document.getElementById('piName').textContent.replace(/\.[^.]+$/,'').replace(/\s+/g,'_')||'urun');
  const fileName=prodName+'_shot_'+W+'x'+H+'_300dpi.png';
  btn.innerHTML='<span class="shot-icon">💾</span> '+t('Kaydediliyor…');
  try{const fh=await window.showSaveFilePicker({suggestedName:fileName,types:[{description:'PNG',accept:{'image/png':['.png']}}]});const w=await fh.createWritable();await w.write(blob);await w.close();btn.innerHTML='<span class="shot-icon">✓</span> '+t('Kaydedildi!');}
  catch(e){if(e.name!=='AbortError'){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),3000);btn.innerHTML='<span class="shot-icon">✓</span> '+t('İndirildi!');}else{btn.innerHTML='<span class="shot-icon">📷</span> '+t('Take a Shot');btn.classList.remove('shooting');return;}}
  btn.classList.remove('shooting');setTimeout(()=>{btn.innerHTML='<span class="shot-icon">📷</span> '+t('Take a Shot');},2500);
});

/* ═══ RENDER LOOP ═══ */
let lastTime=0;
let cinematicMode = false;
let cinematicSpeed = 0.3;
let hologramTime = 0;
let hologramMat = null;

function animate(t){
  requestAnimationFrame(animate);
  const dt=(t-lastTime)/1000;lastTime=t;
  if(turntableActive){camTh+=turntableDir*turntableSpeed*(Math.PI*2/60)*dt;updateCam();}
  if(cinematicMode){camTh+=cinematicSpeed*dt;updateCam();}
  if(trans){trans.t+=.045;const tt=Math.min(1,trans.t);const e=tt<.5?2*tt*tt:-1+(4-2*tt)*tt;camTh=lerp(trans.fTh,trans.tTh,e);camPh=lerp(trans.fPh,trans.tPh,e);camR=lerp(trans.fR,trans.tR,e);updateCam();if(tt>=1)trans=null;}
  if(lightPulseSpeed>0 && !isHologram){pulseT+=dt*lightPulseSpeed;const pulse=.8+.2*Math.sin(pulseT*Math.PI*2);Object.values(lightObjects).forEach(o=>{if(o.spot.visible)o.spot.intensity=((o.curPow/100)*o.cfg.maxI)*(1-(o.params.diffOn?o.params.diffO*.7:0))*pulse;});}
  if(mirrorActive&&cubeCamera2){fl.visible=false;if(mirrorFloorMesh)mirrorFloorMesh.visible=false;cubeCamera2.update(renderer,scene);fl.visible=false;if(mirrorFloorMesh)mirrorFloorMesh.visible=true;}
  
  if (hologramMat) {
    hologramTime += dt;
    hologramMat.uniforms.time.value = hologramTime;
  }

  const bokehEl=document.getElementById('bokehToggle');
  if(composer && bokehEl && bokehEl.checked){
    composer.render();
  } else {
    renderer.render(scene,camera);
  }
}
resize();updateCam();animate(0);

/* ═══════════════════════════════════════════════════
   v11 NEW FEATURES
═══════════════════════════════════════════════════ */

/* ── #35 FPS Counter ── */
let fpsSamples=[],fpsLast=performance.now(),fpsActive=false;
function updateFPS(){
  const now=performance.now();fpsSamples.push(1000/(now-fpsLast));fpsLast=now;
  if(fpsSamples.length>30)fpsSamples.shift();
  const avg=Math.round(fpsSamples.reduce((a,b)=>a+b,0)/fpsSamples.length);
  const el=document.getElementById('fpsCounter');
  el.textContent='FPS: '+avg;
  el.className='';
  if(avg>=50)el.classList.add('fps-good');
  else if(avg>=30)el.classList.add('fps-mid');
  else el.classList.add('fps-bad');
  if(fpsActive)requestAnimationFrame(updateFPS);
}
document.getElementById('btnFPS').addEventListener('click',()=>{
  fpsActive=!fpsActive;
  const el=document.getElementById('fpsCounter');
  el.style.display=fpsActive?'block':'none';
  if(fpsActive){fpsSamples=[];fpsLast=performance.now();updateFPS();}
  document.getElementById('btnFPS').classList.toggle('active',fpsActive);
  toast(fpsActive?t('FPS sayacı açık'):t('FPS sayacı kapalı'));
});

/* ── #15 Gece / Gündüz Modu ── */
let isDayMode=false;
document.getElementById('btnDayNight').addEventListener('click',()=>{
  isDayMode=!isDayMode;
  document.getElementById('btnDayNight').textContent=isDayMode?'🌙':'☀️';
  document.getElementById('btnDayNight').classList.toggle('active',isDayMode);
  if(isDayMode){
    scene.background=new THREE.Color(0xd8dde5);
    hemi.color.set(0x8899cc);hemi.groundColor.set(0x556677);hemi.intensity=0.9;
    if(typeof floorMat!=='undefined'){floorMat.color.set(0xe8e4de);floorMat.roughness=0.9;}
    toast(t('☀️ Gündüz modu'));
  } else {
    scene.background=new THREE.Color(0x121113);
    hemi.color.set(0x4a4a52);hemi.groundColor.set(0x0b0b0c);hemi.intensity=0.35;
    if(typeof floorMat!=='undefined'){floorMat.color.set(0xe9e5db);floorMat.roughness=0.95;}
    toast(t('🌙 Gece modu'));
  }
});

/* ── #13 Gradient Arka Plan ── */
function buildGradientTexture(c1,c2,vertical){
  const w=2,h=vertical?256:2;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const grd=vertical?ctx.createLinearGradient(0,0,0,h):ctx.createLinearGradient(0,0,w,0);
  grd.addColorStop(0,c1);grd.addColorStop(1,c2);
  ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
  const tex=new THREE.CanvasTexture(canvas);
  tex.needsUpdate=true;return tex;
}
function applyGradient(vertical){
  const c1=document.getElementById('gradTop').value;
  const c2=document.getElementById('gradBot').value;
  scene.background=buildGradientTexture(c1,c2,vertical);
  toast(t('🌈 Gradient uygulandı'));
}
document.getElementById('gradApplyV').addEventListener('click',()=>applyGradient(true));
document.getElementById('gradApplyH').addEventListener('click',()=>applyGradient(false));
document.getElementById('gradClear').addEventListener('click',()=>{scene.background=new THREE.Color(0x121113);document.querySelectorAll('.bg-swatch').forEach(s=>s.classList.toggle('active',s.dataset.bg==='studio'));toast(t('Gradient kaldırıldı'));});
['gradTop','gradBot'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{}));

/* ── #27 Arka Plan Resim Yükleme ── */
let bgImageTexture=null,bgPlane=null;
const bgImgZone=document.getElementById('bgImgZone');
const bgImgInput=document.getElementById('bgImgInput');
function loadBGImage(file){
  const reader=new FileReader();
  reader.onload=(e)=>{
    const dataUrl=e.target.result;
    new THREE.TextureLoader().load(dataUrl,tex=>{
      if(bgImageTexture)bgImageTexture.dispose();
      if(bgPlane){scene.remove(bgPlane);bgPlane.geometry.dispose();bgPlane.material.dispose();bgPlane=null;}
      bgImageTexture=tex;
      tex.encoding=THREE.sRGBEncoding;
      // Normal UV mapping kullan, böylece sahnenin arkasına 2D bir duvar kağıdı gibi gerilir.
      scene.background=tex;
      bw.visible=false;if(typeof sweepMesh!=='undefined'&&sweepMesh)sweepMesh.visible=false;
      document.getElementById('bgImgRemoveBtn').style.display='block';
      bgImgZone.querySelector('.drop-label').innerHTML='<strong>'+file.name+'</strong>';
      toast(t('🖼 Arka plan yüklendi ✓'));
    },undefined,err=>toast(t('Resim yükleme hatası')));
  };
  reader.readAsDataURL(file);
}
bgImgZone.addEventListener('click',()=>bgImgInput.click());
bgImgZone.addEventListener('dragover',e=>{e.preventDefault();bgImgZone.classList.add('over');});
bgImgZone.addEventListener('dragleave',()=>bgImgZone.classList.remove('over'));
bgImgZone.addEventListener('drop',e=>{e.preventDefault();bgImgZone.classList.remove('over');const f=e.dataTransfer.files[0];if(f)loadBGImage(f);});
bgImgInput.addEventListener('change',e=>{const f=e.target.files[0];if(f)loadBGImage(f);bgImgInput.value='';});

document.getElementById('bgImgRemoveBtn').addEventListener('click',()=>{
  if(bgImageTexture){bgImageTexture.dispose();bgImageTexture=null;}
  if(bgPlane){scene.remove(bgPlane);bgPlane.geometry.dispose();bgPlane.material.dispose();bgPlane=null;}
  bw.visible=true;if(document.getElementById('envModeSel')&&document.getElementById('envModeSel').value==='sweep'&&sweepMesh)sweepMesh.visible=true;
  document.getElementById('bgImgRemoveBtn').style.display='none';
  bgImgZone.querySelector('.drop-label').innerHTML='<strong>'+t('Resim sürükle')+'</strong> '+t('veya tıkla');
  toast(t('Arka plan kaldırıldı'));
});

/* ── #26 Zemin Deseni ── */
function buildFloorTexture(pattern){
  const S=512;const c=document.createElement('canvas');c.width=S;c.height=S;
  const ctx=c.getContext('2d');
  if(pattern==='none'){ctx.fillStyle='#e9e5db';ctx.fillRect(0,0,S,S);}
  else if(pattern==='marble'){
    const g=ctx.createLinearGradient(0,0,S,S);
    g.addColorStop(0,'#f5f5f5');g.addColorStop(.3,'#e8e8e8');g.addColorStop(.5,'#cccccc');g.addColorStop(.7,'#e0e0e0');g.addColorStop(1,'#f0f0f0');
    ctx.fillStyle=g;ctx.fillRect(0,0,S,S);
    ctx.strokeStyle='rgba(180,180,180,0.5)';ctx.lineWidth=1.5;
    for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(Math.random()*S,0);ctx.bezierCurveTo(Math.random()*S,S/3,Math.random()*S,S*2/3,Math.random()*S,S);ctx.stroke();}
  } else if(pattern==='wood'){
    for(let y=0;y<S;y++){const v=y/S;const r=Math.round(lerp(100,160,v+(Math.sin(y*0.3)*0.05)));const g2=Math.round(lerp(80,110,v));const b=Math.round(lerp(20,40,v));ctx.fillStyle=`rgb(${r},${g2},${b})`;ctx.fillRect(0,y,S,1);}
    ctx.strokeStyle='rgba(60,30,0,0.15)';ctx.lineWidth=1;
    for(let i=0;i<20;i++){ctx.beginPath();ctx.moveTo(0,i*26+Math.random()*8);ctx.bezierCurveTo(S/3,i*26+Math.random()*10,S*2/3,i*26+Math.random()*10,S,i*26+Math.random()*8);ctx.stroke();}
  } else if(pattern==='concrete'){
    ctx.fillStyle='#888';ctx.fillRect(0,0,S,S);
    for(let i=0;i<2000;i++){const x=Math.random()*S,y=Math.random()*S,r=Math.random()*2;ctx.fillStyle=`rgba(0,0,0,${Math.random()*.06})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  } else if(pattern==='checker'){
    const sz=64;for(let row=0;row<S/sz;row++)for(let col=0;col<S/sz;col++){ctx.fillStyle=(row+col)%2===0?'#cccccc':'#ffffff';ctx.fillRect(col*sz,row*sz,sz,sz);}
  } else if(pattern==='darkstone'){
    ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,S,S);
    for(let i=0;i<1500;i++){const x=Math.random()*S,y=Math.random()*S;ctx.fillStyle=`rgba(255,255,255,${Math.random()*.04})`;ctx.fillRect(x,y,Math.random()*3,Math.random()*3);}
  } else if(pattern==='terrazzo'){
    ctx.fillStyle='#b0a090';ctx.fillRect(0,0,S,S);
    const cols=['#e8d0b0','#c8b090','#d0c0a0','#f0e0c8','#a89880'];
    for(let i=0;i<200;i++){const x=Math.random()*S,y=Math.random()*S,r=4+Math.random()*14;ctx.fillStyle=cols[Math.floor(Math.random()*cols.length)];ctx.beginPath();ctx.ellipse(x,y,r,r*(.5+Math.random()),Math.random()*Math.PI,0,Math.PI*2);ctx.fill();}
  } else if(pattern==='grid'){
    ctx.fillStyle='#1a1a1a';ctx.fillRect(0,0,S,S);
    ctx.strokeStyle='rgba(80,80,80,0.6)';ctx.lineWidth=1;
    const step=32;for(let x=0;x<S;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,S);ctx.stroke();}
    for(let y=0;y<S;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(S,y);ctx.stroke();}
  }
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(4,4);tex.needsUpdate=true;return tex;
}
document.querySelectorAll('.fp-swatch').forEach(sw=>{
  sw.addEventListener('click',()=>{
    document.querySelectorAll('.fp-swatch').forEach(s=>s.classList.remove('active'));
    sw.classList.add('active');
    const fp=sw.dataset.fp;
    if(fp==='none'){floorMat.map=null;floorMat.needsUpdate=true;}
    else{floorMat.map=buildFloorTexture(fp);floorMat.needsUpdate=true;}
    toast(t('Zemin deseni: ') + sw.title);
  });
});

/* ── ZEMİN GÖRSELİ VE GÖLGE YAKALAYICI ── */
const floorShadowMat=new THREE.ShadowMaterial({opacity:0.5});
document.getElementById('floorHideToggle').addEventListener('change',e=>{
  if(e.target.checked){
    fl.material=floorShadowMat;
    document.getElementById('floorShadowRow').style.display='flex';
  }else{
    fl.material=floorMat;
    document.getElementById('floorShadowRow').style.display='none';
  }
});
document.getElementById('ctrlFloorShadow').addEventListener('input',e=>{
  document.getElementById('vFloorShadow').textContent=parseFloat(e.target.value).toFixed(2);
  floorShadowMat.opacity=+e.target.value;
});

let floorImgTexture=null;
document.getElementById('floorImgBtn').addEventListener('click',()=>document.getElementById('floorImgInput').click());
document.getElementById('floorImgInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=(ev)=>{
    new THREE.TextureLoader().load(ev.target.result,tex=>{
      if(floorImgTexture)floorImgTexture.dispose();
      floorImgTexture=tex;
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      tex.encoding=THREE.sRGBEncoding;
      floorMat.map=tex;floorMat.needsUpdate=true;
      document.getElementById('floorImgRemoveBtn').style.display='block';
      toast(t('Zemin görseli yüklendi ✓'));
    });
  };
  reader.readAsDataURL(f);
  e.target.value='';
});
document.getElementById('floorImgRemoveBtn').addEventListener('click',()=>{
  if(floorImgTexture)floorImgTexture.dispose();
  floorImgTexture=null;
  floorMat.map=null;floorMat.needsUpdate=true;
  document.getElementById('floorImgRemoveBtn').style.display='none';
  toast(t('Zemin görseli kaldırıldı'));
});

/* ── #28 Gölge Rengi ── */
let shadowOverlayMesh=null;
function buildShadowOverlay(color,opacity){
  if(shadowOverlayMesh){scene.remove(shadowOverlayMesh);shadowOverlayMesh.geometry.dispose();shadowOverlayMesh.material.dispose();shadowOverlayMesh=null;}
  if(opacity<0.01)return;
  const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(color),transparent:true,opacity,blending:THREE.MultiplyBlending,depthWrite:false});
  shadowOverlayMesh=new THREE.Mesh(new THREE.PlaneGeometry(18,18),mat);
  shadowOverlayMesh.rotation.x=-Math.PI/2;shadowOverlayMesh.position.y=0.001;
  scene.add(shadowOverlayMesh);
}
document.getElementById('shadowColorPick').addEventListener('input',()=>buildShadowOverlay(document.getElementById('shadowColorPick').value,+document.getElementById('ctrlShadowOpacity').value));
document.getElementById('ctrlShadowOpacity').addEventListener('input',e=>{document.getElementById('vShadowOpacity').textContent=parseFloat(e.target.value).toFixed(2);buildShadowOverlay(document.getElementById('shadowColorPick').value,+e.target.value);});

/* ── #2 SSS Materyaller ── */
const SSS_PRESETS={
  honey:{color:'#d4890a',roughness:.15,metalness:0,clearcoat:.6,opacity:.88,transmission:.7,thickness:1.2,attenuationColor:'#ff8800',attenuationDistance:0.5},
  soap:{color:'#aaccff',roughness:.05,metalness:0,clearcoat:1,opacity:.75,transmission:.85,thickness:.4,attenuationColor:'#88aaff',attenuationDistance:0.8},
  marble:{color:'#e8e0d8',roughness:.12,metalness:0,clearcoat:.9,opacity:1,transmission:.15,thickness:2,attenuationColor:'#ffffff',attenuationDistance:2},
  candle:{color:'#f5e0b0',roughness:.4,metalness:0,clearcoat:.1,opacity:.96,transmission:.3,thickness:.6,attenuationColor:'#ffcc88',attenuationDistance:0.4},
  milkglass:{color:'#f0f4ff',roughness:.08,metalness:0,clearcoat:.7,opacity:.82,transmission:.6,thickness:.5,attenuationColor:'#ddeeff',attenuationDistance:1},
  jade:{color:'#4a8860',roughness:.25,metalness:.05,clearcoat:.8,opacity:.9,transmission:.35,thickness:1.5,attenuationColor:'#448866',attenuationDistance:0.7}
};
function applySSS(key){
  const p=SSS_PRESETS[key];if(!p)return;
  const setMat=mt=>{
    if(!(mt instanceof THREE.MeshPhysicalMaterial)){return;}
    mt.color.set(p.color);mt.roughness=p.roughness;mt.metalness=p.metalness;
    mt.clearcoat=p.clearcoat;mt.transparent=true;mt.opacity=p.opacity;
    try{mt.transmission=p.transmission;mt.thickness=p.thickness;mt.attenuationColor=new THREE.Color(p.attenuationColor);mt.attenuationDistance=p.attenuationDistance;}catch(e){}
    mt.needsUpdate=true;
  };
  if(usingDefault){bottleGroup.children.forEach(c=>{if(c.material)setMat(c.material);});}
  else if(loadedGroup){loadedGroup.traverse(n=>{if(n.isMesh&&n.material instanceof THREE.MeshPhysicalMaterial)setMat(n.material);});}
  document.querySelectorAll('.sss-btn').forEach(b=>b.classList.toggle('active',b.dataset.sss===key));
  toast(t('SSS: ') + key);
}
function clearSSS(){
  document.querySelectorAll('.sss-btn').forEach(b=>b.classList.remove('active'));
  applyMat();toast(t('SSS kapatıldı'));
}
document.querySelectorAll('.sss-btn').forEach(b=>b.addEventListener('click',()=>applySSS(b.dataset.sss)));
document.getElementById('sssOffBtn').addEventListener('click',clearSSS);

/* ── #23 Su Efekti ── */
let waterMesh=null,waterTime=0,waterActive=false;
function buildWaterTexture(t){
  const S=256;const c=document.createElement('canvas');c.width=S;c.height=S;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,0)';ctx.clearRect(0,0,S,S);
  for(let y=0;y<S;y++){for(let x=0;x<S;x++){
    const v=Math.sin((x/S)*8+t)*Math.sin((y/S)*6+t*1.3)*.5+.5;
    const a=Math.floor(v*80);
    ctx.fillStyle=`rgba(100,170,220,${a/255})`;ctx.fillRect(x,y,1,1);
  }}
  return new THREE.CanvasTexture(c);
}
function toggleWater(on){
  waterActive=on;
  const wr=document.getElementById('waterControls');
  wr.style.opacity=on?'1':'.3';wr.style.pointerEvents=on?'auto':'none';
  if(!on&&waterMesh){scene.remove(waterMesh);waterMesh.geometry.dispose();waterMesh.material.dispose();waterMesh=null;}
  else if(on&&!waterMesh){
    const w=+document.getElementById('ctrlWaterDepth').value;
    const wMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(document.getElementById('waterColorPick').value),transparent:true,opacity:.55,roughness:.05,metalness:.1,transmission:.6,thickness:.3,side:THREE.DoubleSide});
    waterMesh=new THREE.Mesh(new THREE.PlaneGeometry(w*4,w*4,32,32),wMat);
    waterMesh.rotation.x=-Math.PI/2;waterMesh.position.y=0.002;scene.add(waterMesh);
  }
}
document.getElementById('waterToggle').addEventListener('change',e=>toggleWater(e.target.checked));
document.getElementById('ctrlWaterDepth').addEventListener('input',e=>{document.getElementById('vWaterDepth').textContent=parseFloat(e.target.value).toFixed(2);if(waterMesh){scene.remove(waterMesh);waterMesh.geometry.dispose();waterMesh.material.dispose();waterMesh=null;if(waterActive)toggleWater(true);}});
document.getElementById('ctrlWaterSpeed').addEventListener('input',e=>document.getElementById('vWaterSpeed').textContent=parseFloat(e.target.value).toFixed(1));
document.getElementById('waterColorPick').addEventListener('input',e=>{if(waterMesh)waterMesh.material.color.set(e.target.value);});

/* ── #24 Nem / Buğu ── */
let condMesh=null,condActive=false;
function buildCondTexture(density){
  const S=256;const c=document.createElement('canvas');c.width=S;c.height=S;
  const ctx=c.getContext('2d');ctx.clearRect(0,0,S,S);
  const drops=Math.round(density*400);
  for(let i=0;i<drops;i++){
    const x=Math.random()*S,y=Math.random()*S;
    const r=1+Math.random()*4,alpha=0.2+Math.random()*0.5;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(200,220,255,${alpha})`);
    g.addColorStop(1,'rgba(200,220,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r,r*1.8,Math.random()*Math.PI,0,Math.PI*2);ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}
function toggleCond(on){
  condActive=on;
  const cr=document.getElementById('condControls');
  cr.style.opacity=on?'1':'.3';cr.style.pointerEvents=on?'auto':'none';
  const density=+document.getElementById('ctrlCondAmt').value;
  if(!on&&condMesh){scene.remove(condMesh);condMesh.geometry.dispose();condMesh.material.dispose();condMesh=null;}
  else if(on){
    if(condMesh){scene.remove(condMesh);condMesh.geometry.dispose();condMesh.material.dispose();condMesh=null;}
    const tex=buildCondTexture(density);
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:density*.8,side:THREE.FrontSide,depthWrite:false,blending:THREE.AdditiveBlending});
    // Attach to bottle
    const box=new THREE.Box3().setFromObject(usingDefault?bottleGroup:loadedGroup||bottleGroup);
    const sz=box.getSize(new THREE.Vector3());
    condMesh=new THREE.Mesh(new THREE.CylinderGeometry(sz.x*.55,sz.x*.55,sz.y,32,1,true),mat);
    condMesh.position.set(0,sz.y/2+box.min.y,0);
    scene.add(condMesh);
  }
}
document.getElementById('condToggle').addEventListener('change',e=>toggleCond(e.target.checked));
document.getElementById('ctrlCondAmt').addEventListener('input',e=>{document.getElementById('vCondAmt').textContent=parseFloat(e.target.value).toFixed(2);if(condActive)toggleCond(true);});

/* ── #1 Caustics (Canvas Simülasyonu) ── */
let causticsActive=false,causticsT=0;
const causticsCanvas=document.getElementById('causticsCanvas');
const causticsCtx=causticsCanvas.getContext('2d');
let causticsAnimId=null;
function drawCaustics(){
  causticsCanvas.width=innerWidth;causticsCanvas.height=innerHeight;
  causticsCtx.clearRect(0,0,causticsCanvas.width,causticsCanvas.height);
  const W=causticsCanvas.width,H=causticsCanvas.height;
  causticsT+=0.018;
  const cx=W/2,cy=H/2;
  for(let i=0;i<60;i++){
    const angle=i*0.618*Math.PI*2;
    const r=80+Math.sin(causticsT*1.3+i*0.4)*50+Math.cos(causticsT*0.8+i*0.2)*30;
    const x=cx+Math.cos(angle+causticsT*0.3)*r;
    const y=cy+Math.sin(angle+causticsT*0.4)*r*0.4+H*0.15;
    const size=8+Math.sin(causticsT+i)*5;
    const grad=causticsCtx.createRadialGradient(x,y,0,x,y,size);
    grad.addColorStop(0,'rgba(255,245,180,0.35)');
    grad.addColorStop(0.5,'rgba(220,200,100,0.12)');
    grad.addColorStop(1,'rgba(200,180,80,0)');
    causticsCtx.fillStyle=grad;
    causticsCtx.beginPath();causticsCtx.arc(x,y,size,0,Math.PI*2);causticsCtx.fill();
  }
  if(causticsActive)causticsAnimId=requestAnimationFrame(drawCaustics);
}
function toggleCaustics(on){
  causticsActive=on;
  causticsCanvas.style.display=on?'block':'none';
  if(on){causticsT=0;drawCaustics();}
  else{cancelAnimationFrame(causticsAnimId);causticsCtx.clearRect(0,0,causticsCanvas.width,causticsCanvas.height);}
}
document.getElementById('causticsToggle').addEventListener('change',e=>toggleCaustics(e.target.checked));

/* ── #4 Lens Flare ── */
let lensFlareActive=false,lensFlareT=0,lensFlareAnimId=null;
const lensCanvas=document.getElementById('lensFlareCanvas');
const lensCtx=lensCanvas.getContext('2d');
function drawLensFlare(){
  lensCanvas.width=innerWidth;lensCanvas.height=innerHeight;
  lensCtx.clearRect(0,0,lensCanvas.width,lensCanvas.height);
  lensFlareT+=0.02;
  const lights=Object.values(lightObjects||{}).filter(o=>o.spot.visible);
  lights.forEach(o=>{
    const pos=new THREE.Vector3();o.spot.getWorldPosition(pos);
    const proj=pos.clone().project(camera);
    const sx=(proj.x*.5+.5)*innerWidth;
    const sy=(-.5*proj.y+.5)*innerHeight;
    if(proj.z>1)return;
    const baseAlpha=0.6+0.1*Math.sin(lensFlareT*2);
    // Main glow
    const grd=lensCtx.createRadialGradient(sx,sy,0,sx,sy,80);
    grd.addColorStop(0,`rgba(255,245,200,${baseAlpha*.5})`);
    grd.addColorStop(.3,`rgba(255,220,100,${baseAlpha*.15})`);
    grd.addColorStop(1,'rgba(255,200,50,0)');
    lensCtx.fillStyle=grd;lensCtx.beginPath();lensCtx.arc(sx,sy,80,0,Math.PI*2);lensCtx.fill();
    // Streak
    lensCtx.save();lensCtx.translate(sx,sy);lensCtx.rotate(lensFlareT*.1);
    [0,Math.PI/3,Math.PI*2/3].forEach(angle=>{
      lensCtx.save();lensCtx.rotate(angle);
      const sg=lensCtx.createLinearGradient(-100,0,100,0);
      sg.addColorStop(0,'rgba(255,245,200,0)');sg.addColorStop(.5,`rgba(255,245,200,${baseAlpha*.4})`);sg.addColorStop(1,'rgba(255,245,200,0)');
      lensCtx.fillStyle=sg;lensCtx.fillRect(-100,-1,200,2);
      lensCtx.restore();
    });
    lensCtx.restore();
    // Secondary flares along axis to center
    const dx=innerWidth/2-sx,dy=innerHeight/2-sy;
    [0.3,0.5,0.7,0.9].forEach((f,i)=>{
      const fx=sx+dx*f,fy=sy+dy*f,fr=6+i*4;
      const fg=lensCtx.createRadialGradient(fx,fy,0,fx,fy,fr);
      fg.addColorStop(0,`rgba(180,220,255,${baseAlpha*.3})`);
      fg.addColorStop(1,'rgba(150,200,255,0)');
      lensCtx.fillStyle=fg;lensCtx.beginPath();lensCtx.arc(fx,fy,fr,0,Math.PI*2);lensCtx.fill();
    });
  });
  if(lensFlareActive)lensFlareAnimId=requestAnimationFrame(drawLensFlare);
}
function toggleLensFlare(on){
  lensFlareActive=on;lensCanvas.style.display=on?'block':'none';
  if(on)drawLensFlare();else{cancelAnimationFrame(lensFlareAnimId);lensCtx.clearRect(0,0,lensCanvas.width,lensCanvas.height);}
}
document.getElementById('lensFlareToggle').addEventListener('change',e=>toggleLensFlare(e.target.checked));

/* ── #3 Bokeh Şekli ── */
let currentBokeh='circle';
const BOKEH_FILTERS={
  circle:'blur(0px)',
  hex:'blur(0px)',
  oct:'blur(0px)'
};
document.querySelectorAll('.bokeh-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.bokeh-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');currentBokeh=b.dataset.bokeh;
  toast(t('Bokeh: ') + b.textContent.trim());
}));

/* ── #11 Işık Profil Kütüphanesi ── */
const LP_KEY='studioPro_lightProfiles';
function getLightProfiles(){try{return JSON.parse(localStorage.getItem(LP_KEY)||'{}');}catch{return {};}}
function saveLightProfiles(p){localStorage.setItem(LP_KEY,JSON.stringify(p));}
function refreshProfileSelect(){
  const sel=document.getElementById('lightProfileSelect');
  const profs=getLightProfiles();
  sel.innerHTML='<option value="">— '+t('Profil seç')+' —</option>';
  Object.keys(profs).forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;sel.appendChild(o);});
}
document.getElementById('saveLightProfileBtn').addEventListener('click',()=>{
  const name=prompt(t('Profil adı:'));if(!name||!name.trim())return;
  const state=getSceneJSON();
  const profs=getLightProfiles();profs[name.trim()]=state;saveLightProfiles(profs);
  refreshProfileSelect();toast(t('💾 Profil kaydedildi: ') + name.trim());
});
document.getElementById('loadLightProfileBtn').addEventListener('click',()=>{
  const sel=document.getElementById('lightProfileSelect');const name=sel.value;if(!name)return;
  const profs=getLightProfiles();const state=profs[name];if(!state)return;
  try{loadSceneJSON(state);toast('📂 Profil yüklendi: '+name);}catch(e){toast('Profil yüklenirken hata');}
});
refreshProfileSelect();

/* ── #16 Işık Animasyon Presetleri ── */
let currentLightAnim='none',lightAnimT=0,lightAnimId=null;
const origIntensities={};
function startLightAnim(mode){
  if(lightAnimId){cancelAnimationFrame(lightAnimId);lightAnimId=null;}
  currentLightAnim=mode;
  // Save original intensities
  if(mode!=='none')Object.entries(lightObjects||{}).forEach(([id,o])=>{origIntensities[id]=o.spot.intensity;});
  if(mode==='none'){Object.entries(lightObjects||{}).forEach(([id,o])=>{if(origIntensities[id]!==undefined)o.spot.intensity=origIntensities[id];});return;}
  function tick(){
    lightAnimT+=0.02;
    const objs=Object.values(lightObjects||{}).filter(o=>o.spot.visible);
    if(mode==='breathe'){
      const factor=0.5+0.5*Math.sin(lightAnimT);
      objs.forEach((o,i)=>o.spot.intensity=(origIntensities[Object.keys(lightObjects)[i]]||1)*(.3+.7*factor));
    } else if(mode==='flicker'){
      objs.forEach((o,i)=>{const f=Math.random()>.15?1:Math.random()*.2;o.spot.intensity=(origIntensities[Object.keys(lightObjects)[i]]||1)*f;});
      lightAnimT-=0.01; // slower
    } else if(mode==='scan'){
      const angle=lightAnimT*1.5;
      objs.forEach((o,i)=>{const ph=angle+(i/Math.max(objs.length,1))*Math.PI*2;o.spot.position.x=Math.sin(ph)*4;o.spot.position.z=Math.cos(ph)*4;});
    } else if(mode==='disco'){
      objs.forEach((o,i)=>{
        const hue=(lightAnimT*180+i*60)%360;
        const col=new THREE.Color(`hsl(${hue},80%,60%)`);
        o.spot.color.set(col);
        o.spot.intensity=(origIntensities[Object.keys(lightObjects)[i]]||1)*(0.3+0.7*Math.abs(Math.sin(lightAnimT*4+i)));
      });
    }
    lightAnimId=requestAnimationFrame(tick);
  }
  tick();
}
document.querySelectorAll('.lanim-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.lanim-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');startLightAnim(b.dataset.lanim);
  if(b.dataset.lanim!=='none')toast('Işık animasyonu: '+b.textContent.trim());
}));

/* ── #5 Shadow Only Render ── */
document.getElementById('shadowOnlyBtn').addEventListener('click',async()=>{
  const btn=document.getElementById('shadowOnlyBtn');
  btn.textContent='Render alınıyor…';
  // Hide product, keep floor
  const productGroup=usingDefault?bottleGroup:loadedGroup;
  if(productGroup)productGroup.visible=false;
  Object.values(lightObjects||{}).forEach(o=>{if(o.sg)o.sg.visible=false;if(o.leg)o.leg.visible=false;if(o.cone)o.cone.visible=false;if(o.diffGroup)o.diffGroup.visible=false;});
  const prevBg=scene.background;scene.background=null;
  renderer.setClearColor(0x000000,0);
  renderer.render(scene,camera);
  const dataURL=renderer.domElement.toDataURL('image/png');
  scene.background=prevBg;renderer.setClearColor(0x000000,1);
  if(productGroup)productGroup.visible=true;
  Object.values(lightObjects||{}).forEach(o=>{const on=o.spot.visible;if(o.sg)o.sg.visible=on&&!equipHidden;if(o.leg)o.leg.visible=on&&!equipHidden;if(o.cone)o.cone.visible=on&&!equipHidden&&beams;if(o.diffGroup)o.diffGroup.visible=on&&!equipHidden&&o.params.diffOn;});
  const a=document.createElement('a');a.href=dataURL;a.download='shadow_only.png';document.body.appendChild(a);a.click();document.body.removeChild(a);
  btn.textContent='🖤 Sadece Gölge Render';
  toast('🖤 Gölge render indirildi');
});

/* ── #19 Export Boyutu Presetleri ── */
let exportAspect=null; // null = square (current behaviour)
const EXPORT_SIZES={'1:1':[1,1],'4:5':[4,5],'9:16':[9,16],'16:9':[16,9]};
document.querySelectorAll('.exsz-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.exsz-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');exportAspect=b.dataset.exsz;
  toast('Export boyutu: '+b.dataset.exsz);
}));

/* ── #21 Watermark ── */
function addWatermark(canvas2d,W,H){
  const ctx=canvas2d.getContext('2d');
  ctx.save();
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.font=`bold ${Math.round(W*.012)}px -apple-system,Arial,sans-serif`;
  ctx.textAlign='left';ctx.textBaseline='bottom';
  const text='Studio Pro V11 • '+new Date().toLocaleDateString('tr-TR');
  ctx.fillText(text,W*.012,H-.012*H);
  ctx.restore();
}

/* ── #30 Renk Paleti Önerisi ── */
function hexToHSL(hex){
  let r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h,s,l=(mx+mn)/2;
  if(mx===mn){h=s=0;}else{const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}}
  return[h*360,s*100,l*100];
}
function hslToHex(h,s,l){
  h/=360;s/=100;l/=100;let r,g,b;
  if(s===0){r=g=b=l;}else{const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3);}
  return '#'+[r,g,b].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}
document.getElementById('colorPaletteBtn').addEventListener('click',()=>{
  const hex=document.getElementById('productColor').value;
  const [h,s,l]=hexToHSL(hex);
  const suggestions=[
    hslToHex((h+180)%360,Math.min(s*.6,80),Math.min(l*.7,70)), // Complementary
    hslToHex((h+150)%360,Math.min(s*.5,70),Math.min(l*.65,75)), // Split comp 1
    hslToHex((h+210)%360,Math.min(s*.5,70),Math.min(l*.65,75)), // Split comp 2
    hslToHex(h,Math.max(s*.3,20),Math.min(l*.4,35)),             // Dark analogous
    hslToHex((h+30)%360,Math.max(s*.8,30),Math.min(l*.8,80)),   // Warm analogous
  ];
  const row=document.getElementById('colorPaletteRow');row.innerHTML='';
  suggestions.forEach(color=>{
    const sw=document.createElement('div');sw.className='cp-swatch';
    sw.style.background=color;sw.title=color;
    sw.addEventListener('click',()=>{
      scene.background=new THREE.Color(color);
      document.querySelectorAll('.bg-swatch').forEach(s=>s.classList.remove('active'));
      toast('🎨 Renk uygulandı: '+color);
    });
    row.appendChild(sw);
  });
  row.style.display='flex';
  toast('🎨 '+(suggestions.length)+' renk önerisi hazır');
});

/* ── #31 Referans Görsel Eşleştirme ── */
let refDominantColors=[];
document.getElementById('btnRefMatch').addEventListener('click',()=>document.getElementById('refMatchModal').classList.add('open'));
document.getElementById('refCloseBtn').addEventListener('click',()=>document.getElementById('refMatchModal').classList.remove('open'));
document.getElementById('refMatchModal').addEventListener('click',e=>{if(e.target===document.getElementById('refMatchModal'))document.getElementById('refMatchModal').classList.remove('open');});
const refImgZoneEl=document.getElementById('refImgZone');
const refImgInputEl=document.getElementById('refImgInput');
refImgZoneEl.addEventListener('click',()=>refImgInputEl.click());
refImgInputEl.addEventListener('change',e=>{const f=e.target.files[0];if(f)analyzeRefImage(f);refImgInputEl.value='';});
function analyzeRefImage(file){
  const url=URL.createObjectURL(file);
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{
    URL.revokeObjectURL(url);
    const S=64;const c=document.getElementById('refAnalysisCanvas');c.width=S;c.height=S;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0,S,S);
    const data=ctx.getImageData(0,0,S,S).data;
    // Simple color sampling — pick diverse prominent colors
    const buckets={};
    for(let i=0;i<data.length;i+=4){
      const r=Math.round(data[i]/32)*32,g=Math.round(data[i+1]/32)*32,b=Math.round(data[i+2]/32)*32;
      const key=r+','+g+','+b;buckets[key]=(buckets[key]||0)+1;
    }
    const sorted=Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0,12);
    // Remove near-blacks and near-whites, pick top 5
    const filtered=sorted.filter(([k])=>{const [r,g,b]=k.split(',').map(Number);const lum=0.299*r+0.587*g+0.114*b;return lum>20&&lum<230;}).slice(0,5);
    refDominantColors=filtered.map(([k])=>{const [r,g,b]=k.split(',').map(Number);return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');});
    const row=document.getElementById('refColorRow');row.innerHTML='';
    refDominantColors.forEach(color=>{
      const sw=document.createElement('div');sw.className='ref-color-swatch';sw.style.background=color;sw.title=color;
      sw.addEventListener('click',()=>{scene.background=new THREE.Color(color);document.querySelectorAll('.bg-swatch').forEach(s=>s.classList.remove('active'));toast(t('Referans rengi uygulandı: ') + color);});
      row.appendChild(sw);
    });
    document.getElementById('refColors').style.display='block';
    document.getElementById('refApplyBtn').style.display='block';
    refImgZoneEl.querySelector('.drop-label').innerHTML='<strong>'+file.name+'</strong>';
  };
  img.src=url;
}
document.getElementById('refApplyBtn').addEventListener('click',()=>{
  if(!refDominantColors.length)return;
  // Apply dominant color as background
  scene.background=new THREE.Color(refDominantColors[0]);
  document.querySelectorAll('.bg-swatch').forEach(s=>s.classList.remove('active'));
  // If 2nd color available, try adjusting ambient
  if(refDominantColors[1]){const c=new THREE.Color(refDominantColors[1]);hemi.color.set(c);}
  document.getElementById('refMatchModal').classList.remove('open');
  toast('✓ Referans renkleri sahneye uygulandı');
});

/* ── Render loop eklentisi: su animasyonu ── */
let waterAnimT=0;
setInterval(()=>{
  if(!waterActive||!waterMesh)return;
  waterAnimT+=0.04;
  const speed=+document.getElementById('ctrlWaterSpeed').value;
  const pos=waterMesh.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    pos.setY(i,Math.sin(x*2+waterAnimT*speed)*0.03+Math.cos(z*3+waterAnimT*speed*0.8)*0.02);
  }
  pos.needsUpdate=true;
  if(waterMesh.material)waterMesh.material.color.set(document.getElementById('waterColorPick').value);
},50);

/* ── Title update ── */
document.title='Studio Pro V11';

/* === PROPS BUTONLARI (propObjects/propGroup yukarıda tanımlı) === */
function addProp(type) {
  propIdCounter++;
  const pid = 'prop_' + propIdCounter;
  if(type === 'stair') {
    const stairMesh = new THREE.Group();
    const stMat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8});
    const st1 = new THREE.Mesh(new THREE.BoxGeometry(2,0.3,2),stMat);
    st1.position.y=0.15; st1.castShadow=true; st1.receiveShadow=true;
    const st2 = new THREE.Mesh(new THREE.BoxGeometry(2,0.3,1),stMat);
    st2.position.set(0,0.45,-0.5); st2.castShadow=true; st2.receiveShadow=true;
    stairMesh.add(st1,st2);
    propObjects[pid]={type,mesh:stairMesh,mat:stMat};
    propGroup.add(stairMesh);
  } else {
    let geo;
    if(type === 'cube') {
      geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      geo.translate(0, 0.75, 0);
    } else if(type === 'cylinder') {
      geo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 32);
      geo.translate(0, 0.25, 0);
    } else {
      geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
    }
    const mat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8});
    const mesh = new THREE.Mesh(geo,mat);
    mesh.castShadow=true; mesh.receiveShadow=true;
    propObjects[pid]={type,mesh,mat};
    propGroup.add(mesh);
  }
  propObjects[pid].mesh.position.set(Math.random()*2-1,0,Math.random()*2-1);
  buildPropUI(pid);
}

function buildPropUI(pid) {
  const p=propObjects[pid];
  const div=document.createElement('div');
  div.style.cssText='background:#1a1a1c;border-radius:6px;padding:10px;margin-bottom:8px;border:1px solid #333;';
  div.innerHTML='<div style="font-weight:600;margin-bottom:10px;font-size:12px;display:flex;justify-content:space-between;color:#fff;"><span>'+t(p.type.toUpperCase())+'</span><button style="background:#d32f2f;color:#fff;border:none;border-radius:4px;cursor:pointer;padding:2px 6px;" data-pid="'+pid+'">'+t('Sil')+'</button></div>'+
    '<div class="ctrl-row" style="margin-bottom:6px;"><div class="ctrl-lbl"><span>X Poz</span></div><input type="range" min="-5" max="5" step="0.1" value="'+p.mesh.position.x+'" data-pid="'+pid+'" data-axis="x"></div>'+
    '<div class="ctrl-row" style="margin-bottom:6px;"><div class="ctrl-lbl"><span>Z Poz</span></div><input type="range" min="-5" max="5" step="0.1" value="'+p.mesh.position.z+'" data-pid="'+pid+'" data-axis="z"></div>'+
    '<div class="ctrl-row" style="margin-bottom:6px;"><div class="ctrl-lbl"><span>Dönüş</span></div><input type="range" min="-180" max="180" step="1" value="0" data-pid="'+pid+'" data-axis="ry"></div>'+
    '<div class="ctrl-row" style="margin-bottom:6px;"><div class="ctrl-lbl"><span>Boyut</span></div><input type="range" min="0.2" max="3" step="0.1" value="1" data-pid="'+pid+'" data-axis="scale"></div>';
  div.querySelector('button').addEventListener('click',function(){delProp(pid,div);});
  div.querySelectorAll('input[type=range]').forEach(function(inp){
    inp.addEventListener('input',function(){
      const o=propObjects[inp.dataset.pid];
      if(!o)return;
      const ax=inp.dataset.axis;
      if(ax==='x')o.mesh.position.x=+inp.value;
      else if(ax==='z')o.mesh.position.z=+inp.value;
      else if(ax==='ry')o.mesh.rotation.y=THREE.MathUtils.degToRad(+inp.value);
      else if(ax==='scale')o.mesh.scale.set(+inp.value,+inp.value,+inp.value);
    });
  });
  const list=document.getElementById('propControlsList');
  if(list)list.appendChild(div);
}

function delProp(pid,divEl){
  const p=propObjects[pid];
  if(p){propGroup.remove(p.mesh);delete propObjects[pid];}
  if(divEl)divEl.remove();
}

const propGrid=document.getElementById('propBtnGrid');
if(propGrid){
  propGrid.querySelectorAll('button').forEach(function(b){
    b.addEventListener('click',function(){addProp(b.dataset.type);});
  });
}

/* === BOKEH SETUP === */
function initComposer(){
  if(typeof THREE.EffectComposer==='undefined'){
    setTimeout(initComposer,200);
    return;
  }
  try{
    const rc=new THREE.EffectComposer(renderer);
    const rp=new THREE.RenderPass(scene,camera);
    rc.addPass(rp);
    const bp=new THREE.BokehPass(scene,camera,{focus:4.0,aperture:0.01,maxblur:0.05,width:innerWidth,height:innerHeight});
    rc.addPass(bp);
    composer=rc;
    bokehPass=bp;
    window.addEventListener('resize',function(){if(composer)composer.setSize(innerWidth,innerHeight);});
  }catch(err){
    console.warn('Bokeh init failed:',err);
  }
}
initComposer();

const bToggle=document.getElementById('bokehToggle');
if(bToggle){
  bToggle.addEventListener('change',function(e){
    const bc=document.getElementById('bokehControls');
    if(bc){bc.style.opacity=e.target.checked?'1':'0.3';bc.style.pointerEvents=e.target.checked?'auto':'none';}
  });
  const ctrlAp=document.getElementById('ctrlBokehAp');
  const ctrlFoc=document.getElementById('ctrlBokehFoc');
  if(ctrlAp)ctrlAp.addEventListener('input',function(e){
    if(bokehPass)bokehPass.uniforms['aperture'].value=+e.target.value;
    const v=document.getElementById('vBokehAp');if(v)v.textContent=e.target.value;
  });
  if(ctrlFoc)ctrlFoc.addEventListener('input',function(e){
    if(bokehPass)bokehPass.uniforms['focus'].value=+e.target.value;
    const v=document.getElementById('vBokehFoc');if(v)v.textContent=e.target.value;
  });
}

/* ════════════════════════════════════════════════════
   YENİ ÖZELLİKLER — Studio Pro V11
════════════════════════════════════════════════════ */

/* ── 1. FİZİKSEL KAMERA (Lens + F-Stop) ── */
const LENS_PRESETS = {
  24:  { fov: 74, label: '24mm — Geniş Açı' },
  35:  { fov: 54, label: '35mm — Normal Geniş' },
  50:  { fov: 40, label: '50mm — Standart' },
  85:  { fov: 24, label: '85mm — Portre' },
  135: { fov: 15, label: '135mm — Telefoto' }
};
let currentLensMM = 50;

function applyLens(mm) {
  const preset = LENS_PRESETS[mm];
  if (!preset) return;
  currentLensMM = mm;
  camera.fov = preset.fov;
  camera.updateProjectionMatrix();
  document.querySelectorAll('.lens-btn').forEach(function(b) {
    b.classList.toggle('active', +b.dataset.mm === mm);
  });
  toast('📷 ' + preset.label);
}

document.querySelectorAll('.lens-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { applyLens(+btn.dataset.mm); });
});

const ctrlFstop = document.getElementById('ctrlFstop');
const vFstop   = document.getElementById('vFstop');
if (ctrlFstop) {
  ctrlFstop.addEventListener('input', function(e) {
    const fVal = parseFloat(e.target.value);
    if (vFstop) vFstop.textContent = 'f/' + fVal.toFixed(1);
    // F-stop Bokeh bağlantısı: düşük F = daha fazla Bokeh
    const aperture = Math.max(0, 0.05 - (fVal / 7) * 0.049);
    if (bokehPass) bokehPass.uniforms['aperture'].value = aperture;
    const ctrlAp = document.getElementById('ctrlBokehAp');
    if (ctrlAp) ctrlAp.value = aperture;
    const vAp = document.getElementById('vBokehAp');
    if (vAp) vAp.textContent = aperture.toFixed(3);
  });
}

/* ── 2. CAM GEÇİRGENLİĞİ (Transmission + IOR) ── */
function updateTransmission() {
  const trans = +document.getElementById('ctrlTransmission').value;
  const ior   = +document.getElementById('ctrlIOR').value;
  const thick = +document.getElementById('ctrlThickness').value;
  const vT = document.getElementById('vTransmission');
  const vI = document.getElementById('vIOR');
  const vH = document.getElementById('vThickness');
  if (vT) vT.textContent = trans.toFixed(2);
  if (vI) vI.textContent = ior.toFixed(2);
  if (vH) vH.textContent = thick.toFixed(2);

  const applyToMesh = function(mat) {
    if (mat && mat.isMeshPhysicalMaterial) {
      mat.transmission = trans;
      mat.ior = ior;
      mat.thickness = thick;
      mat.transparent = true;
      mat.needsUpdate = true;
    }
  };

  if (usingDefault) {
    bottleGroup.children.forEach(function(child) {
      if (child.isMesh) applyToMesh(child.material);
    });
  } else if (loadedGroup) {
    loadedGroup.traverse(function(n) {
      if (n.isMesh) applyToMesh(n.material);
    });
  }
}

['ctrlTransmission','ctrlIOR','ctrlThickness'].forEach(function(id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateTransmission);
});

// Cam materyali seçilince transmission panelini göster/gizle
document.querySelectorAll('.mat-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    const tp = document.getElementById('transmissionPanel');
    if (!tp) return;
    tp.style.display = (btn.dataset.mat === 'glass') ? 'block' : 'none';
  });
});
// Başlangıçta cam seçili olduğu için göster
(function(){ const tp = document.getElementById('transmissionPanel'); if(tp) tp.style.display='block'; })();

/* ── 3. ŞEFFAF PNG (Shadow Catcher) ── */
const transPngBtn    = document.getElementById('transPngBtn');
const transPngOptions= document.getElementById('transPngOptions');
const doTransPngBtn  = document.getElementById('doTransPngBtn');
let transPngMenuOpen = false;

if (transPngBtn) {
  transPngBtn.addEventListener('click', function() {
    transPngMenuOpen = !transPngMenuOpen;
    transPngOptions.style.display = transPngMenuOpen ? 'block' : 'none';
  });
}

document.addEventListener('click', function(e) {
  if (transPngMenuOpen && transPngOptions &&
      !transPngOptions.contains(e.target) && e.target !== transPngBtn) {
    transPngMenuOpen = false;
    transPngOptions.style.display = 'none';
  }
});

if (doTransPngBtn) {
  doTransPngBtn.addEventListener('click', async function() {
    const includeShadow = document.getElementById('shadowInPng').checked;
    const includeEquip  = document.getElementById('equipInPng').checked;
    const W = +document.getElementById('qualitySelect').value || 2048;

    doTransPngBtn.textContent = '⏳ Hazırlanıyor…';
    doTransPngBtn.style.pointerEvents = 'none';

    try {
      // Mevcut durumu kaydet
      const prevBg = scene.background;
      const prevEquip = equipHidden;
      const prevSize = { w: renderer.domElement.width, h: renderer.domElement.height };

      // Şeffaf arka plan için renderer ayarla
      renderer.setClearColor(0x000000, 0);
      scene.background = null;

      // Ekipman kontrolü
      if (!includeEquip) {
        Object.values(lightObjects).forEach(function(o) {
          o.sg.visible = false; o.leg.visible = false; o.cone.visible = false;
        });
      }

      // Shadow catcher zemini: gölge dahil istenirse özel materyal
      let shadowFloor = null;
      if (includeShadow) {
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.4, transparent: true });
        shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), shadowMat);
        shadowFloor.rotation.x = -Math.PI / 2;
        shadowFloor.position.y = 0.001;
        shadowFloor.receiveShadow = true;
        scene.add(shadowFloor);
        fl.visible = false;
      }

      // Render
      const H = W;
      renderer.setSize(W, H, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const dataURL = renderer.domElement.toDataURL('image/png');

      // Geri yükle
      scene.background = prevBg;
      renderer.setClearColor(0x000000, 1);
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      fl.visible = true;

      if (shadowFloor) { scene.remove(shadowFloor); shadowFloor.geometry.dispose(); shadowFloor.material.dispose(); }
      if (!includeEquip) {
        Object.values(lightObjects).forEach(function(o) {
          const on = o.spot.visible;
          o.sg.visible = on && !equipHidden; o.leg.visible = on && !equipHidden;
          o.cone.visible = on && beams && !equipHidden;
        });
      }

      // İndir
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = 'studio-transparent-' + W + 'px.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('✓ Şeffaf PNG indirildi');
    } catch(err) {
      toast('Hata: ' + err.message);
    }

    doTransPngBtn.textContent = '⬇ İndir';
    doTransPngBtn.style.pointerEvents = 'auto';
    transPngOptions.style.display = 'none';
    transPngMenuOpen = false;
  });
}

/* ── 4. GELİŞMİŞ ATMOSFER MOTORU (Sis, Yansıma, Partiküller, Rüzgar) ── */

// A. Hacimsel Sis (Fog)
const fogToggle = document.getElementById('fogToggle');
const fogColorPick = document.getElementById('fogColorPick');
const ctrlFogDensity = document.getElementById('ctrlFogDensity');
const fogControls = document.getElementById('fogControls');

if (fogToggle) {
  fogToggle.addEventListener('change', function(e) {
    const active = e.target.checked;
    fogControls.style.display = active ? 'block' : 'none';
    if (active) {
      scene.fog = new THREE.FogExp2(new THREE.Color(fogColorPick.value), +ctrlFogDensity.value);
    } else {
      scene.fog = null;
    }
  });
}
if (fogColorPick) fogColorPick.addEventListener('input', function(e) {
  if (scene.fog) scene.fog.color.set(e.target.value);
});
if (ctrlFogDensity) ctrlFogDensity.addEventListener('input', function(e) {
  document.getElementById('vFogDensity').textContent = parseFloat(e.target.value).toFixed(3);
  if (scene.fog) scene.fog.density = +e.target.value;
});

// B. Zemin Yansıması (Puddle)
const puddleToggle = document.getElementById('puddleToggle');
let originalFlMat = null;
if (puddleToggle) {
  puddleToggle.addEventListener('change', function(e) {
    const active = e.target.checked;
    if (active) {
      if (!originalFlMat) originalFlMat = fl.material.clone();
      fl.material = new THREE.MeshStandardMaterial({
        color: originalFlMat.color,
        roughness: 0.05,
        metalness: 0.8,
        envMapIntensity: 2.0
      });
      fl.material.needsUpdate = true;
    } else {
      if (originalFlMat) {
        fl.material = originalFlMat;
        fl.material.needsUpdate = true;
      }
    }
  });
}

// C. Rüzgar (Wind)
let globalWindX = 0;
let globalWindZ = 0;
['ctrlWindX', 'ctrlWindZ'].forEach(function(id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', function(e) {
    const val = parseFloat(e.target.value);
    document.getElementById(id.replace('ctrl', 'v')).textContent = val.toFixed(1);
    if (id === 'ctrlWindX') globalWindX = val;
    if (id === 'ctrlWindZ') globalWindZ = val;
  });
});

// D. Partikül Motoru (Particles)
const PARTICLE_CFG = {
  dust:   { count: 500, size: 0.015, speed: 1.0, spread: 1.0, color: 0xffffff, op: 0.6, type: 'float' },
  embers: { count: 200, size: 0.025, speed: 1.0, spread: 1.0, color: 0xff5500, op: 0.9, type: 'rise' },
  smoke:  { count: 150, size: 5.0,   speed: 1.0, spread: 1.0, color: 0xcccccc, op: 0.25, type: 'smoke_volumetric' },
  rain:   { count: 800, size: 0.1,   speed: 1.0, spread: 1.0, color: 0xaaaaaa, op: 0.5, type: 'fall_fast' },
  snow:   { count: 600, size: 0.03,  speed: 1.0, spread: 1.0, color: 0xffffff, op: 0.8, type: 'fall_slow' },
  bokeh:  { count: 100, size: 0.3,   speed: 1.0, spread: 1.0, color: 0xffeedd, op: 0.3, type: 'float_large' }
};

let pSystems = {};
let activePartConfig = null;

const pCtrlPanel = document.getElementById('particleControls');
const lblActivePart = document.getElementById('lblActiveParticle');

const inpDens = document.getElementById('inpPartDensity'), ctrlDens = document.getElementById('ctrlPartDensity');
const inpSize = document.getElementById('inpPartSize'), ctrlSize = document.getElementById('ctrlPartSize');
const inpSpd  = document.getElementById('inpPartSpeed'), ctrlSpd  = document.getElementById('ctrlPartSpeed');
const inpSpr  = document.getElementById('inpPartSpread'), ctrlSpr = document.getElementById('ctrlPartSpread');

function updatePartUI(name) {
  if (!name) { if(pCtrlPanel) pCtrlPanel.style.display = 'none'; return; }
  if (pCtrlPanel) pCtrlPanel.style.display = 'block';
  const cfg = PARTICLE_CFG[name];
  const trNames = {dust:'Toz', embers:'Kor', smoke:'Duman', rain:'Yağmur', snow:'Kar', bokeh:'Bokeh'};
  if (lblActivePart) lblActivePart.textContent = 'Seçili Efekt: ' + (trNames[name] || name);
  
  if (inpDens) inpDens.value = cfg.count; if (ctrlDens) ctrlDens.value = cfg.count;
  if (inpSize) inpSize.value = cfg.size; if (ctrlSize) ctrlSize.value = cfg.size;
  if (inpSpd) inpSpd.value = cfg.speed; if (ctrlSpd) ctrlSpd.value = cfg.speed;
  if (inpSpr) inpSpr.value = cfg.spread; if (ctrlSpr) ctrlSpr.value = cfg.spread;
}

function syncPartInput(cfgKey, isRebuild) {
  if (!activePartConfig) return;
  const cfg = PARTICLE_CFG[activePartConfig];
  
  if (cfgKey === 'count') {
    let v = parseInt(inpDens.value) || 10;
    cfg.count = v; ctrlDens.value = v;
  }
  if (cfgKey === 'size') {
    let v = parseFloat(inpSize.value) || 0.01;
    cfg.size = v; ctrlSize.value = v;
  }
  if (cfgKey === 'speed') {
    let v = parseFloat(inpSpd.value) || 1.0;
    cfg.speed = v; ctrlSpd.value = v;
  }
  if (cfgKey === 'spread') {
    let v = parseFloat(inpSpr.value) || 1.0;
    cfg.spread = v; ctrlSpr.value = v;
  }

  if (isRebuild && pSystems[activePartConfig]) {
    toggleParticleSystem(activePartConfig, false);
    toggleParticleSystem(activePartConfig, true);
  }
}

// Bind Sliders to Inputs
if(ctrlDens) ctrlDens.addEventListener('input', e => { inpDens.value = e.target.value; syncPartInput('count', true); });
if(inpDens) inpDens.addEventListener('change', e => { syncPartInput('count', true); });

if(ctrlSize) ctrlSize.addEventListener('input', e => { inpSize.value = e.target.value; syncPartInput('size', true); });
if(inpSize) inpSize.addEventListener('change', e => { syncPartInput('size', true); });

if(ctrlSpd) ctrlSpd.addEventListener('input', e => { inpSpd.value = e.target.value; syncPartInput('speed', false); });
if(inpSpd) inpSpd.addEventListener('change', e => { syncPartInput('speed', false); });

if(ctrlSpr) ctrlSpr.addEventListener('input', e => { inpSpr.value = e.target.value; syncPartInput('spread', true); });
if(inpSpr) inpSpr.addEventListener('change', e => { syncPartInput('spread', true); });

function toggleParticleSystem(name, active) {
  const cfg = PARTICLE_CFG[name];
  if (!active) {
    if (pSystems[name]) {
      scene.remove(pSystems[name].mesh);
      pSystems[name].mesh.geometry.dispose();
      pSystems[name].mesh.material.dispose();
      delete pSystems[name];
    }
    return;
  }

  const count = cfg.count;
  const spr = cfg.spread;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifespans = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    lifespans[i] = Math.random();
    if (cfg.type === 'expand') {
      positions[i*3]   = (Math.random() - 0.5) * 2 * spr;
      positions[i*3+1] = Math.random() * 2 * spr;
      positions[i*3+2] = (Math.random() - 0.5) * 2 * spr;
      velocities[i*3]   = (Math.random() - 0.5) * 0.01;
      velocities[i*3+1] = Math.random() * 0.02 + 0.01;
      velocities[i*3+2] = (Math.random() - 0.5) * 0.01;
    } else if (cfg.type === 'smoke_volumetric') {
      positions[i*3]   = (Math.random() - 0.5) * 3 * spr;
      positions[i*3+1] = Math.random() * 6 * spr;
      positions[i*3+2] = (Math.random() - 0.5) * 3 * spr;
      velocities[i*3]   = (Math.random() - 0.5) * 0.005;
      velocities[i*3+1] = Math.random() * 0.015 + 0.005;
      velocities[i*3+2] = (Math.random() - 0.5) * 0.005;
    } else if (cfg.type === 'fall_fast') {
      positions[i*3]   = (Math.random() - 0.5) * 10 * spr;
      positions[i*3+1] = Math.random() * 10 * spr;
      positions[i*3+2] = (Math.random() - 0.5) * 10 * spr;
      velocities[i*3]   = 0;
      velocities[i*3+1] = -(Math.random() * 0.2 + 0.2);
      velocities[i*3+2] = 0;
    } else {
      positions[i*3]   = (Math.random() - 0.5) * 10 * spr;
      positions[i*3+1] = Math.random() * 6 * spr;
      positions[i*3+2] = (Math.random() - 0.5) * 10 * spr;
      
      if (cfg.type === 'rise') {
        velocities[i*3]   = (Math.random() - 0.5) * 0.02;
        velocities[i*3+1] = Math.random() * 0.03 + 0.01;
        velocities[i*3+2] = (Math.random() - 0.5) * 0.02;
      } else if (cfg.type === 'fall_slow') {
        velocities[i*3]   = (Math.random() - 0.5) * 0.01;
        velocities[i*3+1] = -(Math.random() * 0.02 + 0.01);
        velocities[i*3+2] = (Math.random() - 0.5) * 0.01;
      } else {
        velocities[i*3]   = (Math.random() - 0.5) * 0.002;
        velocities[i*3+1] = Math.random() * 0.003 + 0.001;
        velocities[i*3+2] = (Math.random() - 0.5) * 0.002;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
  geo.setAttribute('lifespan', new THREE.Float32BufferAttribute(lifespans, 1));
  
  let mat;
  if (cfg.type === 'smoke_volumetric') {
    mat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(cfg.color) },
        map: { value: new THREE.CanvasTexture(createSoftTexture()) },
        globalOpacity: { value: cfg.op },
        globalSize: { value: cfg.size * 50.0 }
      },
      vertexShader: `
        attribute float lifespan;
        varying float vLife;
        uniform float globalSize;
        void main() {
          vLife = lifespan;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float currentSize = globalSize * (1.0 + (1.0 - lifespan) * 3.0);
          gl_PointSize = currentSize * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform sampler2D map;
        uniform float globalOpacity;
        varying float vLife;
        void main() {
          vec4 texColor = texture2D(map, gl_PointCoord);
          float alpha = texColor.a * globalOpacity;
          alpha *= smoothstep(0.0, 0.2, vLife) * smoothstep(1.0, 0.5, vLife);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  } else {
    let mapUrl = null;
    if (cfg.type === 'fall_fast') mapUrl = createDropTexture();
    else mapUrl = createSoftTexture();
    
    let matParams = { 
      color: cfg.color, 
      size: cfg.size, 
      transparent: true, 
      opacity: cfg.op, 
      depthWrite: false,
      sizeAttenuation: true,
      blending: (cfg.type === 'rise' || cfg.type === 'float_large' || cfg.type === 'float') ? THREE.AdditiveBlending : THREE.NormalBlending
    };
    
    if (mapUrl) {
      matParams.map = new THREE.CanvasTexture(mapUrl);
      matParams.alphaMap = matParams.map;
    }
    
    mat = new THREE.PointsMaterial(matParams);
  }
  
  const mesh = new THREE.Points(geo, mat);
  scene.add(mesh);
  pSystems[name] = { mesh, type: cfg.type, name: name };
}

function createSoftTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0,0,64,64);
  return c;
}

function createDropTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(6,0,4,64);
  return c;
}

function animateParticles() {
  Object.keys(pSystems).forEach(function(key) {
    const sys = pSystems[key];
    const cfg = PARTICLE_CFG[sys.name];
    const pos = sys.mesh.geometry.attributes.position;
    const vel = sys.mesh.geometry.attributes.velocity;
    const life = sys.mesh.geometry.attributes.lifespan;
    const count = pos.count;
    const time = Date.now() * 0.001;
    const spr = cfg.spread;
    const spd = cfg.speed;

    for (let i = 0; i < count; i++) {
      let vx = vel.array[i*3] * spd;
      let vy = vel.array[i*3+1] * spd;
      let vz = vel.array[i*3+2] * spd;
      
      let wx = globalWindX * 0.05 * spd;
      let wz = globalWindZ * 0.05 * spd;
      
      if (sys.type === 'fall_fast') {
        wx = globalWindX * 0.2 * spd;
        wz = globalWindZ * 0.2 * spd;
      }
      
      pos.array[i*3]   += vx + wx;
      pos.array[i*3+1] += vy;
      pos.array[i*3+2] += vz + wz;
      
      if (sys.type === 'snow') {
        pos.array[i*3] += Math.sin(time + i) * 0.005 * spd;
      }
      
      if (sys.type === 'expand') {
        life.array[i] -= 0.005 * spd;
        if (life.array[i] < 0 || pos.array[i*3+1] > 6 * spr) {
          pos.array[i*3] = (Math.random() - 0.5) * 2 * spr;
          pos.array[i*3+1] = 0;
          pos.array[i*3+2] = (Math.random() - 0.5) * 2 * spr;
          life.array[i] = 1;
        }
      } else if (sys.type === 'smoke_volumetric') {
        life.array[i] -= 0.002 * spd;
        if (life.array[i] < 0 || pos.array[i*3+1] > 8 * spr) {
          pos.array[i*3] = (Math.random() - 0.5) * 3 * spr;
          pos.array[i*3+1] = -1 * spr;
          pos.array[i*3+2] = (Math.random() - 0.5) * 3 * spr;
          life.array[i] = 1;
        }
      } else {
        if (pos.array[i*3+1] > 8 * spr && vy > 0) pos.array[i*3+1] = -2 * spr;
        if (pos.array[i*3+1] < -2 * spr && vy < 0) pos.array[i*3+1] = 8 * spr;
        if (pos.array[i*3] > 6 * spr) pos.array[i*3] = -6 * spr;
        if (pos.array[i*3] < -6 * spr) pos.array[i*3] = 6 * spr;
        if (pos.array[i*3+2] > 6 * spr) pos.array[i*3+2] = -6 * spr;
        if (pos.array[i*3+2] < -6 * spr) pos.array[i*3+2] = 6 * spr;
      }
    }
    pos.needsUpdate = true;
    life.needsUpdate = true;
  });
}

setInterval(animateParticles, 16);

['Dust','Embers','Smoke','Rain','Snow','Bokeh'].forEach(function(name) {
  const btn = document.getElementById('btnTgl' + name);
  if (btn) {
    btn.addEventListener('click', function() {
      const effectName = name.toLowerCase();
      const isActive = btn.dataset.active === 'true';
      const newState = !isActive;
      btn.dataset.active = newState.toString();
      btn.classList.toggle('active', newState);
      toggleParticleSystem(effectName, newState);
      if(typeof updateEnvSounds !== 'undefined') updateEnvSounds();
      
      activePartConfig = effectName;
      updatePartUI(effectName);
    });
  }
});


/* ── WOW EFEKTLERİ (God Rays, Hologram, Audio) ── */

// 1. GOD RAYS (Işık Huzmesi)
let godRayMesh = null;
const btnGodRay = document.getElementById('godRayToggle');
if(btnGodRay) {
  btnGodRay.addEventListener('change', (e) => {
    if(e.target.checked) {
      if(!godRayMesh) {
        const geo = new THREE.CylinderGeometry(0.5, 6, 15, 32, 1, true);
        geo.translate(0, -7.5, 0); // origin top
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            color: { value: new THREE.Color(0xffeedd) },
            intensity: { value: 0.15 }
          },
          vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `,
          fragmentShader: `
            uniform vec3 color;
            uniform float intensity;
            varying vec3 vWorldPosition;
            void main() {
              float depthFade = smoothstep(-15.0, 0.0, vWorldPosition.y);
              vec3 viewDir = normalize(cameraPosition - vWorldPosition);
              float alpha = intensity * depthFade;
              float d = length(vWorldPosition.xz);
              alpha *= smoothstep(6.0, 0.0, d);
              gl_FragColor = vec4(color, alpha);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        godRayMesh = new THREE.Mesh(geo, mat);
        godRayMesh.position.set(0, 10, 0);
      }
      scene.add(godRayMesh);
    } else {
      if(godRayMesh) scene.remove(godRayMesh);
    }
  });
}

// 2. HOLOGRAM MODU
const originalMaterials = new Map();
hologramMat = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(0x00ffff) }
  },
  vertexShader: `
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      float scanline = sin(vPosition.y * 50.0 - time * 5.0) * 0.5 + 0.5;
      float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
      rim = smoothstep(0.6, 1.0, rim);
      float alpha = max(scanline * 0.3, rim * 0.8);
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  wireframe: true
});

let isHologram = false;
let savedHoloBg = null;
const savedLightStates = {};
const btnHolo = document.getElementById('hologramToggle');
if(btnHolo) {
  btnHolo.addEventListener('change', (e) => {
    isHologram = e.target.checked;
    
    if(isHologram) {
      // Karanlık uzay / bilim-kurgu arkaplanı ve ışıkları kapat
      savedHoloBg = scene.background;
      scene.background = new THREE.Color(0x020205);
      
      savedLightStates.hemi = hemi.intensity;
      hemi.intensity = 0.05;
      
      Object.keys(lightObjects).forEach(k => {
        savedLightStates[k] = lightObjects[k].spot.intensity;
        lightObjects[k].spot.intensity = 0;
      });
    } else {
      // Işıkları ve arkaplanı geri getir
      if (savedHoloBg !== undefined) scene.background = savedHoloBg;
      hemi.intensity = savedLightStates.hemi;
      
      Object.keys(lightObjects).forEach(k => {
        if(savedLightStates[k] !== undefined) {
          lightObjects[k].spot.intensity = savedLightStates[k];
        }
      });
    }

    if(!mainProductWrapper) return;
    if(isHologram) {
      mainProductWrapper.traverse(child => {
        if(child.isMesh) {
          if(!originalMaterials.has(child)) originalMaterials.set(child, child.material);
          child.material = hologramMat;
        }
      });
    } else {
      mainProductWrapper.traverse(child => {
        if(child.isMesh && originalMaterials.has(child)) {
          child.material = originalMaterials.get(child);
        }
      });
    }
  });
}

// 3. SİNEMATİK KAMERA
const btnCine = document.getElementById('cinematicCamToggle');
if(btnCine) {
  btnCine.addEventListener('change', (e) => {
    cinematicMode = e.target.checked;
  });
}

// 4. AUDIO ENGINE (Sentezlenmiş Sesler)
const AudioEngine = (function() {
  let ctx = null;
  let isMuted = false;
  let activeNodes = {};

  function init() {
    if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(ctx.state === 'suspended') ctx.resume();
  }

  function createNoiseBuffer(duration) {
    if(!ctx) return null;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function startSound(name) {
    if(isMuted) return;
    init();
    if(activeNodes[name]) return;

    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(2);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if(name === 'wind') {
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      gain.gain.value = 0.8;
    } else if(name === 'rain') {
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      gain.gain.value = 0.5;
    } else if(name === 'fire') {
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      gain.gain.value = 0.4;
      
      const crkGain = ctx.createGain();
      crkGain.gain.value = 0.5;
      crkGain.connect(ctx.destination);
      
      const crkInt = setInterval(() => {
        if(!activeNodes['fire'] || isMuted) return;
        if(Math.random() > 0.3) return;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(100 + Math.random()*200, ctx.currentTime);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        o.connect(g); g.connect(crkGain);
        o.start(); o.stop(ctx.currentTime + 0.1);
      }, 100);
      
      activeNodes[name] = { src, gain, filter, crkInt };
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
      return;
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    activeNodes[name] = { src, gain, filter };
  }

  function stopSound(name) {
    if(activeNodes[name]) {
      activeNodes[name].src.stop();
      activeNodes[name].src.disconnect();
      if(activeNodes[name].crkInt) clearInterval(activeNodes[name].crkInt);
      delete activeNodes[name];
    }
  }

  function toggleMute(muted) {
    isMuted = muted;
    if(isMuted) {
      Object.keys(activeNodes).forEach(k => {
        activeNodes[k].gain.gain.value = 0;
      });
    } else {
      if(activeNodes['wind']) activeNodes['wind'].gain.gain.value = 0.8;
      if(activeNodes['rain']) activeNodes['rain'].gain.gain.value = 0.5;
      if(activeNodes['fire']) activeNodes['fire'].gain.gain.value = 0.4;
    }
  }

  return { startSound, stopSound, toggleMute, init };
})();

const audioTgl = document.getElementById('audioToggle');
if(audioTgl) {
  audioTgl.addEventListener('change', e => {
    AudioEngine.init();
    AudioEngine.toggleMute(!e.target.checked);
  });
}

function updateEnvSounds() {
  let needsWind = pSystems['snow'] || pSystems['smoke'] || pSystems['dust'] || pSystems['bokeh'];
  if(needsWind) AudioEngine.startSound('wind'); else AudioEngine.stopSound('wind');

  if(pSystems['rain']) AudioEngine.startSound('rain'); else AudioEngine.stopSound('rain');
  if(pSystems['embers']) AudioEngine.startSound('fire'); else AudioEngine.stopSound('fire');
}

/* ── 5. STÜDYO ŞABLONLARI (Lighting Presets) ── */
const STUDIO_PRESETS = {
  cinematic: {
    bg: 0x0a0a0d,
    hemi: { sky: 0x1a1a2e, ground: 0x050508, intensity: 0.2 },
    lights: [
      { label: 'Key', kelvin: 3200, power: 85, hAngle: 45, vAngle: 55, dist: 5, spread: 30, pen: 0.3, blur: 4, decay: 1.5, diffOn: true, diffR: 0.8, diffD: 0.5, diffO: 0.4 },
      { label: 'Fill', kelvin: 5500, power: 25, hAngle: -90, vAngle: 35, dist: 6, spread: 50, pen: 0.6, blur: 8, decay: 1.2, diffOn: true, diffR: 1.2, diffD: 0.5, diffO: 0.3 }
    ],
    toastMsg: '🎬 Sinematik şablon uygulandı'
  },
  ecommerce: {
    bg: 0xfafafa,
    hemi: { sky: 0xffffff, ground: 0xe0e0e0, intensity: 0.6 },
    lights: [
      { label: 'Ana Işık', kelvin: 5600, power: 90, hAngle: 30, vAngle: 60, dist: 4.5, spread: 45, pen: 0.5, blur: 6, decay: 1, diffOn: true, diffR: 1.0, diffD: 0.5, diffO: 0.5 },
      { label: 'Fill Sol', kelvin: 6000, power: 60, hAngle: -60, vAngle: 45, dist: 5, spread: 50, pen: 0.55, blur: 7, decay: 1, diffOn: true, diffR: 1.0, diffD: 0.5, diffO: 0.4 },
      { label: 'Arka Işık', kelvin: 5500, power: 40, hAngle: 180, vAngle: 50, dist: 5, spread: 40, pen: 0.4, blur: 5, decay: 1, diffOn: false, diffR: 0.6, diffD: 0.5, diffO: 0.3 }
    ],
    toastMsg: '🛒 E-Ticaret şablonu uygulandı'
  },
  neon: {
    bg: 0x050010,
    hemi: { sky: 0x0a0020, ground: 0x000005, intensity: 0.1 },
    lights: [
      { label: 'Neon Mavi', kelvin: 9500, power: 80, hAngle: -45, vAngle: 40, dist: 4, spread: 35, pen: 0.3, blur: 3, decay: 1.5, diffOn: false, diffR: 0.6, diffD: 0.5, diffO: 0.3 },
      { label: 'Neon Pembe', kelvin: 2200, power: 70, hAngle: 90, vAngle: 35, dist: 4, spread: 35, pen: 0.3, blur: 3, decay: 1.5, diffOn: false, diffR: 0.6, diffD: 0.5, diffO: 0.3 }
    ],
    toastMsg: '🌈 Neon şablon uygulandı'
  },
  sunset: {
    bg: 0x1a0a00,
    hemi: { sky: 0xff6a00, ground: 0x1a0500, intensity: 0.3 },
    lights: [
      { label: 'Gün Batımı', kelvin: 1900, power: 95, hAngle: 90, vAngle: 20, dist: 7, spread: 25, pen: 0.2, blur: 2, decay: 0.8, diffOn: false, diffR: 0.6, diffD: 0.5, diffO: 0.3 },
      { label: 'Soft Fill', kelvin: 4500, power: 20, hAngle: -60, vAngle: 50, dist: 6, spread: 55, pen: 0.65, blur: 10, decay: 1.2, diffOn: true, diffR: 1.2, diffD: 0.5, diffO: 0.3 }
    ],
    toastMsg: '🌅 Gün Batımı şablonu uygulandı'
  },
  luxury: {
    bg: 0x030303,
    hemi: { sky: 0x050505, ground: 0x010101, intensity: 0.05 },
    lights: [
      { label: 'Spotlight', kelvin: 4200, power: 100, hAngle: 10, vAngle: 65, dist: 4, spread: 18, pen: 0.15, blur: 2, decay: 2, diffOn: false, diffR: 0.6, diffD: 0.5, diffO: 0.3 }
    ],
    toastMsg: '🖤 Luxury Dark şablonu uygulandı'
  },
  nature: {
    bg: 0x0d1a0d,
    hemi: { sky: 0x4a7a3a, ground: 0x1a2a0a, intensity: 0.4 },
    lights: [
      { label: 'Gün Işığı', kelvin: 5500, power: 75, hAngle: 25, vAngle: 55, dist: 5, spread: 45, pen: 0.5, blur: 7, decay: 1, diffOn: true, diffR: 1.0, diffD: 0.5, diffO: 0.5 },
      { label: 'Dolgu', kelvin: 7000, power: 35, hAngle: -80, vAngle: 40, dist: 6, spread: 55, pen: 0.6, blur: 9, decay: 1, diffOn: true, diffR: 1.0, diffD: 0.5, diffO: 0.35 }
    ],
    toastMsg: '🌿 Doğal şablon uygulandı'
  }
};

function applyStudioPreset(key) {
  const preset = STUDIO_PRESETS[key];
  if (!preset) return;

  // Arka plan
  scene.background = new THREE.Color(preset.bg);

  // Hemi ışık
  hemi.color.set(preset.hemi.sky);
  hemi.groundColor.set(preset.hemi.ground);
  hemi.intensity = preset.hemi.intensity;

  // Mevcut ışıkları temizle
  Object.keys(lightObjects).forEach(function(id) { destroyLight(id); });
  document.querySelectorAll('.light-card').forEach(function(c) { c.remove(); });

  // Yeni ışıkları ekle
  preset.lights.forEach(function(s) {
    const id = buildLight(s);
    pc.insertBefore(buildCard(id), pc.querySelector('.add-card'));
  });
  updTitle();

  document.querySelectorAll('.sp-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.preset === key);
  });

  toast(t(preset.toastMsg));
  pushUndo();
}

document.querySelectorAll('.sp-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { applyStudioPreset(btn.dataset.preset); });
});

})();



const t = text => text;
function initTranslation() {}
function setLanguage(lang) {}

