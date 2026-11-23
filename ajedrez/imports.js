import {Chess} from './vendor/chess.js';
import {classify,variation,puzzleLength} from './core.js?v=move-replay';
import {localReview,exerciseFeedback,replyFacts} from './learning.js?v=move-replay';
import {patternForMove} from './training.js';
export const THEMES={king:{en:'King safety',es:'Seguridad del rey'},pieces:{en:'Exposed material',es:'Material expuesto'},captures:{en:'Missed captures',es:'Capturas omitidas'},calculation:{en:'Calculate the reply',es:'Calcular la respuesta'},mate:{en:'Mating opportunities',es:'Oportunidades de mate'},fork:{en:'Double attacks',es:'Ataques dobles'},development:{en:'Opening decisions',es:'Decisiones de apertura'},forcing:{en:'Forcing moves',es:'Jugadas forzantes'}};
export const HABITS={
 king:{en:'Before moving, list your opponent’s checks and verify how your king can respond.',es:'Antes de mover, enumera los jaques del rival y comprueba cómo puede responder tu rey.'},
 pieces:{en:'Check which of your pieces are attacked, how many defenders they have and what happens after a capture.',es:'Comprueba qué piezas tuyas están atacadas, cuántos defensores tienen y qué ocurre tras una captura.'},
 captures:{en:'Before choosing a quiet move, look through your legal captures and calculate the strongest reply.',es:'Antes de elegir una jugada tranquila, revisa tus capturas legales y calcula la respuesta más fuerte.'},
 calculation:{en:'Name one concrete opponent reply before committing to your idea. Compare at least two candidate moves.',es:'Nombra una respuesta concreta del rival antes de decidir tu idea. Compara al menos dos jugadas candidatas.'},
 mate:{en:'When the opposing king is exposed, inspect your checks before collecting material. Verify all legal escapes.',es:'Cuando el rey rival esté expuesto, revisa tus jaques antes de ganar material. Comprueba todas las escapatorias legales.'},
 fork:{en:'Look for moves that attack two targets at once. Check whether either target can move with tempo.',es:'Busca jugadas que ataquen dos objetivos a la vez. Comprueba si alguno puede retirarse ganando un tiempo.'},
 development:{en:'In the opening, compare your idea with developing a minor piece and improving its activity.',es:'En la apertura, compara tu idea con desarrollar una pieza menor y mejorar su actividad.'},
 forcing:{en:'Compare checks, captures and direct threats first, then calculate the opponent’s best response.',es:'Compara primero jaques, capturas y amenazas directas; después calcula la mejor respuesta del rival.'},
};
const moveUci=(c,u)=>c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
export function detectPattern(m){
 try{
  const c=new Chess(m.beforeFen),best=moveUci(c,m.best||m.before.pv[0]),reply=replyFacts(m.afterFen,m.after?.pv?.[0]);
  if(c.isCheckmate())return 'mate';
  if(reply?.check)return 'king';if(reply?.capture)return 'pieces';
  const targets=c.board().flat().filter(p=>p&&p.color!==best.color&&['q','r','k','n','b'].includes(p.type)&&c.attackers(p.square,best.color).includes(best.to));
  const root=new Chess(m.beforeFen),newTarget=targets.some(p=>!root.attackers(p.square,best.color).includes(best.from)),forcingTarget=targets.some(p=>p.type==='k'||!c.isAttacked(p.square,p.color));
  if(targets.length>=2&&newTarget&&forcingTarget)return 'fork';if(best.captured&&!m.san.includes('x'))return 'captures';if(c.isCheck()&&!/[+#]/.test(m.san))return 'forcing';
  if(m.ply<=16&&['n','b'].includes(best.piece)&&['b1','g1','c1','f1','b8','g8','c8','f8'].includes(best.from))return 'development';
 }catch{}
 return patternForMove(m);
}
export function normalizePgn(text){return String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/\\[ \t]*\n/g,'\n').replace(/\\(?=\[)/g,'\n').replace(/(\d+)\\\./g,'$1.').trim();}
function fingerprint(value){let hash=14695981039346656037n;for(const c of value){hash^=BigInt(c.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}return hash.toString(16).padStart(16,'0');}
export function parseGame(text,{username='',side='auto',elo}={}){
 const pgn=normalizePgn(text);if(!pgn||pgn.length>250000)throw new Error('Paste one PGN game (maximum 250 KB). / Pega una partida PGN (máximo 250 KB).');
 if((pgn.match(/\[Event\s/g)||[]).length>1||(pgn.match(/\[White\s/g)||[]).length>1)throw new Error('Import one game at a time. / Importa una partida a la vez.');
 const c=new Chess();try{c.loadPgn(pgn);}catch(e){throw new Error('Invalid PGN / PGN inválido: '+e.message);}
 const history=c.history({verbose:true});if(!history.length||history.length>1000)throw new Error('The PGN must contain 1–1000 legal half-moves. / El PGN debe tener 1–1000 medias jugadas legales.');
 const headers=c.getHeaders(),name=username.trim().toLowerCase();let human=side;
 if(!['w','b'].includes(human)){const white=String(headers.White||'').toLowerCase()===name,black=String(headers.Black||'').toLowerCase()===name;if(!name||white===black)throw Object.assign(new Error('Choose your color or enter the exact player name. / Elige tu color o escribe el nombre exacto del jugador.'),{field:'side',headers});human=white?'w':'b';}
 const headerElo=Number(headers[human==='w'?'WhiteElo':'BlackElo']),hasElo=Number.isFinite(headerElo)&&headerElo>=100&&headerElo<=3500;const reference=hasElo?headerElo:Number(elo);if(!Number.isFinite(reference)||reference<100||reference>3500)throw Object.assign(new Error('This PGN has no valid player Elo. Enter your Elo (100–3500). / El PGN no tiene un Elo válido; ingresa tu Elo (100–3500).'),{field:'eloFallback',headers});
 const initialFen=history[0].before,root=new Chess(initialFen);const moves=history.map((m,i)=>{const beforeFen=root.fen(),played=root.move(m.san);return {ply:i+1,san:played.san,from:played.from,to:played.to,color:played.color,uci:played.lan,beforeFen,afterFen:root.fen()};});
 const result=headers.Result||'*',date=headers.Date||'',white=headers.White||'White',black=headers.Black||'Black';
 const id='g-'+fingerprint(JSON.stringify([initialFen,white.toLowerCase(),black.toLowerCase(),date,human,moves.map(m=>m.uci)]));
 return {id,pgn:c.pgn(),headers,initialFen,finalFen:c.fen(),human,white,black,date,result,elo:reference,eloSource:hasElo?'pgn':'manual',moves,importedAt:new Date().toISOString(),status:'imported'};
}
export class ImportedAnalyzer{
 constructor(engine){this.engine=engine;}
 async analyze(game,{ms=850,signal,onProgress=()=>{}}={}){
  const result=structuredClone(game),mine=result.moves.filter(m=>m.color===result.human);let done=0;
  await this.engine.init();
  for(const m of mine){
   if(signal?.aborted)throw new DOMException('Analysis cancelled / Análisis cancelado','AbortError');
   if(!m.before||!m.after){
    const history=result.moves.slice(0,m.ply).map(m=>m.uci);
    try{
     const before=await this.engine.evaluate(m.beforeFen,{ms,multipv:1,history:history.slice(0,-1).join(' '),initialFen:result.initialFen});
     if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
     const after=await this.engine.evaluate(m.afterFen,{ms,multipv:1,history:history.join(' '),initialFen:result.initialFen});
     if(!Number.isFinite(before.cp)||!Number.isFinite(after.cp)||!before.best)throw new Error('Incomplete engine analysis.');
     const check=new Chess(m.beforeFen);moveUci(check,before.best);
     Object.assign(m,classify(before,after,m.uci,before.best),{before,after,best:before.best,bestLine:variation(m.beforeFen,before.pv||[]),playedLine:variation(m.afterFen,after.pv||[]),depth:Math.min(before.depth||0,after.depth||0)});m.pattern=detectPattern(m);delete m.analysisError;
    }catch(e){if(e.name==='AbortError')throw e;m.analysisError=e.message;m.kind='neutral';delete m.loss;}
   }
   onProgress({done:++done,total:mine.length,percent:Math.round(done/mine.length*100),move:m});
  }
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const counts=Object.fromEntries(['blunder','mistake','inaccuracy','good','neutral'].map(k=>[k,mine.filter(m=>m.kind===k).length]));
  result.report={counts,missing:mine.filter(m=>!Number.isFinite(m.loss)).length,texts:{en:localReview(mine,counts,'en'),es:localReview(mine,counts,'es')},evaluated:mine.filter(m=>Number.isFinite(m.loss)).length};
  result.analyzedAt=new Date().toISOString();result.status=result.report.missing?'partial':'analyzed';return result;
 }
}
export function makePuzzles(game,{max=3,maxSteps='adaptive',weaknesses=[]}={}){
 if(!game.report)throw new Error('Analyze the game first. / Analiza la partida primero.');
 const cap=maxSteps==='adaptive'?(game.elo<600?2:game.elo<1100?3:4):Math.max(1,Math.min(4,Number(maxSteps)||2));
 const issues=game.moves.filter(m=>m.color===game.human&&Number.isFinite(m.loss)&&m.loss>=50&&m.kind!=='neutral'&&m.before?.cp>-500&&m.before?.pv?.length);
 const weight=m=>(m.pattern==='mate'?500:Math.min(m.loss,600)*(m.before.cp>800?.2:1))+Math.min(120,(weaknesses.find(w=>w.id===(m.pattern||patternForMove(m)))?.count||0)*25);
 const selected=[],remaining=[...issues];
 for(const weak of weaknesses.filter(w=>w.count>=2).slice(0,2)){const candidates=remaining.filter(m=>(m.pattern||patternForMove(m))===weak.id).sort((a,b)=>weight(b)-weight(a)||a.ply-b.ply);if(candidates.length&&selected.length<Math.min(3,max)){selected.push(candidates[0]);remaining.splice(remaining.indexOf(candidates[0]),1);}}
 while(selected.length<Math.min(3,max)&&remaining.length){const rank=m=>weight(m)-selected.filter(p=>(p.pattern||patternForMove(p))===(m.pattern||patternForMove(m))).length*400;remaining.sort((a,b)=>rank(b)-rank(a)||a.ply-b.ply);selected.push(remaining.shift());}
 return selected.map(m=>{
  const c=new Chess(m.beforeFen),first=moveUci(c,m.before.pv[0]);const prior=game.moves.find(p=>p.ply===m.ply-1),targetSteps=Math.min(cap,puzzleLength(m.beforeFen,m.before.pv));
  const solution=m.before.pv.slice(0,targetSteps*2-1),pattern=first.san.includes('#')?'mate':m.pattern||patternForMove(m);
  return {id:game.id+':'+m.ply,gameId:game.id,ply:m.ply,fen:m.beforeFen,human:game.human,targetSteps,solution,pattern,loss:m.loss,kind:m.kind,elo:game.elo,createdAt:new Date().toISOString(),dueAt:Date.now(),stage:0,lapses:0,attempts:[],reviews:[],beforeOpponentFen:prior?.beforeFen||null,opponentMove:prior?{from:prior.from,to:prior.to,san:prior.san,color:prior.color}:null,original:structuredClone(m)};
 });
}
export class PuzzleRunner{
 constructor(puzzle,engine,{now=()=>Date.now()}={}){this.puzzle=puzzle;this.engine=engine;this.now=now;this.id=crypto.randomUUID();this.fen=puzzle.fen;this.step=0;this.done=false;this.failed=false;this.assisted=false;this.answer=null;this.hintSquare=null;this.cache=null;this.attempts=[];}
 restart(){this.fen=this.puzzle.fen;this.step=0;this.done=false;this.answer=null;this.hintSquare=null;this.cache=null;}
 async hint(){if(this.done)throw new Error('Puzzle already solved.');const analysis=this.cache?.fen===this.fen?this.cache.analysis:await this.engine.evaluate(this.fen,{ms:1300});const c=new Chess(this.fen),m=moveUci(c,analysis.best);this.cache={fen:this.fen,analysis};this.assisted=true;this.hintSquare=m.from;return this.hintSquare;}
 async move(uci){
  if(this.done)throw new Error('Puzzle already solved.');const fromFen=this.fen,c=new Chess(fromFen),m=moveUci(c,uci),afterFen=c.fen();
  const before=this.cache?.fen===fromFen?this.cache.analysis:await this.engine.evaluate(fromFen,{ms:1300}),after=await this.engine.evaluate(afterFen,{ms:1300});
  if(!Number.isFinite(before.cp)||!Number.isFinite(after.cp)||!before.best)throw new Error('Could not validate this move. / No se pudo validar la jugada.');
  const grade=classify(before,after,uci,before.best),good=grade.loss<50;let reply=null;
  if(good&&this.step+1<this.puzzle.targetSteps&&!c.isGameOver()){const played=moveUci(c,after.best||after.pv?.[0]);reply={from:played.from,to:played.to,san:played.san,color:played.color};}
  const feedbackTexts=Object.fromEntries(['en','es'].map(language=>[language,exerciseFeedback({san:m.san,good,move:m,afterFen,after,original:this.step===0?this.puzzle.original:null,language})]));
  if(good&&new Chess(afterFen).isCheckmate()){feedbackTexts.en+='\n\nCheckmate: the king is in check and your opponent has no legal move.';feedbackTexts.es+='\n\nEs jaque mate: el rey está en jaque y tu rival no tiene ninguna jugada legal.';}
  if(!good&&before.cp>90000&&after.cp>=-90000){feedbackTexts.en+='\n\nThere was a forced mating sequence for you here. This attempt missed it. Look for forcing checks.';feedbackTexts.es+='\n\nAquí tenías una secuencia de mate forzado. Este intento la dejó pasar. Busca jaques forzantes.';}
  const attempt={id:crypto.randomUUID(),runId:this.id,at:new Date(this.now()).toISOString(),step:this.step+1,uci,san:m.san,fen:fromFen,good,hinted:this.assisted,loss:grade.loss,feedbackTexts};this.attempts.push(attempt);
  if(good){this.step++;this.fen=c.fen();this.done=this.step>=this.puzzle.targetSteps||c.isGameOver();this.hintSquare=null;this.cache=null;}else this.failed=true;
  this.answer={...attempt,from:m.from,to:m.to,color:m.color,afterFen,counterplay:after.pv?.length?after.pv:[after.best].filter(Boolean),reply,done:this.done};return this.answer;
 }
}
