import {describe,it,expect} from "vitest";
import {evaluate,evaluateExpr,assess} from "../src/lib/engine";
import {rules,catalogue,programRules} from "../src/lib/catalogue";
import type {Plan,StudyRecord,Selection} from "../src/lib/types";
const plan=(cohort=2025,specialisation="HCCM-SPEC"):Plan=>({id:"p",name:"Test",program:"7706XMCOMP",cohort,specialisation,load:24,studentType:"domestic",release:"anu-2026-09-27-v1",revision:0,selections:[]});
let sequence=0;
const record=(code:string,units=6,kind:StudyRecord["kind"]="passed",year=2025):StudyRecord=>({id:"r"+(++sequence),code,units,kind,year,session:"First Semester",approval:"approved",scope:"",replacement:"",reference:"Synthetic test",date:"2025-01-01"});
const selection=(code:string,year=2026,session="Second Semester"):Selection=>({id:"s"+(++sequence),code,units:6,year,session});
describe("catalogue contract",()=>{
 it("contains real catalogue metadata in all three years",()=>{for(const year of [2025,2026,2027])expect(catalogue.filter(c=>c.kind==="course"&&c.year===year).length).toBeGreaterThan(2000);});
 it("keeps unique year/type/code identifiers",()=>expect(new Set(catalogue.map(c=>c.id)).size).toBe(catalogue.length));
 it("encodes seven specialisations per commencement year",()=>{for(const p of rules.programs)expect(p.specialisations).toHaveLength(7);});
 it("changes cohort core requirements explicitly",()=>{expect(programRules("7706XMCOMP",2025)?.buckets.some(b=>b.codes?.includes("COMP6710"))).toBe(true);expect(programRules("7706XMCOMP",2026)?.buckets.some(b=>b.codes?.includes("COMP7710"))).toBe(true);});
});
describe("allocation",()=>{
 it("does not turn exemptions into units",()=>expect(evaluate(plan(),[record("COMP6710",0,"exemption")]).earned).toBe(0));
 it("counts approved specified credit, excludes pending credit",()=>{const r=record("COMP6710",6,"specified-credit");expect(evaluate(plan(),[r]).allocated).toBe(6);r.approval="pending";expect(evaluate(plan(),[r]).earned).toBe(0);});
 it("restricts unspecified credit to its category",()=>{const r=record("CREDIT",12,"unspecified-credit");r.scope="elective";const a=evaluate(plan(),[r]);expect(a.allocations[r.id]).toBe("elective");});
 it("does not count failed, withdrawn or in-progress courses",()=>expect(evaluate(plan(),["failed","withdrawn","in-progress"].map(k=>record("COMP6710",6,k as StudyRecord["kind"]))).earned).toBe(0));
 it("counts duplicate passed courses only once",()=>expect(evaluate(plan(),[record("COMP6710"),record("COMP6710")]).earned).toBe(6));
 it("preserves exact core and specialisation allocations",()=>{const rs=[record("COMP6710"),record("COMP6390")];const a=evaluate(plan(),rs);expect(a.allocations[rs[0].id]).toBe("core:COMP6710");expect(a.allocations[rs[1].id]).toBe("spec:COMP6390");});
 it("limits credited specialisation units to six",()=>{const a=evaluate(plan(),[record("COMP6390",6,"specified-credit"),record("COMP8610",6,"specified-credit"),record("COMP8539",6,"specified-credit")]);const units=a.requirements.filter(r=>r.id.startsWith("spec:")).reduce((n,r)=>n+r.units,0);expect(units).toBeLessThanOrEqual(6);expect(a.level8).toBeLessThanOrEqual(6);});
 it("allows required repeat project attempts, but checks consecutiveness",()=>{const a=record("COMP8715"),b=record("COMP8715");expect(evaluate(plan(),[a,b]).issues.some(i=>i.includes("consecutive"))).toBe(true);b.session="Second Semester";expect(evaluate(plan(),[a,b]).issues.some(i=>i.includes("consecutive"))).toBe(false);});
 it("applies a 2026 substitution only in 2026",()=>{const a=record("COMP8020",6,"passed",2026);expect(evaluate(plan(),[a]).allocations[a.id]).toBe("spec:hcc-advanced");a.year=2027;expect(evaluate(plan(),[a]).allocations[a.id]).not.toBe("spec:hcc-advanced");});
 it("keeps unsupported programs manual",()=>{const p=plan();p.program="BARTS";expect(evaluate(p,[record("COMP6710")]).supported).toBe(false);});
 it("projects selections separately from earned history",()=>{const p=plan();p.selections=[selection("COMP6710")];expect(evaluate(p,[]).earned).toBe(0);expect(evaluate(p,[],true).earned).toBe(6);});
});
describe("eligibility and availability",()=>{
 it("requires prerequisites before the target semester",()=>{const p=plan(),s=selection("COMP6442");const expr={op:"course" as const,codes:["COMP6710"]};expect(evaluateExpr(expr,p,[record("COMP6710")],s).status).toBe("met");expect(evaluateExpr(expr,p,[record("COMP6710",6,"failed")],s).status).toBe("blocked");p.selections=[selection("COMP6710",2026,"First Semester")];expect(evaluateExpr(expr,p,[],s).status).toBe("conditional");});
 it("accepts same-semester study only for explicit co-requisites",()=>{const p=plan(),s=selection("COMP6442");p.selections=[selection("MATH6005")];expect(evaluateExpr({op:"course",codes:["MATH6005"],concurrent:true},p,[],s).status).toBe("conditional");expect(evaluateExpr({op:"course",codes:["MATH6005"]},p,[],s).status).toBe("blocked");});
 it("checks the actual compound COMP6442 expression",()=>{const p=plan(),s=selection("COMP6442");expect(assess(p,[record("COMP6710")],s).eligibility.status).toBe("blocked");expect(assess(p,[record("COMP6710"),record("MATH6005")],s).eligibility.status).toBe("met");});
 it("does not let a waiver override an incompatibility",()=>{const p=plan(),s=selection("COMP6442");const permission=record("COMP6442",0,"permission",2026);permission.scope="prerequisite";permission.session="Second Semester";expect(assess(p,[permission,record("COMP2100")],s).eligibility.status).toBe("blocked");});
 it("labels missing offerings unknown",()=>expect(assess(plan(),[],selection("COMP6442",2030)).availability.status).toBe("unknown"));
 it("keeps future offerings conditional",()=>expect(assess(plan(),[],selection("COMP6442",2027)).availability.status).toBe("conditional"));
});
const fixtures:Record<string,string[]>={
"ARTIF-SPEC":["COMP6262","COMP6320","COMP8620","COMP8691"],
"CMSY-SPEC":["COMP8300","COMP8045","COMP6330","COMP6331"],
"COMP-SPEC":["COMP8011","MATH8343","COMP6262","COMP6466"],
"DTSC-SPEC":["COMP6240","COMP8410","COMP8430","COMP6670"],
"HCCM-SPEC":["COMP6390","COMP8350","COMP8610","COMP6780"],
"MCHL-SPEC":["COMP6670","COMP6528","COMP8600","COMP8650"],
"PCOM-SPEC":["COMP6120","ENGN8100","INFS8004","COMP8300"],
"SOFT-SPEC":["COMP6261","ENGN8100","COMP8300","INFS8004"]
};
describe("independent specialisation fixtures",()=>{
 for(const p of rules.programs)for(const sp of p.specialisations){
  it(sp.code+" "+p.year+" satisfies its lists and rejects a missing compulsory/choice course",()=>{
   const rs=fixtures[sp.code].map(c=>record(c,6,"passed",p.year));
   const a=evaluate(plan(p.year,sp.code),rs);
   expect(a.requirements.find(r=>r.id==="specialisation-total")?.units).toBe(24);
   expect(a.requirements.filter(r=>r.id.startsWith("spec:")||r.id.startsWith("specialisation")).every(r=>r.remaining===0)).toBe(true);
   const core=p.year===2025?[record("COMP6250"),record("COMP6442"),record("COMP6710"),record("COMP8260")]:[record("COMP6120",6,"passed",2026),record("COMP6442",6,"passed",2026),record("COMP7710",12,"passed",2026),record("COMP8280",6,"passed",2026)];
   const rest=[record("MATH6005"),record("COMP8830",12),...['COMP8405','COMP6464','COMP6363','MGMT7020',...(p.year===2025?['LAWS8445']:[])].map(c=>record(c))];
   const full=evaluate(plan(p.year,sp.code),[...core,...rest,...rs]);
   expect(full.earned).toBe(96);expect(full.allocated).toBe(96);expect(full.issues).toEqual([]);expect(full.complete).toBe(true);
   expect(evaluate(plan(p.year,sp.code),[...core,...rest,...rs.slice(1)]).complete).toBe(false);
   const missing=evaluate(plan(p.year,sp.code),rs.slice(1));
   expect(missing.requirements.find(r=>r.id==="specialisation-total")?.remaining).toBeGreaterThan(0);
  });
 }
});

