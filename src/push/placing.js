import {R} from '../table.js'
import {ITEMS} from './items.js'
import {blocks,WALL_R} from '../obstacles.js'
import {useItem,whyNotItem} from './economy.js'

// The placing mechanic: put an item on the cloth, rotated as you like, within a range of the cue ball. Pure functions:
// the game asks whether a spot is allowed, then places. What goes on the table are the same obstacle records the
// obstacle tables use (a round bumper, or a thin wall), so the physics, the AI's rollouts and a guest's prediction
// all treat a placed barrier exactly like a preset one. A placed barrier lasts a few turns and then goes.

export const RANGE={short:100,medium:180}
export const OBSTACLE_LIFE=6,MAX_OBSTACLES=12
export const WALL_LEN=64,CUBE_SIDE=34,PILLAR_R=10
export const PLACEABLE=['wall','cube','pillar']
export const isPlaceable=id=>PLACEABLE.includes(id)

// The obstacle records an item becomes at (x,y), turned `rot` radians (the wall lies along its rotation).
export function shapeOf(id,x,y,rot=0){
 const c=Math.cos(rot),s=Math.sin(rot)
 if(id==='pillar')return [{t:'bumper',x,y,r:PILLAR_R}]
 if(id==='wall'){const h=WALL_LEN/2;return [{t:'wall',x1:x-c*h,y1:y-s*h,x2:x+c*h,y2:y+s*h}]}
 if(id==='cube'){
  const h=CUBE_SIDE/2,pts=[[-h,-h],[h,-h],[h,h],[-h,h]].map(([px,py])=>[x+px*c-py*s,y+px*s+py*c])
  return pts.map((p,i)=>{const q=pts[(i+1)%4];return {t:'wall',x1:p[0],y1:p[1],x2:q[0],y2:q[1]}})
 }
 return []
}
const round1=n=>Math.round(n*10)/10
const rounded=o=>o.t==='bumper'?{...o,x:round1(o.x),y:round1(o.y)}:{...o,x1:round1(o.x1),y1:round1(o.y1),x2:round1(o.x2),y2:round1(o.y2)}

// Sample points along a shape, so "does it overlap a ball" is one distance test each.
function samples(list){
 const pts=[]
 for(const o of list){
  if(o.t==='bumper')pts.push({x:o.x,y:o.y,r:o.r})
  else{const n=Math.max(2,Math.ceil(Math.hypot(o.x2-o.x1,o.y2-o.y1)/6));for(let i=0;i<=n;i++)pts.push({x:o.x1+(o.x2-o.x1)*i/n,y:o.y1+(o.y2-o.y1)*i/n,r:WALL_R})}
 }
 return pts
}

// Why can't `id` go at `spot` ({x,y,rot})? Null if it can. `balls` is the table, `cue` the cue ball, `bounds` the cloth.
export function whyNotPlace(push,turn,id,spot,{cue,balls,bounds}){
 if(!isPlaceable(id))return 'not-placeable'
 const held=whyNotItem(push[turn],id,'before');if(held)return held
 const {x,y,rot=0}=spot||{}
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(rot))return 'bad-spot'
 if(!cue||!cue.on)return 'no-cue'
 if(Math.hypot(x-cue.x,y-cue.y)>RANGE[ITEMS[id].range])return 'too-far'
 const parts=shapeOf(id,x,y,rot)
 if((push.obstacles?.length||0)+parts.length>MAX_OBSTACLES*4)return 'too-many'
 const {minx,maxx,miny,maxy}=bounds
 for(const p of samples(parts))if(p.x<minx||p.x>maxx||p.y<miny||p.y>maxy)return 'off-table'
 for(const p of samples(parts))for(const b of balls)if(b.on&&Math.hypot(b.x-p.x,b.y-p.y)<R+p.r+1)return 'on-a-ball'
 for(const p of samples(parts))if(blocks(p.x,p.y,push.obstacles||[],p.r))return 'on-an-obstacle'
 return null
}

// Place it: the item is used up and its obstacles go on the table with a lifetime. Refused, it returns the same state.
export function placeItem(push,turn,id,spot,ctx){
 if(whyNotPlace(push,turn,id,spot,ctx))return push
 const parts=shapeOf(id,spot.x,spot.y,spot.rot||0).map(o=>({...rounded(o),item:id,ttl:OBSTACLE_LIFE}))
 return {...push,[turn]:useItem(push[turn],id,'before'),obstacles:[...(push.obstacles||[]),...parts]}
}

// A turn passes: placed barriers age and the expired ones go.
export const ageObstacles=list=>(list||[]).map(o=>({...o,ttl:o.ttl-1})).filter(o=>o.ttl>0)
