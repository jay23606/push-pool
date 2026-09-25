import test from 'node:test';import assert from 'node:assert/strict'
import {R} from '../src/table.js'
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

// ---- rules, protocol and state ----
import {MODES,isScoreMode,targetFor,judgeScoreGame,PUSH_TARGET,PUSH_POT,PUSH_FOUL,rack} from '../src/rules.js'
import {isGameMessage} from '../src/protocol.js'
import {freshRackState,snapshotOf,applySnapshot} from '../src/game-state.js'
import {freshPush,validPush} from '../src/push/state.js'

const shot=(o)=>({mode:'push',turn:'a',score:{a:0,b:0},potted:[],firstHit:{n:3},scratch:false,balls:rack('8ball'),...o})
const real=n=>({n,k:n<8?'solid':'stripe',on:false}),dum=n=>({...makeDummy(n,0,0),on:false})

test('push is a scored game with a long points target',()=>{
 assert.ok(MODES.push);assert.ok(isScoreMode('push'));assert.equal(targetFor('push'),PUSH_TARGET)
})

test('a real ball is worth ten, keeps the turn, and owes a level-up',()=>{
 const v=judgeScoreGame(shot({potted:[real(3)]}))
 assert.equal(v.score.a,PUSH_POT);assert.equal(v.nextTurn,'a');assert.equal(v.levelUps,1)
 assert.equal(judgeScoreGame(shot({potted:[real(3),real(9)]})).levelUps,2)
})

test('a dummy ball scores a point but never keeps the turn or owes a level-up',()=>{
 const v=judgeScoreGame(shot({potted:[dum(100),dum(101)]}))
 assert.equal(v.score.a,2);assert.equal(v.nextTurn,'b');assert.equal(v.levelUps,0);assert.equal(v.foul,false)
 const mixed=judgeScoreGame(shot({potted:[dum(100),real(3)]}))
 assert.equal(mixed.score.a,PUSH_POT+1);assert.equal(mixed.nextTurn,'a')
})

test('a foul costs points, never below zero, and forfeits everything the shot potted',()=>{
 const v=judgeScoreGame(shot({score:{a:12,b:0},potted:[real(3),dum(100)],scratch:true}))
 assert.equal(v.foul,true);assert.equal(v.score.a,12-PUSH_FOUL);assert.equal(v.levelUps,0);assert.equal(v.nextTurn,'b')
 assert.equal(judgeScoreGame(shot({score:{a:2,b:0},scratch:true})).score.a,0)
 assert.equal(judgeScoreGame(shot({firstHit:null})).reason,'no-contact')
})

test('dummy balls do not count towards the rack running out, and the target wins',()=>{
 const onlyDummies=[{n:0,k:'cue',on:true},makeDummy(100,1,1),makeDummy(101,2,2)]
 assert.equal(judgeScoreGame(shot({balls:onlyDummies})).rerack,true,'no real balls left: re-rack')
 assert.equal(judgeScoreGame(shot({score:{a:PUSH_TARGET-5,b:0},potted:[real(3)]})).winner,'a')
 assert.equal(judgeScoreGame(shot({score:{a:PUSH_TARGET-30,b:0},potted:[real(3)]})).winner,null)
})

const tuple=(n,k)=>[10,10,true,k,n,0,0,0,0,0]
const snap=(extra=[],push)=>({...snapshotOf({...freshRackState('push'),balls:[...rack('push'),...extra],round:1}),...(push===undefined?{}:{push})})

test('the protocol accepts a push state with dummies and refuses them anywhere else',()=>{
 const withDummies=snap([makeDummy(100,50,50),makeDummy(101,80,80)])
 assert.ok(isGameMessage(withDummies))
 assert.equal(isGameMessage({...withDummies,mode:'8ball'}),false,'dummies only exist in push')
 assert.equal(isGameMessage({...withDummies,b:[...withDummies.b,tuple(100,'dummy')]}),false,'duplicate id')
 assert.equal(isGameMessage({...withDummies,b:[...withDummies.b,tuple(250,'dummy')]}),false,'dummy id out of range')
 assert.equal(isGameMessage({...withDummies,b:withDummies.b.slice(1)}),false,'a real ball is missing')
 const many=snap(Array.from({length:61},(_,i)=>makeDummy(100+i,10,10)))
 assert.equal(isGameMessage(many),false,'too many dummies')
})

test('push state travels in the snapshot and is validated',()=>{
 const g=freshRackState('push');assert.deepEqual(g.push,freshPush());assert.equal(freshRackState('8ball').push,undefined)
 const s=snapshotOf({...g,balls:rack('push'),round:1});assert.ok(isGameMessage(s))
 const back={};applySnapshot(back,JSON.parse(JSON.stringify(s)));assert.deepEqual(back.push,g.push)
 const good={...freshPush(),a:{powers:{spin:2},items:['bomb'],picks:1},offers:[{id:'guide',level:1}],spawns:[{type:'gemdrop',ttl:1,x:5,y:6}]}
 assert.ok(validPush(good));assert.ok(validPush(null));assert.ok(validPush(undefined))
 assert.equal(validPush({...good,a:{...good.a,powers:{spin:9}}}),false,'level out of range')
 assert.equal(validPush({...good,a:{...good.a,powers:{fly:1}}}),false,'unknown power')
 assert.equal(validPush({...good,a:{...good.a,items:['nuke']}}),false,'unknown item')
 assert.equal(validPush({...good,spawns:[{type:'gemdrop',ttl:1,x:'a'}]}),false,'bad coordinate')
 assert.equal(validPush({...good,offers:[{id:'spin',level:0}]}),false,'bad offer')
 assert.equal(isGameMessage({...s,push:{a:1}}),false,'a malformed push field drops the message')
})

// ---- the logic around a shot ----
import {collectPickups,afterShot,choosePower,payPower,freeSpot,LIVE_SPAWNS,GEM_LIFE} from '../src/push/logic.js'
const BOUNDS={minx:40,maxx:660,miny:40,maxy:340}
const withPush=(o={})=>({...freshPush(),...o})

test('the cue ball takes gems as points and items into hand, only when it is over them',()=>{
 const push=withPush({pickups:[{kind:'gem',v:5,x:100,y:100,ttl:2},{kind:'item',id:'bomb',x:104,y:100,ttl:2},{kind:'gem',v:9,x:300,y:300,ttl:2}]})
 const far=collectPickups(push,{a:0,b:0},'a',{x:500,y:50,on:true});assert.equal(far.collected.length,0);assert.equal(far.push,push)
 const r=collectPickups(push,{a:3,b:0},'a',{x:102,y:100,on:true})
 assert.equal(r.score.a,8);assert.deepEqual(r.push.a.items,['bomb']);assert.equal(r.push.pickups.length,1);assert.equal(r.collected.length,2)
 assert.equal(collectPickups(push,{a:0,b:0},'a',{x:102,y:100,on:false}).collected.length,0,'a potted cue ball takes nothing')
 assert.equal(push.pickups.length,3,'the input is never mutated')
})

