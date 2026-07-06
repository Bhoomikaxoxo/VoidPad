import 'dotenv/config';
import { hashKey } from './utils/hashing.js';
import { validateFile } from './utils/fileValidator.js';
import assert from 'assert';

async function runTests() {
  console.log('--- STARTING VOID PAD UTILITIES VERIFICATION ---');

  // Test 1: Deterministic Hashing
  console.log('\n[Test 1] Deterministic Hashing...');
  const key = 'secureKey123!';
  const hash1 = await hashKey(key);
  const hash2 = await hashKey(key);
  
  console.log(`Key:  "${key}"`);
  console.log(`Hash1: ${hash1}`);
  console.log(`Hash2: ${hash2}`);
  
  assert.strictEqual(hash1, hash2, 'Error: Hashing is not deterministic!');
  console.log('✓ Success: Deterministic key hashing verified.');

  // Test 2: File Validator Magic Bytes and Limits
  console.log('\n[Test 2] File Validator (Size & Magic Bytes)...');

  // Helper to construct a mock multer file
  const makeMockFile = (name, size, buffer) => ({
    originalname: name,
    size,
    buffer
  });

  // A. Check safe PNG (89 50 4E 47 0D 0A 1A 0A)
  const pngFile = makeMockFile('avatar.png', 1000, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0]));
  const resPng = validateFile(pngFile);
  console.log('avatar.png check:', resPng);
  assert.strictEqual(resPng.valid, true);
  assert.strictEqual(resPng.mimeType, 'image/png');

  // B. Check safe PDF (%PDF- / 25 50 44 46)
  const pdfFile = makeMockFile('invoice.pdf', 2000, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x31, 0x2E, 0x34]));
  const resPdf = validateFile(pdfFile);
  console.log('invoice.pdf check:', resPdf);
  assert.strictEqual(resPdf.valid, true);
  assert.strictEqual(resPdf.mimeType, 'application/pdf');

  // C. Check blocked Windows EXE (MZ / 4D 5A)
  const exeFile = makeMockFile('malware.png', 500, Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])); // masquerading as .png!
  const resExe = validateFile(exeFile);
  console.log('malware.png (EXE disguised) check:', resExe);
  assert.strictEqual(resExe.valid, false);
  assert.ok(resExe.error.includes('executable content detected'));

  // D. Check blocked ELF Linux binary (7F 45 4C 46)
  const elfFile = makeMockFile('script.sh', 300, Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x01, 0x01, 0x01]));
  const resElf = validateFile(elfFile);
  console.log('script.sh (ELF binary) check:', resElf);
  assert.strictEqual(resElf.valid, false);
  assert.ok(resElf.error.includes('executable content detected'));

  // E. Check blocked Java class file (CA FE BA BE)
  const classFile = makeMockFile('App.class', 400, Buffer.from([0xCA, 0xFE, 0xBA, 0xBE, 0x00, 0x03]));
  const resClass = validateFile(classFile);
  console.log('App.class check:', resClass);
  assert.strictEqual(resClass.valid, false);
  assert.ok(resClass.error.includes('executable content detected'));

  // F. Check safe plain text (.txt)
  const txtFile = makeMockFile('notes.txt', 20, Buffer.from('Hello world! This is a test note.', 'utf-8'));
  const resTxt = validateFile(txtFile);
  console.log('notes.txt check:', resTxt);
  assert.strictEqual(resTxt.valid, true);
  assert.strictEqual(resTxt.mimeType, 'text/plain');

  // G. Check blocked text file containing binary null bytes
  const badTxtFile = makeMockFile('data.txt', 50, Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0x42, 0x61, 0x64])); // Null byte embedded
  const resBadTxt = validateFile(badTxtFile);
  console.log('data.txt (binary text) check:', resBadTxt);
  assert.strictEqual(resBadTxt.valid, false);
  assert.ok(resBadTxt.error.includes('binary content detected'));

  // H. Check safe ZIP / DOCX (PK\x03\x04 / 50 4B 03 04)
  const docxFile = makeMockFile('proposal.docx', 5000, Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]));
  const resDocx = validateFile(docxFile);
  console.log('proposal.docx check:', resDocx);
  assert.strictEqual(resDocx.valid, true);
  assert.strictEqual(resDocx.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // I. Check size limit enforcement (> 5MB)
  const hugeFile = makeMockFile('large.zip', 6 * 1024 * 1024, Buffer.from([0x50, 0x4B, 0x03, 0x04])); // 6MB
  const resHuge = validateFile(hugeFile);
  console.log('large.zip (6MB) check:', resHuge);
  assert.strictEqual(resHuge.valid, false);
  assert.ok(resHuge.error.includes('exceeds the 5MB limit'));

  // J. Check file type not in allow-list
  const unknownFile = makeMockFile('audio.mp3', 1000, Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00])); // MP3 signature
  const resUnknown = validateFile(unknownFile);
  console.log('audio.mp3 check:', resUnknown);
  assert.strictEqual(resUnknown.valid, false);
  assert.ok(resUnknown.error.includes('not in allow-list'));

  console.log('✓ Success: File validator rules verified.');
  console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
