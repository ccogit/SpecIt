/** Anthropic Messages API payload with optional explicit caching of static skill instructions. */
const marker='\n\nVerbindliche Skill-Richtlinien für diese Phase.';

export function splitReusableSkills(instruction) {
 const index=String(instruction).indexOf(marker);
 return index<0?{instruction,skills:''}:{instruction:instruction.slice(0,index),skills:instruction.slice(index+2)};
}

export function anthropicMessageBody({model,maxTokens,effort,system,instruction,data,stream=false,cache=false,ttl='5m'}) {
 const {instruction:userInstruction,skills}=cache?splitReusableSkills(instruction):{instruction,skills:''};
 const text=userInstruction+'\n\nProjektdaten (JSON):\n'+JSON.stringify(data);
 const cachedSystem=skills?[
   {type:'text',text:system},
   {type:'text',text:skills,cache_control:{type:'ephemeral',...(ttl==='1h'?{ttl:'1h'}:{})}}
 ]:system;
 return {model,max_tokens:maxTokens,...(effort?{output_config:{effort}}:{}),
   system:cachedSystem,...(stream?{stream:true}:{}),messages:[{role:'user',content:text}]};
}
export const enabledPromptCache=env=>env.SPECIT_PROMPT_CACHE==='1';
export const promptCacheTtl=env=>env.SPECIT_PROMPT_CACHE_TTL==='1h'?'1h':'5m';
