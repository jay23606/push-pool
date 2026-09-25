import {W,H,R,PR,POCKETS,COLORS,DUMMY_COLOR,GEM_COLOR,ITEM_COLOR} from './table.js'
import {shapeOf,RANGE} from './push/placing.js'
import {TOSS_RANGE,scatterAt} from './push/toss.js'
import {ITEMS} from './push/items.js'
import {rayToRail,bankPath} from './pool.js'
import {tableFractions} from './screen-point.js'
import {getObstacles,WALL_R} from './obstacles.js'
const PORTAL_COLORS=['#4aa8ff','#ff9a3c','#c46bff']

// The original top-down renderer. Kept as the default and as a fallback for
// devices where WebGL is unavailable or too slow.
export function createRenderer2D(canvas,options={}){
 const g=canvas.getContext('2d')
 let felt=options.felt||'#17794b'
 function drawBall(b){
  g.save();g.beginPath();g.arc(b.x,b.y,R,0,7);g.clip()
  const surface=g.createRadialGradient(b.x-3.5,b.y-4,1,b.x+2,b.y+3,R*1.25)
  surface.addColorStop(0,'#fff');surface.addColorStop(.24,b.k==='cue'?'#e7e7e1':b.k==='dummy'?DUMMY_COLOR:COLORS[b.n]);surface.addColorStop(.78,b.k==='cue'?'#c7c7c0':b.k==='dummy'?DUMMY_COLOR:COLORS[b.n]);surface.addColorStop(1,'#101510')
  g.fillStyle=surface;g.fillRect(b.x-R,b.y-R,2*R,2*R)
  if(b.k==='stripe'){g.fillStyle='#f9f6eb';g.fillRect(b.x-R,b.y-4.4,2*R,8.8)}
  if(b.k!=='cue'&&b.k!=='dummy'){g.fillStyle='#f7f4e9';g.beginPath();g.arc(b.x,b.y,4.45,0,7);g.fill();g.fillStyle='#172018';g.font='bold 5px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(b.n,b.x,b.y+.4)}
  g.restore()
  g.strokeStyle='rgba(0,0,0,.48)';g.lineWidth=.65;g.beginPath();g.arc(b.x,b.y,R,0,7);g.stroke()
  g.fillStyle='rgba(255,255,255,.72)';g.beginPath();g.arc(b.x-3.3,b.y-3.7,1.9,0,7);g.fill()
 }
 return {
  mode:'2d',
  el:canvas,
  point(e){const {fx,fy}=tableFractions(canvas,e);return{x:fx*W,y:fy*H}},
  resize(){},
  destroy(){},
  draw(game){
   g.clearRect(0,0,W,H);g.fillStyle='#5f351f';g.fillRect(0,0,W,H)
   const grad=g.createRadialGradient(350,170,10,350,190,400);grad.addColorStop(0,felt);grad.addColorStop(1,shade(felt,-.48));g.fillStyle=grad;g.fillRect(22,22,656,336)
   g.fillStyle='#07100c'
   const pk=game.pocketScale?game.pocketScale():1
   POCKETS.forEach(([x,y],i)=>{g.beginPath();g.arc(x,y,(PR-2)*pk,0,7);g.fill();if((game.markedPocket?game.markedPocket():game.calledPocket)===i){g.strokeStyle='#ffd75d';g.lineWidth=3;g.beginPath();g.arc(x,y,PR+3,0,7);g.stroke()}if(game.snapMark&&game.snapMark()===i){g.strokeStyle='#ffffffb0';g.lineWidth=2;g.beginPath();g.arc(x,y,PR+1,0,7);g.stroke()}})
   for(const o of game.push?.obstacles||[]){
    if(o.t==='slick'){const c={ice:'150,220,255',electric:'255,230,90',sand:'220,180,110',plasma:'200,90,255'}[o.variant]||'255,255,255',gr=g.createRadialGradient(o.x,o.y,2,o.x,o.y,o.r);gr.addColorStop(0,`rgba(${c},.55)`);gr.addColorStop(1,`rgba(${c},.12)`);g.fillStyle=gr;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill()}
    if(o.t==='blackhole'){const gr=g.createRadialGradient(o.x,o.y,2,o.x,o.y,o.r);gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(.25,'rgba(40,10,70,.6)');gr.addColorStop(1,'rgba(90,40,160,0)');g.fillStyle=gr;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill()}
   }
   for(const o of game.push?.obstacles||[])if(o.t==='smoke'){const gr=g.createRadialGradient(o.x,o.y,4,o.x,o.y,o.r);gr.addColorStop(0,'rgba(200,200,205,.8)');gr.addColorStop(1,'rgba(200,200,205,.15)');g.fillStyle=gr;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill()}
   for(const o of game.push?.obstacles||[]){
    if(o.t==='pswitch'){g.fillStyle='#ffd75d';g.strokeStyle='#5a3a00';g.lineWidth=1.5;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill();g.stroke();g.fillStyle='#5a3a00';g.font='bold 10px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('P',o.x,o.y+.5)}
    if(o.t==='bonushole'){g.fillStyle='#07100c';g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill();g.strokeStyle='#5bd6ff';g.lineWidth=3;g.beginPath();g.arc(o.x,o.y,o.r+3,0,7);g.stroke();g.fillStyle='#5bd6ff';g.font='bold 11px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(o.reward.item?'?':'+'+o.reward.gems,o.x,o.y+(o.y<60?PR+8:-PR-6))}
   }
   for(const o of game.push?.obstacles||[])if(o.t==='mine'){g.fillStyle='#2a0b0b';g.strokeStyle='#ff5a3c';g.lineWidth=2;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill();g.stroke();g.fillStyle='#ff5a3c';g.beginPath();g.arc(o.x,o.y,2.5,0,7);g.fill()}
   if(game.placing?.pos&&game.phase==='aim'){
    const pl=game.placing,cue=game.balls[0],ok=game.placingOk(),col=ok?'#5dff9a':'#ff5d5d'
    g.save();g.setLineDash([5,5]);g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=1.5;g.beginPath();g.arc(cue.x,cue.y,pl.toss?TOSS_RANGE:RANGE[ITEMS[pl.item].range],0,7);g.stroke();g.restore()
    if(pl.toss){
     const dx=pl.pos.x-cue.x,dy=pl.pos.y-cue.y,d=Math.hypot(dx,dy)||1,k=Math.min(1,TOSS_RANGE/d),tx=cue.x+dx*k,ty=cue.y+dy*k
     g.strokeStyle=col;g.lineWidth=2;g.beginPath();g.moveTo(cue.x,cue.y);g.lineTo(tx,ty);g.stroke();g.beginPath();g.arc(tx,ty,Math.max(3,scatterAt(cue,pl.pos)),0,7);g.stroke();g.beginPath();g.arc(tx,ty,3,0,7);g.fill()
    }
    g.strokeStyle=col;g.fillStyle=ok?'rgba(93,255,154,.25)':'rgba(255,93,93,.25)';g.lineWidth=4
    for(const o of shapeOf(pl.item,pl.pos.x,pl.pos.y,pl.rot)){if(o.t==='bumper'){g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill();g.stroke()}else if(o.t==='mine'){g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill();g.stroke()}else{g.beginPath();g.moveTo(o.x1,o.y1);g.lineTo(o.x2,o.y2);g.stroke()}}
   }
   // P.U.S.H. Pool pickups: a gem is a blue diamond, an item an amber box, both bobbing a little
   for(const k of game.push?.pickups||[]){
    const bob=Math.sin(performance.now()/300+k.x)*1.5
    if(k.kind==='gem'){g.fillStyle=GEM_COLOR;g.strokeStyle='#eafaff';g.lineWidth=1.2;g.beginPath();g.moveTo(k.x,k.y-7+bob);g.lineTo(k.x+5,k.y+bob);g.lineTo(k.x,k.y+7+bob);g.lineTo(k.x-5,k.y+bob);g.closePath();g.fill();g.stroke()}
    else{g.fillStyle=ITEM_COLOR;g.strokeStyle='#fff3d6';g.lineWidth=1.2;g.fillRect(k.x-6,k.y-6+bob,12,12);g.strokeRect(k.x-6,k.y-6+bob,12,12);g.fillStyle='#5a3a00';g.font='bold 9px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('?',k.x,k.y+bob+.5)}
   }
   const fx=game.fx
   if(fx){
    const t=(typeof performance!=='undefined'?performance.now():0)/1000
    if(fx.type==='bonus'){g.fillStyle='#07100c';g.beginPath();g.arc(fx.x,fx.y,PR*.9,0,7);g.fill();g.strokeStyle='#ffd75d';g.lineWidth=3;g.beginPath();g.arc(fx.x,fx.y,PR*.9+3,0,7);g.stroke();g.fillStyle='#ffd75d';g.font='bold 11px sans-serif';g.textAlign='center';g.fillText('x3',fx.x,fx.y+(fx.y<190?PR*.9+16:-PR*.9-8))}
    if(fx.type==='well'){const gr=g.createRadialGradient(fx.x,fx.y,4,fx.x,fx.y,fx.r);gr.addColorStop(0,'rgba(150,90,255,.55)');gr.addColorStop(1,'rgba(150,90,255,0)');g.fillStyle=gr;g.beginPath();g.arc(fx.x,fx.y,fx.r,0,7);g.fill()}
    if(fx.type==='bomb'&&!fx.spent){const bomb=game.balls.find(b=>b.n===fx.n&&b.on);if(bomb){g.strokeStyle=`rgba(255,80,60,${.55+.35*Math.sin(t*8)})`;g.lineWidth=3;g.beginPath();g.arc(bomb.x,bomb.y,R+4+2*Math.sin(t*8),0,7);g.stroke()}}
   }
   // obstacles: bumpers, walls and portal rings
   let pi=0
   for(const o of getObstacles()){
    if(o.t==='bumper'){const gr=g.createRadialGradient(o.x-o.r*.3,o.y-o.r*.35,1,o.x,o.y,o.r);gr.addColorStop(0,'#f2f2ee');gr.addColorStop(.55,'#8a8f92');gr.addColorStop(1,'#3a3e40');g.fillStyle='#0007';g.beginPath();g.arc(o.x+2,o.y+3,o.r,0,7);g.fill();g.fillStyle=gr;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill()}
    else if(o.t==='wall'){g.lineCap='round';g.strokeStyle='#0006';g.lineWidth=WALL_R*2+3;g.beginPath();g.moveTo(o.x1+1.5,o.y1+2.5);g.lineTo(o.x2+1.5,o.y2+2.5);g.stroke();g.strokeStyle='#d8c58c';g.lineWidth=WALL_R*2;g.beginPath();g.moveTo(o.x1,o.y1);g.lineTo(o.x2,o.y2);g.stroke()}
    else if(o.t==='portal'){const c=PORTAL_COLORS[Math.floor(pi++/2)%PORTAL_COLORS.length],gr=g.createRadialGradient(o.x,o.y,2,o.x,o.y,o.r);gr.addColorStop(0,c+'cc');gr.addColorStop(1,c+'22');g.fillStyle=gr;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.fill();g.strokeStyle=c;g.lineWidth=2.5;g.beginPath();g.arc(o.x,o.y,o.r,0,7);g.stroke()}
   }
   g.lineCap='butt'
   for(const b of game.balls)if(b.on&&!(b.z>0))drawBall(b)
   // A ball in the air is drawn on top of the rest and larger, growing as it climbs and shrinking as it comes down:
   // seen from above, that is how height looks. Its shadow stays on the cloth.
   for(const b of game.balls)if(b.on&&b.z>0){const k=1+Math.min(b.z,30)/40;g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(b.x+b.z*.15,b.y+b.z*.2,R,R*.85,0,0,7);g.fill();g.save();g.translate(b.x,b.y);g.scale(k,k);g.translate(-b.x,-b.y);drawBall(b);g.restore()}
   if(!(game.aiming&&game.canAim()))return
   const q=game.guide()
   g.lineWidth=1.2;g.setLineDash([7,6]);g.strokeStyle='#fff';g.beginPath();g.moveTo(q.c.x,q.c.y);g.lineTo(q.c.x+q.dx*q.t,q.c.y+q.dy*q.t);g.stroke()
   if(q.banks.length){g.strokeStyle='rgba(255,255,255,.48)';g.beginPath();g.moveTo(q.banks[0].x,q.banks[0].y);q.banks.slice(1).forEach(p=>g.lineTo(p.x,p.y));g.stroke()}
   if(q.hit){const gx=q.c.x+q.dx*q.t,gy=q.c.y+q.dy*q.t,nx=(q.hit.x-gx)/(2*R),ny=(q.hit.y-gy)/(2*R),d=rayToRail(q.hit.x,q.hit.y,nx,ny);g.strokeStyle='#ffd96a';g.beginPath();g.moveTo(q.hit.x,q.hit.y);g.lineTo(q.hit.x+nx*d,q.hit.y+ny*d);g.stroke();const past=bankPath(q.hit.x,q.hit.y,nx,ny,2);if(past.length>1){g.strokeStyle='rgba(255,217,106,.45)';g.beginPath();g.moveTo(past[0].x,past[0].y);g.lineTo(past[1].x,past[1].y);g.stroke()}}
   g.setLineDash([])
   const tip=R+6+(+game.power.value/100)*42,at=d=>[q.c.x-q.dx*(tip+d),q.c.y-q.dy*(tip+d)]
   g.lineCap='round'
   for(const[a,b,w,c]of[[0,5,4,'#4e8fa6'],[5,52,7,'#ece0bb'],[52,160,9,'#a76f38'],[160,205,11,'#1d1915'],[205,242,14,'#714326']]){g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(...at(a));g.lineTo(...at(b));g.stroke()}
   g.lineCap='butt'
  },
  setFelt(color){felt=color}
 }
}

function shade(hex,amount){
 const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(v*(1+amount))))
 return `#${[f(n>>16),f((n>>8)&255),f(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('')}`
}
