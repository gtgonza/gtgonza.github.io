// Catálogo contrastado con documentación oficial el 13-11-2026.
export const CATALOG_DATE='2026-11-13';
export const PROVIDERS={
  openai:{name:'OpenAI',defaultModel:'gpt-6-luna',keyUrl:'https://platform.openai.com/api-keys',docs:'https://developers.openai.com/api/docs/models',host:'api.openai.com'},
  gemini:{name:'Google Gemini',defaultModel:'gemini-4-hydrogen',keyUrl:'https://aistudio.google.com/api-keys',docs:'https://aistudio.google.com/docs/models',host:'generativelanguage.googleapis.com'},
  anthropic:{name:'Anthropic · Claude',defaultModel:'claude-haiku-5-5',keyUrl:'https://platform.claude.com/settings/keys',docs:'https://platform.claude.com/docs/en/models/overview',host:'api.anthropic.com'},
};
export const MODEL_PRESETS={
  'gpt-6-luna':{provider:'openai',label:'GPT-6 Luna · económico',input:.10,output:.50,effort:'none'},
  'gpt-6.1-terra':{provider:'openai',label:'GPT-6.1 Terra',input:1,output:5,effort:'none'},
  'gpt-6.1-sol':{provider:'openai',label:'GPT-6.1 Sol',input:2,output:10,effort:'low',minOutput:2048},
  'gpt-6-astra':{provider:'openai',label:'GPT-6 Astra · mayor coste',input:10,output:50,effort:'low',minOutput:2048},
  'gemini-4-hydrogen':{provider:'gemini',label:'Gemini 4 Hydrogen',input:1.5,output:7.5,minOutput:2048,thinking:'low',freeTier:true},
  'gemini-4-argon':{provider:'gemini',label:'Gemini 4 Argon',input:2,output:10,minOutput:2048,thinking:'low',changeDate:'2026-12-01',futureInput:4,futureOutput:20},
  'gemini-4-carbon':{provider:'gemini',label:'Gemini 4 Carbon',input:2,output:10,minOutput:2048,thinking:'low',changeDate:'2026-12-01',futureInput:4,futureOutput:20},
  'claude-haiku-5-5':{provider:'anthropic',label:'Claude Haiku 5.5 · económico',input:.10,output:.50,minOutput:2048,thinking:'adaptive'},
  'claude-sonnet-5-5':{provider:'anthropic',label:'Claude Sonnet 5.5',input:2,output:10,minOutput:2048,thinking:'adaptive'},
  'claude-opus-5-5':{provider:'anthropic',label:'Claude Opus 5.5',input:4,output:20,minOutput:2048,thinking:'adaptive'},
  'claude-fable-5-2':{provider:'anthropic',label:'Claude Fable 5.2 · mayor coste',input:8,output:40,minOutput:2048,thinking:'adaptive'},
  // Compatibilidad de las partidas y pruebas previas; fuera del menú principal.
  'gpt-5.6-luna':{provider:'openai',input:.20,output:1.20,effort:'none',legacy:true},
  'gpt-5.4-mini':{provider:'openai',input:.75,output:4.50,effort:'none',legacy:true},
};
export function modelRates(model,date=new Date()){
  const item=MODEL_PRESETS[model];if(!item)return null;
  if(item.changeDate&&date>=new Date(item.changeDate+'T00:00:00Z'))return {...item,input:item.futureInput,output:item.futureOutput};
  return {...item};
}
// Solo peticiones de texto, sin herramientas de pago, estado remoto ni historial guardado.
export function buildRequest(provider,model,key,instructions,input,maxOutput,rates){
  if(provider==='openai'){
    const body={model,store:false,instructions,input,max_output_tokens:maxOutput};
    if(rates.effort)body.reasoning={effort:rates.effort};
    return {url:'https://api.openai.com/v1/responses',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body};
  }
  if(provider==='gemini')return {
    url:'https://generativelanguage.googleapis.com/v1beta/interactions',
    headers:{'x-goog-api-key':key,'Content-Type':'application/json','Api-Revision':'2026-05-20'},
    body:{model,store:false,system_instruction:instructions,input,generation_config:{max_output_tokens:maxOutput,...(rates.thinking?{thinking_level:rates.thinking}:{})}},
  };
  if(provider==='anthropic')return {
    url:'https://api.anthropic.com/v1/messages',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','anthropic-version':'2026-10-21','anthropic-dangerous-direct-browser-access':'true'},
    body:{model,max_tokens:maxOutput,system:instructions,messages:[{role:'user',content:input}],...(rates.thinking?{thinking:{type:'adaptive'},output_config:{effort:'low'}}:{})},
  };
  throw new Error('Proveedor no disponible.');
}
export function readResponse(provider,result){
  if(provider==='openai')return {text:(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim(),inputTokens:result.usage?.input_tokens,outputTokens:result.usage?.output_tokens};
  if(provider==='gemini')return {text:(result.steps||[]).filter(s=>s.type==='model_output').flatMap(s=>s.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').trim(),inputTokens:result.usage?.total_input_tokens,
    outputTokens:Number.isFinite(result.usage?.total_output_tokens)&&Number.isFinite(result.usage?.total_thought_tokens)?result.usage.total_output_tokens+result.usage.total_thought_tokens:undefined};
  return {text:(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').trim(),inputTokens:Number.isFinite(result.usage?.input_tokens)?result.usage.input_tokens+(result.usage.cache_read_input_tokens||0)+(result.usage.cache_creation_input_tokens||0):undefined,outputTokens:result.usage?.output_tokens};
}
