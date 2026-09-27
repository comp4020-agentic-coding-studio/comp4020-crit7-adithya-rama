import {it,expect} from "vitest";
import {execFileSync} from "node:child_process";
it("rejects a wrong-year response, conflicting duplicates and an empty import",()=>{
 const output=execFileSync("python3",["-c",[
 "import sys;sys.path.insert(0,'scripts')",
 "from catalogue_validation import validate_rows",
 "good={'Year':2025,'CourseCode':'COMP6442','Name':'Software Construction'}",
 "assert len(validate_rows([good,good],2025,'course'))==1",
 "for rows,year in [([good],2026),([good,{**good,'Name':'Wrong'}],2025),([],2025)]:",
 " try: validate_rows(rows,year,'course')",
 " except ValueError: pass",
 " else: raise AssertionError('Unsafe import accepted')",
 "print('validated')"
 ].join("\n")],{encoding:"utf8"});
 expect(output.trim()).toBe("validated");
});