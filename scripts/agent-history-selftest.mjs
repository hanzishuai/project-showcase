import assert from 'node:assert/strict'
import { build } from '../frontend/node_modules/esbuild/lib/main.js'
const bundle = await build({entryPoints:['frontend/src/agent/fetch.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'mock',setup(b){b.onResolve({filter:/\/(bus|uiState)$/},args=>({path:args.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path.endsWith('bus')?'export const dispatchAction=async()=>({ok:true})':'export const snapshotUiState=()=>({})',loader:'js'}))}}]})
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}
let sse=''
globalThis.fetch=async()=>new Response(sse,{headers:{'Content-Type':'text/event-stream'}})
const {agentFetch,clearAgentHistory}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
async function turn(text){let r=await agentFetch('/api/v1/rag/ask',{method:'POST',body:JSON.stringify({question:text})});await r.text();await new Promise(r=>setTimeout(r,10))}
sse='event: token\ndata: {"text":"回答"}\n\nevent: done\ndata: {}\n\n';await turn('提问');assert.equal(JSON.parse(storage.get('agent-chat-history-v1')).length,2)
clearAgentHistory();assert.equal(JSON.parse(storage.get('agent-chat-history-v1')).length,0)
sse='event: token\ndata: {"text":"未完成"}\n\n';await turn('中断');assert.equal(JSON.parse(storage.get('agent-chat-history-v1')).length,0)
console.log('对话清空及未完成回复不入历史：通过')