test('a legal pot owes a pick and puts three offers up; choosing takes one and clears them',()=>{
 const r=afterShot(withPush(),{shooter:'a',levelUps:1,turnChanged:false,balls:[],bounds:BOUNDS,rand:seeded(3)})
 assert.equal(r.push.a.picks,1);assert.equal(r.push.offers.length,3);assert.ok(r.messages.some(m=>/Level up/.test(m)))
 const id=r.push.offers[1].id,after=choosePower(r.push,'a',id,seeded(4))
 assert.equal(after.a.powers[id],1);assert.equal(after.a.picks,0);assert.equal(after.offers,null)
 assert.equal(choosePower(r.push,'a','fly',seeded(4)),r.push,'a power that was not offered changes nothing')
 const idle=withPush();assert.equal(choosePower(idle,'a','guide'),idle,'no offers up, nothing happens')
})

test('two picks owed means a second offer once the first is taken',()=>{
 const r=afterShot(withPush(),{shooter:'a',levelUps:2,balls:[],bounds:BOUNDS,rand:seeded(8)})
 const first=choosePower(r.push,'a',r.push.offers[0].id,seeded(9))
 assert.equal(first.a.picks,1);assert.equal(first.offers.length,3)
})

test('nothing is dealt and nothing ages until the turn passes; then pickups age and drop out',()=>{
 const push=withPush({pickups:[{kind:'gem',v:1,x:60,y:60,ttl:1},{kind:'gem',v:1,x:90,y:90,ttl:3}]})
 assert.equal(afterShot(push,{shooter:'a',turnChanged:false,balls:[],bounds:BOUNDS}).push.pickups.length,2)
 const r=afterShot(push,{shooter:'a',turnChanged:true,balls:[],bounds:BOUNDS,rand:()=>.99})   // .99: nothing dealt
 assert.deepEqual(r.push.pickups.map(k=>k.ttl),[2]);assert.equal(r.push.turns,1)
})

test('dealing on a turn change drops gems or an item, only the implemented kinds, on free spots',()=>{
 let gems=0,items=0
 for(let i=1;i<=80;i++){
  const balls=[{n:0,k:'cue',on:true,x:154,y:190}]
  const r=afterShot(withPush({turns:1}),{shooter:'a',turnChanged:true,balls,bounds:BOUNDS,rand:seeded(i)})
  for(const k of r.push.pickups){
   assert.ok(Math.hypot(k.x-154,k.y-190)>=R*2.2,'clear of the cue ball');assert.ok(k.x>=40&&k.x<=660&&k.y>=40&&k.y<=340)
   if(k.kind==='gem'){gems++;assert.equal(k.ttl,GEM_LIFE)}else items++
  }
  assert.ok(r.push.spawns.every(s=>LIVE_SPAWNS.includes(s.type)),'unimplemented hazards are never dealt')
  assert.ok(isGameMessage(snapshotOf({...freshRackState('push'),balls:rack('push'),round:1,push:r.push})),'the result is valid on the wire')
 }
 assert.ok(gems>0&&items>0,'both kinds turn up')
})

test('the table starts with nothing on it: the break is standard',()=>{
 assert.equal(freshPush().pickups.length,0);assert.equal(freshPush().spawns.length,0)
})

test('paying for a power comes out of the score and only when allowed',()=>{
 const push=withPush({a:{powers:{jump:1},items:[],picks:0}})
 const ok=payPower(push,{a:10,b:0},'a','jump',1,'before');assert.equal(ok.ok,true);assert.equal(ok.score.a,10-powerCost('jump',1))
 assert.equal(payPower(push,{a:1,b:0},'a','jump',1,'before').why,'too-expensive')
 assert.equal(payPower(push,{a:10,b:0},'b','jump',1,'before').why,'not-owned','b has not unlocked it')
 assert.equal(payPower(push,{a:10,b:0},'a','jump',2,'before').why,'not-owned')
})

test('freeSpot gives up cleanly when the table is full',()=>{
 assert.equal(freeSpot([{on:true,x:100,y:100}],[],{minx:100,maxx:100,miny:100,maxy:100},seeded(1)),null)
 assert.ok(freeSpot([],[],BOUNDS,seeded(1)))
})

test('an unclaimed level-up waits for its owner: offers follow the turn',()=>{
 // a owes two picks and the turn passes to b, who owes none: nothing on offer, a's picks are kept
 const owed=withPush({a:{powers:{},items:[],picks:2},offers:[{id:'guide',level:1}]})
 const toB=afterShot(owed,{shooter:'a',nextTurn:'b',turnChanged:true,balls:[],bounds:BOUNDS,rand:()=>.99})
 assert.equal(toB.push.offers,null);assert.equal(toB.push.a.picks,2)
 // the turn comes back to a: the offers are put up again
 const back=afterShot(toB.push,{shooter:'b',nextTurn:'a',turnChanged:true,balls:[],bounds:BOUNDS,rand:seeded(5)})
 assert.equal(back.push.offers.length,3);assert.equal(back.push.a.picks,2)
 // b pots and keeps the turn while a still owes picks: b is offered, a's stay owed
 const bPots=afterShot(withPush({a:{powers:{},items:[],picks:2}}),{shooter:'b',nextTurn:'b',levelUps:1,balls:[],bounds:BOUNDS,rand:seeded(6)})
 assert.equal(bPots.push.offers.length,3);assert.equal(bPots.push.b.picks,1);assert.equal(bPots.push.a.picks,2)
})

// ---- placing ----
import {shapeOf,whyNotPlace,placeItem,ageObstacles,RANGE,PLACEABLE,OBSTACLE_LIFE,WALL_LEN,CUBE_SIDE} from '../src/push/placing.js'
import {obstacleStep,setObstacles} from '../src/obstacles.js'
const cueAt=(x,y)=>({n:0,k:'cue',on:true,x,y,vx:0,vy:0})
const holding=(...items)=>withPush({a:{powers:{},items,picks:0}})
const ctx=(balls=[],cue=cueAt(200,190))=>({cue,balls:[cue,...balls],bounds:BOUNDS})

test('placeable items turn into the obstacle records the physics already knows',()=>{
 const w=shapeOf('wall',200,190,0);assert.equal(w.length,1);assert.equal(w[0].t,'wall')
 assert.ok(Math.abs(Math.hypot(w[0].x2-w[0].x1,w[0].y2-w[0].y1)-WALL_LEN)<1e-9)
 const tilted=shapeOf('wall',200,190,Math.PI/2);assert.ok(Math.abs(tilted[0].x1-tilted[0].x2)<1e-9,'rotated a quarter turn it stands upright')
 assert.equal(shapeOf('cube',200,190,.4).length,4,'a cube is four walls')
 assert.equal(shapeOf('pillar',200,190)[0].t,'bumper')
 assert.deepEqual(PLACEABLE,['wall','cube','pillar','landmine','fan','hole','pingpong','cannonball','roller']);assert.deepEqual(shapeOf('bomb',1,1),[])
})

