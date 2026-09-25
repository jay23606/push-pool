import {R} from '../table.js'
import {ITEMS} from './items.js'
import {useItem,whyNotItem} from './economy.js'

// The toss mechanic: drag out from the cue ball and let go, and the item lands where you aimed, give or take.
// It is always somewhat inaccurate, and the further it goes the more it strays. A tossed item flies over what is on the
// table, so only where it lands matters here. Pure functions; the host rolls the scatter, so everyone sees one landing.

export const TOSS_RANGE=280            // furthest a toss can go from the cue ball
export const SCATTER=.12               // the landing strays up to this fraction of the distance thrown
export const SMOKE_R=58,SMOKE_LIFE=[1,3]
export const TOSSABLE=['bomb','mortar','smokebomb','cluster','piggybank','rutabaga']
export const PIGGY_GEMS=[25,45],PIGGY_R=11,PIGGY_LIFE=6,CLUSTER_SIZE=5
export const isTossable=id=>TOSSABLE.includes(id)

// What each tossed item does where it comes down. A blast throws the balls around it outward (see chaos.js `blast`).
//   bomb    goes off when it has come to rest, so it skids a little beyond where it landed: a bigger, gentler blast
//   mortar  goes off on first impact: exactly where it landed, smaller and harder
//   smoke   a cloud that hides part of the table for a few shots
export const EFFECTS={
 bomb:     {kind:'blast',radius:7*R,power:1000,skid:24},
 mortar:   {kind:'blast',radius:5*R,power:1500,skid:0},
 smokebomb:{kind:'smoke'},
 cluster:  {kind:'cluster'},
 piggybank:{kind:'piggy'},
 rutabaga: {kind:'rutabaga'}
}

// Where a toss aimed at `target` from the cue ball actually lands. `rand` is injectable.
export function landing(cue,target,bounds,rand=Math.random){
 const dx=target.x-cue.x,dy=target.y-cue.y,dist=Math.min(TOSS_RANGE,Math.hypot(dx,dy))
 if(!(dist>0))return {x:cue.x,y:cue.y,dir:0}
 const dir=Math.atan2(dy,dx),err=dist*SCATTER*Math.sqrt(rand()),a=rand()*Math.PI*2
 const x=cue.x+Math.cos(dir)*dist+Math.cos(a)*err,y=cue.y+Math.sin(dir)*dist+Math.sin(a)*err
 return {x:Math.round(Math.min(bounds.maxx,Math.max(bounds.minx,x))),y:Math.round(Math.min(bounds.maxy,Math.max(bounds.miny,y))),dir}
}
// The scatter radius a toss to `target` would have, for the aiming display.
export const scatterAt=(cue,target)=>Math.min(TOSS_RANGE,Math.hypot(target.x-cue.x,target.y-cue.y))*SCATTER

export function whyNotToss(push,turn,id,{cue}){
 if(!isTossable(id))return 'not-tossable'
 const held=whyNotItem(push[turn],id,'before');if(held)return held
 return !cue||!cue.on?'no-cue':null
}

// Toss it: the item is used up. The caller works out the landing and the effect (it needs the table). Refused, the
// same state comes back.
export const tossItem=(push,turn,id,ctx)=>whyNotToss(push,turn,id,ctx)?push:{...push,[turn]:useItem(push[turn],id,'before')}

// The spot a bomb ends up at after skidding on from where it landed, along the way it was thrown.
export function skidTo(spot,dir,id,bounds){
 const s=EFFECTS[id]?.skid||0
 return {x:Math.min(bounds.maxx,Math.max(bounds.minx,spot.x+Math.cos(dir)*s)),y:Math.min(bounds.maxy,Math.max(bounds.miny,spot.y+Math.sin(dir)*s))}
}
export const smokeAt=(spot,rand=Math.random)=>({t:'smoke',x:spot.x,y:spot.y,r:SMOKE_R,ttl:SMOKE_LIFE[0]+Math.floor(rand()*(SMOKE_LIFE[1]-SMOKE_LIFE[0]+1))})
export const isToss=id=>ITEMS[id]?.use==='toss'
