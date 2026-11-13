import {Chess} from './vendor/chess.js';
import {replyFacts} from './learning.js';
export const PATTERNS={
 king:{label:'Seguridad del rey',cue:'Revisar los jaques del rival antes de ejecutar tu idea.'},
 pieces:{label:'Piezas expuestas',cue:'Comprobar qué piezas tuyas quedan atacadas y sin defensa.'},
 captures:{label:'Aprovechar capturas',cue:'Revisar las capturas disponibles y la respuesta posterior.'},
 calculation:{label:'Respuesta del rival',cue:'Imaginar una respuesta concreta antes de decidir.'},
};
const DAY=86400000,RETRY=10*60000,INTERVALS=[1,3,7,14,30,60];
const uciMove=(c,uci)=>c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
export function patternForMove(m){
 const reply=replyFacts(m.afterFen,m.after?.pv?.[0]);if(reply?.check)return 'king';if(reply?.capture)return 'pieces';
 try{const c=new Chess(m.beforeFen);if(m.best&&uciMove(c,m.best)?.captured)return 'captures';}catch{}
 return 'calculation';
}
function ringPressure(c,color){
 const king=c.board().flat().find(p=>p?.type==='k'&&p.color===color);if(!king)return 0;
 const file=king.square.charCodeAt(0)-97,rank=Number(king.square[1]),enemy=color==='w'?'b':'w';let score=0;
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){const f=file+x,r=rank+y;if(f<0||f>7||r<1||r>8)continue;if(c.isAttacked(String.fromCharCode(97+f)+r,enemy))score++;}return score;
}
export function candidateTraining(fen,candidate,target){
 if(!target||!PATTERNS[target.id])return {score:0,opportunity:false,signals:[]};
 try{
  const c=new Chess(fen),bot=c.turn();const beforePressure=ringPressure(c,bot==='w'?'b':'w');uciMove(c,candidate.uci);const human=c.turn();
  if(target.id==='king'){
   if(c.isCheck())return {score:10,opportunity:!c.isGameOver(),signals:['El rival da jaque con '+candidate.san+'.']};
   const increase=ringPressure(c,human)-beforePressure;
   return {score:Math.max(0,increase)*.35,opportunity:false,signals:increase>0?['Aumenta la presión sobre casillas próximas al rey.']:[]};
  }
  if(target.id==='pieces'){
   const exposed=c.board().flat().filter(p=>p&&p.color===human&&['n','b','r','q'].includes(p.type)&&c.isAttacked(p.square,bot)&&!c.isAttacked(p.square,human));
   return {score:exposed.length*8,opportunity:exposed.length>0&&!c.isGameOver(),signals:exposed.map(p=>'Tu pieza en '+p.square+' está atacada y no tiene un defensor directo.')};
  }
  if(target.id==='captures'){
   const response=candidate.pv?.[1];if(!response)return {score:0,opportunity:false,signals:[]};
   const best=uciMove(c,response);return {score:best.captured?6:0,opportunity:!!best.captured,signals:best.captured?['La respuesta calculada '+best.san+' incluye una captura.']:[]};
  }
  const response=candidate.pv?.[1],counter=candidate.pv?.[2];if(!response||!counter)return {score:0,opportunity:false,signals:[]};
  uciMove(c,response);const m=uciMove(c,counter),tactical=!!m.captured||c.isCheck();
  return {score:tactical?4:0,opportunity:tactical,signals:tactical?['En la variante calculada, la respuesta posterior '+m.san+' da jaque o captura.']:[]};
 }catch{return {score:0,opportunity:false,signals:[]};}
}

