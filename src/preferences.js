import {TABLE_SIZES} from './table.js'

import {FELTS as PALETTE,CUE_STYLES,RAIL_STYLES,DEFAULTS} from './cosmetics.js'
import {HEIGHT as DEFAULT_EYE,MIN_EYE,MAX_EYE} from './shot-cam.js'

export const FELTS=PALETTE
export const TABLE_PREF_DEFAULTS={size:7,felt:FELTS[DEFAULTS.felt],cue:DEFAULTS.cue,rails:DEFAULTS.rails,lighting:'hall',aimSensitivity:.3,shotCam:true,snap:true,eyeHeight:DEFAULT_EYE}
const CUES=new Set(Object.keys(CUE_STYLES)),RAILS=new Set(Object.keys(RAIL_STYLES)),LIGHTING=new Set(['hall','warm','cool'])
const get=(storage,key)=>{try{return storage?.getItem(key)}catch{return null}}
const put=(storage,key,value)=>{try{storage?.setItem(key,value)}catch{}}

// Keep user-controlled cosmetics in one validated boundary. Old or malformed
// localStorage values must never make renderer setup fail.
export function loadTablePrefs(storage=globalThis.localStorage){
 const size=Number(get(storage,'push-pool:table-size'))
 const felt=get(storage,'push-pool:felt'),cue=get(storage,'push-pool:cue'),lighting=get(storage,'push-pool:lighting'),rails=get(storage,'push-pool:rails'),aimSensitivity=Number(get(storage,'push-pool:aim-sensitivity')),eyeHeight=Number(get(storage,'push-pool:eye-height'))
 return {size:TABLE_SIZES[size]?size:TABLE_PREF_DEFAULTS.size,
  felt:Object.values(FELTS).includes(felt)?felt:TABLE_PREF_DEFAULTS.felt,
  cue:CUES.has(cue)?cue:TABLE_PREF_DEFAULTS.cue,
  rails:RAILS.has(rails)?rails:TABLE_PREF_DEFAULTS.rails,
  lighting:LIGHTING.has(lighting)?lighting:TABLE_PREF_DEFAULTS.lighting,
  aimSensitivity:aimSensitivity>=.1&&aimSensitivity<=1?aimSensitivity:TABLE_PREF_DEFAULTS.aimSensitivity,
  shotCam:get(storage,'push-pool:shot-cam')!=='0',
  snap:get(storage,'push-pool:snap-aim')!=='0',
  eyeHeight:eyeHeight>=MIN_EYE&&eyeHeight<=MAX_EYE?eyeHeight:TABLE_PREF_DEFAULTS.eyeHeight}
}
export function saveTablePrefs(prefs,storage=globalThis.localStorage){
 const clean=loadTablePrefs({getItem:key=>({
  'push-pool:table-size':String(prefs.size),'push-pool:felt':prefs.felt,
  'push-pool:cue':prefs.cue,'push-pool:rails':prefs.rails,'push-pool:lighting':prefs.lighting,'push-pool:aim-sensitivity':prefs.aimSensitivity,'push-pool:shot-cam':prefs.shotCam===false?'0':'1','push-pool:snap-aim':prefs.snap===false?'0':'1','push-pool:eye-height':prefs.eyeHeight}[key]??null)})
 put(storage,'push-pool:table-size',clean.size);put(storage,'push-pool:felt',clean.felt);put(storage,'push-pool:cue',clean.cue);put(storage,'push-pool:rails',clean.rails);put(storage,'push-pool:lighting',clean.lighting);put(storage,'push-pool:aim-sensitivity',clean.aimSensitivity);put(storage,'push-pool:shot-cam',clean.shotCam?'1':'0');put(storage,'push-pool:snap-aim',clean.snap?'1':'0');put(storage,'push-pool:eye-height',clean.eyeHeight)
 return clean
}
