import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {gsap} from 'gsap';

// DOM simulation tests lifecycle/interaction only; it does not replace visual browser QA.
const win=new Window({url:'https://dashboard.test'});
let reduced=false,desktop=true;
class Media extends win.EventTarget{
 constructor(readonly media:string){super();}
 get matches(){return this.media.includes('prefers-reduced-motion')?(this.media.includes('no-preference')?!reduced:reduced):(this.media.includes('min-width')?desktop:true);}
 onchange=null;
 addListener(fn:Parameters<Media['addEventListener']>[1]){this.addEventListener('change',fn);}
 removeListener(fn:Parameters<Media['removeEventListener']>[1]){this.removeEventListener('change',fn);}
}
const media:Media[]=[];
const match=(query:string)=>{const item=new Media(query);media.push(item);return item;};
Object.defineProperty(win,'matchMedia',{value:match});
class Intersections{
 static instances:Intersections[]=[];
 readonly targets=new Set<Element>();
 constructor(readonly callback:(entries:unknown[])=>void){Intersections.instances.push(this);}
 observe(target:Element){this.targets.add(target);}
 unobserve(target:Element){this.targets.delete(target);}
 disconnect(){this.targets.clear();}
 emit(target:Element,isIntersecting=true){this.callback([{target,isIntersecting}]);}
}
for(const key of ['document','HTMLElement','Element','Node','SVGElement','MutationObserver'] as const)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:win[key]});
Object.defineProperty(globalThis,'getComputedStyle',{configurable:true,writable:true,value:win.getComputedStyle.bind(win)});
Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,writable:true,value:win.requestAnimationFrame.bind(win)});
Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,writable:true,value:win.cancelAnimationFrame.bind(win)});
Object.defineProperty(globalThis,'window',{configurable:true,value:win});
Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,value:Intersections});
Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:match});
gsap.ticker.wake();
const wait=(ms=20)=>new Promise(resolve=>setTimeout(resolve,ms));

async function preference(value:boolean){reduced=value;await wait();media.forEach(item=>item.dispatchEvent(new win.Event('change')));await wait();}

test('GSAP entrances remain readable, observe new sections and clean listeners/tweens on remount',async()=>{
 const {mountDashboardMotion}=await import('../src/lib/dashboard-motion');
 const root=win.document.createElement('div');root.innerHTML='<section data-motion-reveal><strong>592</strong></section><button class="btn">Import</button>';
 win.document.body.append(root);
 const clean=mountDashboardMotion(root as unknown as HTMLElement);
 const section=root.querySelector('section')!,button=root.querySelector('button')!;
 assert.equal(section.style.opacity,'','Baseline content is visible before JS reveal');
 const io=Intersections.instances.at(-1)!;io.emit(section as unknown as Element);
 assert.ok(Number(section.style.opacity)>=.65,'Entrance never hides the real number');
 gsap.getTweensOf(section).forEach(t=>t.progress(1));assert.equal(section.textContent,'592');
 button.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));
 assert.ok(gsap.getTweensOf(button).length>0);
 win.dispatchEvent(new win.PointerEvent('pointerup',{button:0,pointerType:'mouse'}));
 gsap.getTweensOf(button).forEach(t=>t.progress(1));assert.equal(Number(gsap.getProperty(button,'scale')),1);
 const next=win.document.createElement('section');next.dataset.motionReveal='';root.append(next);await wait();assert.ok(io.targets.has(next as unknown as Element));
 clean();assert.equal(io.targets.size,0);assert.equal(gsap.getTweensOf(button).length,0);assert.equal(button.style.transform,'');
 button.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));assert.equal(gsap.getTweensOf(button).length,0,'No listener survives unmount');
 const cleanAgain=mountDashboardMotion(root as unknown as HTMLElement);cleanAgain();root.remove();gsap.ticker.sleep();
});

test('live reduced-motion preference cancels owned animation and leaves final content usable',async()=>{
 const {mountDashboardMotion}=await import('../src/lib/dashboard-motion');
 const root=win.document.createElement('div');root.innerHTML='<section data-motion-reveal>27,36%</section><button class="btn">Chọn</button>';win.document.body.append(root);
 const clean=mountDashboardMotion(root as unknown as HTMLElement),section=root.querySelector('section')!,button=root.querySelector('button')!;
 Intersections.instances.at(-1)!.emit(section as unknown as Element);
 button.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));
 await preference(true);
 assert.equal(gsap.getTweensOf(button).length,0);assert.equal(section.style.opacity,'');assert.equal(section.style.transform,'');assert.equal(section.textContent,'27,36%');
 button.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));assert.equal(gsap.getTweensOf(button).length,0);
 clean();root.remove();await preference(false);gsap.ticker.sleep();
});

