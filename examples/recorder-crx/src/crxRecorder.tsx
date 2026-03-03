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

import * as React from 'react';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import { Dialog } from './dialog';
import { PreferencesForm } from './preferencesForm';
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';
import type { RecorderHandle, SessionSnapshot } from '@recorder/recorder';
import { Recorder } from '@recorder/recorder';
import type { CrxSettings } from './settings';
import type { PersistedSession } from './sessionsDb';
import { defaultSessionName, deleteSession as deleteSessionDb, generateSessionId, getSession as getSessionDb, getSessions as getSessionsDb, saveSession as saveSessionDb } from './sessionsDb';
import { SessionListView } from './SessionListView';
import { addSettingsChangedListener, defaultSettings, loadSettings, removeSettingsChangedListener } from './settings';
import ModalContainer, { create as createModal } from 'react-modal-promise';
import { SaveCodeForm } from './saveCodeForm';
import './crxRecorder.css';
import './form.css';

function setElementPicked(elementInfo: ElementInfo, userGesture?: boolean) {
  window.playwrightElementPicked(elementInfo, userGesture);
}

function setRunningFileId(fileId: string) {
  window.playwrightSetRunningFile(fileId);
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function generateDatetimeSuffix() {
  return new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '-');
}

const codegenFilenames: Record<string, string> = {
  'javascript': 'example.js',
  'playwright-test': 'example.spec.ts',
  'java-junit': 'TestExample.java',
  'java': 'Example.java',
  'python-pytest': 'test_example.py',
  'python': 'example.py',
  'python-async': 'example.py',
  'csharp-mstest': 'Tests.cs',
  'csharp-nunit': 'Tests.cs',
  'csharp': 'Example.cs',
};

type RecorderPortMessage = {
  type: string;
  method?: string;
  paused?: boolean;
  mode?: Mode;
  sources?: Source[];
  callLogs?: CallLog[];
  file?: string;
  stepState?: { currentStepIndex: number; stepDescriptions: string[] };
  stepBodies?: string[];
  elementInfo?: ElementInfo;
  userGesture?: boolean;
};

type DispatchData = {
  event: string;
  params?: Record<string, unknown> & { file?: string };
};

