const {chromium}=require('C:/Users/agilb/AppData/Local/ms-playwright-go/1.61.1/package');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE ERROR',m.text())});
 page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()));
 await page.goto('http://127.0.0.1:18910/index.html',{waitUntil:'domcontentloaded',timeout:120000});
 try{await page.waitForFunction(()=>window.ilusaoApp,{timeout:60000})}catch(e){console.log(e.message)}
 console.log(await page.evaluate(()=>({ready:document.readyState,app:!!window.ilusaoApp,body:document.body.innerText.slice(-500)})));
 await page.screenshot({path:'reference/diagnostico-maquete.png'});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
