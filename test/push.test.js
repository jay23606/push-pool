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

test('push is a scored game with a hundred-point target',()=>{
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

test('dummy balls do not count towards the rack running out, and a hundred wins',()=>{
 const onlyDummies=[{n:0,k:'cue',on:true},makeDummy(100,1,1),makeDummy(101,2,2)]
 assert.equal(judgeScoreGame(shot({balls:onlyDummies})).rerack,true,'no real balls left: re-rack')
 assert.equal(judgeScoreGame(shot({score:{a:95,b:0},potted:[real(3)]})).winner,'a')
 assert.equal(judgeScoreGame(shot({score:{a:80,b:0},potted:[real(3)]})).winner,null)
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
 assert.deepEqual(PLACEABLE,['wall','cube','pillar','landmine']);assert.deepEqual(shapeOf('bomb',1,1),[])
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
 const push=withPush({a:{powers:{pop:1,cute:2,guide:1},items:[],picks:0}})
 const r=payArmed(push,{a:100,b:0},'a',{pop:1,cute:2,guide:1,stink:1})
 assert.deepEqual(Object.keys(r.applied).sort(),['cute','pop'],'guide is not armable, stink is not owned')
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
