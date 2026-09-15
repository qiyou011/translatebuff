import http from 'node:http'
import fs from 'node:fs/promises'
const dir='/tmp/translatebuff-calibration-9TTcHd'
const origin='chrome-extension://jjgoechanghiknlblangmfijblhggkdl'
http.createServer(async(req,res)=>{
 if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end();return}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type')
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 try{
  const match=/^\/fixtures\/(mdn|react|wikipedia)$/.exec(req.url)
  if(req.method==='GET'&&match){const data=JSON.parse(await fs.readFile(`${dir}/${match[1]}.json`));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({source:data.url,blocks:data.captures.map(x=>({text:x.text,format:x.format,context:x.context}))}));return}
  if(req.method==='POST'&&req.url==='/results/live'){let body='';for await(const chunk of req){body+=chunk;if(body.length>2000000)throw Error('too large')}const data=JSON.parse(body);if(!Array.isArray(data)||data.some(r=>!r.name||!Array.isArray(r.requests)))throw Error('invalid records');await fs.writeFile(`${dir}/live-results.json`,JSON.stringify(data,null,2)+'\n');res.end('saved');console.log('RESULTS_SAVED',data.length);return}
  res.writeHead(404);res.end()
 }catch(e){res.writeHead(400);res.end('invalid test data');console.log('REQUEST_FAILED',String(e.message))}
}).listen(8937,'127.0.0.1',()=>console.log('FIXTURE_SERVER_READY',8937))
