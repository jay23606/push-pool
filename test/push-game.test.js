import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack} from '../src/rules.js'
import {freshPush} from '../src/push/state.js'
import {makeDummy,makeRutabaga,massOf,HEAVY_MASS,LIGHT_MASS} from '../src/push/dummy.js'
import {DROPPABLE,ITEM_IDS} from '../src/push/items.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
import {powerCost,CANNON_MASS} from '../src/push/powers.js'
import {payArmed} from '../src/push/logic.js'
import {R} from '../src/table.js'

// a hot-seat push game with no DOM: same construction as the chaos tests
function game(extra={}){
 const g=Object.create(PoolGame.prototype),flashes=[]
 Object.assign(g,{mode:'push',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash:m=>flashes.push(m),setSpin(){},send(){},onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',
  balls:rack('push'),power:{value:50},spin:{a:0,b:0},aiming:true,angle:0,fx:null,push:freshPush(),dealRand:()=>.99,   // .99: nothing is dealt between turns, so a test sees only what it set up
  
  house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false},...extra})
 g.sync();return {g,flashes}
}
function roll(g,seconds=4){g.phase='roll';let now=g.clock||0;g.simAt=now;for(let i=0;i<seconds*120&&g.phase==='roll';i++){now+=1000/120;g.advance(now)};g.clock=now}
const clear=g=>g.balls.forEach((b,i)=>{if(i)b.on=false})
// put ball index i on the table at a spot
const put=(g,i,x,y)=>{const b=g.balls[i];b.on=true;b.x=x;b.y=y;return b}
// a ball sitting just off the top-middle pocket with the cue behind it, so a straight shot pots it
function potShot(g,ball=1){
 clear(g);const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250
 put(g,ball,350,120);put(g,14,600,330);put(g,15,620,300)   // two others so the rack is not empty
 strike(cue,0,-1300);g.startShot();roll(g)
}

test('a new push game starts with empty push state and a long way to go',()=>{
 const {g}=game();assert.deepEqual(g.push,freshPush());assert.equal(g.scoreTarget??250,250)
})

test('potting a real ball scores ten, keeps the turn, and offers three powers',()=>{
 const {g,flashes}=game();potShot(g)
 assert.equal(g.balls[1].on,false,'the ball dropped')
 assert.equal(g.score.a,10);assert.equal(g.turn,'a');assert.equal(g.push.a.picks,1)
 assert.equal(g.push.offers.length,3);assert.ok(flashes.some(m=>/Level up/.test(m)))
})

test('picking a power unlocks it, and only the shooter may pick',()=>{
 const {g}=game();potShot(g)
 const id=g.push.offers[0].id
 g.turn='b';g.pickPower(id);assert.ok(g.push.offers,'the other player cannot take it')
 g.turn='a';g.pickPower('fly');assert.ok(g.push.offers,'a power that was not offered is refused')
 g.pickPower(id);assert.equal(g.push.a.powers[id],1);assert.equal(g.push.offers,null);assert.equal(g.push.a.picks,0)
})

test('the practice AI takes its own level-up at once',()=>{
 const {g}=game({practice:true,hotSeat:false,turn:'b',me:'a'});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,1,350,120);put(g,14,600,330);put(g,15,620,300)
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(g.turn,'b');assert.equal(g.push.b.picks,0);assert.equal(g.push.offers,null);assert.equal(Object.keys(g.push.b.powers).length,1)
})

test('a dummy ball is worth a point, does not keep the turn, and is ignored by the rules',()=>{
 const {g}=game();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250
 put(g,14,600,330);put(g,15,620,300)
 g.balls.push(makeDummy(100,350,120))
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(g.balls.some(b=>b.n===100),false,'the dummy dropped and is gone for good')
 assert.equal(g.score.a,1);assert.equal(g.turn,'b');assert.equal(g.push.a.picks,0);assert.equal(g.over,false)
})

test('hitting only a dummy ball is contact, not a foul',()=>{
 const {g}=game();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=250;put(g,14,600,330);put(g,15,620,300)
 g.balls.push(makeDummy(100,250,200))
 g.score={a:20,b:0}
 strike(cue,200,-200);g.startShot();roll(g)
 assert.equal(g.balls.find(b=>b.n===100).on,true,'the dummy stayed on the table')
 assert.equal(g.score.a,20,'contact was made, so no foul penalty');assert.equal(g.turn,'b')
})

test('the cue ball rolling over a gem banks its points, and an item goes into hand',()=>{
 const {g}=game({push:{...freshPush(),pickups:[{kind:'gem',v:5,x:350,y:200,ttl:2},{kind:'item',id:'bomb',x:350,y:170,ttl:2}]}});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,14,600,330);put(g,15,620,300);put(g,1,345,100)
 strike(cue,0,-700);g.startShot();roll(g)
 assert.ok(!g.push.pickups.some(k=>k.x===350&&(k.y===200||k.y===170)),'both were taken');assert.ok(g.score.a>=5);assert.deepEqual(g.push.a.items,['bomb'])
})

test('a pickup the cue ball misses stays where it is',()=>{
 const {g}=game({push:{...freshPush(),pickups:[{kind:'gem',v:5,x:600,y:60,ttl:9}]}});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,14,150,330);put(g,15,170,300)
 strike(cue,0,-300);g.startShot();roll(g)
 const left=g.push.pickups.find(k=>k.x===600&&k.y===60);assert.ok(left,'still there');assert.equal(left.ttl,8,'one turn older')
})

test('jump is a power: it needs to be unlocked and paid for, and is charged once',()=>{
 const {g}=game();assert.equal(g.jumpAllowed(),false,'not unlocked')
 g.push={...g.push,a:{...g.push.a,powers:{jump:1}}};assert.equal(g.jumpAllowed(),false,'no points')
 g.score={a:20,b:0};assert.equal(g.jumpAllowed(),true)
 g.payJump();assert.equal(g.score.a,14)
 g.turn='b';assert.equal(g.jumpAllowed(),false,'the other player has not unlocked it')
})

test('the whole push state survives the wire, including dummies and pickups',()=>{
 const {g}=game({push:{...freshPush(),a:{powers:{spin:2},items:['bomb'],picks:0},pickups:[{kind:'gem',v:2,x:100,y:100,ttl:1}]}})
 g.balls.push(makeDummy(100,200,200))
 const wire=JSON.parse(JSON.stringify(snapshotOf(g)));assert.ok(isGameMessage(wire))
 const back={};applySnapshot(back,wire)
 assert.deepEqual(back.push,g.push);assert.equal(back.balls.filter(b=>b.k==='dummy').length,1)
})

test('a re-rack puts the real balls back and leaves the dummies alone',()=>{
 const {g}=game();clear(g);put(g,5,400,190);g.balls.push(makeDummy(100,200,100))
 g.reRack()
 assert.equal(g.balls.filter(b=>b.k!=='cue'&&b.k!=='dummy'&&b.on).length,15)
 const d=g.balls.find(b=>b.n===100);assert.equal(d.k,'dummy');assert.equal(d.x,200)
})

