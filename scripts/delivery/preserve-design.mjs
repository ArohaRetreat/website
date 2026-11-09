import {readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {firebaseClient,hostingRelease} from "./credentials.mjs";
import {naturaMediaReceipt} from "../natura-media.mjs";
const stable=rows=>JSON.stringify([...rows].sort((a,b)=>a.path.localeCompare(b.path)));
export async function verifyDesignPreserved(root,{files,pin,composition,layout,fetchImpl=fetch}={}){
  pin??=JSON.parse(await readFile(root+'config/natura-export-files.json'));
  let release, client;
  if(!files){
    release=await hostingRelease();const C=await firebaseClient();
    client=new C({urlPrefix:"https://firebasehosting.googleapis.com",apiVersion:"v1beta1",auth:true});
    files=[];let pageToken;
    do{const r=await client.get("/"+release.version+"/files",{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}});files.push(...r.body.files);pageToken=r.body.nextPageToken;}while(pageToken);
  }
  const expected=files.filter(f=>f.path.startsWith("/design/")),actual=[];
  const artifactFiles = layout?.shell || pin.files;
  const liveOffloaded = !!layout && expected.length === layout.shell.length;
  const liveFiles = liveOffloaded ? layout.shell : pin.files;
  async function walk(directory,prefix){for(const f of await readdir(directory,{withFileTypes:true})){if(f.isSymbolicLink())throw Error("DESIGN_SYMLINK_FORBIDDEN");if(f.isDirectory())await walk(directory+"/"+f.name,prefix+f.name+"/");else actual.push(prefix+f.name);}}
  await walk(root+"dist/design","/design/");
  if(!expected.length ||
      JSON.stringify(expected.map(f=>f.path).sort())!==JSON.stringify(liveFiles.map(f=>f.path).sort()) ||
      JSON.stringify(actual.sort())!==JSON.stringify(artifactFiles.map(f=>f.path).sort()))
    throw Error("LIVE_DESIGN_FILE_SET_CHANGED");
  for(const f of artifactFiles){const raw=createHash('sha256').update(await readFile(root+'dist'+f.path)).digest('hex');if(raw!==f.sha256)throw Error('LIVE_DESIGN_BYTES_CHANGED');}
  const hashes=expected.map(({path,hash})=>({path,hash}));
  if(liveOffloaded || stable(hashes)!==stable(liveFiles.map(f=>({path:f.path,hash:f.hostingHash})))){
    // Compression is runtime/platform-specific. The preceding publisher records
    // both raw pinned bytes and its actual uploader compression hashes.
    if(!composition){const r=await fetchImpl('https://aroharetreat.com/hosting-composition.json?release='+encodeURIComponent(release.version),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('LIVE_DESIGN_COMPOSITION_MISSING');composition=await r.json();}
    const raw=composition.files?.filter(f=>f.path.startsWith('design/')).map(f=>({path:'/'+f.path,sha256:f.sha256}));
    if(composition.design?.revision!==pin.revision||composition.design?.version!==pin.version||!raw||stable(raw)!==stable(liveFiles.map(f=>({path:f.path,sha256:f.sha256})))||!composition.designHostingFiles||stable(composition.designHostingFiles)!==stable(hashes))throw Error('LIVE_DESIGN_HOSTING_HASH_CHANGED');
    if (liveOffloaded) {
      const receipt = naturaMediaReceipt(layout);
      if (composition.designMedia?.files !== receipt.files || composition.designMedia?.sha256 !== receipt.sha256)
        throw Error("LIVE_NATURA_MEDIA_PIN_CHANGED");
      if (release) {
        const version = (await client.get("/" + release.version)).body;
        const redirects = (version.config?.redirects || []).filter(rule => (rule.glob ?? rule.source)?.startsWith("/design/"))
          .map(rule => ({ source: rule.glob ?? rule.source, destination: rule.location ?? rule.destination, type: rule.statusCode ?? rule.type }));
        if (JSON.stringify(redirects) !== JSON.stringify(layout.redirects))
          throw Error("LIVE_NATURA_REDIRECTS_CHANGED");
      }
    }
  }
  if (release && (await hostingRelease()).version !== release.version)
    throw Error("CONCURRENT_HOSTING_RELEASE");
  return {designFilesMatched:expected.length};
}
