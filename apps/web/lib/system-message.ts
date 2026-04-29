"use client";

export interface SystemMessageOptions {
  title?: string;
  message: string;
  confirmText?: string;
}

interface QueuedSystemMessage extends SystemMessageOptions {
  resolve: () => void;
}

const EVENT_NAME = "texas-system-message";

export function showSystemMessage(
  options: SystemMessageOptions,
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<QueuedSystemMessage>(EVENT_NAME, {
        detail: {
          ...options,
          resolve,
        },
      }),
    );
  });
}

export function subscribeSystemMessage(
  listener: (message: QueuedSystemMessage) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<QueuedSystemMessage>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => {
    window.removeEventListener(EVENT_NAME, handler as EventListener);
  };
}

// ─── Two-button confirm dialog ───────────────────────────────────────────────

export interface ConfirmMessageOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface QueuedConfirmMessage extends ConfirmMessageOptions {
  resolve: (confirmed: boolean) => void;
}

const CONFIRM_EVENT_NAME = "texas-confirm-message";

export function showConfirmMessage(
  options: ConfirmMessageOptions,
): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<QueuedConfirmMessage>(CONFIRM_EVENT_NAME, {
        detail: { ...options, resolve },
      }),
    );
  });
}

export function subscribeConfirmMessage(
  listener: (message: QueuedConfirmMessage) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<QueuedConfirmMessage>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(CONFIRM_EVENT_NAME, handler as EventListener);
  return () => {
    window.removeEventListener(CONFIRM_EVENT_NAME, handler as EventListener);
  };
}
