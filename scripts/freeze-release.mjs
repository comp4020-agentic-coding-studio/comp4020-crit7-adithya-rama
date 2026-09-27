import fs from "node:fs";
const raw=fs.readFileSync("data/rules.json","utf8"),data=JSON.parse(raw);
if(!/^anu-\d{4}-\d{2}-\d{2}-v\d+$/.test(data.release))throw Error("Invalid release identifier");
fs.mkdirSync("data/releases",{recursive:true});
const path="data/releases/"+data.release+".json";
if(fs.existsSync(path)&&fs.readFileSync(path,"utf8")!==raw)throw Error("Immutable rule release changed. Increment the release id and keep previous files.");
if(!fs.existsSync(path))fs.writeFileSync(path,raw);
console.log("Frozen",data.release);
