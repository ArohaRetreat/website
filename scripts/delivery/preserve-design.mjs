import {readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {firebaseClient,hostingRelease} from "./credentials.mjs";
const stable=rows=>JSON.stringify([...rows].sort((a,b)=>a.path.localeCompare(b.path)));
export async function verifyDesignPreserved(root,{files,pin,composition,fetchImpl=fetch}={}){
  pin??=JSON.parse(await readFile(root+'config/natura-export-files.json'));
  let release;
  if(!files){
    release=await hostingRelease();const C=await firebaseClient(),client=new C({urlPrefix:"https://firebasehosting.googleapis.com",apiVersion:"v1beta1",auth:true});
    files=[];let pageToken;
    do{const r=await client.get("/"+release.version+"/files",{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}});files.push(...r.body.files);pageToken=r.body.nextPageToken;}while(pageToken);
  }
  const expected=files.filter(f=>f.path.startsWith("/design/")),actual=[];
  async function walk(directory,prefix){for(const f of await readdir(directory,{withFileTypes:true})){if(f.isSymbolicLink())throw Error("DESIGN_SYMLINK_FORBIDDEN");if(f.isDirectory())await walk(directory+"/"+f.name,prefix+f.name+"/");else actual.push(prefix+f.name);}}
  await walk(root+"dist/design","/design/");
  if(!expected.length||JSON.stringify(actual.sort())!==JSON.stringify(expected.map(f=>f.path).sort())||JSON.stringify(actual)!==JSON.stringify(pin.files.map(f=>f.path).sort()))throw Error("LIVE_DESIGN_FILE_SET_CHANGED");
  for(const f of pin.files){const raw=createHash('sha256').update(await readFile(root+'dist'+f.path)).digest('hex');if(raw!==f.sha256)throw Error('LIVE_DESIGN_BYTES_CHANGED');}
  const hashes=expected.map(({path,hash})=>({path,hash}));
  if(stable(hashes)!==stable(pin.files.map(f=>({path:f.path,hash:f.hostingHash})))){
    // Compression is runtime/platform-specific. The preceding publisher records
    // both raw pinned bytes and its actual uploader compression hashes.
    if(!composition){const r=await fetchImpl('https://aroharetreat.com/hosting-composition.json?release='+encodeURIComponent(release.version),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('LIVE_DESIGN_COMPOSITION_MISSING');composition=await r.json();}
    const raw=composition.files?.filter(f=>f.path.startsWith('design/')).map(f=>({path:'/'+f.path,sha256:f.sha256}));
    if(composition.design?.revision!==pin.revision||composition.design?.version!==pin.version||!raw||stable(raw)!==stable(pin.files.map(f=>({path:f.path,sha256:f.sha256})))||!composition.designHostingFiles||stable(composition.designHostingFiles)!==stable(hashes))throw Error('LIVE_DESIGN_HOSTING_HASH_CHANGED');
    if(release && (await hostingRelease()).version!==release.version)throw Error('CONCURRENT_HOSTING_RELEASE');
  }
  return {designFilesMatched:expected.length};
}
