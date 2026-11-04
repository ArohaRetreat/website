import {createReadStream} from "node:fs";
import {readdir} from "node:fs/promises";
import {createGzip} from "node:zlib";
import {createHash} from "node:crypto";
import {pipeline} from "node:stream/promises";
import {firebaseClient,hostingRelease} from "./credentials.mjs";
export async function verifyDesignPreserved(root,{files}={}){
  if(!files){
    const release=await hostingRelease(),C=await firebaseClient(),client=new C({urlPrefix:"https://firebasehosting.googleapis.com",apiVersion:"v1beta1",auth:true});
    files=[];let pageToken;
    do{const r=await client.get("/"+release.version+"/files",{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}});files.push(...r.body.files);pageToken=r.body.nextPageToken;}while(pageToken);
  }
  const expected=files.filter(f=>f.path.startsWith("/design/"));
  const actual=[];
  async function walk(directory,prefix){for(const f of await readdir(directory,{withFileTypes:true})){if(f.isSymbolicLink())throw Error("DESIGN_SYMLINK_FORBIDDEN");if(f.isDirectory())await walk(directory+"/"+f.name,prefix+f.name+"/");else actual.push(prefix+f.name);}}
  await walk(root+"dist/design","/design/");
  if(!expected.length||JSON.stringify(actual.sort())!==JSON.stringify(expected.map(f=>f.path).sort()))throw Error("LIVE_DESIGN_FILE_SET_CHANGED");
  for(const f of expected){const hash=createHash("sha256");await pipeline(createReadStream(root+"dist"+f.path),createGzip({level:9}),hash);if(hash.digest("hex")!==f.hash)throw Error("LIVE_DESIGN_BYTES_CHANGED");}
  return {designFilesMatched:expected.length};
}