export const CrxRecorder: React.FC = () => {
  const recorderRef = React.useRef<RecorderHandle>(null);
  const [settings, setSettings] = React.useState<CrxSettings>(defaultSettings);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [log, setLog] = React.useState(new Map<string, CallLog>());
  const [mode, setMode] = React.useState<Mode>('none');
  const [selectedFileId, setSelectedFileId] = React.useState<string>(defaultSettings.targetLanguage);
  const [sessions, setSessions] = React.useState<PersistedSession[]>([]);
  const [sessionTitle, setSessionTitle] = React.useState('');
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = React.useState(0);

  React.useEffect(() => {
    const port = chrome.runtime.connect({ name: 'recorder' });
    const onMessage = (msg: RecorderPortMessage) => {
      if (!('type' in msg) || msg.type !== 'recorder')
        return;

      switch (msg.method) {
        case 'setPaused':
          if (msg.paused !== undefined) setPaused(msg.paused);
          break;
        case 'setMode':
          if (msg.mode !== undefined) setMode(msg.mode);
          break;
        case 'setSources':
          if (msg.sources !== undefined) setSources(msg.sources);
          break;
        case 'resetCallLogs': setLog(new Map()); break;
        case 'updateCallLogs': {
          const callLogs = msg.callLogs;
          if (callLogs)
            setLog(log => {
              const newLog = new Map<string, CallLog>(log);
              for (const callLog of callLogs) {
                callLog.reveal = !log.has(callLog.id);
                newLog.set(callLog.id, callLog);
              }
              return newLog;
            });
          break;
        }
        case 'setRunningFile':
          if (msg.file !== undefined) setRunningFileId(msg.file);
          break;
        case 'setStepState': {
          if (typeof window.playwrightSetStepState === 'function' && msg.stepState)
            window.playwrightSetStepState(msg.stepState, msg.stepBodies);
          break;
        }
        case 'elementPicked':
          if (msg.elementInfo) setElementPicked(msg.elementInfo, msg.userGesture);
          break;
      }
    };
    port.onMessage.addListener(onMessage);

    window.dispatch = async (data: DispatchData) => {
      port.postMessage({ type: 'recorderEvent', ...data });
      if (data.event === 'fileChanged' && data.params?.file !== undefined)
        setSelectedFileId(data.params.file);
    };
    loadSettings().then(settings => {
      setSettings(settings);
      setSelectedFileId(settings.targetLanguage);
    }).catch(() => {});

    addSettingsChangedListener(setSettings);

    getSessionsDb().then(setSessions).catch(() => {});

    return () => {
      removeSettingsChangedListener(setSettings);
      port.disconnect();
    };
  }, []);

  const refreshSessions = React.useCallback(() => {
    getSessionsDb().then(setSessions).catch(() => {});
  }, []);

  const handleSaveCurrentSession = React.useCallback(() => {
    const snapshot = recorderRef.current?.getSessionSnapshot();
    if (!snapshot || !sources.length)
      return;
    const now = Date.now();
    const id = generateSessionId();
    const session: PersistedSession = {
      id,
      name: sessionTitle.trim() || defaultSessionName(),
      createdAt: now,
      updatedAt: now,
      sources,
      stepState: snapshot.stepState ?? { currentStepIndex: 0, stepDescriptions: ['Start'] },
      stepBodies: snapshot.stepBodies.length ? snapshot.stepBodies : [''],
    };
    setCurrentSessionId(id);
    saveSessionDb(session).then(refreshSessions).catch(() => {});
  }, [sources, sessionTitle, refreshSessions]);

  const handleLoadSession = React.useCallback((session: PersistedSession) => {
    setCurrentSessionId(session.id);
    setSessionTitle(session.name);
    window.dispatch({ event: 'loadSession', params: { sources: session.sources, stepState: session.stepState, stepBodies: session.stepBodies } });
  }, []);

  const handleRenameSession = React.useCallback(async (id: string, newName: string) => {
    const session = await getSessionDb(id);
    if (!session)
      return;
    await saveSessionDb({ ...session, name: newName });
    refreshSessions();
  }, [refreshSessions]);

  const handleDeleteSession = React.useCallback((id: string) => {
    deleteSessionDb(id).then(refreshSessions).catch(() => {});
  }, [refreshSessions]);

  const sessionsTabContent = React.useMemo(() => (
    <SessionListView
      sessions={sessions}
      onSaveCurrent={handleSaveCurrentSession}
      onRestart={handleLoadSession}
      onRename={handleRenameSession}
      onDelete={handleDeleteSession}
      saveDisabled={!sources.length}
    />
  ), [sessions, handleSaveCurrentSession, handleLoadSession, handleRenameSession, handleDeleteSession, sources.length]);

  const source = React.useMemo(() => sources.find(s => s.id === selectedFileId), [sources, selectedFileId]);

  const requestStorageState = React.useCallback(() => {
    if (!settings.experimental)
      return;

    chrome.runtime.sendMessage({ event: 'storageStateRequested' }).then(storageState => {
      const fileSuffix = generateDatetimeSuffix();
      download(`storageState-${fileSuffix}.json`, JSON.stringify(storageState, null, 2));
    });
  }, [settings]);

  const showPreferences = React.useCallback(() => {
    const modal = createModal(({ isOpen, onResolve }) =>
      <Dialog title='Preferences' isOpen={isOpen} onClose={onResolve}>
        <PreferencesForm />
      </Dialog>
    );
    modal().catch(() => {});
  }, []);

  const saveCode = React.useCallback(() => {
    if (!settings.experimental)
      return;

    const modal = createModal(({ isOpen, onResolve, onReject }) => {
      return <Dialog title='Save code' isOpen={isOpen} onClose={onReject}>
        <SaveCodeForm onSubmit={onResolve} suggestedFilename={codegenFilenames[selectedFileId]} />
      </Dialog>;
    });
    modal()
        .then(({ filename }) => {
          const code = source?.text;
          if (!code)
            return;

          download(filename, code);
        })
        .catch(() => {});
  }, [settings, source, selectedFileId]);

  React.useEffect(() => {
    if (!settings.experimental)
      return;

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCode();
      }
    };
    window.addEventListener('keydown', keydownHandler);

    return () => {
      window.removeEventListener('keydown', keydownHandler);
    };
  }, [settings, saveCode]);

  const dispatchEditedCode = React.useCallback((code: string) => {
    window.dispatch({ event: 'codeChanged', params: { code } });
  }, []);

  const dispatchCursorActivity = React.useCallback((position: { line: number }) => {
    window.dispatch({ event: 'cursorActivity', params: { position } });
  }, []);

  const onSessionSnapshotChange = React.useCallback((_snapshot: SessionSnapshot) => {
    setSnapshotVersion(v => v + 1);
  }, []);

  const performAutoSave = React.useCallback(async () => {
    const snapshot = recorderRef.current?.getSessionSnapshot();
    if (!snapshot || !sources.length)
      return;
    const now = Date.now();
    const stepState = snapshot.stepState ?? { currentStepIndex: 0, stepDescriptions: ['Start'] };
    const stepBodies = snapshot.stepBodies.length ? snapshot.stepBodies : [''];
    const name = sessionTitle.trim() || defaultSessionName();

    if (currentSessionId) {
      const existing = await getSessionDb(currentSessionId);
      if (existing) {
        await saveSessionDb({
          ...existing,
          name,
          updatedAt: now,
          sources,
          stepState,
          stepBodies,
        });
        refreshSessions();
        return;
      }
    }
    const id = generateSessionId();
    setCurrentSessionId(id);
    await saveSessionDb({
      id,
      name,
      createdAt: now,
      updatedAt: now,
      sources,
      stepState,
      stepBodies,
    });
    refreshSessions();
  }, [sources, sessionTitle, currentSessionId, refreshSessions]);

  // Re-run when session title, sources, or step snapshot change to reset debounce timer
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps intentionally include sessionTitle, sources, snapshotVersion
  React.useEffect(() => {
    const timeout = window.setTimeout(performAutoSave, 800);
    return () => window.clearTimeout(timeout);
  }, [sessionTitle, sources, snapshotVersion, performAutoSave]);

  return <>
    <ModalContainer />

    <div className='recorder'>
      {settings.experimental && <>
        <Toolbar>
          <ToolbarButton icon='save' title='Save' disabled={false} onClick={saveCode}>Save</ToolbarButton>
          <div style={{ flex: 'auto' }}></div>
          <div className='dropdown'>
            <ToolbarButton icon='tools' title='Tools' disabled={false} onClick={() => {}}></ToolbarButton>
            <div className='dropdown-content right-align'>
              <button type='button' className='dropdown-link' onClick={requestStorageState}>Download storage state</button>
            </div>
          </div>
          <ToolbarSeparator />
          <ToolbarButton icon='settings-gear' title='Preferences' onClick={showPreferences}></ToolbarButton>
        </Toolbar>
      </>}
      <Recorder
        ref={recorderRef}
        sources={sources}
        paused={paused}
        log={log}
        mode={mode}
        onEditedCode={dispatchEditedCode}
        onCursorActivity={dispatchCursorActivity}
        sessionsTabContent={sessionsTabContent}
        sessionTitle={sessionTitle}
        onSessionTitleChange={setSessionTitle}
        onSessionSnapshotChange={onSessionSnapshotChange}
      />
    </div>
  </>;
};
