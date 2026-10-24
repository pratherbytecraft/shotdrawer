// A stand-in for the preload's window.shotdrawer, with the same function
// names (read from src/preload.ts). Every function the page calls is noted
// in calls as [name, ...args]. Settings, the login switch and Clear History
// change the state and send it back, like the main process does.
// emit(channel, payload) sends what an on... function listens for
// (onShown is 'shown', onCopied is 'copied').
import type { Settings, ShotdrawerApi, State } from '../../../src/shared/types';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export type Fake = ShotdrawerApi & {
  calls: unknown[][];
  emit: (channel: string, payload?: unknown) => void;
  state: State;
};

type Listener = (payload: unknown) => void;

export function fakeShotdrawer(names: string[], state: State): Fake {
  const calls: unknown[][] = [];
  const listeners: Record<string, Listener[]> = {};
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const emit = (channel: string, payload?: unknown) => (listeners[channel] || []).forEach((fn) => fn(payload));
  const changed = () => setTimeout(() => emit('state', copy(state)));
  const answers: Record<string, (...args: any[]) => unknown> = {
    getState: () => copy(state),
    details: (files: string[]) => Object.fromEntries(files.map((f, i) => [f, { thumb: PIXEL, size: { width: 1512 + i, height: 861 }, bytes: 295000 }])),
    set: (patch: Partial<Settings>) => {
      state.settings = { ...state.settings, ...patch };
      changed();
    },
    setLoginItem: (on: boolean) => {
      state.loginItem = { on, needsApproval: false };
      changed();
    },
    clearHistory: () => {
      state.shots = [];
      changed();
    }
  };
  const api: Record<string, unknown> = { calls, emit, state };
  for (const name of names) {
    if (/^on[A-Z]/.test(name)) {
      const channel = name[2].toLowerCase() + name.slice(3);
      api[name] = (fn: Listener) => {
        (listeners[channel] = listeners[channel] || []).push(fn);
        return () => {};
      };
    } else {
      api[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return name in answers ? Promise.resolve(answers[name](...args)) : undefined;
      };
    }
  }
  return api as unknown as Fake;
}
