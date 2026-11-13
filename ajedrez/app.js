import { ChessTrainer } from './core.js';
const $ = id => document.getElementById(id);
const symbols = { k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
const names = { k:'rey',q:'dama',r:'torre',b:'alfil',n:'caballo',p:'peón' };
let game = null, selected = null, flipped = false, busy = false, reviewFen = null, exerciseIndex = null, aiReady = false;
let journal = [], rating = 350;
try { journal = JSON.parse(localStorage.getItem('entre-jugadas-journal') || '[]'); if (!Array.isArray(journal)) journal = []; rating = Number(localStorage.getItem('entre-jugadas-rating')) || 350; } catch {}
$('rating').textContent = rating;
$('eloInput').value=rating;
function store() { try { localStorage.setItem('entre-jugadas-journal',JSON.stringify(journal)); localStorage.setItem('entre-jugadas-rating',String(rating)); } catch { notice('No se pudo guardar el cuaderno en este navegador.'); } }
function notice(text) { $('notice').textContent = text || ''; $('notice').hidden = !text; }
const trainer = new ChessTrainer({onProgress:message=>{ $('busyText').textContent=message; }});
function updateConnection(){
  const u=trainer.ai.usage();
  $('connection').textContent=trainer.ai.key?'OpenAI · clave cargada':'IA generativa · conectar';
  $('connectionSub').textContent=trainer.ai.model+' · límite US$'+u.limit.toFixed(2)+' / partida ▾';
  $('budgetState').textContent='Esta partida: US$'+u.usd.toFixed(4)+' estimados · '+u.calls+' llamadas. El límite se reinicia en la próxima partida.';
}
async function api(route,data={}){
  try{return await trainer.request(route,data);}finally{updateConnection();}
}
async function work(message, fn) {
  if (busy) return;
  busy = true; $('busyText').textContent = message; $('busy').hidden = false;
  document.querySelectorAll('button').forEach(b => { b.dataset.wasDisabled = b.disabled ? '1' : ''; b.disabled = true; });
  try { await fn(); } catch (e) { notice(e.message); if(!trainer.ai.key&&e.message.includes('clave')) $('aiSettings').open=true; }
  finally {
    busy = false; $('busy').hidden = true;
    document.querySelectorAll('button').forEach(b => { b.disabled = b.dataset.wasDisabled === '1'; });
    if (game) render(); else drawBoard();
    showClocks();
    if(game?.report) $('practice').disabled=!game.exercises.length;
    if(currentExercise()) $('saveLearning').disabled=!currentExercise().done;
    $('explain').disabled=!aiReady;
  }
}
function parseBoard(fen) {
  const board = {};
  (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').split(' ')[0].split('/').forEach((rank, row) => {
    let col=0; for (const p of rank) { if (/\d/.test(p)) col+=Number(p); else { board[String.fromCharCode(97+col)+(8-row)]={type:p.toLowerCase(),color:p===p.toUpperCase()?'w':'b'}; col++; } }
  }); return board;
}
function currentExercise() { return exerciseIndex === null ? null : game?.exercises[exerciseIndex]; }
function activeFen() { return currentExercise()?.fen || reviewFen || game?.fen; }
function activeLegal() { return currentExercise() ? (currentExercise().done ? [] : currentExercise().legal) : reviewFen || !game || game.over || game.turn!==game.human ? [] : game.legal; }
function drawBoard() {
  const pieces = parseBoard(activeFen()); const legal = activeLegal(); const board=$('board'); board.replaceChildren();
  const files=flipped?'hgfedcba':'abcdefgh', ranks=flipped?'12345678':'87654321';
  const last = !currentExercise() && !reviewFen ? game?.moves.at(-1) : null;
  for (let row=0;row<8;row++) for (let col=0;col<8;col++) {
    const sq=files[col]+ranks[row], p=pieces[sq];
    const b=document.createElement('button'); b.className='square'+((files.charCodeAt(col)-97+Number(ranks[row]))%2===1?' dark':''); b.dataset.square=sq;
    b.setAttribute('aria-label',sq+(p?' '+names[p.type]+' '+(p.color==='w'?'blanco':'negro'):''));
    b.setAttribute('aria-pressed',selected===sq?'true':'false');
    if (p) { const s=document.createElement('img');s.className='piece '+(p.color==='w'?'white':'black');s.src='./pieces/'+p.color+p.type.toUpperCase()+'.svg';s.alt='';s.draggable=false;b.append(s); }
    if (row===7) { const s=document.createElement('span');s.className='coord file';s.textContent=files[col];b.append(s); }
    if (col===0) { const s=document.createElement('span');s.className='coord rank';s.textContent=ranks[row];b.append(s); }
    if (sq===selected) b.classList.add('selected');
    if (selected&&legal.some(m=>m.from===selected&&m.to===sq)) b.classList.add('target');
    if (last&&(last.from===sq||last.to===sq)) b.classList.add('last');
    b.disabled=busy; b.addEventListener('click',()=>squareClick(sq)); board.append(b);
  }
}
async function promotionChoice() {
  const dialog=$('promotion');dialog.showModal();
  return new Promise(resolve=>{
    const done=piece=>{dialog.close();dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);resolve(piece);};
    const click=e=>{if(e.target.dataset.piece)done(e.target.dataset.piece);else if(e.target.id==='cancelPromotion')done(null);};
    const cancel=e=>{e.preventDefault();done(null);};dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);
  });
}
async function squareClick(sq) {
  if(busy)return;
  const legal=activeLegal();const choices=legal.filter(m=>m.from===selected&&m.to===sq);
  if(choices.length) {
    const from=selected;let promotion;
    if(choices.some(m=>m.promotion)){promotion=await promotionChoice();if(!promotion)return;}
    selected=null;
    if(currentExercise()) {
      if(!$('exerciseReason').value.trim()){notice('Antes de comprobar: escribe qué crees que respondería el rival.');drawBoard();return;}
      await work('Comprobando tu solución y la respuesta del rival…',async()=>{game=await api('exercise',{ply:currentExercise().ply,from,to:sq,promotion,reason:$('exerciseReason').value});notice(null);renderExercise();});
    } else await work(game.opponent==='generative'?'Jugada confirmada. GPT está pensando…':'Jugada confirmada. Analizando y preparando la respuesta…',async()=>{
      try{game=await api('move',{from,to:sq,promotion});notice(game.notice);}catch(e){try{game=await api('state');}catch{}throw e;}
      if(game.over) finish();
    });
  } else { selected=legal.some(m=>m.from===sq)?sq:null;drawBoard(); }
}
function render() {
  if(!game){drawBoard();return;}
  $('gamePanel').hidden=false;$('setup').hidden=true;
  $('opponentName').textContent=game.opponent==='generative'?'IA generativa · tu rival':'Sin conexión a GPT · rival local';
  $('opponentSub').textContent='Nivel adaptativo '+game.rating+' · 10 min por lado';
  $('humanSub').textContent='Juegas con '+(game.human==='w'?'blancas':'negras')+' · sin deshacer';
  $('status').textContent=game.status;
  $('download').disabled=false;$('resign').hidden=game.over;
  $('retry').hidden=game.over||game.turn===game.human; $('offline').hidden=$('retry').hidden||game.opponent!=='generative';
  $('boardMode').textContent=currentExercise()?'EJERCICIO':reviewFen?'REVISIÓN':'PARTIDA';
  $('returnGame').hidden=!currentExercise()&&!reviewFen;
  $('moveCount').textContent=game.moves.length+' movimientos';
  $('analysisHint').textContent=game.over?'Selecciona una jugada para revisarla después de tu autoevaluación.':'El análisis está oculto hasta terminar. No hay pistas ni deshacer.';
  const list=$('moves');list.replaceChildren();
  game.moves.forEach((m,i)=>{
    if(i%2===0){const n=document.createElement('span');n.className='number';n.textContent=(Math.floor(i/2)+1)+'.';list.append(n);}
    const b=document.createElement('button');b.className='move '+(m.kind||'');b.textContent=m.san;b.title=m.label||'Análisis al terminar';
    if(m.label){const s=document.createElement('small');s.textContent={blunder:'??',mistake:'?',inaccuracy:'?!',good:'✓',neutral:'·'}[m.kind]||'·';b.append(s);}
    b.disabled=busy||!m.beforeFen;b.addEventListener('click',async()=>{if(!m.label)await work('Revisando esta jugada…',async()=>{game=await api('inspect',{ply:m.ply});});showMove(m.ply);});list.append(b);
  });drawBoard();
}
function finish(){ $('reflectionPanel').hidden=!!game.report;$('afterPanel').hidden=false;$('step2').classList.add('active'); }
function showMove(ply) {
  const m=game.moves.find(m=>m.ply===ply);if(!m?.beforeFen)return;
  exerciseIndex=null;reviewFen=m.afterFen;selected=null;$('reviewPanel').hidden=false;
  $('reviewTitle').textContent=Math.ceil(ply/2)+(m.color==='w'?'. ':'... ')+m.san+' · '+m.label;
  const cp=m.whiteCp;const evalText=Number.isFinite(cp)?Math.abs(cp)>90000?'El motor detecta una secuencia de mate.':'Evaluación después: '+(cp>=0?'+':'')+(cp/100).toFixed(2)+' peones, desde blancas.':'Evaluación no disponible.';
  $('reviewText').textContent=m.analysisError?m.analysisError:`${evalText}\n${m.loss>=90000?'Cambio decisivo de mate.':Number.isFinite(m.loss)?'Pérdida estimada: '+(m.loss/100).toFixed(2)+' peones.':''}\nAlternativa calculada: ${m.bestLine||'—'}\nRespuesta a tu jugada: ${m.playedLine||'Fin de la partida.'}\nProfundidad orientativa: ${m.depth||'—'} medias jugadas.`;
  $('moveReflection').value='';$('explanation').textContent=m.explanation||'';$('explain').disabled=!aiReady;render();
}
function renderReport(){
  const r=game.report;$('reportPanel').hidden=false;$('reflectionPanel').hidden=true;
  $('reportText').textContent=r.text;$('reportSource').textContent=r.source;
  $('stats').replaceChildren();for(const [key,label]of[['blunder','Errores graves'],['mistake','Errores'],['inaccuracy','Imprecisiones']]){const d=document.createElement('div');const b=document.createElement('b');b.textContent=r.counts[key];d.append(b,document.createTextNode(label));$('stats').append(d);}
  if(r.progress){rating=r.progress.after;$('rating').textContent=rating;store();$('progress').textContent=r.estimate?r.estimate.text+'\n\nReferencia para la próxima partida: '+rating+'.':`Próxima partida: ${rating} (${rating-r.progress.before>=0?'+':''}${rating-r.progress.before}). Ajuste por resultado y errores graves. Índice propio, sin equivalencia a Elo oficial.`;}
  $('practice').disabled=!game.exercises.length;
  if(!game.exercises.length)$('progress').textContent+=' No hay errores de al menos 0,50 peones para convertir en ejercicios.';
  if(r.warning)notice(r.warning);if(r.missing)notice((r.warning||'')+' Hay '+r.missing+' jugadas propias sin evaluar: el resumen está incompleto.');
}
function renderExercise(){
  const x=currentExercise();if(!x)return;
  $('exercisePanel').hidden=false;$('reviewPanel').hidden=true;$('step3').classList.add('active');
  $('exerciseTabs').replaceChildren();game.exercises.forEach((ex,i)=>{const b=document.createElement('button');b.textContent=(i+1)+(ex.done?' ✓':'');b.className=i===exerciseIndex?'chosen':'';b.onclick=()=>selectExercise(i);$('exerciseTabs').append(b);});
  $('exercisePrompt').textContent='Jugada '+Math.ceil(x.ply/2)+(game.human==='w'?'.':'...')+' · ¿Qué jugarías ahora y cómo podría responder el rival?';
  $('exerciseResult').textContent=x.done?`${x.answer.good?'Buena solución.':'Revisa esta idea.'} Tu intento: ${x.answer.san}.\nAlternativa del motor: ${x.answer.bestLine}\nRespuesta a tu intento: ${x.answer.replyLine||'Fin de la partida.'}\nTu previsión: ${x.answer.reason}`:'';
  $('saveLearning').disabled=!x.done;$('retryExercise').hidden=!x.done;drawBoard();
}
function selectExercise(i){exerciseIndex=i;reviewFen=null;selected=null;$('exerciseReason').value=game.exercises[i].answer?.reason||'';renderExercise();render();}
function renderJournal(){ $('journalCount').textContent=journal.length;$('journal').replaceChildren();journal.slice().reverse().slice(0,15).forEach(x=>{const d=document.createElement('div');d.className='journal-entry';const s=document.createElement('small');s.textContent=x.date+' · '+x.pattern;const p=document.createElement('p');p.textContent=x.text;d.append(s,p);$('journal').append(d);}); }
$('levelMode').onchange=()=>{const estimating=$('levelMode').value==='estimate';$('eloField').hidden=estimating;$('estimateHint').hidden=!estimating;};
$('start').onclick=()=>work('Preparando la partida y sorteando tu color…',async()=>{const levelMode=$('levelMode').value;game=await api('new',{opponent:$('opponent').value,rating:levelMode==='manual'?Number($('eloInput').value)||350:rating,levelMode});$('rating').textContent=game.rating;flipped=game.human==='b';reviewFen=null;exerciseIndex=null;notice(game.notice);if(game.over)finish();});
$('model').onchange=()=>{ $('customModelPanel').hidden=$('model').value!=='custom'; };
$('connect').onclick=()=>work('Guardando la conexión en esta sesión…',async()=>{
  const model=$('model').value==='custom'?$('customModel').value.trim():$('model').value;
  await api('connect',{key:$('apiKey').value.trim(),model,limit:$('budget').value,input:$('inputPrice').value,output:$('outputPrice').value});
  $('apiKey').value='';aiReady=!!trainer.ai.key;$('aiSettings').open=false;
  $('keyStatus').textContent=aiReady?'Clave cargada solo para esta sesión. Se enviará directamente a OpenAI al usar la IA.':'Sin clave. El rival local está disponible.';
  notice(aiReady?'Conexión preparada. El coste se registra por partida al llamar a la IA.':'Límite y modelo actualizados.');
});
$('disconnect').onclick=()=>{if(busy)return;trainer.ai.key='';aiReady=false;$('apiKey').value='';updateConnection();$('keyStatus').textContent='Clave eliminada de esta sesión.';notice('IA desconectada. El rival local sigue disponible.');};
$('offline').onclick=()=>work('Preparando la respuesta del rival local…',async()=>{game=await api('offline');notice(game.notice);if(game.over)finish();});
$('flip').onclick=()=>{flipped=!flipped;drawBoard();};
$('resign').onclick=()=>work('Cerrando la partida…',async()=>{if(!confirm('¿Terminar esta partida por rendición y pasar a la revisión?'))return;game=await api('resign');reviewFen=null;finish();});
$('retry').onclick=()=>work('GPT está pensando su respuesta…',async()=>{game=await api('retry');notice(game.notice);if(game.over)finish();});
$('report').onclick=()=>work('Revisando tus errores y preparando ejercicios reales…',async()=>{game=await api('report',{reflection:$('reflection').value});renderReport();});
$('practice').onclick=()=>{selectExercise(0);$('exercisePanel').scrollIntoView({behavior:'smooth',block:'nearest'});};
$('retryExercise').onclick=()=>work('Preparando otro intento…',async()=>{game=await api('retryExercise',{ply:currentExercise().ply});$('exerciseReason').value='';renderExercise();});
$('returnGame').onclick=()=>{reviewFen=null;exerciseIndex=null;selected=null;$('reviewPanel').hidden=true;$('exercisePanel').hidden=true;render();};
$('explain').onclick=()=>work('GPT está explicando esta decisión…',async()=>{const ply=game.moves.find(m=>m.afterFen===reviewFen)?.ply;const r=await api('explain',{ply,reflection:$('moveReflection').value});$('explanation').textContent=r.text;});
$('saveLearning').onclick=()=>{const x=currentExercise();if(!x?.done)return;const id=game.id+':'+x.ply;if(journal.some(j=>j.id===id)){notice('Esta posición ya está guardada en tu cuaderno.');return;}journal.push({id,date:new Date().toLocaleDateString('es-CL'),pattern:$('pattern').value,text:'Jugada '+Math.ceil(x.ply/2)+': '+x.answer.reason+' · Alternativa: '+x.answer.bestLine,fen:x.fen});store();renderJournal();notice('Aprendizaje guardado. Practica el mismo hábito en la próxima partida.');};
$('newGame').onclick=()=>{game=null;selected=null;reviewFen=null;exerciseIndex=null;['gamePanel','reflectionPanel','reportPanel','reviewPanel','exercisePanel','afterPanel'].forEach(id=>$(id).hidden=true);$('setup').hidden=false;$('reflection').value='';$('step2').classList.remove('active');$('step3').classList.remove('active');$('status').textContent='Listo para jugar';$('humanSub').textContent='Tu color se sortea al empezar';$('opponentName').textContent='Tu rival · IA generativa';$('opponentSub').textContent='Juego razonable, dificultad adaptativa';$('boardMode').textContent='PARTIDA';$('returnGame').hidden=true;$('download').disabled=true;notice(null);drawBoard();};
$('download').onclick=()=>{if(!game)return;const blob=new Blob([game.pgn],{type:'application/x-chess-pgn'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='entre-jugadas-'+new Date().toISOString().slice(0,10)+'.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
window.addEventListener('beforeunload',e=>{if(game&&!game.over){e.preventDefault();e.returnValue='';}});
function showClocks(){
 if(!game){for(const id of ['humanClock','opponentClock']){$(id).textContent='10:00';$(id).classList.remove('ticking','low');}return;}
 const format=ms=>{const secs=Math.ceil(ms/1000);return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');};
 const other=game.human==='w'?'b':'w';
 $('humanClock').textContent=format(game.clocks[game.human]);$('opponentClock').textContent=format(game.clocks[other]);
 $('humanClock').classList.toggle('ticking',game.running===game.human);$('opponentClock').classList.toggle('ticking',game.running===other);
 $('humanClock').classList.toggle('low',game.clocks[game.human]<60000);$('opponentClock').classList.toggle('low',game.clocks[other]<60000);
}
setInterval(()=>{if(!trainer.game)return;const wasOver=game?.over,oldMoves=game?.moves.length;game=trainer.view();showClocks();if(busy&&oldMoves!==game.moves.length)render();if(game.over&&!wasOver){finish();render();}},100);
const oldNew=$('newGame').onclick;$('newGame').onclick=()=>{trainer.stopClock();trainer.game=null;oldNew();$('eloInput').value=rating;showClocks();};
drawBoard();renderJournal();updateConnection();
