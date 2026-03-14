'use client';

import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import {
  getStoredToken,
  getTokenExpiryTime,
  getTokenPayload,
  handleExpiredSession,
  isTokenExpired,
} from '@/lib/auth';
import { normalizeSoundVolume } from '@/lib/sound-settings';
import { useSoundSettings } from '@/lib/use-sound-settings';
import { showSystemMessage } from '@/lib/system-message';
import { UserAvatar } from '@/components/user-avatar';

interface Player {
  id: string;
  nickname: string;
  avatar: string;
  stack: number;
  bet: number;
  cards: string[];
  status: string;
  ready: boolean;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
}

interface TableState {
  id: string;
  pot: number;
  currentBet: number;
  bigBlind: number;
  communityCards: string[];
  players: (Player | null)[];
  currentStage: string;
  activePlayerIndex: number;
  lastHandResult?: HandResultEntry[] | null;
  settlementEndsAt?: number | null;
  readyCountdownEndsAt?: number | null;
  actionEndsAt?: number | null;
}

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const DEAL_ANIMATION_MS = 420;
const DEAL_STAGGER_MS = 90;
const CHIP_FLIGHT_MS = 680;
const CHIP_FLIGHT_STAGGER_MS = 70;
const TABLE_SEAT_COUNT = 9;

interface ChipFlight {
  id: string;
  amount: number;
  top: number;
  left: number;
  delay: number;
  active: boolean;
}

interface PayoutFlight {
  id: string;
  amount: number;
  top: number;
  left: number;
  delay: number;
  active: boolean;
}

interface WinnerReveal {
  id: string;
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  cards: string[];
  top: number;
  left: number;
  centerOffsetX: number;
  active: boolean;
}

function getSeatPosition(index: number) {
  const angle = (index / TABLE_SEAT_COUNT) * 2 * Math.PI;
  const radius = 44;

  return {
    top: 50 + radius * Math.sin(angle),
    left: 50 + radius * Math.cos(angle),
  };
}

function CardDisplay({
  card,
  large,
  reveal,
}: {
  card: string;
  large?: boolean;
  reveal?: boolean;
}) {
  const isHidden = card === '??';
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === 'h' || suit === 'd';
  const w = reveal ? 'w-16 h-22' : large ? 'w-10 h-14' : 'w-8 h-11';

  if (isHidden) {
    return (
      <div
        className={`${w} rounded-lg flex items-center justify-center text-lg select-none font-bold`}
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)',
          border: '1px solid rgba(96,165,250,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          color: 'rgba(147,197,253,0.6)',
          fontSize: reveal ? '30px' : large ? '20px' : '16px',
        }}
      >
        ♦
      </div>
    );
  }

  return (
    <div
      className={`${w} rounded-lg flex flex-col items-center justify-center select-none`}
      style={{
        background: 'linear-gradient(160deg, #ffffff 0%, #f0f0f0 100%)',
        border: '1px solid rgba(0,0,0,0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        color: isRed ? '#dc2626' : '#111827',
      }}
    >
      <span className={`font-black leading-none ${reveal ? 'text-xl' : large ? 'text-sm' : 'text-[11px]'}`}>{rank}</span>
      <span className={`leading-none ${reveal ? 'text-2xl' : large ? 'text-base' : 'text-[12px]'}`}>{SUIT_SYMBOL[suit] ?? suit}</span>
    </div>
  );
}

function getMyUserId(): string {
  const token = getStoredToken();
  if (!token) {
    return '';
  }

  return getTokenPayload(token)?.sub ?? '';
}

