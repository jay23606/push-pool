import test from 'node:test';import assert from 'node:assert/strict'
import {POWERS,POWER_IDS,MAX_LEVEL,powerCost} from '../src/push/powers.js'
import {ITEMS,ITEM_IDS,rollItem,rollGem,GEM_VALUES} from '../src/push/items.js'
import {isDummy,makeDummy,nextDummyId,realBalls,splitPotted,dummyPoints,scatterDummies} from '../src/push/dummy.js'
import {newPlayer,award,owePick,offers,pick,whyNotPower,usePower,giveItem,useItem,whyNotItem} from '../src/push/economy.js'
import {SPAWN_TYPES,MAX_ACTIVE,dealSpawns,tickSpawns,makeSpawn} from '../src/push/spawns.js'

const seeded=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

test('every power has three levels, rising in cost, and the cheap ones are cheap',()=>{
 for(const id of POWER_IDS){
  const p=POWERS[id];assert.equal(p.levels.length,MAX_LEVEL,id)
  for(let i=1;i<p.levels.length;i++)assert.ok(p.levels[i].cost>p.levels[i-1].cost,`${id} level ${i+1} costs more`)
 }
 for(const cheap of ['guide','jump','spin'])assert.ok(powerCost(cheap,1)<=6,cheap)
 assert.ok(powerCost('nudge',1)>powerCost('spin',1)*4,'nudge is not cheap')
})

test('trail variants: plasma and stone cost more than ice',()=>{
 assert.ok(powerCost('trail',1,'plasma')>powerCost('trail',1,'ice'))
 assert.ok(powerCost('trail',1,'stone')>powerCost('trail',1,'plasma'))
 assert.equal(powerCost('trail',1,'lava'),null)
 assert.equal(powerCost('nope',1),null)
})

test('item catalogue: every item says how it is used',()=>{
 for(const id of ITEM_IDS){const i=ITEMS[id];assert.ok(['place','toss','shoot','instant'].includes(i.use),id);assert.ok(i.rarity>0,id)}
 assert.equal(ITEMS.mulligan.when,'after');assert.equal(ITEMS.cannon.use,'shoot')
 assert.ok(ITEMS.cannon.rarity<Math.min(...ITEM_IDS.filter(i=>i!=='cannon').map(i=>ITEMS[i].rarity)),'the cannon is the rarest item')
})

test('item and gem rolls are weighted, deterministic for a seed, and always valid',()=>{
 const r=seeded(7),counts={}
 for(let i=0;i<4000;i++){const id=rollItem(r);assert.ok(ITEMS[id]);counts[id]=(counts[id]||0)+1}
 assert.ok(counts.wall>counts.cannon*3,'common items outnumber the rare cannon')
 assert.equal(rollItem(seeded(3)),rollItem(seeded(3)))
 const g=seeded(9);for(let i=0;i<200;i++)assert.ok(GEM_VALUES.includes(rollGem(g)))
})

test('dummy balls are invisible to the rules',()=>{
 const balls=[{n:0,k:'cue',on:true},{n:3,k:'solid',on:true},makeDummy(100,50,50),makeDummy(101,80,80)]
 assert.deepEqual(realBalls(balls).map(b=>b.n),[0,3])
 const {real,dummies}=splitPotted([balls[1],balls[2],balls[3]])
 assert.equal(real.length,1);assert.equal(dummies.length,2)
 assert.equal(dummyPoints([balls[1],balls[2],balls[3]]),2)
 assert.ok(isDummy(balls[2])&&!isDummy(balls[1]))
 assert.equal(nextDummyId(balls),102);assert.equal(nextDummyId([]),100)
})

test('scatterDummies places the requested count clear of every ball',()=>{
 const balls=[{n:0,k:'cue',on:true,x:100,y:100}]
 const out=scatterDummies(balls,8,{minx:40,maxx:660,miny:40,maxy:340},seeded(5))
 assert.equal(out.length,8);assert.equal(new Set(out.map(b=>b.n)).size,8)
 for(const d of out)assert.ok(Math.hypot(d.x-100,d.y-100)>=18)
 assert.equal(scatterDummies(balls,3,{minx:100,maxx:100,miny:100,maxy:100},seeded(1)).length,0,'no room, none placed')
})

