import {readFileSync,readdirSync,existsSync} from "node:fs";
import type {CatalogueItem,Source,ProgramRules,CourseRule} from "./types";
export const RELEASE="anu-2026-09-27-v1";
const snapshot=JSON.parse(readFileSync("data/catalogue.json","utf8")) as {release:string;retrievedAt:string;items:CatalogueItem[];sources:Source[]};
export const catalogue=snapshot.items;
export const sourceDate=snapshot.retrievedAt;
export const rules=JSON.parse(readFileSync("data/rules.json","utf8")) as {programs:ProgramRules[];courses:CourseRule[]};
const archived=new Map<string,{programs:ProgramRules[];courses:CourseRule[]}>();
if(existsSync("data/releases"))for(const name of readdirSync("data/releases").filter(n=>n.endsWith(".json"))){
 const release=JSON.parse(readFileSync("data/releases/"+name,"utf8"));archived.set(release.release,release);
}
export function rulesForRelease(release:string){return archived.get(release)||(release===RELEASE?rules:undefined);}
export function course(code:string,year:number) {return catalogue.find(c=>c.kind==="course"&&c.code===code.toUpperCase()&&c.year===year);}
export function item(kind:string,code:string,year:number){return catalogue.find(c=>c.kind===kind&&c.code===code.toUpperCase()&&c.year===year);}
export function programRules(program:string,year:number,release=RELEASE){return program==="7706XMCOMP"?rulesForRelease(release)?.programs.find(r=>r.year===year):undefined;}
export function searchCatalogue(query:string,year:number,kind:string,career="",page=1){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const all=catalogue.filter(c=>c.year===year&&(!kind||c.kind===kind)&&(!career||c.career===career)&&words.every(w=>(c.code+" "+c.name).toLowerCase().includes(w)));
 all.sort((a,b)=>(a.code==="7706XMCOMP"?-1:b.code==="7706XMCOMP"?1:a.name.localeCompare(b.name)));
 return {total:all.length,items:all.slice((page-1)*24,page*24)};
}
export function courseUnits(c:CatalogueItem|undefined){const n=Number(c?.units);return Number.isFinite(n)&&n>0?n:6;}
