export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StructuredAIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

export interface AIProviderConfig {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface AIProvider {
  name: string;
  
  chat(messages: ChatMessage[]): Promise<AIResponse>;
  
  generateText(prompt: string): Promise<AIResponse>;
  
  generateStructuredResponse<T>(
    prompt: string,
    schema: Record<string, unknown>
  ): Promise<StructuredAIResponse<T>>;
  
  isAvailable(): Promise<boolean>;
}

export interface AIFactoryOptions {
  provider: string;
  config: AIProviderConfig;
}

export type SupportedProvider = 'ollama' | 'openai' | 'gemini';
