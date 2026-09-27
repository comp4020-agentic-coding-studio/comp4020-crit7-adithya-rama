export type Kind = "program" | "course" | "major" | "minor" | "specialisation";
export interface CatalogueItem { id:string; year:number; kind:Kind; code:string; name:string; career:string; units:number|string; sessions:string; mode:string; url:string }
export interface Source {url:string;retrievedAt:string;hash:string;text?:string;reviewStatus?:string}
export type Session = "Summer" | "First Semester" | "Autumn" | "Winter" | "Second Semester" | "Spring";
export const SESSIONS:Session[]=["Summer","First Semester","Autumn","Winter","Second Semester","Spring"];
export const semesterLabel=(s:string)=>s==="First Semester"?"Semester 1":s==="Second Semester"?"Semester 2":s;
export const period=(year:number,session:string)=>year*10+SESSIONS.indexOf(session as Session);
export const half=(session:string)=>SESSIONS.indexOf(session as Session)<3?1:2;
export type RecordKind="passed"|"in-progress"|"failed"|"withdrawn"|"specified-credit"|"unspecified-credit"|"exemption"|"substitution"|"permission"|"load-variation";
export interface StudyRecord {program?:string;cohort?:number;topic?:string;id:string;code:string;units:number;year:number;session:string;kind:RecordKind;approval:"approved"|"pending"|"withdrawn";scope:string;replacement:string;reference:string;date:string}
export interface Selection {topic?:string;id:string;code:string;units:number;year:number;session:string}
export interface Context { program:string;cohort:number;specialisation:string;load:number;studentType:"domestic"|"international"; }
export interface Plan extends Context {id:string;name:string;release:string;revision:number;selections:Selection[]}
export type Expr={op:"course";codes:string[];concurrent?:boolean}|{op:"and"|"or";children:Expr[]}|{op:"program";codes:string[]}|{op:"permission";reason:string}|{op:"units";units:number}|{op:"unknown";reason:string}|{op:"true"};
export interface CourseRule {code:string;year:number;source:string;prerequisite:Expr;incompatible:string[];repeatLimit:number;requisiteText:string;reviewed:boolean}
export interface Bucket {id:string;name:string;min:number;max:number;codes?:string[];subjects?:string[];minLevel?:number;maxLevel?:number;creditMax?:number;exclude?:string[];levels?:number[];parent?:string}
export interface Specialisation {code:string;name:string;year:number;source:string;buckets:Bucket[];level8Min:number;ambiguities:string[]}
export interface ProgramRules {year:number;source:string;total:number;level8Min:number;buckets:Bucket[];specialisations:Specialisation[];ambiguities:string[]}
export type CheckStatus="met"|"conditional"|"blocked"|"unknown";
export interface Check {status:CheckStatus;reasons:string[];sources:string[]}
export interface CourseAssessment {code:string;contribution:Check;eligibility:Check;availability:Check;requirement:string;rank:number}