export class TrainingProfile{
 constructor(saved={}){
  this.version=1;this.patterns={};this.seen=Array.isArray(saved?.seen)?saved.seen.filter(x=>typeof x==='string').slice(-4000):[];this.reports=saved?.reports&&typeof saved.reports==='object'&&!Array.isArray(saved.reports)?saved.reports:{};
  for(const id of Object.keys(PATTERNS)){const raw=saved?.patterns?.[id];if(!raw||typeof raw!=='object')continue;const item=this.item(id,Date.now());for(const key of ['mistakes','exerciseGood','exerciseBad','gameGood','gameBad','stage','dueAt'])if(Number.isFinite(raw[key])&&raw[key]>=0)item[key]=raw[key];item.stage=Math.min(6,Math.floor(item.stage));item.history=Array.isArray(raw.history)?raw.history.slice(-200):[];}
 }
 export(){return {version:this.version,patterns:this.patterns,seen:this.seen.slice(-4000),reports:this.reports};}
 item(id,now){return this.patterns[id]||=( {id,mistakes:0,exerciseGood:0,exerciseBad:0,gameGood:0,gameBad:0,stage:0,dueAt:now,history:[]} );}
 seenEvent(id){if(this.seen.includes(id))return true;this.seen.push(id);if(this.seen.length>4000)this.seen.splice(0,this.seen.length-4000);return false;}
 addHistory(item,event){item.history.push(event);if(item.history.length>200)item.history.splice(0,item.history.length-200);}
 target(now=Date.now()){
  return Object.values(this.patterns).filter(p=>PATTERNS[p.id]&&p.mistakes>0&&p.dueAt<=now).sort((a,b)=>((b.mistakes+b.exerciseBad+b.gameBad*2)/(1+b.gameGood))-((a.mistakes+a.exerciseBad+a.gameBad*2)/(1+a.gameGood))||a.dueAt-b.dueAt).map(p=>({id:p.id,...PATTERNS[p.id],dueAt:p.dueAt,stage:p.stage}))[0]||null;
 }
 exercise(move,attempt,session,now=Date.now()){
  const id=patternForMove(move),eventId=session+':'+move.ply+':'+attempt.number;if(this.seenEvent(eventId))return;
  const item=this.item(id,now);if(attempt.good)item.exerciseGood++;else{item.exerciseBad++;item.stage=0;item.dueAt=Math.min(item.dueAt,now+RETRY);}
  this.addHistory(item,{at:now,type:'exercise',good:attempt.good,session});
  // Un acierto inmediato en un ejercicio no demuestra retención en partida.
 }
 review(game,now=Date.now()){
  if(this.reports[game.id])return this.reports[game.id];
  const mine=game.moves.filter(m=>m.color===game.human);
  const errors=mine.filter(m=>Number.isFinite(m.loss)&&m.loss>=50&&m.kind!=='neutral');
  for(const m of errors){
   const id=patternForMove(m);if(this.seenEvent(game.id+':mistake:'+m.ply))continue;
   const item=this.item(id,now);item.mistakes++;item.stage=0;item.dueAt=now;this.addHistory(item,{at:now,type:'original-error',good:false,ply:m.ply,session:game.id});
  }
  const target=game.trainingTarget,opportunities=mine.filter(m=>m.challenge&&Number.isFinite(m.loss)&&m.kind!=='neutral');
  for(const m of opportunities){
   if(this.seenEvent(game.id+':opportunity:'+m.ply))continue;const item=this.item(m.challenge.id,now),good=m.loss<50;
   if(good)item.gameGood++;else item.gameBad++;
   this.addHistory(item,{at:now,type:'game',good,ply:m.ply,session:game.id,evidence:m.challenge.signals});
  }
  let summary={opportunities:0,good:0,bad:0,text:'Tu historial se utilizará para orientar al rival en partidas nuevas.'};
  if(target&&PATTERNS[target.id]){
   const item=this.item(target.id,now),matches=opportunities.filter(m=>m.challenge.id===target.id),bad=matches.filter(m=>m.loss>=50).length,good=matches.length-bad;
   summary={pattern:target.id,opportunities:matches.length,good,bad,dueAt:item.dueAt};
   const otherErrors=errors.filter(m=>patternForMove(m)===target.id&&!matches.includes(m)).length;
   if(bad||otherErrors){item.stage=0;item.dueAt=now+RETRY;summary.text=`${PATTERNS[target.id].label}: hubo ${matches.length} oportunidades comprobables y ${bad} respuestas con pérdida de evaluación.`+(otherErrors?` También detecté ${otherErrors} errores del mismo patrón en otras decisiones.`:'')+' El patrón volverá a priorizarse en 10 minutos.';}
   else if(good>=2&&target.dueAt<=now){const days=INTERVALS[Math.min(item.stage,INTERVALS.length-1)];item.stage=Math.min(item.stage+1,INTERVALS.length);item.dueAt=now+days*DAY;summary.text=`${PATTERNS[target.id].label}: respondiste bien en ${good} oportunidades de esta partida. El próximo repaso se programa en ${days} ${days===1?'día':'días'}. Es una señal de mejora, no una garantía de dominio.`;}
   else summary.text=`${PATTERNS[target.id].label}: ${matches.length?`${good} respuestas buenas de ${matches.length} oportunidades.`:'No apareció una oportunidad comprobable en esta partida.'} El repaso sigue pendiente; no se cuenta una mejora por ganar la partida.`;
   summary.dueAt=item.dueAt;
  }
  this.reports[game.id]=summary;const ids=Object.keys(this.reports);if(ids.length>300)delete this.reports[ids[0]];return summary;
 }
 stats(now=Date.now()){
  return Object.values(this.patterns).filter(p=>PATTERNS[p.id]).map(p=>({id:p.id,label:PATTERNS[p.id].label,cue:PATTERNS[p.id].cue,mistakes:p.mistakes,exerciseGood:p.exerciseGood,exerciseBad:p.exerciseBad,gameGood:p.gameGood,gameBad:p.gameBad,stage:p.stage,dueAt:p.dueAt,due:p.dueAt<=now,accuracy:p.gameGood+p.gameBad?p.gameGood/(p.gameGood+p.gameBad):null}));
 }
}
