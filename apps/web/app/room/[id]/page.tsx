'use client';

import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import {
  getStoredToken,
  getTokenExpiryTime,
  getTokenPayload,
  handleExpiredSession,
  isTokenExpired,
} from '@/lib/auth';
import confettiLib from 'canvas-confetti';
import { normalizeSoundVolume } from '@/lib/sound-settings';
import { useSoundSettings } from '@/lib/use-sound-settings';
import { showSystemMessage, showConfirmMessage } from '@/lib/system-message';

import { TableState, Player, ChipFlight, PayoutFlight, DEAL_ANIMATION_MS, DEAL_STAGGER_MS, CHIP_FLIGHT_MS, CHIP_FLIGHT_STAGGER_MS } from './components/types';
import { GameHeader } from './components/GameHeader';
import { GameTable } from './components/GameTable';
import { ActionBar } from './components/ActionBar';
import { AllInConfirmModal } from './components/AllInConfirmModal';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { EmojiOverlay, EmojiOverlayStyles } from './components/EmojiOverlay';

import { calculateEquity, GameStage } from '@texas/shared';

const hasConfetti = typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>)['confetti'] === 'function';
const confetti = hasConfetti ? confettiLib : null;

const ACTIVE_BETTING_STAGES: GameStage[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

const pageBg: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 30%, #0a1f10 0%, #050d08 55%, #020405 100%)',
};

