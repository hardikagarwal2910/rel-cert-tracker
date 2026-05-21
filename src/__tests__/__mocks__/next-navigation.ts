/**
 * Mock for next/navigation — not available in Node test env.
 */
export const useRouter = jest.fn().mockReturnValue({
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
});

export const useSearchParams = jest.fn().mockReturnValue({
  get: jest.fn().mockReturnValue(null),
});

export const usePathname = jest.fn().mockReturnValue('/');
export const redirect = jest.fn();
export const notFound = jest.fn();
