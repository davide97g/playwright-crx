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
import { ToolbarButton } from '@web/components/toolbarButton';
import type { PersistedSession } from './sessionsDb';
import './SessionListView.css';

export interface SessionListViewProps {
  sessions: PersistedSession[];
  onSaveCurrent: () => void;
  onRestart: (session: PersistedSession) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  saveDisabled?: boolean;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SessionListView: React.FC<SessionListViewProps> = ({
  sessions,
  onSaveCurrent,
  onRestart,
  onRename,
  onDelete,
  saveDisabled,
}) => {
  const handleRename = React.useCallback((session: PersistedSession) => {
    const newName = window.prompt('Rename session', session.name);
    const trimmed = newName?.trim();
    if (trimmed)
      onRename(session.id, trimmed);
  }, [onRename]);

  return (
    <div className='session-list-view'>
      <div className='session-list-toolbar'>
        <ToolbarButton
          icon='save'
          title='Save current session'
          disabled={saveDisabled}
          onClick={onSaveCurrent}
        >
          Save current
        </ToolbarButton>
      </div>
      <ul className='session-list'>
        {sessions.length === 0 ? (
          <li className='session-list-empty'>No saved sessions</li>
        ) : (
          sessions.map(session => (
            <li key={session.id} className='session-list-item'>
              <div className='session-list-item-info'>
                <span className='session-list-item-name' title={session.name}>
                  {session.name}
                </span>
                <span className='session-list-item-date'>
                  {formatDate(session.updatedAt)}
                </span>
              </div>
              <div className='session-list-item-actions'>
                <button
                  type='button'
                  className='toolbar-button session-list-action'
                  title='Restart from this session'
                  onClick={() => onRestart(session)}
                >
                  Restart
                </button>
                <button
                  type='button'
                  className='toolbar-button session-list-action'
                  title='Rename session'
                  onClick={() => handleRename(session)}
                >
                  Rename
                </button>
                <button
                  type='button'
                  className='toolbar-button session-list-action'
                  title='Delete session'
                  onClick={() => onDelete(session.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
