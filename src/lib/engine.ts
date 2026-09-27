import {programRules,course,rulesForRelease} from "./catalogue";
import {period,half,type Plan,type StudyRecord,type Selection,type Bucket,type Expr,type Check,type CourseAssessment} from "./types";
export const SUBSTITUTION_SOURCE="https://systems.anu.edu.au/students/continuing/substitutions/computing-course-substitutions/";
const check=(status:Check["status"],reason:string,source=""):Check=>({status,reasons:[reason],sources:source?[source]:[]});
const approved=(r:StudyRecord)=>r.approval==="approved";
const earned=(r:StudyRecord)=>r.kind==="passed"||((r.kind==="specified-credit"||r.kind==="unspecified-credit")&&approved(r));
function substituteCodes(code:string,year:number,p:Plan):string[]{
 const codes=[code];
 if(year===2026){
  if(code==="COMP6242"&&p.specialisation==="MCHL-SPEC")codes.push("COMP6261","COMP6490","COMP6528","COMP6670","COMP8600","COMP8650","COMP8880");
  if(code==="COMP8280")codes.push("COMP8260");
  if(p.specialisation==="HCCM-SPEC"){
   if(code==="COMP6670")codes.push("COMP6540","COMP6720");
   if(code==="COMP8020")codes.push("COMP8539"); // COMP8350 source has a conflicting specialisation identifier; do not assume it.
  }
  if(code==="MATH8343"&&p.specialisation==="COMP-SPEC")codes.push("MATH6203");
  if(code==="COMP8011"&&p.specialisation==="COMP-SPEC")codes.push("COMP8670");
  if(code==="ENGN8100"&&["PCOM-SPEC","SOFT-SPEC"].includes(p.specialisation))codes.push("COMP8110");
 }
 if(year===2025){
  if(code==="COMP8712"&&p.specialisation==="COMP-SPEC")codes.push("COMP8460");
  if(code==="COMP8650"&&p.specialisation==="ARTIF-SPEC")codes.push("COMP8691");
  if(code==="STAT7039")codes.push("STAT6039");
  if(code==="COMP6670"&&p.specialisation==="HCCM-SPEC")codes.push("COMP6720");
  if(["COMP8712","COMP8045"].includes(code)&&p.specialisation==="CMSY-SPEC")codes.push("COMP6464");
  if(code==="MATH8343"&&p.specialisation==="COMP-SPEC")codes.push("MATH6203");
  if(code==="COMP8011"&&p.specialisation==="COMP-SPEC")codes.push("COMP8670");
 }
 return codes;
}
function personalReplacement(r:StudyRecord,b:Bucket,rs:StudyRecord[]){
 return rs.some(a=>a.kind==="substitution"&&approved(a)&&a.replacement===r.code&&a.year===r.year&&(a.scope===b.id||b.codes?.includes(a.code))&&a.reference.trim());
}
function accepts(b:Bucket,r:StudyRecord,p:Plan,rs:StudyRecord[]){
 if(r.kind==="unspecified-credit")return approved(r)&&r.scope===b.id;
 const level=Number(r.code.slice(4,5))*1000;
 
 if(b.exclude?.includes(r.code)||b.levels&&!b.levels.includes(level))return false;
 if(personalReplacement(r,b,rs))return true;
 if(b.codes?.some(c=>substituteCodes(r.code,r.year,p).includes(c)))return true;
 if(b.codes){
  // An exemption replaces a compulsory slot with a COMP elective, not with zero units.
  if(b.id.startsWith("core:")&&rs.some(x=>x.kind==="exemption"&&approved(x)&&b.codes?.includes(x.code))&&r.code.startsWith("COMP"))return true;
  if(b.id==="core:COMP6250"&&r.year===2026&&r.code.startsWith("COMP"))return true;
  return false;
 }
 return (!b.subjects||b.subjects.includes(r.code.slice(0,4)))&&(!b.minLevel||level>=b.minLevel)&&(!b.maxLevel||level<=b.maxLevel);
}
export interface RequirementProgress {id:string;name:string;min:number;max:number;units:number;remaining:number;courses:string[];source:string}
export interface Audit {supported:boolean;earned:number;allocated:number;total:number;level8:number;requirements:RequirementProgress[];issues:string[];allocations:Record<string,string>;complete:boolean;bounded:boolean;unallocated:string[]}
export function evaluate(p:Plan,records:StudyRecord[],projected=false):Audit{
 records=records.filter(r=>!r.program||(r.program===p.program&&r.cohort===p.cohort));
 const rule=programRules(p.program,p.cohort,p.release);
 const all:StudyRecord[]=[...records.filter(earned),...(projected?p.selections.map(s=>({...s,kind:"passed" as const,approval:"approved" as const,scope:"",replacement:"",reference:"Projected only",date:""})):[])];
 const seen=new Map<string,number>();const warnings:string[]=[];
 const eligible=all.filter(r=>{
  const n=seen.get(r.code)||0;const max=rulesForRelease(p.release)?.courses.find(c=>c.code===r.code&&c.year===r.year)?.repeatLimit||(r.code==="COMP8715"?2:1);
  if(n>0&&max>1&&r.code!=="COMP8715"&&(!r.topic||all.some(x=>x.id!==r.id&&x.code===r.code&&x.topic===r.topic))){warnings.push(r.code+": repeated advanced topics need distinct topic names; additional credit is unconfirmed.");return false;}
  if(r.kind!=="unspecified-credit"&&n>=max){warnings.push(r.code+": duplicate credit is not counted.");return false;}
  if(r.kind!=="unspecified-credit")seen.set(r.code,n+1);
  return true;
 });
 const earnedUnits=eligible.reduce((s,r)=>s+r.units,0);
 if(!rule)return {supported:false,earned:earnedUnits,allocated:0,total:0,level8:0,requirements:[],issues:["Automatic degree checking is not available for this program."],allocations:{},complete:false,bounded:false,unallocated:[]};
 const spec=rule.specialisations.find(s=>s.code===p.specialisation);
 const buckets:Bucket[]=[...rule.buckets,...(spec?.buckets||[])];
 if(!spec)buckets.push({id:"specialisation:undecided",name:"Choose a specialisation",min:24,max:24,codes:[],parent:"specialisation"});
 const states=new Set<string>();let visits=0;let bounded=false;let perfect=false;
 let bestScore=-1;let bestFilled=Array(buckets.length).fill(0) as number[];let bestAssign:Record<string,string>={};let best8=0;let bestSpec8=0;
 const credits=(r:StudyRecord)=>r.kind.includes("credit");
 const units8=(r:StudyRecord)=>(r.code.startsWith("COMP8")||(r.code==="ENGN8100"&&[2025,2026].includes(r.year)&&["PCOM-SPEC","SOFT-SPEC"].includes(p.specialisation)))?r.units:0;
 const opts=eligible.map(r=>({r,options:buckets.map((b,i)=>accepts(b,r,p,records)?i:-1).filter(i=>i>=0)})).sort((a,b)=>a.options.length-b.options.length||a.r.code.localeCompare(b.r.code));
 
 function walk(i:number,filled:number[],credited:number[],specCredit:number,level8:number,credit8:number,spec8:number,allocation:Record<string,string>){
  if(perfect)return;
  if(++visits>150000){bounded=true;return;}
  const specTotal=filled.reduce((s,v,j)=>s+(buckets[j].parent==="specialisation"?v:0),0);
  const score=Math.min(specTotal,24)*200+filled.reduce((s,v,j)=>s+Math.min(v,buckets[j].min)*100+(v>=buckets[j].min?5:0),0)+Math.min(level8,rule!.level8Min)*10+Math.min(spec8,spec?.level8Min||0)*10+filled.reduce((a,b)=>a+b,0);
  if(score>bestScore){bestScore=score;bestFilled=[...filled];bestAssign={...allocation};best8=level8;bestSpec8=spec8;}
  if(filled.reduce((a,b)=>a+b,0)===rule!.total&&filled.every((v,j)=>v>=buckets[j].min)&&specTotal===24&&level8>=rule!.level8Min&&spec8>=(spec?.level8Min||0)){perfect=true;bounded=false;return;}
  if(i>=opts.length)return;
  
  const key=[i,...filled,...credited,specCredit,Math.min(level8,rule!.level8Min),credit8,Math.min(spec8,spec?.level8Min||0)].join(",");
  if(states.has(key))return;states.add(key);
  const {r,options}=opts[i];
  for(const j of options){
   const b=buckets[j];const isSpec=b.parent==="specialisation";const credit=credits(r)?r.units:0;
   if(filled[j]+r.units>b.max||filled.reduce((a,b)=>a+b,0)+r.units>rule!.total)continue;
   if(credit&&credited[j]+credit>(b.creditMax??96))continue;
   if(isSpec&&specCredit+credit>6)continue;
   if(isSpec&&filled.reduce((s,v,k)=>s+(buckets[k].parent==="specialisation"?v:0),0)+r.units>24)continue;
   const counted8=units8(r);const allowed8=credit?Math.min(counted8,Math.max(0,6-credit8)):counted8;
   filled[j]+=r.units;credited[j]+=credit;allocation[r.id]=b.id;
   walk(i+1,filled,credited,specCredit+(isSpec?credit:0),level8+allowed8,credit8+(credit?allowed8:0),spec8+(isSpec&&Number(r.code[4])>=8?r.units:0),allocation);
   delete allocation[r.id];filled[j]-=r.units;credited[j]-=credit;
  }
  walk(i+1,filled,credited,specCredit,level8,credit8,spec8,allocation);
 }
 walk(0,Array(buckets.length).fill(0),Array(buckets.length).fill(0),0,0,0,0,{});
 const assigned=(id:string)=>eligible.filter(r=>bestAssign[r.id]===id);
 const reqs:RequirementProgress[]=buckets.map((b,i)=>({id:b.id,name:b.name,min:b.min,max:b.max,units:bestFilled[i],remaining:Math.max(0,b.min-bestFilled[i]),courses:assigned(b.id).map(r=>r.code),source:b.parent==="specialisation"?spec?.source||rule.source:rule.source}));
 reqs.push({id:"level8",name:"8000-level COMP study",min:rule.level8Min,max:96,units:best8,remaining:Math.max(0,rule.level8Min-best8),courses:eligible.filter(r=>bestAssign[r.id]&&r.code.startsWith("COMP8")).map(r=>r.code),source:rule.source});
 if(spec){
  const specTotal=buckets.reduce((s,b,i)=>s+(b.parent==="specialisation"?bestFilled[i]:0),0);
  reqs.push({id:"specialisation-total",name:spec.name+" · total",min:24,max:24,units:specTotal,remaining:Math.max(0,24-specTotal),courses:[],source:spec.source});
  if(spec.level8Min)reqs.push({id:"specialisation-level8",name:"Specialisation · 8000-level minimum",min:spec.level8Min,max:24,units:bestSpec8,remaining:Math.max(0,spec.level8Min-bestSpec8),courses:[],source:spec.source});
 }
 const project=eligible.filter(r=>r.code==="COMP8715").sort((a,b)=>period(a.year,a.session)-period(b.year,b.session));
 if(project.length){
  const consecutive=project.length===2&&project[0].units===6&&project[1].units===6&&((project[0].session==="First Semester"&&project[1].session==="Second Semester"&&project[0].year===project[1].year)||(project[0].session==="Second Semester"&&project[1].session==="First Semester"&&project[1].year===project[0].year+1));
  if(!consecutive)warnings.push("COMP8715 requires two 6-unit enrolments in consecutive standard semesters.");
 }
 if(spec?.code==="DTSC-SPEC"&&bestSpec8>12)warnings.push("Data Science says 12 units of 8000-level study but lists further 8000-level options. Confirm allocation above 12 units.");
 if(p.cohort===2026&&bestFilled[buckets.findIndex(b=>b.id==="project")]<12)warnings.push("The 2026 program publishes a maximum of 12 project units. Confirm the capstone pathway before relying on a plan with fewer than 12.");
 for(const r of eligible){const cr=rulesForRelease(p.release)?.courses.find(c=>c.code===r.code&&c.year===r.year);if(cr?.incompatible.some(c=>eligible.some(x=>x.code===c)))warnings.push(r.code+": incompatible completed or credited study needs adviser confirmation.");}
 warnings.push(...rule.ambiguities,...(spec?.ambiguities||[]));
 if(!spec)warnings.push("Choose a specialisation to finish checking your degree.");
 if(bounded)warnings.push("Allocation search reached its limit. This result needs confirmation.");
 const allocated=bestFilled.reduce((a,b)=>a+b,0);
 return {supported:true,earned:earnedUnits,allocated,total:rule.total,level8:best8,requirements:reqs,issues:[...new Set(warnings)],allocations:bestAssign,complete:allocated>=rule.total&&reqs.every(r=>r.remaining===0)&&warnings.length===0,bounded,unallocated:eligible.filter(r=>!bestAssign[r.id]).map(r=>r.code)};
}
function combine(op:"and"|"or",cs:Check[]):Check{
 const status=op==="and"?(cs.some(c=>c.status==="blocked")?"blocked":cs.some(c=>c.status==="unknown")?"unknown":cs.some(c=>c.status==="conditional")?"conditional":"met"):(cs.some(c=>c.status==="met")?"met":cs.some(c=>c.status==="conditional")?"conditional":cs.some(c=>c.status==="unknown")?"unknown":"blocked");
 return {status,reasons:[...new Set(cs.filter(c=>op==="and"||c.status===status).flatMap(c=>c.reasons))],sources:[...new Set(cs.flatMap(c=>c.sources))]};
}
export function evaluateExpr(expr:Expr,p:Plan,rs:StudyRecord[],s:Selection,waiver=false):Check{
 if(waiver&&(expr.op==="course"||expr.op==="units"))return check("met","Prerequisite waiver reported by you.");
 if(expr.op==="true")return check("met","No published prerequisite.");
 if(expr.op==="unknown")return check("unknown",expr.reason);
 if(expr.op==="permission")return check("unknown",expr.reason);
 if(expr.op==="program")return check(expr.codes.includes(p.program)?"met":"blocked","Requires enrolment in "+expr.codes.join(" or "));
 if(expr.op==="and"||expr.op==="or")return combine(expr.op,expr.children.map(e=>evaluateExpr(e,p,rs,s,waiver)));
 if(expr.op==="units"){
  const units=rs.filter(r=>earned(r)&&period(r.year,r.session)<period(s.year,s.session)).reduce((a,r)=>a+r.units,0);
  return check(units>=expr.units?"met":"blocked",`Requires ${expr.units} completed units before this course.`);
 }
 if(expr.op==="course"){
  const before=(r:{year:number;session:string})=>period(r.year,r.session)<period(s.year,s.session);
  const same=(r:{year:number;session:string})=>r.year===s.year&&r.session===s.session;
  if(rs.some(r=>expr.codes.includes(r.code)&&((earned(r)&&before(r))||(r.kind==="exemption"&&approved(r)&&before(r)))))return check("met","Completed prerequisite: "+expr.codes.join(" or "));
  const future=p.selections.some(r=>r.id!==s.id&&expr.codes.includes(r.code)&&(before(r)||(expr.concurrent&&same(r))));
  const inProgress=rs.some(r=>expr.codes.includes(r.code)&&r.kind==="in-progress"&&(before(r)||(expr.concurrent&&same(r))));
  if(future||inProgress)return check("conditional","Conditional on "+(expr.concurrent?"passing or concurrent enrolment in ":"passing ")+expr.codes.join(" or "));
  return check("blocked","Requires "+expr.codes.join(" or ")+(expr.concurrent?" (may be taken concurrently)":" before this course"));
 }
 return check("unknown","This condition needs confirmation.");
}
export function assess(p:Plan,rs:StudyRecord[],s:Selection,baseline?:Audit):CourseAssessment{
 rs=rs.filter(r=>!r.program||(r.program===p.program&&r.cohort===p.cohort));
 const rule=rulesForRelease(p.release)?.courses.find(r=>r.code===s.code&&r.year===s.year);
 let eligibility=rule?evaluateExpr(rule.prerequisite,p,rs,s):check("unknown","Prerequisites have not been reviewed for this teaching year.");
 if(rule)eligibility.sources.push(rule.source);
 const permission=rs.find(r=>r.kind==="permission"&&approved(r)&&r.code===s.code&&r.year===s.year&&r.session===s.session&&r.scope==="prerequisite"&&r.reference.trim());
 if(permission&&rule)eligibility=evaluateExpr(rule.prerequisite,p,rs,s,true);
 const other=[...rs.filter(r=>earned(r)||r.kind==="in-progress"),...p.selections.filter(r=>r.id!==s.id)];
 if(rule?.incompatible.some(c=>other.some(r=>r.code===c)))eligibility=check("blocked","Incompatible with "+rule.incompatible.filter(c=>other.some(r=>r.code===c)).join(", "),rule.source);
 const repetitions=other.filter(r=>r.code===s.code).length;
 if(repetitions>0&&(rule?.repeatLimit||1)>1&&s.code!=="COMP8715"&&(!s.topic||other.some(r=>r.code===s.code&&r.topic===s.topic)))eligibility=combine("and",[eligibility,check("unknown","Repeated enrolment requires a different confirmed topic.",rule?.source)]);
 if(repetitions>=(rule?.repeatLimit||(s.code==="COMP8715"?2:1)))eligibility=check("blocked","This course is already completed, credited, or planned.",rule?.source);
 if(s.code==="COMP8715"&&!rs.some(r=>r.kind==="permission"&&approved(r)&&r.code===s.code&&r.year===s.year&&r.session===s.session&&r.scope==="project"))eligibility=combine("and",[eligibility,check("unknown","Project-group membership and convenor approval must be confirmed.",rule?.source)]);
 const c=course(s.code,s.year);
 const currentYear=new Date().getFullYear();
 const availability=!c||!c.sessions?check("unknown","Offering unconfirmed"):c.sessions.split("/").includes(s.session)?check(s.year>currentYear?"conditional":"met",s.year>currentYear?"Indicative future offering":"Published for this semester",c.url):check("blocked","Not listed in this semester in the imported catalogue.",c.url);
 const existing=p.selections.some(a=>a.id===s.id);
 const without={...p,selections:p.selections.filter(a=>a.id!==s.id)};
 const before=baseline||evaluate(without,rs,true);const after=evaluate({...without,selections:[...without.selections,s]},rs,true);
 const bucket=after.allocations[s.id];const req=after.requirements.find(r=>r.id===bucket);
 let contribution=!after.supported?check("unknown","Automatic degree checking is not available for this program."):after.bounded?check("unknown","Allocation needs confirmation."):bucket?check("met",`Contributes ${s.units} units to ${req?.name||bucket}.`,req?.source):check("blocked","Does not currently fill an available requirement.");
 if(bucket&&after.allocated===before.allocated&&!existing)contribution=check("conditional","Can replace another allocated course; adds no further degree units.",req?.source);
 if(bucket&&substituteCodes(s.code,s.year,p).length>1){contribution.sources.push(SUBSTITUTION_SOURCE);contribution.reasons.push("Published substitutions apply only in the stated teaching year; prerequisites still apply.");}
 const rank=contribution.status==="met"?(bucket?.startsWith("core:")?0:bucket?.startsWith("spec:")?1:2):3;
 return {code:s.code,contribution,eligibility,availability,requirement:req?.name||"No allocation",rank};
}
export function planIssues(p:Plan,rs:StudyRecord[]){
 const issues=p.selections.flatMap(s=>{
  const a=assess(p,rs,s);
  return [a.contribution,a.eligibility,a.availability].filter(c=>c.status!=="met").flatMap(c=>c.reasons.map(r=>s.code+": "+r));
 });
 const groups=new Map<string,number>();
 for(const s of [...p.selections,...rs.filter(r=>r.kind==="in-progress")]){
  const key=s.year+" H"+half(s.session);groups.set(key,(groups.get(key)||0)+s.units);
 }
 for(const [key,units] of groups){
  const variation=rs.some(r=>r.kind==="load-variation"&&approved(r)&&r.scope===key&&r.units===units);
  if(units!==p.load&&!variation)issues.push(`${key}: ${units} enrolled/planned units against your ${p.load}-unit target. Confirm any required load variation.`);
 }
 return [...new Set(issues)];
}
