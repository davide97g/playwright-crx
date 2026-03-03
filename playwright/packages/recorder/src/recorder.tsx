/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { CallLog, ElementInfo, Mode, Source } from './recorderTypes';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { SourceHighlight } from '@web/components/codeMirrorWrapper';
import { SplitView } from '@web/components/splitView';
import { TabbedPane } from '@web/components/tabbedPane';
import { Toolbar } from '@web/components/toolbar';
import { emptySource, SourceChooser } from '@web/components/sourceChooser';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import * as React from 'react';
import { CallLogView } from './callLog';
import { TestCaseView } from './testCaseView';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { toggleTheme } from '@web/theme';
import { copy, useSetting } from '@web/uiUtils';
import yaml from 'yaml';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';

export type RecorderViewMode = 'code' | 'testCase';

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
  onEditedCode?: (code: string) => any,
  onCursorActivity?: (position: { line: number }) => any,
}

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
  onEditedCode,
  onCursorActivity,
}) => {
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const [runningFileId, setRunningFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useSetting<string>('recorderPropertiesTab', 'log');
  const [ariaSnapshot, setAriaSnapshot] = React.useState<string | undefined>();
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();
  const [selectorFocusOnChange, setSelectorFocusOnChange] = React.useState<boolean | undefined>(true);
  const [stepState, setStepState] = React.useState<{ currentStepIndex: number; stepDescriptions: string[] } | null>(null);
  const [nextStepDescription, setNextStepDescription] = React.useState('');
  const [viewingStepIndex, setViewingStepIndex] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<RecorderViewMode>('code');
  const [stepBodies, setStepBodies] = React.useState<string[]>(['']);

  React.useEffect(() => {
    window.playwrightSetStepState = (state: { currentStepIndex: number; stepDescriptions: string[] }) => setStepState(state);
    return () => {
      window.playwrightSetStepState = undefined;
    };
  }, []);

  React.useEffect(() => {
    if (stepState)
      setViewingStepIndex(stepState.currentStepIndex);
  }, [stepState?.currentStepIndex]);

  React.useEffect(() => {
    if (!stepState) return;
    const count = Math.max(1, stepState.stepDescriptions.length);
    setStepBodies(prev => {
      if (prev.length >= count) return prev.slice(0, count);
      return [...prev, ...Array(count - prev.length).fill('')];
    });
  }, [stepState?.stepDescriptions?.length]);

  const fileId = selectedFileId || runningFileId || sources[0]?.id;
  const isRecording = ['recording', 'recording-inspecting', 'assertingText', 'assertingVisibility', 'assertingValue', 'assertingSnapshot'].includes(mode);
  const currentStepLabel = stepState ? (stepState.stepDescriptions[stepState.currentStepIndex] ?? 'Start') : 'Start';

  const source = React.useMemo(() => {
    if (fileId) {
      const source = sources.find(s => s.id === fileId);
      if (source)
        return source;
    }
    return emptySource();
  }, [sources, fileId]);

  const stepLineNumbers = React.useMemo(() => {
    const lines: number[] = [];
    const text = source?.text ?? '';
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (/^\s*(\/\/|#)\s*STEP\s+\d+:/.test(parts[i])) {
        lines.push(i + 1);
      }
    }
    if (lines.length === 0 && text.trim().length > 0)
      lines.push(1);
    return lines;
  }, [source?.text]);

  const stepCount = Math.max(1, stepState?.stepDescriptions?.length ?? 1);
  const stepRevealLine = viewingStepIndex >= 0 && viewingStepIndex < stepLineNumbers.length ? stepLineNumbers[viewingStepIndex] : undefined;
  const codeRevealLine = stepRevealLine ?? source?.revealLine;

  const stepCodeBlocks = React.useMemo(() => {
    const text = source?.text ?? '';
    const parts = text.split(/\r?\n/);
    const blocks: string[] = [];
    for (let i = 0; i < stepLineNumbers.length; i++) {
      const startIdx = stepLineNumbers[i] - 1;
      const endIdx = stepLineNumbers[i + 1] !== undefined ? stepLineNumbers[i + 1] - 1 : parts.length;
      blocks.push(parts.slice(startIdx, endIdx).join('\n'));
    }
    if (blocks.length === 0 && text.trim().length > 0)
      blocks.push(text);
    return blocks;
  }, [source?.text, stepLineNumbers]);

  const codeHighlight = React.useMemo(() => {
    const base = source?.highlight ?? [];
    if (stepRevealLine == null)
      return base;
    return [...base, { line: stepRevealLine, type: 'running' as const, message: 'Step' }];
  }, [source?.highlight, stepRevealLine]);

  const [locator, setLocator] = React.useState('');
  window.playwrightElementPicked = (elementInfo: ElementInfo, userGesture?: boolean) => {
    const language = source.language;
    setLocator(asLocator(language, elementInfo.selector));
    setAriaSnapshot(elementInfo.ariaSnapshot);
    setAriaSnapshotErrors([]);
    setSelectorFocusOnChange(userGesture);

    if (userGesture && selectedTab !== 'locator' && selectedTab !== 'aria')
      setSelectedTab('locator');

    if (mode === 'inspecting' && selectedTab === 'aria') {
      // Keep exploring aria.
    } else {
      const isRecording = ['recording', 'assertingText', 'assertingVisibility', 'assertingValue', 'assertingSnapshot'].includes(mode);
      window.dispatch({ event: 'setMode', params: { mode: isRecording ? 'recording' : 'standby' } }).catch(() => { });
    }
  };

  window.playwrightSetRunningFile = setRunningFileId;

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);


  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F8':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'resume' });
          else
            window.dispatch({ event: 'pause' });
          break;
        case 'F10':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'step' });
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paused]);

  const onEditorChange = React.useCallback((selector: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    setLocator(selector);
    window.dispatch({ event: 'highlightRequested', params: { selector } });
  }, [mode]);

  const onAriaEditorChange = React.useCallback((ariaSnapshot: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    const { fragment, errors } = parseAriaSnapshot(yaml, ariaSnapshot, { prettyErrors: false });
    const highlights = errors.map(error => {
      const highlight: SourceHighlight = {
        message: error.message,
        line: error.range[1].line,
        column: error.range[1].col,
        type: 'subtle-error',
      };
      return highlight;
    });
    setAriaSnapshotErrors(highlights);
    setAriaSnapshot(ariaSnapshot);
    if (!errors.length)
      window.dispatch({ event: 'highlightRequested', params: { ariaTemplate: fragment } });
  }, [mode]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='circle-large-filled' title='Record' toggled={mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby' } });
      }}>Record</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='inspect' title='Pick locator' toggled={mode === 'inspecting' || mode === 'recording-inspecting'} onClick={() => {
        const newMode = {
          'inspecting': 'standby',
          'none': 'inspecting',
          'standby': 'inspecting',
          'recording': 'recording-inspecting',
          'recording-inspecting': 'recording',
          'assertingText': 'recording-inspecting',
          'assertingVisibility': 'recording-inspecting',
          'assertingValue': 'recording-inspecting',
          'assertingSnapshot': 'recording-inspecting',
        }[mode];
        window.dispatch({ event: 'setMode', params: { mode: newMode } }).catch(() => { });
      }}></ToolbarButton>
      <ToolbarButton icon='eye' title='Assert visibility' toggled={mode === 'assertingVisibility'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility' } });
      }}></ToolbarButton>
      <ToolbarButton icon='whole-word' title='Assert text' toggled={mode === 'assertingText'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingText' ? 'recording' : 'assertingText' } });
      }}></ToolbarButton>
      <ToolbarButton icon='symbol-constant' title='Assert value' toggled={mode === 'assertingValue'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingValue' ? 'recording' : 'assertingValue' } });
      }}></ToolbarButton>
      <ToolbarButton icon='gist' title='Assert snapshot' toggled={mode === 'assertingSnapshot'} disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingSnapshot' ? 'recording' : 'assertingSnapshot' } });
      }}></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume (F8)' ariaLabel='Resume' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause (F8)' ariaLabel='Pause' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over (F10)' ariaLabel='Step over' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' });
      }}></ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div className='recorder-view-toggle'>
        <span>View:</span>
        <button
          type='button'
          className={'toolbar-button' + (viewMode === 'code' ? ' toggled' : '')}
          title='Code view'
          onClick={() => setViewMode('code')}
        >Code</button>
        <button
          type='button'
          className={'toolbar-button' + (viewMode === 'testCase' ? ' toggled' : '')}
          title='Test case view'
          onClick={() => setViewMode('testCase')}
        >Test case</button>
      </div>
      <div>Target:</div>
      <SourceChooser fileId={fileId} sources={sources} setFileId={fileId => {
        setSelectedFileId(fileId);
        window.dispatch({ event: 'fileChanged', params: { file: fileId } });
      }} />
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        setStepBodies(['']);
        window.dispatch({ event: 'clear' });
      }}></ToolbarButton>
      <ToolbarButton icon='color-mode' title='Toggle color mode' toggled={false} onClick={() => toggleTheme()}></ToolbarButton>
    </Toolbar>
    <SplitView
      sidebarSize={200}
      main={viewMode === 'testCase'
        ? <TestCaseView
            stepState={stepState}
            stepCodeBlocks={stepCodeBlocks}
            stepBodies={stepBodies}
            onStepBodyChange={(stepIndex, text) => setStepBodies(prev => {
              const next = [...prev];
              next[stepIndex] = text;
              return next;
            })}
            onAddStep={description => {
              window.dispatch({ event: 'advanceStep', params: { description } }).catch(() => {});
              setNextStepDescription('');
            }}
            nextStepDescription={nextStepDescription}
            onNextStepDescriptionChange={setNextStepDescription}
            isRecording={isRecording}
          />
        : <CodeMirrorWrapper text={source.text} language={source.language} highlight={codeHighlight} revealLine={codeRevealLine} readOnly={source.id !== 'playwright-test'} onChange={onEditedCode} onCursorActivity={onCursorActivity} lineNumbers={true} />}
      sidebar={<div className='recorder-sidebar' style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <TabbedPane
          rightToolbar={selectedTab === 'locator' || selectedTab === 'aria' ? [<ToolbarButton key={1} icon='files' title='Copy' onClick={() => copy((selectedTab === 'locator' ? locator : ariaSnapshot) || '')} />] : []}
          tabs={[
            {
              id: 'locator',
              title: 'Locator',
              render: () => <CodeMirrorWrapper text={locator} placeholder='Type locator to inspect' language={source.language} focusOnChange={selectorFocusOnChange} onChange={onEditorChange} wrapLines={true} />
            },
            {
              id: 'log',
              title: 'Log',
              render: () => <CallLogView language={source.language} log={Array.from(log.values())} />
            },
            {
              id: 'aria',
              title: 'Aria',
              render: () => <CodeMirrorWrapper text={ariaSnapshot || ''} placeholder='Type aria template to match' language={'yaml'} onChange={onAriaEditorChange} highlight={ariaSnapshotErrors} wrapLines={true} />
            },
          ]}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
        />
        {isRecording && <div className='recorder-step-section'>
          <div className='step-label'>Current step: {currentStepLabel}</div>
          <div className='step-nav-row'>
            <div className='step-nav-buttons'>
              <button
                className='toolbar-button'
                type='button'
                title='Go to previous step'
                disabled={viewingStepIndex <= 0}
                onClick={() => setViewingStepIndex(i => Math.max(0, i - 1))}
              >Prev</button>
              <button
                className='toolbar-button'
                type='button'
                title='Go to next step'
                disabled={viewingStepIndex >= stepCount - 1}
                onClick={() => setViewingStepIndex(i => Math.min(stepCount - 1, i + 1))}
              >Next</button>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
              Step {viewingStepIndex + 1} of {stepCount}
            </span>
          </div>
          <div className='step-add-row'>
            <input
              type='text'
              placeholder='Next step description'
              value={nextStepDescription}
              onChange={e => setNextStepDescription(e.target.value)}
            />
            <button
              className='toolbar-button'
              type='button'
              onClick={() => {
                const description = nextStepDescription.trim() || `Step ${(stepState?.currentStepIndex ?? 0) + 2}`;
                window.dispatch({ event: 'advanceStep', params: { description } }).catch(() => {});
                setNextStepDescription('');
              }}
            >Add step</button>
          </div>
        </div>}
      </div>}
    />
  </div>;
};