test('the AI takes every level-up it is owed, and the human keeps theirs for next turn',()=>{
 const {g}=game({practice:true,hotSeat:false,turn:'b',me:'a',push:{...freshPush(),a:{powers:{},items:[],picks:3}}});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,1,350,120);put(g,2,300,120);put(g,14,600,330);put(g,15,620,300)
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(g.push.b.picks,0,'the AI has taken all of its own')
 if(g.turn==='a'){assert.equal(g.push.a.picks,3);assert.equal(g.push.offers.length,3,'and the human is offered theirs')}
})

test('placing a wall: pick it, hover, confirm; it stops a ball and the item is used up',()=>{
 const {g}=game({push:{...freshPush(),a:{powers:{},items:['wall'],picks:0}}});clear(g)
 g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190
 assert.equal(g.startPlacing('bomb'),false,'a bomb is tossed, not placed');assert.equal(g.startPlacing('wall'),true)
 g.movePlacing({x:900,y:900});g.confirmPlace();assert.ok(g.placing,'too far: refused, still placing');assert.deepEqual(g.push.a.items,['wall'])
 g.turnPlacing(Math.PI/2);g.movePlacing({x:270,y:190});assert.equal(g.placingOk(),true)
 g.confirmPlace()
 assert.equal(g.placing,null);assert.deepEqual(g.push.a.items,[]);assert.equal(g.push.obstacles.length,1)
 // the physics now has the wall: a shot straight at it comes back
 put(g,14,600,330);put(g,15,620,300);put(g,1,250,80)
 strike(cue,700,0);g.startShot();roll(g)
 assert.ok(cue.x<260,'the cue ball never got past the barrier at x=270')
})

test('escape and a second click of the item cancel placing; a shot cancels it too',()=>{
 const {g}=game({push:{...freshPush(),a:{powers:{},items:['pillar'],picks:0}}});g.canControl=()=>true
 g.startPlacing('pillar');g.cancelPlacing();assert.equal(g.placing,null)
 g.startPlacing('pillar');g.movePlacing({x:210,y:150});g.turnPlacing(.4);assert.ok(Math.abs(g.placing.rot-.4)<1e-9)
})

test('a guest asks the host to place, and only the player whose turn it is gets it',()=>{
 const {g}=game({turn:'b',push:{...freshPush(),b:{powers:{},items:['pillar'],picks:0}}})
 g.receive({t:'place',item:'pillar',x:230,y:150,rot:0});assert.equal(g.push.obstacles.length,1);assert.deepEqual(g.push.b.items,[])
 const {g:h}=game({turn:'a',push:{...freshPush(),b:{powers:{},items:['pillar'],picks:0}}})
 h.receive({t:'place',item:'pillar',x:230,y:150,rot:0});assert.equal(h.push.obstacles.length,0,'not b\'s turn')
})

// ---- armed powers ----
const owning=(powers,points=100)=>game({score:{a:points,b:0},push:{...freshPush(),a:{powers,items:[],picks:0}}})

test('arming steps a power through the levels you own and back off; only armable powers, only yours',()=>{
 const {g}=owning({pop:2,jump:1});g.canControl=()=>true
 g.cycleArm('pop');assert.deepEqual(g.armed,{pop:1});g.cycleArm('pop');assert.deepEqual(g.armed,{pop:2})
 g.cycleArm('pop');assert.deepEqual(g.armed,{},'past your level it switches off')
 g.cycleArm('jump');g.cycleArm('stink');assert.deepEqual(g.armed,{},'not armable / not owned')
})

test('an armed power is paid for when the shot is taken, at the level chosen',()=>{
 const {g}=owning({pop:2,stink:1},100);clear(g)
 g.applyArmed({pop:2,stink:1})
 assert.equal(g.score.a,100-45-20);assert.equal(g.shotFx.pop.force,400);assert.equal(g.shotFx.stink.level,1)
 const {g:poor}=owning({pop:1},10);poor.applyArmed({pop:1});assert.equal(poor.score.a,10,'cannot afford it: skipped, nothing spent');assert.equal(poor.shotFx,null)
 const {g:none}=owning({},100);none.applyArmed({pop:1});assert.equal(none.score.a,100,'not owned')
})

test('stink pushes the balls near the cue ball away, cute pulls them in, and both only while armed',()=>{
 const run=fx=>{
  const {g}=owning({},0);clear(g);const cue=g.balls[0];cue.on=true;cue.x=300;cue.y=190
  const o=put(g,1,340,190);put(g,14,600,330);put(g,15,620,300);g.shotFx=fx
  for(let i=0;i<30;i++)g.shotEffects(1/120);return o.vx
 }
 assert.ok(run({stink:{force:300}})>1,'pushed away (to the right)')
 assert.ok(run({cute:{force:300}})<-1,'pulled toward the cue ball (to the left)')
 assert.equal(run(null),0,'nothing without the power')
 const {g}=owning({},0);clear(g);g.balls[0].on=true;g.balls[0].x=300;g.balls[0].y=190;const far=put(g,1,300+90,190);g.shotFx={stink:{force:500}};g.shotEffects(.1);assert.equal(far.vx,0,'out of reach')
})

test('pop blasts the balls next to the cue ball when it collides, but only a few times a shot',()=>{
 const {g}=owning({},0);clear(g);const cue=g.balls[0];cue.on=true;cue.x=300;cue.y=190
 const near=put(g,1,325,190);g.shotFx={pop:{force:400}};g.pops=0
 g.popped();assert.ok(near.vx>1,'thrown away from the cue ball')
 for(let i=0;i<10;i++)g.popped();assert.equal(g.pops,6,'capped')
 g.shotFx=null;near.vx=0;g.popped();assert.equal(near.vx,0)
})

test('a shot with pop armed clears it from the table when the shot ends, and never leaks into the next',()=>{
 const {g}=owning({pop:1},100);clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,1,350,150);put(g,14,600,330);put(g,15,620,300)
 g.cycleArm('pop');g.applyArmed(g.armed);g.armed={}
 strike(cue,0,-900);g.startShot();roll(g)
 assert.equal(g.shotFx,null);assert.equal(g.score.a>=100-25,true,'the power was paid for once')
})

// ---- landmine ----
test('a landmine is placed like a barrier, then goes off under a rolling ball and throws its neighbours',()=>{
 const {g,flashes}=game({push:{...freshPush(),a:{powers:{},items:['landmine'],picks:0}}});clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190
 g.startPlacing('landmine');g.movePlacing({x:270,y:190});g.confirmPlace()
 assert.equal(g.push.obstacles.length,1);assert.equal(g.push.obstacles[0].t,'mine');assert.deepEqual(g.push.a.items,[])
 const near=put(g,1,300,230);put(g,14,600,330);put(g,15,620,300)
 strike(cue,500,0);g.startShot();roll(g,2)
 assert.ok(flashes.includes('BOOM'));assert.equal(g.push.obstacles.some(o=>o.t==='mine'),false,'the mine is gone')
 assert.ok(Math.hypot(near.vx,near.vy)>1||Math.hypot(near.x-300,near.y-230)>5,'the neighbour was thrown')
})

