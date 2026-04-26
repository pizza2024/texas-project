import '@testing-library/jest-dom';

// ─── localStorage / sessionStorage mock ───────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, writable: true });

// ─── next/navigation mock ─────────────────────────────────────────────────────
const pushMock = jest.fn();
const routerMock = { push: pushMock, replace: jest.fn(), back: jest.fn(), forward: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ─── @texas/shared mocks ──────────────────────────────────────────────────────
const setForceLogoutHandler = jest.fn();
const setRejoinAvailableHandler = jest.fn();
const setDepositConfirmedHandler = jest.fn();
const setFriendStatusUpdateHandler = jest.fn();
const setFriendRequestReceivedHandler = jest.fn();
const disconnectSocket = jest.fn();

jest.mock('@texas/shared', () => ({
  setForceLogoutHandler,
  setRejoinAvailableHandler,
  setDepositConfirmedHandler,
  setFriendStatusUpdateHandler,
  setFriendRequestReceivedHandler,
  disconnectSocket,
  getSocket: jest.fn(() => ({})),
  getTokenPayload: jest.fn(() => null),
  getTokenExpiryTime: jest.fn(() => null),
  isTokenExpired: jest.fn(() => false),
}));

// ─── @/lib/socket re-export (uses @texas/shared) ──────────────────────────────
jest.mock('@/lib/socket', () => ({
  setForceLogoutHandler,
  setRejoinAvailableHandler,
  setDepositConfirmedHandler,
  setFriendStatusUpdateHandler,
  setFriendRequestReceivedHandler,
  disconnectSocket,
  getSocket: jest.fn(() => ({})),
}));

// ─── @/lib/auth helpers used by auth-context ──────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getTokenPayload: jest.fn(() => null),
  getTokenExpiryTime: jest.fn(() => null),
  isTokenExpired: jest.fn(() => false),
  getStoredToken: jest.fn(() => localStorage.getItem('token')),
  clearStoredToken: jest.fn(() => localStorage.removeItem('token')),
  rememberPostLoginRedirect: jest.fn(),
  consumePostLoginRedirect: jest.fn(() => null),
  handleExpiredSession: jest.fn(),
  clearAuthExpiredLock: jest.fn(),
}));

// ─── @/lib/api mock ───────────────────────────────────────────────────────────
const apiGetMock = jest.fn();
const apiPostMock = jest.fn();
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: apiGetMock,
    post: apiPostMock,
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    create: jest.fn(() => ({
      get: apiGetMock,
      post: apiPostMock,
    })),
  },
}));

// ─── @/lib/system-message mock ───────────────────────────────────────────────
const showSystemMessageMock = jest.fn(() => Promise.resolve());
const subscribeSystemMessageMock = jest.fn(() => jest.fn());
const showConfirmMessageMock = jest.fn(() => Promise.resolve(false));
const subscribeConfirmMessageMock = jest.fn(() => jest.fn());
jest.mock('@/lib/system-message', () => ({
  showSystemMessage: showSystemMessageMock,
  subscribeSystemMessage: subscribeSystemMessageMock,
  showConfirmMessage: showConfirmMessageMock,
  subscribeConfirmMessage: subscribeConfirmMessageMock,
}));

// ─── window.location mock ─────────────────────────────────────────────────────
// Use unknown intermediate cast to avoid TypeScript index signature error on Window type
const windowAny = window as unknown as Record<string, unknown>;
delete windowAny['location'];
Object.defineProperty(window, 'location', {
  value: { href: '', pathname: '/', hostname: 'localhost', replace: jest.fn() },
  writable: true,
});

// ─── window.dispatchEvent mock already exists via jsdom ───────────────────────
// CustomEvent is provided by jsdom

// ─── Exports for use in test files ─────────────────────────────────────────────
export { pushMock, routerMock, apiGetMock, apiPostMock };
export { showSystemMessageMock, showConfirmMessageMock };
export { setForceLogoutHandler, setRejoinAvailableHandler, disconnectSocket };
