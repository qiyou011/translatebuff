import { chromium } from '/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
const root='/Users/yisen/Desktop/Junyun/Projects/Company/translatebuff'
const out=process.env.CALIBRATION_OUT||'/tmp/translatebuff-calibration-9TTcHd'
await fs.mkdir(out,{recursive:true})
const artifact=process.env.CALIBRATION_ARTIFACT||`${root}/.output/chrome-mv3`
const urls=[['mdn','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions'],['react','https://react.dev/learn/thinking-in-react'],['wikipedia','https://en.wikipedia.org/wiki/Machine_translation']]
const browser=await chromium.launchPersistentContext(path.join(out,'profile-'+Date.now()),{channel:'chromium',headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${artifact}`,`--load-extension=${artifact}`,'--no-first-run','--no-default-browser-check']})
try {
 const worker=browser.serviceWorkers()[0]??await browser.waitForEvent('serviceworker',{timeout:30000})
 const extensionId=new URL(worker.url()).host
 const popup=await browser.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`)
 await popup.waitForFunction(async()=>!!(await chrome.storage.local.get('config')).config)
 await new Promise(r=>setTimeout(r,4200))
 const env=await popup.evaluate(async()=>{const {config:c}=await chrome.storage.local.get('config');c.language.sourceCode='eng';c.language.targetCode='cmn';c.pageTranslation.providerId=c.providersConfig.find(p=>p.provider==='google-translate').id;c.pageTranslation.mode='bilingual';c.pageTranslation.enableAIContentAware=false;c.pageTranslation.page.range='all';c.pageTranslation.page.preload={margin:1000,threshold:0};c.pageTranslation.page.autoTranslatePatterns=[];c.pageTranslation.page.neverAutoTranslatePatterns=[];await chrome.storage.local.set({config:c});return {provider:c.pageTranslation.providerId,language:c.language,mode:c.pageTranslation.mode,range:c.pageTranslation.page.range,preload:c.pageTranslation.page.preload,batch:c.pageTranslation.batchQueueConfig,queue:c.pageTranslation.requestQueueConfig}})
 console.log('ENV',JSON.stringify({extensionId,...env}))
 await worker.evaluate(()=>{
  globalThis.calibration={phase:'idle',captures:[],requests:[],active:0,peak:0};const original=fetch;
  globalThis.fetch=async function(input,init){const url=typeof input==='string'?input:input.url;const kind=url.includes('translate-pa.googleapis.com')?'google':url.includes('edge.microsoft.com/translate/translatetext')?'microsoft':null;if(!kind)return original.apply(this,arguments);let b;try{b=JSON.parse(init?.body)}catch{}const texts=kind==='google'?b?.[0]?.[0]:b;const a=calibration,r={phase:a.phase,kind,items:texts?.length,chars:texts?.reduce((n,s)=>n+s.length,0),bytes:new TextEncoder().encode(init?.body||'').length,start:performance.now()};a.requests.push(r);a.active++;a.peak=Math.max(a.peak,a.active);try{const response=await original.apply(this,arguments);r.status=response.status;try{const d=await response.clone().json();r.returned=(kind==='google'?d?.[0]:d)?.length}catch{}return response}catch(e){r.status='network-error';r.error=String(e.message).slice(0,100);throw e}finally{r.ms=Math.round(performance.now()-r.start);a.active--}}
  chrome.runtime.onMessage.addListener((m,s)=>{if(m.type==='enqueueTranslateRequest'&&s.tab?.url&&['developer.mozilla.org','react.dev','en.wikipedia.org'].includes(new URL(s.tab.url).hostname))calibration.captures.push({url:s.tab.url,text:m.data.text,format:m.data.textFormat,preserveLineBreaks:m.data.preserveLineBreaks,context:m.data.context,at:Date.now()})})
 })
 for(const [slug,url]of urls.filter(([slug])=>process.argv.length<3||process.argv.slice(2).includes(slug))){
  await worker.evaluate(slug=>{calibration.phase=slug;calibration.captures=[];calibration.requests=[];calibration.peak=0},slug)
  const page=await browser.newPage();page.on('pageerror',e=>console.log('PAGE_ERROR',slug,String(e.message).slice(0,120)))
  try {
   for(let attempt=1;attempt<=3;attempt++){try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});break}catch(e){console.log('NAV_RETRY',slug,attempt,String(e.message).split('\n')[0]);if(attempt===3)throw e;await page.waitForTimeout(1500)}}await page.waitForTimeout(1800)
   await page.evaluate(()=>{globalThis.pageProbe={start:performance.now(),first:null,longTasks:[],frameGaps:[],clicks:0,typed:'',active:true};let prev=performance.now();const tick=t=>{if(!pageProbe.active)return;pageProbe.frameGaps.push(t-prev);prev=t;requestAnimationFrame(tick)};requestAnimationFrame(tick);const box=document.createElement('div');box.translate=false;box.id='calibration-probe';box.style='position:fixed;right:5px;bottom:5px;z-index:2147483647;background:white;color:black;padding:8px';const button=document.createElement('button');button.id='calibration-click';button.textContent='probe';button.onclick=()=>pageProbe.clicks++;const input=document.createElement('input');input.id='calibration-input';input.oninput=()=>pageProbe.typed=input.value;box.append(button,input);document.body.append(box);new PerformanceObserver(l=>pageProbe.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});new MutationObserver(()=>{if(pageProbe.first===null&&Array.from(document.querySelectorAll('.read-frog-translated-content-wrapper')).some(n=>/[一-鿿]/.test(n.textContent||'')))pageProbe.first=performance.now()-pageProbe.start}).observe(document.documentElement,{subtree:true,childList:true,characterData:true})})
   const toggle=await popup.evaluate(async url=>{const t=(await chrome.tabs.query({})).find(t=>t.url===url);if(!t)throw Error('tab missing');return chrome.runtime.sendMessage({id:Date.now(),type:'tryToSetEnablePageTranslationByTabId',data:{tabId:t.id,enabled:true},timestamp:Date.now()})},url)
   console.log('TOGGLE',slug,JSON.stringify(toggle))
   const inputStart=Date.now();await page.locator('#calibration-click').click();await page.locator('#calibration-input').pressSequentially('hello');const inputWallMs=Date.now()-inputStart
   let stable=0,last=-1
   for(let round=0;round<3;round++){
    await page.evaluate(async()=>{const delay=ms=>new Promise(r=>setTimeout(r,ms));let y=0;while(y<document.documentElement.scrollHeight){scrollTo(0,y);await delay(90);y+=700}scrollTo(0,0)})
    await page.waitForTimeout(700)
   }
   for(let i=0;i<90;i++){const s=await worker.evaluate(()=>({n:calibration.captures.length,active:calibration.active}));const spinners=await page.locator('.read-frog-spinner').count();if(s.n===last&&s.active===0&&spinners===0)stable++;else stable=0;last=s.n;if(stable>=3)break;await page.waitForTimeout(1000)}
   const dom=await page.evaluate(()=>{pageProbe.active=false;return {title:document.title,height:document.documentElement.scrollHeight,scrollY,spinners:document.querySelectorAll('.read-frog-spinner').length,wrappers:document.querySelectorAll('.read-frog-translated-content-wrapper').length,chineseWrappers:Array.from(document.querySelectorAll('.read-frog-translated-content-wrapper')).filter(n=>/[一-鿿]/.test(n.textContent||'')).length,probe:pageProbe}});dom.inputWallMs=inputWallMs
   const audit=await worker.evaluate(()=>calibration)
   const record={url,capturedAt:new Date().toISOString(),browser:await browser.browser()?.version(),artifact,scope:'three full-height scroll passes with stable capture count; synthetic click/input controls on real page',...env,dom,...audit}
   const json=JSON.stringify(record,null,2)+'\n';await fs.writeFile(path.join(out,slug+'.json'),json);await page.screenshot({path:path.join(out,slug+'.png')})
   console.log('CAPTURE',JSON.stringify({slug,blocks:audit.captures.length,chars:audit.captures.reduce((n,x)=>n+x.text.length,0),requests:audit.requests.length,peak:audit.peak,active:audit.active,dom:{...dom,probe:{...dom.probe,frameGaps:undefined}},sha256:createHash('sha256').update(json).digest('hex')}))
  }catch(e){console.log('CAPTURE_FAILED',slug,String(e.message));await fs.writeFile(path.join(out,slug+'-failure.json'),JSON.stringify({url,error:String(e.message)}))}
  await page.close()
 }
 console.log('COLLECTION_DONE')
} finally {await browser.close()}
