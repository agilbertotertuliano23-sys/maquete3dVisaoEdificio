const { chromium } = require('C:/Users/agilb/AppData/Local/ms-playwright-go/1.61.1/package');
const fs = require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:18910/tour360.html');
 await page.waitForFunction(()=>window.tour360?.material?.map?.image?.width>0);
 await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished)));
 await page.screenshot({path:'reference/tour360-frente.png'});
 await page.evaluate(()=>{window.tour360.yaw=180;window.tour360.render()});
 await page.screenshot({path:'reference/tour360-costas.png'});
 await page.evaluate(()=>{window.tour360.yaw=360;window.tour360.render()});
 await page.screenshot({path:'reference/tour360-volta.png'});
 const beforeDrag=await page.evaluate(()=>window.tour360.yaw);
 await page.mouse.move(800,370);await page.mouse.down();await page.mouse.move(1000,370,{steps:10});await page.mouse.up();
 if(await page.evaluate(()=>window.tour360.yaw)===beforeDrag)throw Error('Arraste não girou a câmera');
 await page.evaluate(()=>{window.tour360.yaw=90;window.tour360.render()});
 await page.locator('.tour-point').filter({hasText:'Cozinha'}).click();
 await page.waitForFunction(()=>window.tour360.room.id==='cozinha');
 await page.locator('nav [data-room="sala"]').click();
 await page.waitForFunction(()=>window.tour360.room.id==='sala');
 const initial=await page.evaluate(()=>window.tour360.camera.fov);
 await page.locator('[data-action="plus"]').click();
 if(await page.evaluate(()=>window.tour360.camera.fov)>=initial)throw Error('Zoom não alterou a câmera');
 await page.keyboard.press('Escape');
 if(await page.locator('dialog').evaluate(el=>el.open))throw Error('Escape não fechou');
 await page.locator('#start').click();
 await page.waitForFunction(()=>window.tour360?.material?.map?.image?.width>0);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'reference/tour360-mobile.png'});
 if(await page.evaluate(()=>document.querySelector('dialog').scrollWidth>innerWidth))throw Error('Overflow mobile');
 const coverage=await page.evaluate(async()=>{
  const tour=window.tour360;let checked=0;
  for(const [id,property] of Object.entries(tour.catalog)){
   await tour.open(id);
   for(const room of property.rooms){
    await tour.go(room.id);
    if(tour.room.id!==room.id||!tour.material.map?.image?.width||!tour.status.hidden)throw Error('Falha no panorama '+id+'/'+room.id);
    checked++;
   }
  }
  return {checked,textures:tour.renderer.info.memory.textures};
 });
 if(coverage.textures>2)throw Error('Texturas não foram liberadas');
 if(errors.length)throw Error(errors.join('\n'));
 const report={drag:'ok',hotspot:'ok',zoom:'ok',escape:'ok',reopen:'ok',mobile:'ok',...coverage,errors};
 fs.writeFileSync('assets/panoramas/teste-navegador.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
