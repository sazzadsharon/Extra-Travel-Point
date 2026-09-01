import { AIProvider, ChatMessage, AIResponse, StructuredAIResponse, AIProviderConfig } from './types';

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;

  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig = {}) {
    this.config = {
      temperature: 0.7,
      maxTokens: 2048,
      timeout: 30000,
      ...config
    };
  }

  abstract chat(messages: ChatMessage[]): Promise<AIResponse>;

  abstract generateText(prompt: string): Promise<AIResponse>;

  abstract generateStructuredResponse<T>(
    prompt: string,
    schema: Record<string, unknown>
  ): Promise<StructuredAIResponse<T>>;

  abstract isAvailable(): Promise<boolean>;

  protected validateMessages(messages: ChatMessage[]): void {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const message of messages) {
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
      if (!message.content || typeof message.content !== 'string') {
        throw new Error('Message content must be a non-empty string');
      }
    }
  }

  protected validatePrompt(prompt: string): void {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }
    if (prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty or whitespace only');
    }
  }

  protected validateSchema(schema: Record<string, unknown>): void {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a valid object');
    }
  }
}