test('a placed wall really stops a ball: the physics treats it like any obstacle',()=>{
 const push=placeItem(holding('wall'),'a','wall',{x:300,y:190,rot:Math.PI/2},ctx())
 setObstacles(push.obstacles)
 const b={x:270,y:190,vx:200,vy:0,wx:0,wy:0,wz:0,z:0}
 for(let i=0;i<40;i++){b.x+=b.vx*.005;obstacleStep(b)}
 setObstacles([]);assert.ok(b.vx<0,'it bounced back off the wall')
})

test('placement rules: held, in range, on the cloth, clear of balls and other barriers',()=>{
 const c=ctx([{n:3,k:'solid',on:true,x:260,y:190}]),h=holding('wall','cube','pillar','bomb')
 assert.equal(whyNotPlace(h,'a','wall',{x:220,y:120,rot:0},c),null)
 assert.equal(whyNotPlace(holding(),'a','wall',{x:220,y:120,rot:0},c),'not-held')
 assert.equal(whyNotPlace(h,'a','bomb',{x:220,y:120,rot:0},c),'not-placeable','bombs are tossed, not placed')
 assert.equal(whyNotPlace(h,'a','wall',{x:200+RANGE.short+5,y:190,rot:0},c),'too-far')
 assert.equal(whyNotPlace(h,'a','wall',{x:260,y:190,rot:0},c),'on-a-ball')
 assert.equal(whyNotPlace(h,'a','pillar',{x:'x',y:1},c),'bad-spot')
 assert.equal(whyNotPlace(h,'a','wall',{x:200,y:120,rot:0},{...c,cue:{...cueAt(45,45),on:false}}),'no-cue')
 const edge=ctx([],cueAt(60,60));assert.equal(whyNotPlace(h,'a','wall',{x:50,y:60,rot:0},edge),'off-table')
 const placed=placeItem(h,'a','wall',{x:220,y:120,rot:0},c)
 assert.equal(whyNotPlace(placed,'a','wall',{x:225,y:122,rot:0},{...c}),'not-held','one wall in hand, used')
 assert.equal(whyNotPlace({...placed,a:{...placed.a,items:['wall']}},'a','wall',{x:225,y:122,rot:0},c),'on-an-obstacle')
})

test('placing uses the item up, gives the barrier a lifetime, and never mutates its input',()=>{
 const h=holding('wall','wall'),p=placeItem(h,'a','wall',{x:220,y:120,rot:0},ctx())
 assert.deepEqual(p.a.items,['wall']);assert.equal(h.a.items.length,2)
 assert.ok(p.obstacles.every(o=>o.ttl===OBSTACLE_LIFE&&o.item==='wall'))
 assert.equal(p.a.points,undefined,'no points key leaks into the push state')
 const refused=placeItem(h,'a','wall',{x:900,y:900,rot:0},ctx());assert.equal(refused,h)
 assert.ok(validPush(p),'and it is valid on the wire')
})

test('barriers age with the turns and then disappear',()=>{
 const p=placeItem(holding('cube'),'a','cube',{x:250,y:190,rot:.3},ctx())
 assert.equal(p.obstacles.length,4)
 let list=p.obstacles;for(let i=0;i<OBSTACLE_LIFE-1;i++)list=ageObstacles(list)
 assert.equal(list.length,4,'still there one turn before the end');assert.equal(ageObstacles(list).length,0)
 const viaShot=afterShot(p,{shooter:'a',nextTurn:'b',turnChanged:true,balls:[],bounds:BOUNDS,rand:()=>.99})
 assert.ok(viaShot.push.obstacles.every(o=>o.ttl===OBSTACLE_LIFE-1),'a turn passing ages them')
 assert.ok(CUBE_SIDE>0)
})

test('a malformed obstacle drops the state message',()=>{
 const good=placeItem(holding('pillar'),'a','pillar',{x:230,y:190},ctx())
 assert.ok(validPush(good))
 assert.equal(validPush({...good,obstacles:[{t:'lava',ttl:1}]}),false)
 assert.equal(validPush({...good,obstacles:[{t:'wall',x1:1,y1:1,x2:'a',y2:1,ttl:1}]}),false)
 assert.equal(validPush({...good,obstacles:Array.from({length:61},()=>({t:'bumper',x:1,y:1,r:1,ttl:1}))}),false)
})

// ---- armed powers on the wire and in the logic ----
import {payArmed} from '../src/push/logic.js'
test('payArmed charges each power in turn and skips what cannot go through',()=>{
 const push=withPush({a:{powers:{pop:1,cute:2,jump:1},items:[],picks:0}})
 const r=payArmed(push,{a:100,b:0},'a',{pop:1,cute:2,jump:1,stink:1})
 assert.deepEqual(Object.keys(r.applied).sort(),['cute','pop'],'jump is not armable, stink is not owned')
 assert.equal(r.score.a,100-25-38);assert.equal(r.applied.cute.force,300)
 const tight=payArmed(push,{a:40,b:0},'a',{pop:1,cute:2})
 assert.deepEqual(Object.keys(tight.applied),['pop'],'the second is skipped once the first has been paid');assert.equal(tight.score.a,15)
 assert.deepEqual(payArmed(push,{a:100,b:0},'a',null).applied,{})
})

test('a shot message may carry armed powers, and a malformed set is refused',()=>{
 const shotMsg=o=>({t:'shot',vx:1,vy:2,spin:[0,0],...o})
 assert.ok(isGameMessage(shotMsg({powers:{pop:2,stink:1}})));assert.ok(isGameMessage(shotMsg({})))
 for(const bad of [{pop:9},{fly:1},{pop:1.5},[],'pop',{pop:'1'}])assert.equal(isGameMessage(shotMsg({powers:bad})),false,JSON.stringify(bad))
})

// ---- tossing ----
import {landing,scatterAt,whyNotToss,tossItem,skidTo,smokeAt,EFFECTS,TOSS_RANGE,SCATTER,TOSSABLE,SMOKE_LIFE} from '../src/push/toss.js'