test('metric cards coordinate reveal, pointer light and press without changing values or scale',async()=>{
 const {mountMetricMotion}=await import('../src/lib/metric-motion');
 const root=win.document.createElement('div');
 root.innerHTML='<button data-metric-surface><span class="highlight-label">Group</span><strong class="highlight-main">592</strong><span class="highlight-footer">27 groups</span></button><article data-metric-surface><strong class="report-card-value">19</strong></article>';
 win.document.body.append(root);const clean=mountMetricMotion(root as unknown as HTMLElement);
 const button=root.querySelector('button')!,value=button.querySelector('strong')!,article=root.querySelector('article')!;
 Object.defineProperty(button,'getBoundingClientRect',{value:()=>({left:10,top:20,width:200,height:100})});
 const io=Intersections.instances.at(-1)!;io.emit(button as unknown as Element);
 assert.equal(value.textContent,'592');assert.ok(Number(value.style.opacity)>=.68);
 gsap.getTweensOf(value).forEach(t=>t.progress(1));assert.equal(value.style.transform,'');
 button.dispatchEvent(new win.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse',clientX:160,clientY:45}));
 assert.ok(button.hasAttribute('data-metric-active'));
 gsap.getTweensOf(button).forEach(t=>t.progress(1));
 assert.equal(button.style.getPropertyValue('--metric-light'),'1');assert.equal(Number(button.style.getPropertyValue('--spot-x')),75);
 assert.equal(Number(gsap.getProperty(button,'scale')),1);assert.equal(value.textContent,'592');
 button.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0}));assert.ok(button.hasAttribute('data-metric-pressed'));
 win.dispatchEvent(new win.PointerEvent('pointerup',{button:0}));assert.equal(button.hasAttribute('data-metric-pressed'),false);
 article.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0}));assert.equal(article.hasAttribute('data-metric-pressed'),false,'Read-only cards do not pretend to be buttons');
 button.dispatchEvent(new win.PointerEvent('pointerout',{bubbles:true,pointerType:'mouse'}));assert.equal(button.hasAttribute('data-metric-active'),false);
 const next=win.document.createElement('article');next.dataset.metricSurface='';root.append(next);await wait();assert.ok(io.targets.has(next as unknown as Element));
 clean();assert.equal(io.targets.size,0);assert.equal(gsap.getTweensOf(button).length,0);assert.equal(button.style.getPropertyValue('--metric-light'),'');
 button.dispatchEvent(new win.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));assert.equal(button.hasAttribute('data-metric-active'),false);
 root.remove();gsap.ticker.sleep();
});

test('metric ring entrance preserves exact proportions and reduced motion stops every owned effect',async()=>{
 const {mountMetricMotion}=await import('../src/lib/metric-motion');
 const root=win.document.createElement('div');
 root.innerHTML='<div data-metric-surface><div class="ratio-visual"><svg><circle data-ratio-progress="6.7" stroke-dasharray="6.7 93.3"/></svg><strong>6,7%</strong></div><div class="ratio-copy"><span>592 / 8.831</span></div></div>';
 win.document.body.append(root);const clean=mountMetricMotion(root as unknown as HTMLElement),card=root.firstElementChild!,arc=card.querySelector('circle')!;
 Intersections.instances.at(-1)!.emit(card as unknown as Element);
 assert.equal(arc.getAttribute('stroke-dasharray'),'6.7 93.3','Underlying data is never changed by animation');
 card.dispatchEvent(new win.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
 await preference(true);
 assert.equal(gsap.getTweensOf(arc).length,0);assert.equal(arc.style.strokeDasharray,'');
 assert.equal(card.hasAttribute('data-metric-active'),false);assert.equal(card.querySelector('strong')?.textContent,'6,7%');
 assert.equal((card as unknown as HTMLElement).style.getPropertyValue('--metric-light'),'');
 clean();root.remove();await preference(false);gsap.ticker.sleep();
});

test('query disclosure supports rapid reversal and live reduced motion',async()=>{
 const React=await import('react'),{createRoot}=await import('react-dom/client'),{act}=React;
 const {default:QueryExpansion}=await import('../src/components/query-expansion');
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,writable:true,value:true});
 const host=win.document.createElement('div');win.document.body.append(host);const root=createRoot(host as unknown as Element);
 const render=(open:boolean)=>React.createElement('table',null,React.createElement('tbody',null,React.createElement(QueryExpansion,{id:'detail-test',open,children:React.createElement('a',{href:'#url'},'TOP 1')})));
 await act(async()=>root.render(render(false)));assert.equal(host.querySelector('tr'),null);
 await act(async()=>root.render(render(true)));assert.equal(host.querySelector('a')?.textContent,'TOP 1');
 await act(async()=>root.render(render(false)));assert.equal(host.querySelector('tr')?.getAttribute('aria-hidden'),'true');assert.ok(host.querySelector('[inert]'));
 await act(async()=>root.render(render(true)));assert.equal(host.querySelector('tr')?.hasAttribute('aria-hidden'),false);
 await act(async()=>root.render(render(false)));
 await act(async()=>{await preference(true);});assert.equal(host.querySelector('tr'),null,'Closing row cannot remain stuck when preference changes');
 await act(async()=>root.render(render(true)));assert.equal(host.querySelector('a')?.textContent,'TOP 1');
 await act(async()=>root.render(render(false)));assert.equal(host.querySelector('tr'),null);
 await act(async()=>root.unmount());host.remove();await preference(false);gsap.ticker.sleep();
});


