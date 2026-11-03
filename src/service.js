import {examples} from './data';
const delay=()=>new Promise(r=>setTimeout(r,650));
let demo=examples.map(i=>({...i})),history=[];
export const native=!!window.darkdesk;
export const api=window.darkdesk||{
 scan:async()=>{await delay();return demo.map(i=>({...i}));},
 history:async()=>history,
 stats:async()=>({desktop:'Demo masaüstü',total:16*1024**3,free:9.2*1024**3,storage:null}),
 organize:async(items,mode)=>{await delay();history=[...history,{id:Date.now(),date:new Date().toISOString(),mode,entries:items,snapshot:demo}];if(mode==='move')demo=demo.filter(i=>!items.some(x=>x.id===i.id));return history.at(-1);},
 undo:async()=>{await delay();const batch=history.at(-1);if(!batch)throw Error('Geri alınacak işlem yok.');demo=batch.snapshot;history=history.slice(0,-1);},
 open:async()=>{throw Error('Dosya açmak için Electron masaüstü uygulamasını kullanın.');},window:()=>{}
};
