import {defineMiddleware} from "astro:middleware";
export const onRequest=defineMiddleware(async(ctx,next)=>{
 const response=await next();
 response.headers.set("X-Content-Type-Options","nosniff");
 response.headers.set("Referrer-Policy","same-origin");
 response.headers.set("X-Frame-Options","DENY");
 if(["/plan","/study","/account","/review","/api/"].some(p=>ctx.url.pathname.startsWith(p)))response.headers.set("Cache-Control","no-store");
 return response;
});
