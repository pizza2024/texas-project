/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth-context';
import { apiGetMock, apiPostMock, pushMock } from '../jest.setup';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { localStorage } = window as any;

describe('AuthProvider', () => {
  // Helper component to expose auth context for testing
  const TestConsumer = () => {
    const { user, login, logout, loading } = useAuth();
    return (
      <div>
        <span data-testid="loading">{String(loading)}</span>
        <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
        <button data-testid="login-btn" onClick={() => login('tok123', { id: 'u1', nickname: 'Alice', coinBalance: 100 })}>
          login
        </button>
        <button data-testid="logout-btn" onClick={logout}>logout</button>
      </div>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  // ─── Initial state ─────────────────────────────────────────────────────────

  it('starts with loading false when no token is present', async () => {
    // When no token is in localStorage, the provider skips the API call,
    // runs checkAuth() and immediately sets loading=false.
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  // ─── Profile fetch on mount ───────────────────────────────────────────────

  it('fetches profile when token exists in localStorage', async () => {
    localStorage.setItem('token', 'valid-token');
    const mockUser = { id: 'u1', nickname: 'Bob', avatar: undefined, coinBalance: 500 };
    apiGetMock.mockResolvedValueOnce({ data: mockUser });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(mockUser));
    expect(apiGetMock).toHaveBeenCalledWith('/auth/profile');
  });

  it('sets loading to false even when profile fetch fails', async () => {
    localStorage.setItem('token', 'bad-token');
    apiGetMock.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('removes token from localStorage when profile fetch returns 401', async () => {
    localStorage.setItem('token', 'expired-token');
    const error = { response: { status: 401 } };
    apiGetMock.mockRejectedValueOnce(error);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('does not call API when no token in localStorage', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  // ─── login ────────────────────────────────────────────────────────────────

  it('login stores token, sets user, and navigates to home', async () => {
    apiGetMock.mockResolvedValueOnce({ data: { id: 'u1', nickname: 'Alice', coinBalance: 100 } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(localStorage.getItem('token')).toBe('tok123');
    expect(screen.getByTestId('user').textContent).toContain('Alice');
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  // ─── logout ──────────────────────────────────────────────────────────────

  it('logout calls API, clears localStorage, sets user null, navigates to /login', async () => {
    localStorage.setItem('token', 'some-token');
    apiPostMock.mockResolvedValueOnce({ data: {} });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(apiPostMock).toHaveBeenCalledWith('/auth/logout');
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('logout proceeds with local cleanup even if API call fails', async () => {
    localStorage.setItem('token', 'some-token');
    apiPostMock.mockRejectedValueOnce(new Error('Server error'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(pushMock).toHaveBeenCalledWith('/login');
  });
});
