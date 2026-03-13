'use client';

export interface SystemMessageOptions {
  title?: string;
  message: string;
  confirmText?: string;
}

interface QueuedSystemMessage extends SystemMessageOptions {
  resolve: () => void;
}

const EVENT_NAME = 'texas-system-message';

export function showSystemMessage(options: SystemMessageOptions): Promise<void> {
  if (typeof window === 'undefined') {
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
  if (typeof window === 'undefined') {
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
