import fs from 'node:fs/promises'
import {getEncoding} from './node_modules/js-tiktoken/dist/index.js'
import * as prompts from '/Users/yisen/Desktop/Junyun/Projects/Company/translatebuff/src/utils/constants/prompt.ts'
const enc=getEncoding('o200k_base')
const target='Simplified Mandarin Chinese'
const replace=s=>s.replaceAll('{{targetLanguage}}',target).replaceAll('{{webTitle}}','No title available').replaceAll('{{webSummary}}','No summary available')
const oldSystem=replace([prompts.DEFAULT_TRANSLATE_SYSTEM_PROMPT,prompts.DEFAULT_BATCH_TRANSLATE_PROMPT,prompts.DEFAULT_SENTINEL_TRANSLATE_PROMPT].join('\n\n'))
const newSystem=replace(prompts.DEFAULT_TRANSLATE_SYSTEM_PROMPT+'\nReturn only a JSON object with the same keys as input (t0, t1, ...). Translate each string independently; preserve HTML tags and ids. No extra keys.\n'+prompts.DEFAULT_SENTINEL_TRANSLATE_PROMPT)
const rows=[]
for(const slug of ['mdn','react','wikipedia']){
 const data=JSON.parse(await fs.readFile(`/tmp/translatebuff-calibration-9TTcHd/${slug}.json`))
 const texts=data.captures.map(x=>x.text.replace(/[\u200B-\u200D\uFEFF]/g,'').trim()).filter(Boolean)
 for(const [items,chars]of [[4,1000],[8,2000],[16,4000]])for(const protocol of ['legacy','json']){
  const batches=[];let current=[];let size=0
  for(const text of texts){if(current.length&&(current.length>=items||size+text.length>chars)){batches.push(current);current=[];size=0}current.push(text);size+=text.length}if(current.length)batches.push(current)
  let tokens=0
  for(const batch of batches){const input=protocol==='legacy'?batch.join('\n\n%%\n\n'):JSON.stringify(Object.fromEntries(batch.map((text,i)=>['t'+i,text])));tokens+=enc.encode(protocol==='legacy'?oldSystem:newSystem).length+enc.encode(replace(prompts.DEFAULT_TRANSLATE_PROMPT).replaceAll('{{input}}',input)).length}
  rows.push({page:slug,sourceItems:texts.length,sourceCharacters:texts.reduce((n,t)=>n+t.length,0),protocol,maxItems:items,maxCharacters:chars,batches:batches.length,inputContentTokens:tokens})
 }
}
const result={tokenizer:'js-tiktoken o200k_base',scope:'static system+user content tokenization; excludes model-specific chat framing, cache effects, arrival timing, retries, fallback and output; all captured inputs retained, no dedup',rows}
await fs.writeFile('/tmp/translatebuff-calibration-9TTcHd/token-analysis.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
