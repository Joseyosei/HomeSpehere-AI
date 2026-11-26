import {deflateSync} from 'node:zlib';
// Generate deterministic PNG app icons without external binary assets.
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
export function iconPNG(size){
 if(![192,512].includes(size))throw Error('Unsupported icon size');
 const raw=Buffer.alloc(size*(size*3+1));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const X=x/size,Y=y/size,roof=Math.abs(X-.5)*.9+.23;
 const house=(Y>=roof&&Y<roof+.055&&X>.22&&X<.78)||(X>.30&&X<.70&&Y>.47&&Y<.76);
 const door=X>.46&&X<.55&&Y>.60&&Y<.77;
 const color=house&&!door?[122,210,176]:[16,28,27],i=y*(size*3+1)+1+x*3;raw.set(color,i);
 }
 const h=Buffer.alloc(13);h.writeUInt32BE(size,0);h.writeUInt32BE(size,4);h[8]=8;h[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