test('Three header discards pending loads and disposes scenes when hidden, offscreen or unmounted',async()=>{
 const {mountHeaderScene}=await import('../src/lib/header-scene-lifecycle');
 const header=win.document.createElement('header'),host=win.document.createElement('div');header.append(host);win.document.body.append(header);
 let created=0,destroyed=0,loads=0;
 const factory={createHeaderScene:()=>{created++;return()=>{destroyed++;};}};
 let resolve!:(value:typeof factory)=>void;
 const cleanPending=mountHeaderScene(host as unknown as HTMLElement,header as unknown as HTMLElement,()=>{loads++;return new Promise(done=>{resolve=done;});});
 assert.equal(loads,1);cleanPending();resolve(factory);await wait();assert.equal(created,0,'No canvas can initialize after unmount');
 const clean=mountHeaderScene(host as unknown as HTMLElement,header as unknown as HTMLElement,async()=>factory);await wait();assert.equal(created,1);
 const observer=Intersections.instances.at(-1)!;observer.emit(header as unknown as Element,false);assert.equal(destroyed,1);
 observer.emit(header as unknown as Element,true);await wait();assert.equal(created,2);
 await preference(true);assert.equal(destroyed,2);clean();assert.equal(destroyed,2,'Cleanup must not dispose twice');
 let restrictedLoads=0;
 const cleanReduced=mountHeaderScene(host as unknown as HTMLElement,header as unknown as HTMLElement,async()=>{restrictedLoads++;return factory;});await wait();assert.equal(restrictedLoads,0);cleanReduced();
 await preference(false);desktop=false;
 const cleanMobile=mountHeaderScene(host as unknown as HTMLElement,header as unknown as HTMLElement,async()=>{restrictedLoads++;return factory;});await wait();assert.equal(restrictedLoads,0,'Narrow screens do not download WebGL');cleanMobile();desktop=true;header.remove();gsap.ticker.sleep();
});

test('legend tracking scrolls only its own viewport, cancels stale moves and obeys reduced motion',async()=>{
 const {revealLegendItem}=await import('../src/lib/chart-interactions');
 const container=win.document.createElement('div'),row=win.document.createElement('button');container.append(row);win.document.body.append(container);
 Object.defineProperty(container,'clientHeight',{value:200});Object.defineProperty(container,'scrollHeight',{value:1400});
 container.getBoundingClientRect=()=>new win.DOMRect(0,100,240,200);
 row.getBoundingClientRect=()=>new win.DOMRect(0,800,240,44);
 const clean=revealLegendItem(container as unknown as HTMLElement,row as unknown as HTMLElement);
 gsap.getTweensOf(container).forEach(t=>t.progress(1));assert.equal(container.scrollTop,622);assert.equal(win.scrollY,0);
 clean();container.scrollTop=0;
 const cancel=revealLegendItem(container as unknown as HTMLElement,row as unknown as HTMLElement);cancel();assert.equal(gsap.getTweensOf(container).length,0);
 const follow=revealLegendItem(container as unknown as HTMLElement,row as unknown as HTMLElement);await preference(true);assert.equal(container.scrollTop,622);assert.equal(gsap.getTweensOf(container).length,0);follow();
 await preference(false);container.remove();gsap.ticker.sleep();
});

