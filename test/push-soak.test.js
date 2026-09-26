import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack,isPush} from '../src/rules.js'
import {freshPush} from '../src/push/state.js'
import {snapshotOf} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
import {chooseShot} from '../src/ai.js'
import {shotSpeed} from '../src/pool.js'
import {DROPPABLE} from '../src/push/items.js'
import {isPlaceable} from '../src/push/placing.js'
import {validPush} from '../src/push/state.js'
import {setObstacles} from '../src/obstacles.js'
import {isTossable} from '../src/push/toss.js'
import {POWER_IDS} from '../src/push/powers.js'
import {ARMABLE} from '../src/push/powers.js'

// A soak: two AI-ish players, handed items and powers at random, play many turns on a table where hazards and drops keep
// appearing. Nothing is asserted about who wins; what is asserted is that nothing throws, no ball ever has a non-finite
// position, and the state is valid on the wire after every single turn. It exists to catch what the focused tests cannot:
// features interacting (a volcano's eruption during a black hole, a mulligan after a toss, a cannon into a fan).

const seeded=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

function makeGame(mode,seed){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},assignment:null,breakShot:mode==='push8',
  calledPocket:null,ballInHand:false,placed:false,practice:false,hotSeat:true,names:{a:'A',b:'B'},ready:true,me:'a',host:true,shots:{a:0,b:0},acc:0,
  flash(){},setSpin(){},send(){},onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',balls:rack(mode),power:{value:50},spin:{a:0,b:0},
  aiming:true,angle:0,fx:null,push:freshPush(),house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false,cannon:false,oneShot:seed%2===0},oneShot:seed%2===0,
  spectator:false,jumpOn:false,armed:{}})
 g.canControl=()=>g.phase==='aim'&&!g.over&&!g.tossing
 g.canAim=()=>g.canControl()&&!g.ballInHand
 setObstacles([])      // the obstacle list is module state: a game starts with none, as a real one does when it racks
 g.sync()
 return g
}
function settle(g,seconds=40){
 let now=g.clock||0;g.simAt=now
 for(let i=0;i<seconds*120&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
 // a shot that never comes to rest would hang a real game: the game's own failsafe stops it after thirty seconds, but needing
 // that failsafe at all means something is keeping balls moving, so it is a failure here too
 assert.ok(!g.stalls,'the table had to be stopped by the thirty-second failsafe: something keeps balls moving; obstacles '+JSON.stringify(g.push.obstacles.map(o=>[o.t,o.variant,o.x,o.y,o.ttl,o.vol]))+' balls '+JSON.stringify(g.balls.filter(b=>b.on&&b.k!=='cue').map(b=>[b.n,b.k,Math.round(b.x),Math.round(b.y),b.pit?1:0,Math.round(b.vx),Math.round(b.vy),Math.round(b.z||0)]).filter(t=>t[5]||t[6]||t[7])).slice(0,300)+' stalled '+JSON.stringify(g.stallInfo)+' fx '+JSON.stringify(g.shotFx)+' rollers '+JSON.stringify(g.push.rollers))
 assert.equal(g.phase,'aim','the table did not come to rest within '+seconds+' seconds; still moving: '+JSON.stringify(g.balls.filter(b=>b.on&&(Math.abs(b.vx)>1||Math.abs(b.vy)>1)).map(b=>[b.n,Math.round(b.x),Math.round(b.y),Math.round(b.vx),Math.round(b.vy)])).slice(0,6)+' obstacles '+g.push.obstacles.map(o=>o.t).join(','))
}
function healthy(g,note){
 assert.ok(g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.vx)&&Number.isFinite(b.vy)),note+': a ball has a non-finite position or speed')
 assert.ok(g.balls.length<=16+60,note+': too many balls')
 const snap=snapshotOf(g)
 if(!isGameMessage(snap)){
  const p=g.push,why=[]
  if(!validPush(p)){
   for(const k of ['a','b'])if(!validPush({...freshPush(),[k]:p[k]}))why.push('player '+k+' '+JSON.stringify(p[k]))
   const bad=(p.obstacles||[]).filter(o=>!validPush({...freshPush(),obstacles:[o]}));if(bad.length)why.push('obstacles '+JSON.stringify(bad))
   const badk=(p.pickups||[]).filter(k=>!validPush({...freshPush(),pickups:[k]}));if(badk.length)why.push('pickups '+JSON.stringify(badk))
   if(p.offers&&!validPush({...freshPush(),offers:p.offers}))why.push('offers '+JSON.stringify(p.offers))
   if((p.obstacles||[]).length>60)why.push('obstacle count '+p.obstacles.length)
   if((p.pickups||[]).length>40)why.push('pickup count '+p.pickups.length)
  }else {const ids=g.balls.map(b=>b.n),dup=ids.filter((n,i)=>ids.indexOf(n)!==i),odd=snap.b.filter(t=>!(Number.isFinite(t[0])&&Number.isFinite(t[1])&&typeof t[2]==='boolean'&&(t.length===5||t.length===10||t.length===12)));why.push('balls dup '+JSON.stringify(dup)+' odd '+JSON.stringify(odd).slice(0,200)+' mode '+snap.mode+' count '+g.balls.length+' realCount '+g.balls.filter(b=>b.k!=='dummy').length)}
  assert.fail(note+': the state is not valid on the wire: '+why.join(' ; '))
 }
}

