import { BaseAIProvider } from '../BaseAIProvider';
import { AIProvider, ChatMessage, AIResponse, StructuredAIResponse, AIProviderConfig } from '../types';

export class OllamaProvider extends BaseAIProvider implements AIProvider {
  public readonly name = 'ollama';
  
  private readonly baseUrl: string;
  private readonly model: string;
  
  constructor(config: AIProviderConfig = {}) {
    super(config);
    
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'llama2';
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    this.validateMessages(messages);
    
    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        content: data.message.content,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama chat failed: ${error.message}`);
      }
      throw new Error('Ollama chat failed');
    }
  }

  async generateText(prompt: string): Promise<AIResponse> {
    this.validatePrompt(prompt);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        content: data.response,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama generate failed: ${error.message}`);
      }
      throw new Error('Ollama generate failed');
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: Record<string, unknown>
  ): Promise<StructuredAIResponse<T>> {
    this.validatePrompt(prompt);
    this.validateSchema(schema);
    
    try {
      // For Ollama, we'll generate text and then attempt to parse it as JSON
      const response = await this.generateText(prompt);
      
      try {
        const parsedData = JSON.parse(response.content) as T;
        return {
          success: true,
          data: parsedData
        };
      } catch (parseError) {
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
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET'
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}