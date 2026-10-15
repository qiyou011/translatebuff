const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js');

const root = '/Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff';
const artifact = path.join(root, '.output/chrome-mv3-global');
const stamp = new Date().toISOString().replace(/:/g, '-');
const out = path.join(root, 'openspec/changes/upstream-sync-v1-51-0/evidence/global-production-live', stamp);
const controlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'translatebuff-global-prod-control-'));
fs.chmodSync(controlDir, 0o700);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'translatebuff-global-prod-profile-'));
const socket = path.join(controlDir, 'control.sock');
fs.mkdirSync(out, {recursive:true});
const files = [];
function scan(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir,name);
    if (fs.statSync(p).isDirectory()) scan(p);
    else { const b=fs.readFileSync(p); files.push({path:path.relative(artifact,p),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}); }
  }
}
scan(artifact);
const tree = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
if(tree !== 'ea567267f98550bfee72788d6e1e9e2e13e612ee2db28f5e4adc0d07f54f48d6') throw Error('Frozen global production artifact mismatch');

const S = {
  out, profile, artifact, socket, pages:{}, cdp:new Map(), attached:new WeakSet(),
  stopping:false, gatewayCount:0, gatewayBudget:30,
  report:{startedAt:new Date().toISOString(),environment:'global-production',sourceCandidateSha:'5ac5122a6a4d390b3131f917dd09aa2caf5f5342',sourceSnapshotSha:'e1d90dc928ca5fbbbba112e480131e1c909c93ce',artifactTreeSha256:tree,artifactFiles:files,mode:'real-account-real-youtube-and-discord-no-fixture-no-provider-stub',cases:[],limitations:['Browser startup before listener attachment is not fully captured. No headers, credentials, request/response bodies, private chat contents or URL queries are recorded.'],networkCounts:{playwright:0,cdp:0}}
};
S.safe = raw => {
  try {
    const u = new URL(raw);
    const origin = u.origin==='null'?`${u.protocol}//${u.host}`:u.origin;
    let p=u.pathname;
    if (/(^|\.)discord\.com$/.test(u.hostname) && p.startsWith('/channels/')) p='/channels/[private-route]';
    p=p.replace(/\b\d{16,}\b/g,'[id]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email]').replace(/\b1[3-9]\d{9}\b/g,'[phone]').replace(/(?:sk-[\w-]+|eyJ[\w.-]{20,})/g,'[redacted]');
    return origin+p;
  } catch { return '[non-url]'; }
};
S.save = () => fs.writeFileSync(path.join(S.out,'result.json'),JSON.stringify(S.report,null,2)+'\n');
S.record = x => { S.report.cases.push({at:new Date().toISOString(),...x});S.save();return x; };
S.log = (channel,entry) => {
  S.report.networkCounts[channel]++;
  fs.appendFileSync(path.join(S.out,`${channel}-network.jsonl`),JSON.stringify({at:new Date().toISOString(),...entry})+'\n');
};
S.stopBrowser = async reason => {
  if(S.stopping) return;
  S.stopping=true;
  S.record({id:'browser-stop',status:'STOPPED',reason,gatewayCount:S.gatewayCount,gatewayBudget:S.gatewayBudget});
  await S.context.close().catch(()=>{});
};
S.attach = async p => {
  if(S.attached.has(p)) return;
  S.attached.add(p);
  const key='page-'+(S.attachedCount=(S.attachedCount??0)+1);
  const c=await S.context.newCDPSession(p);
  S.cdp.set(p,c);
  c.on('Network.requestWillBeSent',e=>S.log('cdp',{event:'request',target:key,page:S.safe(p.url()),requestId:e.requestId,url:S.safe(e.request.url),method:e.request.method,initiatorType:e.initiator?.type,ownContentInitiator:JSON.stringify(e.initiator??{}).includes(`chrome-extension://${S.id}/`)}));
  c.on('Network.responseReceived',e=>S.log('cdp',{event:'response',target:key,requestId:e.requestId,url:S.safe(e.response.url),status:e.response.status}));
  await c.send('Network.enable');
};
S.open = async (name,url,background=true) => {
  const marker='about:blank#translatebuff-owned-'+name+'-'+crypto.randomBytes(6).toString('hex');
  await S.browserCdp.send('Target.createTarget',{url:marker,background});
  let p;
  for(let n=0;n<100;n++){
    p=S.context.pages().find(p=>p.url()===marker);
    if(p)break;
    await new Promise(r=>setTimeout(r,50));
  }
  if(!p)throw Error('Owned target not found for '+name);
  S.pages[name]=p;
  await S.attach(p);
  const response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:25000}).catch(e=>({status:()=>null,error:e.name}));
  return {url:S.safe(p.url()),httpStatus:response?.status()??null,error:response?.error??null};
};
S.runtime = (type,data) => S.pages.popup.evaluate(async({type,data})=>chrome.runtime.sendMessage({id:Date.now(),timestamp:Date.now(),type,data}),{type,data});

