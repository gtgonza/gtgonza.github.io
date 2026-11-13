import { ChessTrainer } from './core.js';
import { PROVIDERS, MODEL_PRESETS, modelRates, CATALOG_DATE } from './models.js';
import {Chess} from './vendor/chess.js';
import {TrainingProfile} from './training.js';
const $ = id => document.getElementById(id);
const symbols = { k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
const names = { k:'rey',q:'dama',r:'torre',b:'alfil',n:'caballo',p:'peón' };
let game = null, selected = null, flipped = false, busy = false, reviewFen = null, exerciseIndex = null, aiReady = false;
let quietThinking=false,boardSignature='',renderedGame=null,renderedPly=0,renderedFlipped=false;
let exercisePhase='challenge',exercisePreviewFen=null,exerciseMotion=null,preludeTimer=null;
let journal = [], rating = 350;
let profile=new TrainingProfile();
try{profile=new TrainingProfile(JSON.parse(localStorage.getItem('entre-jugadas-training')||'{}'));}catch{}
try { journal = JSON.parse(localStorage.getItem('entre-jugadas-journal') || '[]'); if (!Array.isArray(journal)) journal = []; rating = Number(localStorage.getItem('entre-jugadas-rating')) || 350; } catch {}
$('rating').textContent = rating;
$('eloInput').value=rating;
function store() { try { localStorage.setItem('entre-jugadas-journal',JSON.stringify(journal)); localStorage.setItem('entre-jugadas-rating',String(rating)); localStorage.setItem('entre-jugadas-training',JSON.stringify(profile.export())); } catch { notice('No se pudo guardar el cuaderno en este navegador.'); } }
function notice(text) { $('notice').textContent = text || ''; $('notice').hidden = !text; }
const trainer = new ChessTrainer({onProgress:message=>{ $('busyText').textContent=message; }});
function updateConnection(){
  const u=trainer.ai.usage();
  $('connection').textContent=trainer.ai.key?PROVIDERS[trainer.ai.provider].name+' · clave cargada':'IA generativa · conectar';
  $('connectionSub').textContent=trainer.ai.model+' · límite US$'+u.limit.toFixed(2)+' / partida ▾';
  $('budgetState').textContent='Esta partida: US$'+u.usd.toFixed(4)+' estimados · '+u.calls+' llamadas. El límite se reinicia en la próxima partida.';
}
async function api(route,data={}){
  try{return await trainer.request(route,data);}finally{updateConnection();}
}
async function work(message, fn, {natural=false}={}) {
  if (busy) return;
  busy = true;quietThinking=natural; $('busyText').textContent = message; $('busy').hidden = natural;showThinking();
  document.querySelectorAll('button').forEach(b => { b.dataset.wasDisabled = b.disabled ? '1' : ''; b.disabled = true; });
  try { await fn(); } catch (e) { notice(e.message); if(!trainer.ai.key&&e.message.includes('clave')) $('aiSettings').open=true; }
  finally {
    busy = false;quietThinking=false; $('busy').hidden = true;showThinking();
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
function activeFen() { const x=currentExercise();return x?(exercisePhase==='prelude'?x.beforeOpponentFen:exercisePhase==='checking'?exercisePreviewFen:exercisePhase==='feedback'?x.answer?.afterFen||x.fen:x.fen):reviewFen||game?.fen; }
function activeLegal() { return currentExercise() ? (currentExercise().done||exercisePhase!=='challenge' ? [] : currentExercise().legal) : reviewFen || !game || game.over || game.turn!==game.human ? [] : game.legal; }
function showThinking(){
  const thinking=!!(game&&!game.over&&game.turn!==game.human&&busy&&quietThinking);
  $('thinking').hidden=!thinking;$('board').setAttribute('aria-busy',String(thinking));
  if(thinking)$('status').textContent='El rival está pensando…';
}
function showOutcome(){
  const outcome=game?.outcome,visible=!!outcome&&!currentExercise()&&!reviewFen;
  $('gameResult').hidden=!visible;if(!visible)return;
  $('resultTitle').textContent={checkmate:'Jaque mate',timeout:'Tiempo agotado',resign:'Partida terminada',draw:'Tablas'}[outcome.reason]||'Partida terminada';
  const won=outcome.winner===game.human;
  $('gameResult').classList.toggle('result-win',won);$('gameResult').classList.toggle('result-draw',!outcome.winner);
  $('resultDetail').textContent=outcome.winner?(won?'Ganaste. ':'Perdiste. ')+(outcome.winner==='w'?'Ganan las blancas.':'Ganan las negras.')+(outcome.reason==='resign'?' Terminó por rendición.':''):'La partida terminó en tablas.';
}
function drawBoard() {
  const fen=activeFen(),pieces = parseBoard(fen),legal = activeLegal(),board=$('board');
  showOutcome();
  $('practiceBoardPrompt').hidden=!currentExercise();
  if(currentExercise())$('practiceBoardPrompt').textContent=exercisePhase==='prelude'?'Observa la última jugada del rival…':exercisePhase==='feedback'?(currentExercise().answer?.good?'Bien resuelto. Lee la explicación.':'Revisa la respuesta y vuelve a intentarlo.'):'¿Qué harías ahora? Elige tu jugada en el tablero.';
  const mate=game?.outcome?.reason==='checkmate'&&fen===game.fen&&!currentExercise()?game.outcome:null;
  const signature=[fen,flipped,exerciseIndex,reviewFen,game?.id,game?.outcome?.reason].join('|');
  if(signature===boardSignature){for(const square of board.children){const sq=square.dataset.square;square.disabled=busy;square.classList.toggle('selected',sq===selected);square.classList.toggle('target',!!selected&&legal.some(m=>m.from===selected&&m.to===sq));square.setAttribute('aria-pressed',String(sq===selected));}return;}
  const demoMotion=exerciseMotion;exerciseMotion=null;
  const lastMove=demoMotion||(!currentExercise()&&!reviewFen?game?.moves.at(-1):null);
  const animate=lastMove&&(demoMotion||(game.moves.length===renderedPly+1&&(!renderedGame||renderedGame===game.id)))&&renderedFlipped===flipped&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transitions=[];
  if(animate){
    transitions.push({from:lastMove.from,to:lastMove.to});
    if(lastMove.san==='O-O'||lastMove.san==='O-O-O'){
      const rank=lastMove.from[1];transitions.push({from:(lastMove.to[0]==='g'?'h':'a')+rank,to:(lastMove.to[0]==='g'?'f':'d')+rank});
    }
    for(const item of transitions)item.origin=board.querySelector(`[data-square="${item.from}"]`)?.getBoundingClientRect();
  }
  boardSignature=signature;renderedGame=game?.id||null;renderedPly=game?.moves.length||0;renderedFlipped=flipped;
  board.replaceChildren();
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
    if(mate&&sq===mate.loserKing){b.classList.add('king-defeated');b.setAttribute('aria-label',b.getAttribute('aria-label')+' · jaque mate, rey derrotado');}
    if(mate&&sq===mate.winnerKing){b.classList.add('king-victorious');b.setAttribute('aria-label',b.getAttribute('aria-label')+' · rey ganador');}
    b.disabled=busy; b.addEventListener('click',()=>squareClick(sq)); board.append(b);
  }
  for(const item of transitions){
    const target=board.querySelector(`[data-square="${item.to}"]`),piece=target?.querySelector('img');
    if(!item.origin||!piece)continue;
    const destination=target.getBoundingClientRect(),dx=item.origin.left-destination.left,dy=item.origin.top-destination.top;
    piece.classList.add('moving-piece');
    const motion=piece.animate([{transform:`translate(${dx}px, ${dy}px)`},{transform:'translate(0, 0)'}],{duration:lastMove.color===game.human?220:520,easing:'cubic-bezier(.25,.7,.25,1)',fill:'none'});
    motion.finished.then(()=>piece.classList.remove('moving-piece')).catch(()=>piece.classList.remove('moving-piece'));
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
      const preview=new Chess(currentExercise().fen);const move=preview.move({from,to:sq,promotion:promotion||'q'});exercisePreviewFen=preview.fen();exercisePhase='checking';exerciseMotion={from,to:sq,color:move.color,san:move.san};drawBoard();
      await work('Comprobando tu solución y la respuesta del rival…',async()=>{
        try{game=await api('exercise',{ply:currentExercise().ply,from,to:sq,promotion,reason:$('exerciseReason').value});exercisePhase='feedback';logPractice(currentExercise());notice(null);}catch(e){exercisePhase='challenge';throw e;}finally{exercisePreviewFen=null;renderExercise();}
      });
    } else await work('El rival está pensando…',async()=>{
      try{game=await api('move',{from,to:sq,promotion});notice(game.notice);}catch(e){try{game=await api('state');}catch{}throw e;}
      if(game.over) finish();
    },{natural:true});
  } else { selected=legal.some(m=>m.from===sq)?sq:null;drawBoard(); }
}
function render() {
  if(!game){drawBoard();return;}
  $('gamePanel').hidden=false;$('setup').hidden=true;
  $('opponentName').textContent=game.opponent==='generative'?'IA generativa · tu rival':'Sin conexión a GPT · rival local';
  $('opponentSub').textContent='Nivel adaptativo '+game.rating+' · 10 min por lado';
  $('humanSub').textContent='Juegas con '+(game.human==='w'?'blancas':'negras')+' · sin deshacer';
  $('status').textContent=currentExercise()?'Práctica · la partida original permanece intacta':!busy&&!game.over&&game.turn!==game.human&&game.notice?'Respuesta pendiente · reintenta o continúa sin conexión a GPT':game.status;
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
  });drawBoard();showThinking();
}
function finish(){ $('reflectionPanel').hidden=!!game.report;$('afterPanel').hidden=false;$('step2').classList.add('active'); }
function showMove(ply) {
  clearTimeout(preludeTimer);
  const m=game.moves.find(m=>m.ply===ply);if(!m?.beforeFen)return;
  exerciseIndex=null;reviewFen=m.afterFen;selected=null;$('reviewPanel').hidden=false;
  $('reviewTitle').textContent=Math.ceil(ply/2)+(m.color==='w'?'. ':'... ')+m.san+' · '+m.label;
  const cp=m.whiteCp;const evalText=Number.isFinite(cp)?Math.abs(cp)>90000?'El motor detecta una secuencia de mate.':'Evaluación después: '+(cp>=0?'+':'')+(cp/100).toFixed(2)+' peones, desde blancas.':'Evaluación no disponible.';
  $('reviewText').textContent=m.analysisError?m.analysisError:`${evalText}\n${m.loss>=90000?'Cambio decisivo de mate.':Number.isFinite(m.loss)?'Pérdida estimada: '+(m.loss/100).toFixed(2)+' peones.':''}\nAlternativa calculada: ${m.bestLine||'—'}\nRespuesta a tu jugada: ${m.playedLine||'Fin de la partida.'}\nProfundidad orientativa: ${m.depth||'—'} medias jugadas.`;
  $('moveReflection').value='';$('explanation').textContent=m.explanation||'';$('explain').disabled=!aiReady;render();
}
function renderReport(){
  const r=game.report;$('reportPanel').hidden=false;$('reflectionPanel').hidden=true;
  const training=profile.review(game);store();renderTraining();$('trainingReview').textContent=training.text;
  const next=profile.target();$('nextHabit').textContent=next?'Qué mirar en tu próxima partida: '+next.cue:'Los patrones pendientes volverán a priorizarse cuando corresponda su repaso.';
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
  $('exercisePrompt').textContent=exercisePhase==='prelude'?'Mira la jugada del rival: '+x.opponentMove.san+'.':(x.opponentMove?'El rival acaba de jugar '+x.opponentMove.san+'. ':'')+'¿Qué harías ahora? Juegas con '+(game.human==='w'?'blancas':'negras')+'.';
  $('exerciseResult').textContent=x.answer?x.answer.feedback+(x.answer.good?'\n\nAlternativa calculada: '+x.answer.bestLine:'')+'\n\nIntentos incorrectos en esta posición: '+x.failedAttempts+'.':'';
  $('exerciseResult').classList.toggle('practice-correct',!!x.answer?.good);$('exerciseResult').classList.toggle('practice-wrong',!!x.answer&&!x.answer.good);
  $('saveLearning').disabled=!x.done;$('retryExercise').hidden=!x.answer;$('retryExercise').textContent=x.done?'Practicar otra vez':'Reintentar esta posición';drawBoard();
}
function selectExercise(i){
 clearTimeout(preludeTimer);exerciseIndex=i;reviewFen=null;selected=null;exercisePreviewFen=null;
 const x=currentExercise();exercisePhase=x.answer?'feedback':x.beforeOpponentFen?'prelude':'challenge';
 $('exerciseReason').value=x.answer?.reason||'';renderExercise();render();
 if(exercisePhase==='prelude')preludeTimer=setTimeout(()=>{if(exerciseIndex!==i||currentExercise()?.ply!==x.ply)return;exercisePhase='challenge';exerciseMotion=x.opponentMove;renderExercise();},700);
}
function logPractice(x){
 const a=x.attempts.at(-1);if(!a)return;const id=game.id+':'+x.ply+':attempt:'+a.number;if(journal.some(j=>j.id===id))return;
 const source=game.moves.find(m=>m.ply===x.ply);if(source)profile.exercise(source,a,game.id);
 journal.push({id,date:new Date(a.at).toLocaleDateString('es-CL'),pattern:a.good?'Acierto en ejercicio':'Error en ejercicio',result:a.good?'correct':'incorrect',attempt:a.number,ply:x.ply,fen:x.fen,text:'Jugada '+Math.ceil(x.ply/2)+' · Intento '+a.number+' · '+a.san+'\nMi previsión: '+a.reason+'\n'+a.feedback});store();renderJournal();renderTraining();
}
function renderTraining(){
 const target=profile.target();$('trainingPlan').textContent=target?'Próxima partida: el rival intentará crear situaciones de «'+target.label.toLowerCase()+'» desde una partida nueva, entre jugadas razonables. No siempre será posible.':'Cada partida empieza desde cero. Al revisar tus errores, el rival podrá orientar futuras partidas hacia tus debilidades cuando toque repasarlas.';
 const list=$('performance');list.replaceChildren();
 const stats=profile.stats();$('performanceEmpty').hidden=!!stats.length;
 for(const p of stats){const entry=document.createElement('div');entry.className='journal-entry';const title=document.createElement('strong');title.textContent=p.label;
 const numbers=document.createElement('p');numbers.textContent=`Errores detectados: ${p.mistakes}. En partidas nuevas: ${p.gameGood} respuestas buenas y ${p.gameBad} con error. En ejercicios: ${p.exerciseGood} aciertos y ${p.exerciseBad} intentos incorrectos.`;
 const schedule=document.createElement('small');schedule.textContent='Etapa de repaso '+p.stage+'/6 · '+(p.due?'Pendiente': 'Próximo: '+new Date(p.dueAt).toLocaleString('es-CL'));
 entry.append(title,numbers,schedule);list.append(entry);}
}
function renderJournal(){ $('journalCount').textContent=journal.length;$('journal').replaceChildren();journal.slice().reverse().slice(0,15).forEach(x=>{const d=document.createElement('div');d.className='journal-entry';const s=document.createElement('small');s.textContent=x.date+' · '+x.pattern;const p=document.createElement('p');p.textContent=x.text;d.append(s,p);$('journal').append(d);}); }
$('levelMode').onchange=()=>{const estimating=$('levelMode').value==='estimate';$('eloField').hidden=estimating;$('estimateHint').hidden=!estimating;};
$('start').onclick=()=>work('Preparando la partida y sorteando tu color…',async()=>{const levelMode=$('levelMode').value;game=await api('new',{opponent:$('opponent').value,rating:levelMode==='manual'?Number($('eloInput').value)||350:rating,levelMode,trainingTarget:profile.target()});$('rating').textContent=game.rating;flipped=game.human==='b';reviewFen=null;exerciseIndex=null;notice(game.notice);if(game.over)finish();},{natural:true});
function showModelDetails(){
  const provider=$('provider').value,custom=$('model').value==='custom',item=custom?null:modelRates($('model').value);
  $('customModelPanel').hidden=!custom;
  $('keyLink').href=PROVIDERS[provider].keyUrl;$('keyLink').textContent='Obtener clave de '+PROVIDERS[provider].name;
  $('modelSource').href=PROVIDERS[provider].docs;
  $('keyStatus').textContent='Tu clave se enviará directamente a '+PROVIDERS[provider].host+'. Solo se mantiene en memoria durante esta sesión. Al cambiar de proveedor debes cargar su clave correspondiente.';
  $('modelInfo').textContent=custom?'Introduce el ID de la API y sus tarifas vigentes. La disponibilidad depende de tu cuenta.':
    `US$${item.input} / 1 M entrada · US$${item.output} / 1 M salida. `+(item.minOutput?'Se reserva un mínimo de '+item.minOutput+' tokens por respuesta para permitir razonamiento. ':'')+(item.freeTier?'Tiene nivel gratuito sujeto a cuota; el control de presupuesto utiliza la tarifa de pago como referencia. ':'')+(item.changeDate?'Tarifa promocional hasta 30-11-2026; el cálculo cambia automáticamente el 01-12-2026. ':'')+(provider==='anthropic'?'Algunas organizaciones de Anthropic no permiten llamadas desde navegador. ':'')+'Acceso según cuenta. Catálogo revisado: '+CATALOG_DATE+'.';
}
function fillModels(){
  const provider=$('provider').value;$('model').replaceChildren();
  for(const [id,item]of Object.entries(MODEL_PRESETS)){if(item.provider!==provider||item.legacy)continue;const option=document.createElement('option');option.value=id;option.textContent=item.label;$('model').append(option);}
  const custom=document.createElement('option');custom.value='custom';custom.textContent='Otro modelo de '+PROVIDERS[provider].name;$('model').append(custom);
  $('model').value=PROVIDERS[provider].defaultModel;showModelDetails();
}
$('provider').onchange=()=>{$('apiKey').value='';fillModels();};
$('model').onchange=showModelDetails;
$('connect').onclick=()=>work('Guardando la conexión en esta sesión…',async()=>{
  const model=$('model').value==='custom'?$('customModel').value.trim():$('model').value;
  await api('connect',{provider:$('provider').value,key:$('apiKey').value.trim(),model,limit:$('budget').value,input:$('inputPrice').value,output:$('outputPrice').value});
  $('apiKey').value='';aiReady=!!trainer.ai.key;$('aiSettings').open=false;
  $('keyStatus').textContent=aiReady?'Clave cargada solo para esta sesión. Se enviará directamente a '+PROVIDERS[trainer.ai.provider].name+' al usar la IA.':'Sin clave para este proveedor. El rival local está disponible.';
  notice(aiReady?'Conexión preparada. El coste se registra por partida al llamar a la IA.':'Límite y modelo actualizados.');
});
$('disconnect').onclick=()=>{if(busy)return;trainer.ai.key='';aiReady=false;$('apiKey').value='';updateConnection();$('keyStatus').textContent='Clave eliminada de esta sesión.';notice('IA desconectada. El rival local sigue disponible.');};
$('offline').onclick=()=>work('El rival está pensando…',async()=>{game=await api('offline');notice(game.notice);if(game.over)finish();},{natural:true});
$('flip').onclick=()=>{flipped=!flipped;drawBoard();};
$('resign').onclick=()=>work('Cerrando la partida…',async()=>{if(!confirm('¿Terminar esta partida por rendición y pasar a la revisión?'))return;game=await api('resign');reviewFen=null;finish();});
$('retry').onclick=()=>work('El rival está pensando…',async()=>{game=await api('retry');notice(game.notice);if(game.over)finish();},{natural:true});
$('report').onclick=()=>work('Revisando tus errores y preparando ejercicios reales…',async()=>{game=await api('report',{reflection:$('reflection').value});renderReport();});
$('practice').onclick=()=>{selectExercise(0);$('practiceBoardPrompt').scrollIntoView({behavior:'smooth',block:'start'});};
$('retryExercise').onclick=()=>work('Preparando otro intento…',async()=>{const i=exerciseIndex;game=await api('retryExercise',{ply:currentExercise().ply});selectExercise(i);});
$('returnGame').onclick=()=>{clearTimeout(preludeTimer);reviewFen=null;exerciseIndex=null;selected=null;$('reviewPanel').hidden=true;$('exercisePanel').hidden=true;render();};
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
setInterval(()=>{if(!trainer.game)return;const wasOver=game?.over,oldMoves=game?.moves.length,oldId=game?.id;game=trainer.view();if(oldId!==game.id)flipped=game.human==='b';showClocks();showThinking();if(busy&&oldMoves!==game.moves.length)render();if(game.over&&!wasOver){finish();render();}},100);
const oldNew=$('newGame').onclick;$('newGame').onclick=()=>{clearTimeout(preludeTimer);trainer.stopClock();trainer.game=null;oldNew();renderTraining();$('eloInput').value=rating;showClocks();};
fillModels();drawBoard();renderJournal();renderTraining();updateConnection();