function getMyUserId(): string {
  const token = getStoredToken();
  if (!token) return '';
  return getTokenPayload(token)?.sub ?? '';
}

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();

  // Redirect mobile users to the mobile room page
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    if (isMobile) {
      router.replace(`/room-mobile/${id}`);
    }
  }, [id, router]);

  const [table, setTable] = useState<TableState | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [myUserId] = useState<string>(() => getMyUserId());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const { soundSettings } = useSoundSettings();
  const soundSettingsRef = useRef(soundSettings);
  soundSettingsRef.current = soundSettings;
  const { t } = useTranslation();
  const [dealAnimations, setDealAnimations] = useState<Record<string, number>>({});
  const [chipFlights, setChipFlights] = useState<ChipFlight[]>([]);
  const [payoutFlights, setPayoutFlights] = useState<PayoutFlight[]>([]);
  const [winnerHighlights, setWinnerHighlights] = useState<string[]>([]);
  const [loserHighlights, setLoserHighlights] = useState<string[]>([]);
  const [foldWinChoiceMade, setFoldWinChoiceMade] = useState(false);
  const [showAllInConfirm, setShowAllInConfirm] = useState(false);
  const [allInConfirmAmount, setAllInConfirmAmount] = useState(0);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiFlights, setEmojiFlights] = useState<Array<{ id: string; emoji: string; seatIndex: number; delay?: number }>>([]);
  const previousTableRef = useRef<TableState | null>(null);
  const actionPendingRef = useRef<boolean>(false); // P2-TEST-006: block duplicate submissions
  const dealCleanupRef = useRef<number | null>(null);
  const chipCleanupRef = useRef<number | null>(null);
  const chipActivationRef = useRef<number | null>(null);
  const payoutCleanupRef = useRef<number | null>(null);
  const payoutActivationRef = useRef<number | null>(null);
  const winnerHighlightCleanupRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCountdownToneRef = useRef<string | null>(null);

  const handleBackToLobby = () => {
    const myPlayer = table?.players?.find((p) => p?.id === myUserId);
    const isActiveInHand =
      table != null &&
      ACTIVE_BETTING_STAGES.includes(table.currentStage) &&
      myPlayer?.status === 'ACTIVE';
    if (isActiveInHand) {
      setShowLeaveConfirm(true);
    } else {
      void handleConfirmLeave();
    }
  };

  const roomPath = `/room/${id}`;

  const redirectToLogin = useCallback(() => {
    handleExpiredSession({ returnTo: roomPath });
  }, [roomPath]);

  const redirectForExpiredToken = useCallback(() => {
    handleExpiredSession({
      alertMessage: t('auth.sessionExpiredGameMsg'),
      returnTo: roomPath,
    });
  }, [t, roomPath]);

  const getAuthorizedSocket = () => {
    const token = getStoredToken();
    if (!token) {
      redirectToLogin();
      return null;
    }
    if (isTokenExpired(token, 1000)) {
      redirectForExpiredToken();
      return null;
    }
    return getSocket(token);
  };

  const playTone = ({
    type,
    frequency,
    endFrequency,
    duration,
    volume,
  }: {
    type: OscillatorType;
    frequency: number;
    endFrequency: number;
    duration: number;
    volume: number;
  }) => {
    if (typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      void context.resume();
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration * 0.8);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * normalizeSoundVolume(soundSettingsRef.current.volume)),
      now + 0.02,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  const queueDealAnimations = useCallback((entries: Array<[string, number]>) => {
    if (entries.length === 0) return;
    if (soundSettingsRef.current.deal) {
      playTone({ type: 'triangle', frequency: 520, endFrequency: 410, duration: 0.16, volume: 0.03 });
    }
    if (dealCleanupRef.current !== null) {
      window.clearTimeout(dealCleanupRef.current);
    }
    setDealAnimations((prev) => ({
      ...prev,
      ...Object.fromEntries(entries),
    }));
    const maxDelay = Math.max(...entries.map(([, delay]) => delay), 0);
    dealCleanupRef.current = window.setTimeout(() => {
      setDealAnimations({});
      dealCleanupRef.current = null;
    }, DEAL_ANIMATION_MS + maxDelay + 120);
  }, []);

  const getDealAnimationStyle = (slotKey: string): React.CSSProperties | undefined => {
    const delay = dealAnimations[slotKey];
    if (delay === undefined) return undefined;
    return {
      animation: `dealCard ${DEAL_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both`,
      willChange: 'transform, opacity',
    };
  };

  const queueChipFlights = (flights: Omit<ChipFlight, 'active'>[]) => {
    if (flights.length === 0) return;
    if (chipActivationRef.current !== null) window.cancelAnimationFrame(chipActivationRef.current);
    if (chipCleanupRef.current !== null) window.clearTimeout(chipCleanupRef.current);
    setChipFlights(flights.map((flight) => ({ ...flight, active: false })));
    chipActivationRef.current = window.requestAnimationFrame(() => {
      setChipFlights((prev) => prev.map((flight) => ({ ...flight, active: true })));
      chipActivationRef.current = null;
    });
    const maxDelay = Math.max(...flights.map((flight) => flight.delay), 0);
    chipCleanupRef.current = window.setTimeout(() => {
      setChipFlights([]);
      chipCleanupRef.current = null;
    }, CHIP_FLIGHT_MS + maxDelay + 160);
  };

  const queuePayoutFlights = useCallback((flights: Omit<PayoutFlight, 'active'>[]) => {
    if (flights.length === 0) return;
    if (soundSettingsRef.current.winner) {
      playTone({ type: 'sine', frequency: 660, endFrequency: 980, duration: 0.26, volume: 0.04 });
      window.setTimeout(() => {
        playTone({ type: 'sine', frequency: 880, endFrequency: 1320, duration: 0.3, volume: 0.035 });
      }, 120);
    }
    if (payoutActivationRef.current !== null) window.cancelAnimationFrame(payoutActivationRef.current);
    if (payoutCleanupRef.current !== null) window.clearTimeout(payoutCleanupRef.current);
    setPayoutFlights(flights.map((flight) => ({ ...flight, active: false })));
    payoutActivationRef.current = window.requestAnimationFrame(() => {
      setPayoutFlights((prev) => prev.map((flight) => ({ ...flight, active: true })));
      payoutActivationRef.current = null;
    });
    const maxDelay = Math.max(...flights.map((flight) => flight.delay), 0);
    payoutCleanupRef.current = window.setTimeout(() => {
      setPayoutFlights([]);
      payoutCleanupRef.current = null;
    }, CHIP_FLIGHT_MS + maxDelay + 220);
  }, []);

  const queueWinnerHighlights = (playerIds: string[]) => {
    if (winnerHighlightCleanupRef.current !== null) {
      window.clearTimeout(winnerHighlightCleanupRef.current);
      winnerHighlightCleanupRef.current = null;
    }
    if (playerIds.length === 0) {
      setWinnerHighlights([]);
      return;
    }
    setWinnerHighlights(playerIds);
    winnerHighlightCleanupRef.current = window.setTimeout(() => {
      setWinnerHighlights([]);
      setLoserHighlights([]);
      winnerHighlightCleanupRef.current = null;
    }, 3200);
  };

  const queueLoserHighlights = (playerIds: string[]) => {
    if (playerIds.length === 0) {
      setLoserHighlights([]);
      return;
    }
    setLoserHighlights(playerIds);
  };

  const leaveRoomViaSocket = async () => {
    const socket = getAuthorizedSocket();
    if (!socket) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const cleanup = () => {
        socket.off('left_room', handleLeftRoom);
        window.clearTimeout(timeoutId);
      };
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const handleLeftRoom = () => finish(true);
      const timeoutId = window.setTimeout(() => finish(false), 1200);
      socket.once('left_room', handleLeftRoom);
      socket.emit('leave_room', { roomId: id as string });
    });
  };

  const handleConfirmLeave = async () => {
    setLeaving(true);
    try {
      const leftViaSocket = await leaveRoomViaSocket();
      if (!leftViaSocket) {
        await api.post('/tables/me/leave-room');
      }
    } catch {
      // Ignore and continue navigation
    } finally {
      if (!getStoredToken()) return;
      sessionStorage.setItem('rooms:skip-auto-return-until', String(Date.now() + 10000));
      setLeaving(false);
      setShowLeaveConfirm(false);
      disconnectSocket();
      router.push('/rooms');
    }
  };

  const playCountdownTone = useCallback((seconds: number, urgent: boolean) => {
    if (!soundSettingsRef.current.countdown) return;
    playTone({
      type: urgent ? 'triangle' : 'sine',
      frequency: urgent ? 880 : 640,
      endFrequency: urgent ? 740 : 540,
      duration: urgent ? 0.32 : 0.22,
      volume: 0.045,
    });
  }, []);

  // WebSocket setup
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      redirectToLogin();
      return;
    }
    if (isTokenExpired(token, 1000)) {
      redirectForExpiredToken();
      return;
    }

    const socket = getSocket(token);
    const passwordKey = `room-password:${id as string}`;
    const roomPassword = sessionStorage.getItem(passwordKey) ?? undefined;

    socket.on('connect', () => {
      socket.emit('join_room', { roomId: id as string, password: roomPassword });
      sessionStorage.removeItem(passwordKey);
    });

    socket.on('room_update', (data: TableState) => {
      setTable(data);
    });

    socket.on('emoji-reaction', (data: { roomId: string; userId: string; emoji: string }) => {
      if (data.roomId !== id) return;
      if (data.userId === myUserId) return; // Already shown locally

      // Find the seat index of the reacting player
      const seatIndex = table?.players.findIndex((p) => p?.id === data.userId) ?? -1;
      const flightId = `emoji-flight-${Date.now()}-${data.userId}`;
      setEmojiFlights((prev) => [
        ...prev,
        { id: flightId, emoji: data.emoji, seatIndex: seatIndex >= 0 ? seatIndex : -1 },
      ]);
    });

    socket.on('already_in_room', async (data: {
      roomId: string;
      targetRoomId?: string;
      canSwitch?: boolean;
    }) => {
      if (!data?.roomId) return;
      if (data.roomId === id) {
        router.replace(`/room/${data.roomId}`);
        return;
      }
      const shouldSwitch = await showConfirmMessage({
        title: t('room.switchRoomTitle'),
        message: t('room.switchRoomMsg'),
        confirmText: t('room.switchRoomBtn'),
        cancelText: t('room.stayInRoom'),
      });
      if (!shouldSwitch) {
        router.replace(`/room/${data.roomId}`);
        return;
      }
      try {
        await api.post('/tables/me/leave-room');
        socket.emit('join_room', { roomId: id as string, password: roomPassword });
      } catch {
        await showSystemMessage({
          title: t('common.confirm'),
          message: '切换房间失败，请稍后重试。',
        });
        router.replace(`/room/${data.roomId}`);
      }
    });

    socket.on('disconnect', () => {
      const latestToken = getStoredToken();
      if (!latestToken) {
        redirectToLogin();
        return;
      }
      if (isTokenExpired(latestToken, 1000)) {
        redirectForExpiredToken();
      }
    });

    socket.on('room_full', async () => {
      await showSystemMessage({
        title: t('room.roomFull'),
        message: t('room.roomFullMsg'),
      });
      router.replace('/rooms');
    });

    socket.on('insufficient_balance', async (data?: { minimumRequiredBalance?: number }) => {
      await showSystemMessage({
        title: t('room.insufficientBalance'),
        message: t('room.insufficientBalanceMsg', { amount: data?.minimumRequiredBalance ?? 0 }),
      });
      router.replace('/rooms');
    });

    socket.on('wrong_password', async () => {
      await showSystemMessage({
        title: t('lobby.wrongPassword'),
        message: t('lobby.wrongPasswordMsg'),
      });
      router.replace('/rooms');
    });

    socket.on('error', async (message: string) => {
      if (message === 'Room not found') {
        await showSystemMessage({
          title: t('room.roomNotFound'),
          message: t('room.roomNotFoundMsg'),
        });
        router.replace('/rooms');
      }
    });

    const rejoinAvailableHandler = ({ roomId: rejoinRoomId }: { roomId: string }) => {
      if (rejoinRoomId === id && !socket.connected) {
        socket.connect();
      }
    };
    socket.on('rejoin_available', rejoinAvailableHandler);

    return () => {
      socket.off('rejoin_available', rejoinAvailableHandler);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, t, redirectToLogin, redirectForExpiredToken]);

  // Token expiry timer
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const expiresAt = getTokenExpiryTime(token);
    if (!expiresAt) {
      redirectForExpiredToken();
      return;
    }
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 1000) {
      redirectForExpiredToken();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      redirectForExpiredToken();
    }, remainingMs - 1000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roomPath, redirectForExpiredToken]);

  // Countdown timer
  useEffect(() => {
    if (!table?.settlementEndsAt && !table?.readyCountdownEndsAt && !table?.actionEndsAt) return;
    setCountdownNow(Date.now());
    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [table?.actionEndsAt, table?.settlementEndsAt, table?.readyCountdownEndsAt]);

  // Animation orchestration
  useEffect(() => {
    if (!table) return;
    const previousTable = previousTableRef.current;
    if (previousTable) {
      const nextAnimations: Array<[string, number]> = [];
      const nextChipFlights: Omit<ChipFlight, 'active'>[] = [];
      const nextPayoutFlights: Omit<PayoutFlight, 'active'>[] = [];
      const nextWinnerHighlights: string[] = [];
      const nextLoserHighlights: string[] = [];
      let animationIndex = 0;
      let chipAnimationIndex = 0;
      let payoutAnimationIndex = 0;

      const handJustStarted = previousTable.currentStage === 'WAITING' && table.currentStage !== 'WAITING';

      if (handJustStarted) {
        table.players.forEach((player, playerIndex) => {
          if (!player) return;
          player.cards.forEach((_, cardIndex) => {
            const previousCardCount = previousTable.players[playerIndex]?.cards.length ?? 0;
            if (cardIndex >= previousCardCount) {
              nextAnimations.push([`player-${playerIndex}-card-${cardIndex}`, animationIndex * DEAL_STAGGER_MS]);
              animationIndex += 1;
            }
          });
        });
      }

      if (table.communityCards.length > previousTable.communityCards.length) {
        table.communityCards.forEach((_, cardIndex) => {
          if (cardIndex < previousTable.communityCards.length) return;
          nextAnimations.push([`community-${cardIndex}`, animationIndex * DEAL_STAGGER_MS]);
          animationIndex += 1;
        });
      }

      table.players.forEach((player, playerIndex) => {
        if (!player || table.currentStage === 'WAITING') return;
        const previousBet = previousTable.players[playerIndex]?.bet ?? 0;
        if (player.bet <= previousBet) return;
        const seat = {
          top: 50 + 44 * Math.sin((playerIndex / 9) * 2 * Math.PI),
          left: 50 + 44 * Math.cos((playerIndex / 9) * 2 * Math.PI),
        };
        nextChipFlights.push({
          id: `chip-flight-${Date.now()}-${player.id}-${player.bet}-${chipAnimationIndex}`,
          amount: player.bet - previousBet,
          top: seat.top,
          left: seat.left,
          delay: chipAnimationIndex * CHIP_FLIGHT_STAGGER_MS,
        });
        chipAnimationIndex += 1;
      });

      if (
        previousTable.currentStage !== 'SETTLEMENT' &&
        table.currentStage === 'SETTLEMENT' &&
        table.lastHandResult
      ) {
        setFoldWinChoiceMade(false);
        const winners = table.lastHandResult.filter((entry) => entry.winAmount > 0);
        const losers = table.lastHandResult.filter((entry) => entry.winAmount <= 0);
        const myResult = table.lastHandResult.find((entry) => entry.playerId === myUserId);
        const didIFold = myResult?.handName === '弃牌';
        winners.forEach((entry) => {
          const playerIndex = table.players.findIndex((player) => player?.id === entry.playerId);
          if (playerIndex === -1) return;
          const seat = {
            top: 50 + 44 * Math.sin((playerIndex / 9) * 2 * Math.PI),
            left: 50 + 44 * Math.cos((playerIndex / 9) * 2 * Math.PI),
          };
          nextPayoutFlights.push({
            id: `payout-flight-${Date.now()}-${entry.playerId}-${payoutAnimationIndex}`,
            amount: entry.winAmount,
            top: seat.top,
            left: seat.left,
            delay: payoutAnimationIndex * CHIP_FLIGHT_STAGGER_MS,
          });
          payoutAnimationIndex += 1;
          const isMyWin = entry.playerId === myUserId;
          if (isMyWin && !didIFold && confetti) {
            const burst = (originX: number) =>
              confetti({
                particleCount: 90,
                spread: 65,
                startVelocity: 45,
                origin: { x: originX, y: 0.55 },
                colors: ['#facc15', '#86efac', '#60a5fa', '#f472b6', '#fb923c'],
              });
            burst(0.35);
            burst(0.65);
          }
          nextWinnerHighlights.push(entry.playerId);
        });
        losers.forEach((entry) => {
          nextLoserHighlights.push(entry.playerId);
        });
      }

      queueDealAnimations(nextAnimations);
      queueChipFlights(nextChipFlights);
      queuePayoutFlights(nextPayoutFlights);
      queueWinnerHighlights(nextWinnerHighlights);
      queueLoserHighlights(nextLoserHighlights);
    } else if (!table.lastHandResult) {
      queueWinnerHighlights([]);
      queueLoserHighlights([]);
    }

    previousTableRef.current = table;
  }, [table, myUserId, queueDealAnimations, queuePayoutFlights]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dealCleanupRef.current !== null) window.clearTimeout(dealCleanupRef.current);
      if (chipCleanupRef.current !== null) window.clearTimeout(chipCleanupRef.current);
      if (chipActivationRef.current !== null) window.cancelAnimationFrame(chipActivationRef.current);
      if (payoutCleanupRef.current !== null) window.clearTimeout(payoutCleanupRef.current);
      if (payoutActivationRef.current !== null) window.cancelAnimationFrame(payoutActivationRef.current);
      if (winnerHighlightCleanupRef.current !== null) window.clearTimeout(winnerHighlightCleanupRef.current);
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  const handleAction = (action: string, amount?: number) => {
    // P2-TEST-006: debounce duplicate submissions
    if (actionPendingRef.current) return;
    const socket = getAuthorizedSocket();
    if (!socket) return;
    actionPendingRef.current = true;
    socket.emit('player_action', { roomId: id as string, action, amount });
    // Reset when player's turn ends (next state update or timeout)
    setTimeout(() => { actionPendingRef.current = false; }, 1000);
  };

  const handleReady = () => {
    const socket = getAuthorizedSocket();
    if (!socket) return;
    socket.emit('player_ready', { roomId: id as string });
  };

  const settlementCountdown = table?.settlementEndsAt
    ? Math.max(0, Math.ceil((table.settlementEndsAt - countdownNow) / 1000))
    : 0;
  const readyCountdown = table?.readyCountdownEndsAt
    ? Math.max(0, Math.ceil((table.readyCountdownEndsAt - countdownNow) / 1000))
    : 0;
  const actionCountdown = table?.actionEndsAt
    ? Math.max(0, Math.ceil((table.actionEndsAt - countdownNow) / 1000))
    : 0;
  const isSettlement = table?.currentStage === 'SETTLEMENT';
  const isAutoReadyCountdown = table?.currentStage === 'WAITING' && readyCountdown > 0;
  const isActionStage = table ? table.currentStage !== 'WAITING' && table.currentStage !== 'SETTLEMENT' : false;
  const isFoldWinSettlement = isSettlement && (table?.isFoldWin ?? false);
  const isFoldWinWinner = isFoldWinSettlement &&
    (table?.lastHandResult?.some(e => e.playerId === myUserId && e.winAmount > 0) ?? false);
  const showFoldWinChoice = isFoldWinWinner && !foldWinChoiceMade;

  const handleShowCards = () => {
    const socket = getAuthorizedSocket();
    if (!socket) return;
    socket.emit('show_cards', { roomId: id as string });
    setFoldWinChoiceMade(true);
  };

  const handleMuckCards = () => {
    setFoldWinChoiceMade(true);
  };

  const activeCountdown = isSettlement
    ? settlementCountdown
    : isAutoReadyCountdown
      ? readyCountdown
      : isActionStage
        ? actionCountdown
        : 0;

  useEffect(() => {
    if (isActionStage) {
      lastCountdownToneRef.current = null;
      return;
    }
    if (activeCountdown <= 0) {
      lastCountdownToneRef.current = null;
      return;
    }
    const toneKey = `${isSettlement ? 'settlement' : 'ready'}-${activeCountdown}`;
    if (lastCountdownToneRef.current === toneKey) return;
    lastCountdownToneRef.current = toneKey;
    playCountdownTone(activeCountdown, activeCountdown <= 3);
  }, [activeCountdown, isActionStage, isSettlement, playCountdownTone]);

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={pageBg}>
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🃏</div>
          <p className="text-sm tracking-[0.3em] uppercase font-semibold" style={{ color: 'rgba(245,158,11,0.7)' }}>
            {t('room.loadingTable')}
          </p>
        </div>
      </div>
    );
  }

  const isWaiting = table.currentStage === 'WAITING';
  const myPlayer = table.players.find((p) => p?.id === myUserId);
  const isReady = myPlayer?.ready ?? false;
  const seatedPlayers = table.players.filter((p) => p !== null) as Player[];
  const readyCount = seatedPlayers.filter((p) => p.ready).length;
  const activePlayer = table.activePlayerIndex >= 0 ? table.players[table.activePlayerIndex] : null;
  const isUrgentCountdown = activeCountdown > 0 && activeCountdown <= (isActionStage ? 5 : 3);
  const countdownLabel = isSettlement ? t('room.countdownSettlement') : isAutoReadyCountdown ? t('room.countdownAutoStart') : t('room.countdownAction');
  const isMyTurn = isActionStage && activePlayer?.id === myUserId;
  const callAmount = myPlayer ? Math.max(0, (table.currentBet ?? 0) - myPlayer.bet) : 0;
  const canCheck = callAmount === 0;
  const minRaiseTo = (table.currentBet ?? 0) + (table.bigBlind ?? 0);

  // Calculate real equity for all-in confirmation
  const myHoleCards = myPlayer?.cards ?? [];
  const communityCards = table?.communityCards ?? [];
  const opponentCount = seatedPlayers.length - 1;
  const equity = myHoleCards.length === 2 && opponentCount >= 1
    ? calculateEquity(myHoleCards, communityCards, opponentCount)
    : 50;

  const winnerBestCardsMap = new Map<string, Set<string>>();
  const highlightedCommunityCardsSet = new Set<string>();
  if (isSettlement && !(table?.isFoldWin)) {
    table?.lastHandResult?.forEach((entry) => {
      if (entry.winAmount > 0 && entry.bestCards && entry.bestCards.length > 0) {
        winnerBestCardsMap.set(entry.playerId, new Set(entry.bestCards));
        entry.bestCards.forEach((card) => {
          if (table.communityCards.includes(card)) {
            highlightedCommunityCardsSet.add(card);
          }
        });
      }
    });
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden pb-24" style={pageBg}>
      {/* Subtle background suit symbols */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-6 left-6 text-[8rem] font-serif opacity-[0.025] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute bottom-8 right-6 text-[8rem] font-serif opacity-[0.025] text-yellow-400 rotate-6">♣</span>
      </div>

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            className="w-full max-w-sm rounded-2xl p-7"
            style={{
              background: 'linear-gradient(160deg, rgba(12,22,16,0.98) 0%, rgba(6,12,9,0.99) 100%)',
              border: '1px solid rgba(234,179,8,0.25)',
              boxShadow: '0 0 60px rgba(0,0,0,0.8)',
            }}
          >
            <h3 className="text-lg font-black tracking-widest uppercase mb-2" style={{ color: 'rgba(245,158,11,0.9)' }}>
              {t('room.exitRoom')}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(156,163,175,0.9)' }}>
              {(() => {
                const myPlayer = table?.players?.find((p) => p?.id === myUserId);
                const isActiveInHand =
                  table != null &&
                  ACTIVE_BETTING_STAGES.includes(table.currentStage) &&
                  myPlayer?.status === 'ACTIVE';
                return isActiveInHand
                  ? t('room.exitInGameWarn')
                  : t('room.exitConfirm');
              })()}
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1 h-10 rounded-lg font-bold tracking-wider text-xs uppercase"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaving}
              >
                {t('room.exitCancel')}
              </Button>
              <Button
                className="flex-1 h-10 rounded-lg font-black tracking-wider text-xs uppercase transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 0 16px rgba(245,158,11,0.2)',
                }}
                onClick={handleConfirmLeave}
                disabled={leaving}
              >
                {leaving ? t('room.exiting') : t('room.exitConfirmBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <GameHeader
        table={table}
        myUserId={myUserId}
        activeCountdown={activeCountdown}
        isSettlement={isSettlement}
        isAutoReadyCountdown={isAutoReadyCountdown}
        isWaiting={isWaiting}
        settlementCountdown={settlementCountdown}
        readyCountdown={readyCountdown}
        actionCountdown={actionCountdown}
        isActionStage={isActionStage}
        isMyTurn={isMyTurn}
        isUrgentCountdown={isUrgentCountdown}
        countdownLabel={countdownLabel}
        seatedPlayers={seatedPlayers}
        readyCount={readyCount}
        handleBackToLobby={handleBackToLobby}
      />

      {/* Poker Table */}
      <GameTable
        table={table}
        myUserId={myUserId}
        chipFlights={chipFlights}
        payoutFlights={payoutFlights}
        winnerHighlights={winnerHighlights}
        loserHighlights={loserHighlights}
        winnerBestCardsMap={winnerBestCardsMap}
        highlightedCommunityCardsSet={highlightedCommunityCardsSet}
        getDealAnimationStyle={getDealAnimationStyle}
        isWaiting={isWaiting}
        isActionStage={isActionStage}
        isUrgentCountdown={isUrgentCountdown}
        actionCountdown={actionCountdown}
      />

      {/* Bottom Action Bar */}
      <ActionBar
        table={table}
        isWaiting={isWaiting}
        isReady={isReady}
        isAutoReadyCountdown={isAutoReadyCountdown}
        readyCountdown={readyCountdown}
        isSettlement={isSettlement}
        settlementCountdown={settlementCountdown}
        isMyTurn={isMyTurn}
        isUrgentCountdown={isUrgentCountdown}
        actionCountdown={actionCountdown}
        callAmount={callAmount}
        minRaiseTo={minRaiseTo}
        canCheck={canCheck}
        showFoldWinChoice={showFoldWinChoice}
        handleAction={handleAction}
        handleReady={handleReady}
        raiseAmount={raiseAmount}
        setRaiseAmount={setRaiseAmount}
        handleShowCards={handleShowCards}
        handleMuckCards={handleMuckCards}
        myPlayerStack={myPlayer?.stack ?? 0}
        consecutiveTimeouts={myPlayer?.consecutiveTimeouts ?? 0}
        onRequestAllIn={(amount) => {
          setAllInConfirmAmount(amount);
          setShowAllInConfirm(true);
        }}
        emojiPickerOpen={emojiPickerOpen}
        onToggleEmojiPicker={() => setEmojiPickerOpen((v) => !v)}
        onEmoji={(emoji) => {
          const socket = getAuthorizedSocket();
          if (!socket) return;
          // Emit to server
          socket.emit('emoji-reaction', { roomId: id as string, emoji });
          // Show locally immediately
          const mySeatIndex = table?.players.findIndex((p) => p?.id === myUserId) ?? -1;
          const flightId = `emoji-flight-local-${Date.now()}-${myUserId}`;
          setEmojiFlights((prev) => [
            ...prev,
            { id: flightId, emoji, seatIndex: mySeatIndex >= 0 ? mySeatIndex : -1 },
          ]);
        }}
      />

      <AllInConfirmModal
        open={showAllInConfirm}
        amount={allInConfirmAmount}
        potOdds={callAmount > 0 ? (myPlayer?.stack ?? 0) / (callAmount + (myPlayer?.stack ?? 0)) : 1}
        equity={equity}
        onConfirm={() => {
          handleAction('all_in');
          setShowAllInConfirm(false);
        }}
        onCancel={() => setShowAllInConfirm(false)}
      />

      {/* Emoji Overlay */}
      <EmojiOverlay
        flights={emojiFlights}
        onFlightComplete={(id) => setEmojiFlights((prev) => prev.filter((f) => f.id !== id))}
      />
      <EmojiOverlayStyles />

      {/* Room Chat */}
      {typeof id === 'string' && (
        <div className="fixed bottom-24 right-4 z-30 w-72">
          <ChatPanel roomId={id} />
        </div>
      )}

      <style jsx>{`
        .countdown-badge {
          min-width: 56px;
          height: 34px;
          padding: 0 12px;
          border-radius: 9999px;
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.08em;
          animation: countdownPulse 1s ease-in-out infinite;
        }
        .countdown-badge-urgent {
          animation: countdownPulse 0.75s ease-in-out infinite, countdownShake 0.5s ease-in-out infinite;
        }
        .countdown-text-glow {
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.32);
        }
        .seat-action-countdown {
          animation: countdownPulse 1s ease-in-out infinite;
        }
        .seat-action-countdown-urgent {
          animation: countdownPulse 0.68s ease-in-out infinite, countdownShake 0.45s ease-in-out infinite;
        }
        .sound-slider {
          width: 110px;
          accent-color: #f59e0b;
        }
        .winner-avatar-highlight {
          animation: winnerAvatarPulse 0.95s ease-in-out 3;
        }
        .loser-avatar-dim {
          animation: loserAvatarDip 0.95s ease-in-out 3;
        }
        .action-timeout-banner {
          transition: transform 180ms ease, box-shadow 180ms ease;
        }
        .action-timeout-banner-urgent {
          animation: countdownPulse 0.72s ease-in-out infinite;
        }
        .action-auto-button {
          transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
        }
        .action-auto-button-urgent {
          animation: countdownPulse 0.72s ease-in-out infinite;
        }
        @keyframes dealCard {
          0% { opacity: 0; transform: translateY(-24px) scale(0.72) rotate(-10deg); filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0)); }
          65% { opacity: 1; transform: translateY(4px) scale(1.03) rotate(1deg); filter: drop-shadow(0 0 18px rgba(251, 191, 36, 0.35)); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0)); }
        }
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes countdownShake {
          0%, 100% { transform: scale(1.08) translateX(0); }
          25% { transform: scale(1.12) translateX(-1px); }
          75% { transform: scale(1.12) translateX(1px); }
        }
        @keyframes winnerAvatarPulse {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(250, 204, 21, 0.1)); }
          50% { filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.38)); }
        }
        @keyframes loserAvatarDip {
          0%, 100% { filter: saturate(1); }
          50% { filter: saturate(0.75) brightness(0.9); }
        }
      `}</style>
    </div>
  );
}
