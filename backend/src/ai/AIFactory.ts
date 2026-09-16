import { AIProvider } from './types';
import { OmniRouteProvider } from './providers/OmniRouteProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { BaseAIProvider } from './BaseAIProvider';

export class AIFactory {
  private static instance: AIFactory;
  private providers: Map<string, AIProvider> = new Map();

  private constructor() {
    this.registerProvider('omniroute', () => new OmniRouteProvider());
    this.registerProvider('gemini', () => new GeminiProvider());
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

  public getDefaultProvider(): AIProvider | null {
    const configured = (process.env.AI_PROVIDER || 'omniroute').toLowerCase();
    const provider = this.getProvider(configured);
    if (provider) {
      return provider;
    }
    return this.getProvider('omniroute');
  }
}

export const aiFactory = AIFactory.getInstance();