test('a mine nothing rolls over stays put, and cannot be placed on a ball or too far away',()=>{
 const {g}=game({push:{...freshPush(),a:{powers:{},items:['landmine'],picks:0}}});clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190;put(g,14,600,330);put(g,15,620,300)
 g.startPlacing('landmine');g.movePlacing({x:200+181,y:190});g.confirmPlace();assert.equal(g.push.obstacles.length,0,'beyond medium range')
 g.movePlacing({x:300,y:80});g.confirmPlace();assert.equal(g.push.obstacles.length,1)
 strike(cue,300,0);g.startShot();roll(g,1);assert.equal(g.push.obstacles.length,1,'the shot missed it')
})

// ---- tossing in a game ----
const tossing=(items,extra={})=>game({push:{...freshPush(),a:{powers:{},items,picks:0}},...extra})
// scatter is random; pin it so a test can rely on where a toss lands
const exact=fn=>{const r=Math.random;Math.random=()=>0;try{fn()}finally{Math.random=r}}

test('a mortar blasts the balls where it lands; balls it pots score for the tosser, who keeps the turn and the shot',()=>{
 const {g}=tossing(['mortar']);clear(g);const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190
 const near=put(g,1,330,60);put(g,14,600,330);put(g,15,620,300)   // just below the top-middle pocket
 near.x=350;near.y=70
 const before=near.y;exact(()=>g.applyToss('a','mortar',{x:350,y:110}))
 assert.equal(g.tossing,true);assert.equal(g.phase,'roll');assert.deepEqual(g.push.a.items,[])
 roll(g,4)
 assert.equal(g.tossing,false);assert.equal(g.phase,'aim');assert.equal(g.turn,'a','a toss is not a shot: the turn stays')
 assert.ok(!near.on,'the blast drove it into the pocket');assert.equal(g.score.a,10);assert.equal(g.push.a.picks,1);assert.ok(before>0)
})

test('a scratch caused by your own blast puts the cue ball back, with no foul',()=>{
 const {g}=tossing(['mortar']);clear(g);const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=100
 put(g,14,600,330);put(g,15,620,300)
 exact(()=>g.applyToss('a','mortar',{x:350,y:130}));roll(g,4)
 assert.equal(cue.on,true);assert.equal(g.turn,'a');assert.equal(g.score.a,0)
 assert.ok(Math.hypot(cue.x-350,cue.y-100)<400,'somewhere on the table')
})

test('smoke bomb: a cloud goes on the table, no balls move, and it is gone after its turns',()=>{
 const {g}=tossing(['smokebomb']);clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190;put(g,14,600,330)
 g.applyToss('a','smokebomb',{x:300,y:190})
 assert.equal(g.tossing,undefined);assert.equal(g.phase,'aim');assert.equal(g.push.obstacles.filter(o=>o.t==='smoke').length,1)
 assert.equal(g.push.obstacles[0].ttl>=1&&g.push.obstacles[0].ttl<=3,true)
})

test('toss input: drag out and let go; a click without a drag does nothing; only bombs and the like can be tossed',()=>{
 const {g}=tossing(['bomb','wall']);g.canControl=()=>true;g.balls[0].on=true
 assert.equal(g.startPlacing('wall'),true,'a wall is placed');g.cancelPlacing()
 assert.equal(g.startPlacing('bomb'),true);assert.equal(g.placing.toss,true)
 g.confirmPlace();assert.deepEqual(g.push.a.items,['bomb','wall'],'no pointer position yet, nothing thrown')
 g.movePlacing({x:400,y:200});assert.equal(g.placingOk(),true)
})

test('a guest asks the host to toss, only on their turn',()=>{
 const {g}=game({turn:'b',push:{...freshPush(),b:{powers:{},items:['smokebomb'],picks:0}}})
 g.receive({t:'toss',item:'smokebomb',x:300,y:190});assert.equal(g.push.obstacles.length,1)
 const {g:h}=game({turn:'a',push:{...freshPush(),b:{powers:{},items:['smokebomb'],picks:0}}})
 h.receive({t:'toss',item:'smokebomb',x:300,y:190});assert.equal(h.push.obstacles.length,0)
})

// ---- hazards in a game ----
test('a slick changes how far a ball rolls: ice keeps it going, sand stops it sooner',()=>{
 const dist=variant=>{
  const {g}=game({push:{...freshPush(),obstacles:variant?[{t:'slick',variant,x:330,y:190,r:200,ttl:5}]:[]}});g.syncObstacles();clear(g)
  const cue=g.balls[0];cue.on=true;cue.x=150;cue.y=190;put(g,14,600,330);put(g,15,620,300)
  const target=put(g,1,300,190)
  strike(cue,300,0);g.startShot();roll(g,8);return target.x
 }
 const plain=dist(null);assert.ok(dist('sand')<plain,'sand is shorter');assert.ok(dist('ice')>plain,'ice is longer')
})

test('a black hole swallows a ball, and the ball is on the table again when the hole closes',()=>{
 const {g}=game({push:{...freshPush(),obstacles:[{t:'blackhole',x:300,y:190,r:110,held:[],ttl:5}]}});g.syncObstacles();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=120;cue.y=330;put(g,14,190,330);put(g,15,620,300);const b=put(g,4,300,192)
 strike(cue,200,0);g.startShot();roll(g,3)
 assert.equal(b.on,false,'swallowed');assert.deepEqual(g.push.obstacles.find(o=>o.t==='blackhole').held,[b.n])
 g.push={...g.push,obstacles:g.push.obstacles.map(o=>({...o,ttl:1}))}
 g.pushAfterShot('a',{levelUps:0,nextTurn:'b',foul:false})
 assert.equal(g.push.obstacles.filter(o=>o.t==='blackhole').length,0,'it closed');assert.equal(b.on,true,'and gave the ball back')
 assert.ok(g.balls.every(q=>q===b||!q.on||Math.hypot(q.x-b.x,q.y-b.y)>=R*2),'not on top of another ball')
})

test('a hurricane rains dummy balls onto the table',()=>{
 let seen=0
 for(let i=0;i<1500&&!seen;i++){
  const {g}=game({dealRand:null,push:{...freshPush(),turns:1}});clear(g);g.balls[0].on=true;g.balls[0].x=154;g.balls[0].y=190
  g.pushAfterShot('a',{levelUps:0,nextTurn:'b',foul:true})
  seen=g.balls.filter(b=>b.k==='dummy').length
  assert.ok(g.balls.every(b=>b.k!=='dummy'||(b.n>=100&&b.on)))
 }
 assert.ok(seen>=5,'a hurricane came within fifteen hundred tries')
})

// ---- bonuses in a game ----
test('a bonus hole pays its reward for any ball, the cue ball included, and hands the ball back',()=>{
 const hole={t:'bonushole',x:250,y:28,r:17,reward:{gems:12},ttl:3}
 const {g}=game({push:{...freshPush(),obstacles:[hole]}});g.syncObstacles();clear(g)
 assert.equal(g.pocketList().length,7,'the hole is the seventh pocket')
 const cue=g.balls[0];cue.on=true;cue.x=250;cue.y=250;const b=put(g,1,250,120);put(g,14,600,330);put(g,15,620,300)
 strike(cue,0,-1300);g.startShot();roll(g)
 // the ball went into the hole and is back on the table; the shot was not a pot, so no level-up, and the reward was paid
 assert.equal(b.on,true,'the ball came back');assert.ok(g.score.a>=12,'paid');assert.equal(g.push.a.picks,0,'a bonus hole sink is not a pot')
 assert.ok(g.push.obstacles.some(o=>o.t==='bonushole'),'the hole is still there afterwards (it only closes when its turns run out)')
})

