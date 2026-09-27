import {randomUUID,createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {and,eq,desc,sql} from "drizzle-orm";
import {db} from "./db";
import {catalogueEntries,releases,profiles,plans,selections,history} from "./schema";
import {catalogue,RELEASE,programRules,item,course,courseUnits} from "./catalogue";
import {SESSIONS,type Plan,type StudyRecord,type Selection} from "./types";
let seeded=false;
export function seed(){
 if(seeded)return;
 const hash=createHash("sha256").update(readFileSync("data/catalogue.json")).update(readFileSync("data/rules.json")).digest("hex");
 const existing=db.select().from(releases).where(eq(releases.id,RELEASE)).get();
 if(existing&&existing.hash!==hash)throw new Error("Catalogue release changed: create a new immutable release.");
 if(!existing)db.transaction(tx=>{
  tx.insert(releases).values({id:RELEASE,importedAt:new Date().toISOString(),hash}).run();
  for(const c of catalogue)tx.insert(catalogueEntries).values({id:RELEASE+":"+c.id,release:RELEASE,year:c.year,kind:c.kind,code:c.code,name:c.name,payload:JSON.stringify(c)}).run();
 });
 seeded=true;
}
export class InputError extends Error {constructor(message:string,public status=400){super(message)}}
export function profile(userId:number){
 seed();db.insert(profiles).values({userId}).onConflictDoNothing().run();
 return db.select().from(profiles).where(eq(profiles.userId,userId)).get()!;
}
export function records(userId:number):StudyRecord[]{return JSON.parse(profile(userId).records);}
export function listPlans(userId:number){seed();return db.select().from(plans).where(eq(plans.userId,userId)).orderBy(desc(plans.createdAt)).all();}
export function getPlan(userId:number,id:string):Plan{
 seed();const p=db.select().from(plans).where(and(eq(plans.id,id),eq(plans.userId,userId))).get();
 if(!p)throw new InputError("This plan could not be found.",404);
 return {...p,studentType:p.studentType as Plan["studentType"],selections:db.select().from(selections).where(eq(selections.planId,id)).all()};
}
export function audit(userId:number,action:string,detail:unknown,planId?:string){
 db.insert(history).values({userId,action,detail:JSON.stringify(detail),planId}).run();
}
export function createPlan(userId:number,fields:{name:string;program:string;cohort:number;specialisation?:string;load?:number;studentType?:string}){
 seed();
 if(!item("program",fields.program,fields.cohort))throw new InputError("Choose a program and an explicit commencement year from the catalogue.");
 const rule=programRules(fields.program,fields.cohort);
 if(fields.specialisation&&!rule?.specialisations.some(s=>s.code===fields.specialisation))throw new InputError("Choose a specialisation listed for your commencement year.");
 if(listPlans(userId).length>=12)throw new InputError("Keep up to 12 plans. Delete an old comparison first.");
 const id=randomUUID();db.insert(plans).values({id,userId,name:fields.name.trim().slice(0,80)||"My degree plan",program:fields.program,cohort:fields.cohort,specialisation:fields.specialisation||"",load:fields.load||24,studentType:fields.studentType==="international"?"international":"domestic",release:RELEASE}).run();
 audit(userId,"create-plan",fields,id);return id;
}
export function mutatePlan(userId:number,id:string,revision:number,action:string,work:(p:Plan)=>void){
 return db.transaction(()=>{
  const p=getPlan(userId,id);
  if(p.revision!==revision)throw new InputError("This plan changed in another tab. Reload before saving. Your submitted values are shown below.",409);
  work(p);db.update(plans).set({revision:p.revision+1}).where(eq(plans.id,id)).run();
  audit(userId,action,{revision:revision+1},id);
 });
}
export function validSelection(s:Selection){
 if(!Number.isInteger(s.year)||s.year<2025||s.year>2035||!SESSIONS.includes(s.session as never))throw new InputError("Choose a valid year and teaching session.");
 const c=course(s.code,s.year)||course(s.code,2027)||course(s.code,2026)||course(s.code,2025);
 if(!c)throw new InputError("Choose a course from the catalogue.");
 const possible=String(c.units).match(/\d+(?:\.\d+)?/g)?.map(Number)||[6];
 if(!Number.isInteger(s.units)||s.units<=0||s.units>48||!possible.includes(s.units))throw new InputError("The selected units do not match this course's published unit value.");
}
export function addSelection(userId:number,id:string,revision:number,s:Selection){
 validSelection(s);mutatePlan(userId,id,revision,"add-course",p=>{
  if(p.selections.some(a=>a.code===s.code&&a.year===s.year&&a.session===s.session))throw new InputError("This course is already in that semester.");
  if(p.selections.length>=60)throw new InputError("A plan supports up to 60 future course attempts.");
  db.insert(selections).values({...s,id:randomUUID(),planId:id}).run();
 });
}
export function saveRecords(userId:number,revision:number,next:StudyRecord[]){
 if(next.length>80)throw new InputError("Keep up to 80 study records.");
 db.transaction(()=>{
  const p=profile(userId);if(p.revision!==revision)throw new InputError("Your study record changed in another tab. Reload before saving.",409);
  db.update(profiles).set({records:JSON.stringify(next),revision:p.revision+1}).where(eq(profiles.userId,userId)).run();
  db.update(plans).set({revision:sql`${plans.revision}+1`}).where(eq(plans.userId,userId)).run();
  audit(userId,"correct-study-record",{before:JSON.parse(p.records),after:next});
 });
}
export function duplicatePlan(userId:number,id:string){
 const p=getPlan(userId,id);const copy=createPlan(userId,{...p,name:p.name+" — alternative"});
 db.transaction(tx=>{for(const s of p.selections)tx.insert(selections).values({...s,id:randomUUID(),planId:copy}).run()});
 return copy;
}
export function demo(userId:number){
 const id=createPlan(userId,{name:"My next chapter",program:"7706XMCOMP",cohort:2025,specialisation:"HCCM-SPEC"});
 const codes=["COMP6710","COMP6250","MATH6005","COMP6442","COMP8260","COMP6390"];
 const rs:StudyRecord[]=codes.map((code,i)=>({id:randomUUID(),code,units:6,year:2025,session:i<3?"First Semester":"Second Semester",kind:"passed",approval:"approved",scope:"",replacement:"",reference:"Fictional example",date:"2025-12-01"}));
 saveRecords(userId,profile(userId).revision,rs);
 for(const code of ["COMP8610","COMP8020"]){
  const c=course(code,2026);if(c)addSelection(userId,id,getPlan(userId,id).revision,{id:"",code,units:courseUnits(c),year:2026,session:code==="COMP8610"?"First Semester":"Second Semester"});
 }
 return id;
}
