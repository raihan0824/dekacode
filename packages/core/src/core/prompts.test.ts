/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCoreSystemPrompt, getCustomSystemPrompt } from './prompts.js';
import { isGitRepository } from '../utils/gitUtils.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GEMINI_CONFIG_DIR } from '../tools/memoryTool.js';

// Mock tool names if they are dynamically generated or complex
vi.mock('../tools/ls', () => ({ LSTool: { Name: 'list_directory' } }));
vi.mock('../tools/edit', () => ({ EditTool: { Name: 'edit' } }));
vi.mock('../tools/glob', () => ({ GlobTool: { Name: 'glob' } }));
vi.mock('../tools/grep', () => ({ GrepTool: { Name: 'search_file_content' } }));
vi.mock('../tools/read-file', () => ({ ReadFileTool: { Name: 'read_file' } }));
vi.mock('../tools/read-many-files', () => ({
  ReadManyFilesTool: { Name: 'read_many_files' },
}));
vi.mock('../tools/shell', () => ({
  ShellTool: { Name: 'run_shell_command' },
}));
vi.mock('../tools/write-file', () => ({
  WriteFileTool: { Name: 'write_file' },
}));
vi.mock('../utils/gitUtils', () => ({
  isGitRepository: vi.fn(),
}));
vi.mock('node:fs');

