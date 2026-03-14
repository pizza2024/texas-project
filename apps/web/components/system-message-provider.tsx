'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { subscribeSystemMessage, type SystemMessageOptions } from '@/lib/system-message';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

interface PendingSystemMessage extends SystemMessageOptions {
  resolve: () => void;
}

export function SystemMessageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<PendingSystemMessage[]>([]);

  useEffect(() => {
    return subscribeSystemMessage((message) => {
      setQueue((prev) => [...prev, message]);
    });
  }, []);

  const activeMessage = useMemo(() => queue[0] ?? null, [queue]);

  const closeMessage = () => {
    if (!activeMessage) {
      return;
    }

    activeMessage.resolve();
    setQueue((prev) => prev.slice(1));
  };

  return (
    <>
      {children}

      {activeMessage ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeMessage}
          />

          <div
            className="relative w-full max-w-md rounded-2xl px-6 py-6"
            style={{
              background:
                'linear-gradient(160deg, rgba(12,22,16,0.98) 0%, rgba(6,12,9,1) 100%)',
              border: '1px solid rgba(234,179,8,0.24)',
              boxShadow:
                '0 0 0 1px rgba(234,179,8,0.08), 0 18px 50px rgba(0,0,0,0.6), 0 0 40px rgba(245,158,11,0.08)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl leading-none">📣</span>
              <div>
                <p
                  className="text-[10px] font-bold tracking-[0.3em] uppercase"
                  style={{ color: 'rgba(245,158,11,0.6)' }}
                >
                  System Message
                </p>
                <h2
                  className="text-lg font-black tracking-[0.08em] uppercase"
                  style={{
                    background:
                      'linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {activeMessage.title ?? t('common.tips')}
                </h2>
              </div>
            </div>

            <p
              className="text-sm leading-7 mb-6"
              style={{ color: 'rgba(229,231,235,0.92)' }}
            >
              {activeMessage.message}
            </p>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={closeMessage}
                className="font-black tracking-[0.14em] uppercase px-5"
                style={{
                  background:
                    'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 0 20px rgba(245,158,11,0.18)',
                }}
              >
                {activeMessage.confirmText ?? t('common.iGotIt')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
