/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

interface OpenAIKeyPromptProps {
  onSubmit: (apiKey: string, baseUrl: string, model: string) => void;
  onCancel: () => void;
}

interface Model {
  id: string;
  object: string;
}

interface ModelsResponse {
  data: Model[];
}

export function OpenAIKeyPrompt({
  onSubmit,
  onCancel,
}: OpenAIKeyPromptProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [currentField, setCurrentField] = useState<'apiKey' | 'model'>('apiKey');
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  
  const baseUrl = 'https://dekallm.cloudeka.ai/v1';

  const fetchModels = useCallback(async () => {
    if (!apiKey.trim()) return;
    
    setLoadingModels(true);
    setModelError(null);
    
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: ModelsResponse = await response.json();
      setModels(data.data || []);
      setSelectedModelIndex(0);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Failed to fetch models');
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [apiKey, baseUrl]);

  useEffect(() => {
    if (currentField === 'model' && models.length === 0 && !loadingModels && !modelError) {
      fetchModels();
    }
  }, [currentField, models.length, loadingModels, modelError, fetchModels]);

  useInput((input: string, key: { escape?: boolean; tab?: boolean; upArrow?: boolean; downArrow?: boolean; backspace?: boolean; delete?: boolean }) => {
    // 过滤粘贴相关的控制序列
    let cleanInput = (input || '')
      // 过滤 ESC 开头的控制序列（如 \u001b[200~、\u001b[201~ 等）
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
      // 过滤粘贴开始标记 [200~
      .replace(/\[200~/g, '')
      // 过滤粘贴结束标记 [201~
      .replace(/\[201~/g, '')
      // 过滤单独的 [ 和 ~ 字符（可能是粘贴标记的残留）
      .replace(/^\[|~$/g, '');

    // 再过滤所有不可见字符（ASCII < 32，除了回车换行）
    cleanInput = cleanInput
      .split('')
      .filter((ch: string) => ch.charCodeAt(0) >= 32)
      .join('');

    if (cleanInput.length > 0) {
      if (currentField === 'apiKey') {
        setApiKey((prev: string) => prev + cleanInput);
      }
      return;
    }

    // 检查是否是 Enter 键（通过检查输入是否包含换行符）
    if (input.includes('\n') || input.includes('\r')) {
      if (currentField === 'apiKey') {
        if (apiKey.trim()) {
          setCurrentField('model');
        }
        return;
      } else if (currentField === 'model') {
        if (apiKey.trim() && models.length > 0) {
          onSubmit(apiKey.trim(), baseUrl, models[selectedModelIndex].id);
        } else if (!apiKey.trim()) {
          setCurrentField('apiKey');
        }
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    // Handle Tab key for field navigation
    if (key.tab) {
      if (currentField === 'apiKey') {
        if (apiKey.trim()) {
          setCurrentField('model');
        }
      } else if (currentField === 'model') {
        setCurrentField('apiKey');
      }
      return;
    }

    // Handle arrow keys for field navigation and model selection
    if (key.upArrow) {
      if (currentField === 'model') {
        if (models.length > 0) {
          setSelectedModelIndex((prev: number) => (prev > 0 ? prev - 1 : models.length - 1));
        } else {
          setCurrentField('apiKey');
        }
      }
      return;
    }

    if (key.downArrow) {
      if (currentField === 'apiKey') {
        if (apiKey.trim()) {
          setCurrentField('model');
        }
      } else if (currentField === 'model') {
        if (models.length > 0) {
          setSelectedModelIndex((prev: number) => (prev < models.length - 1 ? prev + 1 : 0));
        }
      }
      return;
    }

    // Handle backspace - check both key.backspace and delete key
    if (key.backspace || key.delete) {
      if (currentField === 'apiKey') {
        setApiKey((prev: string) => prev.slice(0, -1));
        // Clear models when API key changes
        setModels([]);
        setModelError(null);
      }
      return;
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        DekaLLM Configuration Required
      </Text>
      <Box marginTop={1}>
        <Text>
          Please enter your DekaLLM configuration.
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'apiKey' ? Colors.AccentBlue : Colors.Gray}
          >
            API Key:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'apiKey' ? '> ' : '  '}
            {apiKey ? '*'.repeat(apiKey.length) : ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text color={Colors.Gray}>
            Base URL:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text color={Colors.Gray}>
            {baseUrl}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'model' ? Colors.AccentBlue : Colors.Gray}
          >
            Model:
          </Text>
        </Box>
        <Box flexGrow={1}>
          {currentField === 'model' ? (
            <Box flexDirection="column">
              {loadingModels ? (
                <Text>Loading models...</Text>
              ) : modelError ? (
                <Text color={Colors.AccentRed}>Error: {modelError}</Text>
              ) : models.length > 0 ? (
                models.map((model: Model, index: number) => (
                  <Text key={model.id} color={index === selectedModelIndex ? Colors.AccentBlue : Colors.Gray}>
                    {index === selectedModelIndex ? '> ' : '  '}{model.id}
                  </Text>
                ))
              ) : (
                <Text color={Colors.Gray}>No models available</Text>
              )}
            </Box>
          ) : (
            <Text>
              {models.length > 0 && selectedModelIndex < models.length ? models[selectedModelIndex].id : 'Select a model'}
            </Text>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {currentField === 'model' && models.length > 0 ? 
            'Press ↑↓ to select model, Enter to submit, Tab to go back, Esc to cancel' :
            'Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel'
          }
        </Text>
      </Box>
    </Box>
  );
}
