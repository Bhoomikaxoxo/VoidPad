# 🔮 Void Vault

Void Vault is a loginless, keyless, and ephemeral secure scratchpad and file vault. Designed for temporary sharing and secure notes storage, vaults are created instantly by providing a unique key. Every vault is bound by a strict, non-renewable **24-hour expiration lifespan**, after which all notes and files are permanently shredded from the server and database.

---

## ✨ Features

- **Key-Based Access**: Access or create vaults instantly via a single unique key. No email, no passwords, and no accounts required.
- **Sub-Millisecond HMAC-SHA256 Hashing**: Deterministically hashes vault keys using native Node.js HMAC-SHA256 for ultra-fast `<1ms` O(1) database lookups.
- **Interactive Scramble Intro & Click-to-Cut**: GSAP-scrambled landing title. Click anywhere on the screen to instantly skip the intro, reveal the search bar, and auto-focus the input—with real-time matrix scrambling as you type.
- **Performance-Optimized Code Splitting**: Utilizes dynamic React `lazy`/`Suspense` route splitting and custom Vite `manualChunks` vendor isolation (Three.js, GSAP, Lucide, React), reducing primary entry bundle size by **91% down to ~62KB**.
- **In-App Quick Look Preview**: Preview **PDFs, images, and Microsoft Word (.docx)** files directly inside a glassmorphic overlay modal on the site. Uses dynamic ES module imports to load the 170KB `.docx` parser on-demand.
- **Lightweight Keystroke Autosave**: Features a debounced notepad that autosaves notes with zero database table join overhead and visual save indicators.
- **Isolated Expiry Timer Component**: React memoization pattern isolates the 1-second countdown clock, eliminating top-level re-render churn across the editor.
- **Gzip Response Compression & DB Indexing**: Native Express response compression and PostgreSQL `expiresAt` column indexing for superfast API responses and cleanup sweeps.
- **Arbitrary File Uploads**: Accept any file extension/type up to **5MB per file**, with a total vault capacity of **25MB**.
- **In-App Delete Confirmations & Esc Key Dismissal**: A custom, dark-theme confirmation modal with full `Escape` key keyboard shortcut support.
- **Export as PDF Snapshot**: Generates a dark-themed monospace snapshot receipt of the notes content and attached file manifest, including a programmatically-drawn vector logo and clickable download links.
- **Cloudinary & Base64 Fallback**: Supports Cloudinary for remote storage, with automatic fallback to base64 Data URLs inside the local database for seamless, zero-config local testing.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vite + React
- **Styling**: Tailwind CSS
- **Animations**: GSAP (GreenSock) + `ScrambleTextPlugin` + Three.js / React Three Fiber (`Beams`)
- **Word Document Parser**: `docx-preview`
- **Icons**: Lucide React

### Backend
- **Server**: Node.js + Express + `compression`
- **ORM**: Prisma ORM
- **Database**: PostgreSQL
- **PDF Generation**: PDFKit

---

## 🚀 Local Development Setup

Follow these steps to run the complete Void Vault environment locally:

### 1. Prerequisites
Ensure you have the following installed on your system:
- **Node.js** (v18 or higher)
- **PostgreSQL**

---

### 2. Database Setup

1. **Start PostgreSQL** and log in to the database shell:
   ```bash
   psql postgres
   ```
2. **Create the Database**:
   ```sql
   CREATE DATABASE voidpad;
   ```
3. Exit the shell using `\q`.

---

### 3. Backend Configuration & Start

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5005
   DATABASE_URL="postgresql://username:password@localhost:5432/voidpad"
   KEY_PEPPER_SECRET="your_secret_pepper_here"
   CLEANUP_TOKEN="your_super_secret_cleanup_token_here"
   
   # Optional: Configure Cloudinary keys to test remote uploads
   # If left as placeholders, files will automatically fallback to base64 DB storage
   CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
   CLOUDINARY_API_KEY="your_cloudinary_api_key"
   CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
   ```
3. Run the database migration to create the tables:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend will start listening on port `5005`.

---

### 4. Frontend Configuration & Start

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_URL="http://localhost:5005"
   ```
3. Install dependencies and start the Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
   The frontend will start running at `http://localhost:5173/`.

---

## 🔒 Security & Ephemerality Architecture

Void Vault is designed from the ground up for strict temporary storage:
- **Zero Logins**: Accounts and recovery processes are completely omitted to ensure anonymity.
- **Deterministic HMAC-SHA256 Hashing**: Keys are hashed deterministically with pepper secrets before database checks are performed.
- **Lazy Expiry Pruning**: Expiration checks are evaluated on every vault interaction. If the current time exceeds `expiresAt`, the server instantly deletes all database rows and media attachments before serving any content.
- **Active Cron Sweep**: Scheduled tasks check the database periodically to prune all expired records.
