import {R} from '../table.js'
import {freeSpot} from './logic-spots.js'
import {offers as makeOffers,pick,giveItem,whyNotPower,usePower} from './economy.js'
import {dealSpawns,tickSpawns} from './spawns.js'
import {rollGem,rollItem} from './items.js'
import {ageHazards,makeHazard,hazardOf,isHazardSpawn,HAZARD_TYPES} from './hazards.js'
import {isArmable,powerLevel} from './powers.js'

// What happens around a shot, as pure functions over the game's `push` state and `score`. The game object calls
// these and applies the result, so the rules can be tested without a table.

// the spawns implemented so far; the rest of the catalogue is dealt only once its effect exists
export const LIVE_SPAWNS=['gemdrop','itemdrop',...HAZARD_TYPES]
export const GEM_LIFE=2,ITEM_LIFE=5
const HAZARD_MESSAGE={volcano:'A volcano erupts!',barf:'Barf!',pswitch:'A P switch has appeared',bonushole:'A bonus hole has opened',wormhole:'A wormhole has opened',slick:'A slick has appeared',blackhole:'A black hole has appeared',hurricane:'Hurricane!'}
const REACH=R+8       // how close the cue ball must pass to a pickup to take it

const inPush=(push,turn,fn)=>({...push,[turn]:fn(push[turn])})

// The cue ball has moved: take any pickup it is over. Gems are points now, items go in hand.
export function collectPickups(push,score,turn,cue){
 if(!push||!cue||!cue.on||!push.pickups.length)return {push,score,collected:[]}
 const got=push.pickups.filter(k=>Math.hypot(k.x-cue.x,k.y-cue.y)<REACH)
 if(!got.length)return {push,score,collected:[]}
 let next={...push,pickups:push.pickups.filter(k=>!got.includes(k))},pts=0
 for(const k of got){
  if(k.kind==='gem')pts+=k.v
  else next=inPush(next,turn,p=>giveItem(p,k.id))
 }
 return {push:next,score:{...score,[turn]:score[turn]+pts},collected:got}
}

// A shot has resolved. `levelUps` real balls were sunk by `shooter`; `turnChanged` says whether the turn passed.
// Returns the new push state and a list of short messages. Level-up picks are owed at once and offered to the shooter,
// who has kept the turn (a level-up only comes with a legal pot). When the turn passes, the table ages and new
// things may be dealt for the coming turn.
export function afterShot(push,{shooter,nextTurn=shooter,levelUps=0,turnChanged=false,balls,bounds,rand=Math.random}){
 const messages=[]
 let release=[],dummies=0,blasts=[],spews=[],barf=false
 let next=levelUps?inPush(push,shooter,p=>({...p,picks:p.picks+levelUps})):push
 // Offers belong to whoever is to play: when the turn passes they are dropped, and put up again for the next player if
 // they still owe a pick, so a level-up you did not get to take waits for your next turn.
 if(turnChanged)next={...next,offers:null}
 if(next[nextTurn].picks>0&&!next.offers){
  const o=makeOffers(next[nextTurn],rand);if(o.length){next={...next,offers:o};messages.push('Level up · choose a power')}
 }
 if(turnChanged){
  const turns=next.turns+1,aged=tickSpawns(next.spawns),pickups=next.pickups.map(k=>({...k,ttl:k.ttl-1})).filter(k=>k.ttl>0)
  const obs=ageHazards(next.obstacles);release=obs.released
  // a volcano still open spews again, one fewer each time
  for(const o of obs.alive)if(o.t==='bumper'&&o.vol>0)spews.push({x:o.x,y:o.y,count:o.vol+1})
  obs.alive=obs.alive.map(o=>o.t==='bumper'&&o.vol>0?{...o,vol:o.vol-1}:o)
  next={...next,turns,spawns:aged.alive,pickups,obstacles:obs.alive}
  // a hazard of a kind already on the table is not dealt again
  const active=[...aged.alive,...obs.alive.map(hazardOf).filter(Boolean).map(type=>({type}))]
  const dealt=dealSpawns(active,turns,rand,()=>[0,0],LIVE_SPAWNS)
  for(const s of dealt){
   if(isHazardSpawn(s.type)){
    const h=makeHazard(s,balls,bounds,rand,[...next.obstacles.filter(o=>o.x!==undefined),...next.pickups])
    if(h.obstacles.length||h.dummies||h.barf){next={...next,obstacles:[...next.obstacles,...h.obstacles]};dummies+=h.dummies;messages.push(HAZARD_MESSAGE[s.type]);if(h.blast)blasts.push(h.blast);if(h.spew)spews.push(h.spew);if(h.barf)barf=true}
    continue
   }
   if(s.type==='gemdrop'){
    let n=0
    for(const v of s.gems){const at=freeSpot(balls,next.pickups,bounds,rand);if(!at)break;next={...next,pickups:[...next.pickups,{kind:'gem',v,x:at[0],y:at[1],ttl:GEM_LIFE}]};n++}
    if(n)messages.push('Gems have dropped')
   }else if(s.type==='itemdrop'){
    const at=freeSpot(balls,next.pickups,bounds,rand)
    if(at){next={...next,pickups:[...next.pickups,{kind:'item',id:s.item,x:at[0],y:at[1],ttl:ITEM_LIFE}]};messages.push('An item has dropped')}
   }
  }
 }
 return {push:next,messages,release,dummies,blasts,spews,barf}
}

