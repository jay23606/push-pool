import {POWERS,POWER_IDS,MAX_LEVEL,powerCost} from './powers.js'
import {ITEMS} from './items.js'

// A player's P.U.S.H. state: points (also the score that wins the game), the powers they have unlocked and at what
// level, the items in hand, and how many level-up picks they are owed. All functions return a new state and never
// mutate their input, so a shot can be rewound by keeping the old one.

export const OFFER_SIZE=3

export const newPlayer=()=>({points:0,powers:{},items:[],picks:0})

export const award=(p,points)=>({...p,points:p.points+points})
// A level-up is owed each time you sink one of your own game balls; the pick is made from a few offers.
export const owePick=p=>({...p,picks:p.picks+1})

// The powers on offer: an unowned power at level 1, an owned one at its next level, never one already maxed.
export function offers(p,rand=Math.random,size=OFFER_SIZE){
 const open=POWER_IDS.filter(id=>(p.powers[id]||0)<MAX_LEVEL)
 const pool=[...open],out=[]
 while(out.length<size&&pool.length){out.push(pool.splice(Math.floor(rand()*pool.length),1)[0])}
 return out.map(id=>({id,level:(p.powers[id]||0)+1}))
}

// Take a pick: only an owed pick, and only one of the powers actually offered.
export function pick(p,offered,id){
 const o=offered.find(x=>x.id===id)
 if(p.picks<1||!o)return p
 return {...p,picks:p.picks-1,powers:{...p.powers,[id]:o.level}}
}

// Can this power be used now? `phase` is 'before' or 'after' the shot. Returns null if yes, or a reason.
export function whyNotPower(p,id,level,phase,variant){
 const def=POWERS[id]
 if(!def)return 'unknown'
 if((p.powers[id]||0)<level)return 'not-owned'
 if(def.when!=='either'&&def.when!==phase)return 'wrong-time'
 const cost=powerCost(id,level,variant)
 if(cost==null)return 'unknown'
 return p.points<cost?'too-expensive':null
}

// Spend points on a power. Any level up to the one you own may be used. Refuses (returns the same state) if not allowed.
export function usePower(p,id,level,phase,variant){
 if(whyNotPower(p,id,level,phase,variant))return p
 return {...p,points:p.points-powerCost(id,level,variant)}
}

export const giveItem=(p,id)=>ITEMS[id]?{...p,items:[...p.items,id]}:p
export const hasItem=(p,id)=>p.items.includes(id)
export const whyNotItem=(p,id,phase)=>!hasItem(p,id)?'not-held':ITEMS[id].when!=='either'&&ITEMS[id].when!==phase?'wrong-time':null
// An item is lost on use, and only one copy goes.
export function useItem(p,id,phase){
 if(whyNotItem(p,id,phase))return p
 const i=p.items.indexOf(id)
 return {...p,items:[...p.items.slice(0,i),...p.items.slice(i+1)]}
}