const pageBg: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 50% 30%, #0a1f10 0%, #050d08 55%, #020405 100%)',
};

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [table, setTable] = useState<TableState | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [myUserId] = useState<string>(() => getMyUserId());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const { soundSettings } = useSoundSettings();
  const { t } = useTranslation();
  const [dealAnimations, setDealAnimations] = useState<Record<string, number>>({});
  const [chipFlights, setChipFlights] = useState<ChipFlight[]>([]);
  const [payoutFlights, setPayoutFlights] = useState<PayoutFlight[]>([]);
  const [winnerReveals, setWinnerReveals] = useState<WinnerReveal[]>([]);
  const [winnerHighlights, setWinnerHighlights] = useState<string[]>([]);
  const [loserHighlights, setLoserHighlights] = useState<string[]>([]);
  const previousTableRef = useRef<TableState | null>(null);
  const dealCleanupRef = useRef<number | null>(null);
  const chipCleanupRef = useRef<number | null>(null);
  const chipActivationRef = useRef<number | null>(null);
  const payoutCleanupRef = useRef<number | null>(null);
  const payoutActivationRef = useRef<number | null>(null);
  const winnerRevealActivationRef = useRef<number | null>(null);
  const winnerHighlightCleanupRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCountdownToneRef = useRef<string | null>(null);

  const handleBackToLobby = () => setShowLeaveConfirm(true);
  const roomPath = `/room/${id}`;

  const redirectToLogin = () => {
    handleExpiredSession({
      returnTo: roomPath,
    });
  };

  const redirectForExpiredToken = () => {
    handleExpiredSession({
      alertMessage: t('auth.sessionExpiredGameMsg'),
      returnTo: roomPath,
    });
  };

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
    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

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
      Math.max(0.0001, volume * normalizeSoundVolume(soundSettings.volume)),
      now + 0.02,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  const queueDealAnimations = (entries: Array<[string, number]>) => {
    if (entries.length === 0) {
      return;
    }

    if (soundSettings.deal) {
      playTone({
        type: 'triangle',
        frequency: 520,
        endFrequency: 410,
        duration: 0.16,
        volume: 0.03,
      });
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
  };

  const getDealAnimationStyle = (slotKey: string): React.CSSProperties | undefined => {
    const delay = dealAnimations[slotKey];
    if (delay === undefined) {
      return undefined;
    }

    return {
      animation: `dealCard ${DEAL_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both`,
      willChange: 'transform, opacity',
    };
  };

  const queueChipFlights = (flights: Omit<ChipFlight, 'active'>[]) => {
    if (flights.length === 0) {
      return;
    }

    if (chipActivationRef.current !== null) {
      window.cancelAnimationFrame(chipActivationRef.current);
    }
    if (chipCleanupRef.current !== null) {
      window.clearTimeout(chipCleanupRef.current);
    }

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

  const queuePayoutFlights = (flights: Omit<PayoutFlight, 'active'>[]) => {
    if (flights.length === 0) {
      return;
    }

    if (soundSettings.winner) {
      playTone({
        type: 'sine',
        frequency: 660,
        endFrequency: 980,
        duration: 0.26,
        volume: 0.04,
      });
      window.setTimeout(() => {
        playTone({
          type: 'sine',
          frequency: 880,
          endFrequency: 1320,
          duration: 0.3,
          volume: 0.035,
        });
      }, 120);
    }

    if (payoutActivationRef.current !== null) {
      window.cancelAnimationFrame(payoutActivationRef.current);
    }
    if (payoutCleanupRef.current !== null) {
      window.clearTimeout(payoutCleanupRef.current);
    }

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
  };

  const queueWinnerReveals = (reveals: Omit<WinnerReveal, 'active'>[]) => {
    if (winnerRevealActivationRef.current !== null) {
      window.cancelAnimationFrame(winnerRevealActivationRef.current);
      winnerRevealActivationRef.current = null;
    }

    if (reveals.length === 0) {
      setWinnerReveals([]);
      return;
    }

    setWinnerReveals(reveals.map((reveal) => ({ ...reveal, active: false })));

    winnerRevealActivationRef.current = window.requestAnimationFrame(() => {
      setWinnerReveals((prev) => prev.map((reveal) => ({ ...reveal, active: true })));
      winnerRevealActivationRef.current = null;
    });
  };

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
    if (!socket) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        socket.off('left_room', handleLeftRoom);
        window.clearTimeout(timeoutId);
      };

      const finish = (value: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(value);
      };

      const handleLeftRoom = () => {
        finish(true);
      };

      const timeoutId = window.setTimeout(() => {
        finish(false);
      }, 1200);

      socket.once('left_room', handleLeftRoom);
      socket.emit('leave_room');
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
      if (!getStoredToken()) {
        return;
      }

      setLeaving(false);
      setShowLeaveConfirm(false);
      disconnectSocket();
      router.push('/rooms');
    }
  };

  const playCountdownTone = (seconds: number, urgent: boolean) => {
    if (!soundSettings.countdown) {
      return;
    }

    playTone({
      type: urgent ? 'triangle' : 'sine',
      frequency: urgent ? 880 : 640,
      endFrequency: urgent ? 740 : 540,
      duration: urgent ? 0.32 : 0.22,
      volume: 0.045,
    });
  };

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

    socket.on('connect', () => {
      console.log('Connected to socket');
      const passwordKey = `room-password:${id as string}`;
      const roomPassword = sessionStorage.getItem(passwordKey) ?? undefined;
      sessionStorage.removeItem(passwordKey);
      socket.emit('join_room', { roomId: id, password: roomPassword });
    });

    socket.on('room_update', (data: TableState) => {
      console.log('Room update:', data);
      setTable(data);
    });

    socket.on('already_in_room', (data: { roomId: string }) => {
      if (data?.roomId) router.replace(`/room/${data.roomId}`);
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

    return () => { disconnectSocket(); };
  }, [id, router]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }

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
  }, [roomPath]);

  useEffect(() => {
    if (!table?.settlementEndsAt && !table?.readyCountdownEndsAt && !table?.actionEndsAt) {
      return;
    }

    setCountdownNow(Date.now());
    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [table?.actionEndsAt, table?.settlementEndsAt, table?.readyCountdownEndsAt]);

  useEffect(() => {
    if (!table) {
      return;
    }

    const previousTable = previousTableRef.current;
    if (previousTable) {
      const nextAnimations: Array<[string, number]> = [];
      const nextChipFlights: Omit<ChipFlight, 'active'>[] = [];
      const nextPayoutFlights: Omit<PayoutFlight, 'active'>[] = [];
      const nextWinnerReveals: Omit<WinnerReveal, 'active'>[] = [];
      const nextWinnerHighlights: string[] = [];
      const nextLoserHighlights: string[] = [];
      let animationIndex = 0;
      let chipAnimationIndex = 0;
      let payoutAnimationIndex = 0;

      const handJustStarted =
        previousTable.currentStage === 'WAITING' && table.currentStage !== 'WAITING';

      if (handJustStarted) {
        table.players.forEach((player, playerIndex) => {
          if (!player) {
            return;
          }

          player.cards.forEach((_, cardIndex) => {
            const previousCardCount = previousTable.players[playerIndex]?.cards.length ?? 0;
            if (cardIndex >= previousCardCount) {
              nextAnimations.push([
                `player-${playerIndex}-card-${cardIndex}`,
                animationIndex * DEAL_STAGGER_MS,
              ]);
              animationIndex += 1;
            }
          });
        });
      }

      if (table.communityCards.length > previousTable.communityCards.length) {
        table.communityCards.forEach((_, cardIndex) => {
          if (cardIndex < previousTable.communityCards.length) {
            return;
          }

          nextAnimations.push([
            `community-${cardIndex}`,
            animationIndex * DEAL_STAGGER_MS,
          ]);
          animationIndex += 1;
        });
      }

      table.players.forEach((player, playerIndex) => {
        if (!player || table.currentStage === 'WAITING') {
          return;
        }

        const previousBet = previousTable.players[playerIndex]?.bet ?? 0;
        if (player.bet <= previousBet) {
          return;
        }

        const seat = getSeatPosition(playerIndex);
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
        const winners = table.lastHandResult.filter((entry) => entry.winAmount > 0);
        const losers = table.lastHandResult.filter((entry) => entry.winAmount <= 0);
        winners.forEach((entry, winnerIndex) => {
            const playerIndex = table.players.findIndex((player) => player?.id === entry.playerId);
            if (playerIndex === -1) {
              return;
            }

            const seat = getSeatPosition(playerIndex);
            const player = table.players[playerIndex];
            nextPayoutFlights.push({
              id: `payout-flight-${Date.now()}-${entry.playerId}-${payoutAnimationIndex}`,
              amount: entry.winAmount,
              top: seat.top,
              left: seat.left,
              delay: payoutAnimationIndex * CHIP_FLIGHT_STAGGER_MS,
            });
            payoutAnimationIndex += 1;
            nextWinnerReveals.push({
              id: `winner-reveal-${Date.now()}-${entry.playerId}-${winnerIndex}`,
              playerId: entry.playerId,
              nickname: entry.nickname,
              handName: entry.handName,
              winAmount: entry.winAmount,
              cards: player?.cards ?? [],
              top: seat.top - 10,
              left: seat.left,
              centerOffsetX: (winnerIndex - (winners.length - 1) / 2) * 160,
            });
            nextWinnerHighlights.push(entry.playerId);
          });
        losers.forEach((entry) => {
          nextLoserHighlights.push(entry.playerId);
        });
      }

      queueDealAnimations(nextAnimations);
      queueChipFlights(nextChipFlights);
      queuePayoutFlights(nextPayoutFlights);
      queueWinnerReveals(nextWinnerReveals);
      queueWinnerHighlights(nextWinnerHighlights);
      queueLoserHighlights(nextLoserHighlights);
    } else if (!table.lastHandResult) {
      queueWinnerReveals([]);
      queueWinnerHighlights([]);
      queueLoserHighlights([]);
    }

    previousTableRef.current = table;
  }, [table]);

  useEffect(() => {
    return () => {
      if (dealCleanupRef.current !== null) {
        window.clearTimeout(dealCleanupRef.current);
      }
      if (chipCleanupRef.current !== null) {
        window.clearTimeout(chipCleanupRef.current);
      }
      if (chipActivationRef.current !== null) {
        window.cancelAnimationFrame(chipActivationRef.current);
      }
      if (payoutCleanupRef.current !== null) {
        window.clearTimeout(payoutCleanupRef.current);
      }
      if (payoutActivationRef.current !== null) {
        window.cancelAnimationFrame(payoutActivationRef.current);
      }
      if (winnerRevealActivationRef.current !== null) {
        window.cancelAnimationFrame(winnerRevealActivationRef.current);
      }
      if (winnerHighlightCleanupRef.current !== null) {
        window.clearTimeout(winnerHighlightCleanupRef.current);
      }
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  const handleAction = (action: string, amount?: number) => {
    const socket = getAuthorizedSocket();
    if (!socket) {
      return;
    }

    socket.emit('player_action', { roomId: id, action, amount });
  };

  const handleReady = () => {
    const socket = getAuthorizedSocket();
    if (!socket) {
      return;
    }

    socket.emit('player_ready');
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
    if (lastCountdownToneRef.current === toneKey) {
      return;
    }

    lastCountdownToneRef.current = toneKey;
    playCountdownTone(activeCountdown, activeCountdown <= 3);
  }, [activeCountdown, isActionStage, isSettlement]);

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
  const timeoutActionLabel = canCheck ? t('room.autoCheck') : t('room.autoFold');
  const winnerRevealPlayerIds = new Set(winnerReveals.map((reveal) => reveal.playerId));
  const winnerHighlightPlayerIds = new Set(winnerHighlights);
  const loserHighlightPlayerIds = new Set(loserHighlights);
  return (
    <div className="min-h-screen text-white relative overflow-hidden pb-24" style={pageBg}>

      {/* Subtle background suit symbols */}
      <div className="fixed inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-6 left-6 text-[8rem] font-serif opacity-[0.025] text-yellow-400 -rotate-12">♠</span>
        <span className="absolute bottom-8 right-6 text-[8rem] font-serif opacity-[0.025] text-yellow-400 rotate-6">♣</span>
      </div>

      {/* ── Leave confirmation modal ── */}
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
            <h3
              className="text-lg font-black tracking-widest uppercase mb-2"
              style={{ color: 'rgba(245,158,11,0.9)' }}
            >
            {t('room.exitRoom')}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(156,163,175,0.9)' }}>
            {t('room.exitConfirm')}
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

      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(234,179,8,0.1)', background: 'rgba(2,4,6,0.6)', backdropFilter: 'blur(8px)' }}
      >
        <Button
          className="h-8 px-4 text-xs font-bold tracking-widest uppercase rounded-lg transition-colors hover:bg-yellow-900/20"
          style={{ background: 'transparent', border: '1px solid rgba(234,179,8,0.25)', color: 'rgba(245,158,11,0.7)' }}
          onClick={handleBackToLobby}
        >
          ← Lobby
        </Button>

        <button
          type="button"
          className="absolute left-1/2 -translate-x-1/2 h-8 px-4 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg transition-colors hover:bg-yellow-900/20"
          style={{
            background: 'transparent',
            border: '1px solid rgba(234,179,8,0.2)',
            color: 'rgba(245,158,11,0.68)',
          }}
          onClick={() => window.open('/settings', '_blank', 'noopener,noreferrer')}
        >
          {t('room.settingsBtn')}
        </button>

        <div className="text-center">
          {isSettlement ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] tracking-[0.26em] uppercase font-semibold" style={{ color: 'rgba(251,191,36,0.78)' }}>
                {t('room.settling')}
              </span>
              <span
                className={isUrgentCountdown ? 'countdown-badge countdown-badge-urgent' : 'countdown-badge'}
                style={{
                  color: isUrgentCountdown ? '#fee2e2' : '#fef3c7',
                  borderColor: isUrgentCountdown ? 'rgba(248,113,113,0.5)' : 'rgba(251,191,36,0.35)',
                  background: isUrgentCountdown
                    ? 'radial-gradient(circle at 50% 50%, rgba(127,29,29,0.95) 0%, rgba(69,10,10,0.95) 100%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(120,53,15,0.92) 0%, rgba(68,32,10,0.95) 100%)',
                  boxShadow: isUrgentCountdown
                    ? '0 0 24px rgba(248,113,113,0.35)'
                    : '0 0 20px rgba(251,191,36,0.2)',
                }}
              >
                {settlementCountdown}s
              </span>
            </div>
          ) : isAutoReadyCountdown ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] tracking-[0.26em] uppercase font-semibold" style={{ color: 'rgba(74,222,128,0.82)' }}>
                {t('room.autoStartCountdown')}
              </span>
              <span
                className={isUrgentCountdown ? 'countdown-badge countdown-badge-urgent' : 'countdown-badge'}
                style={{
                  color: isUrgentCountdown ? '#ecfccb' : '#dcfce7',
                  borderColor: isUrgentCountdown ? 'rgba(250,204,21,0.45)' : 'rgba(74,222,128,0.35)',
                  background: isUrgentCountdown
                    ? 'radial-gradient(circle at 50% 50%, rgba(132,204,22,0.28) 0%, rgba(63,98,18,0.92) 100%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(22,101,52,0.95) 0%, rgba(6,78,59,0.95) 100%)',
                  boxShadow: isUrgentCountdown
                    ? '0 0 26px rgba(250,204,21,0.28)'
                    : '0 0 18px rgba(74,222,128,0.18)',
                }}
              >
                {readyCountdown}s
              </span>
            </div>
          ) : isWaiting ? (
            <span className="text-xs tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.6)' }}>
              {t('room.waitingReady', { ready: readyCount, total: seatedPlayers.length })}
            </span>
          ) : activePlayer ? (
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-xs font-semibold tracking-wider"
                style={{ color: isMyTurn ? '#fcd34d' : 'rgba(156,163,175,0.8)' }}
              >
                {isMyTurn ? t('room.yourTurn') : t('room.waitingPlayer', { nickname: activePlayer.nickname })}
              </span>
              {actionCountdown > 0 && (
                <span
                  className={isUrgentCountdown ? 'countdown-badge countdown-badge-urgent' : 'countdown-badge'}
                  style={{
                    minWidth: '74px',
                    height: '30px',
                    fontSize: '15px',
                    color: isMyTurn ? '#fef3c7' : 'rgba(219,234,254,0.95)',
                    borderColor: isUrgentCountdown ? 'rgba(248,113,113,0.5)' : 'rgba(96,165,250,0.35)',
                    background: isUrgentCountdown
                      ? 'radial-gradient(circle at 50% 50%, rgba(127,29,29,0.95) 0%, rgba(69,10,10,0.95) 100%)'
                      : 'radial-gradient(circle at 50% 50%, rgba(30,64,175,0.95) 0%, rgba(15,23,42,0.95) 100%)',
                    boxShadow: isUrgentCountdown
                      ? '0 0 24px rgba(248,113,113,0.3)'
                      : '0 0 20px rgba(59,130,246,0.22)',
                  }}
                >
                  {actionCountdown}s
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(107,114,128,0.6)' }}>
              {table.currentStage}
            </span>
          )}
        </div>

        <div className="text-right text-xs" style={{ color: 'rgba(107,114,128,0.5)', minWidth: '60px' }}>
          <span className={`tracking-widest uppercase ${activeCountdown > 0 ? 'countdown-text-glow' : ''}`}>
            {activeCountdown > 0 ? `${countdownLabel} ${activeCountdown}s` : table.currentStage}
          </span>
        </div>
      </div>

      {/* ── Poker table ── */}
      <div className="max-w-4xl mx-auto mt-8 px-4">
        <div
          className="rounded-[50%] border-[10px] aspect-[2/1] relative shadow-2xl"
          style={{
            background: 'radial-gradient(ellipse at 50% 45%, #0f5a28 0%, #083d19 50%, #041f0d 100%)',
            borderColor: '#78350f',
            boxShadow: '0 0 0 2px rgba(234,179,8,0.2), 0 0 80px rgba(0,0,0,0.9), inset 0 0 100px rgba(0,0,0,0.3)',
          }}
        >
          {/* Table inner gold ring */}
          <div
            className="absolute inset-3 rounded-[50%] pointer-events-none"
            style={{ border: '1px solid rgba(234,179,8,0.12)' }}
          />

          {/* Community cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
            <div
              className="absolute right-[calc(100%+18px)] top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            >
              <div className="relative w-10 h-14">
                <div className="absolute inset-0 rounded-lg bg-slate-950/80 border border-yellow-900/40" />
                <div className="absolute inset-[2px] rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 border border-blue-400/20" />
                <div className="absolute inset-[4px] rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#0f2540] flex items-center justify-center text-blue-200/50 font-black text-lg">
                  ♦
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {table.communityCards.length > 0
                ? table.communityCards.map((card, i) => (
                    <div key={i} style={getDealAnimationStyle(`community-${i}`)}>
                      <CardDisplay card={card} large />
                    </div>
                  ))
                : <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>{t('room.waitingForDeal')}</span>
              }
            </div>
          </div>

          {/* Pot */}
          <div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              className="px-4 py-1 rounded-full text-sm font-black tracking-wider"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(234,179,8,0.3)',
                color: '#fcd34d',
                boxShadow: '0 0 12px rgba(234,179,8,0.1)',
              }}
            >
              💰 ${table.pot}
            </div>
          </div>

          {winnerReveals.map((reveal) => (
            <div
              key={reveal.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
              style={{
                top: reveal.active ? '52%' : `${reveal.top}%`,
                left: reveal.active ? '50%' : `${reveal.left}%`,
                opacity: reveal.active ? 1 : 0.3,
                transform: reveal.active
                  ? `translate(calc(-50% + ${reveal.centerOffsetX}px), -50%) scale(1)`
                  : 'translate(-50%, -50%) scale(0.72)',
                transition:
                  'top 620ms cubic-bezier(0.22, 1, 0.36, 1), left 620ms cubic-bezier(0.22, 1, 0.36, 1), transform 620ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease',
                willChange: 'top, left, transform, opacity',
              }}
            >
              <div
                className="rounded-2xl px-4 py-3 min-w-[200px]"
                style={{
                  background: 'linear-gradient(160deg, rgba(20,83,45,0.86) 0%, rgba(6,78,59,0.95) 100%)',
                  border: '1px solid rgba(250,204,21,0.42)',
                  boxShadow: '0 0 30px rgba(250,204,21,0.16), 0 16px 36px rgba(0,0,0,0.45)',
                }}
              >
                <div className="flex justify-center gap-2 mb-3">
                  {reveal.cards.map((card, index) => (
                    <CardDisplay key={`${reveal.id}-${index}`} card={card} reveal />
                  ))}
                </div>
                <div className="text-center">
                  <div className="text-base font-black tracking-[0.08em] uppercase" style={{ color: '#fef3c7' }}>
                    🏆 {reveal.nickname}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'rgba(220,252,231,0.92)' }}>
                    {reveal.handName}
                  </div>
                  <div className="text-sm font-black mt-2" style={{ color: '#86efac' }}>
                    +${reveal.winAmount}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Flying chips */}
          {chipFlights.map((flight) => (
            <div
              key={flight.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
              style={{
                top: flight.active ? '36%' : `${flight.top}%`,
                left: flight.active ? '50%' : `${flight.left}%`,
                opacity: flight.active ? 0 : 1,
                transform: flight.active
                  ? 'translate(-50%, -50%) scale(0.72)'
                  : 'translate(-50%, -50%) scale(1)',
                transition: `top ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) ${flight.delay}ms, left ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) ${flight.delay}ms, transform ${CHIP_FLIGHT_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) ${flight.delay}ms, opacity 180ms ease ${flight.delay + CHIP_FLIGHT_MS - 120}ms`,
                willChange: 'top, left, transform, opacity',
              }}
            >
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-7 h-7 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #fef3c7 0%, #f59e0b 45%, #92400e 100%)',
                    boxShadow: '0 0 18px rgba(245,158,11,0.35), 0 4px 10px rgba(0,0,0,0.45)',
                    border: '2px solid rgba(120,53,15,0.85)',
                  }}
                />
                <span
                  className="relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(0,0,0,0.72)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    color: '#fcd34d',
                    transform: 'translateY(18px)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  +${flight.amount}
                </span>
              </div>
            </div>
          ))}

          {/* Payout chips */}
          {payoutFlights.map((flight) => (
            <div
              key={flight.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
              style={{
                top: flight.active ? `${flight.top}%` : '36%',
                left: flight.active ? `${flight.left}%` : '50%',
                opacity: flight.active ? 0.08 : 1,
                transform: flight.active
                  ? 'translate(-50%, -50%) scale(0.88)'
                  : 'translate(-50%, -50%) scale(0.74)',
                transition: `top ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${flight.delay}ms, left ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${flight.delay}ms, transform ${CHIP_FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${flight.delay}ms, opacity 220ms ease ${flight.delay + CHIP_FLIGHT_MS - 120}ms`,
                willChange: 'top, left, transform, opacity',
              }}
            >
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-8 h-8 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #fde68a 0%, #f59e0b 42%, #854d0e 100%)',
                    boxShadow: '0 0 22px rgba(251,191,36,0.4), 0 4px 12px rgba(0,0,0,0.5)',
                    border: '2px solid rgba(120,53,15,0.9)',
                  }}
                />
                <span
                  className="relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(6,78,59,0.8)',
                    border: '1px solid rgba(74,222,128,0.25)',
                    color: '#86efac',
                    transform: 'translateY(19px)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  +${flight.amount}
                </span>
              </div>
            </div>
          ))}

          {/* Players */}
          {table.players.map((player, i) => {
            if (!player) return null;
            const { top, left } = getSeatPosition(i);
            const isActive = table.activePlayerIndex === i;
            const isFolded = player.status === 'FOLD';
            const isMe = player.id === myUserId;
            const isWinnerHighlighted = winnerHighlightPlayerIds.has(player.id);
            const isLoserHighlighted = loserHighlightPlayerIds.has(player.id);

            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ top: `${top}%`, left: `${left}%` }}
              >
                {/* Hole cards above avatar */}
                {player.cards.length > 0 && !winnerRevealPlayerIds.has(player.id) && (
                  <div className="flex gap-1 mb-1">
                    {player.cards.map((c, ci) => (
                      <div key={ci} style={getDealAnimationStyle(`player-${i}-card-${ci}`)}>
                        <CardDisplay card={c} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Avatar circle */}
                <div
                  className={`relative transition-all duration-300 ${isWinnerHighlighted ? 'winner-avatar-highlight' : ''} ${isLoserHighlighted ? 'loser-avatar-dim' : ''}`}
                  style={{
                    opacity: isFolded ? 0.45 : isLoserHighlighted ? 0.62 : 1,
                    transform: isWinnerHighlighted
                      ? 'scale(1.08)'
                      : isLoserHighlighted
                        ? 'translateY(8px) scale(0.97)'
                        : 'scale(1)',
                  }}
                >
                  <UserAvatar
                    userId={player.id}
                    avatar={player.avatar}
                    size={68}
                    style={{
                      background: isFolded
                        ? 'rgba(0,0,0,0.5)'
                        : isMe
                          ? 'linear-gradient(160deg, rgba(20,40,28,0.95) 0%, rgba(8,20,12,0.98) 100%)'
                          : 'linear-gradient(160deg, rgba(12,22,16,0.95) 0%, rgba(6,12,9,0.98) 100%)',
                      border: isActive
                        ? '2px solid rgba(250,204,21,0.9)'
                        : isWinnerHighlighted
                          ? '2px solid rgba(250,204,21,0.85)'
                        : isMe
                          ? '2px solid rgba(234,179,8,0.35)'
                          : '2px solid rgba(255,255,255,0.1)',
                      boxShadow: isActive
                        ? '0 0 16px rgba(250,204,21,0.5), 0 0 32px rgba(250,204,21,0.2)'
                        : isWinnerHighlighted
                          ? '0 0 20px rgba(250,204,21,0.35), 0 0 36px rgba(74,222,128,0.14)'
                        : isLoserHighlighted
                          ? '0 2px 8px rgba(0,0,0,0.45)'
                        : '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  />
                  {/* Nickname overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-full bg-black/55 px-0.5 py-0.5 text-center pointer-events-none">
                    <div className="text-[9px] font-bold truncate" style={{ color: isMe ? '#fcd34d' : 'rgba(255,255,255,0.9)' }}>
                      {player.nickname}
                    </div>
                  </div>
                  {/* Stack chip top-right */}
                  <div className="absolute top-0.5 right-0.5 text-[8px] font-semibold leading-none" style={{ color: 'rgba(74,222,128,0.9)' }}>
                    ${player.stack}
                  </div>
                  {isWaiting && (
                    <div className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] font-bold tracking-wider whitespace-nowrap ${player.ready ? 'text-green-400' : 'text-gray-500'}`}>
                      {player.ready ? t('room.readyTag') : t('room.standby')}
                    </div>
                  )}
                  {isActionStage && isActive && actionCountdown > 0 && (
                    <div
                      className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 h-5 rounded-full flex items-center justify-center text-[9px] font-black tracking-[0.12em] ${
                        isUrgentCountdown ? 'seat-action-countdown seat-action-countdown-urgent' : 'seat-action-countdown'
                      }`}
                      style={{
                        background: isUrgentCountdown ? 'rgba(127,29,29,0.95)' : 'rgba(30,41,59,0.92)',
                        border: isUrgentCountdown
                          ? '1px solid rgba(248,113,113,0.5)'
                          : '1px solid rgba(96,165,250,0.35)',
                        color: isUrgentCountdown ? '#fee2e2' : '#dbeafe',
                        boxShadow: isUrgentCountdown
                          ? '0 0 16px rgba(248,113,113,0.25)'
                          : '0 0 14px rgba(59,130,246,0.18)',
                      }}
                    >
                      {actionCountdown}s
                    </div>
                  )}

                  {/* Position badges */}
                  <div className="absolute -top-1.5 -right-1 flex gap-0.5">
                    {isWinnerHighlighted && (
                      <span
                        className="text-[8px] font-black px-1.5 rounded-full leading-4"
                        style={{
                          background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
                          color: '#000',
                          boxShadow: '0 0 12px rgba(250,204,21,0.25)',
                        }}
                      >
                        WIN
                      </span>
                    )}
                    {player.isButton && (
                      <span
                        className="text-[8px] font-black px-1.5 rounded-full leading-4"
                        style={{ background: '#fcd34d', color: '#000' }}
                      >D</span>
                    )}
                    {player.isSmallBlind && (
                      <span
                        className="text-[8px] font-black px-1 rounded-full leading-4"
                        style={{ background: '#3b82f6', color: '#fff' }}
                      >SB</span>
                    )}
                    {player.isBigBlind && (
                      <span
                        className="text-[8px] font-black px-1 rounded-full leading-4"
                        style={{ background: '#ef4444', color: '#fff' }}
                      >BB</span>
                    )}
                  </div>
                </div>

                {/* Bet chip */}
                {player.bet > 0 && (
                  <div
                    className="mt-1 text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #92400e, #d97706)',
                      color: '#000',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    }}
                  >
                    ${player.bet}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div
        className="fixed bottom-0 left-0 w-full px-6 py-4 flex justify-center gap-3 items-center z-20"
        style={{
          background: 'linear-gradient(180deg, rgba(2,4,6,0) 0%, rgba(2,4,6,0.96) 40%, rgba(2,4,6,1) 100%)',
          borderTop: '1px solid rgba(234,179,8,0.1)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {isWaiting ? (
          <Button
            onClick={handleReady}
            className="h-11 px-10 font-black tracking-[0.2em] text-sm uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={isReady ? {
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
            } : {
              background: 'linear-gradient(135deg, #166534 0%, #16a34a 60%, #4ade80 100%)',
              color: '#000',
              border: 'none',
              boxShadow: '0 0 20px rgba(74,222,128,0.25)',
            }}
          >
            {isAutoReadyCountdown
              ? isReady
                ? t('room.readyCancelCountdown', { seconds: readyCountdown })
                : t('room.readyCancelled')
              : isReady
                ? t('room.readyCancel')
                : t('room.ready')}
          </Button>
        ) : isSettlement ? (
          <div
            className="h-11 px-6 rounded-xl flex items-center justify-center text-sm font-bold tracking-[0.15em] uppercase"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(234,179,8,0.15)',
              color: 'rgba(245,158,11,0.82)',
            }}
          >
            {t('room.settlementCountdown', { seconds: settlementCountdown })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className={`px-4 py-2 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase ${
                isMyTurn && isUrgentCountdown ? 'action-timeout-banner action-timeout-banner-urgent' : 'action-timeout-banner'
              }`}
              style={{
                background: isMyTurn
                  ? isUrgentCountdown
                    ? 'rgba(127,29,29,0.88)'
                    : 'rgba(30,41,59,0.9)'
                  : 'rgba(255,255,255,0.05)',
                border: isMyTurn
                  ? isUrgentCountdown
                    ? '1px solid rgba(248,113,113,0.45)'
                    : '1px solid rgba(96,165,250,0.28)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: isMyTurn
                  ? isUrgentCountdown
                    ? '#fee2e2'
                    : '#dbeafe'
                  : 'rgba(156,163,175,0.82)',
                boxShadow: isMyTurn && isUrgentCountdown ? '0 0 20px rgba(248,113,113,0.18)' : 'none',
              }}
            >
              {isMyTurn
                ? t('room.autoActionLabel', { seconds: actionCountdown, action: timeoutActionLabel })
                : activePlayer
                  ? `等待 ${activePlayer.nickname} 操作${actionCountdown > 0 ? ` · ${actionCountdown}s` : ''}`
                  : '等待操作'}
            </div>

            <div className="flex justify-center gap-3 items-center flex-wrap">
              <Button
                onClick={() => handleAction('fold')}
                disabled={!isMyTurn}
                className={`h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30 ${
                  !canCheck && isMyTurn && isUrgentCountdown ? 'action-auto-button action-auto-button-urgent' : ''
                }`}
                style={{
                  background: isMyTurn ? 'rgba(185,28,28,0.7)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: isMyTurn ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                  boxShadow: !canCheck && isMyTurn && isUrgentCountdown
                    ? '0 0 18px rgba(239,68,68,0.24)'
                    : 'none',
                }}
              >
                {!canCheck && isMyTurn ? t('room.foldCountdown', { seconds: actionCountdown }) : t('room.fold')}
              </Button>

              {canCheck ? (
                <Button
                  onClick={() => handleAction('check')}
                  disabled={!isMyTurn}
                  className={`h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30 ${
                    isMyTurn && isUrgentCountdown ? 'action-auto-button action-auto-button-urgent' : ''
                  }`}
                  style={{
                    background: isMyTurn ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(96,165,250,0.3)',
                    color: isMyTurn ? 'rgba(147,197,253,0.9)' : 'rgba(255,255,255,0.3)',
                    boxShadow: isMyTurn && isUrgentCountdown
                      ? '0 0 18px rgba(59,130,246,0.26)'
                      : 'none',
                  }}
                >
                  {isMyTurn ? t('room.checkCountdown', { seconds: actionCountdown }) : t('room.check')}
                </Button>
              ) : (
                <Button
                  onClick={() => handleAction('call')}
                  disabled={!isMyTurn}
                  className="h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity disabled:opacity-30"
                  style={{
                    background: isMyTurn ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(96,165,250,0.4)',
                    color: isMyTurn ? '#93c5fd' : 'rgba(255,255,255,0.3)',
                    boxShadow: isMyTurn ? '0 0 16px rgba(59,130,246,0.2)' : 'none',
                  }}
                >
                  {t('room.call', { amount: callAmount })}
                </Button>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-11 w-24 text-center font-bold rounded-lg border-0 text-white"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    color: isMyTurn ? '#fcd34d' : 'rgba(255,255,255,0.3)',
                  }}
                  value={raiseAmount || minRaiseTo}
                  min={minRaiseTo}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  disabled={!isMyTurn}
                />
                <Button
                  onClick={() => handleAction('raise', raiseAmount || minRaiseTo)}
                  disabled={!isMyTurn}
                  className="h-11 px-5 font-black tracking-wider text-xs uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
                  style={isMyTurn ? {
                    background: 'linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)',
                    color: '#000',
                    border: 'none',
                    boxShadow: '0 0 20px rgba(245,158,11,0.25)',
                  } : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.3)',
                  }}
                >
                  {t('room.raise')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

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
          0% {
            opacity: 0;
            transform: translateY(-24px) scale(0.72) rotate(-10deg);
            filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
          }
          65% {
            opacity: 1;
            transform: translateY(4px) scale(1.03) rotate(1deg);
            filter: drop-shadow(0 0 18px rgba(251, 191, 36, 0.35));
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
            filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
          }
        }

        @keyframes countdownPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        @keyframes countdownShake {
          0%,
          100% {
            transform: scale(1.08) translateX(0);
          }
          25% {
            transform: scale(1.12) translateX(-1px);
          }
          75% {
            transform: scale(1.12) translateX(1px);
          }
        }

        @keyframes winnerAvatarPulse {
          0%,
          100% {
            filter: drop-shadow(0 0 0 rgba(250, 204, 21, 0.1));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.38));
          }
        }

        @keyframes loserAvatarDip {
          0%,
          100% {
            filter: saturate(1);
          }
          50% {
            filter: saturate(0.75) brightness(0.9);
          }
        }
      `}</style>
    </div>
  );
}