// The current player picks one of the offered powers. Clears the offers, and offers again if picks are still owed.
export function choosePower(push,turn,id,rand=Math.random){
 if(!push.offers)return push
 const after=pick(push[turn],push.offers,id)
 if(after===push[turn])return push
 let next={...push,[turn]:after,offers:null}
 if(after.picks>0){const o=makeOffers(after,rand);if(o.length)next={...next,offers:o}}
 return next
}

// Spend points on a power at `level` (and `variant`), from the game's score. `ok` says whether it went through.
export function payPower(push,score,turn,id,level,phase,variant){
 const player={...push[turn],points:score[turn]}
 const why=whyNotPower(player,id,level,phase,variant)
 if(why)return {ok:false,why,push,score}
 const spent=usePower(player,id,level,phase,variant)
 return {ok:true,why:null,push,score:{...score,[turn]:spent.points}}
}

// The powers armed for this shot are paid for as the shot is taken, each at the level chosen, one after the other:
// one you can no longer afford (or do not own, or that has no working effect) is simply skipped.
// `armed` is {power id: level}. Returns the new score and {id: {level,...level numbers}} for what went through.
export function payArmed(push,score,turn,armed){
 let pts=score,applied={}
 for(const [id,level] of Object.entries(armed||{})){
  if(!isArmable(id)||!Number.isInteger(level))continue
  const r=payPower(push,{...score,[turn]:pts[turn]},turn,id,level,'before')
  if(!r.ok)continue
  pts=r.score;applied={...applied,[id]:{level,...powerLevel(id,level)}}
 }
 return {score:pts,applied}
}

export {rollGem,freeSpot}

// Feats: things done in a single shot that pay a bonus, on top of the points for the balls themselves. `real` is how many
// real balls were legally sunk and `contacts` how many different balls the cue ball touched. A foul earns nothing.
// Returns [{id,text,points?,item?}]; the item is rolled here so the host deals it once.
export const FEATS=[
 {id:'double',need:s=>s.real>=2,text:'Double!',item:true},
 {id:'triple',need:s=>s.real>=3,text:'Triple!',points:20},
 {id:'crowd',need:s=>s.contacts>=5,text:'Five balls touched',points:15}
]
export function shotFeats(shot,rand=Math.random){
 if(shot.foul)return []
 return FEATS.filter(f=>f.need(shot)).map(f=>({id:f.id,text:f.text,...(f.points?{points:f.points}:{}),...(f.item?{item:rollItem(rand)}:{})}))
}
