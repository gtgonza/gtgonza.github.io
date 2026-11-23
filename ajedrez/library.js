import {Chess} from './vendor/chess.js';
import {patternForMove} from './training.js';
const DAY=86400000,RETRY=600000,INTERVALS=[1,3,7,14,30,60];
export const LIBRARY_KEY='between-bishops-imports-v1';
function initial(){return {version:1,games:[],puzzles:[],streak:{current:0,best:0,solved:0},settings:{username:'gtgonza1'}};}
const finite=n=>Number.isFinite(n)&&n>=0;
function validate(data){
 if(data?.version!==1||!Array.isArray(data.games)||!Array.isArray(data.puzzles)||data.games.length>500||data.puzzles.length>1500)throw new Error('Unsupported backup or library format. / Formato de respaldo no compatible.');
 const games=new Map();for(const g of data.games){if(typeof g.id!=='string'||games.has(g.id)||typeof g.pgn!=='string'||!Array.isArray(g.moves)||g.moves.length>1000||!['w','b'].includes(g.human)||!finite(g.elo)||g.elo<100||g.elo>3500)throw new Error('Invalid game record. / Registro de partida inválido.');new Chess(g.initialFen);for(const m of g.moves){if(!Number.isInteger(m.ply)||m.ply<1||!['w','b'].includes(m.color)||typeof m.beforeFen!=='string'||typeof m.afterFen!=='string'||typeof m.san!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.uci))throw new Error('Invalid move record.');new Chess(m.beforeFen);new Chess(m.afterFen);}games.set(g.id,g);}
 const ids=new Set();for(const p of data.puzzles){const g=games.get(p.gameId),origin=g?.moves.find(m=>m.ply===p.ply);if(typeof p.id!=='string'||ids.has(p.id)||!origin||p.fen!==origin.beforeFen||p.human!==g.human||origin.color!==g.human||!Array.isArray(p.attempts)||!Array.isArray(p.reviews)||!finite(p.dueAt)||!Number.isInteger(p.stage)||p.stage<0||p.stage>6||!Number.isInteger(p.targetSteps)||p.targetSteps<1||p.targetSteps>4||!p.original?.before||!Array.isArray(p.original.before.pv)||!Array.isArray(p.solution))throw new Error('Invalid puzzle record. / Registro de puzle inválido.');const c=new Chess(p.fen);for(const u of p.solution)c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});for(const a of p.attempts)if(!a||typeof a.id!=='string'||typeof a.good!=='boolean'||!Number.isFinite(Date.parse(a.at)))throw new Error('Invalid attempt history.');for(const r of p.reviews)if(!r||typeof r.id!=='string'||typeof r.clean!=='boolean'||!Number.isFinite(Date.parse(r.at)))throw new Error('Invalid review history.');if(p.hints!==undefined&&!Array.isArray(p.hints))throw new Error('Invalid hints.');ids.add(p.id);}
 return {...initial(),...data,settings:{...initial().settings,...data.settings},streak:{current:finite(data.streak?.current)?data.streak.current:0,best:finite(data.streak?.best)?data.streak.best:0,solved:finite(data.streak?.solved)?data.streak.solved:0}};
}
export function latestGame(games){return games.slice().sort((a,b)=>gameDate(b)-gameDate(a)||String(b.importedAt).localeCompare(String(a.importedAt)))[0]||null;}
function gameDate(g){const match=/^(\d{4})[.-](\d{2})[.-](\d{2})$/.exec(g.date||'');const time=match?Date.UTC(+match[1],+match[2]-1,+match[3]):Date.parse(g.importedAt||'');return Number.isFinite(time)?time:0;}
const positionKey=p=>p.fen.split(' ').slice(0,4).join(' ');
const activity=p=>p.attempts.length||p.reviews.length||p.hints?.length;
export class PuzzleLibrary{
 constructor({storage=globalThis.localStorage,now=()=>Date.now()}={}){this.storage=storage;this.now=now;this.data=initial();this.loadError=null;try{const raw=storage?.getItem(LIBRARY_KEY);if(raw)this.data=validate(JSON.parse(raw));}catch(e){this.loadError=e.message;}}
 save(){if(this.loadError)throw new Error('Existing data could not be read. Export or restore a backup before saving. / No se pudieron leer los datos existentes; restaura un respaldo antes de guardar.');try{this.storage?.setItem(LIBRARY_KEY,JSON.stringify(this.data));}catch{throw new Error('Browser storage is full or blocked. Export a backup now. / El almacenamiento está lleno o bloqueado; exporta un respaldo ahora.');}}
 get games(){return this.data.games;}
 get puzzles(){return this.data.puzzles;}
 get currentElo(){return latestGame(this.games)?.elo||500;}
 get username(){return this.data.settings.username;}
 openPuzzle(id,runId, blind){
  const puzzle=this.puzzle(id);
  if(!puzzle)throw new Error('Puzzle not found.');
  const seen=this.puzzles.some(p=>positionKey(p)===positionKey(puzzle)&&(p.firstExposure||activity(p)));
  if(!seen){puzzle.firstExposure={runId,blind,at:new Date(this.now()).toISOString()};this.save();}
 }
 firstExposureResults(pattern){
  const positions=new Map();
  for(const puzzle of this.puzzles){
   const exposure=puzzle.firstExposure;
   const legacyDates=[...puzzle.attempts,...puzzle.reviews,...(puzzle.hints||[])].map(item=>item.at).filter(Boolean).sort();
   const at=exposure?.at||legacyDates[0];
   if(!at)continue;
   const key=positionKey(puzzle),previous=positions.get(key);
   if(!previous||at<previous.at)positions.set(key,{puzzle,exposure,at});
  }
  return [...positions.values()].filter(({puzzle,exposure})=>exposure?.blind&&(!pattern||puzzle.pattern===pattern)).flatMap(({puzzle,exposure,at})=>{
   const review=puzzle.reviews.find(r=>r.id===exposure.runId);
   const failed=puzzle.attempts.some(a=>a.runId===exposure.runId&&!a.good)||puzzle.hints?.some(h=>h.runId===exposure.runId);
   return review||failed?[{at,clean:!!review?.clean&&!failed}]:[];
  }).sort((a,b)=>b.at.localeCompare(a.at));
 }
 trainingProgress(pattern){
  const fresh=this.firstExposureResults(pattern);
  const repeated=this.puzzles.filter(p=>!pattern||p.pattern===pattern).flatMap(p=>p.reviews.filter(r=>!r.early&&r.id!==p.firstExposure?.runId&&p.reviews.some(earlier=>earlier.at<r.at)));
  return {fresh:{clean:fresh.filter(r=>r.clean).length,total:fresh.length},repeated:{clean:repeated.filter(r=>r.clean).length,total:repeated.length}};
 }
 stepLimit(){
  const baseline=this.currentElo<600?2:this.currentElo<1100?3:4;
  const recent=this.firstExposureResults().slice(0,8);
  if(recent.length<4)return baseline;
  const cleanRate=recent.filter(r=>r.clean).length/recent.length;
  return Math.max(1,Math.min(4,baseline+(cleanRate>=.75?1:cleanRate<.5?-1:0)));
 }
 gameProgress(pattern){
  const latest=latestGame(this.games.filter(g=>g.report));
  const control=latest?.headers?.TimeControl;
  if(!latest||!/^\d+(?:\+\d+)?$/.test(control||''))return null;
  const player=g=>String(g.human==='w'?g.white:g.black).toLowerCase();
  const comparable=this.games.filter(g=>g.report&&g.headers?.TimeControl===control&&player(g)===player(latest))
   .sort((a,b)=>gameDate(b)-gameDate(a)||String(b.importedAt).localeCompare(String(a.importedAt))).slice(0,10);
  const count=games=>{
   const moves=games.flatMap(g=>g.moves.filter(m=>m.color===g.human&&Number.isFinite(m.loss)&&m.kind!=='neutral'));
   const errors=moves.filter(m=>m.loss>=50&&(!pattern||(m.pattern||patternForMove(m))===pattern)).length;
   return {games:games.length,moves:moves.length,errors};
  };
  return {control,recent:count(comparable.slice(0,5)),previous:count(comparable.slice(5,10))};
 }
 setUsername(value){this.data.settings.username=String(value).trim();this.save();}
 game(id){return this.games.find(g=>g.id===id);}
 puzzle(id){return this.puzzles.find(p=>p.id===id);}
 addGame(game){const index=this.games.findIndex(g=>g.id===game.id);if(index<0){if(this.games.length>=500)throw new Error('Library limit reached. Export a backup.');this.games.push(structuredClone(game));}else this.games[index]={...game,importedAt:this.games[index].importedAt};this.save();return this.game(game.id);}
 addPuzzles(puzzles){let added=0;for(const p of puzzles){if(this.puzzle(p.id)||this.puzzles.filter(x=>x.gameId===p.gameId).length>=3)continue;if(this.puzzles.length>=1500)throw new Error('Puzzle library limit reached. Export a backup.');this.puzzles.push(structuredClone(p));added++;}this.save();return added;}
 recordAttempt(id,attempt){const p=this.puzzle(id);if(!p)throw new Error('Puzzle not found.');if(p.attempts.some(a=>a.id===attempt.id))return;p.attempts.push({at:new Date(this.now()).toISOString(),step:1,...structuredClone(attempt)});if(!attempt.good){p.stage=0;p.dueAt=this.now()+RETRY;p.lapses=(p.lapses||0)+1;this.data.streak.current=0;}this.save();}
 recordHint(id,runId,step){const p=this.puzzle(id);if(!p)throw new Error('Puzzle not found.');p.hints||=[];if(p.hints.some(h=>h.runId===runId&&h.step===step))return;p.hints.push({runId,step,at:new Date(this.now()).toISOString()});p.stage=0;p.dueAt=this.now()+RETRY;this.data.streak.current=0;this.save();}
 complete(id,{runId,failed=false,assisted=false}){
  const p=this.puzzle(id);if(!p)throw new Error('Puzzle not found.');const previous=p.reviews.find(r=>r.id===runId);if(previous)return previous;
  const now=this.now(),clean=!failed&&!assisted,due=p.dueAt<=now,review={id:runId,at:new Date(now).toISOString(),clean,assisted,failed,early:!due};
  p.reviews.push(review);p.lastReviewedAt=review.at;
  if(clean){if(due){const days=INTERVALS[Math.min(p.stage,5)];p.stage=Math.min(6,p.stage+1);p.dueAt=now+days*DAY;this.data.streak.current++;this.data.streak.best=Math.max(this.data.streak.best,this.data.streak.current);}}else{p.stage=0;p.dueAt=now+RETRY;this.data.streak.current=0;}
  this.data.streak.solved++;this.save();return review;
 }
 queue({ahead=false,exclude=[]}={}){
  const now=this.now(),skip=new Set(exclude),weaknesses=this.weaknesses(),elo=this.currentElo;
  return this.puzzles.filter(p=>!skip.has(p.id)&&(ahead||p.dueAt<=now)&&p.elo<=elo+400).sort((a,b)=>{
   const ad=a.dueAt<=now,bd=b.dueAt<=now;if(ad!==bd)return ad?-1:1;
   const af=weaknesses.find(w=>w.id===a.pattern)?.priority||0,bf=weaknesses.find(w=>w.id===b.pattern)?.priority||0;
   return bf-af||a.dueAt-b.dueAt||a.targetSteps-b.targetSteps||b.loss-a.loss;
  });
 }
 weaknesses(){const map=Object.create(null);const item=id=>map[id]||=( {id,count:0,clean:0,failed:0,due:0,gameIds:new Set()} );for(const g of this.games)for(const m of g.moves.filter(m=>m.color===g.human&&Number.isFinite(m.loss)&&m.loss>=50&&m.kind!=='neutral')){const w=item(m.pattern||patternForMove(m));w.count++;w.gameIds.add(g.id);}for(const p of this.puzzles){const w=item(p.pattern);w.clean+=p.reviews.filter(r=>r.clean).length;w.failed+=p.attempts.filter(a=>!a.good).length;w.due+=p.dueAt<=this.now()?1:0;}return Object.values(map).map(w=>({...w,games:w.gameIds.size,gameIds:undefined,priority:(w.failed+w.count*.1)/(1+w.clean)})).sort((a,b)=>b.priority-a.priority||b.count-a.count);}
 export(){return JSON.stringify({...this.data,exportedAt:new Date(this.now()).toISOString()},null,2);}
 restore(text){if(String(text).length>100000000)throw new Error('Backup too large.');const incoming=validate(JSON.parse(text));if(this.games.length+incoming.games.filter(g=>!this.game(g.id)).length>500||this.puzzles.length+incoming.puzzles.filter(p=>!this.puzzle(p.id)).length>1500)throw new Error('Combined backup exceeds library limits.');if(this.loadError)throw new Error('Keep the existing unreadable data safe; restore in a clean browser profile.');for(const game of incoming.games){const old=this.game(game.id);if(!old)this.data.games.push(game);else if(game.report&&(!old.report||String(game.analyzedAt||'')>String(old.analyzedAt||'')))Object.assign(old,game);}for(const puzzle of incoming.puzzles){const old=this.puzzle(puzzle.id);if(!old){if(this.data.puzzles.filter(p=>p.gameId===puzzle.gameId).length<3)this.data.puzzles.push(puzzle);continue;}for(const key of ['attempts','reviews']){const ids=new Set(old[key].map(x=>x.id));old[key].push(...puzzle[key].filter(x=>!ids.has(x.id)));}if(puzzle.firstExposure&&(!old.firstExposure||puzzle.firstExposure.at<old.firstExposure.at))old.firstExposure=puzzle.firstExposure;old.hints||=[];const hintIds=new Set(old.hints.map(h=>h.runId+':'+h.step));old.hints.push(...(puzzle.hints||[]).filter(h=>!hintIds.has(h.runId+':'+h.step)));const newer=String(puzzle.lastReviewedAt||'')>String(old.lastReviewedAt||'');if(newer){old.stage=puzzle.stage;old.dueAt=puzzle.dueAt;old.lastReviewedAt=puzzle.lastReviewedAt;}}this.data.streak.best=Math.max(this.data.streak.best,incoming.streak.best);this.save();}
}
