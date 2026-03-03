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

import * as React from 'react';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';

export type StepState = { currentStepIndex: number; stepDescriptions: string[] };

export interface TestCaseViewProps {
  stepState: StepState | null;
  stepOrder: number[];
  currentStepIndex: number;
  stepCodeBlocks: string[];
  stepBodies: string[];
  onStepBodyChange: (stepIndex: number, text: string) => void;
  onAddStep: (description: string) => void;
  nextStepDescription: string;
  onNextStepDescriptionChange: (value: string) => void;
  isRecording: boolean;
  sessionTitle?: string;
  onSessionTitleChange?: (title: string) => void;
  onSelectStep?: (stepIndex: number) => void;
  onReorderSteps?: (fromDisplayIndex: number, toDisplayIndex: number) => void;
  onStepDescriptionChange?: (physicalIndex: number, description: string) => void;
  onDeleteStep?: (physicalIndex: number) => void;
}

export const TestCaseView: React.FC<TestCaseViewProps> = ({
  stepState,
  stepOrder,
  currentStepIndex,
  stepCodeBlocks,
  stepBodies,
  onStepBodyChange,
  onAddStep,
  nextStepDescription,
  onNextStepDescriptionChange,
  isRecording: _isRecording,
  sessionTitle,
  onSessionTitleChange,
  onSelectStep,
  onReorderSteps,
  onStepDescriptionChange,
  onDeleteStep,
}) => {
  const stepCount = Math.max(1, stepState?.stepDescriptions?.length ?? 1);
  const sectionRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const [draggedDisplayIndex, setDraggedDisplayIndex] = React.useState<number | null>(null);
  const [dragOverDisplayIndex, setDragOverDisplayIndex] = React.useState<number | null>(null);

  const order = stepOrder.length === stepCount ? stepOrder : Array.from({ length: stepCount }, (_, i) => i);

  React.useEffect(() => {
    sectionRefs.current[currentStepIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentStepIndex]);

  const handleDragStart = (e: React.DragEvent, displayIndex: number) => {
    setDraggedDisplayIndex(displayIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(displayIndex));
    e.dataTransfer.setData('application/x-step-display-index', String(displayIndex));
  };

  const handleDragOver = (e: React.DragEvent, displayIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedDisplayIndex !== null && draggedDisplayIndex !== displayIndex)
      setDragOverDisplayIndex(displayIndex);
  };

  const handleDragLeave = () => {
    setDragOverDisplayIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toDisplayIndex: number) => {
    e.preventDefault();
    setDragOverDisplayIndex(null);
    setDraggedDisplayIndex(null);
    const fromDisplayIndex = draggedDisplayIndex ?? parseInt(e.dataTransfer.getData('application/x-step-display-index') || '0', 10);
    if (fromDisplayIndex !== toDisplayIndex && onReorderSteps)
      onReorderSteps(fromDisplayIndex, toDisplayIndex);
  };

  const handleDragEnd = () => {
    setDraggedDisplayIndex(null);
    setDragOverDisplayIndex(null);
  };

  return (
    <div className='test-case-view'>
      {onSessionTitleChange && (
        <input
          type='text'
          className='test-case-session-title'
          placeholder='Session title'
          value={sessionTitle ?? ''}
          onChange={e => onSessionTitleChange(e.target.value)}
          title='Session title (saved with the session)'
        />
      )}
      <ol className='test-case-steps-scroll'>
        {order.map((physicalIndex, displayIndex) => {
          const description = stepState?.stepDescriptions[physicalIndex] ?? (physicalIndex === 0 ? 'Start' : `Step ${physicalIndex + 1}`);
          const codeBlock = stepCodeBlocks[physicalIndex] ?? '';
          const body = stepBodies[physicalIndex] ?? '';
          const isCurrentStep = displayIndex === currentStepIndex;
          const isDragging = draggedDisplayIndex === displayIndex;
          const isDropTarget = dragOverDisplayIndex === displayIndex;
          return (
            <li
              key={physicalIndex}
              className={'test-case-section' + (isCurrentStep ? ' test-case-section-current' : '') + (isDragging ? ' test-case-section-dragging' : '') + (isDropTarget ? ' test-case-section-drag-over' : '')}
              ref={el => { sectionRefs.current[displayIndex] = el; }}
              onDragOver={onReorderSteps ? (e) => handleDragOver(e, displayIndex) : undefined}
              onDragLeave={onReorderSteps ? handleDragLeave : undefined}
              onDrop={onReorderSteps ? (e) => handleDrop(e, displayIndex) : undefined}
            >
              <div className='test-case-section-header'>
                {onReorderSteps && (
                  <button
                    type='button'
                    className='test-case-section-drag-handle'
                    draggable
                    onDragStart={e => handleDragStart(e, displayIndex)}
                    onDragEnd={handleDragEnd}
                    title='Drag to reorder'
                    aria-label='Drag to reorder step'
                  >
                    <span className='codicon codicon-gripper' />
                  </button>
                )}
                {onSelectStep && (
                  <button
                    type='button'
                    className='test-case-section-select'
                    title='Select this step'
                    onClick={() => onSelectStep(displayIndex)}
                    aria-label={`Select step ${displayIndex + 1}`}
                  >
                    <span className='codicon codicon-target' />
                  </button>
                )}
                <span className='test-case-section-header-label'>Step {displayIndex + 1}: </span>
                {onStepDescriptionChange ? (
                  <input
                    type='text'
                    className='test-case-section-title-input'
                    value={description}
                    onChange={e => onStepDescriptionChange(physicalIndex, e.target.value)}
                    placeholder='Step name'
                    aria-label={`Step ${displayIndex + 1} name`}
                  />
                ) : (
                  <span className='test-case-section-header-description'>{description}</span>
                )}
                {onDeleteStep && stepCount > 1 && (
                  <button
                    type='button'
                    className='test-case-section-delete'
                    title='Delete step'
                    onClick={() => onDeleteStep(physicalIndex)}
                    aria-label={`Delete step ${displayIndex + 1}`}
                  >
                    <span className='codicon codicon-trash' />
                  </button>
                )}
              </div>
            <div className='test-case-section-body'>
              <textarea
                className='test-case-section-textarea'
                value={body}
                placeholder='Add comments or notes for this step...'
                onChange={e => onStepBodyChange(physicalIndex, e.target.value)}
                spellCheck={false}
              />
            </div>
            {codeBlock ? (
              <div className='test-case-section-code'>
                <div className='test-case-section-code-label'>Recorded actions</div>
                <CodeMirrorWrapper
                  text={codeBlock}
                  language='javascript'
                  readOnly={true}
                  lineNumbers={true}
                />
              </div>
            ) : null}
          </li>
        );
      })}
      </ol>
      <div className='test-case-add-step test-case-add-step-sticky'>
        <input
          type='text'
          placeholder='Next step description'
          value={nextStepDescription}
          onChange={e => onNextStepDescriptionChange(e.target.value)}
          className='test-case-add-step-input'
        />
        <button
          type='button'
          className='toolbar-button'
          onClick={() => {
            const description = nextStepDescription.trim() || `Step ${(stepState?.currentStepIndex ?? 0) + 2}`;
            onAddStep(description);
          }}
        >
          Add step
        </button>
      </div>
    </div>
  );
};
