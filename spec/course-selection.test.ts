import {describe,it,expect,inject} from "vitest";
const base=inject("baseUrl");
function client(){
 let cookie="";
 return {
 async action(body:Record<string,string|number>,origin=base){
  const response=await fetch(base+"/api/action",{method:"POST",headers:{origin,accept:"application/json",cookie},body:new URLSearchParams(Object.entries(body).map(([k,v])=>[k,String(v)])),redirect:"manual"});
  for(const c of response.headers.getSetCookie()){if(c.startsWith("session="))cookie=c.split(";")[0];}
  return {status:response.status,body:response.headers.get("content-type")?.includes("application/json")?await response.json():{message:await response.text()}};
 },
 async get(path:string){return fetch(base+path,{headers:{cookie}});}
 };
}
describe("saved student plans over HTTP",()=>{
 it("persists selections, enforces ownership/revisions, and recovers on fresh sign-in",async()=>{
  const a=client(),b=client(),username="student_"+Date.now(),password="a-long-prototype-password";
  expect((await a.action({action:"register",username,password})).status).toBe(200);
  const create=await a.action({action:"create-plan",program:"7706XMCOMP",cohort:2025,name:"Persistence example"});
  expect(create.status).toBe(200);const id=new URL(create.body.location,base).searchParams.get("id")!;
  expect((await a.action({action:"add-selection",planId:id,revision:0,code:"COMP6390",units:6,year:2026,session:"Second Semester"})).status).toBe(200);
  const persisted=await (await a.get("/api/plan?id="+id)).json();expect(persisted.plan.selections[0].code).toBe("COMP6390");expect(persisted.plan.cohort).toBe(2025);
  expect(await (await a.get("/plan?id="+id+"&year=2027")).text()).toContain("COMP6390");
  expect((await a.action({action:"add-selection",planId:id,revision:0,code:"COMP8610",units:6,year:2026,session:"Second Semester"})).status).toBe(409);
  expect((await b.get("/api/plan?id="+id)).status).toBe(401);
  await b.action({action:"register",username:username+"_other",password});
  expect((await b.get("/api/plan?id="+id)).status).toBe(404);
  expect((await b.action({action:"delete-plan",planId:id,revision:1})).status).toBe(404);
  expect((await a.action({action:"delete-plan",planId:id,revision:1},"https://unrelated.example")).status).toBe(403);
  await a.action({action:"logout"});const fresh=client();
  expect((await fresh.action({action:"login",username,password})).status).toBe(200);
  expect((await (await fresh.get("/api/plan?id="+id)).json()).plan.selections).toHaveLength(1);
 },30000);
 it("creates isolated editable fictional demos",async()=>{
  const a=client(),b=client();const one=await a.action({action:"demo"}),two=await b.action({action:"demo"});
  expect(one.status).toBe(200);expect(two.status).toBe(200);expect(one.body.location).not.toBe(two.body.location);
  const id=new URL(one.body.location,base).searchParams.get("id");
  const data=await(await a.get("/api/plan?id="+id)).json();
  expect(data.completed.earned).toBe(36);expect(data.plan.selections).toHaveLength(2);expect((await b.get("/api/plan?id="+id)).status).toBe(404);
 },30000);
 it("requires explicit valid commencement and catalogue courses",async()=>{
  const c=client();await c.action({action:"register",username:"validation_"+Date.now(),password:"another-long-password"});
  expect((await c.action({action:"create-plan",program:"7706XMCOMP",cohort:0})).status).toBe(400);
  const result=await c.action({action:"create-plan",program:"BARTS",cohort:2026,name:"Manual plan"});
  expect(result.status).toBe(200);
  const id=new URL(result.body.location,base).searchParams.get("id");
  expect((await(await c.get("/api/plan?id="+id)).json()).completed.supported).toBe(false);
  expect((await c.action({action:"add-selection",planId:id!,revision:0,code:"FAKE1000",units:6,year:2026,session:"First Semester"})).status).toBe(400);
 },30000);
});
