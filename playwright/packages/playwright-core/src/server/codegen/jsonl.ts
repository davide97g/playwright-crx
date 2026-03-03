/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { asLocator } from '../../utils';

import type { Language, LanguageGenerator, LanguageGeneratorOptions } from './types';
import type * as actions from '@recorder/actions';

export class JsonlLanguageGenerator implements LanguageGenerator {
  id = 'jsonl';
  groupName = '';
  name = 'JSONL';
  highlighter = 'javascript' as Language;

  generateAction(actionInContext: actions.ActionInContext): string {
    const locator = (actionInContext.action as any).selector ? JSON.parse(asLocator('jsonl', (actionInContext.action as any).selector)) : undefined;
    const entry = {
      ...actionInContext.action,
      ...actionInContext.frame,
      locator,
    };
    return JSON.stringify(entry);
  }

  generateStepsDocument(actions: actions.ActionInContext[], stepState: { stepDescriptions: string[] }): string {
    const steps: { name: string; actions: object[] }[] = [];
    let currentStepIndex: number | undefined;
    let currentActions: object[] = [];
    for (const a of actions) {
      const stepIndex = a.stepIndex ?? 0;
      if (stepIndex !== currentStepIndex) {
        if (currentActions.length > 0 && currentStepIndex !== undefined) {
          steps.push({
            name: stepState.stepDescriptions[currentStepIndex] ?? 'Start',
            actions: currentActions,
          });
          currentActions = [];
        }
        currentStepIndex = stepIndex;
      }
      const locator = (a.action as any).selector ? JSON.parse(asLocator('jsonl', (a.action as any).selector)) : undefined;
      currentActions.push({
        ...a.action,
        ...a.frame,
        locator,
      });
    }
    if (currentActions.length > 0 && currentStepIndex !== undefined) {
      steps.push({
        name: stepState.stepDescriptions[currentStepIndex] ?? 'Start',
        actions: currentActions,
      });
    }
    return JSON.stringify({ steps }, null, 2);
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    return JSON.stringify(options);
  }

  generateFooter(saveStorage: string | undefined): string {
    return '';
  }
}