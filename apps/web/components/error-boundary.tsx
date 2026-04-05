'use client';

import React, { Component, type ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Global React Error Boundary.
 * Catches any runtime error in the component tree and renders a fallback
 * UI instead of crashing the entire page (white screen).
 *
 * Usage: wrap the app layout's {children} with this component.
 *
 *   <ErrorBoundary>
 *     {children}
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in dev; in production you'd send to an error tracker (Sentry, etc.)
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#060e10',
            color: '#f8fafc',
            padding: '2rem',
            textAlign: 'center',
            gap: '1.5rem',
          }}
        >
          <div style={{ fontSize: '3rem' }}>💥</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: 400, margin: 0 }}>
            {this.state.error?.message || 'An unexpected error occurred. Your game progress is safe.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button onClick={this.handleReset} size="sm">
              Try Again
            </Button>
            <Button onClick={() => (window.location.href = '/rooms')} variant="outline" size="sm">
              Back to Lobby
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
