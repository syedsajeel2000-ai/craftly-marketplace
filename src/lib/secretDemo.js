/**
 * Secret unlock for the demo-account panel.
 *
 * The demo credentials are hidden by default. They are revealed only when the
 * visitor holds CapsLock ON and types the passphrase "secretdemo" — so the
 * panel is never advertised on the login page, but anyone testing the demo
 * can still get to it.
 *
 *   CapsLock ON + type  s e c r e t d e m o   →  panel appears
 *
 * Notes:
 * - With CapsLock on, `event.key` arrives upper-cased, so keys are compared
 *   case-insensitively.
 * - The buffer resets on any non-letter key, on a 4s pause, or as soon as the
 *   typed prefix can no longer match — so stray typing never leaks the phrase.
 * - Unlocking is remembered for the tab session (sessionStorage) so users do
 *   not have to repeat it on every navigation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const PHRASE = 'secretdemo';
const STORAGE_KEY = 'craftly:secretdemo-unlocked';
const RESET_AFTER_MS = 4000;

/**
 * @param {(reason: string) => void} [onUnlock] called once, with a short status
 *   message, when the phrase is completed.
 */
export function useSecretDemo(onUnlock) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const buffer = useRef('');
  const timer = useRef(null);

  const lock = useCallback(() => {
    buffer.current = '';
    setUnlocked(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode — in-memory state is enough */
    }
  }, []);

  const unlock = useCallback(() => {
    setUnlocked(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (unlocked) return undefined;

    const reset = () => {
      buffer.current = '';
      clearTimeout(timer.current);
    };

    const onKeyDown = (event) => {
      // CapsLock must be held — this is the secret gesture.
      if (typeof event.getModifierState === 'function' && !event.getModifierState('CapsLock')) {
        if (/^[a-z]$/i.test(event.key)) reset();
        return;
      }

      const key = (event.key || '').toLowerCase();
      if (!/^[a-z]$/.test(key)) {
        reset();
        return;
      }

      buffer.current += key;
      clearTimeout(timer.current);
      timer.current = setTimeout(reset, RESET_AFTER_MS);

      if (buffer.current === PHRASE) {
        reset();
        unlock();
        onUnlock?.('Demo accounts unlocked');
      } else if (!PHRASE.startsWith(buffer.current)) {
        // typed past the phrase — start over
        reset();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer.current);
    };
  }, [unlocked, unlock, onUnlock]);

  return { unlocked, lock };
}
