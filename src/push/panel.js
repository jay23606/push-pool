import {POWERS,powerCost} from './powers.js'
import {ITEMS} from './items.js'

// The P.U.S.H. Pool side panel: your points, powers and items, and the level-up choice when one is owed. It is plain DOM
// built with textContent (nothing from the network is ever parsed as HTML), and only rebuilt when what it shows changes,
// because the game asks for a HUD update on every frame.

const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}

export function pushPanelState(game){
 const me=game.hotSeat?game.turn:game.me,push=game.push
 if(!push||game.mode!=='push')return null
 const mine=push[me]
 return {me,points:game.score?.[me]||0,powers:mine.powers,items:mine.items,picks:mine.picks,
  offers:game.turn===me&&!game.spectator?push.offers:null}
}

export function renderPushPanel(game){
 if(game.mode!=='push'){if(game.pushPanel){game.pushPanel.remove();game.pushPanel=null;game.pushSig=''}return}
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
 p.append(el('div','push-pts',`${st.points} pts`))
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
  for(const [id,l] of owned)row.append(el('span','push-chip',`${POWERS[id].name} ${'I'.repeat(l)} · ${powerCost(id,1)}`))
  p.append(row)
 }
 if(st.items.length){
  const row=el('div','push-row');row.append(el('span','push-label','Items'))
  for(const id of st.items)row.append(el('span','push-chip item',ITEMS[id].name))
  p.append(row)
 }
}