test('a toss lands near where it was aimed, always strays a little, and never leaves the cloth or its range',()=>{
 const cue=cueAt(200,190),seen=new Set()
 for(let i=1;i<=300;i++){
  const l=landing(cue,{x:400,y:190},BOUNDS,seeded(i)),d=Math.hypot(l.x-cue.x,l.y-cue.y)
  assert.ok(Math.hypot(l.x-400,l.y-190)<=200*SCATTER+1,'within the scatter radius');seen.add(`${l.x},${l.y}`)
  assert.ok(l.x>=BOUNDS.minx&&l.x<=BOUNDS.maxx&&l.y>=BOUNDS.miny&&l.y<=BOUNDS.maxy);assert.ok(d<=TOSS_RANGE*(1+SCATTER)+1)
 }
 assert.ok(seen.size>100,'the scatter is real')
 const far=landing(cue,{x:2000,y:190},BOUNDS,seeded(1));assert.ok(far.x<=BOUNDS.maxx,'aimed past the range or the rail, it stays on the table')
 assert.equal(landing(cue,{x:200,y:190},BOUNDS,seeded(1)).x,200,'aimed at the cue ball itself, no direction')
 assert.equal(landing(cue,{x:400,y:190},BOUNDS,seeded(9)).x,landing(cue,{x:400,y:190},BOUNDS,seeded(9)).x,'deterministic for a seed')
 assert.ok(scatterAt(cue,{x:300,y:190})<scatterAt(cue,{x:450,y:190}),'the further, the wilder')
})

test('toss rules: held, tossable, cue ball on the table; the item is used up',()=>{
 const h=holding('bomb','wall');const c={cue:cueAt(200,190)}
 assert.equal(whyNotToss(h,'a','bomb',c),null);assert.equal(whyNotToss(h,'a','wall',c),'not-tossable');assert.equal(whyNotToss(holding(),'a','bomb',c),'not-held')
 assert.equal(whyNotToss(h,'a','bomb',{cue:{...cueAt(1,1),on:false}}),'no-cue')
 assert.deepEqual(tossItem(h,'a','bomb',c).a.items,['wall']);assert.equal(tossItem(h,'a','wall',c),h)
 assert.deepEqual(TOSSABLE,['bomb','mortar','smokebomb','cluster','piggybank','rutabaga'])
})

test('a bomb skids on where it landed, a mortar goes off exactly there, and smoke is a cloud that lasts a few turns',()=>{
 assert.deepEqual(skidTo({x:300,y:190},0,'mortar',BOUNDS),{x:300,y:190})
 assert.ok(skidTo({x:300,y:190},0,'bomb',BOUNDS).x>300)
 assert.ok(skidTo({x:655,y:190},0,'bomb',BOUNDS).x<=BOUNDS.maxx,'and stays on the cloth')
 assert.ok(EFFECTS.mortar.power>EFFECTS.bomb.power&&EFFECTS.mortar.radius<EFFECTS.bomb.radius)
 for(let i=1;i<=50;i++){const s=smokeAt({x:5,y:6},seeded(i));assert.equal(s.t,'smoke');assert.ok(s.ttl>=SMOKE_LIFE[0]&&s.ttl<=SMOKE_LIFE[1])}
 assert.ok(validPush({...withPush(),obstacles:[smokeAt({x:5,y:6},seeded(1))]}))
})

test('the wire carries a toss request and refuses a malformed one',()=>{
 assert.ok(isGameMessage({t:'toss',item:'bomb',x:300,y:190}))
 for(const bad of [{t:'toss',item:'bomb',x:'a',y:1},{t:'toss',x:1,y:1},{t:'toss',item:'x'.repeat(30),x:1,y:1}])assert.equal(isGameMessage(bad),false)
})

// ---- hazards ----
import {makeHazard,stepHazards,ageHazards,hazardOf,SLICKS,HOLE_R,HOLE_MAX_HELD,MAX_DUMMIES_ON_TABLE,HURRICANE} from '../src/push/hazards.js'
const cueBall=cueAt(100,100)
const spawnOf=(type,o={})=>({type,ttl:3,...o})

test('a wormhole is two linked portals, well apart and on the cloth',()=>{
 for(let i=1;i<=40;i++){
  const h=makeHazard(spawnOf('wormhole'),[cueBall],BOUNDS,seeded(i))
  assert.equal(h.obstacles.length,2);const [a,b]=h.obstacles
  assert.equal(a.t,'portal');assert.deepEqual(a.to,[b.x,b.y]);assert.deepEqual(b.to,[a.x,a.y]);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>120);assert.equal(a.ttl,3)
  assert.ok(validPush({...withPush(),obstacles:h.obstacles}),'valid on the wire')
 }
})

test('slicks come in four kinds with a sensible size; a black hole starts empty; a hurricane is a dummy count, not an object',()=>{
 for(const v of SLICKS){const s=makeHazard(spawnOf('slick',{variant:v}),[],BOUNDS,seeded(4)).obstacles[0];assert.equal(s.variant,v);assert.ok(s.r>=34&&s.r<=58);assert.ok(validPush({...withPush(),obstacles:[s]}))}
 const bh=makeHazard(spawnOf('blackhole'),[],BOUNDS,seeded(4)).obstacles[0];assert.deepEqual(bh.held,[]);assert.equal(bh.r,HOLE_R)
 const hu=makeHazard(spawnOf('hurricane'),[],BOUNDS,seeded(4));assert.deepEqual(hu.obstacles,[]);assert.ok(hu.dummies>=HURRICANE[0]&&hu.dummies<=HURRICANE[1])
 const crowded=Array.from({length:MAX_DUMMIES_ON_TABLE},(_,i)=>makeDummy(100+i,1,1))
 assert.equal(makeHazard(spawnOf('hurricane'),crowded,BOUNDS,seeded(4)).dummies,0,'a crowded table gets no more')
 assert.equal(makeHazard(spawnOf('mystery'),[],BOUNDS,seeded(1)).obstacles.length,0,'an unknown type makes nothing')
})

const rolling=(x,y,vx,vy)=>({n:5,k:'solid',on:true,x,y,vx,vy,wx:0,wy:0,wz:0,z:0})
test('slick physics: ice keeps a ball going, electric speeds it up, sand slows it, plasma sticks it',()=>{
 const speed=b=>Math.hypot(b.vx,b.vy),run=(variant,v=100)=>{const b=rolling(100,100,v,0);for(let i=0;i<60;i++)stepHazards([b],[{t:'slick',variant,x:100,y:100,r:50,ttl:2}],1/120);return b}
 assert.ok(speed(run('ice'))>100);assert.ok(speed(run('electric'))>speed(run('ice')));assert.ok(speed(run('sand'))<100)
 const stuck=run('plasma',40);assert.equal(speed(stuck),0,'a slow ball in plasma stops dead')
 const off=rolling(300,300,100,0);stepHazards([off],[{t:'slick',variant:'electric',x:100,y:100,r:50,ttl:2}],1/120);assert.equal(off.vx,100,'off the patch, untouched')
 const air={...rolling(100,100,100,0),z:5};stepHazards([air],[{t:'slick',variant:'sand',x:100,y:100,r:50,ttl:2}],1/120);assert.equal(air.vx,100,'a jumping ball skips over it')
})