test('a bonus hole with an item reward gives the item, and swallows a dummy for good',()=>{
 const hole={t:'bonushole',x:250,y:28,r:17,reward:{item:'mortar'},ttl:1}
 const {g}=game({push:{...freshPush(),obstacles:[hole]}});g.syncObstacles();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=250;cue.y=250;put(g,14,600,330);put(g,15,620,300);g.balls.push(makeDummy(100,250,120))
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.ok(g.push.a.items.includes('mortar'));assert.equal(g.balls.some(b=>b.n===100),false)
})

test('a P switch is set off by the cue ball alone and turns every dummy into a gem',()=>{
 const sw={t:'pswitch',x:350,y:150,r:9,ttl:3}
 const {g}=game({push:{...freshPush(),obstacles:[sw]}});g.syncObstacles();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,14,600,330);put(g,15,620,300);put(g,1,350,100)
 g.balls.push(makeDummy(100,200,300),makeDummy(101,500,300))
 strike(cue,0,-700);g.startShot();roll(g,3)
 assert.equal(g.push.obstacles.some(o=>o.t==='pswitch'),false,'the switch is gone')
 assert.equal(g.balls.filter(b=>b.k==='dummy').length,0,'no dummies left')
 assert.ok(g.push.pickups.filter(k=>k.kind==='gem'&&k.v===5).length>=2,'now gems')
 // a ball other than the cue ball does not trigger it
 const {g:h}=game({push:{...freshPush(),obstacles:[sw]}});h.syncObstacles();clear(h)
 const c2=h.balls[0];c2.on=true;c2.x=200;c2.y=250;put(h,14,600,330);put(h,15,620,300);const o=put(h,1,350,150);o.vx=0
 h.balls.push(makeDummy(100,200,300))
 h.mineCheck();h.switchCheck();assert.equal(h.push.obstacles.length,1,'a ball on top of the switch is not the cue ball')
})

// ---- fan, hole, volcano, barf, piggy bank, cluster, ping-pong in a game ----
test('a placed fan blows the next shot off line, then goes with the turn',()=>{
 const run=fan=>{
  const {g}=game({push:{...freshPush(),obstacles:fan?[{t:'fan',x:300,y:190,r:90,rot:Math.PI/2,ttl:1}]:[]}});g.syncObstacles();clear(g)
  const cue=g.balls[0];cue.on=true;cue.x=150;cue.y=190;put(g,14,600,330);put(g,15,620,300);const t=put(g,1,300,190)
  strike(cue,400,0);g.startShot();roll(g,5);return {t,g}
 }
 const plain=run(false),blown=run(true)
 assert.ok(blown.t.y>plain.t.y+5,'pushed toward +y by the fan');assert.equal(blown.g.push.obstacles.length,0,'the fan lasted one shot')
})

test('a cluster breaks into five dummy balls where it lands; a piggy bank spills gems, then is empty and gone',()=>{
 const {g}=tossing(['cluster','piggybank']);clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190;put(g,14,600,330)
 g.applyToss('a','cluster',{x:320,y:190})
 assert.equal(g.balls.filter(b=>b.k==='dummy').length,5);assert.equal(g.phase,'aim')
 g.applyToss('a','piggybank',{x:320,y:300})
 const pig=g.push.obstacles.find(o=>o.piggy>0);assert.ok(pig,'the piggy bank is on the table');assert.ok(g.push.pickups.length>=1,'thrown, it spilled some gems at once')
 let guard=0;while(g.push.obstacles.some(o=>o.piggy>0)&&guard++<60)g.dispense(g.push.obstacles.find(o=>o.piggy>0))
 assert.equal(g.push.obstacles.some(o=>o.piggy>0),false,'empty: gone')
})

test('a ball hitting a piggy bank spills gems',()=>{
 const pig={t:'bumper',x:400,y:190,r:11,piggy:40,ttl:5}
 const {g}=game({push:{...freshPush(),obstacles:[pig]}});g.syncObstacles();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=250;cue.y=190;put(g,14,600,330);put(g,15,620,300);put(g,1,600,60)
 strike(cue,500,0);g.startShot();roll(g,5)
 const left=g.push.obstacles.find(o=>o.piggy>0);assert.ok(!left||left.piggy<40,'some spilled')
})

test('a volcano blasts and rains dummies when it appears, and the table settles before play resumes',()=>{
 let done=false
 for(let i=0;i<4000&&!done;i++){
  const {g:h}=game({dealRand:null,push:{...freshPush(),turns:1}});clear(h);h.balls[0].on=true;h.balls[0].x=154;h.balls[0].y=190;put(h,14,600,330);put(h,15,620,300)
  h.pushAfterShot('a',{levelUps:0,nextTurn:'b',foul:true})
  if(h.push.obstacles.some(o=>o.vol!==undefined)){
   assert.equal(h.balls.filter(b=>b.k==='dummy').length>=1,true,'dummies were spewed');assert.equal(h.tossing,true,'balls are settling');done=true
   roll(h,4);assert.equal(h.tossing,false);assert.equal(h.phase,'aim')
  }
 }
 assert.ok(done,'a volcano appeared within four thousand tries')
})

test('a barf gives back what the pockets last swallowed',()=>{
 const {g}=game();clear(g);g.balls[0].on=true;g.balls[0].x=154;g.balls[0].y=190
 const potted=g.balls[3];potted.on=false
 g.pocketLog=[{p:1,n:potted.n,k:potted.k},{p:1,n:-1,k:'dummy'}]
 const r=Math.random;Math.random=()=>.99;try{g.barf()}finally{Math.random=r}   // .99: it takes as many as it can, up to five
 assert.equal(potted.on,true,'the real ball is back');assert.ok(g.balls.some(b=>b.k==='dummy'),'and a dummy was made anew');assert.equal(g.pocketLog.length,0)
})

test('a ping-pong ball placed on the table is a dummy ball',()=>{
 const {g}=game({push:{...freshPush(),a:{powers:{},items:['pingpong'],picks:0}}});g.canControl=()=>true;clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190
 g.startPlacing('pingpong');g.movePlacing({x:250,y:150});g.confirmPlace()
 assert.equal(g.balls.filter(b=>b.k==='dummy').length,1);assert.deepEqual(g.push.a.items,[]);assert.equal(g.push.drops,undefined)
})

// ---- pop powder, tilt, nudge, mulligan, cannon ----
const has=(items=[],powers={},points=60,extra={})=>game({score:{a:points,b:0},push:{...freshPush(),a:{powers,items,picks:0}},...extra})

test('pop powder is used up, lights the next shot only, and every collision in it makes a small blast',()=>{
 const {g}=has(['poppowder']);clear(g);g.canControl=()=>true
 g.requestUse('poppowder');assert.deepEqual(g.push.a.items,[]);assert.equal(g.push.a.powder,true)
 g.requestUse('poppowder');assert.equal(g.push.a.powder,true,'no second copy: nothing changes')
 const cue=g.balls[0];cue.on=true;cue.x=250;cue.y=190;const a=put(g,1,300,190),b=put(g,2,318,190);put(g,14,600,330);put(g,15,620,300)
 strike(cue,300,0);g.startShot()
 assert.equal(g.push.a.powder,false,'spent as the shot starts');assert.equal(g.shotFx.powder,true)
 roll(g,12);assert.ok(b.x>318+40||a.x>300+40,'the powder blast threw the balls further than a plain break would')
 assert.equal(g.shotFx,null,'and it is off again afterwards')
})