describe("scoped decisions and release safeguards",()=>{
 it("does not transfer approved credit to another program or cohort",()=>{
  const r=record("COMP6710",6,"specified-credit");r.program="7706XMCOMP";r.cohort=2025;
  expect(evaluate(plan(2026),[r]).earned).toBe(0);
 });
 it("does not waive a program-membership condition",()=>{
  const p=plan();p.program="BARTS";
  expect(evaluateExpr({op:"and",children:[{op:"program",codes:["7706XMCOMP"]},{op:"course",codes:["COMP6710"]}]},p,[],selection("COMP6442"),true).status).toBe("blocked");
 });
 it("does not infer rules for an unknown saved release",()=>{
  const p=plan();p.release="unavailable-release";expect(evaluate(p,[record("COMP6710")]).complete).toBe(false);
 });
 it("counts different approved repeat topics and flags missing topic evidence",()=>{
  const a=record("COMP8020",6,"passed",2026),b=record("COMP8020",6,"passed",2027);
  expect(evaluate(plan(),[a,b]).earned).toBe(6);
  a.topic="Agentic Coding Studio";b.topic="Creative interfaces";
  expect(evaluate(plan(),[a,b]).earned).toBe(12);
 });
 it("withholds a clean Data Science result when the 8000-level wording is ambiguous",()=>{
  const rs=["COMP6240","COMP8410","COMP8430","COMP8600"].map(c=>record(c));
  expect(evaluate(plan(2025,"DTSC-SPEC"),rs).issues.some(s=>s.includes("Data Science"))).toBe(true);
 });
});