test('a level-up is owed, offers three powers, and a pick unlocks one at level 1',()=>{
 let p=owePick(newPlayer());assert.equal(p.picks,1)
 const o=offers(p,seeded(2));assert.equal(o.length,3);assert.equal(new Set(o.map(x=>x.id)).size,3)
 assert.ok(o.every(x=>x.level===1))
 const q=pick(p,o,o[0].id);assert.equal(q.powers[o[0].id],1);assert.equal(q.picks,0)
 assert.equal(pick(newPlayer(),o,o[0].id).powers[o[0].id],undefined,'no pick owed, nothing happens')
 assert.equal(pick(p,o,'not-offered').picks,1,'only an offered power can be taken')
 assert.equal(p.powers.tilt,undefined,'the input is never mutated')
})

test('an owned power is offered at its next level and a maxed one is not offered',()=>{
 const p={...newPlayer(),powers:{guide:1,spin:MAX_LEVEL}}
 const o=offers(p,seeded(4),POWER_IDS.length)
 assert.equal(o.find(x=>x.id==='guide').level,2)
 assert.ok(!o.some(x=>x.id==='spin'))
 assert.equal(o.length,POWER_IDS.length-1)
})

test('using a power spends points, at any level you own, and only when allowed',()=>{
 let p=award({...newPlayer(),powers:{spin:2,guide:1}},30)
 assert.equal(whyNotPower(p,'spin',2,'before'),null)
 assert.equal(usePower(p,'spin',2,'before').points,30-powerCost('spin',2))
 assert.equal(usePower(p,'spin',1,'before').points,30-powerCost('spin',1),'a lower level than owned is allowed')
 assert.equal(whyNotPower(p,'spin',3,'before'),'not-owned')
 assert.equal(whyNotPower(p,'tilt',1,'before'),'not-owned')
 assert.equal(whyNotPower(p,'spin',1,'after'),'wrong-time')
 assert.equal(whyNotPower({...p,points:1},'spin',1,'before'),'too-expensive')
 assert.equal(usePower({...p,points:1},'spin',1,'before').points,1,'a refused use spends nothing')
 assert.equal(p.points,30,'the input is never mutated')
})

test('an item is lost on use, one copy at a time, and only at its time',()=>{
 let p=giveItem(giveItem(newPlayer(),'bomb'),'bomb')
 assert.equal(whyNotItem(p,'bomb','before'),null)
 assert.equal(whyNotItem(p,'bomb','after'),'wrong-time')
 assert.equal(whyNotItem(p,'wall','before'),'not-held')
 p=useItem(p,'bomb','before');assert.deepEqual(p.items,['bomb'])
 assert.deepEqual(useItem(p,'wall','before').items,['bomb'])
 assert.equal(giveItem(newPlayer(),'nope').items.length,0)
 assert.deepEqual(useItem(giveItem(newPlayer(),'mulligan'),'mulligan','after').items,[])
})

test('nothing spawns on the break, and spawns are capped and never stack a type',()=>{
 assert.deepEqual(dealSpawns([],0,()=>0),[])
 const full=Array.from({length:MAX_ACTIVE},(_,i)=>({type:'gemdrop',ttl:2,i}))
 assert.deepEqual(dealSpawns(full,3,()=>0),[])
 const r=seeded(11)
 for(let i=0;i<300;i++){
  const active=[makeSpawn('wormhole',r,[1,1])],d=dealSpawns(active,2,r)
  assert.ok(!d.some(s=>s.type==='wormhole'))
 }
})

test('spawns carry their payloads and lifetimes from the catalogue',()=>{
 const r=seeded(21)
 for(const type of Object.keys(SPAWN_TYPES)){
  const s=makeSpawn(type,r,[10,20]),[lo,hi]=SPAWN_TYPES[type].life
  assert.ok(s.ttl>=lo&&s.ttl<=hi,type);assert.equal(s.kind,SPAWN_TYPES[type].kind)
 }
 assert.ok(ITEMS[makeSpawn('itemdrop',r,[0,0]).item])
 assert.ok(makeSpawn('gemdrop',r,[0,0]).gems.length>=3)
 assert.ok(['ice','electric','sand','plasma'].includes(makeSpawn('slick',r,[0,0]).variant))
 assert.equal(makeSpawn('volcano',r,[0,0]).ttl,4)
})

test('tickSpawns ages everything and sorts out what expired',()=>{
 const {alive,expired}=tickSpawns([{type:'a',ttl:1},{type:'b',ttl:3}])
 assert.deepEqual(alive.map(s=>[s.type,s.ttl]),[['b',2]]);assert.deepEqual(expired.map(s=>s.type),['a'])
})

test('dealing is deterministic for a seed',()=>{
 const a=dealSpawns([],3,seeded(99),()=>[5,5]),b=dealSpawns([],3,seeded(99),()=>[5,5])
 assert.deepEqual(a,b)
})