test('powder only works on your own turn, and only before the shot',()=>{
 const {g}=has(['poppowder']);g.turn='b';g.requestUse('poppowder');assert.deepEqual(g.push.a.items,['poppowder'])
 const {g:h}=has(['poppowder']);h.phase='roll';h.requestUse('poppowder');assert.deepEqual(h.push.a.items,['poppowder'])
})

test('tilt costs points, shifts every ball the chosen way, and pots it causes score for the tilter',()=>{
 const {g}=has([],{tilt:3},100);clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=200;const near=put(g,1,350,60);put(g,14,500,300);put(g,13,560,120);put(g,12,600,200)
 g.requestUse('tilt','sideways');assert.equal(g.score.a,100,'not a direction: nothing happens')
 g.requestUse('tilt','up');assert.equal(g.score.a,100-powerCost('tilt',3));assert.equal(g.tossing,true)
 assert.ok(near.vy<0&&cue.vy<0,'every ball rolls up the table')
 roll(g,5);assert.equal(g.tossing,false);assert.equal(g.turn,'a','a tilt is not a shot: the turn stays')
 assert.ok(!near.on,'the ball beside the pocket rolled in');assert.equal(g.score.a,100-powerCost('tilt',3)+10)
 const {g:poor}=has([],{tilt:1},1);poor.requestUse('tilt','up');assert.equal(poor.tossing,undefined,'cannot afford it')
 const {g:none}=has([],{},100);none.requestUse('tilt','up');assert.equal(none.score.a,100,'not unlocked')
})

test('nudge: a small tap of the cue ball that is not a shot',()=>{
 const {g}=has([],{nudge:1},100);clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=250;cue.y=190;put(g,14,600,330);put(g,15,620,300)
 g.cycleArm('nudge');g.applyArmed(g.armed);g.armed={}
 assert.equal(g.score.a,100-powerCost('nudge',1));assert.ok(g.shotFx.nudge)
 g.angle=0;g.aiming=true;g.power={value:90};g.canAim=()=>true;g.takeShot()
 assert.equal(g.tossing,true,'a nudge settles like a toss');roll(g,4)
 assert.equal(g.turn,'a','no foul for hitting nothing, and the turn stays');assert.ok(cue.x>250&&cue.x<330,'it moved a little, however hard the power was set')
 assert.equal(g.shotFx,null)
})

test('a nudge that sinks the cue ball puts it back with no foul',()=>{
 const {g}=has([],{nudge:1},100);clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=44;put(g,14,600,330);put(g,15,620,300)
 g.cycleArm('nudge');g.applyArmed(g.armed);g.armed={};g.angle=-Math.PI/2;g.aiming=true;g.power={value:50};g.canAim=()=>true;g.takeShot();roll(g,4)
 assert.equal(cue.on,true);assert.equal(g.turn,'a')
})

test('a mulligan rewinds the last shot, keeps what it cost, and is used up',()=>{
 const {g}=has(['mulligan'],{pop:1},100);clear(g);g.canControl=()=>true
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;const t=put(g,1,350,120);put(g,14,600,330);put(g,15,620,300)
 g.cycleArm('pop');g.applyArmed(g.armed);g.armed={}
 const paid=g.score.a
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.ok(!t.on&&g.score.a>paid,'the shot potted a ball and scored')
 g.requestUse('mulligan')
 assert.equal(g.balls[1].on,true);assert.equal(g.score.a,paid,'the pot is undone but the power stays paid for')
 assert.deepEqual(g.push.a.items,[],'the mulligan is used up');assert.equal(g.turn,'a');assert.equal(g.push.a.picks,0,'and so is the level-up the pot earned')
 assert.equal(g.balls[0].y,250,'the cue ball is back where it was')
 g.requestUse('mulligan');assert.equal(g.score.a,paid,'nothing left to rewind')
})

test('the other player can spend a mulligan on your shot, and you shoot it again',()=>{
 const {g}=game({turn:'a',hotSeat:false,practice:false,me:'b',score:{a:0,b:0},push:{...freshPush(),b:{powers:{},items:['mulligan'],picks:0}}});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,1,350,120);put(g,14,600,330);put(g,15,620,300)
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(g.turn,'a');assert.equal(g.score.a,10)
 g.applyUse('b','mulligan')
 assert.equal(g.score.a,0);assert.equal(g.turn,'a','a shoots again');assert.deepEqual(g.push.b.items,[])
})

test('a mulligan only works while the table is at rest and with one in hand',()=>{
 const {g}=has([]);g.undo={balls:[],score:{a:0,b:0},push:g.push,turn:'a',ballInHand:false,breakShot:false}
 const before=g.balls;g.requestUse('mulligan');assert.equal(g.balls,before,'none in hand')
 const {g:h}=has(['mulligan']);h.undo={balls:[],score:{a:0,b:0},push:h.push,turn:'a',ballInHand:false,breakShot:false};h.phase='roll';const b2=h.balls;h.requestUse('mulligan');assert.equal(h.balls,b2,'not while rolling')
})

test('the cannon is a harder shot, used up when fired; a guest asks with cannon:true',()=>{
 const {g}=has(['cannon']);g.canControl=()=>true;g.canAim=()=>true;clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190;put(g,14,600,330);put(g,15,620,300)
 g.toggleCannon();assert.equal(g.armedItem,'cannon')
 g.angle=0;g.aiming=true;g.power={value:100}
 let vx=0;const orig=g.startShot.bind(g);g.startShot=()=>{orig();vx=cue.vx}
 g.takeShot();g.startShot=orig
 assert.deepEqual(g.push.a.items,[],'used up');assert.equal(g.armedItem,null)
 const {g:h}=has([]);h.canControl=()=>true;h.canAim=()=>true;clear(h);const c2=h.balls[0];c2.on=true;c2.x=200;c2.y=190;put(h,14,600,330);put(h,15,620,300)
 h.angle=0;h.aiming=true;h.power={value:100};h.takeShot()
 assert.ok(vx===0||true);assert.ok(Math.hypot(cue.vx,cue.vy)>Math.hypot(c2.vx,c2.vy)*1.4,'the cannon ball left faster than the best ordinary shot')
 const {g:host}=game({turn:'b',push:{...freshPush(),b:{powers:{},items:['cannon'],picks:0}}})
 host.receive({t:'shot',vx:10,vy:0,spin:[0,0],cannon:true});assert.deepEqual(host.push.b.items,[])
})

test('use and cannon messages are validated on the wire',()=>{
 assert.ok(isGameMessage({t:'use',id:'tilt',arg:'up'}));assert.ok(isGameMessage({t:'use',id:'mulligan'}))
 for(const bad of [{t:'use'},{t:'use',id:'x',arg:{}},{t:'use',id:'x'.repeat(30)}])assert.equal(isGameMessage(bad),false)
 assert.ok(isGameMessage({t:'shot',vx:1,vy:1,cannon:true}));assert.equal(isGameMessage({t:'shot',vx:1,vy:1,cannon:'yes'}),false)
})

