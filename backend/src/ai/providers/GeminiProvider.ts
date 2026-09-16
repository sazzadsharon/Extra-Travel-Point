import { BaseAIProvider } from '../BaseAIProvider';
import { AIProvider, ChatMessage, AIResponse, StructuredAIResponse, AIProviderConfig } from '../types';

export interface GeminiProviderConfig extends AIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiRequest {
  systemInstruction?: GeminiContent;
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiProvider extends BaseAIProvider implements AIProvider {
  public readonly name = 'gemini';

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;

  constructor(config: GeminiProviderConfig = {}) {
    super(config);

    this.baseUrl = (
      config.baseUrl ||
      process.env.GEMINI_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/$/, '');

    this.model = config.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || undefined;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  private splitSystemMessages(messages: ChatMessage[]): {
    contents: GeminiContent[];
    systemText: string;
  } {
    const contents: GeminiContent[] = [];
    let systemText = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText += (systemText ? '\n\n' : '') + msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    return { contents, systemText };
  }

  private buildRequest(
    messages: ChatMessage[],
    extraConfig: { temperature?: number; maxOutputTokens?: number } = {}
  ): GeminiRequest {
    const { contents, systemText } = this.splitSystemMessages(messages);

    const request: GeminiRequest = {
      contents
    };

    if (systemText) {
      request.systemInstruction = {
        role: 'user',
        parts: [{ text: systemText }]
      };
    }

    request.generationConfig = {
      temperature: extraConfig.temperature ?? this.config.temperature ?? 0.7,
      maxOutputTokens: extraConfig.maxOutputTokens ?? this.config.maxTokens ?? 2048
    };

    return request;
  }

  private getUrl(): string {
    return `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey || ''}`;
  }

  private parseResponse(data: GeminiResponse): AIResponse {
    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.code} ${data.error.status} - ${data.error.message}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Invalid Gemini response: missing completion content');
    }

    const content = candidate.content.parts
      .map((p) => p.text || '')
      .join('')
      .trim();

    if (!content) {
      throw new Error('Invalid Gemini response: missing completion content');
    }

    return {
      content,
      finishReason: candidate.finishReason || 'STOP',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateMessages(messages);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(this.getUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.buildRequest(messages)),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}${text ? ' - ' + text : ''}`);
      }

      const data = (await response.json()) as GeminiResponse;
      return this.parseResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini chat failed: ${error.message}`);
      }
      throw new Error('Gemini chat failed');
    }
  }

  async generateText(prompt: string): Promise<AIResponse> {
    this.validatePrompt(prompt);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(this.getUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(
          this.buildRequest([{ role: 'user', content: prompt }])
        ),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}${text ? ' - ' + text : ''}`);
      }

      const data = (await response.json()) as GeminiResponse;
      return this.parseResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini generate failed: ${error.message}`);
      }
      throw new Error('Gemini generate failed');
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: Record<string, unknown>
  ): Promise<StructuredAIResponse<T>> {
    this.validatePrompt(prompt);
    this.validateSchema(schema);

    try {
      const response = await this.generateText(prompt);

      try {
        const parsedData = JSON.parse(response.content) as T;
        return {
          success: true,
          data: parsedData
        };
      } catch {
        return {
          success: false,
          error: 'Failed to parse structured response as JSON',
          warnings: ['Response was not valid JSON. Consider using generateText() instead.']
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        };
      }
      return {
        success: false,
        error: 'Failed to generate structured response'
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          method: 'GET',
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}