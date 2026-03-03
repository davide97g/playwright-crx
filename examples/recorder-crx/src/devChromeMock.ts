/**
 * Copyright (c) Rui Figueira.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * When running under Vite dev server (not loaded as a Chrome extension),
 * chrome.* APIs are undefined. This module installs a minimal mock so the
 * Playwright sidebar UI can be opened and tested locally at e.g. http://localhost:5173
 */
function installDevChromeMock() {
  const g = globalThis as { chrome?: { runtime?: { connect?: unknown } } };
  if (g.chrome?.runtime?.connect)
    return;

  const noop = () => {};
  const mockPort = {
    onMessage: { addListener: noop, removeListener: noop },
    postMessage: noop,
    disconnect: noop,
  };

  const storageListeners: Array<(changes: Record<string, unknown>) => void> = [];
  const defaultStorage: Record<string, unknown> = {
    testIdAttributeName: 'data-testid',
    targetLanguage: 'playwright-test',
    sidepanel: true,
    experimental: false,
    playInIncognito: false,
  };
  let stored: Record<string, unknown> = {};

  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      connect: (_opts?: { name?: string }) => mockPort,
      sendMessage: (_msg: unknown, cb?: (v: unknown) => void) => {
        if (typeof cb === 'function')
          cb(undefined);
      },
    },
    storage: {
      sync: {
        get: () => Promise.resolve({ ...defaultStorage, ...stored }),
        set: (items: Record<string, unknown>) => {
          stored = { ...stored, ...items };
          for (const fn of storageListeners)
            fn(items);
          return Promise.resolve();
        },
        onChanged: {
          addListener: (fn: (changes: Record<string, unknown>) => void) => {
            storageListeners.push(fn);
          },
          removeListener: (fn: (changes: Record<string, unknown>) => void) => {
            const i = storageListeners.indexOf(fn);
            if (i !== -1)
              storageListeners.splice(i, 1);
          },
        },
      },
    },
    extension: {
      isAllowedIncognitoAccess: () => Promise.resolve(false),
    },
    action: {},
    tabs: {},
    contextMenus: {},
    commands: {},
    sidePanel: {},
  };
}

installDevChromeMock();
