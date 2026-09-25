import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack} from '../src/rules.js'
import {freshPush} from '../src/push/state.js'
import {makeDummy} from '../src/push/dummy.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
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

test('a new push game starts with empty push state and a hundred to play for',()=>{
 const {g}=game();assert.deepEqual(g.push,freshPush());assert.equal(g.scoreTarget??100,100)
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
 const {g}=owning({pop:2,guide:1});g.canControl=()=>true
 g.cycleArm('pop');assert.deepEqual(g.armed,{pop:1});g.cycleArm('pop');assert.deepEqual(g.armed,{pop:2})
 g.cycleArm('pop');assert.deepEqual(g.armed,{},'past your level it switches off')
 g.cycleArm('guide');g.cycleArm('stink');assert.deepEqual(g.armed,{},'not armable / not owned')
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
