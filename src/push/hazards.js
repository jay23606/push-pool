import {R,PR,M,H} from '../table.js'
import {freeSpot} from './logic-spots.js'
import {SPAWN_TYPES} from './spawns.js'

// Hazards: things dealt onto the table between turns that change how balls move. Each becomes an obstacle-style record
// with a `ttl` in turns, so it rides in the same list (and the same wire format and ageing) as barriers and mines:
//   wormhole   a pair of portals, the same ones the obstacle tables use
//   slick      a patch of cloth with different friction: ice (slides on), electric (speeds up), sand (slows), plasma (sticks)
//   blackhole  a gravity well that pulls balls in and can swallow them until it closes, when it gives them back
// Hurricane is not an object: it just rains dummy balls. Pure functions; the game applies them.

export const SLICKS=['ice','electric','sand','plasma']
export const SLICK_RANGE=[34,58]
export const HOLE_R=110,HOLE_PULL=1500,HOLE_CATCH=10,HOLE_MAX_HELD=6
export const PORTAL_R=15
export const HURRICANE=[5,9]              // how many dummies it rains
export const MAX_DUMMIES_ON_TABLE=40       // hurricanes and the like stop once the table is this crowded

// per second: what a slick does to the speed of a ball on it
const SLICK_RATE={ice:.55,electric:1.3,sand:-2.2,plasma:-7}
export const HAZARD_TYPES=['wormhole','slick','blackhole','hurricane','pswitch','bonushole','volcano','barf']
export const VOLCANO_R=22,VOLCANO_SPEWS=3,VOLCANO_ERUPT=6     // it erupts with six dummies, then spews one more than it has left each turn
export const FAN_FORCE=520,PIT_SLOW=120,PIT_ESCAPE=160
export const PSWITCH_R=9,PSWITCH_GEM=5      // hit it and every dummy on the table becomes a gem worth this much

const pitKey=o=>o.x+','+o.y
const between=(rand,[lo,hi])=>lo+Math.floor(rand()*(hi-lo+1))

// Build what a hazard spawn becomes: obstacle records and/or a number of dummy balls to rain.
// `balls` is the table and `taken` other records to stay clear of. Returns {obstacles,dummies} (possibly empty).
export function makeHazard(spawn,balls,bounds,rand=Math.random,taken=[]){
 const ttl=spawn.ttl
 if(spawn.type==='wormhole'){
  const a=freeSpot(balls,taken,bounds,rand);if(!a)return {obstacles:[],dummies:0}
  let b=null;for(let i=0;i<12&&!b;i++){const c=freeSpot(balls,[...taken,{x:a[0],y:a[1]}],bounds,rand);if(c&&Math.hypot(c[0]-a[0],c[1]-a[1])>120)b=c}
  if(!b)return {obstacles:[],dummies:0}
  return {obstacles:[{t:'portal',x:a[0],y:a[1],r:PORTAL_R,to:b,ttl},{t:'portal',x:b[0],y:b[1],r:PORTAL_R,to:a,ttl}],dummies:0}
 }
 if(spawn.type==='slick'){
  const at=freeSpot([],taken,bounds,rand);if(!at)return {obstacles:[],dummies:0}
  return {obstacles:[{t:'slick',variant:spawn.variant||'ice',x:at[0],y:at[1],r:between(rand,SLICK_RANGE),ttl}],dummies:0}
 }
 if(spawn.type==='blackhole'){
  const at=freeSpot([],taken,bounds,rand);if(!at)return {obstacles:[],dummies:0}
  return {obstacles:[{t:'blackhole',x:at[0],y:at[1],r:HOLE_R,held:[],ttl}],dummies:0}
 }
 if(spawn.type==='volcano'){
  const at=freeSpot(balls,taken,bounds,rand);if(!at)return {obstacles:[],dummies:0}
  // the volcano is a barrier (a bumper the physics already knows) that flings the balls near it away, then spews dummies
  return {obstacles:[{t:'bumper',x:at[0],y:at[1],r:VOLCANO_R,vol:VOLCANO_SPEWS,ttl}],dummies:0,blast:{x:at[0],y:at[1],radius:8*R,power:1300},spew:{x:at[0],y:at[1],count:VOLCANO_ERUPT}}
 }
 if(spawn.type==='barf')return {obstacles:[],dummies:0,barf:true}
 if(spawn.type==='pswitch'){
  const at=freeSpot(balls,taken,bounds,rand);if(!at)return {obstacles:[],dummies:0}
  return {obstacles:[{t:'pswitch',x:at[0],y:at[1],r:PSWITCH_R,ttl}],dummies:0}
 }
 if(spawn.type==='bonushole'){
  // on a long rail, clear of the corner and side pockets and of any other bonus hole
  const holes=taken.filter(o=>o.t==='bonushole')
  for(let i=0;i<20;i++){
   const x=Math.round(140+rand()*420),y=rand()<.5?M:H-M
   if(holes.some(o=>Math.hypot(o.x-x,o.y-y)<PR*3))continue
   return {obstacles:[{t:'bonushole',x,y,r:PR*.9,reward:spawn.reward||{gems:10},ttl}],dummies:0}
  }
  return {obstacles:[],dummies:0}
 }
 if(spawn.type==='hurricane'){
  const dummies=balls.filter(b=>b.k==='dummy'&&b.on).length
  return {obstacles:[],dummies:dummies>=MAX_DUMMIES_ON_TABLE?0:between(rand,HURRICANE)}
 }
 return {obstacles:[],dummies:0}
}

