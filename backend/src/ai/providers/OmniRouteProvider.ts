import { BaseAIProvider } from '../BaseAIProvider';
import { AIProvider, ChatMessage, AIResponse, StructuredAIResponse, AIProviderConfig } from '../types';

export class OmniRouteProvider extends BaseAIProvider implements AIProvider {
  public readonly name = 'omniroute';

  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: AIProviderConfig = {}) {
    super(config);

    this.baseUrl = (config.baseUrl || process.env.OMNIROUTE_BASE_URL || 'http://127.0.0.1:20128/v1').replace(/\/$/, '');
    this.model = config.model || process.env.OMNIROUTE_MODEL || 'auto';
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateMessages(messages);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`OmniRoute API error: ${response.status} ${response.statusText}${text ? ' - ' + text : ''}`);
      }

      const data = await response.json();

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid OmniRoute response: missing completion content');
      }

      return {
        content,
        finishReason: data?.choices?.[0]?.finish_reason || 'stop',
        usage: {
          promptTokens: data?.usage?.prompt_tokens || 0,
          completionTokens: data?.usage?.completion_tokens || 0,
          totalTokens: data?.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OmniRoute chat failed: ${error.message}`);
      }
      throw new Error('OmniRoute chat failed');
    }
  }

  async generateText(prompt: string): Promise<AIResponse> {
    this.validatePrompt(prompt);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`OmniRoute API error: ${response.status} ${response.statusText}${text ? ' - ' + text : ''}`);
      }

      const data = await response.json();

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid OmniRoute response: missing completion content');
      }

      return {
        content,
        finishReason: data?.choices?.[0]?.finish_reason || 'stop',
        usage: {
          promptTokens: data?.usage?.prompt_tokens || 0,
          completionTokens: data?.usage?.completion_tokens || 0,
          totalTokens: data?.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OmniRoute generate failed: ${error.message}`);
      }
      throw new Error('OmniRoute generate failed');
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
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
