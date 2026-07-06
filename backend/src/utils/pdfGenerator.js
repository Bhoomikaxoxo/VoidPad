import PDFDocument from 'pdfkit';

/**
 * Generates a PDF snapshot of the vault (notepad content + file manifest)
 * and pipes the output directly to the Express response stream.
 *
 * @param {Object} vault - The vault object with content, dates, and related files
 * @param {Object} res - The Express response object
 */
export function generateVaultPDF(vault, res) {
  // Create document with 50px margins
  const doc = new PDFDocument({ margin: 50 });

  // Stream the PDF directly to the response
  doc.pipe(res);

  // Setup pageAdded handler to fill background on subsequent pages
  doc.on('pageAdded', () => {
    doc.save();
    doc.rect(0, 0, 595, 842).fillColor('#030305').fill();
    doc.restore();
    
    // Reset colors for the new page
    doc.fillColor('#dfdcff');
    doc.font('Courier');
  });

  // Fill first page background
  doc.save();
  doc.rect(0, 0, 595, 842).fillColor('#030305').fill();
  doc.restore();

  // Set default font to Courier (monospace)
  doc.font('Courier');
  doc.fillColor('#dfdcff');

  // --- DRAW LOGO ---
  const cx = 297.5; // page width / 2
  const cy = 55;
  const r = 22;
  
  doc.save();
  doc.lineWidth(1.5);
  doc.strokeColor('#7c3aed'); // Violet accent
  doc.fillColor('#09090f'); // Dark container fill
  
  // Hexagon path (manually close it)
  const startX = cx + r * Math.cos(0);
  const startY = cy + r * Math.sin(0);
  doc.moveTo(startX, startY);
  for (let i = 1; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    doc.lineTo(x, y);
  }
  doc.lineTo(startX, startY);
  doc.fillAndStroke();

  // Draw stylized "V" inside the hexagon
  doc.lineWidth(2.5);
  doc.strokeColor('#a78bfa'); // Light lavender-violet
  doc.lineCap('round');
  doc.lineJoin('round');
  doc.moveTo(cx - 7, cy - 7);
  doc.lineTo(cx, cy + 7);
  doc.lineTo(cx + 7, cy - 7);
  doc.stroke();
  doc.restore();

  // --- HEADER TITLE ---
  doc.moveDown(3.8);
  doc.fontSize(14).font('Courier-Bold').fillColor('#a78bfa').text('VOID VAULT SNAPSHOT', { align: 'center', characterSpacing: 1 });
  doc.moveDown(0.2);
  doc.fontSize(8).font('Courier').fillColor('#6d28d9').text('EPHEMERAL SECURITY SYSTEM', { align: 'center', characterSpacing: 2 });
  
  // Divider
  doc.moveDown(0.8);
  doc.lineWidth(1).strokeColor('#1e1b4b').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1.2);

  // --- METADATA SECTION ---
  const metadataY = doc.y;
  doc.save();
  // Draw card background
  doc.rect(50, metadataY, 495, 80).fillColor('#07070a').fill();
  doc.rect(50, metadataY, 495, 80).lineWidth(1).strokeColor('#2e1065').stroke();
  doc.restore();

  doc.fontSize(8.5).font('Courier-Bold');
  
  // Left column labels
  doc.fillColor('#7c3aed').text('VAULT ID: ', 65, metadataY + 12, { continued: true });
  doc.font('Courier').fillColor('#dfdcff').text(vault.id);
  
  doc.font('Courier-Bold').fillColor('#7c3aed').text('CREATED:  ', 65, metadataY + 28, { continued: true });
  doc.font('Courier').fillColor('#dfdcff').text(new Date(vault.createdAt).toUTCString());

  doc.font('Courier-Bold').fillColor('#7c3aed').text('EXPIRES:  ', 65, metadataY + 44, { continued: true });
  doc.font('Courier').fillColor('#f87171').text(new Date(vault.expiresAt).toUTCString()); // red for expiration

  doc.font('Courier-Bold').fillColor('#7c3aed').text('EXPORTED: ', 65, metadataY + 60, { continued: true });
  doc.font('Courier').fillColor('#a78bfa').text(new Date().toUTCString());

  doc.text('', 50, metadataY + 80); // reset position
  doc.moveDown(2);

  // --- NOTEPAD CONTENT ---
  doc.fontSize(11).font('Courier-Bold').fillColor('#a78bfa').text('NOTEPAD CONTENT');
  doc.moveDown(0.3);
  doc.lineWidth(1).strokeColor('#2e1065').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);

  doc.fontSize(9.5).font('Courier').fillColor('#dfdcff');
  if (vault.content && vault.content.trim().length > 0) {
    doc.text(vault.content, {
      align: 'left',
      lineGap: 4,
      width: 495
    });
  } else {
    doc.fillColor('#4c1d95').text('(Notepad scratchpad is empty)');
  }
  doc.moveDown(2.5);

  // --- ATTACHED FILES MANIFEST ---
  doc.fontSize(11).font('Courier-Bold').fillColor('#a78bfa').text('ATTACHED FILES MANIFEST');
  doc.moveDown(0.3);
  doc.lineWidth(1).strokeColor('#2e1065').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);

  if (vault.files && vault.files.length > 0) {
    vault.files.forEach((file, index) => {
      const sizeMB = (file.sizeBytes / (1024 * 1024)).toFixed(3);
      
      doc.fontSize(9.5).font('Courier-Bold').fillColor('#dfdcff').text(`${index + 1}. ${file.originalName}`);
      doc.fontSize(8.5).font('Courier').fillColor('#7c3aed').text('   Size: ', { continued: true });
      doc.fillColor('#dfdcff').text(`${sizeMB} MB`, { continued: true });
      doc.fillColor('#7c3aed').text('  |  MIME: ', { continued: true });
      doc.fillColor('#dfdcff').text(file.mimeType);
      
      // Clickable URL link (display a friendly short label so PDFKit doesn't freeze rendering large base64 strings)
      doc.fontSize(8.5).font('Courier-Bold').fillColor('#7c3aed').text('   Link: ', { continued: true });
      const displayUrl = file.url.startsWith('data:') ? 'Download Local File' : file.url;
      doc.fillColor('#60a5fa').text(displayUrl, { link: file.url, underline: true });
      doc.moveDown(0.8);
    });
  } else {
    doc.fontSize(9.5).font('Courier').fillColor('#4c1d95').text('(No attached files detected in this vault)');
  }

  // --- DISCLAIMER FOOTER ---
  // We place it at the bottom of the final page
  doc.fontSize(7).font('Courier').fillColor('#4b5563');
  doc.text('--------------------------------------------------------------------------------', 50, 770, { align: 'center' });
  doc.text('Disclaimer: Void Vault is an ephemeral, loginless scratchpad. This PDF represents a local snapshot of the vault. Once the 24-hour lifespan expires, the vault and all its files are permanently shredded from existence.', 50, 782, {
    align: 'center',
    width: 495,
    lineGap: 2
  });

  // Finish document
  doc.end();
}
