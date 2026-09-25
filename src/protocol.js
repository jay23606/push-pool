import {validPush} from './push/state.js'
import {POWERS,TRAIL_VARIANTS} from './push/powers.js'
const groups=new Set(['cue','solid','stripe','eight'])
const phase=new Set(['aim','roll'])
const player=new Set(['a','b'])
const finite=n=>typeof n==='number'&&Number.isFinite(n)
const RACK_SIZE={'8ball':16,'9ball':10,'10ball':11,bank:16,onepocket:16,straight:16,chaos:16,push:16}
const MAX_DUMMIES=60
const TWIST_TYPES=new Set(['bonus','bomb','well'])
// a twist is a small record of numbers; anything else is refused
const validTwist=t=>t===undefined||t===null||(typeof t==='object'&&TWIST_TYPES.has(t.type)&&['x','y','n','r'].every(k=>t[k]===undefined||finite(t[k]))&&(t.spent===undefined||typeof t.spent==='boolean'))
// the powers armed on a shot: a few known ids with a level from one to three
const validArmed=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length<=9&&Object.entries(p).every(([id,l])=>POWERS[id]&&Number.isInteger(l)&&l>=1&&l<=3)
const TOP_BALL={'9ball':9,'10ball':10}
const expectedGroup=n=>n===0?'cue':n===8?'eight':n<8?'solid':'stripe'

export function isGameMessage(m){
 if(!m||typeof m!=='object'||typeof m.t!=='string')return false
 if(m.t==='next-rack')return true
 if(m.t==='use')return typeof m.id==='string'&&m.id.length<=20&&(m.arg===undefined||typeof m.arg==='string'&&m.arg.length<=10)
 if(m.t==='toss')return typeof m.item==='string'&&m.item.length<=20&&finite(m.x)&&finite(m.y)
 if(m.t==='place')return typeof m.item==='string'&&m.item.length<=20&&finite(m.x)&&finite(m.y)&&finite(m.rot)
 if(m.t==='pick')return typeof m.id==='string'&&m.id.length<=20
 if(m.t==='table')return finite(m.size)&&typeof m.felt==='string'
 if(m.t==='shot')return finite(m.vx)&&finite(m.vy)&&(!m.spin||Array.isArray(m.spin)&&m.spin.every(finite))&&(m.jump===undefined||typeof m.jump==='boolean')&&(m.powers===undefined||validArmed(m.powers))&&(m.cannon===undefined||typeof m.cannon==='boolean')&&(m.tv===undefined||TRAIL_VARIANTS.includes(m.tv))
 if(m.t!=='state'||!Array.isArray(m.b)||!player.has(m.turn)||!phase.has(m.phase)||!Number.isInteger(m.round))return false
 // A ball tuple is either the plain v1 shape (position only) or the v2 shape
 // with five more finite fields appended (velocity and spin) -- accepting
 // both means a tab still running the old build a moment after a deploy
 // degrades to no local prediction rather than dropping every state message.
 const validBall=b=>Array.isArray(b)&&(b.length===5||b.length===10||b.length===12)&&finite(b[0])&&finite(b[1])&&typeof b[2]==='boolean'&&Number.isInteger(b[4])&&(b[3]==='dummy'?b[4]>=100&&b[4]<=199:groups.has(b[3])&&b[4]>=0&&b[4]<=15&&b[3]===expectedGroup(b[4]))&&(b.length===5||b.slice(5).every(finite))
 // A snapshot without a mode is from before nine-ball existed: an 8-ball rack.
 const mode=m.mode===undefined?'8ball':m.mode,size=RACK_SIZE[mode]
 if(!size)return false
 if(!m.b.every(validBall))return false
 // P.U.S.H. Pool adds grey dummy balls (numbered 100 up) to the sixteen real ones; no other game has them
 const dummies=m.b.filter(b=>b[3]==='dummy').length
 if(dummies&&(mode!=='push'||dummies>MAX_DUMMIES))return false
 if(m.b.length-dummies!==size||new Set(m.b.map(b=>b[4])).size!==m.b.length)return false
 if(TOP_BALL[mode]&&!m.b.every(b=>b[4]<=TOP_BALL[mode]))return false   // nine-ball is balls 0-9, ten-ball 0-10
 if(!validTwist(m.fx))return false
 if(!validPush(m.push))return false
 // the score of a scored game: two small whole numbers, and absent before those games existed
 if(m.score!==undefined&&!(m.score&&typeof m.score==='object'&&['a','b'].every(p=>Number.isInteger(m.score[p])&&m.score[p]>=-99&&m.score[p]<=999)))return false
 return m.groups&&['a','b'].every(p=>m.groups[p]===null||m.groups[p]==='solid'||m.groups[p]==='stripe')
}

export function parseGameMessage(raw){
 try{const m=JSON.parse(raw);return isGameMessage(m)?m:null}catch{return null}
}
