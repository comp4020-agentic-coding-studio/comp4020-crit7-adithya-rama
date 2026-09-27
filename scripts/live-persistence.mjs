import fs from "node:fs";
import assert from "node:assert/strict";
const base="https://comp4020-crit7-adithya-rama.fly.dev";
const path=".data/live-persistence-probe.json";
fs.mkdirSync(".data",{recursive:true});
if(process.argv.includes("--create")){
 const response=await fetch(base+"/api/action",{method:"POST",headers:{Origin:base,Accept:"application/json"},body:new URLSearchParams({action:"demo"})});
 assert.equal(response.status,200);
 const data=await response.json(),header=response.headers.getSetCookie().find(c=>c.startsWith("session=")&&!c.startsWith("session=;"));
 assert(header&&/secure/i.test(header)&&/httponly/i.test(header));
 const id=new URL(data.location,base).searchParams.get("id");
 const cookie=header.split(";")[0];
 const saved=await(await fetch(base+"/api/plan?id="+id,{headers:{cookie}})).json();
 assert.equal(saved.plan.selections.length,2);assert.equal(saved.completed.earned,36);
 fs.writeFileSync(path,JSON.stringify({cookie,id,plan:saved.plan}),{mode:0o600});
 console.log("Live plan saved. Secure HttpOnly session confirmed. Probe state retained only in ignored .data.");
}else{
 const prior=JSON.parse(fs.readFileSync(path,"utf8"));
 let saved;
 for(let i=0;i<8;i++){
  try{const response=await fetch(base+"/api/plan?id="+prior.id,{headers:{cookie:prior.cookie}});if(response.ok){saved=await response.json();break;}}catch{}
  await new Promise(r=>setTimeout(r,1500));
 }
 assert.deepEqual(saved?.plan,prior.plan);
 assert.equal(saved.completed.earned,36);
 console.log("Live saved plan and session recovered unchanged after deployment/restart.");
}
