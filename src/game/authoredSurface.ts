import * as THREE from 'three';
export function authoredSurface(key:string, repeat=1, color=true) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
 let seed=Array.from(key).reduce((n,v)=>n+v.charCodeAt(0)*37,11);const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const normal=/normal/.test(key)||!color;c.fillStyle=normal?'#8080ff':/rock|stone|cobble/.test(key)?'#9c9291':/wood|bark/.test(key)?'#695050':/sand|dirt|ground/.test(key)?'#b77d63':'#a59390';c.fillRect(0,0,128,128);
 for(let n=0;n<1600;n++){c.fillStyle=normal?`rgba(128,128,255,${rnd()*.1})`:`rgba(${rnd()>.5?'240,215,183':'53,40,53'},${rnd()*.15})`;c.fillRect(rnd()*128,rnd()*128,1+rnd()*5,1+rnd()*3);}
 if(!normal&&/stone|cobble|plaster|wood/.test(key)){c.strokeStyle='#473b4855';c.lineWidth=1;for(let y=0;y<128;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke();for(let x=(y%48)/2;x<128;x+=32){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+24);c.stroke();}}}
 const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