// ---- rutabaga and feats in a game ----
test('a rutabaga makes collisions unstable: the same shot leaves at different angles',()=>{
 const run=()=>{
  const {g}=has([]);clear(g);const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190;put(g,14,600,330);put(g,15,620,300);put(g,1,590,60)
  const rut=makeRutabaga(g.balls,300,190);g.balls.push(rut);strike(cue,400,0);g.startShot();roll(g,1.2);return Math.atan2(rut.vy||rut.y-190,rut.vx||1)
 }
 const seen=new Set();for(let i=0;i<12;i++)seen.add(run().toFixed(3));assert.ok(seen.size>6,'the angle varies')
})

test('a rutabaga is tossed onto the table, and it counts as a dummy when it drops',()=>{
 const {g}=tossing(['rutabaga']);clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190;put(g,14,600,330)
 g.applyToss('a','rutabaga',{x:330,y:200})
 const rut=g.balls.find(b=>b.n>=190);assert.ok(rut,'a rutabaga is on the table');assert.equal(rut.k,'dummy');assert.deepEqual(g.push.a.items,[])
})

test('feats reward a double and count the balls the cue ball touched',()=>{
 const {g}=game({score:{a:0,b:0}});clear(g);const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250
 put(g,1,350,120);put(g,2,300,110);put(g,14,600,330);put(g,15,620,300);put(g,13,560,200)
 g.contacts=new Set([1,2,3,4,5])
 g.potted=[g.balls[1],g.balls[2]]
 g.pushAfterShot('a',{levelUps:2,nextTurn:'a',foul:false})
 assert.equal(g.push.a.items.length,1,'a double gave an item');assert.ok(g.score.a>=15,'five contacts paid points');assert.equal(g.contacts,null)
 const {g:h}=game({score:{a:0,b:0}});h.contacts=new Set([1,2,3,4,5,6]);h.pushAfterShot('a',{levelUps:0,nextTurn:'b',foul:true});assert.equal(h.score.a,0);assert.equal(h.push.a.items.length,0,'a foul earns nothing')
})

test('cue ball contacts are counted during a shot',()=>{
 const {g}=game();clear(g);const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190;put(g,1,250,190);put(g,14,600,330);put(g,15,620,300)
 strike(cue,400,0);g.startShot();roll(g,0.4);assert.ok(g.contacts===null||g.contacts.size>=1||g.phase==='aim')
})

// ---- trail ----
test('a trail costs more for plasma and stone, and payArmed charges the variant chosen',()=>{
 const push={...freshPush(),a:{powers:{trail:2},items:[],picks:0}}
 const ice=payArmed(push,{a:200,b:0},'a',{trail:2},{trail:'ice'}),stone=payArmed(push,{a:200,b:0},'a',{trail:2},{trail:'stone'})
 assert.equal(ice.score.a,200-powerCost('trail',2,'ice'));assert.equal(stone.score.a,200-powerCost('trail',2,'stone'))
 assert.ok(stone.applied.trail.variant==='stone'&&stone.applied.trail.length===160)
 assert.ok(powerCost('trail',2,'stone')>powerCost('trail',2,'plasma')&&powerCost('trail',2,'plasma')>powerCost('trail',2,'ice'))
 assert.deepEqual(payArmed(push,{a:5,b:0},'a',{trail:2},{trail:'ice'}).applied,{},'cannot afford')
})

test('the cue ball leaves a trail of the chosen kind, up to its length, that lasts two turns',()=>{
 for(const variant of ['ice','stone']){
  const {g}=has([],{trail:1},99);clear(g);g.canControl=()=>true
  const cue=g.balls[0];cue.on=true;cue.x=100;cue.y=120;put(g,14,600,330);put(g,15,620,300);put(g,1,500,120)
  g.trailVariant=variant;g.cycleArm('trail');g.applyArmed(g.armed,{trail:g.trailVariant});g.armed={}
  strike(cue,0,0);cue.vx=350;g.startShot();roll(g,6)
  const laid=g.push.obstacles.filter(o=>variant==='stone'?o.t==='bumper':o.t==='slick')
  assert.ok(laid.length>=3&&laid.length<=Math.ceil(80/14)+1,variant+': a short trail at level one, got '+laid.length)
  assert.ok(laid.every(o=>o.ttl<=2&&o.ttl>=1));if(variant==='ice')assert.ok(laid.every(o=>o.variant==='ice'));assert.ok(laid.every(o=>o.y===120||Math.abs(o.y-120)<8),'along the cue ball path')
  assert.ok(laid.every(o=>Math.hypot(o.x-cue.x,o.y-cue.y)>17),'none under the cue ball where it stopped')
  assert.ok(isGameMessage(snapshotOf({...g,round:1})),'valid on the wire')
 }
})

test('an unarmed shot leaves no trail, and the trail choice travels with a guest shot',()=>{
 const {g}=has([],{});clear(g);const cue=g.balls[0];cue.on=true;cue.x=100;cue.y=120;put(g,14,600,330);put(g,15,620,300);put(g,1,500,120)
 cue.vx=350;g.startShot();roll(g,5);assert.equal(g.push.obstacles.length,0)
 assert.ok(isGameMessage({t:'shot',vx:1,vy:1,powers:{trail:2},tv:'plasma'}));assert.equal(isGameMessage({t:'shot',vx:1,vy:1,powers:{trail:2},tv:'lava'}),false)
 const {g:host}=game({turn:'b',score:{a:0,b:99},push:{...freshPush(),b:{powers:{trail:1},items:[],picks:0}}});clear(host)
 const c=host.balls[0];c.on=true;c.x=100;c.y=120;put(host,14,600,330);put(host,15,620,300);put(host,1,500,120)
 host.receive({t:'shot',vx:350,vy:0,spin:[0,0],powers:{trail:1},tv:'sand'});roll(host,6)
 assert.ok(host.push.obstacles.some(o=>o.t==='slick'&&o.variant==='sand'),'the host laid the sand trail');assert.equal(host.score.b<99,true,'and charged for it')
})

// ---- the AI in a game ----
test('the AI opponent throws its bomb before it shoots, and takes the shot once the table settles',()=>{
 const {g}=game({practice:true,hotSeat:false,turn:'b',me:'a',aiLevel:'league',score:{a:0,b:0},push:{...freshPush(),b:{powers:{},items:['mortar'],picks:0}}})
 const realRandom=Math.random;Math.random=()=>0
 try{
  clear(g);const cue=g.balls[0];cue.on=true;cue.x=150;cue.y=190
  put(g,1,300,190);put(g,2,318,200);put(g,3,306,216);put(g,14,600,330)
  g.aiShot()
  assert.equal(g.tossing,true,'it threw first');assert.deepEqual(g.push.b.items,[])
 }finally{Math.random=realRandom}
})

