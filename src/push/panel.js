import {POWERS,powerCost} from './powers.js'
import {ITEMS} from './items.js'
import {isPlaceable} from './placing.js'
import {isTossable} from './toss.js'
import {ITEMS as ITEM_DEFS} from './items.js'
import {isPush} from '../rules.js'
import {renderHelp} from './help.js'
import {isArmable,TRAIL_VARIANTS} from './powers.js'

// The P.U.S.H. Pool side panel: your points, powers and items, and the level-up choice when one is owed. It is plain DOM
// built with textContent (nothing from the network is ever parsed as HTML), and only rebuilt when what it shows changes,
// because the game asks for a HUD update on every frame.

const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}

export function pushPanelState(game){
 const me=game.hotSeat?game.turn:game.me,push=game.push
 if(!push||!isPush(game.mode))return null
 const mine=push[me]
 return {me,points:game.score?.[me]||0,powers:mine.powers,items:mine.items,picks:mine.picks,
  offers:game.turn===me&&!game.spectator?push.offers:null,
  armed:game.armed||{},trailVariant:game.trailVariant||'ice',armedItem:game.armedItem||null,powder:Boolean(mine.powder),canMull:game.phase==='aim'&&Boolean(game.undo)&&!game.spectator&&!game.tossing,canUse:game.turn===me&&!game.spectator&&game.phase==='aim'&&!game.ballInHand,placing:game.placing?.item||null}
}

// The reference, in a dialog made on first use.
function showHelp(){
 let d=document.getElementById('push-help')
 if(!d){
  d=document.createElement('dialog');d.id='push-help'
  const body=el('div','push-help-body'),close=el('button','ghost','Close');close.type='button';close.onclick=()=>d.close()
  d.append(el('h2',null,'How P.U.S.H. Pool works'),body,close);document.body.append(d);renderHelp(body)
 }
 d.showModal();d.scrollTop=0
}

export function renderPushPanel(game){
 if(!isPush(game.mode)){if(game.pushPanel){game.pushPanel.remove();game.pushPanel=null;game.pushSig=''}return}
 const st=pushPanelState(game)
 if(!st)return
 if(!game.pushPanel){
  game.pushPanel=el('div','push-panel');game.pushPanel.setAttribute('aria-live','polite')
  const anchor=game.status;anchor.parentNode.insertBefore(game.pushPanel,anchor.nextSibling)
 }
 const sig=JSON.stringify(st)
 if(sig===game.pushSig)return
 game.pushSig=sig
 const p=game.pushPanel;p.replaceChildren()
 {
  const top=el('div','push-top');top.append(el('div','push-pts',`${st.points} pts`))
  const help=el('button','push-chip use','? How it works');help.type='button';help.onclick=()=>showHelp()
  top.append(help);p.append(top)
 }
 if(st.offers){
  p.append(el('div','push-h',`Level up · choose a power${st.picks>1?` (${st.picks} owed)`:''}`))
  const row=el('div','push-offers')
  for(const o of st.offers){
   const d=POWERS[o.id],b=el('button','push-offer'),cost=powerCost(o.id,o.level)
   b.type='button';b.dataset.power=o.id
   b.append(el('b',null,`${d.name} ${'I'.repeat(o.level)}`),el('small',null,`${d.blurb} · ${cost} pts to use`))
   b.onclick=()=>game.pickPower(o.id)
   row.append(b)
  }
  p.append(row)
 }
 const owned=Object.entries(st.powers)
 if(owned.length){
  const row=el('div','push-row');row.append(el('span','push-label','Powers'))
  for(const [id,l] of owned){
   if(isArmable(id)&&st.canUse){
    const a=st.armed[id]||0,tv=id==='trail'?st.trailVariant:undefined,b=el('button','push-chip use'+(a?' on':''),a?`${POWERS[id].name} ${'I'.repeat(a)}${tv?' '+tv:''} armed · ${powerCost(id,a,tv)}`:`${POWERS[id].name} ${'I'.repeat(l)} · ${powerCost(id,1)}`)
    b.type='button';b.title=POWERS[id].blurb;b.onclick=()=>game.cycleArm(id);row.append(b)
   }else row.append(el('span','push-chip',`${POWERS[id].name} ${'I'.repeat(l)} · ${powerCost(id,1)}`))
  }
  p.append(row)
 }
 if(st.items.length){
  const row=el('div','push-row');row.append(el('span','push-label','Items'))
  for(const id of st.items){
   if(id==='mulligan'&&st.canMull){const b=el('button','push-chip item use','Mulligan');b.type='button';b.title=ITEM_DEFS.mulligan.blurb;b.onclick=()=>game.requestUse('mulligan');row.append(b);continue}
   if(id==='poppowder'&&st.canUse){const b=el('button','push-chip item use','Pop powder');b.type='button';b.title=ITEM_DEFS.poppowder.blurb;b.onclick=()=>game.requestUse('poppowder');row.append(b);continue}
   if(id==='cannon'&&st.canUse){const b=el('button','push-chip item use'+(st.armedItem==='cannon'?' on':''),st.armedItem==='cannon'?'Cannon armed':'Cannon');b.type='button';b.title=ITEM_DEFS.cannon.blurb;b.onclick=()=>game.toggleCannon();row.append(b);continue}
   if((isPlaceable(id)||isTossable(id))&&st.canUse){
    const b=el('button','push-chip item use'+(st.placing===id?' on':''),(st.placing===id?'Aiming · ':isTossable(id)?'Toss · ':'Place · ')+ITEMS[id].name);b.type='button'
    b.onclick=()=>st.placing===id?game.cancelPlacing():game.startPlacing(id)
    row.append(b)
   }else row.append(el('span','push-chip item',ITEMS[id].name))
  }
  p.append(row)
 }
 if((st.powers.trail||0)&&st.canUse){
  const vr=el('div','push-row');vr.append(el('span','push-label','Trail'))
  for(const v of TRAIL_VARIANTS){const b=el('button','push-chip use'+(st.trailVariant===v?' on':''),v);b.type='button';b.onclick=()=>{game.trailVariant=v};vr.append(b)}
  p.append(vr)
 }
 if(st.powder)p.append(el('div','push-h','Pop powder is on for your next shot'))
 if((st.powers.tilt||0)&&st.canUse){
  const row=el('div','push-row');row.append(el('span','push-label','Tilt'))
  for(const [dir,label] of [['up','↑'],['left','←'],['right','→'],['down','↓']]){const b=el('button','push-chip use',label);b.type='button';b.title='Tilt the table: every ball rolls '+dir;b.onclick=()=>game.requestUse('tilt',dir);row.append(b)}
  p.append(row)
 }
}
