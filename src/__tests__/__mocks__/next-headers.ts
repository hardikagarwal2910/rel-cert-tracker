/**
 * Mock for next/headers — cookies() not available in Node test env.
 */
const mockCookieStore = {
  get: jest.fn((name: string) => ({ name, value: '' })),
  set: jest.fn(),
  delete: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  getAll: jest.fn().mockReturnValue([]),
};

export const cookies = jest.fn().mockResolvedValue(mockCookieStore);
export const headers = jest.fn().mockResolvedValue(new Map());
