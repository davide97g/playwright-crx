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
  stepCodeBlocks: string[];
  stepBodies: string[];
  onStepBodyChange: (stepIndex: number, text: string) => void;
  onAddStep: (description: string) => void;
  nextStepDescription: string;
  onNextStepDescriptionChange: (value: string) => void;
  isRecording: boolean;
}

export const TestCaseView: React.FC<TestCaseViewProps> = ({
  stepState,
  stepCodeBlocks,
  stepBodies,
  onStepBodyChange,
  onAddStep,
  nextStepDescription,
  onNextStepDescriptionChange,
  isRecording,
}) => {
  const stepCount = Math.max(1, stepState?.stepDescriptions?.length ?? 1);
  const sectionRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    const idx = stepState?.currentStepIndex ?? 0;
    sectionRefs.current[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [stepState?.currentStepIndex]);

  return (
    <div className='test-case-view'>
      {Array.from({ length: stepCount }, (_, stepIndex) => {
        const description = stepState?.stepDescriptions[stepIndex] ?? (stepIndex === 0 ? 'Start' : `Step ${stepIndex + 1}`);
        const codeBlock = stepCodeBlocks[stepIndex] ?? '';
        const body = stepBodies[stepIndex] ?? '';
        return (
          <div
            key={stepIndex}
            className='test-case-section'
            ref={el => { sectionRefs.current[stepIndex] = el; }}
          >
            <div className='test-case-section-header'>
              Step {stepIndex + 1}: {description}
            </div>
            <div className='test-case-section-body'>
              <textarea
                className='test-case-section-textarea'
                value={body}
                placeholder='Add comments or notes for this step...'
                onChange={e => onStepBodyChange(stepIndex, e.target.value)}
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
          </div>
        );
      })}
      {isRecording && (
        <div className='test-case-add-step'>
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
      )}
    </div>
  );
};
