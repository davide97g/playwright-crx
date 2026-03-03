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

import type { Source } from '@recorder/recorderTypes';

const DB_NAME = 'playwright-recorder-sessions';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

export type StepState = { currentStepIndex: number; stepDescriptions: string[] };

export type PersistedSession = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sources: Source[];
  stepState: StepState;
  stepBodies: string[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

export async function saveSession(session: PersistedSession): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const now = Date.now();
    const toSave: PersistedSession = {
      ...session,
      updatedAt: now,
      createdAt: session.createdAt || now,
    };
    const request = store.put(toSave);
    request.onerror = () => { db.close(); reject(request.error); };
    request.onsuccess = () => { db.close(); resolve(); };
  });
}

export async function getSessions(): Promise<PersistedSession[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('updatedAt');
    const request = index.getAll();
    request.onerror = () => { db.close(); reject(request.error); };
    request.onsuccess = () => {
      const sessions = (request.result as PersistedSession[])
          .sort((a, b) => b.updatedAt - a.updatedAt);
      db.close();
      resolve(sessions);
    };
  });
}

export async function getSession(id: string): Promise<PersistedSession | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => { db.close(); reject(request.error); };
    request.onsuccess = () => {
      db.close();
      resolve(request.result as PersistedSession | undefined);
    };
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => { db.close(); reject(request.error); };
    request.onsuccess = () => { db.close(); resolve(); };
  });
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function defaultSessionName(): string {
  const d = new Date();
  return `Session ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
