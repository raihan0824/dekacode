/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@qwen-code/qwen-code-core';
import { Box, Text } from 'ink';
import React, { useState } from 'react';
import process from 'node:process';
import {
  setOpenAIApiKey,
  setOpenAIBaseUrl,
  setOpenAIModel,
  saveOpenAICredentialsToSettings,
} from '../../config/auth.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { OpenAIKeyPrompt } from './OpenAIKeyPrompt.js';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}


export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [showOpenAIKeyPrompt, setShowOpenAIKeyPrompt] = useState(true);

  // Direct to DekaLLM authentication
  React.useEffect(() => {
    if (!showOpenAIKeyPrompt && !process.env['OPENAI_API_KEY']) {
      setShowOpenAIKeyPrompt(true);
    }
  }, [showOpenAIKeyPrompt]);

  const handleOpenAIKeySubmit = (
    apiKey: string,
    baseUrl: string,
    model: string,
  ) => {
    setOpenAIApiKey(apiKey);
    setOpenAIBaseUrl(baseUrl);
    setOpenAIModel(model);
    
    // Save credentials to settings for persistence
    saveOpenAICredentialsToSettings(settings, apiKey, baseUrl, model);
    
    setShowOpenAIKeyPrompt(false);
    onSelect(AuthType.USE_OPENAI, SettingScope.User);
  };

  const handleOpenAIKeyCancel = () => {
    setShowOpenAIKeyPrompt(false);
    setErrorMessage('DekaLLM API key is required to proceed.');
  };

  useKeypress(
    (key) => {
      if (showOpenAIKeyPrompt) {
        return;
      }

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        if (errorMessage) {
          return;
        }
        onSelect(undefined, SettingScope.User);
      } else {
        // Any key press when not showing prompt should show it again
        setShowOpenAIKeyPrompt(true);
        setErrorMessage(null);
      }
    },
    { isActive: true },
  );

  if (showOpenAIKeyPrompt) {
    return (
      <OpenAIKeyPrompt
        onSubmit={handleOpenAIKeySubmit}
        onCancel={handleOpenAIKeyCancel}
      />
    );
  }

  // If we reach here and don't have an API key, show error and prompt again
  if (!process.env['OPENAI_API_KEY']) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.AccentRed}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={Colors.AccentRed}>Authentication Required</Text>
        <Box marginTop={1}>
          <Text>DekaLLM API key is required to proceed.</Text>
        </Box>
        {errorMessage && (
          <Box marginTop={1}>
            <Text color={Colors.AccentRed}>{errorMessage}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={Colors.Gray}>Press any key to continue...</Text>
        </Box>
      </Box>
    );
  }

  // This should rarely be reached, but provides fallback
  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Authentication Complete</Text>
      <Box marginTop={1}>
        <Text>DekaLLM authentication is configured.</Text>
      </Box>
    </Box>
  );
}
