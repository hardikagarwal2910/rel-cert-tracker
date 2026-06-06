/**
 * v1.1.7 — Google Drive helpers must pass Shared-Drive flags. The target folder
 * lives in a Shared Drive; without supportsAllDrives the API returns
 * "File not found". This guards that regression.
 */

const mockCreate = jest.fn().mockResolvedValue({ data: { id: 'file-1', webViewLink: 'https://drive/x' } });
const mockList = jest.fn().mockResolvedValue({ data: { files: [] } });
const mockUpdate = jest.fn().mockResolvedValue({ data: {} });

jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    drive: jest.fn(() => ({ files: { create: mockCreate, list: mockList, update: mockUpdate } })),
  },
}));

beforeAll(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'svc@test.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n';
});
beforeEach(() => { mockCreate.mockClear(); mockList.mockClear(); mockUpdate.mockClear(); });

import { uploadFile, createFolder, getOrCreateFolder, renameFile } from '@/lib/google-drive';

describe('Google Drive Shared-Drive flags', () => {
  it('uploadFile passes supportsAllDrives:true to files.create', async () => {
    await uploadFile({ fileName: 'current.pdf', fileBuffer: Buffer.from('%PDF'), mimeType: 'application/pdf', parentFolderId: 'folder-1' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ supportsAllDrives: true });
  });

  it('createFolder passes supportsAllDrives:true', async () => {
    await createFolder('cert-1', 'root');
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ supportsAllDrives: true });
  });

  it('getOrCreateFolder list passes supportsAllDrives + includeItemsFromAllDrives', async () => {
    await getOrCreateFolder('cert-1', 'root');
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList.mock.calls[0][0]).toMatchObject({ supportsAllDrives: true, includeItemsFromAllDrives: true });
  });

  it('renameFile passes supportsAllDrives:true to files.update', async () => {
    await renameFile('file-1', 'v2.pdf');
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ supportsAllDrives: true });
  });
});