test('a black hole pulls balls in, swallows a slow one at the centre, never the cue ball, and holds only a few',()=>{
 const hole={t:'blackhole',x:200,y:200,r:HOLE_R,held:[],ttl:3}
 const b=rolling(260,200,0,0);stepHazards([b],[hole],.05);assert.ok(b.vx<0,'pulled toward the centre')
 const far=rolling(200+HOLE_R+5,200,0,0);stepHazards([far],[hole],.05);assert.equal(far.vx,0,'out of reach')
 const slow=rolling(203,200,10,0),sw=stepHazards([slow],[hole],.01);assert.equal(sw.length,1);assert.equal(sw[0].ball,slow)
 const fast=rolling(203,200,900,0);assert.equal(stepHazards([fast],[hole],.01).length,0,'a fast ball slings past')
 const cue={...rolling(203,200,10,0),k:'cue',n:0};assert.equal(stepHazards([cue],[hole],.01).length,0)
 const full={...hole,held:Array.from({length:HOLE_MAX_HELD},(_,i)=>i+1)};assert.equal(stepHazards([rolling(203,200,10,0)],[full],.01).length,0,'full')
})

test('hazards age with the turns; a black hole that closes gives its balls back where it was',()=>{
 const list=[{t:'blackhole',x:120,y:90,r:HOLE_R,held:[3,7],ttl:1},{t:'slick',variant:'ice',x:1,y:1,r:40,ttl:2},{t:'wall',x1:0,y1:0,x2:1,y2:1,ttl:1}]
 const r=ageHazards(list);assert.deepEqual(r.alive.map(o=>o.t),['slick']);assert.deepEqual(r.released,[{n:3,x:120,y:90},{n:7,x:120,y:90}])
 assert.equal(hazardOf({t:'portal'}),'wormhole');assert.equal(hazardOf({t:'wall'}),null)
})

test('dealing can now bring hazards, at most one of a kind, and a hurricane reports its dummies',()=>{
 const kinds=new Set();let dummies=0,released=0
 for(let i=1;i<=400;i++){
  const balls=[{n:0,k:'cue',on:true,x:154,y:190}]
  const r=afterShot(withPush({turns:1}),{shooter:'a',nextTurn:'b',turnChanged:true,balls,bounds:BOUNDS,rand:seeded(i)})
  for(const o of r.push.obstacles)kinds.add(hazardOf(o));dummies+=r.dummies;released+=r.release.length
  assert.ok(isGameMessage(snapshotOf({...freshRackState('push'),balls:rack('push'),round:1,push:r.push})),'still valid on the wire')
 }
 for(const k of ['wormhole','slick','blackhole'])assert.ok(kinds.has(k),k+' turns up')
 assert.ok(dummies>0,'hurricanes turn up');assert.equal(released,0)
 const twice=afterShot(withPush({turns:1,obstacles:[{t:'slick',variant:'ice',x:9,y:9,r:40,ttl:5}]}),{shooter:'a',nextTurn:'b',turnChanged:true,balls:[],bounds:BOUNDS,rand:seeded(3)})
 assert.ok(twice.push.obstacles.filter(o=>o.t==='slick').length<=1,'never two slicks')
})

// ---- bonuses ----
test('a P switch and a bonus hole are dealt as records; the hole sits on a long rail with its reward',()=>{
 const ps=makeHazard(spawnOf('pswitch'),[cueBall],BOUNDS,seeded(2)).obstacles[0];assert.equal(ps.t,'pswitch');assert.ok(validPush({...withPush(),obstacles:[ps]}))
 for(let i=1;i<=60;i++){
  const h=makeHazard(spawnOf('bonushole',{ttl:1,reward:i%2?{gems:10}:{item:'bomb'}}),[],BOUNDS,seeded(i)).obstacles[0]
  assert.ok(h.y===28||h.y===352,'on a long rail');assert.ok(h.x>=140&&h.x<=560);assert.equal(h.ttl,1);assert.ok(validPush({...withPush(),obstacles:[h]}))
 }
 assert.equal(validPush({...withPush(),obstacles:[{t:'bonushole',x:1,y:1,r:5,reward:{item:'nuke'},ttl:1}]}),false,'an unknown item')
 assert.equal(validPush({...withPush(),obstacles:[{t:'bonushole',x:1,y:1,r:5,reward:{gems:1000},ttl:1}]}),false,'too many gems')
 assert.equal(hazardOf(ps),'pswitch')
})

// ---- fan, hole, volcano, barf, piggy bank ----
import {VOLCANO_ERUPT,VOLCANO_SPEWS,FAN_FORCE,PIT_SLOW,PIT_ESCAPE} from '../src/push/hazards.js'
import {FAN_R,PIT_R} from '../src/push/placing.js'
import {scatterAround} from '../src/push/dummy.js'

test('a fan pushes balls along its direction, more the nearer, and only inside its reach',()=>{
 const fan={t:'fan',x:200,y:200,r:FAN_R,rot:0,ttl:1}
 const near=rolling(220,200,0,0),far=rolling(200+FAN_R+5,200,0,0),edge=rolling(200+FAN_R-5,200,0,0)
 stepHazards([near,far,edge],[fan],.05)
 assert.ok(near.vx>edge.vx&&edge.vx>0,'stronger near the fan');assert.equal(far.vx,0)
 const turned=rolling(200,220,0,0);stepHazards([turned],[{...fan,rot:Math.PI/2}],.05);assert.ok(turned.vy>0&&Math.abs(turned.vx)<1e-9,'pushes the way it points')
 assert.ok(FAN_FORCE>0);assert.ok(validPush({...withPush(),obstacles:[fan]}))
})

test('a hole catches a slow ball, holds it, lets a hard hit knock it free, and a fast ball skips over',()=>{
 const pit={t:'pit',x:200,y:200,r:PIT_R,ttl:5}
 const slow=rolling(203,200,PIT_SLOW-30,0);stepHazards([slow],[pit],.01);assert.ok(slow.pit);assert.equal(slow.vx,0);assert.equal(slow.x,200)
 stepHazards([slow],[pit],.01);assert.equal(slow.x,200,'it stays put')
 slow.vx=PIT_ESCAPE+50;stepHazards([slow],[pit],.01);assert.equal(slow.pit,null,'a hard hit frees it');assert.ok(slow.vx>0)
 const fast=rolling(203,200,PIT_SLOW+200,0);stepHazards([fast],[pit],.01);assert.ok(!fast.pit,'a fast ball skips over')
 const orphan=rolling(50,50,0,0);orphan.pit='9,9';stepHazards([orphan],[pit],.01);assert.equal(orphan.pit,null,'a pin to a hole that has gone is dropped')
 assert.ok(validPush({...withPush(),obstacles:[pit]}))
})

