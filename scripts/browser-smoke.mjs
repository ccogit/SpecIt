import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from 'playwright';

const port=34000+(process.pid%14000),base='http://127.0.0.1:'+port;
const directory=join(process.cwd(),'.artifacts','studio');
await mkdir(directory,{recursive:true});
const server=spawn(process.execPath,['server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),SPECIT_NO_CLAUDE_CODE:'1',SPECIT_NO_CODEX:'1',SPECIT_KEEP_RUNNING:'1'},
  stdio:'ignore'
});
let browser;
try{
  let ready=false;
  for(let i=0;i<140;i++){
    try{if((await fetch(base+'/api/status')).ok){ready=true;break}}catch{}
    await pause(100);
  }
  assert.ok(ready,'server must boot');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});

  // Full desktop path, including automatic planning and a second Autopilot run.
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#phase0').isVisible(),true);
  assert.equal(await page.locator('#magicStart').isDisabled(),true);
  await page.screenshot({path:join(directory,'01-desktop-welcome.png'),fullPage:true});

  await page.getByRole('button',{name:'Immobilien-Cockpit'}).click();
  assert.match(await page.locator('#idea').inputValue(),/Immobilienmakler/);
  assert.match(await page.locator('#briefSignal').innerText(),/Interessenten-Journey/);
  assert.match(await page.locator('#magicStart').innerText(),/Beispielkonzept/);
  await page.locator('#magicStart').click();
  await page.waitForFunction(()=>!document.querySelector('#phase2').classList.contains('hidden'),{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#metricOutput').textContent!=='0',{timeout:30000});
  assert.match(await page.locator('#metricSource').innerText(),/Demo/);
  assert.ok(Number((await page.locator('#metricDecisions').innerText()).replaceAll('.',''))>0);
  await page.screenshot({path:join(directory,'02-desktop-concept.png'),fullPage:true});
  await page.getByRole('button',{name:'✦ Nutzerreise schärfen'}).click();
  assert.match(await page.locator('#wish').inputValue(),/Nutzerreisen/);

  // Open the idea screen, run the same idea a second time (regression).
  await page.locator('.phase').first().click();
  await page.locator('#magicStart').click();
  await page.waitForFunction(()=>!document.querySelector('#phase2').classList.contains('hidden'),{timeout:30000});

  await page.locator('#theme').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.screenshot({path:join(directory,'03-dark-concept.png'),fullPage:true});
  await page.locator('.phase').nth(3).click();
  await page.waitForFunction(()=>!document.querySelector('#phase3').classList.contains('hidden'),{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#planOutput').textContent.trim().length>40,{timeout:30000});
  await page.screenshot({path:join(directory,'04-implementation.png'),fullPage:true});
  assert.equal(errors.length,0,'no browser runtime errors: '+errors.join(' | '));
  await context.close();

  // Mobile/keyboard/advanced options and overflow.
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mobilePage=await mobile.newPage(),mobileErrors=[];
  mobilePage.on('pageerror',e=>mobileErrors.push(e.message));
  await mobilePage.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await mobilePage.locator('#phase0').isVisible(),true);
  await mobilePage.screenshot({path:join(directory,'05-mobile-welcome.png'),fullPage:true});
  await mobilePage.locator('#advancedPanel > summary').click();
  assert.equal(await mobilePage.locator('#advancedPanel').evaluate(e=>e.open),true);
  await mobilePage.screenshot({path:join(directory,'06-mobile-settings.png'),fullPage:true});
  const metrics=await mobilePage.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(metrics.scrollWidth<=metrics.viewport+2,'mobile layout should not overflow: '+JSON.stringify(metrics));
  assert.equal(mobileErrors.length,0,'no mobile runtime errors: '+mobileErrors.join(' | '));
  await mobile.close();

  console.log('PASS: premium studio loads, autogenerates, refines, repeats, plans, themes and adapts to mobile.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
