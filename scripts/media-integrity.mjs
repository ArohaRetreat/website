import { open, readdir } from "node:fs/promises";
export async function verifyMp4(file) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    let offset = 0;
    const atoms = new Set();
    while (offset < size) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) throw Error("INVALID_MP4_CONTAINER");
      let length = header.readUInt32BE(0),
        headerSize = 8;
      const type = header.toString("ascii", 4, 8);
      if (length === 1) {
        if (bytesRead < 16) throw Error("INVALID_MP4_CONTAINER");
        const n = header.readBigUInt64BE(8);
        if (n > BigInt(Number.MAX_SAFE_INTEGER))
          throw Error("INVALID_MP4_CONTAINER");
        length = Number(n);
        headerSize = 16;
      }
      if (length === 0) length = size - offset;
      if (
        length < headerSize ||
        offset + length > size ||
        !/^[\x20-\x7e]{4}$/.test(type)
      )
        throw Error("INVALID_MP4_CONTAINER");
      if (type === "ftyp" && offset !== 0) throw Error("INVALID_MP4_CONTAINER");
      if (type === "mdat" && length < 1024)
        throw Error("INVALID_MP4_CONTAINER");
      atoms.add(type);
      offset += length;
    }
    if (!["ftyp", "moov", "mdat"].every((t) => atoms.has(t)))
      throw Error("INVALID_MP4_CONTAINER");
    return { bytes: size };
  } finally {
    await handle.close();
  }
}
export async function verifyBundledFilms(directory) {
  const films = (await readdir(directory)).filter((name) =>
    name.endsWith(".mp4"),
  );
  for (const name of films) await verifyMp4(new URL(name, directory));
  return films.length;
}