test('fan, hole and ping-pong can be placed; a ping-pong ball is a drop, not an obstacle',()=>{
 const h=holding('fan','hole','pingpong'),c=ctx()
 for(const id of ['fan','hole','pingpong'])assert.equal(whyNotPlace(h,'a',id,{x:250,y:150,rot:0},c),null,id)
 const fan=placeItem(h,'a','fan',{x:250,y:150,rot:1},c);assert.equal(fan.obstacles[0].t,'fan');assert.equal(fan.obstacles[0].ttl,1);assert.equal(fan.obstacles[0].rot,1)
 const hole=placeItem(h,'a','hole',{x:250,y:150},c);assert.equal(hole.obstacles[0].t,'pit')
 const pp=placeItem(h,'a','pingpong',{x:250,y:150},c);assert.deepEqual(pp.drops,[{x:250,y:150,kind:'light',rot:0}]);assert.equal((pp.obstacles||[]).length,0);assert.deepEqual(pp.a.items,['fan','hole'])
 assert.equal(whyNotPlace(h,'a','fan',{x:200+181,y:190,rot:0},c),'too-far')
})

test('a volcano erupts with a blast and dummies, then spews fewer each turn, then closes',()=>{
 const v=makeHazard(spawnOf('volcano',{ttl:4}),[],BOUNDS,seeded(3));assert.equal(v.obstacles[0].t,'bumper');assert.equal(v.obstacles[0].vol,VOLCANO_SPEWS)
 assert.equal(v.spew.count,VOLCANO_ERUPT);assert.ok(v.blast.power>0);assert.equal(hazardOf(v.obstacles[0]),'volcano');assert.ok(validPush({...withPush(),obstacles:v.obstacles}))
 let push=withPush({turns:1,obstacles:v.obstacles}),counts=[]
 for(let i=0;i<5;i++){const r=afterShot(push,{shooter:'a',nextTurn:'b',turnChanged:true,balls:[],bounds:BOUNDS,rand:()=>.99});push=r.push;counts.push(r.spews.reduce((n,x)=>n+x.count,0))}
 assert.deepEqual(counts,[4,3,2,0,0],'one more than it has left each turn, then it is only a barrier');assert.equal(push.obstacles.length,0,'and it is gone after its four turns')
})

test('scatterAround puts dummies in a ring around a point, clear of balls and on the cloth',()=>{
 const out=scatterAround([{n:0,k:'cue',on:true,x:300,y:190}],6,300,190,seeded(4))
 assert.equal(out.length,6);for(const d of out){assert.ok(Math.hypot(d.x-300,d.y-190)>=18);assert.ok(d.x>=40&&d.x<=660&&d.y>=40&&d.y<=340);assert.equal(d.k,'dummy')}
 assert.equal(new Set(out.map(d=>d.n)).size,6)
})

test('a barf is dealt as an instruction, not an object',()=>{
 const b=makeHazard(spawnOf('barf',{ttl:1}),[],BOUNDS,seeded(1));assert.equal(b.barf,true);assert.equal(b.obstacles.length,0)
})

test('the cluster and the piggy bank are tossable, and piggy state is validated',()=>{
 assert.ok(EFFECTS.cluster&&EFFECTS.piggybank)
 assert.ok(validPush({...withPush(),obstacles:[{t:'bumper',x:1,y:1,r:11,piggy:30,ttl:5}]}))
 assert.equal(validPush({...withPush(),obstacles:[{t:'bumper',x:1,y:1,r:11,piggy:1000,ttl:5}]}),false)
})

// ---- rutabaga, dummy ids and feats ----
import {nextRutabagaId,makeRutabaga,isRutabaga,RUTABAGA_BASE} from '../src/push/dummy.js'
import {shotFeats,FEATS} from '../src/push/logic.js'

test('dummy ids reuse the smallest free number, stay below the rutabaga range, and rutabagas have their own',()=>{
 const balls=[makeDummy(100,1,1),makeDummy(102,2,2)]
 assert.equal(nextDummyId(balls),101,'a gap is filled first')
 const full=Array.from({length:RUTABAGA_BASE-100},(_,i)=>makeDummy(100+i,1,1));assert.ok(nextDummyId(full)<RUTABAGA_BASE,'never strays into the rutabaga ids')
 assert.equal(nextRutabagaId([]),RUTABAGA_BASE);const r=makeRutabaga([],10,10);assert.ok(isRutabaga(r));assert.equal(r.k,'dummy');assert.ok(!isRutabaga(makeDummy(100,1,1)))
 assert.equal(nextRutabagaId([r]),RUTABAGA_BASE+1)
 assert.ok(isGameMessage(snap([r])),'a rutabaga is an ordinary dummy on the wire')
})

test('feats: a double earns an item, a triple points, five contacts points; a foul earns nothing',()=>{
 assert.deepEqual(shotFeats({real:1,contacts:1,foul:false}),[])
 const d=shotFeats({real:2,contacts:2,foul:false},seeded(1));assert.equal(d.length,1);assert.equal(d[0].id,'double');assert.ok(ITEMS[d[0].item])
 const t=shotFeats({real:3,contacts:2,foul:false},seeded(1));assert.deepEqual(t.map(f=>f.id),['double','triple']);assert.ok(t[1].points>0)
 assert.deepEqual(shotFeats({real:0,contacts:5,foul:false}).map(f=>f.id),['crowd'])
 assert.deepEqual(shotFeats({real:3,contacts:6,foul:true}),[])
 assert.ok(FEATS.every(f=>f.text))
})

// ---- the practice opponent's use of powers and items ----
import {planUses,thickestCluster} from '../src/push/ai.js'
const ball=(n,x,y)=>({n,k:'solid',on:true,x,y})

test('the AI picks the thickest cluster it can reach, and ignores dummies, the cue ball and what is out of range',()=>{
 const cue=cueAt(100,190)
 const balls=[cue,ball(1,300,190),ball(2,320,200),ball(3,310,215),ball(4,320,230),ball(5,250,60),makeDummy(100,300,195),ball(6,900,190)]
 const c=thickestCluster(balls,cue);assert.ok(c.count>=4);assert.ok(Math.hypot(c.target.x-310,c.target.y-210)<40)
 assert.equal(thickestCluster([cue,ball(1,900,190)],cue),null,'nothing within a toss')
 assert.equal(thickestCluster([cue,makeDummy(100,200,190)],cue),null)
})

test('the AI throws a mortar or bomb at a cluster, lights powder, arms pop when it can afford it, and does nothing empty-handed',()=>{
 const cue=cueAt(100,190),balls=[cue,ball(1,300,190),ball(2,320,200),ball(3,310,215)]
 const rich=withPush({b:{powers:{pop:1,cute:1},items:['mortar','poppowder'],picks:0}})
 const acts=planUses(rich,{a:0,b:200},'b',balls,()=>0)
 assert.equal(acts[0].kind,'toss');assert.equal(acts[0].item,'mortar');assert.equal(acts.length,1,'a toss ends the plan: it settles first')
 const noBombs=withPush({b:{powers:{pop:1,cute:1},items:['poppowder'],picks:0}})
 const a2=planUses(noBombs,{a:0,b:200},'b',balls,()=>0);assert.deepEqual(a2.map(x=>x.kind+':'+(x.id||'')),['use:poppowder','arm:pop','arm:cute'])
 assert.deepEqual(planUses(noBombs,{a:0,b:30},'b',balls,()=>0).filter(x=>x.kind==='arm'),[],'too poor to arm')
 assert.deepEqual(planUses(withPush(),{a:0,b:200},'b',balls,()=>0),[])
 assert.deepEqual(planUses(rich,{a:0,b:200},'b',balls,()=>.99),[],'and only sometimes')
 assert.deepEqual(planUses(rich,{a:0,b:200},'b',[{...cue,on:false},...balls.slice(1)],()=>0),[])
})

