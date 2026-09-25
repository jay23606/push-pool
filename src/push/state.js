import {newPlayer} from './economy.js'
import {POWERS,MAX_LEVEL} from './powers.js'
import {ITEMS} from './items.js'
import {SPAWN_TYPES} from './spawns.js'
import {SLICKS,HOLE_MAX_HELD} from './hazards.js'
import {ITEMS as ITEM_CATALOG} from './items.js'

// The P.U.S.H. part of a game's state: each player's powers, items and owed picks, the level-up offers on screen,
// and the spawns on the table. Points are not here -- they are the game's `score`, so there is one number to keep.
// This travels in the state snapshot, so a receiver validates it like any other input.

export const freshPush=()=>({a:strip(newPlayer()),b:strip(newPlayer()),offers:null,spawns:[],pickups:[],obstacles:[],turns:0})
function strip(p){const {points:_points,...rest}=p;return rest}  

const fin=n=>typeof n==='number'&&Number.isFinite(n)
const validPlayer=p=>p&&typeof p==='object'&&Number.isInteger(p.picks)&&p.picks>=0&&p.picks<=99
 &&p.powers&&typeof p.powers==='object'&&Object.entries(p.powers).every(([id,l])=>POWERS[id]&&Number.isInteger(l)&&l>=1&&l<=MAX_LEVEL)
 &&Array.isArray(p.items)&&p.items.length<=99&&p.items.every(id=>ITEMS[id])&&(p.powder===undefined||typeof p.powder==='boolean')
const validOffer=o=>o&&typeof o==='object'&&POWERS[o.id]&&Number.isInteger(o.level)&&o.level>=1&&o.level<=MAX_LEVEL
const validSpawn=s=>s&&typeof s==='object'&&SPAWN_TYPES[s.type]&&Number.isInteger(s.ttl)&&s.ttl>=0&&s.ttl<=9
 &&['x','y'].every(k=>s[k]===undefined||fin(s[k]))

const validPickup=k=>k&&typeof k==='object'&&fin(k.x)&&fin(k.y)&&Number.isInteger(k.ttl)&&k.ttl>=0&&k.ttl<=9
 &&(k.kind==='gem'?Number.isInteger(k.v)&&k.v>=1&&k.v<=99:k.kind==='item'&&Boolean(ITEMS[k.id]))

const validObstacle=o=>o&&typeof o==='object'&&Number.isInteger(o.ttl)&&o.ttl>=0&&o.ttl<=12&&(
 (o.t==='bumper'||o.t==='mine'||o.t==='smoke'||o.t==='pit')?['x','y','r'].every(k=>fin(o[k]))&&(o.vol===undefined||Number.isInteger(o.vol)&&o.vol>=0&&o.vol<=9)&&(o.piggy===undefined||Number.isInteger(o.piggy)&&o.piggy>=0&&o.piggy<=99):
 o.t==='fan'?['x','y','r','rot'].every(k=>fin(o[k])):
 o.t==='wall'?['x1','y1','x2','y2'].every(k=>fin(o[k])):
 o.t==='portal'?['x','y','r'].every(k=>fin(o[k]))&&Array.isArray(o.to)&&o.to.length===2&&o.to.every(fin):
 o.t==='slick'?['x','y','r'].every(k=>fin(o[k]))&&SLICKS.includes(o.variant):
 o.t==='pswitch'?['x','y','r'].every(k=>fin(o[k])):
 o.t==='bonushole'?['x','y','r'].every(k=>fin(o[k]))&&Boolean(o.reward)&&typeof o.reward==='object'&&(o.reward.item?Boolean(ITEM_CATALOG[o.reward.item]):Number.isInteger(o.reward.gems)&&o.reward.gems>=1&&o.reward.gems<=99):
 o.t==='blackhole'&&['x','y','r'].every(k=>fin(o[k]))&&Array.isArray(o.held)&&o.held.length<=HOLE_MAX_HELD&&o.held.every(n=>Number.isInteger(n)&&n>=0&&n<=15))

export function validPush(p){
 if(p===undefined||p===null)return true
 return typeof p==='object'&&validPlayer(p.a)&&validPlayer(p.b)&&Number.isInteger(p.turns)&&p.turns>=0
  &&(p.offers===null||(Array.isArray(p.offers)&&p.offers.length<=6&&p.offers.every(validOffer)))
  &&Array.isArray(p.spawns)&&p.spawns.length<=12&&p.spawns.every(validSpawn)
  &&(p.pickups===undefined||Array.isArray(p.pickups)&&p.pickups.length<=40&&p.pickups.every(validPickup))
  &&(p.obstacles===undefined||Array.isArray(p.obstacles)&&p.obstacles.length<=60&&p.obstacles.every(validObstacle))
}
