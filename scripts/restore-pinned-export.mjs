import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function restorePinnedExport(directory,pin,{cache,fetchImpl=fetch}={}){
  let restored=0;
  for(const file of pin.files){
    if(!file.path.startsWith('/design/')||file.path.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('INVALID_EXPORT_PIN');
    const target=resolve(directory,'.'+file.path);
    let current;try{current=await readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(current&&sha(current)===file.sha256)continue;
    const cached=cache?resolve(cache,file.sha256+'.asset'):null;
    let bytes;
    if(cached){try{bytes=await readFile(cached);}catch(e){if(e.code!=='ENOENT')throw e;}}
    if(!bytes){const r=await fetchImpl('https://aroharetreat.com'+file.path,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('PINNED_EXPORT_UNAVAILABLE');bytes=Buffer.from(await r.arrayBuffer());}
    if(sha(bytes)!==file.sha256)throw Error('PUBLISHED_EXPORT_BYTES_CHANGED');
    if(cached){await mkdir(dirname(cached),{recursive:true});await writeFile(cached,bytes);}
    await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);restored++;
  }
  return {restoredFiles:restored,verifiedFiles:pin.files.length};
}
