import OpenAI from 'openai';
import { ChatMessage, LeadIntelligence, validateLeadIntelligence } from '../schemas';
import { SYSTEM_PROMPT, buildExtractionPrompt, buildExtractionPromptWithSummary } from '../prompts';
import { SignalFlowExtractionError, SignalFlowRateLimitError } from '../errors';
import { logger } from '../logger';

export interface ExtractionResult {
  success: boolean;
  data?: LeadIntelligence;
  rawResponse?: string;
  error?: string;
  tokensUsed: number;
}

export class OpenAIExtractionService {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not defined.');
    }
    const baseURL = process.env.OPENAI_API_BASE || undefined;
    this.openai = new OpenAI({ apiKey: key, baseURL });
  }

  private getModel(): string {
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (process.env.OPENAI_API_BASE?.includes('openrouter.ai') && modelName === 'anthropic/claude-3.5-sonnet') {
      return 'openai/gpt-4o-mini';
    }
    return modelName;
  }

  private async summarizeChatSegment(chatMessages: ChatMessage[]): Promise<{ success: boolean; summary?: string; error?: string; tokensUsed: number }> {
    const formattedChat = chatMessages
      .map((msg) => `[${msg.timestamp}] ${msg.sender}: ${msg.message}`)
      .join('\n');

    const summaryPrompt = `You are a real estate assistant. Please provide a concise summary of the following WhatsApp conversation between an Agent and a Lead.
Focus on extracting what requirements the lead initially stated, how they evolved over time, and any key decisions or agreements made.
Keep the summary under 300 words.

Conversation:
${formattedChat}`;

    try {
      const finalModel = this.getModel();
      const response = await this.openai.chat.completions.create({
        model: finalModel,
        temperature: 0.0,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: summaryPrompt }
        ],
      });

      const summaryText = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        success: true,
        summary: summaryText,
        tokensUsed
      };
    } catch (error: any) {
      logger.error('Failed to summarize segment', error);
      return {
        success: false,
        error: error.message,
        tokensUsed: 0
      };
    }
  }

  public async extractLeadIntelligence(
    chatPayload: ChatMessage[],
    currentDateIso: string = new Date().toISOString()
  ): Promise<ExtractionResult> {
    logger.info('Calling OpenAI for Lead Extraction', { payloadSize: chatPayload.length });

    try {
      let userPrompt: string;
      let tokensUsed = 0;
      if (chatPayload.length > 100) {
        logger.info('Chat history length exceeds 100 messages. Summarizing older history.');
        const olderHistory = chatPayload.slice(0, -40);
        const recentMessages = chatPayload.slice(-40);

        const summaryResult = await this.summarizeChatSegment(olderHistory);
        tokensUsed += summaryResult.tokensUsed;

        if (!summaryResult.success) {
          throw new SignalFlowExtractionError('Failed to summarize older chat segment: ' + summaryResult.error);
        }

        userPrompt = buildExtractionPromptWithSummary(
          summaryResult.summary || '',
          recentMessages,
          currentDateIso
        );
      } else {
        userPrompt = buildExtractionPrompt(chatPayload, currentDateIso);
      }

      const finalModel = this.getModel();
      const response = await this.openai.chat.completions.create({
        model: finalModel,
        temperature: 0.0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
      });

      const rawJson = response.choices[0]?.message?.content;
      tokensUsed += response.usage?.total_tokens || 0;

      if (!rawJson) {
        throw new SignalFlowExtractionError('OpenAI returned empty response.');
      }

      logger.debug('Received raw response from OpenAI', { rawJson });

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawJson);
      } catch (parseError) {
        throw new SignalFlowExtractionError('OpenAI returned invalid JSON.', { rawJson });
      }

      // Inject lastChatSnapshot before validation to preserve context
      if (parsedJson && typeof parsedJson === 'object') {
        parsedJson.lastChatSnapshot = parsedJson.lastChatSnapshot || chatPayload;
      }

      // Strict validation through Zod
      try {
        const validatedData = validateLeadIntelligence(parsedJson);
        logger.info('Successfully extracted and validated lead intelligence.', { tokensUsed });
        
        return {
          success: true,
          data: validatedData,
          rawResponse: rawJson,
          tokensUsed,
        };
      } catch (validationError: any) {
        throw new SignalFlowExtractionError(validationError.message, { rawJson });
      }

    } catch (error: any) {
      logger.error('OpenAI Extraction Failed', error);
      
      if (error?.status === 429) {
        throw new SignalFlowRateLimitError();
      }
      
      if (error instanceof SignalFlowExtractionError) {
        throw error;
      }

      throw new SignalFlowExtractionError('Failed to communicate with OpenAI API.', { message: error?.message });
    }
  }
}
