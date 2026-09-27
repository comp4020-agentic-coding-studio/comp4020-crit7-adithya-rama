import {chromium} from "@playwright/test";
import axe from "axe-core";
import {spawn} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
const base=process.env.TEST_URL||"http://127.0.0.1:4321";
const db=join(mkdtempSync(join(tmpdir(),"planner-browser-")),"app.db");
let server;
async function start(){
 if(process.env.TEST_URL)return;
 server=spawn("node",["dist/server/entry.mjs"],{env:{...process.env,HOST:"127.0.0.1",PORT:"4321",DATABASE_PATH:db},stdio:"ignore"});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error("Server did not start");
}
const prefix=process.env.TEST_URL?"live-":"";
const report={date:new Date().toISOString(),base,checks:[],screenshots:[]};
mkdirSync("docs/screenshots",{recursive:true});
await start();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync("/home/adithyarama/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome")?"/home/adithyarama/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome":undefined),args:["--no-sandbox"]});
async function audit(page,label){
 await page.addScriptTag({content:axe.source});
 const result=await page.evaluate(async()=>await window.axe.run(document));
 assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),[],label+" accessibility");
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+" overflow");
 report.checks.push(label+": axe, contrast and overflow passed");
}
try{
 for(const [label,width,height] of [["desktop",1920,1080],["mobile",390,844]]){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  await page.goto(base);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".skip").evaluate(e=>e===document.activeElement),true);
  assert.notEqual(await page.locator(".skip").evaluate(e=>getComputedStyle(e).outlineStyle),"none");
  await audit(page,label+" home");
  await page.keyboard.press("Tab"); await page.screenshot({path:"docs/screenshots/"+prefix+label+"-home.png",fullPage:true});
  for(const path of ["/explore","/account?mode=register","/sources","/catalogue/2025/program/7706XMCOMP","/catalogue/2026/specialisation/HCCM-SPEC","/catalogue/2026/course/COMP6442","/readme/"]){await page.goto(base+path);await audit(page,label+" "+path);}
  await page.goto(base);
  await page.getByRole("button",{name:/example plan/}).click();
  await page.waitForURL("**/plan?**");
  const planUrl=page.url();const id=new URL(planUrl).searchParams.get("id");
  await audit(page,label+" authenticated plan");
  await page.screenshot({path:"docs/screenshots/"+prefix+label+"-plan.png",fullPage:true});
  const selected=page.locator(".planned-course").filter({hasText:"COMP8020"});
  await selected.getByText("Why this counts & conditions").click();
  await selected.getByText("Move course",{exact:true}).click();
  await selected.locator("input[name=year]").fill("2027");
  await selected.getByRole("button",{name:"Save move"}).click();
  await page.waitForURL("**/plan?id=*");
  const moved=await (await context.request.get(base+"/api/plan?id="+id)).json();
  assert.equal(moved.plan.selections.find(s=>s.code==="COMP8020").year,2027);
  const card=page.locator(".planned-course").filter({hasText:"COMP8020"});
  await card.getByText("Why this counts & conditions").click();
  assert(!((await card.innerText()).includes("Contributes 6 units to Advanced human-centred computing.")));
  await card.getByRole("button",{name:"Remove COMP8020"}).click();
  await page.waitForURL("**/plan?id=*");
  await page.locator(".manual-add>summary").click();
  await page.locator("#direct-course").fill("COMP6670");
  await page.locator("#direct-year").fill("2026");
  await page.locator("#direct-session").selectOption("Second Semester");
  await page.getByRole("button",{name:"Add tentative choice"}).click();
  await page.waitForURL("**/plan?id=*&year=2026&session=Second%20Semester");
  const corrected=page.locator(".planned-course").filter({hasText:"COMP6670"});
  await corrected.getByText("Why this counts & conditions").click();
  assert.equal(await corrected.locator(".course-explanation .status.met").count(),3);
  await page.reload();assert.equal(await page.locator(".planned-course").filter({hasText:"COMP6670"}).count(),1);
  await page.getByRole("link",{name:/Manage my study record/}).click();
  await audit(page,label+" study");
  await page.locator("#course").fill("COMP6240");
  await page.route("**/api/action",route=>route.abort());
  await page.getByRole("button",{name:/Add to my study record/}).click();
  await page.getByRole("alert").filter({hasText:/Connection lost/}).waitFor();
  assert.equal(await page.locator("#course").inputValue(),"COMP6240");
  await page.unroute("**/api/action");
  await page.getByRole("button",{name:/Add to my study record/}).click();
  await page.waitForURL("**/study**");
  await page.locator(".record-row").filter({hasText:"COMP6240"}).waitFor();
  await page.reload();
  assert.equal(await page.locator(".record-row").count(),7);
  await page.goto(base+"/account?mode=register");
  const username="browser_"+label+"_"+Date.now(),password="a-browser-test-password";
  await page.getByLabel("Username",{exact:true}).fill(username);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Save demo to my account"}).click();
  await page.waitForURL("**/account?created=1");
  const recovery=await page.locator(".recovery-code").innerText();
  assert(recovery.length>10);
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await page.waitForURL(base+"/");
  await page.goto(base+"/account");
  await page.getByLabel("Username",{exact:true}).fill(username);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign in →",exact:true}).click();
  await page.waitForURL("**/plan");
  assert.equal(await page.locator(".planned-course").count(),2);
  await page.goto(base+"/review?id="+id);
  await audit(page,label+" printable review");
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator(".site-header").isVisible(),false);
  await page.emulateMedia({media:"screen"});
  if(!process.env.TEST_URL){
   server.kill();await new Promise(r=>server.once("exit",r));await start();
   await page.reload();assert.equal(await page.locator("h1").count(),1);
   const restored=await (await context.request.get(base+"/api/plan?id="+id)).json();
   assert.equal(restored.plan.selections.length,2);assert.equal(restored.completed.earned,42);
   report.checks.push(label+": database and session survived process restart and migrations");
  }
  report.checks.push(label+": keyboard focus, demo isolation, course move, year-limited substitution, valid alternative saved and reloaded, failed-save retry, academic record reload, demo adoption, sign-out/sign-in and print passed");
  report.screenshots.push(prefix+label+"-home.png",prefix+label+"-plan.png");
  await context.close();
 }
 writeFileSync("docs/"+prefix+"browser-results.json",JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e);for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:"docs/screenshots/failure.png",fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();server?.kill();}