// ---- P.U.S.H. 8-ball ----
import {judgePush8,judgeShot,PUSH_GIFT,isPush} from '../src/rules.js'
import {legalTargets} from '../src/ai.js'

const eight=(o)=>({mode:'push8',turn:'a',score:{a:0,b:0},groups:{a:null,b:null},potted:[],firstHit:{k:'solid',n:3},scratch:false,breakShot:false,balls:rack('8ball'),before:7,...o})
const solid=n=>({n,k:'solid',on:false}),stripe=n=>({n,k:'stripe',on:false})

test('push8 is a push mode, plays 8-ball rules, and shares the state and wire format',()=>{
 assert.ok(isPush('push')&&isPush('push8')&&!isPush('8ball'));assert.ok(MODES.push8);assert.equal(isScoreMode('push8'),false)
 assert.ok(freshRackState('push8').push);assert.equal(targetFor('push8'),PUSH_TARGET)
 const snap8=snapshotOf({...freshRackState('push8'),balls:[...rack('push8'),makeDummy(100,50,50)],round:1});assert.ok(isGameMessage(snap8),'dummies are allowed in push8')
})

test('push8 points: own balls are ten and a level-up, the opponent gets a gift, dummies a point, a foul costs five',()=>{
 const own=eight({groups:{a:'solid',b:'stripe'},potted:[solid(1),solid(2),stripe(9)]})
 const v=judgeShot(own),e=judgePush8(own,v)
 assert.equal(e.score.a,2*PUSH_POT);assert.equal(e.score.b,PUSH_GIFT);assert.equal(e.levelUps,2);assert.equal(e.winner,null)
 const open=eight({potted:[solid(1)]}),vo=judgeShot(open)
 assert.equal(vo.assign,'solid');const eo=judgePush8(open,vo);assert.equal(eo.score.a,PUSH_POT,'the ball that decides the group counts as yours');assert.equal(eo.levelUps,1)
 const dum=eight({groups:{a:'solid',b:'stripe'},potted:[makeDummy(100,0,0)]}),ed=judgePush8(dum,judgeShot(dum));assert.equal(ed.score.a,1);assert.equal(ed.levelUps,0)
 const foul=eight({groups:{a:'solid',b:'stripe'},score:{a:12,b:0},potted:[solid(1)],scratch:true}),vf=judgeShot(foul)
 assert.equal(vf.foul,true);const ef=judgePush8(foul,vf);assert.equal(ef.score.a,12-PUSH_FOUL);assert.equal(ef.levelUps,0)
})

test('push8 ends by 8-ball rules or by reaching the points target',()=>{
 const won=eight({groups:{a:'solid',b:'stripe'},potted:[{n:8,k:'eight',on:false}],before:0,calledPocket:2,eightPocket:2}),vw=judgeShot(won)
 assert.equal(judgePush8(won,vw).winner,'a','a legal 8 wins')
 const far=eight({groups:{a:'solid',b:'stripe'},score:{a:PUSH_TARGET-5,b:0},potted:[solid(1)]});assert.equal(judgePush8(far,judgeShot(far)).winner,'a','the target wins too')
 const early=eight({groups:{a:'solid',b:'stripe'},potted:[{n:8,k:'eight',on:false}],before:3}),ve=judgeShot(early);assert.equal(judgePush8(early,ve).winner,'b','the 8 too soon loses, as ever')
})

test('a dummy ball is never a wrong first hit under 8-ball rules, and never an AI target',()=>{
 const g={groups:{a:'solid',b:'stripe'},firstHit:makeDummy(100,0,0),potted:[],scratch:false,turn:'a',mode:'push8',breakShot:false,before:7}
 assert.equal(judgeShot(g).foul,false,'touching only a dummy is contact, and not the wrong group')
 assert.equal(judgeShot({...g,firstHit:{k:'stripe',n:9}}).reason,'wrong-first')
 const balls=[cueAt(100,100),ball(1,200,100),makeDummy(100,300,100)]
 assert.deepEqual(legalTargets(balls,null,'push8').map(b=>b.n),[1])
})

// ---- mass: heavy and light balls ----
import {massOf,makeLight,makeHeavy,HEAVY_MASS,LIGHT_MASS,LIGHT_BASE,HEAVY_BASE} from '../src/push/dummy.js'
import {ballCollide} from '../src/physics.js'
import {CANNON_MASS} from '../src/push/powers.js'

test('masses come from the dummy id ranges, and an explicit mass wins',()=>{
 assert.equal(massOf({k:'solid',n:3}),1);assert.equal(massOf({k:'cue',n:0}),1);assert.equal(massOf(makeDummy(100,0,0)),1)
 assert.equal(massOf(makeLight([],0,0)),LIGHT_MASS);assert.equal(massOf(makeHeavy([],0,0)),HEAVY_MASS);assert.equal(massOf(makeRutabaga([],0,0)),1)
 assert.equal(massOf({k:'cue',n:0,m:CANNON_MASS}),CANNON_MASS)
 const lights=[];for(let i=0;i<10;i++)lights.push(makeLight(lights,i,0));assert.equal(new Set(lights.map(b=>b.n)).size,10);assert.ok(lights.every(b=>b.n>=LIGHT_BASE&&b.n<HEAVY_BASE))
 assert.ok(isGameMessage(snap([makeHeavy([],50,50),makeLight([],80,80)])),'still ordinary dummies on the wire')
})

const two=(a,b)=>{const x={x:100,y:100,vx:300,vy:0,wx:0,wy:0,wz:0,z:0,...a},y={x:117,y:100,vx:0,vy:0,wx:0,wy:0,wz:0,z:0,...b};ballCollide(x,y);return [x,y]}
test('collisions: two ordinary balls behave exactly as before; a heavy ball barely moves and a light one flies',()=>{
 const [a,b]=two({k:'solid',n:1},{k:'solid',n:2});assert.ok(Math.abs(a.vx+b.vx-300)<1e-6,'momentum is conserved');assert.ok(b.vx>a.vx)
 const [c,heavy]=two({k:'solid',n:1},makeHeavy([],117,100));assert.ok(heavy.vx<b.vx*.6,'a heavy ball takes far less speed');assert.ok(c.vx<0,'and the cue ball rebounds off it')
 const [d,light]=two({k:'solid',n:1},makeLight([],117,100));assert.ok(light.vx>b.vx*1.2,'a light ball is thrown harder');assert.ok(d.vx>a.vx)
 const [heavyHitter,ordinary]=two({...makeHeavy([],100,100),vx:300},{k:'solid',n:2});assert.ok(ordinary.vx>b.vx,'what a heavy ball hits is sent flying');assert.ok(heavyHitter.vx>150,'and it plows on')
 for(const [x,y] of [two({k:'solid',n:1},makeHeavy([],117,100)),two({...makeLight([],100,100),vx:300},{k:'solid',n:2})])assert.ok(Math.abs(x.vx*massOf(x)+y.vx*massOf(y)-300*massOf(x))<1e-6,'momentum along the line is conserved')
})

