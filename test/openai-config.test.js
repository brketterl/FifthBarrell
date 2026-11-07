import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadOpenAIConfig} from '../openai-config.js';
test('OpenAI config prefers the environment key and never reads unrelated secret files',()=>{
 let reads=0;const config=loadOpenAIConfig({env:{OPENAI_API_KEY:' test-env-key ',OPENAI_LABEL_MODEL:' gpt-5.4-mini '},exists:()=>true,read:()=>{reads++;return 'file-key';}});assert.equal(config.apiKey,'test-env-key');assert.equal(config.model,'gpt-5.4-mini');assert.equal(reads,0);
});
test('Render Secret Files support a raw key or OPENAI_API_KEY assignment',()=>{
 for(const value of ['test-file-key','OPENAI_API_KEY=test-file-key','OPENAI_API_KEY="test-file-key"','export OPENAI_API_KEY=\'test-file-key\'']){
  const seen=[];const config=loadOpenAIConfig({env:{},exists:path=>path==='/etc/secrets/OPENAI_API_KEY',read:(path)=>{seen.push(path);return value;}});assert.equal(config.apiKey,'test-file-key');assert.deepEqual(seen,['/etc/secrets/OPENAI_API_KEY']);
 }
 const custom=loadOpenAIConfig({env:{OPENAI_API_KEY_FILE:'/etc/secrets/custom-key'},exists:()=>true,read:()=> 'custom-key'});assert.equal(custom.apiKey,'custom-key');
});
test('missing, unreadable, or empty secrets leave AI unavailable without exposing file content',()=>{
 assert.equal(loadOpenAIConfig({env:{},exists:()=>false}).apiKey,undefined);
 assert.equal(loadOpenAIConfig({env:{},exists:()=>true,read:()=>{throw Error('file access denied');}}).apiKey,undefined);
 assert.equal(loadOpenAIConfig({env:{},exists:()=>true,read:()=>''}).apiKey,undefined);
 assert.equal(loadOpenAIConfig({env:{},exists:()=>true,read:()=> 'unexpected\nmultiple-lines'}).apiKey,undefined);
});
