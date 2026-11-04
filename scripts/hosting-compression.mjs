import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {createGzip} from "node:zlib";
import {pipeline} from "node:stream/promises";
export async function hostingHashes(directory,paths){
  const rows=[];
  for(const path of paths){
    if(!path.startsWith('/design/')||path.split('/').includes('..'))throw Error('INVALID_DESIGN_PATH');
    const hash=createHash('sha256');await pipeline(createReadStream(directory+path),createGzip({level:9}),hash);
    rows.push({path,hash:hash.digest('hex')});
  }
  return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