(async()=>{
  S.context=await chromium.launchPersistentContext(profile,{executablePath:chromium.executablePath(),headless:false,ignoreDefaultArgs:['--disable-extensions','--enable-automation'],viewport:{width:1440,height:1000},args:['--no-first-run','--no-default-browser-check',`--disable-extensions-except=${artifact}`,`--load-extension=${artifact}`]});
  S.context.on('request',r=>{
    let context='page-or-content',frame=null,worker=null;
    try { const w=r.serviceWorker();if(w){worker=S.safe(w.url());context=worker.startsWith(`chrome-extension://${S.id}/`)?'own-service-worker':'website-or-unresolved-worker';}else{frame=S.safe(r.frame().url());if(frame.startsWith(`chrome-extension://${S.id}/`))context='own-extension-page';} }catch{}
    S.log('playwright',{event:'request',url:S.safe(r.url()),method:r.method(),context,frame,worker});
    if(r.method()==='POST' && /\/(?:chat\/completions|responses)\/?$/.test(new URL(r.url()).pathname)){
      S.gatewayCount++;
      if(S.gatewayCount>=S.gatewayBudget)void S.stopBrowser('Reached bounded real translation request budget');
    }
  });
  S.context.on('response',r=>{
    S.log('playwright',{event:'response',url:S.safe(r.url()),status:r.status()});
    if(r.status()===429&&/\/(?:chat\/completions|responses)\/?$/.test(new URL(r.url()).pathname)) void S.stopBrowser('Real gateway HTTP429; stop to avoid automatic retry traffic');
  });
  S.context.on('requestfailed',r=>S.log('playwright',{event:'failure',url:S.safe(r.url()),error:r.failure()?.errorText}));
  const worker=S.context.serviceWorkers()[0]??await S.context.waitForEvent('serviceworker',{timeout:25000});
  S.id=new URL(worker.url()).host;
  S.report.extensionId=S.id;
  S.report.browserVersion=S.context.browser().version();
  S.context.on('page',p=>S.attach(p).catch(e=>{S.report.limitations.push('CDP attachment failed: '+e.name);S.save();}));
  for(const p of S.context.pages())await S.attach(p);
  S.browserCdp=await S.context.browser().newBrowserCDPSession();
  await S.open('popup',`chrome-extension://${S.id}/popup.html`,false);
  await S.pages.popup.getByRole('button',{name:/^(登录|Log in|Login)$/i}).first().waitFor({state:'visible',timeout:15000});
  await S.pages.popup.evaluate(async()=>{const {config}=await chrome.storage.local.get('config');await chrome.storage.local.set({config:{...config,pageTranslation:{...config.pageTranslation,node:{...config.pageTranslation.node,enabled:false}}}});});
  await S.pages.popup.getByRole('button',{name:/^(登录|Log in|Login)$/i}).first().click();
  for(let n=0;n<100;n++){
    S.pages.login=S.context.pages().find(p=>{try{const u=new URL(p.url());return u.hostname==='www.translatebuff.com'&&/\/login\/?$/.test(u.pathname);}catch{return false;}});
    if(S.pages.login)break;
    await new Promise(r=>setTimeout(r,100));
  }
  if(!S.pages.login)throw Error('Actual global production login target was not found');
  await S.pages.login.waitForLoadState('domcontentloaded',{timeout:20000}).catch(()=>{});
  await S.pages.login.bringToFront();
  S.record({id:'production-login',status:'WAITING_FOR_USER',url:S.safe(S.pages.login.url()),expectedWebsite:'https://www.translatebuff.com'});
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='POST'){res.writeHead(405);res.end();return;}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>200000){res.writeHead(413);res.end();return;}}
    try{
      const input=JSON.parse(body);
      if(input.action==='close'){
        if(!S.stopping)await S.context.close();
        fs.rmSync(S.profile,{recursive:true,force:true});
        S.report.finishedAt=new Date().toISOString();S.report.cleanup={ownBrowserClosed:true,ownProfileRemoved:!fs.existsSync(S.profile)};S.save();
        res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({closed:true,out:S.out}));
        setTimeout(()=>server.close(()=>process.exit(0)),100);return;
      }
      const fn=new Function('S','require','return (async()=>{'+input.code+'})();');
      const result=await fn(S,require);S.save();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,result}));
    }catch(e){S.save();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:e.name,message:String(e.message).replace(/https?:\/\/[^\s)]+/g,S.safe).slice(0,1200)}));}
  });
  server.listen(socket,()=>{fs.chmodSync(socket,0o600);console.log(JSON.stringify({ready:true,socket,out:S.out,extensionId:S.id,loginUrl:S.safe(S.pages.login.url()),artifactTreeSha256:tree}));});
})().catch(e=>{S.report.startupError={name:e.name,message:String(e.message).slice(0,300)};S.save();console.error(JSON.stringify(S.report.startupError));process.exitCode=1;});
