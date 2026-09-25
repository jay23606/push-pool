// A 7-foot bar table is the familiar default.  The ball keeps its real-world
// 2.25-inch size, so larger tables make the ball proportionally smaller and
// leave more room for positional play.
export const W=700,H=380,M=28
export const TABLE_SIZES={7:{label:'7 ft',radius:9},8:{label:'8 ft',radius:8},9:{label:'9 ft',radius:7}}
export let tableSize=7,R=9,PR=19,MINX=M+R,MAXX=W-M-R,MINY=M+R,MAXY=H-M-R
export function setTableSize(size){
 tableSize=TABLE_SIZES[size]?Number(size):7
 R=TABLE_SIZES[tableSize].radius
 PR=R*2.1
 MINX=M+R;MAXX=W-M-R;MINY=M+R;MAXY=H-M-R
 return tableSize
}
export const POCKETS=[[M,M],[W/2,M],[W-M,M],[M,H-M],[W/2,H-M],[W-M,H-M]]
// P.U.S.H. Pool's dummy balls are flat grey; pickups have colours of their own
export const RUT_COLOR='#9b6a8f',HEAVY_COLOR='#3b3f46',LIGHT_COLOR='#f2f2ee'
export const DUMMY_COLOR='#8a8f94',GEM_COLOR='#5bd6ff',ITEM_COLOR='#ffb347'
// a dummy ball's colour by its id range: ordinary grey, light ping-pong white, heavy cannon-ball iron, rutabaga
export const dummyColor=n=>n>=190?'#9b6a8f':n>=180?'#3b3f46':n>=170?'#f2f2ee':'#8a8f94'
export const COLORS={1:'#e3c32f',2:'#2556b9',3:'#d63131',4:'#7041a7',5:'#e57922',6:'#16834b',7:'#8e2727',8:'#161616',9:'#e3c32f',10:'#2556b9',11:'#d63131',12:'#7041a7',13:'#e57922',14:'#16834b',15:'#8e2727'}
