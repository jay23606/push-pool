import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {rack} from '../src/rules.js'
import {freshPush} from '../src/push/state.js'
import {parseGameMessage} from '../src/protocol.js'
import {setObstacles} from '../src/obstacles.js'
import {DROPPABLE} from '../src/push/items.js'
import {isPlaceable} from '../src/push/placing.js'
import {isTossable} from '../src/push/toss.js'
import {POWER_IDS,ARMABLE} from '../src/push/powers.js'

// A host and a guest, linked by a bus that carries every message as JSON text, exactly as the network does. The guest takes its
// turns through the same methods the panel calls (pick, place, toss, use, arm, shoot), which send a request to the host; the host
// does it, and sends the state back. After every turn the guest's view must agree with the host's, and no message may be refused.

const seeded=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const callout={textContent:'',classList:{add(){},remove(){}}}

function pair(mode){
 const wire={toGuest:[],toHost:[],refused:0}
 const make=(host)=>{
  const g=Object.create(PoolGame.prototype)
  Object.assign(g,{mode,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},assignment:null,breakShot:false,calledPocket:null,
   ballInHand:false,placed:false,practice:false,hotSeat:false,names:{a:'A',b:'B'},ready:true,me:host?'a':'b',host,shots:{a:0,b:0},acc:0,
   flash(s){PoolGame.prototype.flash.call(this,s)},callout,setSpin(){},onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',
   balls:rack(mode),power:{value:50},spin:{a:0,b:0},aiming:true,angle:0,fx:null,push:freshPush(),dealRand:()=>.99,
   house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false,cannon:false,oneShot:false},spectator:false,armed:{}})
  g.send=m=>{(host?wire.toGuest:wire.toHost).push(JSON.stringify(m))}
  g.sfx=null
  return g
 }
 const host=make(true),guest=make(false)
 const flush=()=>{
  let moved=true
  while(moved){
   moved=false
   while(wire.toGuest.length){const m=parseGameMessage(wire.toGuest.shift());if(!m)wire.refused++;else guest.receive(m);moved=true}
   while(wire.toHost.length){const m=parseGameMessage(wire.toHost.shift());if(!m)wire.refused++;else host.receive(m);moved=true}
  }
 }
 return {host,guest,wire,flush}
}

function settle(g,flush,seconds=40){
 let now=g.clock||0;g.simAt=now
 for(let i=0;i<seconds*120&&g.phase==='roll';i++){now+=1000/120;g.advance(now);if(i%5===0)flush()}
 g.clock=now;flush()
}

const same=(host,guest,note)=>{
 assert.equal(guest.turn,host.turn,note+': turn');assert.equal(guest.phase,host.phase,note+': phase');assert.deepEqual(guest.score,host.score,note+': score')
 assert.deepEqual(guest.push,host.push,note+': push state');assert.equal(guest.balls.length,host.balls.length,note+': ball count')
 for(let i=0;i<host.balls.length;i++){
  const a=host.balls[i],b=guest.balls[i]
  assert.ok(Math.abs(a.x-b.x)<1&&Math.abs(a.y-b.y)<1&&a.on===b.on&&a.n===b.n,note+': ball '+i+' differs '+JSON.stringify([a.n,Math.round(a.x),Math.round(a.y),a.on])+' vs '+JSON.stringify([b.n,Math.round(b.x),Math.round(b.y),b.on]))
 }
}

for(const mode of ['push','push8']){
 for(const seed of (process.env.PAIR_SEEDS||'3,4').split(',').map(Number)){
  test(`pair: ${mode}, seed ${seed}: a host and a guest over a JSON bus stay in step for twenty turns`,()=>{
   const rand=seeded(seed*31337),real=Math.random;Math.random=seeded(seed*7777)
   try{
    setObstacles([]);const {host,guest,wire,flush}=pair(mode);host.sync();flush();host.dealRand=rand
    same(host,guest,'at the start')
    const did={turns:0,guestShots:0,guestItems:0,refusedByRule:0}
    for(let turn=0;turn<20&&!host.over;turn++){
     const seat=host.turn,actor=seat==='a'?host:guest,note='turn '+turn+' ('+seat+')'
     // a windfall, given by the host (the guest learns it from the state)
     const id=DROPPABLE[Math.floor(rand()*DROPPABLE.length)]
     host.push={...host.push,[seat]:{...host.push[seat],items:[...host.push[seat].items,id],powers:{...host.push[seat].powers,...(rand()<.5?{[POWER_IDS[Math.floor(rand()*POWER_IDS.length)]]:1+Math.floor(rand()*3)}:{})}}}
     host.score={...host.score,[seat]:Math.max(host.score[seat],80)};host.sync();flush()
     same(host,guest,note+' after a windfall')
     if(host.ballInHand){actor.ballInHand=false;actor.placed=true;actor.balls[0].x=154;actor.balls[0].y=190;actor.pendingPlace=[154,190];host.ballInHand=false;host.balls[0].x=154;host.balls[0].y=190}
     // the actor picks a level-up if one is on offer, then uses an item
     if(actor.push.offers)actor.pickPower(actor.push.offers[0].id)
     flush()
     const held=actor.push[seat].items
     if(held.length&&rand()<.8){
      const item=held[Math.floor(rand()*held.length)],cue=actor.balls[0]
      if(isPlaceable(item)||isTossable(item)){
       if(actor.startPlacing(item)){actor.placing.drag=true;actor.movePlacing({x:cue.x+(rand()-.3)*140,y:cue.y+(rand()-.5)*140});actor.placing.rot=rand()*6;actor.placing.drag=false;actor.confirmPlace()}
      }else if(item==='poppowder')actor.requestUse('poppowder')
      flush();if(actor===guest)did.guestItems++;if(host.tossing)settle(host,flush)
     }
     if(host.over)break
     for(const p of ARMABLE)if(actor.push[seat].powers[p]&&rand()<.3)actor.cycleArm(p)
     // take the shot: aim at the nearest real ball
     const group=mode==='push8'?host.group(seat):null       // 8-ball: your own group, and never the 8 (the game will not let you shoot it early)
     const cue=actor.balls[0],target=actor.balls.filter((b,i)=>i&&b.on&&b.k!=='dummy'&&b.k!=='eight'&&(!group||b.k===group)).sort((p,q)=>Math.hypot(p.x-cue.x,p.y-cue.y)-Math.hypot(q.x-cue.x,q.y-cue.y))[0]
     if(!target||!cue.on)continue
     actor.angle=Math.atan2(target.y-cue.y,target.x-cue.x);actor.aiming=true;actor.power={value:40+rand()*50}
     const shotsBefore=host.shots[seat]
     actor.canAim=()=>true;actor.canControl=()=>true;actor.takeShot();flush()
     // the 8-ball rule can refuse a shot whose line runs through the 8: that is the game working, not a lost message
     if(host.shots[seat]===shotsBefore&&host.phase==='aim'&&host.turn===seat&&!host.over){did.refusedByRule++;continue}
     settle(host,flush);did.turns++;if(actor===guest)did.guestShots++
     same(host,guest,note+' after the shot')
     assert.equal(wire.refused,0,note+': the receiving side refused a message')
    }
    assert.ok(host.over||did.refusedByRule>5||(did.turns>=6&&did.guestShots>=2),'the guest and the host both really played: '+JSON.stringify(did))
   }finally{Math.random=real;setObstacles([])}
  })
 }
}
