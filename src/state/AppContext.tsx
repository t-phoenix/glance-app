import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { openExpoDb } from '@/src/db/expo';
import { RecallRepository } from '@/src/db/repository';
import { eventSeeds } from '@/src/data/seedEvents';
import { tickJobs } from '@/src/services/engine';
import { getSecret, SECRET, setSecret } from '@/src/services/secrets';
import { checkPassword, hashPassword, isLocking, lockoutMs, type LockConfig } from '@/src/services/appLock';
import { createId } from '@/src/lib/id';
import { dark, light, type Theme } from '@/src/ui/theme';

type Net = 'online' | 'offline' | 'captive' | 'degraded';
/** unlocked: done. password: show the password field. retry: Face ID was cancelled, offer it again. */
export type UnlockResult = 'unlocked' | 'password' | 'retry';

interface AppValue {
  repo: RecallRepository | null;
  revision: number;
  bump: () => void;
  toast: string | null;
  showToast: (message: string) => void;
  banner: string | null;
  net: Net;
  locked: boolean;
  unlock: () => Promise<UnlockResult>;
  /** Returns an error to show, or null once the password is right (and the app unlocks if it was locked). */
  enterPassword: (password: string) => Promise<string | null>;
  lock: LockConfig;
  setFaceLock: (on: boolean) => Promise<boolean>;
  setAppPassword: (password: string | null) => Promise<void>;
  themeName: 'dark' | 'light';
  theme: Theme;
  setThemeName: (value: 'dark' | 'light') => void;
}

const Ctx = createContext<AppValue | null>(null);

async function probe(): Promise<Net> {
  const started = Date.now();
  try {
    const response = await fetch('https://clients3.google.com/generate_204');
    const type = response.headers.get('content-type') ?? '';
    if (response.status === 200 && type.includes('html')) return 'captive';
    if (response.ok || response.status === 204) return Date.now() - started > 3000 ? 'degraded' : 'online';
    return 'offline';
  } catch {
    return 'offline';
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<RecallRepository | null>(null);
  const [revision, setRevision] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [net, setNet] = useState<Net>('online');
  const [locked, setLocked] = useState(true);
  const [themeName, setThemeName] = useState<'dark' | 'light'>('dark');
  const [onlineStreak, setOnlineStreak] = useState(0);
  const [lock, setLock] = useState<LockConfig>({ face: true, passcode: false });
  // refs, because Launch keeps the unlock from its first render, before the repo exists
  const lockRef = useRef<Promise<LockConfig> | null>(null);
  const misses = useRef({ count: 0, until: 0 });

  useEffect(() => {
    const database = openExpoDb();
    const next = new RecallRepository(database);
    next.seedEvents(eventSeeds());
    if (!next.setting('daily_cap')) next.setSetting('daily_cap', '2');
    const stored = next.setting('theme', 'dark');
    if (stored === 'light' || stored === 'dark') setThemeName(stored);
    // Face ID stays on by default, as before this setting existed
    lockRef.current = getSecret(SECRET.appPassword).then((password) => {
      const config = { face: next.setting('lock_face', '1') !== '0', passcode: Boolean(password) };
      setLock(config);
      return config;
    });
    setRepo(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const status = await probe();
      if (stopped) return;
      setOnlineStreak((count) => {
        const next = status === 'online' || status === 'degraded' ? count + 1 : 0;
        if (next >= 1) setNet(status);
        if (status === 'offline' || status === 'captive') setNet(status);
        return next;
      });
    };
    void tick();
    const timer = setInterval(() => void tick(), 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!repo || locked) return;
    const timer = setInterval(() => {
      void (async () => {
        const keys = { anthropic: (await getSecret(SECRET.anthropic)) ?? undefined, twitter: (await getSecret(SECRET.twitter)) ?? undefined };
        await tickJobs(repo, net === 'online' || net === 'degraded', keys);
        setRevision((value) => value + 1);
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [repo, locked, net]);

  useEffect(() => {
    let backgroundedAt = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt = Date.now();
      if (state === 'active' && backgroundedAt && Date.now() - backgroundedAt > 5 * 60 * 1000) {
        void lockRef.current?.then((config) => { if (isLocking(config)) setLocked(true); });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (net === 'offline') setBanner('Offline. Scans and notes still save.');
    else if (net === 'captive') setBanner('Venue Wi-Fi needs a login.');
    else if (net === 'degraded') setBanner('Slow connection. Paid lookups paused.');
    else setBanner(null);
  }, [net]);

  const value = useMemo<AppValue>(() => ({
    repo,
    revision,
    bump: () => setRevision((item) => item + 1),
    toast,
    showToast: setToast,
    banner,
    net,
    locked,
    unlock: async () => {
      const config = (await lockRef.current) ?? { face: true, passcode: false };
      const canFace = config.face && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!canFace) {
        if (config.passcode) return 'password';
        setLocked(false);
        return 'unlocked';
      }
      // with an app password set, a failed scan falls back to it instead of the phone passcode
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Glance', cancelLabel: config.passcode ? 'Use password' : 'Cancel', disableDeviceFallback: config.passcode });
      if (result.success) {
        setLocked(false);
        return 'unlocked';
      }
      return config.passcode ? 'password' : 'retry';
    },
    enterPassword: async (password) => {
      const wait = misses.current.until - Date.now();
      if (wait > 0) return `Too many tries. Wait ${Math.ceil(wait / 1000)} seconds.`;
      if (!checkPassword(password, await getSecret(SECRET.appPassword))) {
        misses.current.count += 1;
        misses.current.until = Date.now() + lockoutMs(misses.current.count);
        return 'That password is not right.';
      }
      misses.current = { count: 0, until: 0 };
      setLocked(false);
      return null;
    },
    lock,
    setFaceLock: async (on) => {
      // turning it off asks for Face ID first, so someone holding the open phone can't just switch it off
      if (!on && lock.face && (await LocalAuthentication.isEnrolledAsync())) {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn off Face ID lock', disableDeviceFallback: false });
        if (!result.success) return false;
      }
      repo?.setSetting('lock_face', on ? '1' : '0');
      const next = { ...lock, face: on };
      lockRef.current = Promise.resolve(next);
      setLock(next);
      return true;
    },
    setAppPassword: async (password) => {
      await setSecret(SECRET.appPassword, password ? hashPassword(password, createId('salt')) : '');
      const next = { ...lock, passcode: Boolean(password) };
      lockRef.current = Promise.resolve(next);
      setLock(next);
    },
    themeName,
    theme: themeName === 'light' ? light : dark,
    setThemeName: (next) => {
      setThemeName(next);
      repo?.setSetting('theme', next);
    },
  }), [repo, revision, toast, banner, net, locked, themeName, onlineStreak, lock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
