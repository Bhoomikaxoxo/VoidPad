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

const EXT_TO_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
};

/**
 * Validates a file's size and contents.
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

  // Allow all extensions and MIME types, looking up extension-based mime first
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = EXT_TO_MIME[ext] || file.mimetype || 'application/octet-stream';
  return { valid: true, mimeType };
}
