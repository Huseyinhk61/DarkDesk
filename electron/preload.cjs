const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('darkdesk',Object.fromEntries(['scan','history','organize','undo','stats','open','window'].map(name=>[name,(...args)=>ipcRenderer.invoke(name,...args)])));
