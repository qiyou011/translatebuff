import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
const dir='/tmp/translatebuff-calibration-9TTcHd'
const original='/Users/yisen/Desktop/Junyun/Projects/Company/translatebuff/.output/chrome-mv3'
const background=await fs.readFile(path.join(original,'background.js'),'utf8')
const needle='maxConcurrent:e.maxConcurrent??4'
if(background.split(needle).length!==2)throw Error('cap replacement is not unique')
const variants=[]
for(const cap of [2,4,6]){
 const artifact=path.join(dir,'artifact-cap-'+cap);await fs.cp(original,artifact,{recursive:true})
 const modified=background.replace(needle,'maxConcurrent:e.maxConcurrent??'+cap)
 await fs.writeFile(path.join(artifact,'background.js'),modified)
 variants.push({cap,artifact,originalSha256:createHash('sha256').update(background).digest('hex'),variantSha256:createHash('sha256').update(modified).digest('hex'),change:'single default maxConcurrent numeric literal; production artifact untouched'})
}
await fs.writeFile(path.join(dir,'matrix-variants.json'),JSON.stringify(variants,null,2)+'\n')
for(let repeat=1;repeat<=3;repeat++)for(const cap of [2,4,6]){
 const variant=variants.find(v=>v.cap===cap);const output=path.join(dir,`cap${cap}-r${repeat}`)
 console.log('MATRIX_START',cap,repeat)
 const status=await new Promise(resolve=>{const child=spawn(process.execPath,[path.join(dir,'collect.mjs'),'react'],{env:{...process.env,CALIBRATION_ARTIFACT:variant.artifact,CALIBRATION_OUT:output},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));child.on('exit',resolve)})
 console.log('MATRIX_END',cap,repeat,status)
}
console.log('MATRIX_DONE')
