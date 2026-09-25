import {R} from '../table.js'

// Dummy balls: flat grey, normal physics, worth few points. For the rules they are invisible: hitting, potting or
// leaving one never counts as your own ball, an opponent's ball, or a foul. Only real game balls reach the rules.

export const DUMMY_POINTS=1
export const isDummy=b=>b.k==='dummy'
// dummies take ids from 100 up so they cannot collide with a real ball's number (0-15)
export const DUMMY_BASE=100

export const makeDummy=(n,x,y,vx=0,vy=0)=>({id:n,x,y,vx,vy,wx:0,wy:0,wz:0,on:true,k:'dummy',n})
// Ids 100-169 are ordinary dummies, and the smallest free one is used so ids never creep up over a long game. 170-179 are
// ping-pong balls (light), 180-189 cannon balls (heavy) and 190-199 rutabagas (they make collisions unstable). The wire format
// and the rules treat them all as dummies; only the physics tells them apart, by mass.
export const LIGHT_BASE=170,HEAVY_BASE=180,RUTABAGA_BASE=190
export const LIGHT_MASS=.4,HEAVY_MASS=4
export const massOf=b=>b.m??(b.k!=='dummy'?1:b.n>=RUTABAGA_BASE?1:b.n>=HEAVY_BASE?HEAVY_MASS:b.n>=LIGHT_BASE?LIGHT_MASS:1)
export const isRutabaga=b=>b.k==='dummy'&&b.n>=RUTABAGA_BASE
export function nextDummyId(balls){
 const used=new Set(balls.filter(isDummy).map(b=>b.n))
 for(let n=DUMMY_BASE;n<LIGHT_BASE;n++)if(!used.has(n))return n
 return LIGHT_BASE-1
}
function nextIn(balls,lo,hi){
 const used=new Set(balls.filter(isDummy).map(b=>b.n))
 for(let n=lo;n<hi;n++)if(!used.has(n))return n
 return hi-1
}
export const makeLight=(balls,x,y)=>makeDummy(nextIn(balls,LIGHT_BASE,HEAVY_BASE),x,y)
export const makeHeavy=(balls,x,y)=>makeDummy(nextIn(balls,HEAVY_BASE,RUTABAGA_BASE),x,y)
export function nextRutabagaId(balls){
 const used=new Set(balls.filter(isRutabaga).map(b=>b.n))
 for(let n=RUTABAGA_BASE;n<=199;n++)if(!used.has(n))return n
 return 199
}
export const makeRutabaga=(balls,x,y)=>makeDummy(nextRutabagaId(balls),x,y)

// The table without its dummies: what the standard pool rules are asked about.
export const realBalls=balls=>balls.filter(b=>!isDummy(b))
export const splitPotted=potted=>({real:potted.filter(b=>!isDummy(b)),dummies:potted.filter(isDummy)})

// Points for the dummies a shot potted, when it was a legal shot.
export const dummyPoints=potted=>potted.filter(isDummy).length*DUMMY_POINTS

// Add `count` dummies at free spots (not on another ball), using `rand` for positions. Returns the new balls.
export function scatterDummies(balls,count,bounds,rand=Math.random){
 const {minx,maxx,miny,maxy}=bounds,out=[]
 let id=nextDummyId(balls)
 for(let tries=0;out.length<count&&tries<count*40;tries++){
  const x=minx+rand()*(maxx-minx),y=miny+rand()*(maxy-miny)
  if([...balls,...out].some(b=>b.on&&Math.hypot(b.x-x,b.y-y)<R*2.1))continue
  out.push(makeDummy(id++,x,y))
 }
 return out
}

// `count` dummies in a ring around (cx,cy), on free spots: a volcano's spew or a cluster breaking. Returns the new balls.
export function scatterAround(balls,count,cx,cy,rand=Math.random,kind='dummy'){
 const out=[];let id=kind==='light'?nextIn(balls,LIGHT_BASE,HEAVY_BASE):nextDummyId(balls)
 for(let tries=0;out.length<count&&tries<count*60;tries++){
  const a=rand()*Math.PI*2,d=R*2.4+rand()*(24+tries*.6),x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d
  if(x<40||x>660||y<40||y>340)continue
  if([...balls,...out].some(b=>b.on&&Math.hypot(b.x-x,b.y-y)<R*2.1))continue
  out.push(makeDummy(id++,x,y))
 }
 return out
}