test('hover and keyboard focus link both DMC3 legends without changing the selected filter',async()=>{
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {CategoryDistributions}=await import('../src/components/overview-charts');
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class{observe(){}disconnect(){}}});
 const width=Object.getOwnPropertyDescriptor(win.HTMLElement.prototype,'clientWidth'),height=Object.getOwnPropertyDescriptor(win.HTMLElement.prototype,'clientHeight');
 Object.defineProperty(win.HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>300});Object.defineProperty(win.HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>244});
 const host=win.document.createElement('div');win.document.body.append(host);const root=createRoot(host as unknown as Element);
 const categories=[{name:'PIN APPLE',total:20,cannibal:10,danger:4,impressions:1000,cannibalImpressions:300},{name:'CAMERA',total:50,cannibal:5,danger:2,impressions:900,cannibalImpressions:200}];
 let selections=0;
 await act(async()=>{root.render(React.createElement(CategoryDistributions,{categories,selected:'',onSelect:()=>{selections++;}}));await wait(30);});
 const button=host.querySelector('.distribution-legend button')!;
 await act(async()=>{button.dispatchEvent(new win.PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));});
 assert.equal(host.querySelectorAll('.distribution-legend .is-highlighted').length,2);assert.equal(host.querySelectorAll('.distribution-legend .is-dimmed').length,2);assert.equal(selections,0);
 assert.equal(host.querySelectorAll('.distribution-detail.is-active').length,2);
 assert.ok([...host.querySelectorAll('.distribution-detail')].every(d=>d.textContent?.includes('PIN APPLE')));
 const camera=host.querySelectorAll('.distribution-legend button')[1] as typeof button;
 await act(async()=>{(camera as unknown as HTMLButtonElement).focus();});
 assert.ok([...host.querySelectorAll('.distribution-detail')].every(d=>d.textContent?.includes('CAMERA')));assert.equal(selections,0);
 await act(async()=>{(camera as unknown as HTMLButtonElement).blur();await wait(120);});assert.equal(host.querySelectorAll('.is-highlighted').length,0);
 await act(async()=>{button.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));});assert.equal(selections,1);
 await act(async()=>root.unmount());host.remove();
 if(width)Object.defineProperty(win.HTMLElement.prototype,'clientWidth',width);else Reflect.deleteProperty(win.HTMLElement.prototype,'clientWidth');
 if(height)Object.defineProperty(win.HTMLElement.prototype,'clientHeight',height);else Reflect.deleteProperty(win.HTMLElement.prototype,'clientHeight');
 gsap.ticker.sleep();
});

test('count-up keeps an accessible final number, ends exactly and cancels on reduced motion',async()=>{
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {default:AnimatedNumber}=await import('../src/components/animated-number');
 const host=win.document.createElement('div');win.document.body.append(host);const root=createRoot(host as unknown as Element);
 await act(async()=>root.render(React.createElement(AnimatedNumber,{value:17954})));
 const display=host.querySelector('.number-display')!;
 assert.equal(host.querySelector('[aria-label]')?.getAttribute('aria-label'),'17.954');
 Intersections.instances.at(-1)!.emit(display as unknown as Element);
 await wait(800);assert.equal(display.textContent,'17.954');
 await act(async()=>root.render(React.createElement(AnimatedNumber,{value:27.36,digits:2,suffix:'%'})));
 await act(async()=>preference(true));assert.equal(display.textContent,'27,36%');
 await act(async()=>root.render(React.createElement(AnimatedNumber,{value:0})));assert.equal(display.textContent,'0');
 await act(async()=>preference(false));
 await act(async()=>root.render(React.createElement(AnimatedNumber,{value:68,instant:true})));assert.equal(display.textContent,'68');
 await act(async()=>root.render(React.createElement(AnimatedNumber,{value:-32})));await wait(800);assert.equal(display.textContent,'-32');
 await act(async()=>root.unmount());host.remove();gsap.ticker.sleep();
});

