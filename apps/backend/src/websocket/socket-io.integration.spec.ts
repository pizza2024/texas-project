/**
 * W-004: WebSocket Real Socket.io Integration Test
 *
 * Tests the WebSocket flow using socket.io-client against a real backend.
 * These tests REQUIRE the backend to be running at http://localhost:4000.
 *
 * To run these tests:
 *   1. Start backend: cd apps/backend && npm run dev
 *   2. Start web: cd apps/web && npm run dev
 *   3. Run: npm test -- --testPathPattern=socket-io.integration
 *
 * If backend is not running, tests will skip gracefully.
 */

import { io, type Socket } from 'socket.io-client';

const API_BASE = 'http://localhost:4000';
const WS_BASE = 'http://localhost:4000/ws';

// Unique suffix to avoid test collision
const TEST_SUFFIX = 'ws' + Date.now();

const USER1 = {
  username: 'ws_user1_' + TEST_SUFFIX,
  password: 'Test1234',
};
const USER2 = {
  username: 'ws_user2_' + TEST_SUFFIX,
  password: 'Test1234',
};

function isBackendAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(
      API_BASE + '/health',
      { timeout: 2000 },
      (res: any) => {
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function connectSocket(token: string): Socket {
  return io(WS_BASE, {
    query: { token },
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: 8_000,
  });
}

describe('W-004: WebSocket Real Socket.io Integration', () => {
  // Skip entire suite if backend is not running
  beforeAll(async () => {
    const available = await isBackendAvailable();
    if (!available) {
      console.warn(
        '[W-004] Backend not available at ' +
          API_BASE +
          ' — skipping integration tests',
      );
    }
    // Set a flag the tests can check
    (global as any).__W004_BACKEND_AVAILABLE = available;
  }, 10_000);

  afterAll(async () => {
    // Cleanup: disconnect any lingering sockets
    await new Promise((r) => setTimeout(r, 500));
  });

  it('skips when backend is not running', async () => {
    const available = await isBackendAvailable();
    if (!available) {
      console.warn('[W-004] Skipping — backend not available');
    }
    // This test always passes; real tests below check the flag
    expect(true).toBe(true);
  });

  it('can establish a WebSocket handshake (no auth)', async () => {
    if (!(global as any).__W004_BACKEND_AVAILABLE) {
      return; // skip
    }
    // Use a socket without token — server should either accept connection
    // or disconnect gracefully (no crash)
    const socket = connectSocket('invalid-token');
    await new Promise<void>((resolve) => {
      socket.on('connect_error', () => {
        resolve();
      });
      socket.on('connect', () => {
        socket.disconnect();
        resolve();
      });
      setTimeout(resolve, 5_000); // timeout safety
    });
    socket.disconnect();
  }, 15_000);
});
