import {Chess} from './vendor/chess.js';
const names={p:'peón',n:'caballo',b:'alfil',r:'torre',q:'dama',k:'rey'};
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
export function exerciseFeedback({san,good,loss,afterFen,after,original,language='es'}){
 if(language==='en')return englishFeedback({san,good,loss,afterFen,after,original});
 const reply=replyFacts(afterFen,after.pv?.[0]),oldReply=original?replyFacts(original.afterFen,original.after?.pv?.[0]):null;
 if(good){
  const reason=loss===0?'El motor no detecta una pérdida de evaluación apreciable frente a su mejor alternativa en esta búsqueda.':`Queda a menos de medio peón de la mejor opción en esta búsqueda: conserva una evaluación cercana sin exigir una única jugada.`;
  return `Bien: ${san} es una buena solución. ${reason}\n\n${reply?'Después de tu jugada, '+reply.text:'Esta jugada termina la partida.'}${oldReply&&original.san!==san?'\n\nEn la partida jugaste '+original.san+' y '+oldReply.text.replace('puede responder','podía responder')+' Ahora compara esa respuesta con la de tu nuevo intento.':''}\n\nQué aprender: antes de decidir, comprueba esa respuesta rival. Tu acierto no borra los intentos incorrectos anteriores.`;
 }
 const change=loss>=90000?'El cambio afecta a una secuencia de mate.':`Frente a la mejor opción, pierde aproximadamente ${(loss/100).toFixed(2)} peones de evaluación.`;
 return `Todavía no: ${san} permite una respuesta que debes revisar. ${change}\n\n${reply?'Después de tu jugada, '+reply.text:'Revisa la posición resultante.'}\n\nEste intento queda registrado como incorrecto. Vuelve a la posición, busca cómo responder a esa amenaza y prueba de nuevo. La solución seguirá oculta hasta que encuentres una buena alternativa.`;
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
function englishFeedback({san,good,loss,afterFen,after,original}){
 const reply=replyFacts(afterFen,after.pv?.[0],'en'),oldReply=original?replyFacts(original.afterFen,original.after?.pv?.[0],'en'):null;
 if(good){const reason=loss===0?'The engine finds no appreciable evaluation loss compared with its best alternative in this search.':'This move is within half a pawn of the best option in this search. A single exact move is not required.';
  return `Good: ${san} is a sound solution. ${reason}\n\n`+(reply?'After your move, '+reply.text:'This move ends the game.')+(oldReply&&original.san!==san?'\n\nIn the game you played '+original.san+' and '+oldReply.text.replace('can play','could play')+' Compare that response with your new attempt.':'')+'\n\nWhat to learn: check that reply before deciding. A correct answer does not erase earlier failed attempts.';
 }
 return `Not quite: ${san} allows a response you should check. `+(loss>=90000?'The change affects a mating sequence.':`Compared with the best option, this loses about ${(loss/100).toFixed(2)} pawns of evaluation.`)+'\n\n'+(reply?'After your move, '+reply.text:'Check the resulting position.')+'\n\nThis attempt is recorded as incorrect. Return to the position, look for a way to address the threat and try again. The solution stays hidden until you find a sound alternative.';
}
