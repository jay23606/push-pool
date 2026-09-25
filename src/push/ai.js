import {TOSS_RANGE} from './toss.js'
import {powerCost} from './powers.js'

// What the practice opponent does with its powers and items before it takes a shot. Deliberately simple: it throws a bomb or
// mortar at the thickest cluster of balls it can reach, lights pop powder now and then, and arms pop or cute when it can well
// afford them. Pure: `rand` is injectable, and the result is a list of plain actions for the game to carry out.
//   {kind:'toss',item,target:{x,y}}   {kind:'use',id}   {kind:'arm',id,level}

const REAL=b=>b.on&&b.k!=='cue'&&b.k!=='dummy'

// The ball with the most real neighbours within `reach`, among those the cue ball can throw to.
export function thickestCluster(balls,cue,reach=60){
 const real=balls.filter(REAL),within=real.filter(b=>Math.hypot(b.x-cue.x,b.y-cue.y)<=TOSS_RANGE)
 let best=null,bestN=0
 for(const b of within){
  const n=real.filter(o=>Math.hypot(o.x-b.x,o.y-b.y)<=reach).length
  if(n>bestN){best=b;bestN=n}
 }
 return best?{target:{x:best.x,y:best.y},count:bestN}:null
}

export function planUses(push,score,turn,balls,rand=Math.random){
 const mine=push[turn],cue=balls[0],out=[]
 if(!cue?.on)return out
 for(const item of ['mortar','bomb']){
  if(!mine.items.includes(item))continue
  const c=thickestCluster(balls,cue)
  if(c&&c.count>=3&&rand()<.6){out.push({kind:'toss',item,target:c.target});return out}   // it will settle, then plan again
 }
 if(mine.items.includes('poppowder')&&rand()<.4)out.push({kind:'use',id:'poppowder'})
 let points=score[turn]
 for(const id of ['pop','cute']){
  const level=mine.powers[id]||0;if(!level)continue
  const cost=powerCost(id,level)
  if(points>=cost+15&&rand()<.35){out.push({kind:'arm',id,level});points-=cost}
 }
 return out
}
