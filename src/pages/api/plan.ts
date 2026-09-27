import type {APIRoute} from "astro";
import {currentUser} from "../../lib/auth";
import {getPlan,records,InputError} from "../../lib/store";
import {evaluate,planIssues} from "../../lib/engine";
export const GET:APIRoute=({cookies,url})=>{
 const user=currentUser(cookies);if(!user)return Response.json({error:"Sign in required"},{status:401});
 try{const plan=getPlan(user.id,url.searchParams.get("id")||"");const rs=records(user.id);return Response.json({plan,completed:evaluate(plan,rs),projected:evaluate(plan,rs,true),issues:planIssues(plan,rs)},{headers:{"Cache-Control":"no-store"}});}
 catch(e){return Response.json({error:"Plan not found"},{status:e instanceof InputError?e.status:500});}
};