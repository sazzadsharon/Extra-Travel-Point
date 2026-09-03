import { AIProvider } from './types';
import { OmniRouteProvider } from './providers/OmniRouteProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { BaseAIProvider } from './BaseAIProvider';

export class AIFactory {
  private static instance: AIFactory;
  private providers: Map<string, AIProvider> = new Map();

  private constructor() {
    this.registerProvider('omniroute', () => new OmniRouteProvider());
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
    const preferredOrder = ['omniroute', 'ollama'];

    for (const name of preferredOrder) {
      const provider = this.getProvider(name);
      if (provider) {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          return provider;
        }
      }
    }

    for (const [name, provider] of this.providers) {
      if (!preferredOrder.includes(name)) {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          return provider;
        }
      }
    }

    return null;
  }
}

export const aiFactory = AIFactory.getInstance();