describe('Core System Prompt (prompts.ts)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('GEMINI_SYSTEM_MD', undefined);
    vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', undefined);
  });

  it('should return the base prompt when no userMemory is provided', async () => {
    vi.stubEnv('SANDBOX', undefined);
    const prompt = await await getCoreSystemPrompt();
    expect(prompt).not.toContain('---\n\n'); // Separator should not be present
    expect(prompt).toContain('You are Qwen Code, an interactive CLI agent'); // Check for core content
    expect(prompt).toMatchSnapshot(); // Use snapshot for base prompt structure
  });

  it('should return the base prompt when userMemory is empty string', async () => {
    vi.stubEnv('SANDBOX', undefined);
    const prompt = await await getCoreSystemPrompt('');
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are Qwen Code, an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should return the base prompt when userMemory is whitespace only', async () => {
    vi.stubEnv('SANDBOX', undefined);
    const prompt = await await getCoreSystemPrompt('   \n  \t ');
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are Qwen Code, an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should append userMemory with separator when provided', async () => {
    vi.stubEnv('SANDBOX', undefined);
    const memory = 'This is custom user memory.\nBe extra polite.';
    const expectedSuffix = `\n\n---\n\n${memory}`;
    const prompt = await await getCoreSystemPrompt(memory);

    expect(prompt.endsWith(expectedSuffix)).toBe(true);
    expect(prompt).toContain('You are Qwen Code, an interactive CLI agent'); // Ensure base prompt follows
    expect(prompt).toMatchSnapshot(); // Snapshot the combined prompt
  });

  it('should include sandbox-specific instructions when SANDBOX env var is set', async () => {
    vi.stubEnv('SANDBOX', 'true'); // Generic sandbox value
    const prompt = await await getCoreSystemPrompt();
    expect(prompt).toContain('# Sandbox');
    expect(prompt).not.toContain('# macOS Seatbelt');
    expect(prompt).not.toContain('# Outside of Sandbox');
    expect(prompt).toMatchSnapshot();
  });

  it('should include seatbelt-specific instructions when SANDBOX env var is "sandbox-exec"', async () => {
    vi.stubEnv('SANDBOX', 'sandbox-exec');
    const prompt = await getCoreSystemPrompt();
    expect(prompt).toContain('# macOS Seatbelt');
    expect(prompt).not.toContain('# Sandbox');
    expect(prompt).not.toContain('# Outside of Sandbox');
    expect(prompt).toMatchSnapshot();
  });

  it('should include non-sandbox instructions when SANDBOX env var is not set', async () => {
    vi.stubEnv('SANDBOX', undefined); // Ensure it's not set
    const prompt = await getCoreSystemPrompt();
    expect(prompt).toContain('# Outside of Sandbox');
    expect(prompt).not.toContain('# Sandbox');
    expect(prompt).not.toContain('# macOS Seatbelt');
    expect(prompt).toMatchSnapshot();
  });

  it('should include git instructions when in a git repo', async () => {
    vi.stubEnv('SANDBOX', undefined);
    vi.mocked(isGitRepository).mockReturnValue(true);
    const prompt = await getCoreSystemPrompt();
    expect(prompt).toContain('# Git Repository');
    expect(prompt).toMatchSnapshot();
  });

  it('should not include git instructions when not in a git repo', async () => {
    vi.stubEnv('SANDBOX', undefined);
    vi.mocked(isGitRepository).mockReturnValue(false);
    const prompt = await getCoreSystemPrompt();
    expect(prompt).not.toContain('# Git Repository');
    expect(prompt).toMatchSnapshot();
  });

  describe('GEMINI_SYSTEM_MD environment variable', () => {
    it('should use default prompt when GEMINI_SYSTEM_MD is "false"', async () => {
      vi.stubEnv('GEMINI_SYSTEM_MD', 'false');
      const prompt = await getCoreSystemPrompt();
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(prompt).not.toContain('custom system prompt');
    });

    it('should use default prompt when GEMINI_SYSTEM_MD is "0"', async () => {
      vi.stubEnv('GEMINI_SYSTEM_MD', '0');
      const prompt = await getCoreSystemPrompt();
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(prompt).not.toContain('custom system prompt');
    });

    it('should throw error if GEMINI_SYSTEM_MD points to a non-existent file', async () => {
      const customPath = '/non/existent/path/system.md';
      vi.stubEnv('GEMINI_SYSTEM_MD', customPath);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      await expect(getCoreSystemPrompt()).rejects.toThrow(
        `missing system prompt file '${path.resolve(customPath)}'`,
      );
    });

    it('should read from default path when GEMINI_SYSTEM_MD is "true"', async () => {
      const defaultPath = path.resolve(
        path.join(GEMINI_CONFIG_DIR, 'system.md'),
      );
      vi.stubEnv('GEMINI_SYSTEM_MD', 'true');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('custom system prompt');

      const prompt = await getCoreSystemPrompt();
      expect(fs.readFileSync).toHaveBeenCalledWith(defaultPath, 'utf8');
      expect(prompt).toBe('custom system prompt');
    });

    it('should read from default path when GEMINI_SYSTEM_MD is "1"', async () => {
      const defaultPath = path.resolve(
        path.join(GEMINI_CONFIG_DIR, 'system.md'),
      );
      vi.stubEnv('GEMINI_SYSTEM_MD', '1');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('custom system prompt');

      const prompt = await getCoreSystemPrompt();
      expect(fs.readFileSync).toHaveBeenCalledWith(defaultPath, 'utf8');
      expect(prompt).toBe('custom system prompt');
    });

    it('should read from custom path when GEMINI_SYSTEM_MD provides one, preserving case', async () => {
      const customPath = path.resolve('/custom/path/SyStEm.Md');
      vi.stubEnv('GEMINI_SYSTEM_MD', customPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('custom system prompt');

      const prompt = await getCoreSystemPrompt();
      expect(fs.readFileSync).toHaveBeenCalledWith(customPath, 'utf8');
      expect(prompt).toBe('custom system prompt');
    });

    it('should expand tilde in custom path when GEMINI_SYSTEM_MD is set', async () => {
      const homeDir = '/Users/test';
      vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
      const customPath = '~/custom/system.md';
      const expectedPath = path.join(homeDir, 'custom/system.md');
      vi.stubEnv('GEMINI_SYSTEM_MD', customPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('custom system prompt');

      const prompt = await getCoreSystemPrompt();
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.resolve(expectedPath),
        'utf8',
      );
      expect(prompt).toBe('custom system prompt');
    });
  });

  describe('GEMINI_WRITE_SYSTEM_MD environment variable', () => {
    it('should not write to file when GEMINI_WRITE_SYSTEM_MD is "false"', async () => {
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', 'false');
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should not write to file when GEMINI_WRITE_SYSTEM_MD is "0"', async () => {
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', '0');
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should write to default path when GEMINI_WRITE_SYSTEM_MD is "true"', async () => {
      const defaultPath = path.resolve(
        path.join(GEMINI_CONFIG_DIR, 'system.md'),
      );
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', 'true');
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        defaultPath,
        expect.any(String),
      );
    });

    it('should write to default path when GEMINI_WRITE_SYSTEM_MD is "1"', async () => {
      const defaultPath = path.resolve(
        path.join(GEMINI_CONFIG_DIR, 'system.md'),
      );
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', '1');
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        defaultPath,
        expect.any(String),
      );
    });

    it('should write to custom path when GEMINI_WRITE_SYSTEM_MD provides one', async () => {
      const customPath = path.resolve('/custom/path/system.md');
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', customPath);
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        customPath,
        expect.any(String),
      );
    });

    it('should expand tilde in custom path when GEMINI_WRITE_SYSTEM_MD is set', async () => {
      const homeDir = '/Users/test';
      vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
      const customPath = '~/custom/system.md';
      const expectedPath = path.join(homeDir, 'custom/system.md');
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', customPath);
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.resolve(expectedPath),
        expect.any(String),
      );
    });

    it('should expand tilde in custom path when GEMINI_WRITE_SYSTEM_MD is just ~', async () => {
      const homeDir = '/Users/test';
      vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
      const customPath = '~';
      const expectedPath = homeDir;
      vi.stubEnv('GEMINI_WRITE_SYSTEM_MD', customPath);
      await getCoreSystemPrompt();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.resolve(expectedPath),
        expect.any(String),
      );
    });
  });
});

