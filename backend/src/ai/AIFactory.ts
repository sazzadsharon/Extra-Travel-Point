import { AIProvider } from './types';
import { OllamaProvider } from './providers/OllamaProvider';
import { BaseAIProvider } from './BaseAIProvider';

export class AIFactory {
  private static instance: AIFactory;
  private providers: Map<string, AIProvider> = new Map();
  
  private constructor() {
    // Initialize with default providers
    this.registerProvider('ollama', () => new OllamaProvider());
  }
  
  public static getInstance(): AIFactory {
    if (!AIFactory.instance) {
      AIFactory.instance = new AIFactory();
    }
    return AIFactory.instance;
  }
  
  public registerProvider<T extends AIProvider>(
    name: string,
    providerFactory: () => T
  ): void {
    this.providers.set(name, providerFactory());
  }
  
  public getProvider(name: string): AIProvider | null {
    return this.providers.get(name) || null;
  }
  
  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  public async getDefaultProvider(): Promise<AIProvider | null> {
    // Try to get Ollama as default (free/local first)
    const ollamaProvider = this.getProvider('ollama');
    if (ollamaProvider) {
      const isAvailable = await ollamaProvider.isAvailable();
      if (isAvailable) {
        return ollamaProvider;
      }
    }
    
    // Return first available provider as fallback
    for (const [name, provider] of this.providers) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        return provider;
      }
    }
    
    return null;
  }
}

// Global instance for easy access
export const aiFactory = AIFactory.getInstance();