test('DMC3 picker keeps typography stable with search, keyboard selection, escape and all reset',async()=>{
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {default:Dmc3Picker}=await import('../src/components/dmc3-picker');
 const host=win.document.createElement('div');win.document.body.append(host);const root=createRoot(host as unknown as Element);
 const categories=[{name:'CAMERA',total:10,cannibal:2,danger:0,impressions:100,cannibalImpressions:10},{name:'PIN APPLE',total:20,cannibal:3,danger:0,impressions:500,cannibalImpressions:30}];let chosen='';
 const render=(value:string)=>React.createElement(Dmc3Picker,{categories,value,onChange:(v:string)=>{chosen=v;}});
 await act(async()=>root.render(render('')));const trigger=host.querySelector('button')!;assert.equal(trigger.textContent,'Tất cả');
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 const input=host.querySelector('input')!;assert.equal(win.document.activeElement,input);
 await act(async()=>{input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'End',bubbles:true}));});
 await act(async()=>{input.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});assert.equal(chosen,'PIN APPLE');assert.equal(host.querySelector('[role="listbox"]'),null);assert.equal(win.document.activeElement,trigger);
 await act(async()=>root.render(render(chosen)));
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>{host.querySelector('input')!.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(chosen,'PIN APPLE');
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 const search=host.querySelector('input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!.call(search,'camera');search.dispatchEvent(new win.Event('input',{bubbles:true}));});
 assert.equal(host.querySelectorAll('[role="option"]').length,1);assert.equal(host.querySelector('[role="option"]')!.textContent,'CAMERA');
 await act(async()=>{search.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});assert.equal(chosen,'CAMERA');
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>{const field=host.querySelector('input')!;field.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Home',bubbles:true}));});
 await act(async()=>host.querySelector('input')!.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.equal(chosen,'');
 await act(async()=>root.unmount());host.remove();gsap.ticker.sleep();
});

test('query dialog isolates detail, supports Escape/close and releases scroll lock',async()=>{
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {QueryDetailDialog}=await import('../src/components/query-table');
 const originalShow=win.HTMLDialogElement.prototype.showModal,originalClose=win.HTMLDialogElement.prototype.close;
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const host=win.document.createElement('div');win.document.body.append(host);const root=createRoot(host as unknown as Element);
 const record={key:'pin',query:'thay pin iphone',categories:['PIN APPLE'],urls:[],impressions:0,clicks:0,position:null,gap:null,cannibal:false,status:'none' as const,invalid_rows:0};
 let closed=0;await act(async()=>root.render(React.createElement(QueryDetailDialog,{record,categories:[],onClose:()=>{closed++;}})));
 const dialog=host.querySelector('dialog')!;assert.equal(dialog.open,true);assert.equal(win.document.documentElement.style.overflow,'hidden');
 assert.equal(host.querySelector('h2')!.textContent,'thay pin iphone');
 await act(async()=>dialog.dispatchEvent(new win.Event('cancel',{bubbles:true,cancelable:true})));assert.equal(closed,1);
 await act(async()=>host.querySelector('button')!.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));assert.equal(closed,2);
 await act(async()=>root.unmount());assert.equal(win.document.documentElement.style.overflow,'');
 win.HTMLDialogElement.prototype.showModal=originalShow;win.HTMLDialogElement.prototype.close=originalClose;host.remove();gsap.ticker.sleep();
});

test('comparison date pickers adjust the other day and filter chips preserve their counts',async()=>{
 const width=Object.getOwnPropertyDescriptor(win.HTMLElement.prototype,'clientWidth'),height=Object.getOwnPropertyDescriptor(win.HTMLElement.prototype,'clientHeight');
 Object.defineProperty(win.HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>520});Object.defineProperty(win.HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>300});
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 const {default:ComparisonPeriods}=await import('../src/components/comparison-periods');
 const {default:Comparison}=await import('../src/components/comparison');
 const {comparisonFilters,comparisonFromRecords}=await import('../src/lib/comparison');
 const {olderRecords,newerRecords}=await import('./comparison-fixtures');
 const weeks=[{id:'29',week_start:'2026-10-29',created_at:'2026-10-29',file_name:'a',status:'ready'},{id:'20',week_start:'2026-10-20',created_at:'2026-10-20',file_name:'b',status:'ready'},{id:'19',week_start:'2026-10-19',created_at:'2026-10-19',file_name:'c',status:'ready'}];
 const host=win.document.createElement('div');win.document.body.append(host);const root=createRoot(host as unknown as Element);let pair={older:'20',newer:'29'};
 function Periods(){const [current,setCurrent]=React.useState(pair);return React.createElement(ComparisonPeriods,{weeks,...current,onChange:(p:typeof pair)=>{pair=p;setCurrent(p);},onImport:()=>{}});}
 await act(async()=>root.render(React.createElement(Periods)));
 const triggers=host.querySelectorAll('.select-menu-trigger');assert.equal(triggers[0].textContent,'20/10/2026');assert.equal(triggers[1].textContent,'29/10/2026');
 await act(async()=>triggers[1].dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>triggers[1].dispatchEvent(new win.KeyboardEvent('keydown',{key:'End',bubbles:true})));
 await act(async()=>triggers[1].dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 assert.deepEqual(pair,{older:'19',newer:'20'});assert.equal(host.querySelectorAll('.select-menu-trigger')[0].textContent,'19/10/2026');
 let filter={...comparisonFilters};const data=comparisonFromRecords(olderRecords,newerRecords);
 const props={weeks,older:'19',newer:'29',onDates:()=>{},category:'',onCategory:()=>{},data,loading:false,filters:filter,onFilter:(p:Partial<typeof filter>)=>{filter={...filter,...p};},onOpen:()=>{},onImport:()=>{}};
 await act(async()=>root.render(React.createElement(Comparison,props)));
 const buttons=[...host.querySelectorAll('.comparison-transition-filters button')],newButton=buttons.find(b=>b.textContent?.includes('Mới bị cannibal'))!;
 assert.ok(newButton.textContent?.endsWith('2'));await act(async()=>newButton.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));assert.equal(filter.transition,'new');
 await act(async()=>root.render(React.createElement(Comparison,{...props,filters:filter})));
 assert.equal(host.querySelector('.comparison-transition-filters .danger.active')?.getAttribute('aria-pressed'),'true');
 await act(async()=>host.querySelector('.comparison-transition-filters .danger.active')!.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));assert.equal(filter.transition,'');
 const groupMetric=host.querySelectorAll('[aria-label=\"Ch\u1ec9 s\u1ed1 bi\u1ebfn \u0111\u1ed9ng DMC3\"] button')[1];
 await act(async()=>groupMetric.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));assert.equal(groupMetric.getAttribute('aria-pressed'),'true');
 await act(async()=>root.unmount());host.remove();
 if(width)Object.defineProperty(win.HTMLElement.prototype,'clientWidth',width);else Reflect.deleteProperty(win.HTMLElement.prototype,'clientWidth');
 if(height)Object.defineProperty(win.HTMLElement.prototype,'clientHeight',height);else Reflect.deleteProperty(win.HTMLElement.prototype,'clientHeight');
 gsap.ticker.sleep();
});

