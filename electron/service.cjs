const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const folders = ['Yazılım & Geliştirme','Video & Tasarım','Oyunlar','Ofis & Dokümanlar','Araçlar & Sistem'];
function category(name) {
 if (/code|studio|git|docker|python|\.([jt]sx?|py|json|html)$/i.test(name)) return 0;
 if (/figma|adobe|photoshop|premiere|blender|\.([jp]pe?g|png|svg|mp4|psd|ai)$/i.test(name)) return 1;
 if (/steam|epic|game|oyun|valorant|discord/i.test(name)) return 2;
 if (/word|excel|notion|office|\.((doc|xls|ppt)x?|pdf|txt|csv)$/i.test(name)) return 3;
 return 4;
}
class DesktopService {
 constructor(desktop, data) {this.desktop=desktop;this.log=path.join(data,'history.json');}
 async history(){try{return JSON.parse(await fs.readFile(this.log,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async save(log){await fs.mkdir(path.dirname(this.log),{recursive:true});await fs.writeFile(this.log+'.tmp',JSON.stringify(log,null,2));await fs.rename(this.log+'.tmp',this.log);}
 async scan(){const entries=await fs.readdir(this.desktop,{withFileTypes:true});return Promise.all(entries.filter(e=>e.isFile()&&!e.name.startsWith('.')).map(async e=>({id:e.name,name:e.name,source:path.join(this.desktop,e.name),category:category(e.name),size:(await fs.stat(path.join(this.desktop,e.name))).size})));}
 async organize(items,mode){
 if(!['move','copy'].includes(mode)||!Array.isArray(items)||!items.length)throw Error('Geçersiz işlem.');
 const available=new Set((await this.scan()).map(i=>i.id));
 const plans=items.map(i=>{if(!available.has(i.id)||path.basename(i.id)!==i.id||!Number.isInteger(i.category)||!folders[i.category])throw Error('Geçersiz dosya veya kategori.');return {source:path.join(this.desktop,i.id),target:path.join(this.desktop,folders[i.category],i.id)};});
 if(new Set(plans.map(p=>p.source)).size!==plans.length)throw Error('Yinelenen dosya.');
 const batch={id:crypto.randomUUID(),date:new Date().toISOString(),mode,entries:[],directories:[]};
 const log=await this.history();log.push(batch);await this.save(log);
 try{for(const p of plans){const dir=path.dirname(p.target);try{await fs.mkdir(dir);batch.directories.push(dir);}catch(e){if(e.code!=='EEXIST')throw e;}const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Güvenli olmayan hedef klasör.');
 await fs.copyFile(p.source,p.target,require('node:fs').constants.COPYFILE_EXCL);
 const stat=await fs.stat(p.target);batch.entries.push({...p,size:stat.size,mtime:stat.mtimeMs,removed:false});await this.save(log);
 if(mode==='move'){await fs.unlink(p.source);batch.entries.at(-1).removed=true;await this.save(log);}}
 }catch(e){batch.error=e.message;await this.save(log);throw Error('İşlem durdu: '+e.message+'. Tamamlanan adımlar geçmişten geri alınabilir.');}
 return batch;
 }
 async undo(){const log=await this.history();const batch=log.at(-1);if(!batch)throw Error('Geri alınacak işlem yok.');
 for(const p of [...batch.entries].reverse()){if(p.undone)continue;const stat=await fs.lstat(p.target);if(!stat.isFile()||stat.size!==p.size||stat.mtimeMs!==p.mtime)throw Error('Hedef dosya değişmiş; güvenli geri alma durduruldu.');if(p.removed)await fs.copyFile(p.target,p.source,require('node:fs').constants.COPYFILE_EXCL);await fs.unlink(p.target);p.undone=true;await this.save(log);}
 for(const dir of batch.directories){try{await fs.rmdir(dir);}catch(e){if(!['ENOTEMPTY','ENOENT'].includes(e.code))throw e;}}
 log.pop();await this.save(log);return batch;
 }
}
module.exports={DesktopService,folders,category};