function playTurn(g,rand,note){
 const me=g.turn
 // a windfall: an item and sometimes a power, so every feature gets exercised
 if(rand()<.7){const id=DROPPABLE[Math.floor(rand()*DROPPABLE.length)];g.push={...g.push,[me]:{...g.push[me],items:[...g.push[me].items,id]}}}
 if(rand()<.5){const id=POWER_IDS[Math.floor(rand()*POWER_IDS.length)];g.push={...g.push,[me]:{...g.push[me],powers:{...g.push[me].powers,[id]:1+Math.floor(rand()*3)}}}}
 g.score={...g.score,[me]:Math.max(g.score[me],rand()<.5?80:0)}
 if(g.push.offers)g.pickPower(g.push.offers[Math.floor(rand()*g.push.offers.length)].id)
 // ball in hand: put the cue ball on a free spot
 if(g.ballInHand){
  for(let i=0;i<40;i++){const x=60+rand()*580,y=50+rand()*280;if(g.balls.every((b,j)=>!j||!b.on||Math.hypot(b.x-x,b.y-y)>20)){g.balls[0].x=x;g.balls[0].y=y;break}}
  g.ballInHand=false;g.placed=true
 }
 const held=g.push[me].items
 // use one item at random: place it, toss it, or fire an instant one
 if(held.length&&rand()<.8){
  const id=held[Math.floor(rand()*held.length)],cue=g.balls[0]
  if(isPlaceable(id)||isTossable(id)){
   if(g.startPlacing(id)){g.placing.drag=true;g.movePlacing({x:cue.x+(rand()-.3)*160,y:cue.y+(rand()-.5)*160});g.placing.rot=rand()*6;g.placing.drag=false;g.confirmPlace()}
  }else if(id==='poppowder')g.applyUse(me,'poppowder')
  else if(id==='cannon')g.toggleCannon()
  if(g.tossing)settle(g);healthy(g,note+' after an item')
 }
 // a power: tilt now, or arm something
 const p=g.push[me].powers
 if(p.tilt&&rand()<.3){g.applyUse(me,'tilt',['up','down','left','right'][Math.floor(rand()*4)]);if(g.tossing)settle(g);healthy(g,note+' after a tilt')}
 for(const id of ARMABLE)if(p[id]&&rand()<.4){g.cycleArm(id)}
 if(g.over)return
 // the shot: aim at the best ball the AI planner finds, else straight at any ball
 const cue=g.balls[0];if(!cue.on)return
 const group=g.mode==='push8'?g.group(me):null
 let plan=null;try{plan=chooseShot(g.balls,group,false,'league',g.mode,{player:me})}catch{plan=null}
 const target=g.balls.find((b,i)=>i&&b.on&&b.k!=='dummy')
 const angle=plan?plan.angle:target?Math.atan2(target.y-cue.y,target.x-cue.x):0,power=plan?plan.power:30+rand()*60
 g.angle=angle;g.aiming=true;g.power={value:power}
 const armed=Object.keys(g.armed||{}).length?{...g.armed}:null
 if(armed)g.applyArmed(armed,{trail:['ice','sand','stone'][Math.floor(rand()*3)]})
 g.armed={}
 if(g.shotFx?.nudge){g.doNudge(Math.cos(angle),Math.sin(angle),[0,0]);settle(g);healthy(g,note+' after a nudge');return}
 const cannon=g.armedItem==='cannon';g.armedItem=null
 if(cannon)g.payCannon()
 g.startShot();if(g.cannonShot){g.balls[0].m=5;g.cannonShot=false}
 const s=shotSpeed(power)*(cannon?1.7:1);strike(g.balls[0],Math.cos(angle)*s,Math.sin(angle)*s)
 settle(g);healthy(g,note+' after a shot')
 // a mulligan now and then
 if(g.push[g.turn].items.includes('mulligan')&&rand()<.3){g.applyUse(g.turn,'mulligan');healthy(g,note+' after a mulligan')}
}

for(const mode of ['push','push8']){
 // SOAK_SEEDS=1,2,3,... runs others (a wider sweep to hunt for bugs)
 for(const seed of (process.env.SOAK_SEEDS||'11,12,13').split(',').map(Number)){
  test(`soak: ${mode}, seed ${seed}: thirty turns of every feature at once, nothing throws or breaks the wire format`,()=>{
   const rand=seeded(seed*7919),real=Math.random;Math.random=seeded(seed*104729)
   try{
    const g=makeGame(mode,seed);let turns=0
    for(;turns<30&&!g.over;turns++){
     g.dealRand=rand
     playTurn(g,rand,`turn ${turns}`)
     assert.ok(isPush(g.mode));assert.ok(g.turn==='a'||g.turn==='b')
    }
    assert.ok(turns>=10||g.over,'the game got somewhere before it ended')
    healthy(g,'the end')
   }finally{Math.random=real;setObstacles([])}
  })
 }
}
