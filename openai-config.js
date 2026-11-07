import {existsSync,readFileSync} from 'node:fs';
// Read only the configured key or the documented Render Secret File names.
// Never enumerate secret directories or expose credential contents to the browser/logs.
export function loadOpenAIConfig({env=process.env,exists=existsSync,read=readFileSync}={}){
 const model=env.OPENAI_LABEL_MODEL?.trim()||'gpt-5.4-mini';
 const environmentKey=env.OPENAI_API_KEY?.trim();if(environmentKey)return {apiKey:environmentKey,model};
 const paths=env.OPENAI_API_KEY_FILE?[env.OPENAI_API_KEY_FILE]:['/etc/secrets/OPENAI_API_KEY','/etc/secrets/openai_api_key'];
 for(const path of paths){
  try{if(!exists(path))continue;let value=read(path,'utf8').trim();
   const assignment=value.match(/^(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+)$/m);if(assignment)value=assignment[1].trim();
   if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
   if(value&&!/[\r\n]/.test(value))return {apiKey:value,model};
  }catch{/* Keep optional AI unavailable when a configured file cannot be read. */}
 }
 return {apiKey:undefined,model};
}
