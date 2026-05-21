/* eslint-disable @typescript-eslint/no-explicit-any */
import { google } from 'googleapis';
import { sanitiseError } from '@/lib/security/sanitise-error';

// NEVER log the private key — not even partially
function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error('Google Drive credentials not configured');

  const privateKey = rawKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

export async function uploadFile(params: {
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  parentFolderId: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  try {
    const drive = getDriveClient();
    const { Readable } = await import('stream');
    const stream = Readable.from(params.fileBuffer);

    const res = await drive.files.create({
      requestBody: {
        name: params.fileName,
        parents: [params.parentFolderId],
      },
      media: { mimeType: params.mimeType, body: stream },
      fields: 'id,webViewLink',
    });

    return {
      fileId: res.data.id ?? '',
      webViewLink: res.data.webViewLink ?? '',
    };
  } catch (err) {
    const safe = sanitiseError(err);
    console.error('[google-drive] uploadFile failed:', safe);
    throw new Error(safe);
  }
}

export async function renameFile(fileId: string, newName: string): Promise<void> {
  try {
    const drive = getDriveClient();
    await drive.files.update({ fileId, requestBody: { name: newName } });
  } catch (err) {
    const safe = sanitiseError(err);
    console.error('[google-drive] renameFile failed:', safe);
  }
}

export async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return res.data.id ?? '';
}

export async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
  try {
    const drive = getDriveClient();
    const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({ q: query, fields: 'files(id)' });
    const files = res.data.files ?? [];
    if (files.length > 0 && files[0].id) return files[0].id;
    return createFolder(name, parentId);
  } catch (err) {
    const safe = sanitiseError(err);
    console.error('[google-drive] getOrCreateFolder failed:', safe);
    throw new Error(safe);
  }
}

export async function generateDownloadLink(fileId: string): Promise<string> {
  try {
    const drive = getDriveClient();
    await drive.files.update({
      fileId,
      requestBody: {},
      addParents: undefined,
    });
    // Return a direct download link — Drive handles auth via service account
    return `https://drive.google.com/uc?id=${fileId}&export=download`;
  } catch (err) {
    const safe = sanitiseError(err);
    console.error('[google-drive] generateDownloadLink failed:', safe);
    throw new Error(safe);
  }
}

export async function getCertFolderStructure(certName: string): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';
  const relFolder = await getOrCreateFolder('REL Certificates', rootFolderId);
  return getOrCreateFolder(certName, relFolder);
}

export async function getSupplierFolderStructure(
  supplierName: string,
  certName: string
): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';
  const supplierRoot = await getOrCreateFolder('Supplier Certs', rootFolderId);
  const supplierFolder = await getOrCreateFolder(supplierName, supplierRoot);
  return getOrCreateFolder(certName, supplierFolder);
}