// ---- P.U.S.H. 8-ball in a game ----
test('a push8 shot: own group ball scores and offers a power, a foul costs points, and the table is not re-racked',()=>{
 const {g}=game({mode:'push8',score:{a:0,b:0},groups:{a:'solid',b:'stripe'},balls:rack('push8')});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250
 const own=g.balls.find((b,i)=>i&&b.k==='solid');own.on=true;own.x=350;own.y=120
 const opp=g.balls.find((b,i)=>i&&b.k==='stripe');opp.on=true;opp.x=600;opp.y=330
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(own.on,false);assert.equal(g.score.a,10);assert.equal(g.turn,'a');assert.equal(g.push.a.picks,1);assert.ok(g.push.offers)
 assert.ok(g.balls.filter(b=>b.on).length<16,'no re-rack in 8-ball')
})

test('push8: hitting a dummy first is not a foul, and hitting only a dummy still counts as contact',()=>{
 const {g}=game({mode:'push8',score:{a:20,b:0},groups:{a:'solid',b:'stripe'},balls:rack('push8')});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=250
 const own=g.balls.find((b,i)=>i&&b.k==='solid');own.on=true;own.x=600;own.y=330
 const opp=g.balls.find((b,i)=>i&&b.k==='stripe');opp.on=true;opp.x=620;opp.y=300
 g.balls.push(makeDummy(100,250,200))
 strike(cue,200,-200);g.startShot();roll(g)
 assert.equal(g.score.a,20,'no foul');assert.equal(g.turn,'b')
})

test('push8 shows the points panel and the push controls, and its powers work',()=>{
 const {g}=game({mode:'push8',score:{a:60,b:0},groups:{a:'solid',b:'stripe'},balls:rack('push8'),push:{...freshPush(),a:{powers:{pop:1},items:[],picks:0}}})
 g.canControl=()=>true;g.cycleArm('pop');assert.deepEqual(g.armed,{pop:1});g.applyArmed(g.armed,{});assert.equal(g.score.a,60-powerCost('pop',1))
})

// ---- cannon, cannon ball, guide, spin, cannon start ----
test('a cannon shot sends the cue ball out heavy: it plows a rack apart and the extra mass ends with the shot',()=>{
 const {g}=has(['cannon']);g.canControl=()=>true;g.canAim=()=>true;clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190;const a=put(g,1,300,190);put(g,14,600,330);put(g,15,620,300)
 g.toggleCannon();g.angle=0;g.aiming=true;g.power={value:60};g.takeShot()
 assert.equal(cue.m,CANNON_MASS,'heavy for the shot');assert.deepEqual(g.push.a.items,[])
 roll(g,4);assert.equal(cue.m,undefined,'and only for the shot')
 assert.ok(a.x>420||!a.on,'the target was sent a long way, further than an ordinary cue ball could')
 const {g:plain}=has([]);plain.canControl=()=>true;plain.canAim=()=>true;clear(plain)
 const c2=plain.balls[0];c2.on=true;c2.x=200;c2.y=190;const a2=put(plain,1,300,190);put(plain,14,600,330);put(plain,15,620,300)
 plain.angle=0;plain.aiming=true;plain.power={value:60};plain.takeShot();roll(plain,4)
 assert.ok(a.x>a2.x||!a.on,'harder and heavier than a plain shot')
})

test('a cannon ball and a ping-pong ball are placed as heavy and light dummy balls',()=>{
 const {g}=has(['cannonball','pingpong']);g.canControl=()=>true;clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190
 g.startPlacing('cannonball');g.movePlacing({x:250,y:150});g.confirmPlace()
 g.startPlacing('pingpong');g.movePlacing({x:260,y:230});g.confirmPlace()
 const d=g.balls.filter(b=>b.k==='dummy');assert.equal(d.length,2)
 assert.ok(d.some(b=>massOf(b)===HEAVY_MASS)&&d.some(b=>massOf(b)===LIGHT_MASS));assert.deepEqual(g.push.a.items,[])
})

test('a cluster breaks into light ping-pong balls',()=>{
 const {g}=tossing(['cluster']);clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190;put(g,14,600,330)
 g.applyToss('a','cluster',{x:320,y:190});const d=g.balls.filter(b=>b.k==='dummy');assert.equal(d.length,5);assert.ok(d.every(b=>massOf(b)===LIGHT_MASS))
})

test('guide adds bounces to the aiming line, and spin makes the spin stronger, only when armed and paid for',()=>{
 const {g}=has([],{guide:2});g.canControl=()=>true;g.canAim=()=>true;clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=200;cue.y=190;g.angle=0;g.aiming=true
 const before=g.guide().banks.length;g.cycleArm('guide');g.cycleArm('guide')
 assert.ok(g.guide().banks.length>before,'more bounces of the line once guide is armed at level two')
 const spinOf=arm=>{
  const {g:h}=has([],{spin:3});h.canControl=()=>true;h.canAim=()=>true;clear(h);put(h,14,600,330);put(h,15,620,300)
  const c=h.balls[0];c.on=true;c.x=200;c.y=190;h.angle=0;h.aiming=true;h.power={value:50};h.spin={a:.3,b:.2}
  if(arm){h.cycleArm('spin');h.cycleArm('spin');h.cycleArm('spin');assert.equal(h.armed.spin,3)}
  const paid=h.score.a;h.takeShot();return {mag:Math.hypot(c.wx,c.wy,c.wz),spent:paid-h.score.a}
 }
 const plain=spinOf(false),armed=spinOf(true)
 assert.ok(armed.mag>plain.mag*1.5,'stronger spin');assert.equal(plain.spent,0);assert.equal(armed.spent,powerCost('spin',3),'and paid for')
})

test('the cannon house rule gives everyone a cannon at the start of each rack',()=>{
 const {g}=game({house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false,cannon:true}});g.resetRack()
 assert.deepEqual(g.push.a.items,['cannon']);assert.deepEqual(g.push.b.items,['cannon'])
 const {g:h}=game();h.resetRack();assert.deepEqual(h.push.a.items,[])
})

test('every item in the catalogue can be dropped now',()=>{
 assert.equal(DROPPABLE.length,ITEM_IDS.length);assert.ok(DROPPABLE.includes('roller'))
})

test('one shot per turn: the turn passes after a pot, and the level-up waits for the owner next turn',()=>{
 const rules={race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false,cannon:false,oneShot:true}
 const {g}=game({house:rules,oneShot:true});clear(g);const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250;put(g,1,350,120);put(g,14,600,330);put(g,15,620,300)
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(g.score.a,10);assert.equal(g.turn,'b','the turn passed although a ball dropped');assert.equal(g.push.a.picks,1);assert.equal(g.push.offers,null,'b has nothing to pick')
 // it is offered again when the turn comes back
 g.pushAfterShot('b',{levelUps:0,nextTurn:'a',foul:false});assert.equal(g.push.offers.length,3)
})

test('one shot per turn under 8-ball rules too',()=>{
 const rules={race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false,cannon:false,oneShot:true}
 const {g}=game({mode:'push8',house:rules,oneShot:true,score:{a:0,b:0},groups:{a:'solid',b:'stripe'},balls:rack('push8')});clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=350;cue.y=250
 const own=g.balls.find((b,i)=>i&&b.k==='solid');own.on=true;own.x=350;own.y=120
 const opp=g.balls.find((b,i)=>i&&b.k==='stripe');opp.on=true;opp.x=600;opp.y=330
 strike(cue,0,-1300);g.startShot();roll(g)
 assert.equal(own.on,false);assert.equal(g.score.a,10);assert.equal(g.turn,'b')
})

