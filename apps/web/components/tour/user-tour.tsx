'use client';

import { useState, useCallback } from 'react';
import { Joyride, type EventHandler, type EventData, type Controls, type Step } from 'react-joyride';

const steps: Step[] = [
  {
    target: 'body',
    skipBeacon: true,
    title: 'Welcome to CHIPS!',
    content:
      'This quick tour will show you around. Click "Next" to continue or press Esc to skip.',
    placement: 'center',
    styles: {
      tooltip: {
        backgroundColor: '#1a0f00',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '12px',
        color: '#e5e7eb',
      },
      tooltipContainer: {
        textAlign: 'left',
      },
      tooltipTitle: {
        color: '#fcd34d',
        fontWeight: '800',
        fontSize: '16px',
      },
      buttonPrimary: {
        backgroundColor: '#d97706',
        color: '#000',
        borderRadius: '8px',
        fontWeight: '700',
        fontSize: '13px',
        letterSpacing: '0.05em',
      },
      buttonBack: {
        color: 'rgba(245, 158, 11, 0.7)',
        marginLeft: '8px',
      },
      buttonSkip: {
        color: 'rgba(245, 158, 11, 0.5)',
        fontSize: '12px',
      },
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      },
      spotlight: {},
    },
  },
  {
    target: 'header',
    title: 'Navigation',
    content:
      'Use the header to log in or create a new account. Ready players can jump straight into a game.',
    placement: 'bottom',
    styles: {
      tooltip: {
        backgroundColor: '#1a0f00',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '12px',
        color: '#e5e7eb',
      },
      tooltipTitle: {
        color: '#fcd34d',
        fontWeight: '800',
        fontSize: '16px',
      },
      buttonPrimary: {
        backgroundColor: '#d97706',
        color: '#000',
        borderRadius: '8px',
        fontWeight: '700',
        fontSize: '13px',
      },
      buttonBack: {
        color: 'rgba(245, 158, 11, 0.7)',
        marginLeft: '8px',
      },
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      },
      spotlight: {},
    },
  },
  {
    target: '[href="/register"]',
    title: 'Start Playing',
    content:
      'Click "Play Now" to register an account. No sign-up walls — just grab a username, deal your chips, and take a seat.',
    placement: 'bottom',
    styles: {
      tooltip: {
        backgroundColor: '#1a0f00',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '12px',
        color: '#e5e7eb',
      },
      tooltipTitle: {
        color: '#fcd34d',
        fontWeight: '800',
        fontSize: '16px',
      },
      buttonPrimary: {
        backgroundColor: '#d97706',
        color: '#000',
        borderRadius: '8px',
        fontWeight: '700',
        fontSize: '13px',
      },
      buttonBack: {
        color: 'rgba(245, 158, 11, 0.7)',
        marginLeft: '8px',
      },
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      },
      spotlight: {},
    },
  },
  {
    target: '.grid',
    title: 'Feature Highlights',
    content:
      'Real-time battles, a transparent hand evaluator, and Web3 spirit — all in one place. Bluff big, call smart.',
    placement: 'top',
    styles: {
      tooltip: {
        backgroundColor: '#1a0f00',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '12px',
        color: '#e5e7eb',
      },
      tooltipTitle: {
        color: '#fcd34d',
        fontWeight: '800',
        fontSize: '16px',
      },
      buttonPrimary: {
        backgroundColor: '#d97706',
        color: '#000',
        borderRadius: '8px',
        fontWeight: '700',
        fontSize: '13px',
      },
      buttonBack: {
        color: 'rgba(245, 158, 11, 0.7)',
        marginLeft: '8px',
      },
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      },
      spotlight: {},
    },
  },
];

export default function UserTour() {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-start only on first visit
  const autoStart =
    typeof window !== 'undefined' && !localStorage.getItem('tour_completed');

  const handleEvent: EventHandler = useCallback(
    (data: EventData, _controls: Controls) => {
      const { type, index, status } = data;

      if (type === 'step:after') {
        setStepIndex(index + 1);
      }

      if (status === 'finished' || status === 'skipped') {
        localStorage.setItem('tour_completed', '1');
        setRun(false);
        setStepIndex(0);
      }
    },
    []
  );

  return (
    <Joyride
      steps={steps}
      run={run || autoStart}
      stepIndex={stepIndex}
      onEvent={handleEvent}
      continuous
      scrollToFirstStep={false}
      locale={{
        back: '← Back',
        close: '✕',
        last: 'Finish',
        next: 'Next →',
        skip: 'Skip tour',
      }}
    />
  );
}
