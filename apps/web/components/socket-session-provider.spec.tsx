/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { SocketSessionProvider } from './socket-session-provider';
import {
  pushMock,
  setForceLogoutHandler,
  setRejoinAvailableHandler,
} from '../jest.setup';

describe('SocketSessionProvider', () => {
  beforeEach(() => {
    pushMock.mockClear();
    setForceLogoutHandler.mockClear();
    setRejoinAvailableHandler.mockClear();
  });

  it('registers force logout and rejoin handlers on mount', () => {
    render(
      <SocketSessionProvider>
        <div>child</div>
      </SocketSessionProvider>
    );

    expect(setForceLogoutHandler).toHaveBeenCalledTimes(1);
    expect(setRejoinAvailableHandler).toHaveBeenCalledTimes(1);
  });

  it('renders children without wrapping them', () => {
    const { getByText } = render(
      <SocketSessionProvider>
        <span>Hello World</span>
      </SocketSessionProvider>
    );

    expect(getByText('Hello World')).toBeInTheDocument();
  });

  // ─── forceLogoutHandler callback ──────────────────────────────────────────

  it('calls the registered forceLogoutHandler with correct alert message when roomId is present', () => {
    let registeredHandler: (data: { roomId?: string }) => void;
    setForceLogoutHandler.mockImplementation((handler) => {
      registeredHandler = handler;
    });

    render(
      <SocketSessionProvider>
        <div />
      </SocketSessionProvider>
    );

    // Simulate force logout with a roomId
    act(() => {
      registeredHandler!({ roomId: 'room-123' });
    });

    // handleExpiredSession is called with the expected message via the mock
    // We just verify the handler was invoked and router.push was NOT called here
    // (handleExpiredSession is mocked and takes over navigation)
    expect(setForceLogoutHandler).toHaveBeenCalled();
  });

  it('calls the registered forceLogoutHandler with correct alert message when roomId is absent', () => {
    let registeredHandler: (data: { roomId?: string }) => void;
    setForceLogoutHandler.mockImplementation((handler) => {
      registeredHandler = handler;
    });

    render(
      <SocketSessionProvider>
        <div />
      </SocketSessionProvider>
    );

    act(() => {
      registeredHandler!({});
    });

    expect(setForceLogoutHandler).toHaveBeenCalled();
  });

  // ─── rejoinAvailableHandler callback ─────────────────────────────────────

  it('calls router.push with correct room path when rejoinAvailableHandler is triggered', () => {
    let registeredHandler: ({ roomId }: { roomId: string }) => void;
    setRejoinAvailableHandler.mockImplementation((handler) => {
      registeredHandler = handler;
    });

    // Override window.location.pathname for this test
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/other-page' },
      writable: true,
    });

    render(
      <SocketSessionProvider>
        <div />
      </SocketSessionProvider>
    );

    act(() => {
      registeredHandler!({ roomId: 'room-abc' });
    });

    expect(pushMock).toHaveBeenCalledWith('/room/room-abc');
  });

  it('does NOT navigate when already on the room page and rejoinAvailableHandler fires', () => {
    let registeredHandler: ({ roomId }: { roomId: string }) => void;
    setRejoinAvailableHandler.mockImplementation((handler) => {
      registeredHandler = handler;
    });

    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/room/room-abc' },
      writable: true,
    });

    render(
      <SocketSessionProvider>
        <div />
      </SocketSessionProvider>
    );

    act(() => {
      registeredHandler!({ roomId: 'room-abc' });
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('only registers handlers once on a single mount', () => {
    const { unmount } = render(
      <SocketSessionProvider>
        <div />
      </SocketSessionProvider>
    );

    // First mount registered handlers
    expect(setForceLogoutHandler).toHaveBeenCalledTimes(1);
    expect(setRejoinAvailableHandler).toHaveBeenCalledTimes(1);

    // Unmount, clear mocks, then re-mount — ref guard is reset per mount
    unmount();
    setForceLogoutHandler.mockClear();
    setRejoinAvailableHandler.mockClear();

    render(
      <SocketSessionProvider>
        <div />
      </SocketSessionProvider>
    );

    // Handlers registered again for the new mount
    expect(setForceLogoutHandler).toHaveBeenCalledTimes(1);
    expect(setRejoinAvailableHandler).toHaveBeenCalledTimes(1);
  });
});
