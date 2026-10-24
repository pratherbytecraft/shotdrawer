// A stand-in for the preload's window.shotdrawer, with the same function
// names (read from src/preload.ts). Every function the page calls is noted
// in calls as [name, ...args]. Settings, the login switch and Clear History
// change the state and send it back, like the main process does.
// emit(channel, payload) sends what an on... function listens for
// (onShown is 'shown', onCopied is 'copied').
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function fakeShotdrawer(names, state) {
  const calls = [];
  const listeners = {};
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const emit = (channel, payload) => (listeners[channel] || []).forEach((fn) => fn(payload));
  const changed = () => setTimeout(() => emit('state', copy(state)));
  const answers = {
    getState: () => copy(state),
    details: (files) => Object.fromEntries(files.map((f, i) => [f, { thumb: PIXEL, size: { width: 1512 + i, height: 861 }, bytes: 295000 }])),
    set: (patch) => {
      state.settings = { ...state.settings, ...patch };
      changed();
    },
    setLoginItem: (on) => {
      state.loginItem = { on, needsApproval: false };
      changed();
    },
    clearHistory: () => {
      state.shots = [];
      changed();
    }
  };
  const api = { calls, emit, state };
  for (const name of names) {
    if (/^on[A-Z]/.test(name)) {
      const channel = name[2].toLowerCase() + name.slice(3);
      api[name] = (fn) => {
        (listeners[channel] = listeners[channel] || []).push(fn);
        return () => {};
      };
    } else {
      api[name] = (...args) => {
        calls.push([name, ...args]);
        return name in answers ? Promise.resolve(answers[name](...args)) : undefined;
      };
    }
  }
  return api;
}
