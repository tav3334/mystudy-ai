export function validateOfficeZip(buffer: Buffer) {
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0)
    throw new Error("Format non pris en charge : archive Office invalide.");
  const entries = buffer.readUInt16LE(end + 10);
  const offset = buffer.readUInt32LE(end + 16);
  if (entries === 65535 || entries > 3000 || offset === 0xffffffff)
    throw new Error("Document trop volumineux après décompression.");
  let current = offset;
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (
      current + 46 > buffer.length ||
      buffer.readUInt32LE(current) !== 0x02014b50
    )
      throw new Error("Format non pris en charge : archive Office invalide.");
    const size = buffer.readUInt32LE(current + 24);
    total += size;
    if (size > 12 * 1024 * 1024 || total > 40 * 1024 * 1024)
      throw new Error("Document trop volumineux après décompression.");
    const nameLength = buffer.readUInt16LE(current + 28);
    const extraLength = buffer.readUInt16LE(current + 30);
    const commentLength = buffer.readUInt16LE(current + 32);
    current += 46 + nameLength + extraLength + commentLength;
  }
}
