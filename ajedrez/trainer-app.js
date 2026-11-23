import {Chess} from './vendor/chess.js';
import {BrowserEngine,puzzleLength} from './core.js?v=plain-coaching';
import {parseGame,ImportedAnalyzer,makePuzzles,PuzzleRunner,THEMES,HABITS} from './imports.js?v=plain-coaching';
import {PuzzleLibrary,latestGame} from './library.js';
import {getLanguage,setLanguage} from './i18n.js';
import {openBrowserDatabase} from './browser-db.js';
import {replayLine,replayLessonLine,explainReplay,replayCoachStep,compareReplayLines} from './learning.js?v=plain-coaching';
const $=id=>document.getElementById(id),t=(en,es)=>getLanguage()==='es'?es:en;
const locale=()=>getLanguage()==='es'?'es-CL':'en-US';
let browserStorage;try{browserStorage=localStorage;}catch{browserStorage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}
const libraryLock='between-bishops-library-write';
let databaseNotice='';
try{const open=()=>openBrowserDatabase({legacyStorage:browserStorage});browserStorage=await (navigator.locks?navigator.locks.request(libraryLock,open):open());}catch{databaseNotice='Using limited browser storage. Keep exported backups. / Almacenamiento limitado: conserva respaldos exportados.';}
let library=new PuzzleLibrary({storage:browserStorage});
const engine=new BrowserEngine(),analyzer=new ImportedAnalyzer(engine);
let tab='import',selectedGameId=null,reviewMovePly=null,busy=false,analysisAbort=null;
let importView='paste',guided=null,playerHeaders={};
let runner=null,queue=[],used=new Set(),phase='challenge',selected=null,flipped=false,motion=null,previewFen=null,wrongMove=null,transitionTimer=null,extraPractice=false,finishedSet=false;
let blindSession=false,sessionHabit=null,habitRevealed=false;
const boardState=new WeakMap();
let replay=null;
$('username').value=library.username;
function notice(message){$('notice').textContent=message||'';$('notice').hidden=!message;}
function theme(id){return THEMES[id]?.[getLanguage()]||THEMES.calculation[getLanguage()];}
function ownName(g){return g.human==='w'?g.white:g.black;}
function gameDate(g){return g.date&&g.date!=='????.??.??'?g.date.replaceAll('.','-'):new Date(g.importedAt).toLocaleDateString(locale());}
function resultLabel(g){const win=g.result===(g.human==='w'?'1-0':'0-1');return win?t('Win','Victoria'):g.result==='1/2-1/2'?t('Draw','Tablas'):g.result==='*'?t('Unfinished','Sin terminar'):t('Loss','Derrota');}
function dueLabel(p){return p.dueAt<=Date.now()?t('Due now','Pendiente ahora'):new Date(p.dueAt).toLocaleString(locale(),{dateStyle:'medium',timeStyle:'short'});}
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function button(text,action,className=''){const b=element('button',text,className);b.type='button';b.onclick=action;return b;}
function puzzleCount(count){return count+' '+(count===1?t('puzzle','puzle'):t('puzzles','puzles'));}
function counterplay(played,buildLine=replayLine){
 if(!played?.uci||!(played.fen||played.beforeFen))return [];
 const pv=played.counterplay||played.after?.pv||[];
 return buildLine(played.fen||played.beforeFen,[played.uci,...pv]);
}
function renderReplay(animate=false){
 const {index,fen,human,alternative,original,showingAlternative,fullLine}=replay;
 const line=showingAlternative?alternative:original;
 const visible=Math.min(line.length,fullLine?line.length:3);
 const move=line[index-1];
 const board=$('replayBoard');
 const coach=replayCoachStep(line,index,human,getLanguage());
 drawBoard(board,move?.fen||fen,{
  flip:human==='b',motion:animate?move:null,lastMove:move,wrong:index===1&&!showingAlternative?move:null
 });
 for(const square of board.children){
  square.classList.toggle('coach-source',square.dataset.square===coach.source);
  square.classList.toggle('coach-target',coach.targets.includes(square.dataset.square));
 }
 $('replayTargetLegend').hidden=!coach.targets.length;
 $('replayFocus').textContent=coach.title;
 $('replayCaption').textContent=coach.text;
 $('replayCount').textContent=index+' / '+visible;
 $('replayPrevious').disabled=index===0;
 $('replayNext').disabled=index===visible;
 $('replayMore').hidden=index!==visible||visible===line.length;
 $('replayMore').textContent=line.at(-1)?.mate
  ?t('Continue to checkmate','Seguir hasta el mate')
  :t('Show more moves','Ver más jugadas');
 const comparison=index?compareReplayLines(original,alternative,human,getLanguage()):'';
 const outcome=!comparison&&index===visible&&index>1&&!move?.mate?explainReplay(line.slice(0,index),human,getLanguage()):'';
 $('replayTakeaway').hidden=!(comparison||outcome);
 $('replayTakeawayTitle').textContent=comparison?t('Why the alternative matters','Por qué importa la alternativa'):t('What happened so far','Qué pasó hasta aquí');
 $('replaySummary').textContent=comparison||outcome;
 $('replayAlternative').hidden=!alternative.length;
 $('replayAlternative').textContent=showingAlternative?t('See my move','Volver a mi jugada'):t('Compare with an alternative','Comparar con una alternativa');
 $('replayTitle').textContent=showingAlternative?t('An alternative from the same position','Una alternativa desde la misma posición'):replay.title;
}
function stepReplay(delta){
 replay.index+=delta;
 renderReplay(delta>0);
}
function showCounterplay(played,human,inGame){
 const line=counterplay(played,replayLessonLine);
 if(line.length<2)return;
 const fen=played.fen||played.beforeFen;
 const alternative=inGame?replayLessonLine(fen,played.before?.pv||[]):[];
 replay={
  index:0,original:line,alternative:alternative[0]?.san===line[0].san?[]:alternative,showingAlternative:false,fullLine:false,fen,human,
  title:inGame?t('What went wrong in your game?','¿Qué pasó en tu partida?'):t('What did this move allow?','¿Qué permitió esta jugada?')
 };
 renderReplay();
 $('replayDialog').showModal();
}
function renderNavigation(){
 const current=guided&&tab==='streak'?'import':tab;
 for(const b of document.querySelectorAll('[data-tab]')){
  const active=b.dataset.tab===current;
  b.classList.toggle('selected',active);
  if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 const step=tab==='streak'?2:importView==='lesson'?1:0;
 $('reviewSteps').hidden=current!=='import';
 for(const [i,item] of Array.from($('reviewSteps').children).entries()){
  if(i===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
  item.classList.toggle('complete',i<step||step===2&&finishedSet);
 }
}
function switchTab(value){
 tab=value;
 for(const name of ['import','bank','streak'])$(name+'Tab').hidden=name!==value;
 renderNavigation();
 if(value==='bank'){renderBank();renderProgress();}
 if(value==='streak')renderStreak();
}
function focusHeading(id){
 const heading=$(id);
 heading.focus({preventScroll:true});
 heading.scrollIntoView({block:'nearest'});
}
function showImport(view){
 importView=view;
 switchTab('import');
 renderReview();
 focusHeading(view==='lesson'?'lessonTitle':'importTitle');
}
function importError(message='',field){
 $('importError').textContent=message;
 $('importError').hidden=!message;
 for(const id of ['pgn','side','eloFallback']){
  if(id===field)$(id).setAttribute('aria-invalid','true');else $(id).removeAttribute('aria-invalid');
 }
}
function newGame(){
 $('pgn').value='';$('pgnFile').value='';$('side').value='auto';$('eloFallback').value='';
 $('gameOptions').open=false;$('gameLog').open=false;
 $('analysisProgress').hidden=true;importError();notice(null);
 formatPlayers();
 showImport('paste');
}
function formatPlayers(headers={}){
 playerHeaders=headers;
 for(const [index,key,label] of [[1,'White',t('White','Blancas')],[2,'Black',t('Black','Negras')]]){
  const name=headers[key];
  $('side').options[index].textContent=name?label+' · '+name:label;
 }
}
function gameHabit(game){
 const patterns=new Map();
 for(const move of game.moves){
  if(move.color===game.human&&move.loss>=50&&move.pattern)patterns.set(move.pattern,(patterns.get(move.pattern)||0)+1);
 }
 return [...patterns].sort((a,b)=>b[1]-a[1])[0]?.[0]||'calculation';
}
function localize(){
 document.documentElement.lang=getLanguage();document.title='Between Bishops · '+t('Learn from your mistakes','Aprende de tus errores');
 for(const e of document.querySelectorAll('[data-en][data-es]'))e.textContent=e.dataset[getLanguage()];
 $('languageFlag').src='./flags/'+getLanguage()+'.svg';$('languageFlag').alt=getLanguage()==='en'?'English':'Español';$('languageCode').textContent=getLanguage().toUpperCase();$('language').title=t('Switch to Spanish','Cambiar a inglés');$('language').setAttribute('aria-label',$('language').title);$('helpLink').href=getLanguage()==='en'?'./README.md':'./LEEME.md';
 $('pgn').placeholder=t('[White "YourName"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 ...','[White "TuUsuario"]\n[Black "Rival"]\n\n1. e4 e5 2. Nf3 Nc6 ...');
 formatPlayers(playerHeaders);
 $('reviewSteps').setAttribute('aria-label',t('Game review steps','Pasos de la revisión'));
 $('puzzleBoard').setAttribute('aria-label',t('Puzzle board','Tablero del puzle'));$('reviewBoard').setAttribute('aria-label',t('Original game review board','Tablero de revisión de la partida'));renderAll();
 $('replayBoard').setAttribute('aria-label',t('Replay board','Tablero de la repetición'));
}
async function work(fn){
 if(busy)return;
 if(!navigator.locks){notice(t('Use a browser with Web Locks support to safely save training progress.','Usa un navegador compatible con Web Locks para guardar el progreso de forma segura.'));return;}
 busy=true;
 document.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=true);
 if(analysisAbort)$('cancelAnalysis').disabled=false;
 try{
  await navigator.locks.request(libraryLock,async()=>{
   await browserStorage.flush?.();
   await browserStorage.refresh?.();
   library=new PuzzleLibrary({storage:browserStorage});
   if(library.loadError)throw new Error(library.loadError);
   try{await fn();}finally{await browserStorage.flush?.();}
  });
 }catch(e){
  notice(e.name==='AbortError'?t('Analysis paused. Completed calculations were saved.','Análisis pausado. Se guardaron los cálculos completados.'):e.message);
 }finally{
  busy=false;
  document.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=false);
  renderAll();
 }
}
function renderAll(){
 const latest=latestGame(library.games);$('currentElo').textContent=latest?library.currentElo:'—';$('eloSource').textContent=latest?ownName(latest)+' · '+gameDate(latest):t('From your latest game','Según tu última partida');
 $('gameTotal').textContent=library.games.length;$('gameTotal').nextElementSibling.textContent=library.games.length===1?t('game','partida'):t('games','partidas');$('puzzleTotal').textContent=library.puzzles.length;$('dueTotal').textContent=library.queue().length;$('bestStreak').textContent=library.data.streak.best;$('streakCount').textContent=library.data.streak.current;
 renderNavigation();renderHistory();renderReview();renderBank();renderStreak();renderProgress();
}
function renderHistory(){
 const host=$('gameHistory');host.replaceChildren();if(!library.games.length){host.append(element('p',t('No games imported yet.','Aún no hay partidas importadas.'),'muted'));return;}
 for(const g of library.games.slice().reverse()){
  const b=button(g.white+' · '+g.black,()=>{
   selectedGameId=g.id;reviewMovePly=null;notice(null);importError();
   $('gameLog').open=false;
   if(!g.report){
    $('pgn').value=g.pgn;$('side').value=g.human;$('eloFallback').value=g.elo;
    formatPlayers(g.headers);$('analysisProgress').hidden=true;
   }
   showImport(g.report?'lesson':'paste');
   renderHistory();
  },'history-button'+(selectedGameId===g.id?' active':''));
  b.append(element('small',gameDate(g)+' · '+resultLabel(g)+' · Elo '+g.elo+' · '+puzzleCount(library.puzzles.filter(p=>p.gameId===g.id).length)+(g.status==='partial'||g.status==='imported'?t(' · analysis pending',' · análisis pendiente'):'')));host.append(b);
 }
}
function renderReview(){
 const g=library.game(selectedGameId),showLesson=importView==='lesson'&&!!g?.report;
 $('reviewPanel').hidden=!showLesson;$('importPanel').hidden=showLesson;
 $('backToLesson').hidden=!g?.report||busy;
 if(!showLesson)return;
 $('gameMeta').textContent=gameDate(g)+' · '+resultLabel(g)+' · '+ownName(g)+' · Elo '+g.elo;$('gameTitle').textContent=g.white+' vs '+g.black;
 $('reviewStats').replaceChildren();for(const [key,label]of [['blunder',t('Blunders','Errores graves')],['mistake',t('Mistakes','Errores')],['inaccuracy',t('Inaccuracies / omissions','Imprecisiones / omisiones')]]){const box=element('div',label);box.prepend(element('strong',g.report.counts[key]));$('reviewStats').append(box);}
 $('lessonHabit').hidden=!g.report.evaluated;
 $('lessonHabitText').textContent=(HABITS[gameHabit(g)]||HABITS.calculation)[getLanguage()];
 $('reviewSummary').textContent=g.report.texts[getLanguage()];
 const puzzles=library.puzzles.filter(p=>p.gameId===g.id);
 const issues=g.report.counts.blunder+g.report.counts.mistake+g.report.counts.inaccuracy;
 $('reviewIntro').textContent=g.report.texts[getLanguage()].split('\n\n')[0];
 $('generationNote').textContent=g.report.missing
  ?t('Some moves could not be checked. You can paste this game again to finish the analysis.','Algunas jugadas quedaron sin evaluar. Puedes volver a pegar esta partida para completar el análisis.')
  :puzzles.length?t('Put the lesson into practice with positions from this game.','Pon en práctica la lección con posiciones de esta partida.')
  :issues?t('No clear position from this game was suitable for a puzzle.','Esta partida no dejó una posición clara para convertirla en puzle.'):t('No clear errors were found to turn into puzzles.','No se encontraron errores claros para convertirlos en puzles.');
 const practiceButton=$('startGamePractice');
 practiceButton.hidden=!puzzles.length;practiceButton.disabled=busy;
 practiceButton.textContent=guided?.gameId===g.id&&!finishedSet&&runner
  ?t('Resume practice','Continuar práctica')
  :t('Practice '+puzzleCount(puzzles.length),'Practicar '+puzzleCount(puzzles.length));
 $('newGame').classList.toggle('primary',!puzzles.length);
 const example=g.moves.find(move=>move.color===g.human&&move.loss>=50&&counterplay(move).length>1);
 $('lessonReplay').hidden=!example;
 $('lessonReplay').onclick=()=>showCounterplay(example,g.human,true);
 const host=$('gamePuzzles');host.replaceChildren();for(const p of puzzles){const card=element('div',undefined,'puzzle-card');card.append(element('strong',theme(p.pattern)),element('p',t('Your move ','Tu jugada ')+Math.ceil(p.ply/2)+(g.human==='w'?'. ':'... ')+p.original.san+' · '+p.targetSteps+' '+t('of your moves','jugadas tuyas')+' · Elo '+p.elo),button(t('Retry this moment','Rehacer este momento'),()=>startSingle(p.id)));host.append(card);}
 const moves=$('reviewMoves');moves.replaceChildren();for(const m of g.moves){const b=button(Math.ceil(m.ply/2)+(m.color==='w'?'. ':'... ')+m.san,()=>{reviewMovePly=m.ply;renderReview();},m.kind||'');moves.append(b);}
 const m=g.moves.find(m=>m.ply===reviewMovePly)||g.moves.find(m=>m.color===g.human&&m.loss>=50)||g.moves.at(-1);if(!m)return;
 drawBoard($('reviewBoard'),m.afterFen,{flip:g.human==='b'});
 const line=m.color===g.human&&m.loss>=50?counterplay(m):[];
 $('moveExplanation').textContent=Math.ceil(m.ply/2)+(m.color==='w'?'. ':'... ')+m.san+'\n'+(line.length>1?explainReplay(line,g.human,getLanguage()):m.color===g.human?t('Select a marked error to see what it allowed.','Elige un error marcado para ver qué permitió.'):t('Only your moves are evaluated.','Solo se evalúan tus jugadas.'));
 $('reviewReplay').hidden=line.length<2;
 $('reviewReplay').onclick=()=>showCounterplay(m,g.human,true);
}
function renderBank(){
 const selectedFilter=$('patternFilter').value;$('patternFilter').replaceChildren();const option=element('option',t('All error types','Todos los errores'));option.value='all';$('patternFilter').append(option);for(const id of Object.keys(THEMES)){const option=element('option',theme(id));option.value=id;$('patternFilter').append(option);}$('patternFilter').value=selectedFilter||'all';
 const rows=$('bankList');rows.replaceChildren();const puzzles=library.puzzles.filter(p=>($('patternFilter').value==='all'||p.pattern===$('patternFilter').value)&&($('eloFilter').value==='all'||Math.abs(p.elo-library.currentElo)<=400));
 if(!puzzles.length)rows.append(element('p',t('No puzzles match this view. Analyze a game to grow your bank.','No hay puzles en esta vista. Analiza una partida para aumentar tu banco.'),'muted'));
 for(const p of puzzles.slice().reverse()){const g=library.game(p.gameId),row=element('div',undefined,'bank-row'),info=element('div');info.append(element('strong',theme(p.pattern)),element('p',gameDate(g)+' · '+ownName(g)+' · Elo '+p.elo+' · '+t('move ','jugada ')+Math.ceil(p.ply/2)),element('p',t('Review: ','Repaso: ')+dueLabel(p)+' · '+p.attempts.filter(a=>!a.good).length+' '+(p.attempts.filter(a=>!a.good).length===1?t('failed attempt','intento incorrecto'):t('failed attempts','intentos incorrectos'))));const history=element('details');history.append(element('summary',t('Attempts & reviews','Intentos y repasos')));const events=[...p.attempts.map(a=>({at:a.at,text:t('Step ','Paso ')+a.step+' · '+a.san+' · '+(a.good?t('correct','correcto'):t('incorrect','incorrecto'))+(a.hinted?t(' · with hint',' · con pista'):'' )})),...(p.hints||[]).map(h=>({at:h.at,text:t('Hint used at step ','Pista usada en el paso ')+h.step})),...p.reviews.map(r=>({at:r.at,text:r.clean?t('Clean review completed','Repaso limpio completado'):t('Review completed with retries or help','Repaso completado con reintentos o ayuda')}))].sort((a,b)=>String(b.at).localeCompare(String(a.at)));if(!events.length)history.append(element('p',t('Not practiced yet.','Aún no practicado.')));for(const event of events.slice(0,12))history.append(element('p',new Date(event.at).toLocaleString(locale())+' · '+event.text));info.append(history);row.append(info,button(t('Practice','Practicar'),()=>startSingle(p.id)));rows.append(row);}
 const patterns=$('weaknesses');patterns.replaceChildren();const weaknesses=library.weaknesses();if(!weaknesses.length)patterns.append(element('p',t('Patterns appear after a game is analyzed.','Los patrones aparecen al analizar una partida.'),'muted'));
 for(const w of weaknesses){const row=element('div',undefined,'weakness-row');row.append(element('strong',theme(w.id)),element('p',w.count+' '+(w.count===1?t('moment in ','momento en '):t('moments in ','momentos en '))+w.games+' '+(w.games===1?t('game','partida'):t('games','partidas'))+' · '+w.failed+' '+(w.failed===1?t('failed puzzle attempt','fallo en puzles'):t('failed puzzle attempts','fallos en puzles'))),element('p',w.games>=2?t('Repeated across games.','Repetido entre partidas.'):t('Initial signal: only one game so far.','Señal inicial: solo una partida por ahora.')));row.append(element('p',w.clean+' '+(w.clean===1?t('clean review','repaso limpio'):t('clean reviews','repasos limpios'))+' · '+w.due+' '+(w.due===1?t('puzzle due','puzle pendiente'):t('puzzles due','puzles pendientes'))));patterns.append(row);}
}
async function importGame(){
 let parsed;
 importError();notice(null);
 try{
  parsed=parseGame($('pgn').value,{username:$('username').value,side:$('side').value,elo:$('eloFallback').value});
 }catch(e){
  const field=e.field||'pgn';
  if(e.field){formatPlayers(e.headers);$('gameOptions').open=true;}
  const message=field==='side'?t('Which player are you? Choose your color, then analyze again.','¿Con qué color jugaste? Elígelo y vuelve a pulsar Analizar.')
   :field==='eloFallback'?t('This game is missing your Elo. Enter it above, then analyze again.','Falta tu Elo en el PGN. Escríbelo arriba y vuelve a pulsar Analizar.')
   :t('Paste the full PGN of one game, including the list of moves.','Pega el PGN completo de una sola partida, incluida la lista de jugadas.');
  importError(message,field);$(field).focus();return;
 }
 formatPlayers(parsed.headers);
 let ready=false;
 analysisAbort=new AbortController();notice(null);await work(async()=>{
  const playerName=parsed.headers[parsed.human==='w'?'White':'Black'];
  if(playerName&&playerName!=='?')$('username').value=playerName;
  library.setUsername($('username').value);
  const existing=library.game(parsed.id);
  const pending=existing?structuredClone(existing):parsed;selectedGameId=pending.id;reviewMovePly=null;
  if(existing?.status==='analyzed'){library.addPuzzles(makePuzzles(existing,{weaknesses:library.weaknesses()}));ready=true;return;}
  pending.status='partial';library.addGame(pending);$('gameOptions').open=false;$('analysisProgress').hidden=false;$('analysisBar').value=0;$('analysisPercent').textContent='0%';$('analysisText').textContent=t('Getting the board ready…','Preparando el tablero…');
  $('importPanel').classList.add('is-analyzing');
  $('importTitle').textContent=t('Analyzing your game','Analizando tu partida');
  focusHeading('importTitle');
  $('detectedPlayer').textContent=ownName(parsed)+' · '+(parsed.human==='w'?t('White','Blancas'):t('Black','Negras'))+' · Elo '+parsed.elo;
  $('analysisProgress').scrollIntoView({block:'nearest'});
  const result=await analyzer.analyze(pending,{signal:analysisAbort.signal,onProgress:({done,total,percent,move})=>{
   Object.assign(pending.moves[move.ply-1],structuredClone(move));$('analysisBar').value=percent;$('analysisPercent').textContent=percent+'%';$('analysisText').textContent=t('Analyzing your move ','Analizando tu jugada ')+Math.ceil(move.ply/2)+' · '+done+'/'+total;library.addGame(pending);
  }});
  library.addGame(result);library.addPuzzles(makePuzzles(result,{weaknesses:library.weaknesses()}));ready=true;
 });analysisAbort=null;$('analysisProgress').hidden=true;$('cancelAnalysis').disabled=true;
 $('importPanel').classList.remove('is-analyzing');
 $('importTitle').textContent=$('importTitle').dataset[getLanguage()];
 if(ready&&!$('notice').textContent){$('gameLog').open=false;showImport('lesson');}
}
function renderProgress(){
 const host=$('trainingProgress'),pattern=$('patternFilter').value;
 const filter=pattern&&pattern!=='all'?pattern:undefined;
 const {fresh,repeated}=library.trainingProgress(filter);
 const games=library.gameProgress(filter);
 const entry=(title,body)=>{const row=element('div',undefined,'weakness-row');row.append(element('strong',title),element('p',body));return row;};
 const score=row=>row.total?t(row.clean+' / '+row.total+' solved cleanly',row.clean+' / '+row.total+' resueltos sin ayuda ni fallos'):t('No scored attempts yet.','Todavía sin intentos medidos.');
 host.replaceChildren(entry(t('First look · theme hidden','Primera vez · tema oculto'),score(fresh)),entry(t('Scheduled repeat reviews','Repasos programados'),score(repeated)));
 const rate=group=>{
  if(!group.moves)return t('No sample yet','Todavía sin muestra');
  const percent=new Intl.NumberFormat(locale(),{style:'percent',maximumFractionDigits:1}).format(group.errors/group.moves);
  return percent+t(' ('+group.errors+'/'+group.moves+' evaluated moves, '+group.games+' games)',' ('+group.errors+'/'+group.moves+' jugadas evaluadas, '+group.games+' partidas)');
 };
 const comparison=games?t('Time control '+games.control+'. Latest: ','Ritmo '+games.control+'. Recientes: ')+rate(games.recent)+t('. Previous: ','. Anteriores: ')+rate(games.previous)+'.':t('Import PGNs with a TimeControl tag to compare games at the same pace.','Importa PGN con la etiqueta TimeControl para comparar partidas del mismo ritmo.');
 host.append(entry(t('In your games','En tus partidas'),comparison));
}
function activeFen(){if(!runner)return new Chess().fen();if(phase==='prelude')return runner.puzzle.beforeOpponentFen||runner.puzzle.fen;if(phase==='checking')return previewFen||runner.fen;if(phase==='feedback'||phase==='wrong')return runner.answer?.afterFen||runner.fen;return runner.fen;}
function renderStreak(){
 const guidedGame=guided&&library.game(guided.gameId);
 const guidedDone=guidedGame&&finishedSet&&!runner;
 $('streakHeader').hidden=!!guidedGame;
 $('gamePracticeHeader').hidden=!guidedGame||guidedDone;
 $('gamePracticeDone').hidden=!guidedDone;
 if(guidedGame){
  $('gamePracticeTitle').textContent=t('Puzzle ','Puzle ')+used.size+t(' of ',' de ')+guided.total;
  $('gamePracticeSource').textContent=guidedGame.white+' vs '+guidedGame.black;
  $('gamePracticeRecap').textContent=t(
   'You solved '+puzzleCount(guided.total)+' from your game. Find future reviews in Daily practice.',
   'Resolviste '+puzzleCount(guided.total)+' de tu partida. Encontrarás los próximos repasos en Práctica diaria.'
  );
  $('gamePracticeHabit').textContent=(HABITS[gameHabit(guidedGame)]||HABITS.calculation)[getLanguage()];
 }
 $('queueInfo').textContent=t('Uses your latest game Elo (','Usa el Elo de tu última partida (')+library.currentElo+t('), repeated patterns and scheduled reviews.', '), los patrones repetidos y los repasos pendientes.');$('streakCount').textContent=library.data.streak.current;
 const showHabit=!guidedGame&&sessionHabit&&(habitRevealed||finishedSet);
 $('sessionHabit').hidden=!showHabit;
 $('habitText').textContent=showHabit?(HABITS[sessionHabit]||HABITS.calculation)[getLanguage()]:'';
 $('streakWorkspace').hidden=!runner;$('streakEmpty').hidden=!!runner||!!guidedGame;
 if(!runner){
  const due=library.queue().length;
  $('streakEmptyTitle').textContent=finishedSet?t('Set complete','Serie terminada'):!library.puzzles.length?t('Create your first puzzles','Crea tus primeros puzles'):due?t('Your next review is ready','Tu próximo repaso está listo'):t('You are up to date','Estás al día');
  $('streakEmptyText').textContent=library.puzzles.length?t(puzzleCount(due)+' ready to review.',puzzleCount(due)+' para repasar.'):t('Paste a game to get puzzles based on your own moves.','Pega una partida para recibir puzles de tus propias jugadas.');
  $('startStreak').hidden=!due;$('startStreak').disabled=busy;
  $('practiceAhead').hidden=!library.puzzles.length;
  $('practiceAhead').className=due?'quiet':'primary compact';
  $('practiceAhead').disabled=busy;
  $('practiceImport').hidden=!!library.puzzles.length;
  return;
 }
 const p=runner.puzzle,g=library.game(p.gameId);$('puzzleContext').textContent=gameDate(g)+' · '+t('From your move ','De tu jugada ')+Math.ceil(p.ply/2)+' · Elo '+p.elo;
 const showTheme=!blindSession||runner.attempts.length>0;
 $('puzzleTheme').hidden=!showTheme;
 $('puzzleSource').hidden=!!guidedGame;
 $('puzzleTheme').textContent=showTheme?theme(p.pattern):'';$('puzzleTitle').textContent=runner.done?t('Puzzle complete','Puzle completado'):t('What would you play?','¿Qué jugarías?');$('puzzleSource').textContent=g.white+' vs '+g.black+' · '+t('You play ','Juegas con ')+(p.human==='w'?t('White','blancas'):t('Black','negras'));
 $('puzzleSource').textContent+=extraPractice?t(' · Extra practice',' · Práctica extra'):'';
 const side=p.human==='w'?t('White','Blancas'):t('Black','Negras');
 $('puzzlePrompt').textContent=phase==='prelude'?t('Watch the opponent move…','Observa la jugada del rival…')
  :phase==='checking'?t('Checking your move…','Comprobando tu jugada…')
  :runner.done?t('Solved. Read the explanation, then continue.','Resuelto. Lee la explicación y continúa.')
  :phase==='wrong'?t('Try again after the board resets.','Vuelve a intentarlo cuando se restablezca el tablero.')
  :phase==='feedback'?t('Good move. Your opponent replies…','Buena jugada. El rival responde…')
  :side+t(' to move · ',' juegan · ')+t('Move ','Jugada ')+(runner.step+1)+'/'+p.targetSteps;
 $('puzzleFeedback').textContent=runner.answer?runner.answer.feedbackTexts[getLanguage()]:'';$('puzzleFeedback').className='prose'+(runner.answer?(runner.answer.good?' feedback-good':' feedback-bad'):'');
 const replayed=runner.answer&&!runner.answer.good?runner.answer:runner.done?runner.puzzle.original:null;
 $('puzzleReplay').hidden=counterplay(replayed).length<2;
 $('puzzleReplay').disabled=busy;
 $('puzzleReplay').textContent=runner.done?t('Replay my original mistake','Ver mi error en la partida'):t('Show what the opponent can do','Ver cómo responde el rival');
 $('puzzleReplay').onclick=()=>showCounterplay(replayed,p.human,runner.done);
 const record=library.puzzle(p.id);$('puzzleSchedule').textContent=runner.done?(runner.failed||runner.assisted?t('Saved as retried or assisted. Next review: ','Guardado con reintentos o ayuda. Próximo repaso: '):t('Clean solution. Next review: ','Solución limpia. Próximo repaso: '))+dueLabel(record):t('Hints and wrong attempts stay in your record.','Las pistas y los fallos quedan en tu registro.');
 $('hint').disabled=busy||phase!=='challenge';$('restartPuzzle').disabled=busy;
 $('hint').hidden=runner.done;$('restartPuzzle').hidden=runner.done;
 $('puzzleTools').hidden=runner.done;
 $('nextPuzzle').hidden=!runner.done;$('nextPuzzle').disabled=busy;
 $('nextPuzzle').textContent=queue.length?t('Next puzzle','Siguiente puzle'):guidedGame?t('Finish practice','Terminar práctica'):t('Finish set','Terminar serie');
 drawBoard($('puzzleBoard'),activeFen(),{flip:flipped,interactive:!busy&&!runner.done&&phase==='challenge',selected,hint:runner.hintSquare,wrong:wrongMove,motion});motion=null;
}
function activatePuzzle(id){
 clearTimeout(transitionTimer);selected=null;wrongMove=null;previewFen=null;const stored=library.puzzle(id);if(!stored){runner=null;renderStreak();return;}used.add(id);
 const cap=library.stepLimit();const puzzle={...structuredClone(stored),targetSteps:Math.min(cap,puzzleLength(stored.fen,stored.original.before?.pv||stored.solution))};
 runner=new PuzzleRunner(puzzle,engine);library.openPuzzle(id,runner.id,blindSession);flipped=puzzle.human==='b';phase=puzzle.beforeOpponentFen?'prelude':'challenge';renderStreak();
 if(phase==='prelude'){const runId=runner.id;transitionTimer=setTimeout(()=>{if(runner?.id!==runId)return;phase='challenge';motion=puzzle.opponentMove;renderStreak();},650);}
}
function startQueue(ahead=false){
 return work(()=>{
  guided=null;
  const ranked=library.queue({ahead});
  sessionHabit=ranked[0]?.pattern||null;
  const nextSet=[];
  while(ranked.length){
   const previous=nextSet.at(-1)?.pattern;
   const due=ranked[0].dueAt<=Date.now();
   const different=ranked.findIndex(p=>p.pattern!==previous&&(p.dueAt<=Date.now())===due);
   nextSet.push(...ranked.splice(Math.max(0,different),1));
  }
  queue=nextSet.map(p=>p.id);used=new Set();finishedSet=false;extraPractice=ahead;
  blindSession=true;habitRevealed=false;library.data.streak.current=0;library.save();
  clearTimeout(transitionTimer);runner=null;switchTab('streak');
  if(queue.length)activatePuzzle(queue.shift());
 });
}
async function startGamePractice(){
 const game=library.game(selectedGameId);
 if(!game?.report)return;
 if(guided?.gameId===game.id&&runner&&!finishedSet){
  switchTab('streak');focusHeading('gamePracticeTitle');return;
 }
 await work(()=>{
  const puzzles=library.puzzles.filter(p=>p.gameId===game.id);
  if(!puzzles.length)return;
  guided={gameId:game.id,total:puzzles.length};
  queue=puzzles.map(p=>p.id);used=new Set();finishedSet=false;extraPractice=false;
  blindSession=true;sessionHabit=null;habitRevealed=false;
  library.data.streak.current=0;library.save();
  activatePuzzle(queue.shift());switchTab('streak');
 });
 if(tab==='streak'&&guided?.gameId===game.id)focusHeading('gamePracticeTitle');
}
function backToLesson(){
 if(guided)selectedGameId=guided.gameId;
 showImport('lesson');
}
function openDailyPractice(){
 if(guided){clearTimeout(transitionTimer);guided=null;runner=null;queue=[];finishedSet=false;}
 switchTab('streak');
}
function startSingle(id){
 return work(()=>{
  const puzzle=library.puzzle(id);if(!puzzle)return;
  guided=null;queue=[];used=new Set();finishedSet=false;extraPractice=puzzle.dueAt>Date.now();
  blindSession=false;sessionHabit=puzzle.pattern;habitRevealed=false;
  library.data.streak.current=0;library.save();switchTab('streak');activatePuzzle(id);
  $('streakTab').scrollIntoView({behavior:'smooth',block:'start'});
 });
}
async function nextPuzzle(){
 if(busy||!runner?.done)return;
 await work(()=>{
  const next=queue.find(id=>!used.has(id));queue=queue.filter(id=>id!==next);
  if(next)activatePuzzle(next);else{runner=null;finishedSet=true;}
 });
 if(guided)focusHeading(runner?'gamePracticeTitle':'gamePracticeDoneTitle');
}
function drawBoard(host,fen,{flip=false,interactive=false,selected=null,hint=null,wrong=null,motion=null,lastMove=null}={}){
 const c=new Chess(fen),pieces=Object.fromEntries(c.board().flat().filter(Boolean).map(p=>[p.square,p])),legal=interactive?c.moves({verbose:true}):[];
 const signature=fen+'|'+flip;const old=boardState.get(host),moves=[];
 if(motion&&old&&!matchMedia('(prefers-reduced-motion: reduce)').matches){moves.push({from:motion.from,to:motion.to});if(motion.san==='O-O'||motion.san==='O-O-O'){const rank=motion.from[1];moves.push({from:(motion.to[0]==='g'?'h':'a')+rank,to:(motion.to[0]==='g'?'f':'d')+rank});}for(const m of moves)m.origin=host.querySelector('[data-square="'+m.from+'"]')?.getBoundingClientRect();}
 if(old!==signature){host.replaceChildren();const files=flip?'hgfedcba':'abcdefgh',ranks=flip?'12345678':'87654321';for(let row=0;row<8;row++)for(let col=0;col<8;col++){
  const square=files[col]+ranks[row],p=pieces[square],b=element('button',undefined,'square'+((files.charCodeAt(col)-97+Number(ranks[row]))%2===1?' dark':''));b.type='button';b.dataset.square=square;
  if(p){const img=element('img');img.src='./pieces/'+p.color+p.type.toUpperCase()+'.svg';img.alt='';img.draggable=false;b.append(img);}
  if(row===7)b.append(element('span',files[col],'coord file'));if(col===0)b.append(element('span',ranks[row],'coord rank'));if(host.id==='puzzleBoard')b.onclick=()=>squareClick(square);host.append(b);
 }boardState.set(host,signature);}
 const names=getLanguage()==='en'?{p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}:{p:'peón',n:'caballo',b:'alfil',r:'torre',q:'dama',k:'rey'};
 for(const b of host.children){const sq=b.dataset.square,p=pieces[sq];b.disabled=!interactive;b.classList.toggle('selected',sq===selected);b.classList.toggle('target',!!selected&&legal.some(m=>m.from===selected&&m.to===sq));b.classList.toggle('hint',hint===sq);b.classList.toggle('last-move',!!lastMove&&[lastMove.from,lastMove.to].includes(sq));b.classList.toggle('wrong',!!wrong&&[wrong.from,wrong.to].includes(sq)||!!lastMove?.mate&&p?.type==='k'&&p.color===c.turn());b.setAttribute('aria-label',sq+(p?' '+(p.color==='w'?t('white','blanco'):t('black','negro'))+' '+names[p.type]:''));b.setAttribute('aria-pressed',String(sq===selected));}
 for(const m of moves){const dest=host.querySelector('[data-square="'+m.to+'"]'),img=dest?.querySelector('img');if(!m.origin||!img)continue;const rect=dest.getBoundingClientRect();img.classList.add('moving-piece');img.animate([{transform:`translate(${m.origin.left-rect.left}px,${m.origin.top-rect.top}px)`},{transform:'translate(0,0)'}],{duration:motion.color===runner?.puzzle.human?230:500,easing:'cubic-bezier(.25,.7,.25,1)'}).finished.then(()=>img.classList.remove('moving-piece')).catch(()=>{});}
}
async function promotion(){const dialog=$('promotion');dialog.showModal();return new Promise(resolve=>{const click=e=>{if(e.target.dataset.piece)finish(e.target.dataset.piece);else if(e.target.id==='cancelPromotion')finish(null);},cancel=e=>{e.preventDefault();finish(null);},finish=value=>{dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.close();resolve(value);};dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);});}
async function squareClick(square){
 if(busy||!runner||runner.done||phase!=='challenge')return;const c=new Chess(runner.fen),legal=c.moves({verbose:true}),choices=legal.filter(m=>m.from===selected&&m.to===square);
 if(!choices.length){selected=legal.some(m=>m.from===square)?square:null;renderStreak();return;}
 const from=selected;let piece;if(choices.some(m=>m.promotion)){piece=await promotion();if(!piece)return;}const move=c.move({from,to:square,promotion:piece||'q'});selected=null;previewFen=c.fen();phase='checking';motion={from,to:square,san:move.san,color:move.color};notice(null);
 await work(async()=>{
  renderStreak();try{const answer=await runner.move(from+square+(piece||''));library.recordAttempt(runner.puzzle.id,answer);if(runner.puzzle.pattern===sessionHabit)habitRevealed=true;if(runner.done)library.complete(runner.puzzle.id,{runId:runner.id,failed:runner.failed,assisted:runner.assisted});phase=answer.good?'feedback':'wrong';wrongMove=answer.good?null:{from,to:square};renderStreak();
   if(!runner.done){const runId=runner.id;clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>{if(runner?.id!==runId)return;wrongMove=null;phase='challenge';motion=answer.good?answer.reply:null;renderStreak();},answer.good?700:900);}
  }catch(e){phase='challenge';throw e;}finally{previewFen=null;}
 });
}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
$('importGame').onclick=importGame;$('cancelAnalysis').onclick=()=>analysisAbort?.abort();
$('newGame').onclick=$('practiceNewGame').onclick=$('practiceImport').onclick=newGame;
$('backToLesson').onclick=()=>showImport('lesson');
$('practiceBack').onclick=$('doneBack').onclick=backToLesson;
$('startGamePractice').onclick=startGamePractice;
$('replayPrevious').onclick=()=>stepReplay(-1);
$('replayNext').onclick=()=>stepReplay(1);
$('replayMore').onclick=()=>{
 replay.fullLine=true;
 stepReplay(1);
 $('replayNext').focus();
};
$('replayAlternative').onclick=()=>{
 replay.showingAlternative=!replay.showingAlternative;
 replay.fullLine=false;
 replay.index=0;
 renderReplay();
 $('replayNext').focus();
};
$('language').onclick=()=>{if(busy)return;setLanguage(getLanguage()==='en'?'es':'en');importError();localize();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='streak')openDailyPractice();else switchTab(b.dataset.tab);});
$('pgn').oninput=()=>{importError();formatPlayers();};
$('side').onchange=$('eloFallback').oninput=$('username').oninput=()=>importError();
$('pgnFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 if(file.size>250000){importError(t('PGN file exceeds 250 KB.','El archivo supera 250 KB.'));return;}
 try{$('pgn').value=await file.text();importError();formatPlayers();}
 catch{importError(t('Could not read this file. Try pasting its PGN.','No se pudo leer el archivo. Prueba pegar su PGN.'));}
};
$('patternFilter').onchange=()=>{renderBank();renderProgress();};$('eloFilter').onchange=renderBank;$('bankStreak').onclick=()=>startQueue(false);$('startStreak').onclick=()=>startQueue(false);$('practiceAhead').onclick=()=>startQueue(true);$('nextPuzzle').onclick=nextPuzzle;$('flip').onclick=()=>{flipped=!flipped;renderStreak();};
$('hint').onclick=()=>work(async()=>{await runner.hint();library.recordHint(runner.puzzle.id,runner.id,runner.step+1);renderStreak();});
$('restartPuzzle').onclick=()=>{clearTimeout(transitionTimer);if(runner.done)runner=new PuzzleRunner(runner.puzzle,engine);else runner.restart();selected=null;wrongMove=null;phase='challenge';renderStreak();};
$('exportData').onclick=()=>{download('between-bishops-backup-'+new Date().toISOString().slice(0,10)+'.json',library.export(),'application/json');};
$('restoreData').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000000)throw Error(t('Backup is too large.','El respaldo es demasiado grande.'));const backup=await file.text();await work(()=>{library.restore(backup);notice(t('Backup merged without duplicating games or attempts.','Respaldo integrado sin duplicar partidas ni intentos.'));});}catch(error){notice(error.message);}finally{e.target.value='';}};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
selectedGameId=library.games.findLast(game=>game.report)?.id||null;
localize();if(databaseNotice)notice(databaseNotice);if(library.loadError)notice(library.loadError);
