import path from 'path';

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Mime types and signatures map
const ALLOWED_SIGNATURES = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpg: [0xFF, 0xD8],
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  zipOrDocx: [0x50, 0x4B, 0x03, 0x04], // PK zip header
};

// Forbidden executable signatures
const FORBIDDEN_SIGNATURES = {
  mz: [0x4D, 0x5A], // PE (.exe, .dll, etc.)
  elf: [0x7F, 0x45, 0x4C, 0x46], // Linux ELF
  macho_32: [0xFE, 0xED, 0xFA, 0xCE], // macOS Mach-O
  macho_64: [0xFE, 0xED, 0xFA, 0xCF],
  macho_32_reverse: [0xCE, 0xFA, 0xED, 0xFE],
  macho_64_reverse: [0xCF, 0xFA, 0xED, 0xFE],
  shebang: [0x23, 0x21], // #! (.sh, .py, etc.)
  java_class: [0xCA, 0xFE, 0xBA, 0xBE], // Java .class
  ms_cfb: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // MS Compound File (.msi, .doc, etc.)
};

/**
 * Checks if a buffer matches a specific signature at offset 0.
 */
function matchesSignature(buffer, signature) {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Validates a file's size and contents using magic byte analysis.
 *
 * @param {Object} file - The file object from Multer (in-memory storage)
 * @returns {{ valid: boolean, error?: string, mimeType?: string }}
 */
export function validateFile(file) {
  if (!file || !file.buffer) {
    return { valid: false, error: 'No file uploaded or file buffer is empty.' };
  }

  // 1. Enforce max file size: 5MB
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds the 5MB limit.' };
  }

  const buffer = file.buffer;
  const ext = path.extname(file.originalname).toLowerCase();

  // 2. Scan for blocked executable signatures (independent of extension)
  for (const [key, sig] of Object.entries(FORBIDDEN_SIGNATURES)) {
    if (matchesSignature(buffer, sig)) {
      return { valid: false, error: `Upload rejected: executable content detected (sig: ${key}).` };
    }
  }

  // 3. Scan for allowed signatures
  // WebP has a slightly more complex signature (RIFF .... WEBP)
  const isWebP = buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  if (isWebP) {
    return { valid: true, mimeType: 'image/webp' };
  }

  if (matchesSignature(buffer, ALLOWED_SIGNATURES.png)) {
    return { valid: true, mimeType: 'image/png' };
  }

  if (matchesSignature(buffer, ALLOWED_SIGNATURES.jpg)) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  if (matchesSignature(buffer, ALLOWED_SIGNATURES.gif)) {
    return { valid: true, mimeType: 'image/gif' };
  }

  if (matchesSignature(buffer, ALLOWED_SIGNATURES.pdf)) {
    return { valid: true, mimeType: 'application/pdf' };
  }

  if (matchesSignature(buffer, ALLOWED_SIGNATURES.zipOrDocx)) {
    // Both zip and docx start with PK\x03\x04
    // We can differentiate based on the extension or let it pass as either zip or docx
    if (ext === '.docx') {
      return { valid: true, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    return { valid: true, mimeType: 'application/zip' };
  }

  // 4. Handle text-based files (.txt, .csv)
  // These files do not have a binary magic byte header.
  // We check that the extension is txt/csv and the buffer does not contain null bytes (binary indicator).
  if (ext === '.txt' || ext === '.csv') {
    // Scan buffer for null bytes (0x00) which would indicate binary content
    const checkLen = Math.min(buffer.length, 4096);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0x00) {
        return { valid: false, error: 'Upload rejected: binary content detected in text file.' };
      }
    }
    const mimeType = ext === '.csv' ? 'text/csv' : 'text/plain';
    return { valid: true, mimeType };
  }

  return { valid: false, error: 'Upload rejected: file type not in allow-list.' };
}
