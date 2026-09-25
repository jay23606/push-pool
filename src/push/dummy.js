import {R} from '../table.js'

// Dummy balls: flat grey, normal physics, worth few points. For the rules they are invisible: hitting, potting or
// leaving one never counts as your own ball, an opponent's ball, or a foul. Only real game balls reach the rules.

export const DUMMY_POINTS=1
export const isDummy=b=>b.k==='dummy'
// dummies take ids from 100 up so they cannot collide with a real ball's number (0-15)
export const DUMMY_BASE=100

export const makeDummy=(n,x,y,vx=0,vy=0)=>({id:n,x,y,vx,vy,wx:0,wy:0,wz:0,on:true,k:'dummy',n})
export const nextDummyId=balls=>Math.max(DUMMY_BASE-1,...balls.filter(isDummy).map(b=>b.n))+1

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
