// Export the labeled review cards rendered by the application; preserve panorama masters.
const {chromium}=require('C:/Users/agilb/AppData/Local/ms-playwright-go/1.61.1/package');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const raw=fs.readFileSync('src/tour360Catalogo.js','utf8');const catalog=JSON.parse(raw.split('export const TOUR_CATALOG = ')[1].trim().replace(/;$/,''));
 const dir='assets/panoramas/revisao';fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1774,height:1007},deviceScaleFactor:1});
 let exported=0;
 for(const [id,property] of Object.entries(catalog))for(const room of property.rooms){
  const code=(id+'-'+room.id).toUpperCase().replaceAll('_','-');const out=path.join(dir,code+'.png');
  await page.goto('http://127.0.0.1:18910/revisao360.html?planta='+encodeURIComponent(id)+'&ambiente='+encodeURIComponent(room.id));
  await page.waitForFunction(()=>window.reviewReady);await page.evaluate(()=>window.reviewReady);
  if(await page.locator('strong span').textContent()!==code)throw Error('Identificação incorreta: '+code);
  await page.locator('figure').screenshot({path:out});exported++;
 }
 await browser.close();fs.writeFileSync('assets/panoramas/revisoes-exportadas.json',JSON.stringify({exported,format:'PNG',width:1774,height:1007,labels:'variação, ambiente, código e arquivo original'},null,2));
 console.log(JSON.stringify({exported,directory:dir}));
})().catch(e=>{console.error(e);process.exit(1)});
