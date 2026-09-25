import {rollItem,rollGem} from './items.js'

// Things that appear on the table between turns, and how long they last. A spawn is a small plain record
// {type,kind,ttl,...position/payload} so it can travel in the game state. `ttl` counts turns left; an object with
// ttl 0 after a tick has expired. The break is entirely standard, so nothing spawns before the first real turn.

// kind: 'bonus' | 'hazard' | 'item'. `life` is [min,max] turns; `weight` is how often it is dealt.
export const SPAWN_TYPES={
 gemdrop:  {kind:'bonus', weight:30,life:[1,1]},
 itemdrop: {kind:'bonus', weight:25,life:[3,5]},
 bonushole:{kind:'bonus', weight:8, life:[1,1]},
 pswitch:  {kind:'bonus', weight:5, life:[2,4]},
 wormhole: {kind:'hazard',weight:6, life:[2,4]},
 volcano:  {kind:'hazard',weight:4, life:[4,4]},
 blackhole:{kind:'hazard',weight:4, life:[3,5]},
 slick:    {kind:'hazard',weight:8, life:[1,3],variants:['ice','electric','sand','plasma']},
 hurricane:{kind:'hazard',weight:3, life:[1,1]},
 barf:     {kind:'hazard',weight:3, life:[1,1]}
}
export const SPAWN_IDS=Object.keys(SPAWN_TYPES)
export const MAX_ACTIVE=5           // the table never holds more than this many spawns at once
export const SPAWN_CHANCE=.7        // the chance anything is dealt between two turns

const between=(rand,[lo,hi])=>lo+Math.floor(rand()*(hi-lo+1))

function pickType(rand,exclude){
 const ids=SPAWN_IDS.filter(id=>!exclude.includes(id))
 if(!ids.length)return null
 const total=ids.reduce((s,id)=>s+SPAWN_TYPES[id].weight,0)
 let x=rand()*total
 for(const id of ids){x-=SPAWN_TYPES[id].weight;if(x<0)return id}
 return ids[ids.length-1]
}

// Build one spawn. `at` is [x,y] chosen by the caller (it knows where the balls are); a bonus hole takes the rail
// instead, which the caller places. Payloads are rolled here so the host deals them once and everyone agrees.
export function makeSpawn(type,rand,at){
 const def=SPAWN_TYPES[type],s={type,kind:def.kind,ttl:between(rand,def.life),x:at?.[0],y:at?.[1]}
 if(def.variants)s.variant=def.variants[Math.floor(rand()*def.variants.length)]
 if(type==='itemdrop')s.item=rollItem(rand)
 if(type==='gemdrop')s.gems=Array.from({length:3+Math.floor(rand()*4)},()=>rollGem(rand))
 if(type==='bonushole')s.reward=rand()<.5?{gems:rollGem(rand)*2}:{item:rollItem(rand)}
 return s
}

// Deal for the coming turn. `turnNumber` counts turns played (0 = the break, which is standard: nothing).
// A type already active is not dealt again, so the table does not stack five wormholes.
export function dealSpawns(active,turnNumber,rand=Math.random,place=()=>[0,0],enabled=SPAWN_IDS){
 if(turnNumber<1||active.length>=MAX_ACTIVE||rand()>=SPAWN_CHANCE)return []
 const type=pickType(rand,[...active.map(s=>s.type),...SPAWN_IDS.filter(id=>!enabled.includes(id))])
 return type?[makeSpawn(type,rand,place(type))]:[]
}

// One turn passes: everything loses a turn of life; what reaches zero has expired.
export function tickSpawns(active){
 const aged=active.map(s=>({...s,ttl:s.ttl-1}))
 return {alive:aged.filter(s=>s.ttl>0),expired:aged.filter(s=>s.ttl<=0)}
}
