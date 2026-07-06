import PDFDocument from 'pdfkit';

/**
 * Generates a PDF snapshot of the vault (notepad content + file manifest)
 * and pipes the output directly to the Express response stream.
 *
 * @param {Object} vault - The vault object with content, dates, and related files
 * @param {Object} res - The Express response object
 */
export function generateVaultPDF(vault, res) {
  const doc = new PDFDocument({ margin: 50 });

  // Stream the PDF directly to the response
  doc.pipe(res);

  // Set font to Courier for the monospace terminal theme
  doc.font('Courier');

  // Title Header
  doc.fontSize(24).text('VOID PAD SNAPSHOT', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text('==================================================', { align: 'center' });
  doc.moveDown(1.5);

  // Vault Meta information
  doc.fontSize(12).text(`Vault ID:   ${vault.id}`);
  doc.text(`Created:    ${new Date(vault.createdAt).toUTCString()}`);
  doc.text(`Expires:    ${new Date(vault.expiresAt).toUTCString()}`);
  doc.moveDown(1.5);

  // Notepad Section
  doc.fontSize(14).text('--- NOTEPAD CONTENT ---');
  doc.moveDown(1);

  doc.fontSize(10);
  if (vault.content && vault.content.trim().length > 0) {
    doc.text(vault.content, {
      align: 'left',
      lineGap: 4
    });
  } else {
    doc.text('(Notepad is empty)');
  }
  doc.moveDown(2);

  // Files Section
  doc.fontSize(14).text('--- ATTACHED FILES MANIFEST ---');
  doc.moveDown(1);

  doc.fontSize(10);
  if (vault.files && vault.files.length > 0) {
    vault.files.forEach((file, index) => {
      const sizeMB = (file.sizeBytes / (1024 * 1024)).toFixed(3);
      doc.text(`${index + 1}. ${file.originalName}`);
      doc.text(`   Size: ${sizeMB} MB`);
      doc.text(`   MIME: ${file.mimeType}`);
      doc.fillColor('blue');
      doc.text(`   URL:  ${file.url}`, { link: file.url });
      doc.fillColor('black'); // Reset color
      doc.moveDown(0.8);
    });
  } else {
    doc.text('(No attached files)');
  }

  // Footer Disclaimer
  doc.moveDown(3);
  doc.fontSize(8).text('Disclaimer: Void Pad is a loginless ephemeral vault. This PDF represents a snapshot of the vault. Once the 24-hour lifespan expires, the online vault and all associated files are permanently deleted.', {
    align: 'center',
    width: 500
  });

  // Complete the PDF creation
  doc.end();
}
