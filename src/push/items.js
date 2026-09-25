// P.U.S.H. Pool items: picked up by rolling the cue ball over them (or earned by a feat), used once, then gone.
// `use` is how it goes on the table: 'place' (positioned and rotated, within `range` of the cue ball), 'toss'
// (dragged for direction and force, always a little inaccurate), 'shoot' (a shot with a special ball), or 'instant'.
// `when` is 'before' or 'after' the shot, or 'either'. `rarity` weights item drops: higher is more common.

export const ITEMS={
 landmine:  {name:'Landmine',  use:'place',range:'medium',when:'before',rarity:6,blurb:'An explosive obstacle.'},
 wall:      {name:'Wall',      use:'place',range:'short', when:'before',rarity:8,blurb:'An immovable flat barrier.',group:'barrier'},
 cube:      {name:'Cube',      use:'place',range:'short', when:'before',rarity:8,blurb:'An immovable flat-sided block.',group:'barrier'},
 pillar:    {name:'Pillar',    use:'place',range:'short', when:'before',rarity:8,blurb:'An immovable round barrier.',group:'barrier'},
 cannonball:{name:'Cannon ball',use:'place',range:'short',when:'before',rarity:5,blurb:'A large, heavy movable ball.',group:'block'},
 pingpong:  {name:'Ping-pong ball',use:'place',range:'short',when:'before',rarity:8,blurb:'A small, light movable ball.',group:'block'},
 roller:    {name:'Roller',    use:'place',range:'short', when:'before',rarity:6,blurb:'A movable cylinder that rolls.',group:'block'},
 hole:      {name:'Hole',      use:'place',range:'medium',when:'before',rarity:5,blurb:'Catches a slow ball; a fast one skips over.'},
 fan:       {name:'Fan',       use:'place',range:'medium',when:'before',rarity:5,blurb:'A directional repelling force for one shot.'},
 bomb:      {name:'Bomb',      use:'toss', when:'before',rarity:6,blurb:'Explodes when it comes to rest.'},
 mortar:    {name:'Mortar',    use:'toss', when:'before',rarity:5,blurb:'Explodes on first impact.'},
 smokebomb: {name:'Smoke bomb',use:'toss', when:'before',rarity:5,blurb:'Hides part of the table for 1-3 shots.'},
 piggybank: {name:'Piggy bank',use:'toss', when:'before',rarity:4,blurb:'Spills gems when hit, then despawns.'},
 mulligan:  {name:'Mulligan',  use:'instant',when:'after',rarity:3,blurb:'Rewind your last shot. Costs nothing else.'},
 poppowder: {name:'Pop powder',use:'instant',when:'before',rarity:5,blurb:'Every collision makes a small explosion on the next shot.'},
 rutabaga:  {name:'Rutabaga',  use:'toss', when:'before',rarity:4,blurb:'Makes collisions unstable until it is pocketed.'},
 cluster:   {name:'Cluster',   use:'toss', when:'before',rarity:5,blurb:'Breaks into five ping-pong balls when hit.'},
 cannon:    {name:'Cannon',    use:'shoot',when:'before',rarity:1,blurb:'Fire a cannon ball at full power. Rare.'}
}
export const ITEM_IDS=Object.keys(ITEMS)

// A weighted pick from the catalogue. `rand` is injectable (a function returning [0,1)).
export function rollItem(rand=Math.random,ids=ITEM_IDS){
 const total=ids.reduce((s,id)=>s+ITEMS[id].rarity,0)
 let x=rand()*total
 for(const id of ids){x-=ITEMS[id].rarity;if(x<0)return id}
 return ids[ids.length-1]
}

// A gem's point value: mostly small, occasionally large.
export const GEM_VALUES=[1,2,5,10,25]
const GEM_WEIGHTS=[50,28,14,6,2]
export function rollGem(rand=Math.random){
 let x=rand()*GEM_WEIGHTS.reduce((a,b)=>a+b,0)
 for(let i=0;i<GEM_VALUES.length;i++){x-=GEM_WEIGHTS[i];if(x<0)return GEM_VALUES[i]}
 return GEM_VALUES[0]
}
