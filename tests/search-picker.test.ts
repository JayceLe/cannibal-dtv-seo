import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {gsap} from 'gsap';

test('DMC3 pointer selection commits on the first press without hover scrolling; keyboard still selects',async()=>{
 const win=new Window({url:'https://dashboard.test'});
 for(const key of ['document','HTMLElement','Element','Node','MutationObserver'] as const)Object.defineProperty(globalThis,key,{configurable:true,value:win[key]});
 Object.defineProperty(globalThis,'window',{configurable:true,value:win});
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,value:true});
 Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:true,addEventListener(){},removeEventListener(){}})});
 const {default:SearchPicker}=await import('../src/components/search-picker');
 const container=win.document.createElement('div');win.document.body.append(container);
 const root=createRoot(container as unknown as Element),chosen:string[]=[];
 try{
  await act(async()=>root.render(React.createElement(SearchPicker,{label:'DMC3',value:'',options:[{value:'',label:'Tất cả'},{value:'PIN',label:'PIN'},{value:'CAMERA',label:'CAMERA'}],onChange:(name:string)=>chosen.push(name)})));
  await act(async()=>container.querySelector('button')!.click());
  const list=container.querySelector('.picker-list')!,row=list.children[1];
  Object.defineProperty(list,'clientHeight',{value:44});Object.defineProperty(row,'offsetTop',{value:200});Object.defineProperty(row,'offsetHeight',{value:44});
  await act(async()=>row.dispatchEvent(new win.PointerEvent('pointermove',{bubbles:true,pointerType:'mouse'})));
  assert.equal(list.scrollTop,0,'Hover must not move the intended row');
  await act(async()=>row.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'mouse',button:0})));
  assert.deepEqual(chosen,['PIN']);assert.equal(container.querySelector('.picker-trigger')!.getAttribute('aria-expanded'),'false');
  await act(async()=>container.querySelector('button')!.click());
  const input=container.querySelector('input')!;
  await act(async()=>input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
  await act(async()=>input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  assert.deepEqual(chosen,['PIN','PIN']);
 }finally{await act(async()=>root.unmount());gsap.ticker.sleep();await win.happyDOM.abort();}
});
