import {Chess,SQUARES} from './vendor/chess.js';
const names={p:'peón',n:'caballo',b:'alfil',r:'torre',q:'dama',k:'rey'};
const englishNames={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const pieceValues={p:1,n:3,b:3,r:5,q:9,k:0};
const article=piece=>piece==='q'||piece==='r'?'la':'el';
const centerSquares=['d4','e4','d5','e5'];
function pieceOn(piece,square,en){
 return en?`the ${englishNames[piece]} on ${square}`:`${article(piece)} ${names[piece]} de ${square}`;
}
export function replayLine(fen,moves,maxPlies=7){
 let board;
 try{board=new Chess(fen);}catch{return [];}
 const line=[];
 for(const uci of moves.slice(0,maxPlies)){
  if(typeof uci!=='string')break;
  try{
   const move=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
   line.push({
    san:move.san,from:move.from,to:move.to,color:move.color,piece:move.piece,
    captured:move.captured,captureSquare:move.isEnPassant()?move.to[0]+move.from[1]:move.to,
    promotion:move.promotion,before:move.before,fen:board.fen(),check:board.isCheck(),mate:board.isCheckmate()
   });
  }catch{break;}
  if(board.isGameOver())break;
 }
 return line;
}
export function replayLessonLine(fen,moves){
 const line=replayLine(fen,moves,64);
 return line.at(-1)?.mate?line:line.slice(0,7);
}
export function moveDescription(move,human,language='es'){
 const yours=move.color===human,en=language==='en';
 const pieces=en?englishNames:names;
 const actor=en?(yours?'You':'Your opponent'):(yours?'Tú':'El rival');
 if(move.mate)return en?`${actor} deliver${yours?'':'s'} checkmate with ${move.san}.`:`${actor} ${yours?'das':'da'} jaque mate con ${move.san}.`;
 const action=move.captured
  ?en?`capture${yours?'':'s'} ${pieceOn(move.captured,move.captureSquare||move.to,en)}`:`${yours?'capturas':'captura'} ${pieceOn(move.captured,move.captureSquare||move.to,en)}`
  :en?`move${yours?'':'s'} the ${pieces[move.piece]} from ${move.from} to ${move.to}`
   :`${yours?'mueves':'mueve'} ${article(move.piece)} ${pieces[move.piece]} de ${move.from} a ${move.to}`;
 const check=move.check?(en?' with check':' y da'+(yours?'s':'')+' jaque'):'';
 return actor+' '+action+check+'.';
}
function materialInLine(line,human){
 return line.reduce((total,move)=>{
  const change=(pieceValues[move.captured]||0)+(move.promotion?pieceValues[move.promotion]-1:0);
  return total+(move.color===human?change:-change);
 },0);
}
export function explainReplay(line,human,language='es'){
 const en=language==='en';
 const last=line.at(-1);
 if(last?.mate){
  const board=new Chess(last.fen);
  const king=board.board().flat().find(piece=>piece?.type==='k'&&piece.color===board.turn());
  const [from,second]=board.attackers(king.square,last.color);
  const checker=!second&&from?board.get(from):null;
  const detail=checker
   ?(en?`The ${englishNames[checker.type]} on ${from} checks the king on ${king.square}, which has no way out.`:`Desde ${from}, ${article(checker.type)} ${names[checker.type]} da jaque al rey de ${king.square}, que no tiene salida.`)
   :(en?`The king on ${king.square} has no way out of check.`:`El rey de ${king.square} no tiene cómo salir del jaque.`);
  return moveDescription(last,human,language)+' '+detail;
 }
 const balance=materialInLine(line,human);
 const memorable=line.find(move=>move.captured&&move.color===(balance<0?(human==='w'?'b':'w'):human));
 if(balance&&memorable){
  const points=Math.abs(balance),value=en?(points===1?'one pawn':'about '+points+' pawns'):(points===1?'un peón':'unos '+points+' peones');
  const difference=balance>0?(en?'you gain':'ganas'):(en?'you give up':'pierdes');
  return moveDescription(memorable,human,language)+' '+(en?`After these moves, ${difference} material worth ${value}.`:`Tras estas jugadas, ${difference} material por valor de ${value}.`);
 }
 const threat=line.find(move=>move.color!==human&&(move.check||move.captured))||line.find(move=>move.color!==human);
 if(threat)return moveDescription(threat,human,language);
 return last?moveDescription(last,human,language):'';
}
export function missedOpportunity(line,alternative,human,language='es'){
 const en=language==='en',mate=alternative.at(-1),missedMate=mate?.mate&&mate.color===human&&!(line.at(-1)?.mate&&line.at(-1)?.color===human);
 if(missedMate)return alternative.length===1
  ?(en?'You had checkmate in one from the starting position.':'En la posición inicial tenías jaque mate en una jugada.')
  :(en?'The alternative shows a sequence that ends in checkmate for you.':'La alternativa muestra una secuencia que termina en jaque mate a tu favor.');
 if(alternative.length>1&&materialInLine(alternative,human)>Math.max(0,materialInLine(line,human)))
  return en?'The alternative wins more material in the lines shown.':'En las variantes mostradas, la alternativa gana más material.';
 return '';
}
function targetsGained(move,board,old){
 return board.board().flat().filter(piece=>piece&&piece.color===board.turn()&&piece.type!=='k'&&
  board.attackers(piece.square,move.color).includes(move.to)&&!old.attackers(piece.square,move.color).includes(move.from)
 ).sort((a,b)=>pieceValues[b.type]-pieceValues[a.type]).slice(0,2);
}
function newTargets(move,board,language){
 if(!move?.before)return '';
 const en=language==='en',pieces=en?englishNames:names;
 const targets=targetsGained(move,board,new Chess(move.before));
 if(!targets.length)return '';
 const list=new Intl.ListFormat(language).format(targets.map(piece=>en?`the ${pieces[piece.type]} on ${piece.square}`:`${article(piece.type)} ${pieces[piece.type]} en ${piece.square}`));
 return en?`From ${move.to}, your ${pieces[move.piece]} now attacks ${list}.`:`Desde ${move.to}, tu ${pieces[move.piece]} ahora ataca ${list}.`;
}
function positionalIdea(move,board,language){
 if(!move||board.isGameOver())return '';
 const en=language==='en';
 if(board.isCheck())return en
  ?'You give check, so your opponent has to deal with the threat before carrying out their own plan.'
  :'Das jaque. El rival tiene que resolverlo antes de seguir con su propio plan.';
 const center=centerSquares.filter(square=>board.attackers(square,move.color).includes(move.to));
 if(!center.length)return '';
 const squares=new Intl.ListFormat(language).format(center);
 return en
  ?`From ${move.to}, your ${englishNames[move.piece]} controls ${squares} in the center.`
  :`Desde ${move.to}, tu ${names[move.piece]} controla ${squares} en el centro.`;
}
function coveredEscape(board,king,checker,color){
 return SQUARES.find(square=>square!==king.square&&
  Math.abs(square.charCodeAt(0)-king.square.charCodeAt(0))<=1&&
  Math.abs(Number(square[1])-Number(king.square[1]))<=1&&
  board.get(square)?.color!==king.color&&board.attackers(square,color).includes(checker));
}
export function replayCoachStep(line,index,human,language='es'){
 const en=language==='en',move=line[index-1],next=line[index];
 if(!move)return {
  source:next?.from,targets:[],
  title:en?'Start with the circled piece':'Empieza por la pieza marcada',
  text:en?`Find ${pieceOn(next.piece,next.from,en)}. Press Next move to see what changes.`:`Busca ${pieceOn(next.piece,next.from,en)}. Pulsa Avanzar para ver qué cambia.`
 };
 const board=new Chess(move.fen),old=new Chess(move.before);
 const source=move.to,description=moveDescription(move,human,language);
 if(move.check){
  const king=board.board().flat().find(piece=>piece?.type==='k'&&piece.color===board.turn());
  const [checker]=board.attackers(king.square,move.color);
  const targets=[king.square];
  const title=move.mate?(en?'No escape':'El rey no tiene salida'):(en?'Find the king in check':'Mira al rey en jaque');
  if(move.mate){
   const escape=checker&&coveredEscape(board,king,checker,move.color);
   if(escape)targets.push(escape);
   const detail=escape?(en?` Look at ${escape}. The marked attacker also covers that escape square.`:` Fíjate en ${escape}. La pieza atacante también cubre esa salida.`):'';
   return {source:checker||source,targets,title,text:explainReplay([move],human,language)+detail};
  }
  let response=en?'The side in check must deal with it first.':'El lado que recibe el jaque tiene que resolverlo primero.';
  if(next){
   targets.push(next.to);
   const defender=pieceOn(next.piece,next.from,en);
   if(next.captured)response=en?`Look at ${next.to}. ${defender} can capture there to get out of check.`:`Mira ${next.to}. Ahí puede capturar ${defender} para resolver el jaque.`;
   else if(next.piece==='k')response=en?`The king can escape to ${next.to}.`:`El rey puede escapar a ${next.to}.`;
   else response=en?`Look at ${next.to}. ${defender} can block the check there.`:`Mira ${next.to}. Ahí puede tapar el jaque ${defender}.`;
  }
  return {source:checker||source,targets:targets.filter(square=>square!==(checker||source)),title,text:description+' '+response};
 }
 if(next?.check){
  const king=board.board().flat().find(piece=>piece?.type==='k'&&piece.color===move.color);
  const attacker=pieceOn(next.piece,next.from,en);
  const threat=next.mate
   ?(en?`If ${attacker} plays ${next.san}, the marked king will be in checkmate.`:`Si ${attacker} juega ${next.san}, el rey marcado queda en jaque mate.`)
   :(en?`If ${attacker} plays ${next.san}, the marked king comes under check.`:`Si ${attacker} juega ${next.san}, el rey marcado queda en jaque.`);
  return {source:next.from,targets:[king.square],title:en?'See the check coming':'Anticipa el jaque',text:description+' '+threat};
 }
 if(next?.captured){
  const victimSquare=next.captureSquare;
  const lostCover=old.attackers(victimSquare,move.color).includes(move.from)&&!board.attackers(victimSquare,move.color).length;
  const actor=pieceOn(next.piece,next.from,en),victim=pieceOn(next.captured,victimSquare,en);
  const risk=en?`Follow ${actor}. It can take ${victim} on the next move.`:`Sigue ${actor}. Puede capturar ${victim} en la jugada siguiente.`;
  const cover=lostCover?(en?' That piece lost its defender.':' Esa pieza se quedó sin defensa.'):'';
  return {source:next.from,targets:[victimSquare],title:en?'Spot the next capture':'Encuentra la próxima captura',text:description+' '+risk+cover};
 }
 if(move.captured){
  const recapture=board.moves({verbose:true}).some(reply=>reply.to===source&&reply.captured);
  const text=en
   ?recapture?'Check what can take back before counting the gain.':'There is no immediate recapture on the marked square.'
   :recapture?'Fíjate en quién puede recuperar la pieza antes de contar la ganancia.':'No hay una recaptura inmediata en la casilla marcada.';
  return {source,targets:[],title:en?'Look at the exchange':'Mira el intercambio',text:description+' '+text};
 }
 const newTargets=targetsGained(move,board,old);
 if(newTargets.length){
  const squares=newTargets.map(piece=>piece.square);
  const pieces=new Intl.ListFormat(language).format(newTargets.map(piece=>pieceOn(piece.type,piece.square,en)));
  return {source,targets:squares,title:en?'Follow the new attack':'Sigue el nuevo ataque',text:en?`The circled piece now attacks ${pieces}. Look for a way those pieces could be defended.`:`La pieza marcada ahora ataca ${pieces}. Fíjate en cómo se podrían defender.`};
 }
 const gained=centerSquares.filter(square=>board.attackers(square,move.color).includes(source)&&!old.attackers(square,move.color).length);
 const lost=centerSquares.filter(square=>old.attackers(square,move.color).includes(move.from)&&!board.attackers(square,move.color).length&&board.attackers(square,board.turn()).length);
 const changed=lost.length?lost:gained;
 if(changed.length){
  const targets=changed.slice(0,2),squares=new Intl.ListFormat(language).format(targets);
  const text=lost.length
   ?(en?`This side gives up control of ${squares}. The other side still attacks there.`:`Este lado deja de controlar ${squares}. El otro todavía ataca esas casillas.`)
   :(en?`The marked piece now controls ${squares} in the center.`:`La pieza marcada ahora controla ${squares} en el centro.`);
  return {source,targets,title:en?'Watch the center squares':'Fíjate en el centro',text};
 }
 return {source,targets:[],title:en?'Follow the moving piece':'Sigue la pieza que se mueve',text:description};
}
export function compareReplayLines(original,alternative,human,language='es'){
 const en=language==='en';
 if(!alternative.length)return '';
 const missed=missedOpportunity(original,alternative,human,language);
 if(alternative.at(-1)?.mate&&alternative.at(-1).color===human&&missed)return missed;
 const mate=original.at(-1);
 if(mate?.mate&&mate.color!==human&&!(alternative.at(-1)?.mate&&alternative.at(-1)?.color!==human))
  return en?'Your move allows the mate shown here. In the alternative line, your king stays in play.':'Tu jugada permite el mate que ves aquí. En la secuencia alternativa, tu rey sigue en juego.';
 const old=materialInLine(original,human),better=materialInLine(alternative,human);
 if(better<=old){
  const reply=original[1];
  if(!reply?.captured)return '';
  const nextBoard=new Chess(alternative[0].fen);
  const stillHangs=nextBoard.moves({verbose:true}).some(move=>move.to===reply.to&&move.captured===reply.captured);
  if(stillHangs)return '';
  const victim=pieceOn(reply.captured,reply.captureSquare,en);
  return en?`Your move allows the opponent to take ${victim}. The alternative takes away that immediate capture.`:
   `Con tu jugada, el rival puede capturar ${victim}. La alternativa evita esa captura inmediata.`;
 }
 const describe=value=>value===0?(en?'material stays even':'el material queda igual')
  :en?`you ${value<0?'lose':'gain'} about ${Math.abs(value)} in material`
   :`${value<0?'pierdes':'ganas'} material por valor de ${Math.abs(value)} ${Math.abs(value)===1?'peón':'peones'}`;
 return en?`In the lines shown, ${describe(old)} with your move. With the alternative, ${describe(better)}.`:`En las variantes mostradas, con tu jugada ${describe(old)}. Con la alternativa, ${describe(better)}.`;
}
export function replyFacts(fen,uci,language='es'){
 if(!uci)return null;try{
  const c=new Chess(fen),m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
  const mate=c.isCheckmate(),check=c.isCheck();
  let detail=`el rival puede responder ${m.san}`;
  if(mate)detail+=' y dar jaque mate';
  else if(m.captured)detail+=`, capturando tu ${names[m.captured]} en ${m.to}`+(check?' y dando jaque':'');
  else if(check)detail+=' y dar jaque';
  if(language==='en'){const pieces={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};detail=`your opponent can play ${m.san}`;if(mate)detail+=' and deliver checkmate';else if(m.captured)detail+=`, capturing your ${pieces[m.captured]} on ${m.to}`+(check?' with check':'');else if(check)detail+=' with check';}
  return {san:m.san,capture:m.captured||null,check,mate,text:detail+'.'};
 }catch{return null;}
}
export function localReview(mine,counts,language='es'){
 if(language==='en')return englishReview(mine,counts);
 const issues=mine.filter(m=>m.loss>=50).sort((a,b)=>a.ply-b.ply),facts=issues.map(m=>replyFacts(m.afterFen,m.after?.pv?.[0])).filter(Boolean);
 const checks=facts.filter(f=>f.check).length,captures=facts.filter(f=>f.capture).length,advice=[];
 if(checks)advice.push(`Te falta comprobar mejor los jaques del rival: en ${checks} de tus errores, su respuesta calculada daba jaque${facts.some(f=>f.mate)?', incluso mate en alguna posición':''}. Antes de mover, mira primero la seguridad de tu rey.`);
 if(captures)advice.push(`Revisa las piezas que dejas al alcance del rival: en ${captures} de tus errores, la respuesta calculada capturaba una pieza tuya. Antes de atacar, comprueba qué puede capturarte.`);
 if(!advice.length&&issues.length)advice.push('Te conviene comparar tu idea con una respuesta concreta del rival. Encontrar una jugada atractiva es solo el primer paso: imagina qué jugaría el otro antes de decidir.');
 if(!issues.length)advice.push('No aparecen pérdidas de al menos medio peón entre tus jugadas evaluadas. Mantén la costumbre de comprobar la respuesta rival; una revisión local breve puede pasar por alto ideas más profundas.');
 const first=issues[0];
 const start=first?`Parte por la jugada ${Math.ceil(first.ply/2)}${first.color==='w'?'.':'...'} ${first.san}. Ahí apareció tu ${first.kind==='inaccuracy'?'primera imprecisión':first.kind==='blunder'?'primer error grave':'primer error'} detectado. Vuelve a esa posición y pregúntate qué respuesta no tuviste en cuenta. Después prueba otra decisión en el tablero de práctica.`:'Puedes revisar tus decisiones seleccionándolas en el registro.';
 const count=(n,one,many)=>`${n} ${n===1?one:many}`;
 return `En ${count(mine.length,'jugada propia','jugadas propias')} detecté ${count(counts.blunder,'error grave','errores graves')}, ${count(counts.mistake,'error','errores')} y ${count(counts.inaccuracy,'imprecisión','imprecisiones')}.\n\nQué conviene mejorar\n${advice.join('\n\n')}\n\n${start}`;
}
export function exerciseFeedback({san,good,move,afterFen,after,original,language='es'}){
 const en=language==='en',board=new Chess(afterFen),human=move?.color||(board.turn()==='w'?'b':'w');
 const pv=after.pv?.length?after.pv:[after.best].filter(Boolean);
 const line=move?replayLine(move.before,[move.lan,...pv]):replayLine(afterFen,pv);
 const intro=good?(en?`Good move: ${san}.`:`Bien jugado: ${san}.`):(en?`Not quite: ${san}.`:`Todavía no: ${san}.`);
 let concrete=explainReplay(line,human,language);
 if(board.isCheckmate()&&!move)concrete=en?'You deliver checkmate.':'Das jaque mate.';
 if(!concrete)concrete=board.isGameOver()
  ?(en?'The game ends here.':'La partida termina aquí.')
  :(en?'Look at what your opponent can threaten in the new position.':'Mira qué puede amenazar el rival en la posición que queda.');
 if(!good){
  const mate=line.some(move=>move.mate&&move.color!==human);
  const reply=line.find(move=>move.color!==human&&(move.captured||move.check));
  const cue=mate?(en?'Before moving, check which squares your king can escape to.':'Antes de mover, fíjate por dónde podría escapar tu rey.')
   :reply?.captured?(en?`Before moving, check how you could protect the piece on ${reply.to}.`:`Antes de mover, fíjate en cómo podrías proteger la pieza de ${reply.to}.`)
   :(en?'Look for a way to deal with the reply and try again.':'Busca cómo responder a esa jugada y vuelve a intentarlo.');
  const recorded=en?'This attempt is recorded as incorrect.':'Este intento queda registrado como incorrecto.';
  return [intro,concrete,cue+' '+recorded].join('\n\n');
 }
 const oldLine=original?.san!==san&&original?.beforeFen&&original.uci
  ?replayLine(original.beforeFen,[original.uci,...(original.after?.pv||[])])
  :[];
 const oldReply=oldLine.find(move=>move.color!==human);
 const avoidedMate=oldLine.some(move=>move.mate&&move.color!==human)&&!line.some(move=>move.mate&&move.color!==human);
 const improvedMaterial=materialInLine(line,human)>materialInLine(oldLine,human)&&materialInLine(oldLine,human)<0;
 const comparison=oldReply&&(avoidedMate||improvedMaterial)
  ?(en?`Compare with ${original.san} in the game: `:`Compara con ${original.san} en la partida: `)+explainReplay(oldLine,human,language)
  :'';
 const missed=oldReply?missedOpportunity(oldLine,line,human,language):'';
 const escaped=move&&oldReply?.captured===move.piece&&oldReply.to===move.from
  ?(en?`You moved your ${englishNames[move.piece]} away from ${move.from}, where it could be captured after ${original.san}.`:`Sacaste tu ${names[move.piece]} de ${move.from}, donde el rival podía capturar esa pieza después de ${original.san}.`)
  :'';
 const tacticalOutcome=line.at(-1)?.mate||materialInLine(line,human)>0;
 const idea=escaped||(board.isGameOver()?'':newTargets(move,board,language))||(!tacticalOutcome?positionalIdea(move,board,language):'');
 return [
  intro,
  idea||concrete,
  idea&&tacticalOutcome?concrete:'',
  comparison||(missed?(en?`Compare with ${original.san} in your game. `:`Compáralo con ${original.san} en tu partida. `)+missed:'')
 ].filter(Boolean).join('\n\n');
}
function englishReview(mine,counts){
 const issues=mine.filter(m=>m.loss>=50).sort((a,b)=>a.ply-b.ply),facts=issues.map(m=>replyFacts(m.afterFen,m.after?.pv?.[0],'en')).filter(Boolean),checks=facts.filter(f=>f.check).length,captures=facts.filter(f=>f.capture).length,advice=[];
 if(checks)advice.push(`Check your opponent's checks more carefully: the calculated response gave check in ${checks} of your mistakes${facts.some(f=>f.mate)?', including checkmate in at least one position':''}. Before moving, look at your king's safety.`);
 if(captures)advice.push(`Watch the pieces you leave exposed: the calculated response captured one of your pieces in ${captures} of your mistakes. Before attacking, check what your opponent can capture.`);
 if(!advice.length&&issues.length)advice.push('Compare your idea with a concrete reply. Finding an attractive move is only the first step: imagine what your opponent would play before you decide.');
 if(!issues.length)advice.push('No losses of at least half a pawn were found among your evaluated moves. Keep checking the reply; a short local search can miss deeper ideas.');
 const first=issues[0],kind=first?.kind==='blunder'?'blunder':first?.kind==='inaccuracy'?'inaccuracy':'mistake';
 const count=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
 return `In ${count(mine.length,'move of yours','moves of yours')}, I found ${count(counts.blunder,'blunder')}, ${count(counts.mistake,'mistake')} and ${count(counts.inaccuracy,'inaccuracy','inaccuracies')}.\n\nWhat to improve\n${advice.join('\n\n')}\n\n`+(first?`Start with move ${Math.ceil(first.ply/2)}${first.color==='w'?'.':'...'} ${first.san}. This was your first detected ${kind}. Return to that position and ask which reply you missed. Then try a different decision in the puzzle.`:'Select a move in the move list to review your decisions.');
}
