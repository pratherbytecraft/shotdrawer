// What the main process and the pages say to each other: the state the
// pages draw from, the settings, and every message between them. The
// preload, src/main/ipc.ts and the pages all use these, so a message with
// the wrong name or the wrong payload fails the type check.

export type Layout = 'list' | 'grid';
export type CopyFormat = 'newline' | 'space' | 'quoted';
export type ShowIn = 'filedrawer' | 'finder';
export type MenuBarIcon = 'auto' | 'always';

export interface Settings {
  historySize: number;
  layout: Layout;
  copyFormat: CopyFormat;
  showIn: ShowIn;
  menuBarIcon: MenuBarIcon;
  closeAfterCopy: boolean;
  bigLook: boolean;
}

// One screenshot in the list: its path and when the file was made, in ms.
export interface Shot {
  path: string;
  at: number;
}

// Whether the screenshot folder could be read.
export type Access = 'ok' | 'missing' | 'denied';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

// What a row shows about a screenshot. thumb is a data URL.
export interface ShotInfo {
  thumb: string | null;
  size: Size | null;
  bytes: number;
  mtime: number;
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'current' | 'available' | 'failed';
  latest?: string;
}

export interface LoginItem {
  on: boolean;
  needsApproval: boolean;
}

export type SiblingKey = 'startbar' | 'filedrawer';

// A row in the About page's Also from Prather Bytecraft group.
export interface Sibling {
  key: SiblingKey;
  name: string;
  desc: string;
  installed: boolean;
  line: string;
}

export interface State {
  version: string;
  folder: string | null;
  access: Access | null;
  shots: Shot[];
  settings: Settings;
  viewer: 'Filedrawer' | 'Finder';
  filedrawer: boolean;
  startbar: boolean;
  loginItem: LoginItem;
  update: UpdateStatus;
  updateCommand: string;
  siblings: Sibling[];
}

// What the big look shows.
export interface Look {
  src: string;
  name: string;
  size: Size | null;
  bytes: number;
  hint: boolean;
}

export type LinkKey = 'website' | 'github' | 'community' | 'kofi';
export type SettingsPage = 'general' | 'look' | 'about';

// Pages to main, answered: the arguments and the answer.
export interface Invokes {
  state: { args: []; result: State };
  'shots:details': { args: [files: string[]]; result: Record<string, ShotInfo> };
}

// Pages to main, one way: the arguments.
export interface Sends {
  'panel:height': [height: number];
  'panel:hide': [];
  'app:quit': [];
  'shot:copy': [file: string];
  'shots:copy': [files: string[]];
  'shot:show': [file: string];
  'shot:menu': [file: string, picked: string[]];
  'shots:drag': [files: string[], picture: string | null | undefined];
  'shots:trash': [files: string[]];
  'look:show': [file: string, row: Rect, keys: boolean];
  'look:hide': [];
  'settings:open': [page?: SettingsPage];
  'settings:set': [patch: Partial<Settings>];
  'login:set': [on: boolean];
  'updates:check': [];
  'text:copy': [text: string];
  'link:open': [key: LinkKey];
  'sibling:open': [key: SiblingKey];
  'folder:show': [];
  'folder:change': [];
  'history:clear': [];
  'history:unremove': [files: string[]];
  'folder:menu': [];
  'privacy:open': [];
}

// Main to pages: the payload.
export interface Events {
  state: State;
  'panel:shown': void;
  'look:show': Look;
  copied: string;
  'settings:page': SettingsPage;
  removed: string[];
}

type Listen<T> = (fn: (payload: T) => void) => () => void;

// window.shotdrawer, given to the pages by the preload.
export interface ShotdrawerApi {
  getState(): Promise<State>;
  onState: Listen<State>;
  onShown: Listen<void>;
  setHeight(height: number): void;
  hide(): void;
  quit(): void;
  details(files: string[]): Promise<Record<string, ShotInfo>>;
  copy(file: string): void;
  copyMany(files: string[]): void;
  show(file: string): void;
  menu(file: string, picked: string[]): void;
  drag(files: string[], picture: string | null | undefined): void;
  trash(files: string[]): void;
  look(file: string, row: Rect, keys: boolean): void;
  lookHide(): void;
  onLook: Listen<Look>;
  onCopied: Listen<string>;
  openSettings(page?: SettingsPage): void;
  onSettingsPage: Listen<SettingsPage>;
  set(patch: Partial<Settings>): void;
  setLoginItem(on: boolean): void;
  checkUpdates(): void;
  copyText(text: string): void;
  openLink(key: LinkKey): void;
  openSibling(key: SiblingKey): void;
  showFolder(): void;
  changeFolder(): void;
  clearHistory(): void;
  unremove(files: string[]): void;
  onRemoved: Listen<string[]>;
  folderMenu(): void;
  openPrivacy(): void;
}