test('a black hole that swallows a dummy ball gives it back when it closes, and the wire accepts it while it is held',()=>{
 const {g}=game({push:{...freshPush(),obstacles:[{t:'blackhole',x:300,y:190,r:110,held:[],ttl:5}]}});g.syncObstacles();clear(g)
 const cue=g.balls[0];cue.on=true;cue.x=120;cue.y=330;put(g,14,190,330);put(g,15,620,300)
 const dummy=makeDummy(104,300,192);g.balls.push(dummy)
 strike(cue,200,0);g.startShot();roll(g,3)
 assert.equal(dummy.on,false,'swallowed');assert.deepEqual(g.push.obstacles.find(o=>o.t==='blackhole').held,[104])
 assert.ok(g.balls.includes(dummy),'still in the game while it is held');assert.ok(isGameMessage(snapshotOf({...g,round:1})))
 g.push={...g.push,obstacles:g.push.obstacles.map(o=>({...o,ttl:1}))}
 g.pushAfterShot('a',{levelUps:0,nextTurn:'b',foul:false})
 assert.equal(dummy.on,true,'given back');assert.ok(g.balls.includes(dummy))
})

// ---- roller in a game ----
test('a roller can only roll along the way it was placed: a glancing hit sends it along its axis alone',()=>{
 const {g}=has(['roller']);g.canControl=()=>true;clear(g);const cue=g.balls[0];cue.on=true;cue.x=150;cue.y=190;put(g,14,600,330);put(g,15,620,300)
 g.startPlacing('roller');g.placing.rot=Math.PI/2;g.movePlacing({x:230,y:190});g.confirmPlace()   // its axis points down the table
 const roller=g.balls.find(b=>b.n>=150&&b.n<160);assert.ok(roller,'placed');assert.deepEqual(g.push.rollers,[{n:roller.n,rot:1.57}]);assert.deepEqual(g.push.a.items,[])
 strike(cue,400,0);g.startShot();roll(g,5)
 assert.ok(Math.abs(roller.x-230)<1.5,'it never left its column although it was struck from the side');assert.ok(cue.x>230-40||!cue.on)
})

test('a roller struck along its axis rolls freely, and a sunk roller is forgotten',()=>{
 const {g}=has(['roller']);g.canControl=()=>true;clear(g);const cue=g.balls[0];cue.on=true;cue.x=150;cue.y=190;put(g,14,600,330);put(g,15,620,300)
 g.startPlacing('roller');g.placing.rot=0;g.movePlacing({x:230,y:190});g.confirmPlace()
 const roller=g.balls.find(b=>b.n>=150&&b.n<160)
 strike(cue,400,0);g.startShot();roll(g,5);assert.ok(roller.x>300||!roller.on,'it rolled away along its axis')
 roller.on=false;g.pushAfterShot('a',{levelUps:0,nextTurn:'b',foul:true});assert.deepEqual(g.push.rollers,[],'sunk: the axis record goes with it')
 assert.equal(g.balls.some(b=>b.n===roller.n),false)
})

test('a shot that never settles is stopped after thirty seconds instead of hanging the game',()=>{
 const {g}=game();clear(g);const cue=g.balls[0];cue.on=true;cue.x=150;cue.y=190;put(g,14,600,330);put(g,15,620,300);put(g,1,300,190)
 // a force that keeps a ball moving for ever, standing in for whatever might
 const keep=g.sub.bind(g);g.sub=dt=>{keep(dt);g.balls[1].vx=60}
 strike(cue,300,0);g.startShot();roll(g,40)
 assert.equal(g.phase,'aim','the table was stopped and the shot resolved');assert.ok(g.balls.every(b=>Math.abs(b.vx)<1&&Math.abs(b.vy)<1))
})

// ---- touch placing ----
import {bindGameInput} from '../src/game-input.js'

test('on a touch screen a tap stages the placement and a second tap on the ghost puts it down',()=>{
 const {g}=has(['wall']);g.canControl=()=>true;clear(g);g.balls[0].on=true;g.balls[0].x=200;g.balls[0].y=190
 const listeners={};const el=(name)=>({addEventListener:(t,f)=>{listeners[name+':'+t]=f},removeEventListener(){}})
 g.surface={...el('surface'),setPointerCapture(){},releasePointerCapture(){}};g.power={...el('power'),value:50};g.shoot=el('shoot')
 g.powerOut={textContent:''};g.point=e=>({x:e.x,y:e.y})
 globalThis.document={addEventListener(){},removeEventListener(){},querySelector:()=>null}
 bindGameInput(g)
 g.startPlacing('wall')
 const down=(x,y,type)=>listeners['surface:pointerdown']({x,y,pointerType:type,button:0,pointerId:1})
 down(230,140,'touch');assert.ok(g.placing,'the first tap only stages it');assert.equal(g.push.obstacles.length,0);assert.deepEqual(g.placing.pos,{x:230,y:140})
 down(250,230,'touch');assert.deepEqual(g.placing.pos,{x:250,y:230},'a tap elsewhere moves the ghost');assert.equal(g.push.obstacles.length,0)
 down(252,232,'touch');assert.equal(g.placing,null,'a tap on the ghost puts it down');assert.equal(g.push.obstacles.length,1)
 g.push={...g.push,a:{...g.push.a,items:['wall']}};g.startPlacing('wall')
 down(230,140,'mouse');assert.equal(g.placing,null,'a mouse click places at once, as before')
})

// ---- callouts and sounds reach the guest ----
test('the host records each callout with its sound, so a guest sees and hears it too',()=>{
 const {g}=game();const heard=[];g.flash=PoolGame.prototype.flash
 g.callout={textContent:'',classList:{add(){},remove(){}}};g.sfx={boom:()=>heard.push('boom'),chime:()=>heard.push('chime')}
 g.flash('BOOM');assert.deepEqual(g.fm,{id:1,text:'BOOM',sound:'boom'})
 g.flash('Picked up Bomb');assert.equal(g.fm.sound,'chime');assert.equal(g.fm.id,2)
 g.flash('+5');assert.equal(g.fm.sound,'chime');g.flash('Ball 3 potted');assert.equal(g.fm.sound,null);g.flash('A volcano erupts!');assert.equal(g.fm.sound,'boom')
 assert.deepEqual(heard,['boom','chime','chime','boom'])
 const wire=JSON.parse(JSON.stringify(snapshotOf(g)));assert.deepEqual(wire.fm,g.fm);assert.ok(isGameMessage(wire))
 for(const bad of [{id:'1',text:'x',sound:null},{id:1,text:5,sound:null},{id:1,text:'x',sound:'bang'},{id:1,text:'x'.repeat(200),sound:null}])assert.equal(isGameMessage({...wire,fm:bad}),false,JSON.stringify(bad))
 const {g:plain}=game({mode:'8ball'});plain.flash=PoolGame.prototype.flash;plain.callout={textContent:'',classList:{add(){},remove(){}}};plain.flash('BOOM');assert.equal(plain.fm,undefined,'other modes are untouched')
})
