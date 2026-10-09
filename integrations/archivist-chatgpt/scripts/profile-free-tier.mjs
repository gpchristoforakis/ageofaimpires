import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/archive.mjs';

// Isolated local workerd measurement: no credentials, provider calls or deployment.
// Local elapsed processing is a screening proxy, not Cloudflare's billed CPU metric.
const root = fileURLToPath(new URL('../', import.meta.url));
const benchmark = `
import {createMcpHandler,RequestGuard} from './src/mcp.mjs';
import {extractEntry} from './src/entries.mjs';
import {registry} from './src/archive.mjs';
export default {async fetch(request) {
 const {kind,id,html} = await request.json();
 const doc = registry.find(row=>row.slug===id) || registry[0];
 let pageResponse;
 const handler = createMcpHandler({apiKey:'offline-profile-fixture',guard:new RequestGuard({perMinute:10000}),
   fetchImpl:async(url)=>String(url).includes('generativelanguage.googleapis.com')
    ? Response.json({candidates:[{content:{parts:[{text:'Entry #01 distinguishes stopping from completion.'}]},groundingMetadata:{groundingChunks:[{retrievedContext:{uri:doc.fileSearchDocName,title:doc.title}}],groundingSupports:[{groundingChunkIndices:[0]}]}}]})
    : pageResponse});
 const samples=[];let output;
 for(let run=0;run<10;run++) {
  // Creating a string-backed fixture encodes HTML; production fetch does not
  // encode a JavaScript fixture, so keep fixture preparation outside timing.
  if(html)pageResponse=new Response(html,{headers:{'content-type':'text/html'}});
  const call = new Request('https://mcp.example/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:run+1,method:'tools/call',params:{name:kind==='query'?'query_archive':'fetch_entry',arguments:kind==='query'?{question:'What is the completion boundary?'}:{id}}})});
  const start=performance.now();
  if(kind==='extract') { output=extractEntry(html,doc); }
  else { const response=await handler(call); output=JSON.parse(await response.text());if(response.status!==200)throw Error('Unexpected MCP status '+response.status); }
  const elapsed=performance.now()-start;
  if(run>=3)samples.push(elapsed);
 }
 samples.sort((a,b)=>a-b);
 return Response.json({kind,id,medianMs:samples[3],minMs:samples[0],maxMs:samples[6],samplesMs:samples,status:kind==='extract'?output.status:output.result?.structuredContent?.status,error:output.result?.content?.[0]?.text});
}};`;
const bundle = await build({ stdin: { contents: benchmark, resolveDir: root, sourcefile: 'free-tier-profile-worker.mjs' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const production = await build({ entryPoints: [fileURLToPath(new URL('../src/worker.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-09' }));
const report = { testedAt: new Date().toISOString(), environment: 'local workerd', method: '7 warm processing-time samples after 3 warm-ups; mocked I/O, local worktree candidate HTML, full MCP serialization included for fetch/query', limits: { cpuMs:10, requestsPerDay:100000, bundleBytes:64*1024*1024, startupMs:1000 }, productionBundleBytes: production.outputFiles[0].contents.length, caveat: 'Local processing elapsed time is not production CPU accounting; network wait is excluded by using in-memory responses. Production validation remains necessary.', results:[] };
try {
 for (const doc of registry) {
  const html=await readFile(new URL('../../../'+doc.slug+'.html',import.meta.url),'utf8');
  const response=await runtime.dispatchFetch('https://profile.example/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'fetch',id:doc.slug,html})});
  const result=await response.json();
  if(result.status!=='ok')throw Error('Fetch failed for '+doc.slug+': '+JSON.stringify(result));
  delete result.error;
  report.results.push({...result,htmlBytes:Buffer.byteLength(html),medianBelow10Ms:result.medianMs<10});
  console.log(JSON.stringify(report.results.at(-1)));
 }
 const response=await runtime.dispatchFetch('https://profile.example/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'query',id:registry[0].slug})});
 const result=await response.json();delete result.error;
 if(result.status!=='grounded')throw Error('Query benchmark did not return grounded');
 report.results.push({...result,medianBelow10Ms:result.medianMs<10});
 console.log(JSON.stringify(report.results.at(-1)));
} finally {
 await runtime.dispose();
 await writeFile(new URL('../artifacts/free-tier-profile.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({productionBundleBytes:report.productionBundleBytes,over10MsMedian:report.results.filter(result=>!result.medianBelow10Ms).map(result=>result.id)}));