test('select menu portals outside panels, keeps trigger focus and supports choose, Escape, Tab and outside close',async()=>{
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const {default:SelectMenu}=await import('../src/components/select-menu');
 const host=win.document.createElement('div');host.style.overflow='hidden';win.document.body.append(host);const root=createRoot(host as unknown as Element);let selected='impressions';
 function Harness(){const [value,setValue]=React.useState(selected);return React.createElement(SelectMenu,{label:'Sort',value,options:[{value:'impressions',label:'Impression'},{value:'rank',label:'Rank'},{value:'gap',label:'Gap'}],onChange:(v:string)=>{selected=v;setValue(v);}});}
 await act(async()=>root.render(React.createElement(Harness)));const trigger=host.querySelector('button')!;trigger.focus();
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));assert.equal(host.querySelector('[role="listbox"]'),null);assert.ok(win.document.querySelector('[role="listbox"]'));assert.equal(win.document.activeElement,trigger);
 await act(async()=>trigger.dispatchEvent(new win.KeyboardEvent('keydown',{key:'End',bubbles:true})));
 await act(async()=>trigger.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.equal(selected,'gap');assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(win.document.activeElement,trigger);
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>trigger.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(selected,'gap');assert.equal(win.document.querySelector('[role="listbox"]'),null);
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>trigger.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Tab',bubbles:true})));assert.equal(trigger.getAttribute('aria-expanded'),'false');
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>win.document.body.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true})));assert.equal(trigger.getAttribute('aria-expanded'),'false');
 await act(async()=>trigger.dispatchEvent(new win.MouseEvent('click',{bubbles:true})));
 await act(async()=>root.unmount());assert.equal(win.document.querySelector('[role="listbox"]'),null);host.remove();gsap.ticker.sleep();
});
