# 🔮 Void Vault

Void Vault is a loginless, keyless, and ephemeral secure scratchpad and file vault. Designed for temporary sharing and secure notes storage, vaults are created instantly by providing a unique key. Every vault is bound by a strict, non-renewable **24-hour expiration lifespan**, after which all notes and files are permanently shredded from the server and database.

---

## ✨ Features

- **Key-Based Access**: Access or create vaults instantly via a single unique key. No email, no passwords, and no accounts required.
- **Auto-Saving Notepad**: Features a debounced notepad that autosaves notes to the vault with visual save indicators.
- **GSAP Scramble Effects**: Elegant landing page header scrambles and notepad placeholder animations built using GreenSock's `ScrambleTextPlugin`.
- **Arbitrary File Uploads**: Accept any file extension/type up to **5MB per file**, with a total vault capacity of **25MB**.
- **In-App Delete Confirmations**: A custom, dark-theme confirmation modal that replaces standard browser alerts.
- **Export as PDF Snapshot**: Generates a dark-themed monospace snapshot receipt of the notes content and attached file manifest, including a programmatically-drawn vector logo and clickable download links.
- **Cloudinary & Base64 Fallback**: Supports Cloudinary for remote storage, with automatic fallback to base64 Data URLs inside the local database for seamless, zero-config local testing.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vite + React
- **Styling**: Tailwind CSS
- **Animations**: GSAP (GreenSock) + `ScrambleTextPlugin`
- **Icons**: Lucide React

### Backend
- **Server**: Node.js + Express
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
2. **Create the Database** and user:
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
   DATABASE_URL="postgresql://postgres@localhost:5432/voidpad"
   
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
- **Hash-Protected Vaults**: Keys are securely hashed using SHA-256 before database checks are performed.
- **Lazy Expiry Pruning**: Expiration checks are evaluated on every vault interaction. If the current time exceeds `expiresAt`, the server instantly deletes all database rows and media attachments before serving any content.
- **Active Cron Sweep**: Scheduled tasks check the database periodically to prune all orphaned records.
