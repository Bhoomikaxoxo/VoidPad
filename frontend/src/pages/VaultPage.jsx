import { useState, useEffect, useRef } from 'react';
import { Download, Upload, Trash2, File, AlertTriangle, ArrowLeft, Copy, Check, Loader2, Eye, X } from 'lucide-react';
import axios from 'axios';
import Beams from '../components/Beams';
import ExpiryTimer from '../components/ExpiryTimer';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// Register the ScrambleTextPlugin with GSAP
gsap.registerPlugin(ScrambleTextPlugin);

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');
const TOTAL_STORAGE_CAP_BYTES = 25 * 1024 * 1024; // 25MB

export default function VaultPage({ vaultKey, initialVault, onExit }) {
  const vault = initialVault || {};
  const [content, setContent] = useState(vault.content || '');
  const [saveStatus, setSaveStatus] = useState('Saved to Void');
  const [files, setFiles] = useState(vault.files || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Dynamic preview Blob URL generation for base64 local fallback URLs
  useEffect(() => {
    if (previewFile) {
      let url = previewFile.url || '';
      if (url.startsWith('data:')) {
        try {
          const parts = url.split(';base64,');
          const contentType = parts[0].split(':')[1];
          const raw = window.atob(parts[1]);
          const rawLength = raw.length;
          const uInt8Array = new Uint8Array(rawLength);
          for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          const blob = new Blob([uInt8Array], { type: contentType });
          url = URL.createObjectURL(blob);
        } catch (e) {
          console.error('Failed to parse base64 for preview URL:', e);
        }
      }
      setPreviewUrl(url);
      return () => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      setPreviewUrl('');
    }
  }, [previewFile]);

  const docxContainerRef = useRef(null);

  // Client-side docx parser & renderer
  useEffect(() => {
    const isDocx = previewFile?.mimeType?.includes('wordprocessingml') || previewFile?.originalName?.endsWith('.docx');
    if (isDocx && previewUrl && docxContainerRef.current) {
      const renderDocx = async () => {
        try {
          docxContainerRef.current.innerHTML = '<div class="flex items-center justify-center p-8 text-xs text-slate-500 font-mono">Parsing Word document layout...</div>';

          const response = await fetch(previewUrl);
          const blob = await response.blob();

          const docx = await import('docx-preview');
          docxContainerRef.current.innerHTML = '';

          await docx.renderAsync(blob, docxContainerRef.current, null, {
            inWrapper: false,
            ignoreWidth: true,
            ignoreHeight: true,
            ignoreFonts: false,
            breakPages: true,
            experimental: true
          });
        } catch (err) {
          console.error("Error rendering docx:", err);
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = `<div class="p-4 text-red-500 font-mono text-xs text-center">Failed to render Word document preview: ${err.message}</div>`;
          }
        }
      };
      renderDocx();
    }
  }, [previewFile, previewUrl]);

  // Driven by initial state content
  const [showPlaceholder, setShowPlaceholder] = useState(
    !vault.content || typeof vault.content !== 'string' || vault.content.trim().length === 0
  );

  const isFirstRender = useRef(true);

  // Keyboard shortcut listener (Esc to close active modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewFile(null);
        setDeleteConfirmFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 2. Debounced Autosave for Notepad
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus('Saving changes...');
    const delayDebounceFn = setTimeout(async () => {
      try {
        await axios.put(`${API_URL}/api/vault/${vault.id}/content`, { content });
        setSaveStatus('Saved to Void');
      } catch (err) {
        console.error(err);
        if (err.response && err.response.status === 404) {
          setSaveStatus('Expired');
          alert('This vault has expired and no longer exists.');
          onExit();
        } else {
          setSaveStatus('Save failed (offline?)');
        }
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(delayDebounceFn);
  }, [content, vault.id, onExit]);

  // 3. GSAP Scramble Text Intro animation for notepad placeholder
  useEffect(() => {
    if (!showPlaceholder) return;

    const notesTl = gsap.timeline({
      id: 'notes-placeholder-intro',
      defaults: { ease: 'none' }
    });

    notesTl.to('#notes-scramble-placeholder', {
      scrambleText: { text: 'Start typing', chars: 'lowerCase' },
      duration: 1.2
    });

    return () => {
      notesTl.kill();
    };
  }, [showPlaceholder]);

  // 4. File Upload Helper function
  const uploadFile = async (file) => {
    setUploadError('');

    // Check individual file limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5MB limit.');
      return;
    }

    // Check total storage limit (25MB)
    const currentTotalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    if (currentTotalBytes + file.size > TOTAL_STORAGE_CAP_BYTES) {
      setUploadError(`Upload rejected. This upload would exceed the vault's total storage cap of 25MB. Current usage: ${formatFileSize(currentTotalBytes)}`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/vault/${vault.id}/files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFiles((prev) => [...prev, response.data]);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setUploadError(err.response.data.error);
      } else {
        setUploadError('Failed to upload file.');
      }
    } finally {
      setUploading(false);
    }
  };

  // Drag and Drop Event Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      uploadFile(droppedFile);
    }
  };

  const handleManualFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadFile(file);
    }
    e.target.value = '';
  };

  // Programmatic File Download Handler
  const handleDownload = async (file) => {
    try {
      if (file.url.startsWith('data:')) {
        // Direct download of data URLs (base64)
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Fetch and download cross-origin files as blob
      const response = await fetch(file.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Programmatic download failed, falling back to window.open:', err);
      window.open(file.url, '_blank');
    }
  };

  // 5. File Delete Handler
  const handleFileDelete = async (fileId) => {
    try {
      await axios.delete(`${API_URL}/api/vault/${vault.id}/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete file.');
    }
  };

  // Utility to format file size dynamically
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/v/${vaultKey}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const hidePlaceholder = () => {
    setShowPlaceholder(false);
  };

  const totalUsedBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const usedPercentage = Math.min((totalUsedBytes / TOTAL_STORAGE_CAP_BYTES) * 100, 100);



  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden bg-[#030305] text-slate-200 flex flex-col font-mono">
      {/* 1. Animated Beams Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={8}
          lightColor="#6a5acd"
          speed={1.2}
          noiseIntensity={1.2}
          scale={0.2}
          rotation={0}
        />
      </div>

      {/* 2. Top Bar */}
      <header className="relative z-50 sticky top-0 border-b border-violet-950/40 bg-black/40 backdrop-blur-md px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors border border-slate-800/80 rounded px-2.5 py-1.5 bg-slate-950/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Leave</span>
          </button>

          <div className="h-4 w-px bg-slate-800"></div>

          {/* Expiration Countdown Info */}
          <ExpiryTimer expiresAt={vault.expiresAt} onExit={onExit} />
        </div>

        <div className="flex items-center gap-2">
          {/* Share button */}
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 text-xs border border-violet-900/40 text-violet-300 hover:border-violet-600 hover:bg-violet-950/20 rounded px-3 py-1.5 bg-violet-950/10 transition-all duration-300 font-mono"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400 font-mono">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="font-mono">Share Link</span>
              </>
            )}
          </button>

          {/* Export PDF Button */}
          <a
            href={`${API_URL}/api/vault/${vault.id}/export`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-violet-600/90 hover:bg-violet-500 border border-violet-500/30 text-white font-semibold rounded px-3.5 py-1.5 shadow-md shadow-violet-900/10 hover:shadow-violet-500/20 transition-all duration-300 font-mono"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="font-mono">Export as PDF</span>
          </a>
        </div>
      </header>

      {/* Main Column Layout (centered, 720px width max) */}
      <main className="relative z-10 flex-1 max-w-[720px] w-full mx-auto px-4 py-8 space-y-6">
        {/* Warning banner */}
        <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 text-[11px] text-red-400 flex items-start gap-2 leading-relaxed font-mono">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <span>
            Strict 24-hour limit. Once the vault expires, its content and all attached files are completely destroyed. Please export your PDF before the deadline.
          </span>
        </div>

        {/* Option to insert file as well block */}
        <section className="bg-slate-950/40 border border-slate-900/80 rounded-xl p-5 backdrop-blur-sm shadow-xl space-y-4 font-mono">
          <div className="text-xs text-violet-400 font-mono tracking-wider uppercase select-none font-semibold">
            Option to insert file as well
          </div>

          {/* Drag & Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center border border-dashed rounded-lg p-8 bg-slate-950/60 transition-all duration-300 ${isDragging
              ? 'border-violet-500 bg-violet-950/20 shadow-[0_0_15px_rgba(106,90,205,0.15)]'
              : 'border-violet-950/30 hover:border-violet-800/40 hover:bg-slate-950/90'
              }`}
          >
            <Upload className={`h-8 w-8 transition-colors mb-2 ${isDragging ? 'text-violet-400' : 'text-slate-500'}`} />
            <span className="text-xs text-slate-300 font-semibold mb-1 font-mono">
              Drag and drop file here
            </span>
            <span className="text-[10px] text-slate-500 text-center mb-3 font-mono">
              Any file extension accepted • Max 5MB per file
            </span>

            <label className="cursor-pointer px-3 py-1.5 bg-violet-900/40 border border-violet-700/50 hover:bg-violet-800/40 text-violet-300 text-[11px] rounded transition-all font-mono">
              Select File
              <input
                type="file"
                className="hidden"
                onChange={handleManualFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Uploading progress/indicator */}
          {uploading && (
            <div className="flex items-center justify-center gap-2 text-xs text-violet-400 bg-violet-950/10 border border-violet-900/30 rounded py-2 animate-pulse font-mono">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Uploading to secure vault...</span>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="flex items-start gap-1.5 text-[10px] text-red-400 bg-red-950/30 border border-red-900/30 rounded p-2 font-mono">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Capacity storage bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>Total Storage Used</span>
              <span>
                {formatFileSize(totalUsedBytes)} / 25.00 MB
              </span>
            </div>
            <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
              <div
                className="h-full bg-violet-600 transition-all duration-500"
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="border-t border-slate-900/80 pt-4 space-y-2">
              <div className="text-[10px] text-slate-500 font-bold uppercase select-none mb-1 font-mono">
                Vault Manifest ({files.length})
              </div>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 border border-slate-900 rounded bg-black/40 hover:border-slate-800 transition-all font-mono"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <File className="h-4 w-4 text-violet-400/80 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 font-medium truncate font-mono" title={file.originalName}>
                          {file.originalName}
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                          {formatFileSize(file.sizeBytes)} • {file.mimeType.split('/')[1] || 'binary'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/') || file.mimeType.includes('wordprocessingml') || file.originalName.endsWith('.docx')) && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 hover:bg-slate-900 rounded text-slate-400 hover:text-violet-400 transition-colors"
                          title="Preview File"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-1.5 hover:bg-slate-900 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        title="Download File"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmFile(file)}
                        className="p-1.5 hover:bg-red-950/40 rounded text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete File"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. Notes block (below the file block) */}
        <section className="notes-block">
          {showPlaceholder && (
            <div className="notes-placeholder-wrapper" id="notes-placeholder-wrapper">
              <span id="notes-scramble-placeholder"></span>
            </div>
          )}
          <textarea
            id="notes-textarea"
            className="notes-textarea"
            aria-label="Vault notes"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              hidePlaceholder();
            }}
            onFocus={hidePlaceholder}
            placeholder=""
          />
          <div className="flex items-center justify-between mt-1.5 px-1 text-[9px] text-slate-500 font-mono">
            <span>Character count: {content.length}</span>
            <span className={saveStatus.includes('failed') ? 'text-red-400' : 'text-slate-400'}>
              {saveStatus}
            </span>
          </div>
        </section>
      </main>

      {/* Custom Confirmation Modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090f] border border-red-950/50 rounded-xl max-w-sm w-full p-6 shadow-2xl shadow-red-950/20 font-mono relative overflow-hidden">
            {/* Red outline accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-red-600"></div>

            <div className="flex items-center gap-2 text-red-500 mb-4 select-none">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-xs font-bold tracking-widest uppercase">File Purge Request</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-mono">
              Are you sure you want to permanently delete <span className="text-violet-300 font-semibold">"{deleteConfirmFile.originalName}"</span> from this ephemeral vault? This action is irreversible.
            </p>

            <div className="flex justify-end gap-3 font-mono">
              <button
                onClick={() => setDeleteConfirmFile(null)}
                className="px-3.5 py-1.5 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 text-[11px] rounded transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const fileId = deleteConfirmFile.id;
                  setDeleteConfirmFile(null);
                  await handleFileDelete(fileId);
                }}
                className="px-3.5 py-1.5 bg-red-900/30 border border-red-700/50 hover:bg-red-900/40 text-red-300 text-[11px] rounded transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Look Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#09090f] border border-violet-950/40 rounded-xl max-w-4xl w-full p-5 shadow-2xl shadow-violet-950/20 font-mono relative overflow-hidden flex flex-col h-[85vh]">
            {/* Violet outline accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-violet-600"></div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3 select-none">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <File className="h-4 w-4 text-violet-400" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-200 truncate font-mono">
                    {previewFile.originalName}
                  </h3>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                    {previewFile.mimeType === 'application/pdf'
                      ? 'PDF Document'
                      : (previewFile.mimeType.includes('wordprocessingml') || previewFile.originalName.endsWith('.docx'))
                        ? 'Word Document'
                        : 'Image Asset'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 hover:bg-slate-900 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Close Preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 bg-black/40 rounded-lg overflow-hidden border border-slate-900 relative">
              {previewFile.mimeType === 'application/pdf' ? (
                previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full bg-slate-950"
                    title={previewFile.originalName}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                    Preparing PDF document...
                  </div>
                )
              ) : (previewFile.mimeType.includes('wordprocessingml') || previewFile.originalName.endsWith('.docx')) ? (
                <div className="w-full h-full bg-[#121214] overflow-auto p-4 md:p-8 flex justify-center">
                  <div
                    ref={docxContainerRef}
                    className="max-w-[800px] w-full docx-render-wrapper"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                  <img
                    src={previewFile.url}
                    alt={previewFile.originalName}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
