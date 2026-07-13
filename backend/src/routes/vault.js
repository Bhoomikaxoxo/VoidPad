import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '../db.js';
import { hashKey } from '../utils/hashing.js';
import { validateFile } from '../utils/fileValidator.js';
import { generateVaultPDF } from '../utils/pdfGenerator.js';
import { limitVaultCreation, accessLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Setup Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Helper: Permanently delete a vault and all its Cloudinary assets.
 */
async function purgeVault(vaultId) {
  try {
    const vault = await prisma.vault.findUnique({
      where: { id: vaultId },
      include: { files: true }
    });

    if (!vault) return;

    // Delete all attached files from Cloudinary
    for (const file of vault.files) {
      if (file.cloudinaryId && !file.cloudinaryId.startsWith('mock_')) {
        try {
          await cloudinary.uploader.destroy(file.cloudinaryId);
        } catch (err) {
          console.error(`Error deleting Cloudinary asset ${file.cloudinaryId}:`, err);
        }
      }
    }

    // Delete the vault (cascades to VaultFile in database)
    await prisma.vault.delete({
      where: { id: vaultId }
    });
    console.log(`Vault ${vaultId} purged successfully.`);
  } catch (err) {
    console.error(`Failed to purge vault ${vaultId}:`, err);
  }
}

/**
 * Helper: Perform lazy expiry check on a vault.
 * If expired, it triggers a purge and returns true.
 * Otherwise returns false.
 */
async function isVaultExpiredAndPurged(vault) {
  if (!vault) return false;
  if (new Date() > new Date(vault.expiresAt)) {
    console.log(`Vault ${vault.id} is expired. Triggering lazy purge.`);
    await purgeVault(vault.id);
    return true;
  }
  return false;
}

/**
 * POST /api/vault/access
 * Given a key, create-or-open the vault (checks expiry, hashes key, enforces IP limit)
 */
router.post('/api/vault/access', accessLimiter, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key || typeof key !== 'string' || key.length < 6) {
      return res.status(400).json({ error: 'Key must be at least 6 characters long.' });
    }

    // 1. Hash the key deterministically
    const keyHash = await hashKey(key);

    // 2. Lookup vault by keyHash
    let vault = await prisma.vault.findUnique({
      where: { keyHash },
      include: { files: true }
    });

    // 3. Lazy expiry check
    if (vault && await isVaultExpiredAndPurged(vault)) {
      vault = null; // Mark as null so we create a new vault
    }

    if (vault) {
      // Vault exists and is active, return it
      return res.json({
        id: vault.id,
        content: vault.content,
        createdAt: vault.createdAt,
        expiresAt: vault.expiresAt,
        files: vault.files
      });
    }

    // 4. Create new vault (enforce 10 vaults/hour limit)
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (!limitVaultCreation(clientIp)) {
      return res.status(429).json({
        error: 'Vault creation limit exceeded. You can create at most 10 vaults per hour.'
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // exactly 24 hours later

    const newVault = await prisma.vault.create({
      data: {
        keyHash,
        expiresAt,
        content: ''
      },
      include: {
        files: true
      }
    });

    return res.status(201).json({
      id: newVault.id,
      content: newVault.content,
      createdAt: newVault.createdAt,
      expiresAt: newVault.expiresAt,
      files: newVault.files
    });
  } catch (err) {
    console.error('Error in /api/vault/access:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

/**
 * PUT /api/vault/:id/content
 * Update notepad content (autosave)
 */
router.put('/api/vault/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const vault = await prisma.vault.findUnique({
      where: { id },
      select: { id: true, expiresAt: true }
    });

    if (!vault) {
      return res.status(404).json({ error: 'Vault not found.' });
    }

    // Lazy expiry check
    if (await isVaultExpiredAndPurged(vault)) {
      return res.status(404).json({ error: 'Vault has expired and was deleted.' });
    }

    const updatedVault = await prisma.vault.update({
      where: { id },
      data: { content: content || '' },
      select: { content: true }
    });

    return res.json({ success: true, content: updatedVault.content });
  } catch (err) {
    console.error('Error updating vault content:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/vault/:id/files
 * Upload a file (enforce 5MB/file, 25MB total cap, mime allow-list)
 */
router.post('/api/vault/:id/files', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { file } = req;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const vault = await prisma.vault.findUnique({
      where: { id },
      include: { files: true }
    });

    if (!vault) {
      return res.status(404).json({ error: 'Vault not found.' });
    }

    // Lazy expiry check
    if (await isVaultExpiredAndPurged(vault)) {
      return res.status(404).json({ error: 'Vault has expired and was deleted.' });
    }

    // 1. Validate size and signature (magic bytes)
    const validation = validateFile(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // 2. Validate total storage cap (~25MB)
    const currentTotalBytes = vault.files.reduce((sum, f) => sum + f.sizeBytes, 0);
    const capBytes = 25 * 1024 * 1024; // 25MB

    if (currentTotalBytes + file.size > capBytes) {
      return res.status(400).json({
        error: `Upload rejected. This upload would exceed the vault's total storage cap of 25MB. Current usage: ${(currentTotalBytes / (1024 * 1024)).toFixed(2)}MB`
      });
    }

    // 3. Upload buffer to Cloudinary (or fallback to base64 mock if not configured)
    let cloudinaryResult = null;
    const isCloudinaryConfigured = 
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloudinary_cloud_name' &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key';

    if (isCloudinaryConfigured) {
      try {
        const uploadToCloudinary = () => {
          return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: 'voidpad',
                resource_type: 'auto'
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });
        };
        cloudinaryResult = await uploadToCloudinary();
      } catch (cloudinaryErr) {
        console.warn('Cloudinary upload failed, falling back to mock upload:', cloudinaryErr);
      }
    }

    if (!cloudinaryResult) {
      // Mock Cloudinary upload with a Data URL (base64) so it works locally with zero configuration
      const base64Content = file.buffer.toString('base64');
      const dataUrl = `data:${validation.mimeType};base64,${base64Content}`;
      cloudinaryResult = {
        public_id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        secure_url: dataUrl
      };
    }

    // 4. Save metadata to DB
    const dbFile = await prisma.vaultFile.create({
      data: {
        vaultId: id,
        cloudinaryId: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url,
        mimeType: validation.mimeType,
        sizeBytes: file.size,
        originalName: file.originalname
      }
    });

    return res.status(201).json(dbFile);
  } catch (err) {
    console.error('Error uploading file:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /api/vault/:id/files/:fileId
 * Delete a single file
 */
router.delete('/api/vault/:id/files/:fileId', async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const vault = await prisma.vault.findUnique({
      where: { id },
      include: { files: true }
    });

    if (!vault) {
      return res.status(404).json({ error: 'Vault not found.' });
    }

    // Lazy expiry check
    if (await isVaultExpiredAndPurged(vault)) {
      return res.status(404).json({ error: 'Vault has expired and was deleted.' });
    }

    const file = vault.files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found in this vault.' });
    }

    // 1. Delete from Cloudinary (only if not mock)
    if (file.cloudinaryId && !file.cloudinaryId.startsWith('mock_')) {
      try {
        await cloudinary.uploader.destroy(file.cloudinaryId);
      } catch (err) {
        console.error('Failed to delete Cloudinary asset:', err);
      }
    }

    // 2. Delete from DB
    await prisma.vaultFile.delete({
      where: { id: fileId }
    });

    return res.json({ success: true, message: 'File deleted successfully.' });
  } catch (err) {
    console.error('Error deleting file:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/vault/:id/export
 * Generate + return PDF export
 */
router.get('/api/vault/:id/export', async (req, res) => {
  try {
    const { id } = req.params;

    const vault = await prisma.vault.findUnique({
      where: { id },
      include: { files: true }
    });

    if (!vault) {
      return res.status(404).send('Vault not found.');
    }

    // Lazy expiry check
    if (await isVaultExpiredAndPurged(vault)) {
      return res.status(404).send('Vault has expired and was deleted.');
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="void-vault-snapshot.pdf"');

    // Generate and stream PDF
    generateVaultPDF(vault, res);
  } catch (err) {
    console.error('Error exporting PDF:', err);
    return res.status(500).send('Internal server error.');
  }
});

/**
 * POST /internal/cleanup
 * Purge all expired vaults + Cloudinary assets
 * Secret-protected endpoint hit by cron-job.org
 */
router.post('/internal/cleanup', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    const secretToken = process.env.CLEANUP_TOKEN || 'fallback_secret_token';

    if (!token || token !== secretToken) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Find all expired vaults
    const now = new Date();
    const expiredVaults = await prisma.vault.findMany({
      where: {
        expiresAt: { lt: now }
      },
      include: {
        files: true
      }
    });

    console.log(`Backup Sweep: Found ${expiredVaults.length} expired vaults.`);

    let deletedVaultsCount = 0;
    let deletedFilesCount = 0;

    for (const vault of expiredVaults) {
      // Delete files from Cloudinary
      for (const file of vault.files) {
        try {
          await cloudinary.uploader.destroy(file.cloudinaryId);
          deletedFilesCount++;
        } catch (err) {
          console.error(`Failed to delete Cloudinary file ${file.cloudinaryId}:`, err);
        }
      }

      // Delete vault record (will cascade-delete files in database)
      await prisma.vault.delete({
        where: { id: vault.id }
      });
      deletedVaultsCount++;
    }

    return res.json({
      success: true,
      summary: {
        expiredVaultsFound: expiredVaults.length,
        vaultsPurged: deletedVaultsCount,
        cloudinaryAssetsDeleted: deletedFilesCount
      }
    });
  } catch (err) {
    console.error('Error during cleanup sweep:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
