import OpenAI from 'openai';
import { ChatMessage, LeadIntelligence, validateLeadIntelligence } from './schemas';
import { SYSTEM_PROMPT, buildExtractionPrompt } from './prompts';
import { SignalFlowExtractionError, SignalFlowRateLimitError } from './errors';
import { logger } from './logger';

export interface ExtractionResult {
  success: boolean;
  data?: LeadIntelligence;
  rawResponse?: string;
  error?: string;
  tokensUsed: number;
}

export class OpenAIExtractionService {
  private openai: OpenAI;
  private readonly model = 'gpt-4o-mini';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not defined.');
    }
    this.openai = new OpenAI({ apiKey: key });
  }

  public async extractLeadIntelligence(
    chatPayload: ChatMessage[],
    currentDateIso: string = new Date().toISOString()
  ): Promise<ExtractionResult> {
    const userPrompt = buildExtractionPrompt(chatPayload, currentDateIso);
    
    logger.info('Calling OpenAI for Lead Extraction', { payloadSize: chatPayload.length });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0.0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
      });

      const rawJson = response.choices[0]?.message?.content;
      const tokensUsed = response.usage?.total_tokens || 0;

      if (!rawJson) {
        throw new SignalFlowExtractionError('OpenAI returned empty response.');
      }

      logger.debug('Received raw response from OpenAI', { rawJson });

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawJson);
      } catch (parseError) {
        throw new SignalFlowExtractionError('OpenAI returned invalid JSON.', { rawJson });
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