// One physics step of the zone hazards on every ball. Returns the balls a black hole swallowed this step, as
// [{hole,ball}]; the caller takes them off the table and records them (a hole holds at most HOLE_MAX_HELD).
export function stepHazards(balls,obstacles,dt){
 const swallowed=[]
 // a ball pinned in a hole that is no longer there is free
 for(const b of balls)if(b.pit&&!obstacles.some(o=>o.t==='pit'&&pitKey(o)===b.pit))b.pit=null
 for(const o of obstacles){
  if(o.t==='fan'){
   for(const b of balls){
    if(!b.on||(b.z||0)>0)continue
    const dx=b.x-o.x,dy=b.y-o.y,d=Math.hypot(dx,dy);if(d>=o.r)continue
    const a=FAN_FORCE*(1-d/o.r)*dt;b.vx+=Math.cos(o.rot)*a;b.vy+=Math.sin(o.rot)*a
   }
   continue
  }
  if(o.t==='pit'){
   const key=pitKey(o)
   for(const b of balls){
    if(!b.on||(b.z||0)>0)continue
    const sp=Math.hypot(b.vx,b.vy)
    if(b.pit===key){if(sp>PIT_ESCAPE)b.pit=null;else{b.vx=b.vy=0;b.x=o.x;b.y=o.y}}
    else if(!b.pit&&sp<PIT_SLOW&&Math.hypot(b.x-o.x,b.y-o.y)<o.r*.75){b.pit=key;b.vx=b.vy=0;b.x=o.x;b.y=o.y}
   }
   continue
  }
  if(o.t!=='slick'&&o.t!=='blackhole')continue
  for(const b of balls){
   if(!b.on||(b.z||0)>0)continue
   const dx=o.x-b.x,dy=o.y-b.y,d=Math.hypot(dx,dy)
   if(o.t==='slick'){
    if(d>=o.r)continue
    const k=1+SLICK_RATE[o.variant]*dt
    b.vx*=k;b.vy*=k
    if(o.variant==='plasma'&&Math.hypot(b.vx,b.vy)<8){b.vx=0;b.vy=0}   // a ball that slows in plasma gets stuck
   }else{
    if(d>=o.r||!(d>1))continue
    if(d<HOLE_CATCH&&Math.hypot(b.vx,b.vy)<520&&b.k!=='cue'&&(o.held.length+swallowed.filter(s=>s.hole===o).length)<HOLE_MAX_HELD){swallowed.push({hole:o,ball:b});continue}
    const a=HOLE_PULL*(1-d/o.r)*dt
    b.vx+=dx/d*a;b.vy+=dy/d*a
   }
  }
 }
 return swallowed
}

// A turn passes. Records that reach the end of their ttl are gone, and a black hole that closes gives back what it
// swallowed: returns {alive, released:[{n,x,y}]} where x,y is where the hole was.
export function ageHazards(list){
 const aged=(list||[]).map(o=>({...o,ttl:o.ttl-1})),alive=[],released=[]
 for(const o of aged){
  if(o.ttl>0)alive.push(o)
  else if(o.t==='blackhole')for(const n of o.held||[])released.push({n,x:o.x,y:o.y})
 }
 return {alive,released}
}

// The hazard a live record belongs to, for the "not two of a kind" rule.
export const hazardOf=o=>o.t==='bumper'&&o.vol!==undefined?'volcano':o.t==='portal'?'wormhole':(o.t==='slick'||o.t==='blackhole'||o.t==='pswitch'||o.t==='bonushole')?o.t:null
export const isHazardSpawn=type=>HAZARD_TYPES.includes(type)&&Boolean(SPAWN_TYPES[type])
export const RADIUS_CLEAR=R*2