describe('URL matching with trailing slash compatibility', () => {
  it('should match URLs with and without trailing slash', async () => {
    const config = {
      systemPromptMappings: [
        {
          baseUrls: ['https://api.example.com'],
          modelNames: ['gpt-4'],
          template: 'Custom template for example.com',
        },
        {
          baseUrls: ['https://api.openai.com/'],
          modelNames: ['gpt-3.5-turbo'],
          template: 'Custom template for openai.com',
        },
      ],
    };

    // Simulate environment variables
    const originalEnv = process.env;

    // Test case 1: No trailing slash in config, actual URL has trailing slash
    process.env = {
      ...originalEnv,
      OPENAI_BASE_URL: 'https://api.example.com/',
      OPENAI_MODEL: 'gpt-4',
    };

    const result1 = await getCoreSystemPrompt(undefined, config);
    expect(result1).toContain('Custom template for example.com');

    // Test case 2: Config has trailing slash, actual URL has no trailing slash
    process.env = {
      ...originalEnv,
      OPENAI_BASE_URL: 'https://api.openai.com',
      OPENAI_MODEL: 'gpt-3.5-turbo',
    };

    const result2 = await getCoreSystemPrompt(undefined, config);
    expect(result2).toContain('Custom template for openai.com');

    // Test case 3: No trailing slash in config, actual URL has no trailing slash
    process.env = {
      ...originalEnv,
      OPENAI_BASE_URL: 'https://api.example.com',
      OPENAI_MODEL: 'gpt-4',
    };

    const result3 = await getCoreSystemPrompt(undefined, config);
    expect(result3).toContain('Custom template for example.com');

    // Test case 4: Config has trailing slash, actual URL has trailing slash
    process.env = {
      ...originalEnv,
      OPENAI_BASE_URL: 'https://api.openai.com/',
      OPENAI_MODEL: 'gpt-3.5-turbo',
    };

    const result4 = await getCoreSystemPrompt(undefined, config);
    expect(result4).toContain('Custom template for openai.com');

    // Restore original environment variables
    process.env = originalEnv;
  });

  it('should not match when URLs are different', async () => {
    const config = {
      systemPromptMappings: [
        {
          baseUrls: ['https://api.example.com'],
          modelNames: ['gpt-4'],
          template: 'Custom template for example.com',
        },
      ],
    };

    const originalEnv = process.env;

    // Test case: URLs do not match
    process.env = {
      ...originalEnv,
      OPENAI_BASE_URL: 'https://api.different.com',
      OPENAI_MODEL: 'gpt-4',
    };

    const result = await getCoreSystemPrompt(undefined, config);
    // Should return default template, not contain custom template
    expect(result).not.toContain('Custom template for example.com');

    // Restore original environment variables
    process.env = originalEnv;
  });
});

describe('getCustomSystemPrompt', () => {
  it('should handle string custom instruction without user memory', async () => {
    const customInstruction =
      'You are a helpful assistant specialized in code review.';
    const result = await getCustomSystemPrompt(customInstruction);

    expect(result).toBe(
      'You are a helpful assistant specialized in code review.',
    );
    expect(result).not.toContain('---');
  });

  it('should handle string custom instruction with user memory', async () => {
    const customInstruction =
      'You are a helpful assistant specialized in code review.';
    const userMemory =
      'Remember to be extra thorough.\nFocus on security issues.';
    const result = await getCustomSystemPrompt(customInstruction, userMemory);

    expect(result).toBe(
      'You are a helpful assistant specialized in code review.\n\n---\n\nRemember to be extra thorough.\nFocus on security issues.',
    );
    expect(result).toContain('---');
  });

  it('should handle Content object with parts array and user memory', async () => {
    const customInstruction = {
      parts: [
        { text: 'You are a code assistant. ' },
        { text: 'Always provide examples.' },
      ],
    };
    const userMemory = 'User prefers TypeScript examples.';
    const result = await getCustomSystemPrompt(customInstruction, userMemory);

    expect(result).toBe(
      'You are a code assistant. Always provide examples.\n\n---\n\nUser prefers TypeScript examples.',
    );
    expect(result).toContain('---');
  });
});
