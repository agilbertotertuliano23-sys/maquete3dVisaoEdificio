// Lossless-in-dimensions encoding: preserve the generated PNG masters, create smaller web assets.
const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../assets/panoramas');
const jobs=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^(AP-\d+|CS-\d+|COMUM)$/.test(d.name)).flatMap(d=>fs.readdirSync(path.join(root,d.name)).filter(f=>f.endsWith('.png')).map(f=>path.join(root,d.name,f)));
let cursor=0,converted=0,failed=[];
async function worker(){while(cursor<jobs.length){const src=jobs[cursor++],out=src.replace(/\.png$/,'.webp');if(fs.existsSync(out)&&fs.statSync(out).mtimeMs>=fs.statSync(src).mtimeMs)continue;
 await new Promise(resolve=>{const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',src,'-c:v','libwebp','-quality','88','-compression_level','6',out],{windowsHide:true,stdio:['ignore','ignore','pipe']});let err='';child.stderr.on('data',d=>err+=d);child.on('error',e=>{failed.push({src,error:e.message});resolve()});child.on('exit',code=>{if(code===0)converted++;else failed.push({src,error:err});resolve()})});
}}
Promise.all(Array.from({length:4},worker)).then(()=>{console.log(JSON.stringify({files:jobs.length,converted,failed}));process.exitCode=failed.length?1:0});
