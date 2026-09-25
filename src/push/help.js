import {POWERS,POWER_IDS,ARMABLE} from './powers.js'
import {ITEMS,DROPPABLE} from './items.js'
import {SPAWN_TYPES} from './spawns.js'
import {LIVE_SPAWNS} from './logic.js'
import {PUSH_TARGET,PUSH_POT,PUSH_FOUL,PUSH_GIFT} from '../rules.js'

// The rules of P.U.S.H. Pool as data, built from the same catalogues the game runs on so the help can never disagree with
// the numbers. `helpSections()` is pure; `renderHelp()` turns it into DOM (textContent only).

const HAZARD_TEXT={
 gemdrop:'Gems rain onto the table. Roll the cue ball over them to bank the points.',
 itemdrop:'An item lands on the table. Roll the cue ball over it to pick it up.',
 bonushole:'A pocket opens on a long rail, showing its reward. Sink anything in it (the cue ball too) to collect; balls come back.',
 pswitch:'A small yellow switch. Hit it with the cue ball and every dummy ball on the table turns into a gem.',
 wormhole:'Two portals: a ball that goes in one comes out of the other.',
 slick:'A patch of ice (slides on), electricity (speeds up), sand (slows) or plasma (sticks slow balls).',
 blackhole:'A gravity well that pulls balls in and swallows slow ones until it closes, then gives them back.',
 hurricane:'Dummy balls rain down across the table.',
 volcano:'A barrier that flings balls away, then spews dummy balls, fewer each turn.',
 barf:'A pocket gives back the last few balls it swallowed.'
}
const USE_TEXT={place:'place it (pick it, move over the table, Q/E or wheel to turn, click)',toss:'toss it (drag out from the cue ball and let go; it always strays a little)',shoot:'fire it as your shot',instant:'use it from the panel'}

export function helpSections(){
 const powers=POWER_IDS.map(id=>{const p=POWERS[id];return {name:p.name,text:p.blurb,detail:`levels cost ${p.levels.map(l=>l.cost).join(' / ')}${ARMABLE.includes(id)?' · arm it, then shoot':id==='jump'?' · Jump button':' · use it from the panel'}`}})
 const items=DROPPABLE.map(id=>{const i=ITEMS[id];return {name:i.name,text:i.blurb,detail:USE_TEXT[i.use]}})
 const hazards=LIVE_SPAWNS.filter(id=>SPAWN_TYPES[id]).map(id=>({name:id[0].toUpperCase()+id.slice(1),text:HAZARD_TEXT[id]||''}))
 return [
  {title:'The idea',lines:[
   `Points are your score and what powers cost. A real ball is worth ${PUSH_POT}, a dummy ball 1, a foul costs ${PUSH_FOUL}. First to ${PUSH_TARGET} wins.`,
   `Sink a real ball and you level up: pick one of three powers. Powers cost points to use, and you choose the level each time.`,
   `Items sit on the table or drop from feats: roll the cue ball over them. Use them any time on your turn; they are used up.`,
   `Grey dummy balls are harmless to the rules: hitting or sinking one is never a foul. In P.U.S.H. 8-ball the usual 8-ball rules apply too, and your own group's balls score ${PUSH_POT}; an opponent's ball you sink gifts ${PUSH_GIFT} to its owner.`]},
  {title:'Powers',rows:powers},
  {title:'Items',rows:items},
  {title:'What shows up on the table',rows:hazards},
  {title:'Feats',lines:['Sink two balls in a shot for an item, three for 20 points, or touch five different balls for 15.']}
 ]
}

const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
export function renderHelp(root){
 root.replaceChildren()
 for(const s of helpSections()){
  root.append(el('h3',null,s.title))
  for(const line of s.lines||[])root.append(el('p',null,line))
  if(s.rows){
   const ul=el('ul','help-rows')
   for(const r of s.rows){const li=el('li');li.append(el('b',null,r.name+' '),el('span',null,r.text));if(r.detail)li.append(el('small',null,' · '+r.detail));ul.append(li)}
   root.append(ul)
  }
 }
}
