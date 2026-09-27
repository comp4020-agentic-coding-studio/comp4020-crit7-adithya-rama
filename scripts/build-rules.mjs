import fs from "node:fs";
const details=JSON.parse(fs.readFileSync("data/course-sources.json","utf8"));
const codes=s=>s.split(" ");
const b=(id,name,min,max,list,extra={})=>({id,name,min,max,...(list?{codes:codes(list)}:{}),...extra});
const core=(c,u=6)=>b("core:"+c,c+" · compulsory",u,u,c);
const sb=(id,name,min,max,list,extra={})=>b("spec:"+id,name,min,max,list,{parent:"specialisation",...extra});
const req=s=>codes(s).map(c=>sb(c,c+" · specialisation",6,6,c));
const opts="COMP6240 COMP6331 COMP6390 INFS8004 INFS8205 LAWS8445 MGMT7020 REGN8014";
const configs={
"ARTIF-SPEC":{name:"Artificial Intelligence",level8Min:12,buckets:req("COMP6262 COMP6320 COMP8620 COMP8691")},
"CMSY-SPEC":{name:"Computer Systems",level8Min:12,buckets:[sb("systems-advanced","Advanced systems",12,24,"COMP8300 COMP8045 COMP8712"),sb("systems-foundations","Systems foundations",0,12,"COMP6310 COMP6330 COMP6331 COMP6361 COMP6464 ENGN6213")]},
"COMP-SPEC":{name:"Computational Foundations",level8Min:12,buckets:[sb("foundations-first","Computational foundations · first list",12,24,"COMP6361 COMP6363 COMP8011 COMP8460 MATH6114 MATH8343"),sb("foundations-second","Computational foundations · second list",0,12,"COMP6261 COMP6262 COMP6466 COMP8712")]},
"DTSC-SPEC":{name:"Data Science",level8Min:12,buckets:[...req("COMP6240 COMP8410 COMP8430"),sb("data-option","Data science option",6,6,"COMP6490 COMP6670 COMP8600 COMP8650 COMP8880 STAT6039")]},
"HCCM-SPEC":{name:"Human-Centred and Creative Computing",level8Min:12,buckets:[...req("COMP6390"),sb("hcc-advanced","Advanced human-centred computing",12,18,"COMP8350 COMP8539 COMP8610"),sb("hcc-options","Human-centred computing options",0,6,"COMP6528 COMP6540 COMP6720 COMP6780")]},
"MCHL-SPEC":{name:"Machine Learning",level8Min:12,buckets:[sb("machine-learning","Machine learning courses",24,24,"COMP6261 COMP6490 COMP6528 COMP6670 COMP8600 COMP8650 COMP8880")]},
"PCOM-SPEC":{name:"Professional Computing",level8Min:12,buckets:[...req("COMP6120 ENGN8100"),sb("professional-option","Professional computing option",6,6,opts),sb("professional-advanced","Further 8000-level COMP",6,6,null,{subjects:["COMP"],minLevel:8000,maxLevel:8000,exclude:codes("COMP8715 COMP8800 COMP8830")})]},
"SOFT-SPEC":{name:"Software Development",level8Min:12,buckets:[sb("software-replacement","COMP6120 replacement · 6000/8000 COMP",6,6,null,{subjects:["COMP"],levels:[6000,8000],exclude:["COMP6120"]}),...req("ENGN8100"),sb("software-advanced","Further 8000-level COMP",6,6,null,{subjects:["COMP"],minLevel:8000,maxLevel:8000,exclude:codes("COMP8715 COMP8800 COMP8830")}),sb("software-option","Software development option",0,12,opts)]}
};
const programs=[2025,2026].map(year=>({year,source:`https://programsandcourses.anu.edu.au/${year}/program/7706XMCOMP`,total:96,level8Min:24,ambiguities:[],specialisations:Object.entries(configs).filter(([c])=>year===2025?c!=="SOFT-SPEC":c!=="PCOM-SPEC").map(([code,config])=>{
 const s=structuredClone(config);if(code==="DTSC-SPEC"&&year===2026)s.buckets.at(-1).codes=s.buckets.at(-1).codes.filter(c=>c!=="STAT6039");if(code==="CMSY-SPEC"&&year===2026)s.buckets[1].codes.push("COMP6300");
 return {...s,code,year,source:`https://programsandcourses.anu.edu.au/${year}/specialisation/${code}`,ambiguities:[]};
}),buckets:[...(year===2025?["COMP6250","COMP6442","COMP6710","COMP8260"].map(c=>core(c)):[core("COMP6120"),core("COMP6442"),core("COMP7710",12),core("COMP8280")]),
 b("foundation","Mathematical foundations",6,year===2025?6:96,"MATH6005 COMP6260"),
 b("project","Computing project / internship",year===2025?12:0,12,"COMP8715 COMP8830"),
 b("further","Further COMP / ENGN study",18,18,null,{subjects:["COMP","ENGN"],minLevel:6000,maxLevel:8000}),
 b("elective","University electives",year===2025?12:6,year===2025?12:6,null)]}));
