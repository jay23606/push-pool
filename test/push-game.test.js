import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack} from '../src/rules.js'
import {freshPush} from '../src/push/state.js'
import {makeDummy} from '../src/push/dummy.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'

// a hot-seat push game with no DOM: same construction as the chaos tests
function game(extra={}){
 const g=Object.create(PoolGame.prototype),flashes=[]
 Object.assign(g,{mode:'push',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash:m=>flashes.push(m),setSpin(){},send(){},onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',
  balls:rack('push'),power:{value:50},spin:{a:0,b:0},aiming:true,angle:0,fx:null,push:freshPush(),
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
 assert.equal(g.balls.find(b=>b.n===100).on,false,'the dummy dropped')
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
