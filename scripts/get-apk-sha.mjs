// Extract SHA-1 and SHA-256 signing certificate fingerprints from an APK
// by parsing the v2+ APK Signing Block directly.
//
// APK Signing Block format (at end of APK, before ZIP EOCD):
//   uint64 sizeOfBlock (excl. this field)
//   sequence of ID-VALUE pairs:
//     uint64 pairSize
//     uint32 ID  (0x7109871a = v2, 0xf05368c0 = v3, 0x1b93ad61 = v3.1)
//     bytes[pairSize - 4] value
//   uint64 sizeOfBlock (same as above)
//   bytes[16] magic "APK Sig Block 42"

import fs from "node:fs";
import crypto from "node:crypto";

const apkPath = process.argv[2] || "./app-preview.apk";
const data = fs.readFileSync(apkPath);

// Locate EOCD (End of Central Directory): signature 0x06054b50, searching from the end
function findEOCD(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("EOCD not found");
}

const eocdOffset = findEOCD(data);
const centralDirOffset = data.readUInt32LE(eocdOffset + 16);

// APK signing block magic is right before the central directory
const magic = "APK Sig Block 42";
const magicStart = centralDirOffset - 16;
const magicRead = data.slice(magicStart, magicStart + 16).toString("utf8");
if (magicRead !== magic) {
  throw new Error(`APK Signing Block magic not found (got: ${JSON.stringify(magicRead)})`);
}

// Block size is stored in the 8 bytes before magic
const blockSize = Number(data.readBigUInt64LE(centralDirOffset - 24));
const blockStart = centralDirOffset - blockSize - 8; // size field itself is 8 bytes
// actually blockStart = centralDirOffset - (blockSize + 8), and signing block spans from blockStart to centralDirOffset

// Inside, there's another size field at the start
const innerSize = Number(data.readBigUInt64LE(blockStart));
if (innerSize !== blockSize) {
  // Can still try to parse
}

// Parse ID-VALUE pairs starting at blockStart + 8
let ptr = blockStart + 8;
const blockEnd = centralDirOffset - 24; // just before trailing size + magic

const V2_ID = 0x7109871a;
const V3_ID = 0xf05368c0;

let signedData = null;
let foundScheme = null;
while (ptr + 12 <= blockEnd) {
  const pairSize = Number(data.readBigUInt64LE(ptr));
  const id = data.readUInt32LE(ptr + 8);
  const valStart = ptr + 12;
  const valEnd = ptr + 8 + pairSize;
  if (id === V3_ID || id === V2_ID) {
    signedData = data.slice(valStart, valEnd);
    foundScheme = id === V3_ID ? "v3" : "v2";
    if (id === V3_ID) break; // prefer v3
  }
  ptr = valEnd;
}

if (!signedData) throw new Error("No v2/v3 signing block found");
console.log(`Using APK signing scheme: ${foundScheme}`);

// v2/v3 signingBlock value = length-prefixed sequence of signers
// Each signer:
//   length-prefixed signed-data:
//     length-prefixed digests
//     length-prefixed certificates (sequence of length-prefixed X.509 DER certs)
//     length-prefixed additional attributes
//   [v3 only: minSDK (4), maxSDK (4)]
//   length-prefixed signatures
//   length-prefixed publicKey

// Helper: read length-prefixed (uint32 LE) sub-buffer
function readLP(buf, offset) {
  const len = buf.readUInt32LE(offset);
  return { data: buf.slice(offset + 4, offset + 4 + len), next: offset + 4 + len };
}

// Enter outer signers sequence
const outerSigners = readLP(signedData, 0).data;
const firstSigner = readLP(outerSigners, 0).data;
const signerSignedData = readLP(firstSigner, 0).data;

// signedData: digests (LP) + certs (LP) + attrs (LP)
const digests = readLP(signerSignedData, 0);
const certsSection = readLP(signerSignedData, digests.next);

// certsSection is a sequence of LP certs
let certPtr = 0;
const certsBuf = certsSection.data;
const certs = [];
while (certPtr + 4 <= certsBuf.length) {
  const certLen = certsBuf.readUInt32LE(certPtr);
  certs.push(certsBuf.slice(certPtr + 4, certPtr + 4 + certLen));
  certPtr += 4 + certLen;
}

console.log(`Found ${certs.length} cert(s) in signed data\n`);

certs.forEach((certDer, i) => {
  const cert = new crypto.X509Certificate(certDer);
  console.log(`=== Certificate #${i + 1} ===`);
  console.log(`Subject: ${cert.subject.replace(/\n/g, ", ")}`);
  console.log(`Issuer:  ${cert.issuer.replace(/\n/g, ", ")}`);
  console.log(`Valid:   ${cert.validFrom}  →  ${cert.validTo}`);
  console.log("");
  console.log(`SHA-1:   ${cert.fingerprint}`);
  console.log(`SHA-256: ${cert.fingerprint256}`);
  const md5 = crypto.createHash("md5").update(certDer).digest("hex").toUpperCase().match(/.{2}/g).join(":");
  console.log(`MD5:     ${md5}`);
});
