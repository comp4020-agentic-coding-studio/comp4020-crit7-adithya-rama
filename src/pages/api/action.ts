import type {APIRoute} from "astro";
import {randomBytes,randomUUID} from "node:crypto";
import {eq,and,sql} from "drizzle-orm";
import {currentUser,createUser,authenticate,startSession,endSession,findUser,hashPassword,verifyPassword,isThrottled} from "../../lib/auth";
import {db} from "../../lib/db";
import {users,sessions,plans,selections,loginAttempts} from "../../lib/schema";
import {createPlan,addSelection,getPlan,records,saveRecords,mutatePlan,duplicatePlan,demo,InputError,audit,validSelection} from "../../lib/store";
import {RELEASE,programRules,course} from "../../lib/catalogue";
import {evaluate} from "../../lib/engine";
import {SESSIONS,type StudyRecord,type RecordKind} from "../../lib/types";
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const rate=new Map<string,{n:number;until:number}>();
export const POST:APIRoute=async ctx=>{
 const wantsJSON=ctx.request.headers.get("accept")?.includes("application/json");
 let f:FormData|undefined;
 try{
  if(ctx.request.headers.get("origin")!==ctx.url.origin)throw new InputError("Request origin did not match this website.",403);
  if(Number(ctx.request.headers.get("content-length")||0)>20000)throw new InputError("This submission is too large.");
  f=await ctx.request.formData();
  const text=(k:string,max=200)=>String(f!.get(k)||"").slice(0,max);
  const num=(k:string)=>Number(text(k));
  const action=text("action");let user=currentUser(ctx.cookies);let target="/plan";
  const credentials=()=>{
   const username=text("username").trim().toLowerCase(),password=text("password",257);
   if(!/^[a-z0-9_-]{3,32}$/.test(username)||username.startsWith("demo_"))throw new InputError("Use 3–32 letters, numbers, underscores or hyphens for your username.");
   if(password.length<12||password.length>256)throw new InputError("Use a password between 12 and 256 characters.");
   return {username,password};
  };
  if(["register","login","recover","demo"].includes(action)){
   const key=ctx.request.headers.get("fly-client-ip")||"local";
   const entry=rate.get(key);if(entry&&entry.until>Date.now()&&entry.n>=20)throw new InputError("Too many account requests. Try again in 15 minutes.",429);
   rate.set(key,{n:entry&&entry.until>Date.now()?entry.n+1:1,until:entry&&entry.until>Date.now()?entry.until:Date.now()+900000});
   if(rate.size>1000)for(const [k,v] of rate)if(v.until<Date.now())rate.delete(k);
  }
  if(action==="demo"){
   const d=await createUser("demo_"+randomBytes(10).toString("hex"),randomBytes(24).toString("hex"));
   endSession(ctx.cookies);startSession(d.user.id,ctx.cookies,ctx.url);
   target="/plan?id="+demo(d.user.id)+"&year=2026&session=Second%20Semester";
  }else if(action==="register"){
   const {username,password}=credentials();if(findUser(username))throw new InputError("That username is unavailable.");
   let recoveryCode:string;
   if(user?.username.startsWith("demo_")){
    recoveryCode=randomBytes(12).toString("base64url");
    const passwordHash=await hashPassword(password),recoveryCodeHash=await hashPassword(recoveryCode);
    db.update(users).set({username,passwordHash,recoveryCodeHash}).where(eq(users.id,user.id)).run();
   }else{const created=await createUser(username,password);user=created.user;recoveryCode=created.recoveryCode;}
   endSession(ctx.cookies);startSession(user.id,ctx.cookies,ctx.url);
   ctx.cookies.set("recovery-display",recoveryCode,{httpOnly:true,sameSite:"strict",secure:ctx.url.protocol==="https:",path:"/account",maxAge:120});
   target="/account?created=1";
  }else if(action==="login"){
   const {username,password}=credentials();const found=await authenticate(username,password);
   if(!found)throw new InputError("Unable to sign in. Check your details, or wait if you have tried several times.",401);
   endSession(ctx.cookies);startSession(found.id,ctx.cookies,ctx.url);target="/plan";
  }else if(action==="recover"){
   const {username,password}=credentials();if(isThrottled(username))throw new InputError("Try again in 15 minutes.",429);
   const found=findUser(username),code=text("recoveryCode");
   const ok=!!found?.recoveryCodeHash&&!found.recoveryCodeUsedAt&&await verifyPassword(code,found.recoveryCodeHash);
   db.insert(loginAttempts).values({username,succeeded:ok}).run();
   if(!ok||!found)throw new InputError("The recovery details could not be verified.",401);
   const passwordHash=await hashPassword(password);
   db.transaction(tx=>{
    const changed=tx.update(users).set({passwordHash,recoveryCodeUsedAt:new Date().toISOString(),recoveryCodeHash:null}).where(and(eq(users.id,found.id),sql`${users.recoveryCodeUsedAt} IS NULL`)).run();
    if(!changed.changes)throw new InputError("This recovery code has already been used.");
    tx.delete(sessions).where(eq(sessions.userId,found.id)).run();
   });endSession(ctx.cookies);startSession(found.id,ctx.cookies,ctx.url);target="/account?recovered=1";
  }else if(action==="logout"){endSession(ctx.cookies);target="/";}
  else{
   if(!user)throw new InputError("Sign in to save your study plan.",401);
   const owner=user.id,id=text("planId"),rev=num("revision");
   if(action==="create-plan"){
    target="/plan?id="+createPlan(owner,{name:text("name",80),program:text("program").toUpperCase(),cohort:num("cohort"),specialisation:text("specialisation")});
   }else if(action==="duplicate-plan"){target="/plan?id="+duplicatePlan(owner,id);}
   else if(action==="delete-plan"){
    const existing=getPlan(owner,id);if(existing.revision!==rev)throw new InputError("This plan changed in another tab. Reload before deleting.",409);db.delete(plans).where(and(eq(plans.id,id),eq(plans.userId,owner),eq(plans.revision,rev))).run();audit(owner,"delete-plan",{id});target="/plan";
   }else if(action==="add-selection"){
    addSelection(owner,id,rev,{id:"",topic:text("topic",100),code:text("code").trim().toUpperCase(),units:num("units"),year:num("year"),session:text("session")});target="/plan?id="+id+"&year="+num("year")+"&session="+encodeURIComponent(text("session"));
   }else if(action==="remove-selection"||action==="move-selection"){
    mutatePlan(owner,id,rev,action,p=>{
     const s=p.selections.find(s=>s.id===text("selectionId"));if(!s)throw new InputError("Course selection not found.",404);
     if(action==="remove-selection")db.delete(selections).where(eq(selections.id,s.id)).run();
     else {const next={...s,year:num("year"),session:text("session")};validSelection(next);
      if(p.selections.some(a=>a.id!==s.id&&a.code===s.code&&a.year===next.year&&a.session===next.session))throw new InputError("That course is already in the destination semester.");
      db.update(selections).set({year:next.year,session:next.session}).where(eq(selections.id,s.id)).run();}
    });target="/plan?id="+id;
   }else if(action==="update-plan"||action==="refresh-rules"){
    const before=getPlan(owner,id);const old=evaluate(before,records(owner),true);
    mutatePlan(owner,id,rev,action,p=>{
     const specialisation=text("specialisation"),load=num("load");
     if(action==="refresh-rules"){db.update(plans).set({release:RELEASE}).where(eq(plans.id,id)).run();return;}
     if(specialisation&&!programRules(p.program,p.cohort,p.release)?.specialisations.some(s=>s.code===specialisation))throw new InputError("This specialisation does not belong to your cohort.");
     if(![6,12,18,24,30,36].includes(load))throw new InputError("Choose a valid load target.");
     db.update(plans).set({name:text("name",80)||p.name,specialisation,load,studentType:text("studentType")==="international"?"international":"domestic"}).where(eq(plans.id,id)).run();
    });
    const updated=evaluate(getPlan(owner,id),records(owner),true);
    target="/plan?id="+id+"&change="+encodeURIComponent(`Projected allocation: ${old.allocated} → ${updated.allocated} units. Completed records unchanged.`);
   }else if(action==="record"||action==="remove-record"){
    const rs=records(owner),recordId=text("recordId");
    if(action==="remove-record"){if(!rs.some(r=>r.id===recordId))throw new InputError("Record not found.",404);saveRecords(owner,num("profileRevision"),rs.filter(r=>r.id!==recordId));}
    else {
     const kinds:RecordKind[]=["passed","in-progress","failed","withdrawn","specified-credit","unspecified-credit","exemption","substitution","permission","load-variation"];
     const kind=text("kind") as RecordKind;if(!kinds.includes(kind))throw new InputError("Choose a record type.");
     let units=num("units");if(["exemption","substitution","permission"].includes(kind))units=0;
     if(!Number.isInteger(units)||units<0||units>96||(["passed","in-progress","specified-credit","unspecified-credit"].includes(kind)&&units===0))throw new InputError("Enter a valid unit value.");
     const code=text("code").trim().toUpperCase();
     if(!["unspecified-credit","load-variation"].includes(kind)&&!course(code,num("year"))&&!course(code,2026)&&!course(code,2025))throw new InputError("Enter a course code in the catalogue.");
     if(!SESSIONS.includes(text("session") as never)||!Number.isInteger(num("year"))||num("year")<2000||num("year")>2035)throw new InputError("Choose a valid study period.");
     if(["specified-credit","unspecified-credit","exemption","substitution","permission","load-variation"].includes(kind)&&(!text("reference")||!/^\d{4}-\d{2}-\d{2}$/.test(text("date"))))throw new InputError("Record the decision date and reference for your reported approval.");
     if(kind==="unspecified-credit"&&!["further","elective"].includes(text("scope")))throw new InputError("Choose further or elective as the credit category.");
     if(recordId&&!rs.some(r=>r.id===recordId))throw new InputError("Record not found.",404);
     if(["passed","in-progress","failed","withdrawn","specified-credit"].includes(kind)){const c=course(code,num("year"))||course(code,2026)||course(code,2025);const allowed=String(c?.units).match(/\d+(?:\.\d+)?/g)?.map(Number)||[6];if(!allowed.includes(units))throw new InputError("Units must match a published unit value for this course.");}
     const personal=["specified-credit","unspecified-credit","exemption","substitution","permission","load-variation"].includes(kind);
     const context=personal?getPlan(owner,id):undefined;
     if(kind==="substitution"&&!course(text("replacement").trim().toUpperCase(),num("year")))throw new InputError("Choose a published replacement course for this teaching year.");
     if(kind==="permission"&&!["prerequisite","project"].includes(text("scope")))throw new InputError("Choose prerequisite or project as the permission scope.");
     const r:StudyRecord={program:context?.program,cohort:context?.cohort,topic:text("topic",100),id:recordId||randomUUID(),code:code||"CREDIT",units,year:num("year"),session:text("session"),kind,approval:["approved","pending","withdrawn"].includes(text("approval"))?text("approval") as StudyRecord["approval"]:"pending",scope:text("scope"),replacement:text("replacement").toUpperCase(),reference:text("reference",500),date:text("date")};
     saveRecords(owner,num("profileRevision"),[...rs.filter(x=>x.id!==r.id),r]);
    }
    target="/study"+(id?"?id="+id:"");
   }else throw new InputError("Unknown action.");
  }
  if(wantsJSON)return Response.json({ok:true,location:target});
  return ctx.redirect(target,303);
 }catch(error){
  const known=error instanceof InputError;const message=known?error.message:"The change could not be saved. Please retry. Your existing records are safe.";
  if(!known)console.error("Action failed",error instanceof Error?error.message:"unknown");
  if(wantsJSON)return Response.json({ok:false,message},{status:known?error.status:500});
  return new Response(`<!doctype html><html lang="en-AU"><meta name="viewport" content="width=device-width"><title>Unable to save · Study Planner</title><link rel="stylesheet" href="/fallback.css"><body><nav><a href="/">Study Planner</a></nav><main><h1>Unable to save</h1><p>${escape(message)}</p><p>Use your browser's Back button to return to your form and correct the submission.</p><a href="/plan">Return to my plan</a></main></body></html>`,{status:known?error.status:500,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
 }
};
