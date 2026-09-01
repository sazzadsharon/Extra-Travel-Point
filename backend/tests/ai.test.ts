import { ChatMessage, AIResponse, StructuredAIResponse, AIProviderConfig } from '../src/ai/types';
import { BaseAIProvider } from '../src/ai/BaseAIProvider';
import { OllamaProvider } from '../src/ai/providers/OllamaProvider';
import { AIFactory } from '../src/ai/AIFactory';

describe('Phase 2: Ollama Real Inference', () => {
  describe('Ollama availability', () => {
    it('should report whether Ollama is running on default port', async () => {
      const provider = new OllamaProvider();
      const available = await provider.isAvailable();
      // Log for visibility
      if (!available) {
        console.log('Ollama not running at http://localhost:11434 (expected in CI/dev)');
      }
      expect(typeof available).toBe('boolean');
    });
  });

  describe('Configuration loading', () => {
    it('should load OLLAMA_BASE_URL and OLLAMA_MODEL from env', () => {
      const originalBase = process.env.OLLAMA_BASE_URL;
      const originalModel = process.env.OLLAMA_MODEL;

      process.env.OLLAMA_BASE_URL = 'http://example:11434';
      process.env.OLLAMA_MODEL = 'mistral';

      const provider = new OllamaProvider();
      expect((provider as any).baseUrl).toBe('http://example:11434');
      expect((provider as any).model).toBe('mistral');

      // Restore
      if (originalBase !== undefined) process.env.OLLAMA_BASE_URL = originalBase;
      else delete process.env.OLLAMA_BASE_URL;
      if (originalModel !== undefined) process.env.OLLAMA_MODEL = originalModel;
      else delete process.env.OLLAMA_MODEL;
    });
  });
});

describe('Phase 2: Error handling when Ollama unavailable', () => {
  it('chat() should throw with a network/connection error when Ollama is down', async () => {
    // Use a port that is guaranteed not to have Ollama
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:65535' });
    const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

    await expect(provider.chat(messages)).rejects.toThrow(/Ollama/);
  });

  it('generateText() should throw with a network/connection error when Ollama is down', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:65535' });

    await expect(provider.generateText('hello')).rejects.toThrow(/Ollama/);
  });

  it('generateStructuredResponse() should return error object when Ollama is down', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:65535' });
    const result = await provider.generateStructuredResponse<any>('hi', { type: 'object' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('isAvailable() should return false when Ollama is down', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:65535' });
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });
});

describe('Phase 2: Input validation', () => {
  it('chat() should throw on empty messages', async () => {
    const provider = new OllamaProvider();
    await expect(provider.chat([])).rejects.toThrow('Messages array cannot be empty');
  });

  it('chat() should throw on invalid role', async () => {
    const provider = new OllamaProvider();
    const bad = [{ role: 'admin' as any, content: 'x' }];
    await expect(provider.chat(bad)).rejects.toThrow('Invalid message role');
  });

  it('chat() should throw on empty content', async () => {
    const provider = new OllamaProvider();
    const bad = [{ role: 'user' as ChatMessage['role'], content: '' }];
    await expect(provider.chat(bad)).rejects.toThrow('Message content must be a non-empty string');
  });

  it('generateText() should throw on empty prompt', async () => {
    const provider = new OllamaProvider();
    await expect(provider.generateText('')).rejects.toThrow('Prompt must be a non-empty string');
  });

  it('generateText() should throw on whitespace-only prompt', async () => {
    const provider = new OllamaProvider();
    await expect(provider.generateText('   ')).rejects.toThrow('Prompt cannot be empty');
  });

  it('generateStructuredResponse() should throw on null schema', async () => {
    const provider = new OllamaProvider();
    await expect(
      provider.generateStructuredResponse('hi', null as any)
    ).rejects.toThrow('Schema must be a valid object');
  });
});

describe('Phase 2: AIFactory wiring', () => {
  it('factory should return ollama provider by name', () => {
    const factory = AIFactory.getInstance();
    const provider = factory.getProvider('ollama');
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('ollama');
  });

  it('factory should return null for unknown provider', () => {
    const factory = AIFactory.getInstance();
    const provider = factory.getProvider('nonexistent-xyz');
    expect(provider).toBeNull();
  });

  it('factory should list ollama in available providers', () => {
    const factory = AIFactory.getInstance();
    const names = factory.getAvailableProviders();
    expect(names).toContain('ollama');
  });

  it('factory should be a singleton', () => {
    const a = AIFactory.getInstance();
    const b = AIFactory.getInstance();
    expect(a).toBe(b);
  });
});

describe('Phase 2: Live integration (skipped if Ollama is not running)', () => {
  // These tests will only run if Ollama is actually running and available.
  // This prevents CI failures when Ollama is not installed.
  let ollamaAvailable = false;
  let liveProvider: OllamaProvider | null = null;

  beforeAll(async () => {
    liveProvider = new OllamaProvider();
    ollamaAvailable = await liveProvider.isAvailable();
  });

  it('should perform a real chat if Ollama is available', async () => {
    if (!ollamaAvailable || !liveProvider) {
      console.log('SKIP: Ollama not available for live integration test');
      return;
    }

    const messages: ChatMessage[] = [
      { role: 'user', content: 'Say "pong" and nothing else.' }
    ];
    const response: AIResponse = await liveProvider.chat(messages);
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
  }, 60000);

  it('should perform a real generateText if Ollama is available', async () => {
    if (!ollamaAvailable || !liveProvider) {
      console.log('SKIP: Ollama not available for live integration test');
      return;
    }

    const response: AIResponse = await liveProvider.generateText('Reply with the single word: ping');
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
  }, 60000);

  it('should perform a real generateStructuredResponse if Ollama is available', async () => {
    if (!ollamaAvailable || !liveProvider) {
      console.log('SKIP: Ollama not available for live integration test');
      return;
    }

    // The LLM may or may not return strict JSON; both outcomes are valid
    const result: StructuredAIResponse<any> = await liveProvider.generateStructuredResponse(
      'Return JSON: {"answer":"pong"}',
      { type: 'object', properties: { answer: { type: 'string' } } }
    );
    // We just verify the call completed and returned a structured response wrapper
    expect(result).toHaveProperty('success');
  }, 60000);
});
