import * as THREE from 'three';
import {gsap} from 'gsap';

/** Decorative, on-demand rendering only. No perpetual RAF or animation loop. */
export function createHeaderScene(host:HTMLElement,header:HTMLElement){
 const canvas=document.createElement('canvas');
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});
 if(!gl)return()=>{};
 const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.setClearColor(0,0);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-180,180,50,-50,1,500);
 camera.position.z=180;
 const group=new THREE.Group();scene.add(group);
 const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const material=new THREE.LineBasicMaterial({color:0xb3b3b3,transparent:true,opacity:.6});materials.add(material);
 const addShape=(radius:number,x:number,y:number)=>{
  const base=new THREE.IcosahedronGeometry(radius,0),edges=new THREE.EdgesGeometry(base);base.dispose();geometry.add(edges);
  const shape=new THREE.LineSegments(edges,material);shape.position.set(x,y,0);group.add(shape);
 };
 addShape(43,-12,0);addShape(20,95,18);addShape(12,-98,-12);
 const connectors=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-86,-12,0),new THREE.Vector3(-48,0,0),new THREE.Vector3(30,8,0),new THREE.Vector3(75,18,0)]);
 geometry.add(connectors);group.add(new THREE.LineSegments(connectors,material));
 const pose={x:0,y:0,spin:-.22};let disposed=false;
 const render=()=>{
  if(disposed||document.hidden)return;
  group.rotation.set(.45+pose.y,.25+pose.x,pose.spin);
  renderer.render(scene,camera);
 };
 const resize=()=>{
  const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
  camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);render();
 };
 const toX=gsap.quickTo(pose,'x',{duration:.7,ease:'power3.out',onUpdate:render});
 const toY=gsap.quickTo(pose,'y',{duration:.7,ease:'power3.out',onUpdate:render});
 const pointer=(event:PointerEvent)=>{
  if(event.pointerType!=='mouse')return;
  const bounds=header.getBoundingClientRect();
  toX((event.clientX-bounds.left)/bounds.width*.28-.14);
  toY((event.clientY-bounds.top)/bounds.height*.18-.09);
 };
 const leave=()=>{toX(0);toY(0);};
 const intro=gsap.to(pose,{spin:.12,duration:1.8,ease:'power2.out',onUpdate:render});
 const observer=new ResizeObserver(resize);observer.observe(host);
 header.addEventListener('pointermove',pointer,{passive:true});header.addEventListener('pointerleave',leave);
 const dispose=()=>{
  if(disposed)return;disposed=true;
  observer.disconnect();intro.kill();toX.tween.kill();toY.tween.kill();
  header.removeEventListener('pointermove',pointer);header.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',lost);
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();
 };
 const lost=()=>dispose();canvas.addEventListener('webglcontextlost',lost);
 try{host.append(canvas);resize();}catch{dispose();}
 return dispose;
}
