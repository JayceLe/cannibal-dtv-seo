import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as echarts from 'echarts/core';
import {PieChart} from 'echarts/charts';
import {TooltipComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {donutOption,highlightDonut} from '../src/lib/chart-interactions';
echarts.use([PieChart,TooltipComponent,SVGRenderer]);

test('actual ECharts SVG highlights one DMC3, dims other slices and resets after rapid reversal',()=>{
 const chart=echarts.init(null,undefined,{renderer:'svg',ssr:true,width:244,height:244});
 try{
  chart.setOption({...donutOption([{name:'PIN APPLE',value:70,percent:70,color:'#f2ce80'},{name:'CAMERA',value:30,percent:30,color:'#8bb4ff'}]),animation:false,stateAnimation:{duration:0}});
  const render=()=>{chart.getZr().animation.trigger('frame',0);return chart.renderToSVGString();};
  highlightDonut(chart,'CAMERA');let svg=render();
  assert.match(svg,/<path[^>]*fill="#f2ce80"[^>]*fill-opacity="0\.22"/);
  assert.match(svg,/<path[^>]*stroke="#ffffff"[^>]*ecmeta_data_index="1"/);
  highlightDonut(chart,'PIN APPLE');svg=render();
  assert.match(svg,/<path[^>]*fill="#8bb4ff"[^>]*fill-opacity="0\.22"/);
  assert.match(svg,/<path[^>]*stroke="#ffffff"[^>]*ecmeta_data_index="0"/);
  highlightDonut(chart,null);svg=render();assert.doesNotMatch(svg,/fill-opacity="0\.22"|stroke="#ffffff"/);
  assert.equal((chart.getOption().tooltip as {show:boolean}[])[0].show,false,'No floating tooltip can cover the center readout');
 }finally{chart.dispose();}
});