const C=(s,concurrent=false)=>({op:"course",codes:codes(s),concurrent}),P=(s="7706XMCOMP 7722XVCOMP")=>({op:"program",codes:codes(s)}),A=(...children)=>({op:"and",children}),O=(...children)=>({op:"or",children}),T={op:"true"},U=reason=>({op:"unknown",reason}),pass="COMP6710 COMP7710 COMP1110 COMP1140",advanced=P("7722XVCOMP");
const known={
COMP6120:C("COMP6442 COMP2100",true),COMP6240:T,COMP6250:P("7706XMCOMP 7722XVCOMP 6906XGDCP MMLCV"),
COMP6260:T,COMP6261:T,COMP6262:T,COMP6300:O(P(),C("COMP6710 COMP7710 COMP1110")),
COMP6310:A(C("COMP6300"),C("COMP6710 COMP7710 COMP1110")),
COMP6320:A(O(C("COMP6710 COMP7710 COMP1110"),advanced),C("COMP6262 COMP2620",true)),
COMP6330:O(advanced,C("COMP6300",true),C("COMP2300 ENGN2219")),
COMP6331:C(pass+" COMP6310 COMP2310 COMP6442 COMP2100"),
COMP6361:O(A(C("COMP6710"),C("COMP6260")),advanced),COMP6363:P(),
COMP6390:O(P(),C("COMP6442 COMP6710 COMP6720")),
COMP6442:O(A(C(pass),C("MATH6005 COMP6260 MATH1005 COMP1600",true)),A(P("MMLCV"),C(pass)),advanced),
COMP6464:O(P(),C(pass)),COMP6466:O(P(),C(pass)),
COMP6490:O(advanced,A(C("COMP6240 COMP2400 COMP6260 COMP1600 COMP6442 COMP2100"),C("COMP6730 COMP1730 COMP6710 COMP1110"))),
COMP6528:P("7706XMCOMP 7722XVCOMP 6906XGDCP MMLCV"),
COMP6540:O(advanced,C("COMP6710 COMP1110 COMP1140")),
COMP6670:O(advanced,C("COMP6710 COMP7710 COMP6730",true),C("COMP1110 COMP1140")),
COMP6710:U("Enrolment excludes Master of Computing (Advanced); verify the program restriction."),
COMP6720:T,COMP6780:U("Requires enrolment in an ANU postgraduate program."),
COMP7710:{op:"permission",reason:"A School of Computing permission code is required."},
COMP8020:A(C("COMP6390"),U("Topic-specific prerequisites and a School permission code require confirmation.")),
COMP8011:U("Requires 12 units of 6000-level COMP plus topic-specific prerequisites and a permission code."),
COMP8045:U("Requires 12 units of 6000-level COMP plus topic-specific prerequisites and a permission code."),
COMP8260:P("7706XMCOMP 7722XVCOMP 6906XGDCP MMLCV"),
COMP8280:P("7706XMCOMP 7722XVCOMP 6906XGDCP MMLCV"),
COMP8300:C("COMP6310 COMP2310 COMP6330 COMP3300 COMP6331 COMP3310 COMP6464 ENGN6539"),
COMP8350:C("COMP6390 COMP6720"),
COMP8410:A(C("COMP7240 COMP6240 COMP2400"),C("COMP6730 COMP7230 COMP6710")),
COMP8430:A(C("COMP7230 COMP6730 COMP6710"),C("COMP7240 COMP6240"),U("Intensive-mode offerings require a permission code; confirm your class mode.")),
COMP8460:C("COMP6466 COMP3600"),COMP8539:C("COMP6528 COMP4528 ENGN4528"),
COMP8600:O(C("COMP6670 COMP3670"),A(C("COMP6710 COMP6730 COMP7230 COMP1110 COMP1730"),C("COMP8410 COMP8910 COMP3425"),C("STAT6039 STAT7039"))),
COMP8610:O(advanced,A(P("MMLCV"),C("COMP6710 COMP1110 COMP1140")),A(C("COMP6710 COMP1110 COMP1140"),C("COMP6390 COMP6442 COMP6540 COMP6780 COMP6720"))),
COMP8620:A(C("COMP6320 COMP3620"),U("Topic-specific prerequisites and a permission code require confirmation.")),
COMP8650:A(C("COMP6670 COMP8600"),U("Check additional topic-specific prerequisites.")),
COMP8691:C("COMP6320 COMP3620"),COMP8712:A(C("COMP6442"),C("COMP6310")),
COMP8715:O(A(P("7706XMCOMP"),C("COMP6442 COMP2100"),C("COMP8260 COMP8280")),A(P("MMLCV"),C("COMP6442 COMP2100"),C("COMP6250 COMP8260 COMP8280"))),
COMP8800:U("Research project requires program, GPA, completed-study and supervisor/permission checks."),
COMP8830:A(O(A(P("7706XMCOMP"),C("COMP8260"),C("COMP6442")),A(P("MMLCV"),C("COMP6710"),C("COMP6250 COMP8260"))),U("Competitive internship entry and a permission code must be confirmed.")),
COMP8880:O(C("COMP6670"),A(C("COMP6710 COMP6730 COMP7230"),C("COMP8410 COMP8910"),C("STAT6039"))),
ENGN6213:P("7706XMCOMP 7722XVCOMP MENG"),ENGN8100:P("7706XMCOMP 7722XVCOMP MENG MPM MBIS GCNT"),
INFS8004:T,INFS8205:T,MATH6005:P("7706XMCOMP 6906XGDCP"),
MATH6114:{op:"permission",reason:"A Mathematical Sciences Institute permission code is required."},
MATH8343:U("Requires an eligible Mathematical Sciences program or an explicit enrolment approval.")
};
const getText=s=>s.text.includes("Requisite and Incompatibility")?s.text.slice(s.text.lastIndexOf("Requisite and Incompatibility")+29).split(/\n\s*(?:Prescribed Texts|Preliminary Reading|Assumed Knowledge|Other Information|Fees|Offerings)/)[0].trim():"";
const norm=s=>s.replace(/\s+/g," ").trim();
const courseRules=details.map(s=>{
 const year=Number(s.url.match(/\/(20\d\d)\//)[1]),code=s.url.split("/").at(-1),text=getText(s),reference=details.find(d=>d.url.includes("/2026/course/"+code));
 const identical=reference&&norm(getText(reference))===norm(text);
 const incompatible=[...text.matchAll(/(?:Incompatible(?: with|:)?|(?:not able to|cannot) enrol in this course if you have (?:successfully |previously )?completed)([^.]+)(?:\.|$)/gi)].flatMap(m=>m[1].match(/[A-Z]{4}\d{4}/g)||[]);
 if(code==="COMP7710")incompatible.push("COMP1110","COMP1140","COMP6710");
 const prerequisite=(year===2026||identical)&&known[code]?known[code]:U(text||"No reviewed prerequisite information for this teaching year.");
 return {code,year,source:s.url,prerequisite,incompatible:[...new Set(incompatible)],repeatLimit:code==="COMP8715"?2:/up to (?:3|three) times/i.test(s.text)?3:1,requisiteText:text,reviewed:!!known[code]&&(year===2026||!!identical)};
});
fs.writeFileSync("data/rules.json",JSON.stringify({release:"anu-2026-09-27-v1",programs,courses:courseRules},null,2));
console.log("Encoded",programs.length,"cohorts",programs.reduce((n,p)=>n+p.specialisations.length,0),"specialisations",courseRules.length,"course/year conditions.");
