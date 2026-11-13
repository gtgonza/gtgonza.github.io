import { Chess } from './vendor/chess.js';
import { MODEL_PRESETS, PROVIDERS, modelRates, buildRequest, readResponse } from './models.js';
export {MODEL_PRESETS} from './models.js';

export class BrowserEngine {
  constructor(){ this.queue=Promise.resolve();this.worker=null; }
  async init(){
    if(this.worker)return;
    this.worker=new Worker(new URL('./vendor/stockfish.js',import.meta.url));
    this.worker.onmessage=e=>{for(const line of String(e.data).split('\n'))this.listener?.(line);};
    this.worker.onerror=()=>{this.failure?.(new Error('No se pudo cargar el motor. Recarga la página e intenta otra vez.'));};
    await this.wait('uciok',()=>this.send('uci'));
    await this.wait('readyok',()=>this.send('isready'));
  }
  send(command){this.worker.postMessage(command);}
  wait(marker,start,info){return new Promise((resolve,reject)=>{
    const clear=()=>{clearTimeout(timer);this.listener=null;this.failure=null;};
    const timer=setTimeout(()=>{clear();this.worker?.terminate();this.worker=null;reject(new Error('El motor no respondió. Vuelve a intentar.'));},30000);
    this.failure=e=>{clear();this.worker?.terminate();this.worker=null;reject(e);};
    this.listener=line=>{info?.(line);if(line.startsWith(marker)){clear();resolve(line);}};start();
  });}
  evaluate(fen,{ms=800,multipv=1,history=''}={}){
    const task=this.queue.then(async()=>{
      const c=new Chess(fen);
      if(c.isCheckmate())return {cp:-100000,mate:0,pv:[],best:null,depth:0,candidates:[]};
      if(c.isGameOver())return {cp:0,mate:null,pv:[],best:null,depth:0,candidates:[]};
      await this.init();this.send('setoption name MultiPV value '+multipv);this.send('setoption name Skill Level value 20');
      this.send(history?'position startpos moves '+history:'position fen '+fen);
      const candidates={};let main={cp:0,mate:null,pv:[],depth:0};
      const best=await this.wait('bestmove',()=>this.send('go movetime '+ms),line=>{
        const score=line.match(/score (cp|mate) (-?\d+)/),pv=line.match(/ pv (.+)/);
        if(!score||!pv||/lowerbound|upperbound/.test(line))return;
        const n=Number(score[2]),rank=Number(line.match(/multipv (\d+)/)?.[1]||1);
        const item={cp:score[1]==='cp'?n:Math.sign(n||-1)*(100000-Math.abs(n)*100),mate:score[1]==='mate'?n:null,pv:pv[1].trim().split(' '),depth:Number(line.match(/depth (\d+)/)?.[1]||0)};
        candidates[rank]=item;if(rank===1)main=item;
      });return {...main,best:best.split(' ')[1],candidates:Object.values(candidates)};
    });this.queue=task.catch(()=>{});return task;
  }
  close(){this.worker?.terminate();this.worker=null;}
}
export function variation(fen,moves){const c=new Chess(fen),san=[];for(const uci of moves.slice(0,8)){try{san.push(c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san);}catch{break;}}return san.join(' ');}
export function classify(before,after,uci,best){
  const loss=uci===best?0:Math.max(0,before.cp+after.cp);
  if(before.cp < -90000 && after.cp >90000)return {loss:0,label:'Posición perdida',kind:'neutral'};
  return {loss,...(loss>=200?{label:'Error grave',kind:'blunder'}:loss>=100?{label:'Error',kind:'mistake'}:loss>=50?{label:'Imprecisión',kind:'inaccuracy'}:{label:uci===best?'Mejor jugada':'Buena jugada',kind:'good'})};
}
export function candidateMoves(chess,analysis,rating,ply){
  const tolerance=rating<600?100:rating<1000?65:rating<1400?35:15;
  let list=analysis.candidates.filter(c=>analysis.cp-c.cp<=tolerance).map(c=>({uci:c.pv[0],san:variation(chess.fen(),[c.pv[0]]),line:variation(chess.fen(),c.pv),cp:c.cp}));
  if(ply<8&&!chess.isCheck()){
    const legal=chess.moves({verbose:true});const development=list.filter(c=>{
      const m=legal.find(m=>m.from+m.to+(m.promotion||'')===c.uci);
      return m&&((m.piece==='p'&&/^[cde]/.test(m.from))||['n','b'].includes(m.piece)||/[+#x]/.test(m.san)||m.san==='O-O');
    });if(development.length)list=development;
  }
  return list.length?list:[{uci:analysis.best,san:variation(chess.fen(),[analysis.best])}];
}
export function estimateLevel(moves){
  const evaluated=moves.filter(m=>Number.isFinite(m.loss));
  if(evaluated.length<8)return {enough:false,samples:evaluated.length,text:'Partida demasiado corta: se necesitan al menos 8 jugadas propias evaluadas para una primera aproximación.'};
  const blunders=evaluated.filter(m=>m.kind==='blunder').length/evaluated.length;
  const errors=evaluated.filter(m=>['blunder','mistake'].includes(m.kind)).length/evaluated.length;
  const range=blunders>=.25?[200,650]:blunders>=.12?[350,900]:errors>=.20?[550,1100]:blunders>=.05?[750,1300]:[900,1600];
  return {enough:true,samples:evaluated.length,low:range[0],high:range[1],reference:Math.round((range[0]+range[1])/100)*50,
    text:`Rango orientativo de práctica: ${range[0]}–${range[1]}, basado en ${evaluated.length} jugadas propias. Es una regla exploratoria por frecuencia de errores; no está calibrada contra Elo de Chess.com ni Lichess y una partida puede ser poco representativa.`};
}
export class AIConnection {
  constructor(){this.key='';this.provider='openai';this.model='gpt-6-luna';this.limit=0.02;this.spent=0;this.reserved=0;this.calls=0;this.pending=0;this.rates=modelRates(this.model);}
  configure({key,provider=this.provider,model,limit,input,output}){
    if(this.pending)throw new Error('Espera a que termine la llamada actual.');
    if(!PROVIDERS[provider])throw new Error('Proveedor no disponible.');
    const nextModel=model||(provider===this.provider?this.model:PROVIDERS[provider].defaultModel);
    const rates=modelRates(nextModel)||{provider,input:Number(input),output:Number(output),minOutput:2048};
    if(!nextModel||nextModel.length>120)throw new Error('Indica un modelo válido.');
    if(rates.provider!==provider)throw new Error('El modelo no corresponde al proveedor seleccionado.');
    if(!Number.isFinite(rates.input)||!Number.isFinite(rates.output)||rates.input<=0||rates.output<=0)throw new Error('Introduce las tarifas del modelo por millón de tokens.');
    const nextKey=key||(provider===this.provider?this.key:'');
    this.key=nextKey;this.model=nextModel;this.provider=provider;this.rates=rates;
    this.limit=Math.max(0,Math.min(5,Number(limit)||0));
  }
  reset(){if(this.pending)throw new Error('Espera a que termine la llamada actual.');this.spent=0;this.reserved=0;this.calls=0;}
  usage(){return {usd:this.spent,limit:this.limit,calls:this.calls,model:this.model,provider:this.provider};}
  async generate(instructions,data,maxOutput=850,{signal}={}){
    if(!this.key)throw new Error('Conecta tu clave personal del proveedor arriba a la derecha, o elige el rival sin conexión a GPT.');
    const input=JSON.stringify(data);
    if(new TextEncoder().encode(instructions+input).length>50000)throw new Error('El texto supera el máximo de esta app. Reduce la reflexión para mantener el cálculo de coste acotado.');
    const provider=this.provider,model=this.model,key=this.key,rates=modelRates(model)||{...this.rates};
    maxOutput=Math.max(maxOutput,rates.minOutput||0);
    const reserve=((new TextEncoder().encode(instructions+input).length+2048)*rates.input+maxOutput*rates.output*(provider==='gemini'?2:1))/1e6;
    if(this.spent+this.reserved+reserve>this.limit||this.calls>=150)throw new Error('Se alcanzó el límite de USD de esta partida. Puedes aumentarlo arriba o continuar con el rival sin conexión a GPT.');
    this.reserved+=reserve;this.calls++;this.pending++;let charged=false;
    try{
      const request=buildRequest(provider,model,key,instructions,input,maxOutput,rates);
      const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000);
      let response;
      try{response=await fetch(request.url,{method:'POST',signal:combined,headers:request.headers,body:JSON.stringify(request.body)});}catch(e){if(e.name==='AbortError'||e.name==='TimeoutError')throw e;throw new Error('No se pudo conectar con '+PROVIDERS[provider].name+'. Comprueba la red y si tu cuenta permite llamadas desde navegador.');}
      if(!response.ok){
        if(response.status===401||response.status===403)throw new Error(PROVIDERS[provider].name+' rechazó la conexión. Comprueba tu clave, acceso al modelo y permisos para navegador.');
        if(response.status===429)throw new Error(PROVIDERS[provider].name+' limitó la solicitud o la cuenta no tiene saldo. Puedes reintentar o continuar sin conexión a GPT.');
        throw new Error(PROVIDERS[provider].name+' respondió '+response.status+'. Comprueba el acceso al modelo seleccionado.');
      }
      const result=await response.json();
      const parsed=readResponse(provider,result);
      if(Number.isFinite(parsed.inputTokens)&&Number.isFinite(parsed.outputTokens)){
        this.spent+=(parsed.inputTokens*rates.input+parsed.outputTokens*rates.output)/1e6;charged=true;
      }
      const text=parsed.text;
      if(!text)throw new Error('El modelo no devolvió texto. No se reintenta automáticamente para evitar gasto extra.');
      return text;
    }finally{this.reserved-=reserve;this.pending--;if(!charged)this.spent+=reserve;}
  }
}

export class ChessTrainer {
  constructor({engine=new BrowserEngine(),ai=new AIConnection(),now=()=>performance.now(),onProgress=()=>{}}={}){this.engine=engine;this.ai=ai;this.now=now;this.onProgress=onProgress;this.game=null;this.busy=false;this.abort=null;}
  isOver(){return !!this.game&&(!!this.game.ended||this.game.chess.isGameOver());}
  syncClock(){const g=this.game;if(!g?.running||this.isOver())return;const now=this.now();g.clocks[g.running]=Math.max(0,g.clocks[g.running]-(now-g.since));g.since=now;
    if(g.clocks[g.running]<=0){g.ended='timeout';g.loser=g.running;g.running=null;this.abort?.abort();this.setResult();}}
  runClock(color){this.syncClock();if(!this.isOver()){this.game.running=color;this.game.since=this.now();}}
  stopClock(){this.syncClock();if(this.game)this.game.running=null;}
  setResult(){const g=this.game;if(!g||!this.isOver())return;let result='1/2-1/2';if(g.ended==='resign'||g.ended==='timeout')result=g.loser==='w'?'0-1':'1-0';else if(g.chess.isCheckmate())result=g.chess.turn()==='w'?'0-1':'1-0';g.chess.setHeader('Result',result);g.running=null;}
  status(){const g=this.game,c=g.chess;if(g.ended==='resign')return 'Te rendiste. Ganan las '+(g.human==='w'?'negras.':'blancas.');if(g.ended==='timeout')return 'Tiempo agotado. Ganan las '+(g.loser==='w'?'negras.':'blancas.');if(c.isCheckmate())return 'Jaque mate. Ganan las '+(c.turn()==='w'?'negras.':'blancas.');if(c.isDraw())return 'Tablas'+(c.isStalemate()?' por ahogado.':c.isThreefoldRepetition()?' por repetición.':c.isInsufficientMaterial()?' por material insuficiente.':' por 50 movimientos.');return (c.turn()===g.human?'Tu turno':'El rival está pensando')+(c.isCheck()?' · Jaque':'');}
  view(){this.syncClock();const g=this.game;if(!g)return null;this.setResult();return {id:g.id,fen:g.chess.fen(),human:g.human,turn:g.chess.turn(),mode:'final',opponent:g.opponent,rating:g.rating,status:this.status(),over:this.isOver(),pgn:g.chess.pgn(),reviewed:!!g.reviewed,usage:this.ai.usage(),clocks:{...g.clocks},running:g.running,
    levelMode:g.levelMode,legal:this.isOver()?[]:g.chess.moves({verbose:true}).map(m=>({from:m.from,to:m.to,promotion:m.promotion})),
    moves:g.moves.map(m=>g.reviewed?{...m}:{ply:m.ply,san:m.san,from:m.from,to:m.to,color:m.color}),notice:g.notice||null,report:g.report||null,
    exercises:(g.exercises||[]).map(x=>({ply:x.ply,fen:x.fen,done:!!x.done,answer:x.done?x.answer:null,legal:new Chess(x.fen).moves({verbose:true}).map(m=>({from:m.from,to:m.to,promotion:m.promotion}))}))};}
  record(move){const g=this.game,beforeFen=g.chess.fen(),m=g.chess.move(move);const entry={ply:g.moves.length+1,san:m.san,from:m.from,to:m.to,color:m.color,uci:m.from+m.to+(m.promotion||''),beforeFen,afterFen:g.chess.fen()};g.moves.push(entry);this.setResult();return entry;}
  async start({opponent='stockfish',rating=350,color,levelMode='manual'}={}){
    if(opponent==='generative'&&!this.ai.key)throw new Error('Conecta una clave personal para usar el rival generativo. El rival sin conexión a GPT está disponible sin clave.');
    this.ai.reset();this.game={id:crypto.randomUUID(),chess:new Chess(),human:color||((crypto.getRandomValues(new Uint8Array(1))[0]&1)?'w':'b'),opponent,rating:Math.max(300,Math.min(2000,Number(rating)||350)),levelMode,moves:[],clocks:{w:600000,b:600000},running:null};
    try{await this.engine.init();}catch(e){this.game=null;throw e;}this.runClock('w');
    if(this.game.human==='b'){try{await this.reply();}catch(e){this.game.notice=e.message;}}
    return this.view();
  }
  async reply(){
    const g=this.game;if(this.isOver()||g.chess.turn()===g.human)return;
    this.runClock(g.chess.turn());
    const a=await this.engine.evaluate(g.chess.fen(),{ms:950,multipv:5,history:g.moves.map(m=>m.uci).join(' ')});
    this.syncClock();if(this.isOver())return;
    const candidates=candidateMoves(g.chess,a,g.rating,g.moves.length);let uci;
    if(g.opponent==='generative'){
      this.abort=new AbortController();
      try{
        const text=await this.ai.generate('Juega ajedrez con un principiante. Elige exactamente una jugada UCI de candidates. Crea amenazas coherentes y disputa centro y desarrollo; no hagas regalos deliberados. Adapta complejidad a trainingIndex. Devuelve solo el código de 4 o 5 caracteres.',{fen:g.chess.fen(),trainingIndex:g.rating,candidates,history:g.chess.history().slice(-12)},32,{signal:this.abort.signal});
        uci=(text.toLowerCase().match(/\b[a-h][1-8][a-h][1-8][qrbn]?\b/g)||[]).find(m=>candidates.some(c=>c.uci===m));
        if(!uci)throw new Error('La IA no eligió una alternativa válida. Puedes reintentar su respuesta.');
      }finally{this.abort=null;}
    }else uci=candidates[Math.floor(Math.random()*candidates.length)]?.uci;
    this.syncClock();if(this.isOver())return;
    if(!uci||uci==='(none)')throw new Error('El motor no pudo responder. Reintenta.');
    this.stopClock();this.record({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});if(!this.isOver())this.runClock(g.human);
  }
  async move(data){this.syncClock();const g=this.game;if(this.isOver()||g.chess.turn()!==g.human)throw new Error('Ahora no puedes mover.');
    const validator=new Chess(g.chess.fen());validator.move({from:data.from,to:data.to,promotion:data.promotion||'q'});
    this.stopClock();this.record({from:data.from,to:data.to,promotion:data.promotion||'q'});g.notice=null;
    if(!this.isOver()){try{await this.reply();}catch(e){g.notice=this.isOver()?null:e.message+' Tu jugada quedó confirmada.';}}return this.view();
  }
  async analyzeEntry(entry,ms=1100){
    const g=this.game,history=g.moves.slice(0,entry.ply).map(m=>m.uci);
    const before=await this.engine.evaluate(entry.beforeFen,{ms,history:history.slice(0,-1).join(' ')});
    const after=await this.engine.evaluate(entry.afterFen,{ms,history:history.join(' ')});
    return {...entry,...classify(before,after,entry.uci,before.best),before,after,best:before.best,bestLine:variation(entry.beforeFen,before.pv),playedLine:variation(entry.afterFen,after.pv),whiteCp:after.cp*(new Chess(entry.afterFen).turn()==='w'?1:-1),depth:Math.min(before.depth||0,after.depth||before.depth)};
  }
  async report(reflection){
    const g=this.game;if(!this.isOver())throw new Error('Termina la partida para revisarla.');if(!String(reflection||'').trim())throw new Error('Antes de ver el motor, escribe dónde crees que te equivocaste.');
    if(g.report)return this.view();g.reflection=String(reflection).slice(0,2000);g.reviewed=true;
    const mine=g.moves.filter(m=>m.color===g.human);let done=0;
    for(const m of mine){this.onProgress(`Revisando tu jugada ${++done} de ${mine.length}…`);try{Object.assign(m,await this.analyzeEntry(m));}catch(e){m.analysisError=e.message;m.kind='neutral';m.label='Sin evaluar';}}
    const counts=Object.fromEntries(['blunder','mistake','inaccuracy','good','neutral'].map(k=>[k,mine.filter(m=>m.kind===k).length]));
    const critical=mine.filter(m=>m.loss>=50).sort((a,b)=>b.loss-a.loss).slice(0,3);
    g.exercises=critical.map(m=>({ply:m.ply,fen:m.beforeFen}));
    const result=g.chess.getHeaders().Result;const win=result===(g.human==='w'?'1-0':'0-1'),lost=result===(g.human==='w'?'0-1':'1-0');
    const delta=(win?40:lost?-30:5)-Math.min(20,counts.blunder*5);
    g.report={counts,critical:critical.map(m=>m.ply),missing:mine.filter(m=>m.analysisError).length,source:'Stockfish · revisión local',progress:{before:g.rating,after:Math.max(300,Math.min(2000,g.rating+delta))},text:`En ${mine.length} jugadas propias detecté ${counts.blunder} errores graves, ${counts.mistake} errores y ${counts.inaccuracy} imprecisiones.\n\n${critical.length?'Empieza por la jugada '+Math.ceil(critical[0].ply/2)+(g.human==='w'?'. ':'... ')+critical[0].san+'. Intenta resolver su posición de nuevo antes de mostrar la continuación.':'No hay pérdidas de al menos medio peón entre tus jugadas evaluadas. Puedes revisar tus decisiones seleccionándolas en el registro.'}`};
    if(g.levelMode==='estimate'){
      g.report.estimate=estimateLevel(mine);
      if(g.report.estimate.enough)g.report.progress.after=Math.max(300,Math.min(2000,g.report.estimate.reference));
    }
    if(this.ai.key&&g.opponent==='generative'&&mine.length){
      this.onProgress('Preparando la explicación de IA y los ejercicios…');
      try{g.report.text=await this.ai.generate('Eres un entrenador de ajedrez. Analiza errores para un principiante, en español claro, hasta 380 palabras. Parte de su autoevaluación sin atribuirle pensamientos como hechos. Concéntrate en un error importante y hasta tres momentos críticos reales. Usa solo FEN y variantes verificadas. No inventes amenazas. No reveles las mejores jugadas ni variantes: primero resolverá ejercicios. Indica números de jugada y preguntas concretas. Distingue error táctico y de planificación si hay evidencia. Termina con una tarea breve para la próxima partida. Texto plano.',{human:g.human,reflection:g.reflection,counts,result,moments:critical.map(({before,after,...m})=>m)},850);g.report.source='IA generativa + Stockfish';}catch(e){g.report.warning=e.message+' Se conserva el análisis local sin coste de motor.';}
    }return this.view();
  }
  async explain({ply,reflection}){
    const g=this.game;if(!this.isOver()||!g.reviewed)throw new Error('Primero termina la partida y revisa tus errores.');if(!String(reflection||'').trim())throw new Error('Escribe primero qué respuesta del rival no viste.');
    const m=g.moves.find(m=>m.ply===Number(ply));if(!m)throw new Error('Jugada no disponible.');
    if(!m.before)Object.assign(m,await this.analyzeEntry(m));
    if(!m.explanation)m.explanation=await this.ai.generate('Explica a un principiante esta decisión pasada, en español y hasta 170 palabras. Parte de su reflexión y usa solo las variantes del motor. No inventes amenazas. Distingue hecho de interpretación. Termina con una comprobación que habría evitado el error. Texto plano.',{human:g.human,reflection:String(reflection).slice(0,1000),move:(({before,after,...m})=>m)(m)},400);
    return {text:m.explanation,usage:this.ai.usage()};
  }
  async exercise({ply,from,to,promotion,reason}){
    const g=this.game,x=g.exercises?.find(x=>x.ply===Number(ply));if(!this.isOver()||!g.reviewed||!x)throw new Error('Ejercicio no disponible.');if(!String(reason||'').trim())throw new Error('Escribe qué respondería el rival antes de comprobar.');
    const c=new Chess(x.fen),m=c.move({from,to,promotion:promotion||'q'});const before=await this.engine.evaluate(x.fen,{ms:1800}),after=await this.engine.evaluate(c.fen(),{ms:1800});const grade=classify(before,after,m.from+m.to+(m.promotion||''),before.best);
    x.done=true;x.answer={san:m.san,good:grade.loss<50,...grade,bestLine:variation(x.fen,before.pv),replyLine:variation(c.fen(),after.pv),reason:String(reason).slice(0,1000),afterFen:c.fen()};return this.view();
  }
  async request(route,data={}){
    if(route==='config')return {ai:!!this.ai.key,model:this.ai.model,usage:this.ai.usage()};
    if(route==='connect'){this.ai.configure(data);return {ai:!!this.ai.key,model:this.ai.model,usage:this.ai.usage()};}
    if(route==='state')return this.view();
    if(this.busy)throw new Error('Espera a que termine la operación actual.');this.busy=true;
    try{
      if(route==='new')return await this.start(data);
      if(!this.game)throw new Error('Inicia una partida.');
      if(route==='move')return await this.move(data);
      if(route==='resign'){if(!this.isOver()){this.stopClock();this.game.ended='resign';this.game.loser=this.game.human;this.setResult();}return this.view();}
      if(route==='retry'){this.game.notice=null;try{await this.reply();}catch(e){this.game.notice=e.message;}return this.view();}
      if(route==='offline'){this.game.opponent='stockfish';this.game.notice='Continuas con el rival local. No se consumen tokens para sus movimientos.';await this.reply();return this.view();}
      if(route==='report')return await this.report(data.reflection);
      if(route==='inspect'){
        if(!this.isOver()||!this.game.reviewed)throw new Error('Revisa primero la partida.');
        const m=this.game.moves.find(m=>m.ply===Number(data.ply));if(!m)throw new Error('Jugada no disponible.');
        if(!m.before)Object.assign(m,await this.analyzeEntry(m));return this.view();
      }
      if(route==='explain')return await this.explain(data);
      if(route==='exercise')return await this.exercise(data);
      if(route==='retryExercise'){
        const x=this.game.exercises?.find(x=>x.ply===Number(data.ply));if(!this.isOver()||!x)throw new Error('Ejercicio no disponible.');
        x.done=false;x.answer=null;return this.view();
      }
      throw new Error('Operación no disponible.');
    }finally{this.busy=false;}
  }
}