test('oneShot: a legal pot scores and owes a level-up but the turn passes to the opponent',()=>{
 const v=judgeScoreGame(shot({potted:[real(3)],oneShot:true}))
 assert.equal(v.score.a,PUSH_POT);assert.equal(v.levelUps,1);assert.equal(v.nextTurn,'b')
 assert.equal(judgeScoreGame(shot({potted:[real(3)],oneShot:false})).nextTurn,'a','without the rule the shooter keeps the turn')
 const eightShot=eight({groups:{a:'solid',b:'stripe'},potted:[solid(1)]});assert.equal(judgeShot(eightShot).nextTurn,'a')
})

// ---- the in-game help ----
import {helpSections} from '../src/push/help.js'
import {POWER_IDS as ALL_POWERS} from '../src/push/powers.js'
import {DROPPABLE} from '../src/push/items.js'

test('the help lists every power, every droppable item and every live spawn, with the real numbers',()=>{
 const sections=helpSections(),by=t=>sections.find(s=>s.title===t)
 assert.equal(by('Powers').rows.length,ALL_POWERS.length);assert.equal(by('Items').rows.length,DROPPABLE.length)
 assert.ok(by('Items').rows.some(r=>r.name==='Roller'),'every item in the catalogue is built and listed')
 assert.ok(by('What shows up on the table').rows.every(r=>r.text.length>10),'every spawn is explained')
 assert.match(by('The idea').lines[0],new RegExp('first to '+PUSH_TARGET,'i'))
 assert.ok(by('Powers').rows.every(r=>/levels cost \d+ \/ \d+ \/ \d+/.test(r.detail)),'costs come from the catalogue')
 assert.ok(by('Items').rows.every(r=>r.detail),'every item says how it is used')
})

test('a batch of dummies never reuses an id that is already on the table, even around gaps',()=>{
 const taken=[makeDummy(101,1,1),makeDummy(103,2,2),makeLight([],3,3),{...makeLight([],4,4),n:175}]
 const rings=scatterAround(taken,6,300,190,seeded(2));const ids=[...taken,...rings].map(b=>b.n)
 assert.equal(new Set(ids).size,ids.length,'ordinary dummies: all ids distinct');assert.ok(rings.every(b=>b.n>=100&&b.n<150))
 const lights=scatterAround(taken,5,300,190,seeded(3),'light');const ids2=[...taken,...lights].map(b=>b.n)
 assert.equal(new Set(ids2).size,ids2.length,'light dummies: all ids distinct');assert.ok(lights.every(b=>b.n>=170&&b.n<180))
 const rain=scatterDummies(taken,8,{minx:40,maxx:660,miny:40,maxy:340},seeded(4));const ids3=[...taken,...rain].map(b=>b.n)
 assert.equal(new Set(ids3).size,ids3.length,'a hurricane too')
 const full=Array.from({length:70},(_,i)=>makeDummy(100+i,1,1));assert.equal(scatterAround(full,4,300,190,seeded(1)).length,0,'no free id, none made')
})

// ---- roller ----
import {makeRoller,isRoller,ROLLER_MASS,ROLLER_BASE} from '../src/push/dummy.js'
import {UNBUILT_ITEMS} from '../src/push/items.js'

test('a roller is a dummy with its own id range and mass, placed with an axis, and every item in the catalogue now works',()=>{
 const r=makeRoller([],10,10);assert.ok(isRoller(r)&&r.k==='dummy'&&r.n>=ROLLER_BASE&&r.n<160);assert.equal(massOf(r),ROLLER_MASS);assert.ok(!isRoller(makeDummy(100,1,1)))
 assert.equal(makeRoller([r],20,20).n,r.n+1);assert.deepEqual(UNBUILT_ITEMS,[])
 const put=placeItem(holding('roller'),'a','roller',{x:250,y:150,rot:1.234},ctx())
 assert.deepEqual(put.drops,[{x:250,y:150,kind:'roller',rot:1.23}]);assert.equal((put.obstacles||[]).length,0)
 assert.ok(validPush({...withPush(),rollers:[{n:150,rot:.5}]}));assert.equal(validPush({...withPush(),rollers:[{n:20,rot:.5}]}),false);assert.equal(validPush({...withPush(),rollers:[{n:150,rot:'x'}]}),false)
 assert.ok(isGameMessage(snap([r])),'a roller is an ordinary dummy on the wire')
})

test('a full id range makes no ball rather than a duplicate, and a placement is refused up front',()=>{
 const lights=[];for(let i=0;i<10;i++)lights.push(makeLight(lights,i,0));assert.equal(makeLight(lights,0,0),null,'ten lights is all there is')
 const rollers=[];for(let i=0;i<10;i++)rollers.push(makeRoller(rollers,i,0));assert.equal(makeRoller(rollers,0,0),null)
 const rut=[];for(let i=0;i<10;i++)rut.push(makeRutabaga(rut,i,0));assert.equal(makeRutabaga(rut,0,0),null)
 const full=Array.from({length:50},(_,i)=>makeDummy(100+i,1,1));assert.equal(nextDummyId(full),null);assert.equal(nextDummyId(full.slice(1)),100)
 const c=ctx(lights),h=holding('pingpong','cannonball')
 assert.equal(whyNotPlace(h,'a','pingpong',{x:250,y:150},c),'no-room','the light balls are all on the table');assert.equal(whyNotPlace(h,'a','cannonball',{x:250,y:150},c),null,'but heavy ones are not')
})

test('a black hole always wins in the end: a ball thrown around it settles, and speed near the centre no longer lets it escape',()=>{
 const hole={t:'blackhole',x:200,y:200,r:HOLE_R,held:[],ttl:5},b=rolling(320,210,-200,150)
 let swallowed=false
 for(let i=0;i<120*40&&!swallowed;i++){
  const sw=stepHazards([b],[hole],1/120);if(sw.length)swallowed=true
  else{b.x+=b.vx/120;b.y+=b.vy/120;const sp=Math.hypot(b.vx,b.vy),k=Math.max(0,1-.6/120);b.vx*=k;b.vy*=k;void sp}
 }
 assert.ok(swallowed,'caught within forty seconds')
})
