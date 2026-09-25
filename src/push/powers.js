// P.U.S.H. Pool powers: bought with points during your own turn, unlocked by sinking one of your own game balls.
// Pure data. A power has levels; each level has a point cost and the numbers the effect uses, and the player picks
// which level to spend on each use. `when` is 'before' or 'after' the shot, or 'either'.

const lv=(costs,key,values)=>costs.map((cost,i)=>({cost,[key]:values[i]}))

export const POWERS={
 tilt:  {name:'Tilt',  when:'before',blurb:'Lift the table on one side; every ball shifts the other way.',levels:lv([30,55,90],'shift',[6,12,20])},
 trail: {name:'Trail', when:'before',blurb:'The cue ball leaves an effect zone that lasts through the next shot.',levels:lv([25,45,75],'length',[80,160,260]),
  variants:{ice:1,electric:1,sand:1,plasma:2,stone:3}},   // a variant's cost multiplier: plasma and stone cost more
 guide: {name:'Guide', when:'before',blurb:'Show a longer shot guide.',levels:lv([5,10,18],'length',[1,2,3])},
 pop:   {name:'Pop',   when:'before',blurb:'The cue ball explodes on each collision.',levels:lv([25,45,75],'force',[200,400,700])},
 jump:  {name:'Jump',  when:'before',blurb:'Hop the cue ball over nearby objects.',levels:lv([6,12,20],'height',[1,2,3])},
 spin:  {name:'Spin',  when:'before',blurb:'Put extra spin on the shot.',levels:lv([5,10,18],'amount',[.4,.7,1])},
 stink: {name:'Stink', when:'before',blurb:'The cue ball repels other balls; you need a direct hit.',levels:lv([20,38,65],'force',[150,300,500])},
 cute:  {name:'Cute',  when:'before',blurb:'The cue ball pulls other balls toward it.',levels:lv([20,38,65],'force',[150,300,500])},
 nudge: {name:'Nudge', when:'before',blurb:'A small tap of the cue ball instead of a shot; it can swing a game.',levels:lv([40,70,110],'reach',[1,2,3])}
}
// The powers you switch on before a shot, and pay for when you take it. Each has a working effect in the game;
// the rest of the catalogue is still being built. (Jump has its own button.)
export const ARMABLE=['pop','stink','cute','nudge','trail','guide','spin']
// The trail: the cue ball drops a patch every TRAIL_STEP units, up to the level's length, and the patches last two turns.
export const TRAIL_VARIANTS=['ice','electric','sand','plasma','stone']
export const TRAIL_STEP=14,TRAIL_R=16,TRAIL_LIFE=2,TRAIL_MAX=20
export const TILT_IMPULSE=4          // a tilt of level shift n gives every ball n * this much speed
export const NUDGE_POWER=4           // nudge levels tap the cue ball at this many percent power per level
export const CANNON_MASS=5
export const CANNON_MULT=1.7         // a cannon shot is this much harder than the hardest ordinary one
export const POWDER_POPS=12,POWDER_RADIUS_R=3,POWDER_FORCE=260
export const isArmable=id=>ARMABLE.includes(id)
export const FIELD_RADIUS=70          // how far a stink or cute cue ball reaches
export const POP_RADIUS_R=4            // a pop is a small blast: this many ball radii
export const MAX_POPS=6                // per shot, so a long cascade cannot run away

export const POWER_IDS=Object.keys(POWERS)
export const MAX_LEVEL=3

export const powerCost=(id,level,variant)=>{
 const p=POWERS[id];if(!p||!p.levels[level-1])return null
 const base=p.levels[level-1].cost
 if(variant==null)return base
 const mult=p.variants?.[variant];return mult?base*mult:null
}
export const powerLevel=(id,level)=>POWERS[id]?.levels[level-1]||null
