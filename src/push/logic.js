import {R} from '../table.js'
import {offers as makeOffers,pick,giveItem,whyNotPower,usePower} from './economy.js'
import {dealSpawns,tickSpawns} from './spawns.js'
import {rollGem} from './items.js'

// What happens around a shot, as pure functions over the game's `push` state and `score`. The game object calls
// these and applies the result, so the rules can be tested without a table.

// the spawns implemented so far; the rest of the catalogue is dealt only once its effect exists
export const LIVE_SPAWNS=['gemdrop','itemdrop']
export const GEM_LIFE=2,ITEM_LIFE=5
const REACH=R+8       // how close the cue ball must pass to a pickup to take it

const inPush=(push,turn,fn)=>({...push,[turn]:fn(push[turn])})

// A free spot on the cloth: clear of every ball and every other pickup. Null if it cannot find one.
export function freeSpot(balls,taken,bounds,rand){
 const {minx,maxx,miny,maxy}=bounds
 for(let i=0;i<40;i++){
  const x=Math.round(minx+rand()*(maxx-minx)),y=Math.round(miny+rand()*(maxy-miny))
  if(balls.some(b=>b.on&&Math.hypot(b.x-x,b.y-y)<R*2.2)||taken.some(t=>Math.hypot(t.x-x,t.y-y)<R*2.2))continue
  return [x,y]
 }
 return null
}

// The cue ball has moved: take any pickup it is over. Gems are points now, items go in hand.
export function collectPickups(push,score,turn,cue){
 if(!push||!cue||!cue.on||!push.pickups.length)return {push,score,collected:[]}
 const got=push.pickups.filter(k=>Math.hypot(k.x-cue.x,k.y-cue.y)<REACH)
 if(!got.length)return {push,score,collected:[]}
 let next={...push,pickups:push.pickups.filter(k=>!got.includes(k))},pts=0
 for(const k of got){
  if(k.kind==='gem')pts+=k.v
  else next=inPush(next,turn,p=>giveItem({...p,points:0},k.id))
 }
 return {push:next,score:{...score,[turn]:score[turn]+pts},collected:got}
}

// A shot has resolved. `levelUps` real balls were sunk by `shooter`; `turnChanged` says whether the turn passed.
// Returns the new push state and a list of short messages. Level-up picks are owed at once and offered to the shooter,
// who has kept the turn (a level-up only comes with a legal pot). When the turn passes, the table ages and new
// things may be dealt for the coming turn.
export function afterShot(push,{shooter,nextTurn=shooter,levelUps=0,turnChanged=false,balls,bounds,rand=Math.random}){
 const messages=[]
 let next=levelUps?inPush(push,shooter,p=>({...p,picks:p.picks+levelUps})):push
 // Offers belong to whoever is to play: when the turn passes they are dropped, and put up again for the next player if
 // they still owe a pick, so a level-up you did not get to take waits for your next turn.
 if(turnChanged)next={...next,offers:null}
 if(next[nextTurn].picks>0&&!next.offers){
  const o=makeOffers(next[nextTurn],rand);if(o.length){next={...next,offers:o};messages.push('Level up · choose a power')}
 }
 if(turnChanged){
  const turns=next.turns+1,aged=tickSpawns(next.spawns),pickups=next.pickups.map(k=>({...k,ttl:k.ttl-1})).filter(k=>k.ttl>0)
  next={...next,turns,spawns:aged.alive,pickups}
  const dealt=dealSpawns(aged.alive,turns,rand,()=>[0,0],LIVE_SPAWNS)
  for(const s of dealt){
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
 return {push:next,messages}
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

export {rollGem}
