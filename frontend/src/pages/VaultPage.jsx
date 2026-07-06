import { useState, useEffect, useRef } from 'react';
import { Download, Upload, Trash2, Clock, FileText, AlertTriangle, ArrowLeft, Copy, Check, ShieldAlert } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOTAL_STORAGE_CAP_BYTES = 25 * 1024 * 1024; // 25MB

export default function VaultPage({ vaultKey, initialVault, onExit }) {
  const [vault, setVault] = useState(initialVault);
  const [content, setContent] = useState(initialVault.content);
  const [saveStatus, setSaveStatus] = useState('Saved to Void');
  const [timeLeft, setTimeLeft] = useState('');
  const [files, setFiles] = useState(initialVault.files || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const isFirstRender = useRef(true);

  // 1. Expiration Timer countdown
  useEffect(() => {
    const calculateTimeLeft = () => {
      const expires = new Date(vault.expiresAt).getTime();
      const now = new Date().getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        alert('This vault has expired and is being permanently deleted.');
        onExit();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const hStr = hours.toString().padStart(2, '0');
      const mStr = minutes.toString().padStart(2, '0');
      const sStr = seconds.toString().padStart(2, '0');

      setTimeLeft(`${hStr}:${mStr}:${sStr}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [vault.expiresAt, onExit]);

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

  // 3. File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
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
      // Reset input element value
      e.target.value = '';
    }
  };

  // 4. File Delete Handler
  const handleFileDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await axios.delete(`${API_URL}/api/vault/${vault.id}/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete file.');
    }
  };

  // Calculate current storage size
  const totalUsedBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const usedPercentage = Math.min((totalUsedBytes / TOTAL_STORAGE_CAP_BYTES) * 100, 100);

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/v/${vaultKey}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#030305] text-slate-100 flex flex-col font-mono">
      {/* Top Navbar */}
      <header className="border-b border-violet-950/40 bg-black/40 backdrop-blur-md sticky top-0 z-55 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors border border-slate-800 rounded px-2.5 py-1.5 bg-slate-950/50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Leave Vault</span>
          </button>
          <div className="h-6 w-px bg-slate-800 hidden md:block"></div>
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-slate-500">Vault Key:</span>
            <span className="font-semibold text-violet-400">{showKey ? vaultKey : '••••••'}</span>
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 text-xs border border-violet-900/40 text-violet-300 hover:border-violet-600 hover:bg-violet-950/20 rounded px-3 py-1.5 bg-violet-950/10 transition-all duration-300"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Share Link</span>
              </>
            )}
          </button>
          <a
            href={`${API_URL}/api/vault/${vault.id}/export`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded px-3.5 py-1.5 shadow-md shadow-violet-900/10 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </a>
        </div>
      </header>

      {/* Expiry Alert banner */}
      <div className="bg-red-950/30 border-b border-red-900/30 px-4 py-2.5 flex items-center justify-between gap-4 text-xs text-red-400">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span>Warning: This vault has a strictly non-extendable 24-hour lifespan. Download PDF before expiry.</span>
        </div>
        <div className="flex items-center gap-1.5 font-bold bg-red-900/20 border border-red-800/40 rounded px-2 py-0.5 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-red-500" />
          <span>{timeLeft} LEFT</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Notepad (takes 2 cols in large) */}
        <section className="lg:col-span-2 flex flex-col min-h-[500px] bg-slate-950/40 border border-slate-900 rounded-xl overflow-hidden shadow-2xl">
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-900/60 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">notepad.txt</span>
            <span className={`text-[10px] ${saveStatus.includes('failed') ? 'text-red-400' : 'text-slate-500'}`}>
              {saveStatus}
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type anything here... Autosaves automatically. Pure plain-text."
            className="flex-1 w-full bg-slate-950/10 p-4 font-mono text-sm leading-relaxed text-slate-200 placeholder-slate-700 focus:outline-none resize-none"
          />
        </section>

        {/* Right Column: Files & Metadata */}
        <section className="space-y-6 flex flex-col">
          {/* File Upload card */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5 shadow-xl flex flex-col">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-violet-400" />
              <span>Attached Files</span>
            </h2>

            {/* Dropzone area */}
            <label className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg p-6 bg-slate-950/60 hover:bg-slate-950/90 hover:border-violet-800/60 transition-all duration-300 cursor-pointer group">
              <Upload className="h-8 w-8 text-slate-500 group-hover:text-violet-400 transition-colors mb-2" />
              <span className="text-xs text-slate-400 group-hover:text-slate-300 font-semibold mb-1">
                Upload File
              </span>
              <span className="text-[10px] text-slate-600 text-center">
                Max 5MB • Safe formats (PNG, JPG, PDF, ZIP, DOCX, CSV, TXT)
              </span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {uploading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-violet-400 bg-violet-950/10 border border-violet-900/30 rounded py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading to Cloudinary...</span>
              </div>
            )}

            {uploadError && (
              <div className="mt-3 flex items-start gap-1.5 text-[10px] text-red-400 bg-red-950/30 border border-red-900/30 rounded p-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Storage Cap Capacity Bar */}
            <div className="mt-6 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Storage Cap</span>
                <span>
                  {(totalUsedBytes / (1024 * 1024)).toFixed(2)} MB / 25.00 MB
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-600 transition-all duration-500"
                  style={{ width: `${usedPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Files List card */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5 shadow-xl flex-1 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">
              Vault Contents ({files.length})
            </h2>

            {files.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-slate-900/60 rounded-lg bg-slate-950/20">
                <span className="text-[10px] text-slate-600 font-mono">No files attached yet.</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2.5 pr-1">
                {files.map((file) => {
                  const sizeMB = (file.sizeBytes / (1024 * 1024)).toFixed(2);
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2.5 border border-slate-900 hover:border-slate-800 rounded bg-slate-950/60 transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs text-slate-300 font-semibold truncate" title={file.originalName}>
                          {file.originalName}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {sizeMB} MB • {file.mimeType.split('/')[1] || 'raw'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          title="Download File"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => handleFileDelete(file.id)}
                          className="p-1 hover:bg-red-950/40 rounded text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete File"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
