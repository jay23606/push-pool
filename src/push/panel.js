import {POWERS,powerCost,isArmable,TRAIL_VARIANTS} from './powers.js'
import {ITEMS} from './items.js'
import {isPlaceable} from './placing.js'
import {isTossable} from './toss.js'
import {isPush} from '../rules.js'
import {renderHelp} from './help.js'

// The P.U.S.H. Pool panel: your points, powers and items, and the level-up choice when one is owed. It is plain DOM built with
// textContent (nothing from the network is ever parsed as HTML), and only rebuilt when what it shows changes, because the game
// asks for a HUD update on every frame.
//
// On a wide screen it sits beside the table. On a phone it is a slim strip (points, a button) and the controls open as a bottom
// sheet, so the table keeps the screen; the sheet opens by itself only when a level-up needs a choice, and closes again when
// you start placing or tossing something, so you can see where it is going.

const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
const isNarrow=()=>typeof matchMedia==='function'&&matchMedia('(max-width:700px)').matches
const button=(cls,text,title,onclick)=>{const b=el('button',cls,text);b.type='button';if(title)b.title=title;b.onclick=onclick;return b}

export function pushPanelState(game){
 const me=game.hotSeat?game.turn:game.me,push=game.push
 if(!push||!isPush(game.mode))return null
 const mine=push[me]
 return {me,points:game.score?.[me]||0,powers:mine.powers,items:mine.items,picks:mine.picks,
  offers:game.turn===me&&!game.spectator?push.offers:null,
  armed:game.armed||{},trailVariant:game.trailVariant||'ice',armedItem:game.armedItem||null,powder:Boolean(mine.powder),
  canMull:game.phase==='aim'&&Boolean(game.undo)&&!game.spectator&&!game.tossing,
  canUse:game.turn===me&&!game.spectator&&game.phase==='aim'&&!game.ballInHand,placing:game.placing?.item||null}
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

const setSheet=(game,open)=>{game.pushOpen=open;game.pushSig=''}      // an empty signature makes the next frame rebuild the panel

export function renderPushPanel(game){
 if(!isPush(game.mode)){if(game.pushPanel){game.pushPanel.remove();game.pushPanel=null;game.pushSig=''}return}
 const st=pushPanelState(game)
 if(!st)return
 if(!game.pushPanel){
  game.pushPanel=el('div','push-panel');game.pushPanel.setAttribute('aria-live','polite')
  const anchor=game.status;anchor.parentNode.insertBefore(game.pushPanel,anchor.nextSibling)
 }
 const narrow=isNarrow()
 // a new level-up choice opens the sheet on a phone; when the choice has been made it closes again
 if(narrow){
  const key=st.offers?st.offers.map(o=>o.id+o.level).join():null
  if(key&&key!==game.pushOffered){game.pushOffered=key;game.pushOpen=true}
  else if(!key&&game.pushOffered){game.pushOffered=null;game.pushOpen=false}
 }
 const open=narrow&&Boolean(game.pushOpen)
 const sig=JSON.stringify([st,narrow,open])
 if(sig===game.pushSig)return
 game.pushSig=sig
 const p=game.pushPanel;p.replaceChildren();p.className='push-panel'+(narrow?' narrow':'')+(open?' sheet-open':'')
 const armed=Object.entries(st.armed)

 // the strip: always there
 const top=el('div','push-top');top.append(el('div','push-pts',`${st.points} pts`))
 if(armed.length||st.armedItem||st.powder){
  const on=[...armed.map(([id,l])=>`${POWERS[id].name} ${'I'.repeat(l)}`),...(st.armedItem?['Cannon']:[]),...(st.powder?['Powder']:[])]
  top.append(el('div','push-armed',on.join(' · ')))
 }
 const tools=el('div','push-tools')
 const count=Object.keys(st.powers).length+st.items.length
 tools.append(button('push-chip use push-toggle'+(st.offers?' attn':''),st.offers?'Level up!':open?'Hide':`Powers & items${count?` (${count})`:''}`,'',()=>setSheet(game,!open)))
 tools.append(button('push-chip use','? How it works','',showHelp))
 top.append(tools);p.append(top)

 // the body: inline on a wide screen, a bottom sheet on a phone
 const body=el('div','push-body')
 body.append(button('push-chip use push-done','Done','',()=>setSheet(game,false)))
 if(st.offers){
  body.append(el('div','push-h',`Level up · choose a power${st.picks>1?` (${st.picks} owed)`:''}`))
  const row=el('div','push-offers')
  for(const o of st.offers){
   const d=POWERS[o.id],b=el('button','push-offer'),cost=powerCost(o.id,o.level)
   b.type='button';b.dataset.power=o.id
   b.append(el('b',null,`${d.name} ${'I'.repeat(o.level)}`),el('small',null,`${d.blurb} · ${cost} pts to use`))
   b.onclick=()=>game.pickPower(o.id)
   row.append(b)
  }
  body.append(row)
 }
 const owned=Object.entries(st.powers)
 if(owned.length){
  const row=el('div','push-row');row.append(el('span','push-label','Powers'))
  for(const [id,l] of owned){
   if(isArmable(id)&&st.canUse){
    const a=st.armed[id]||0,tv=id==='trail'?st.trailVariant:undefined
    row.append(button('push-chip use'+(a?' on':''),a?`${POWERS[id].name} ${'I'.repeat(a)}${tv?' '+tv:''} armed · ${powerCost(id,a,tv)}`:`${POWERS[id].name} ${'I'.repeat(l)} · ${powerCost(id,1)}`,POWERS[id].blurb,()=>game.cycleArm(id)))
   }else row.append(el('span','push-chip',`${POWERS[id].name} ${'I'.repeat(l)} · ${powerCost(id,1)}`))
  }
  body.append(row)
 }
 if(st.items.length){
  const row=el('div','push-row');row.append(el('span','push-label','Items'))
  for(const id of st.items){
   if(id==='mulligan'&&st.canMull){row.append(button('push-chip item use','Mulligan',ITEMS.mulligan.blurb,()=>game.requestUse('mulligan')));continue}
   if(id==='poppowder'&&st.canUse){row.append(button('push-chip item use','Pop powder',ITEMS.poppowder.blurb,()=>game.requestUse('poppowder')));continue}
   if(id==='cannon'&&st.canUse){row.append(button('push-chip item use'+(st.armedItem==='cannon'?' on':''),st.armedItem==='cannon'?'Cannon armed':'Cannon',ITEMS.cannon.blurb,()=>game.toggleCannon()));continue}
   if((isPlaceable(id)||isTossable(id))&&st.canUse){
    row.append(button('push-chip item use'+(st.placing===id?' on':''),(st.placing===id?'Aiming · ':isTossable(id)?'Toss · ':'Place · ')+ITEMS[id].name,ITEMS[id].blurb,
     ()=>{if(st.placing===id)game.cancelPlacing();else if(game.startPlacing(id)&&narrow)setSheet(game,false)}))     // out of the way, so the table shows
   }else row.append(el('span','push-chip item',ITEMS[id].name))
  }
  body.append(row)
 }
 if((st.powers.trail||0)&&st.canUse){
  const vr=el('div','push-row');vr.append(el('span','push-label','Trail'))
  for(const v of TRAIL_VARIANTS)vr.append(button('push-chip use'+(st.trailVariant===v?' on':''),v,'',()=>{game.trailVariant=v;game.pushSig=''}))
  body.append(vr)
 }
 if(st.powder)body.append(el('div','push-h','Pop powder is on for your next shot'))
 if((st.powers.tilt||0)&&st.canUse){
  const row=el('div','push-row');row.append(el('span','push-label','Tilt'))
  for(const [dir,label] of [['up','↑'],['left','←'],['right','→'],['down','↓']])row.append(button('push-chip use',label,'Tilt the table: every ball rolls '+dir,()=>game.requestUse('tilt',dir)))
  body.append(row)
 }
 p.append(body)
}
