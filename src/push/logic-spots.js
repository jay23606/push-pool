import {R} from '../table.js'

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
