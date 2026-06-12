import type { AppSettings } from './types';
const ACTION=/需要|必须|应该|完成|提交|准备|联系|检查|修改|处理|购买|学习|发送|参加|整理|记得|跟进|采购|部署/;
function extractDate(t:string):string|null{
  const n=new Date;
  if(/今天/.test(t))return n.toISOString().slice(0,10);
  if(/明天/.test(t)){n.setDate(n.getDate()+1);return n.toISOString().slice(0,10);}
  if(/后天/.test(t)){n.setDate(n.getDate()+2);return n.toISOString().slice(0,10);}
  const m=t.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if(m)return `${n.getFullYear()}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  return null;
}
function ruleExtract(text:string){
  return text.split(/[。！？\n;；]/).map(s=>s.trim()).filter(s=>s.length>3&&ACTION.test(s)).map(s=>{
    let p:'high'|'medium'|'low'='medium';
    if(/紧急|加急|尽快|立即/.test(s))p='high';
    if(/不急|有空|顺便/.test(s))p='low';
    return {title:s.replace(/^[，,。！!\s]*/,'').trim(),description:s.trim(),priority:p,dueDate:extractDate(s)};
  });
}
async function llmExtract(text:string,s:AppSettings){
  try{
    const r=await fetch(s.llmEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.llmApiKey},body:JSON.stringify({model:s.llmModel,messages:[{role:'user',content:'从文本提取任务。JSON数组[{title,description,priority(high/medium/low),dueDate(ISO或null)}]。只返回JSON：\n'+text}],temperature:.3,max_tokens:2000})});
    const d=await r.json();
    const c=d.choices?.[0]?.message?.content||'';
    const j=c.match(/\[[\s\S]*\]/);
    return j?JSON.parse(j[0]):[];
  }catch{return ruleExtract(text);}
}
export async function extractTasks(text:string,s:AppSettings){
  if(!text.trim())return[];
  if(s.aiMode==='llm'&&s.llmEndpoint&&s.llmApiKey)return llmExtract(text,s);
  await new Promise(r=>setTimeout(r,300));
  return ruleExtract(text);
}
export async function analyzeImage(dataUrl:string,s:AppSettings):Promise<string>{
  if(s.aiMode!=='llm'||!s.llmEndpoint)return'';
  try{
    const r=await fetch(s.llmEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.llmApiKey},body:JSON.stringify({model:s.llmModel,messages:[{role:'user',content:[{type:'text',text:'提取图片中所有文字内容。'},{type:'image_url',image_url:{url:dataUrl}}]}],max_tokens:2000})});
    const d=await r.json();
    return d.choices?.[0]?.message?.content||'';
  }catch{return'';}
}
