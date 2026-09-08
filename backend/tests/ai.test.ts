import { ChatMessage, AIResponse, StructuredAIResponse, AIProviderConfig } from '../src/ai/types';
import { BaseAIProvider } from '../src/ai/BaseAIProvider';
import { OmniRouteProvider } from '../src/ai/providers/OmniRouteProvider';
import { AIFactory } from '../src/ai/AIFactory';

describe('OmniRoute Provider', () => {
  describe('Initialization', () => {
    it('should initialize when OMNIROUTE_API_KEY is set', () => {
      const originalKey = process.env.OMNIROUTE_API_KEY;
      process.env.OMNIROUTE_API_KEY = 'test-api-key';

      const provider = new OmniRouteProvider();
      expect(provider.name).toBe('omniroute');

      if (originalKey !== undefined) process.env.OMNIROUTE_API_KEY = originalKey;
      else delete process.env.OMNIROUTE_API_KEY;
    });

    it('should initialize without API key (will fail at runtime on request)', () => {
      const originalKey = process.env.OMNIROUTE_API_KEY;
      delete process.env.OMNIROUTE_API_KEY;

      const provider = new OmniRouteProvider();
      expect(provider.name).toBe('omniroute');

      if (originalKey !== undefined) process.env.OMNIROUTE_API_KEY = originalKey;
    });
  });

  describe('Configuration loading', () => {
    it('should load OMNIROUTE_BASE_URL and OMNIROUTE_MODEL from env', () => {
      const originalBase = process.env.OMNIROUTE_BASE_URL;
      const originalModel = process.env.OMNIROUTE_MODEL;
      const originalKey = process.env.OMNIROUTE_API_KEY;

      process.env.OMNIROUTE_BASE_URL = 'https://custom.api.example.com/v1';
      process.env.OMNIROUTE_MODEL = 'gpt-4o';

      const provider = new OmniRouteProvider();
      expect((provider as any).baseUrl).toBe('https://custom.api.example.com/v1');
      expect((provider as any).model).toBe('gpt-4o');

      if (originalBase !== undefined) process.env.OMNIROUTE_BASE_URL = originalBase;
      else delete process.env.OMNIROUTE_BASE_URL;
      if (originalModel !== undefined) process.env.OMNIROUTE_MODEL = originalModel;
      else delete process.env.OMNIROUTE_MODEL;
      if (originalKey !== undefined) process.env.OMNIROUTE_API_KEY = originalKey;
      else delete process.env.OMNIROUTE_API_KEY;
    });

    it('should load OMNIROUTE_API_KEY from env', () => {
      const originalKey = process.env.OMNIROUTE_API_KEY;
      process.env.OMNIROUTE_API_KEY = 'sk-test-key-123';

      const provider = new OmniRouteProvider();
      expect((provider as any).apiKey).toBe('sk-test-key-123');

      if (originalKey !== undefined) process.env.OMNIROUTE_API_KEY = originalKey;
      else delete process.env.OMNIROUTE_API_KEY;
    });

    it('should default to openrouter endpoint when OMNIROUTE_BASE_URL is not set', () => {
      const originalBase = process.env.OMNIROUTE_BASE_URL;
      delete process.env.OMNIROUTE_BASE_URL;

      const provider = new OmniRouteProvider();
      expect((provider as any).baseUrl).toBe('https://openrouter.ai/api/v1');

      if (originalBase !== undefined) process.env.OMNIROUTE_BASE_URL = originalBase;
    });
  });

  describe('Error handling when OmniRoute API is unavailable', () => {
    it('chat() should throw with a network/connection error when API is unreachable', async () => {
      const provider = new OmniRouteProvider({ baseUrl: 'http://127.0.0.1:65535' });
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

      await expect(provider.chat(messages)).rejects.toThrow(/OmniRoute/);
    });

    it('generateText() should throw with a network/connection error when API is unreachable', async () => {
      const provider = new OmniRouteProvider({ baseUrl: 'http://127.0.0.1:65535' });

      await expect(provider.generateText('hello')).rejects.toThrow(/OmniRoute/);
    });

    it('generateStructuredResponse() should return error object when API is unreachable', async () => {
      const provider = new OmniRouteProvider({ baseUrl: 'http://127.0.0.1:65535' });
      const result = await provider.generateStructuredResponse<any>('hi', { type: 'object' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('isAvailable() should return false when API is unreachable', async () => {
      const provider = new OmniRouteProvider({ baseUrl: 'http://127.0.0.1:65535' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('Input validation', () => {
    it('chat() should throw on empty messages', async () => {
      const provider = new OmniRouteProvider();
      await expect(provider.chat([])).rejects.toThrow('Messages array cannot be empty');
    });

    it('chat() should throw on invalid role', async () => {
      const provider = new OmniRouteProvider();
      const bad = [{ role: 'admin' as any, content: 'x' }];
      await expect(provider.chat(bad)).rejects.toThrow('Invalid message role');
    });

    it('chat() should throw on empty content', async () => {
      const provider = new OmniRouteProvider();
      const bad = [{ role: 'user' as ChatMessage['role'], content: '' }];
      await expect(provider.chat(bad)).rejects.toThrow('Message content must be a non-empty string');
    });

    it('generateText() should throw on empty prompt', async () => {
      const provider = new OmniRouteProvider();
      await expect(provider.generateText('')).rejects.toThrow('Prompt must be a non-empty string');
    });

    it('generateText() should throw on whitespace-only prompt', async () => {
      const provider = new OmniRouteProvider();
      await expect(provider.generateText('   ')).rejects.toThrow('Prompt cannot be empty');
    });

    it('generateStructuredResponse() should throw on null schema', async () => {
      const provider = new OmniRouteProvider();
      await expect(
        provider.generateStructuredResponse('hi', null as any)
      ).rejects.toThrow('Schema must be a valid object');
    });
  });
});

describe('AIFactory wiring', () => {
  it('factory should return omniroute provider by name', () => {
    const factory = AIFactory.getInstance();
    const provider = factory.getProvider('omniroute');
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('omniroute');
  });

  it('factory should NEVER return ollama provider', () => {
    const factory = AIFactory.getInstance();
    const provider = factory.getProvider('ollama');
    expect(provider).toBeNull();
  });

  it('factory should return null for unknown provider', () => {
    const factory = AIFactory.getInstance();
    const provider = factory.getProvider('nonexistent-xyz');
    expect(provider).toBeNull();
  });

  it('factory should list omniroute in available providers', () => {
    const factory = AIFactory.getInstance();
    const names = factory.getAvailableProviders();
    expect(names).toContain('omniroute');
    expect(names).not.toContain('ollama');
  });

  it('factory should be a singleton', () => {
    const a = AIFactory.getInstance();
    const b = AIFactory.getInstance();
    expect(a).toBe(b);
  });
});

describe('No Ollama references in AI code', () => {
  it('should have no localhost:11434 in OmniRoute provider source', async () => {
    const fs = require('fs');
    const path = require('path');
    const providerFile = path.resolve(__dirname, '../src/ai/providers/OmniRouteProvider.ts');
    const content = fs.readFileSync(providerFile, 'utf-8');
    expect(content).not.toContain('localhost:11434');
    expect(content).not.toContain('11434');
    expect(content).not.toContain('ollama');
    expect(content).not.toContain('OLLAMA');
  });

  it('should have no OllamaProvider file', () => {
    const fs = require('fs');
    const path = require('path');
    const ollamaFile = path.resolve(__dirname, '../src/ai/providers/OllamaProvider.ts');
    expect(fs.existsSync(ollamaFile)).toBe(false);
  });
});
