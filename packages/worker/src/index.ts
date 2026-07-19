import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DirectFileResolver, MixDropResolver, MockResolver, PlaymogoResolver, PlaywrightCaptureResolver, QueueWorker, Store, type ResolvedSource } from '@lustrestudio/core';

const dbPath=process.env.LUSTRE_DB_PATH||'./data/lustrestudio.db';
mkdirSync(dirname(dbPath),{recursive:true});
const worker=new QueueWorker(new Store(dbPath),[new DirectFileResolver(),new PlaymogoResolver(),new MixDropResolver(),new PlaywrightCaptureResolver(),new MockResolver()],process.env.LUSTRE_DOWNLOAD_ROOT||'./downloads',Number(process.env.LUSTRE_CONCURRENCY||2));
worker.start();
createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/verified-source') return res.writeHead(404).end();
  let body=''; for await(const chunk of req) body+=chunk;
  try { const {jobId,source}=JSON.parse(body) as {jobId:string;source:ResolvedSource}; if(!jobId||!source?.url||!source?.headers||!source?.provider) throw new Error('Invalid verified source'); worker.acceptVerifiedSource(jobId,source); res.writeHead(204).end(); } catch(error:any) { res.writeHead(400,{'content-type':'application/json'}).end(JSON.stringify({error:error.message})); }
}).listen(Number(process.env.LUSTRE_WORKER_HANDOFF_PORT||8790),'127.0.0.1');
console.log('lustrestudio worker started');
