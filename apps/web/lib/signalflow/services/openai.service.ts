import OpenAI from 'openai';
import { ChatMessage, LeadIntelligence, validateLeadIntelligence } from '../schemas';
import { SYSTEM_PROMPT, buildExtractionPrompt, buildExtractionPromptWithSummary } from '../prompts';
import { SignalFlowExtractionError, SignalFlowRateLimitError } from '../errors';
import { logger } from '../logger';
import {
  normalizeFurnishing,
  normalizeOccupant,
  normalizeLandmark,
  normalizePropertyTypes
} from '../dictionary';

export interface ExtractionResult {
  success: boolean;
  data?: LeadIntelligence;
  rawResponse?: string;
  error?: string;
  tokensUsed: number;
}

function calculateLeadTemperature(
  chatPayload: ChatMessage[],
  extracted: any
): 'HOT' | 'WARM' | 'COLD' {
  const leadMessages = chatPayload.filter(m => m.sender === 'LEAD');
  if (leadMessages.length === 0) return 'COLD';

  const leadTexts = leadMessages.map(m => m.message.trim().toLowerCase());
  const allLeadTextJoined = leadTexts.join(' ');

  // 1. HOT check: Site visit, location request, immediate move
  const hotKeywords = [
    'visit', 'see the property', 'show the property', 'show me', 'location', 
    'address', 'map', 'today', 'tomorrow', 'ready to move', 'immediate', 
    'now', 'visiting', 'meet', 'appointment', 'send address', 'send location', 
    'gps', 'right away'
  ];
  const hasHotKeyword = hotKeywords.some(keyword => {
    // If it is "sending requirements right away", it's not hot (it's just requirements)
    if (keyword === 'right away' && allLeadTextJoined.includes('sending you my requirements')) {
      return false;
    }
    return allLeadTextJoined.includes(keyword);
  });

  if (hasHotKeyword) {
    return 'HOT';
  }

  // 2. COLD check: Greetings only, empty, or no requirements at all
  const isGreetingOrEmptyOnly = leadTexts.every(text => {
    const clean = text.replace(/[^\w\s]/g, '').trim();
    return ['', 'hi', 'hello', 'hey', 'good morning', 'good evening', 'namaste', 'sir', 'ok', 'okay', 'yes', 'no'].includes(clean);
  });

  const hasNoRequirements = 
    (!extracted.propertyTypes || extracted.propertyTypes.length === 0) &&
    extracted.budgetMin === null &&
    extracted.budgetMax === null &&
    (!extracted.preferredSectors || extracted.preferredSectors.length === 0) &&
    (!extracted.landmarks || extracted.landmarks.length === 0) &&
    extracted.moveInTimeline === null &&
    extracted.furnishing === null;

  if (isGreetingOrEmptyOnly || hasNoRequirements) {
    return 'COLD';
  }

  // 3. WARM: Any requirements shared but no HOT signals
  return 'WARM';
}

function filterAgentLeakage(
  chatPayload: ChatMessage[],
  sectors: string[],
  landmarks: string[]
): { sectors: string[]; landmarks: string[] } {
  const leadMessages = chatPayload.filter(m => m.sender === 'LEAD');
  const agentMessages = chatPayload.filter(m => m.sender === 'AGENT');
  
  const leadTexts = leadMessages.map(m => m.message.toLowerCase());
  
  function hasPositiveKeyword(text: string): boolean {
    const clean = text.toLowerCase();
    const shortKeywords = ['ok', 'okay', 'yes', 'sure', 'show', 'send', 'pic', 'map', 'rent', 'haan', 'chali', 'bhejo'];
    const longKeywords = ['interested', 'looking for', 'detail', 'photo', 'visit', 'address', 'location', 'tomorrow', 'today', 'price', 'dikhao'];
    const hasShort = shortKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(clean));
    const hasLong = longKeywords.some(kw => clean.includes(kw));
    return hasShort || hasLong;
  }

  const keepsSectors = sectors.filter(sec => {
    const secLower = sec.toLowerCase();
    
    const agentMentioned = agentMessages.some(msg => 
      new RegExp(`\\b${secLower}\\b`, 'i').test(msg.message.toLowerCase())
    );
    
    if (!agentMentioned) return true;

    const leadMentioned = leadTexts.some(txt => 
      new RegExp(`\\b${secLower}\\b`, 'i').test(txt)
    );
    if (leadMentioned) return true;

    const agentMsgIndex = chatPayload.findIndex(msg => 
      msg.sender === 'AGENT' && 
      new RegExp(`\\b${secLower}\\b`, 'i').test(msg.message.toLowerCase())
    );
    if (agentMsgIndex === -1) return false;

    const subsequentLeadMsgs = chatPayload.slice(agentMsgIndex + 1).filter(msg => msg.sender === 'LEAD');
    const hasAgreement = subsequentLeadMsgs.some(msg => hasPositiveKeyword(msg.message));
    return hasAgreement;
  });

  const keepsLandmarks = landmarks.filter(lm => {
    const lmLower = lm.toLowerCase();
    
    const agentMentioned = agentMessages.some(msg => 
      msg.message.toLowerCase().includes(lmLower) ||
      (lmLower === 'golf course road' && msg.message.toLowerCase().includes('gcr')) ||
      (lmLower === 'golf course extension road' && msg.message.toLowerCase().includes('gcr ext'))
    );
    
    if (!agentMentioned) return true;

    const words = lmLower.split(/\s+/).filter(w => w.length > 3);
    const leadMentioned = leadTexts.some(txt => 
      txt.includes(lmLower) || 
      (words.length > 0 && words.some(w => txt.includes(w.substring(0, 4))))
    );
    if (leadMentioned) return true;

    const agentMsgIndex = chatPayload.findIndex(msg => 
      msg.sender === 'AGENT' && msg.message.toLowerCase().includes(lmLower)
    );
    if (agentMsgIndex === -1) return false;

    const subsequentLeadMsgs = chatPayload.slice(agentMsgIndex + 1).filter(msg => msg.sender === 'LEAD');
    const hasAgreement = subsequentLeadMsgs.some(msg => hasPositiveKeyword(msg.message));
    return hasAgreement;
  });

  return { sectors: keepsSectors, landmarks: keepsLandmarks };
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
        max_tokens: 200,
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
        max_tokens: 500,
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

        // Post-processing and normalization
        // 1. Normalize property types
        if (parsedJson.propertyTypes && Array.isArray(parsedJson.propertyTypes)) {
          const validTypes = new Set(['1RK', 'STUDIO', '1BHK', '2BHK', '3BHK', '4BHK', 'BUILDER_FLOOR', 'VILLA', 'COMMERCIAL_SHOP', 'OFFICE', 'PLOT', 'COMMERCIAL', 'PG', 'CO_LIVING']);
          parsedJson.propertyTypes = normalizePropertyTypes(parsedJson.propertyTypes)
            .filter(pt => validTypes.has(pt));
        }

        // 2. Normalize preferred sectors and landmarks
        const allSectors = parsedJson.preferredSectors || [];
        const allLandmarks = parsedJson.landmarks || [];
        const cleanedSectors: string[] = [];
        const cleanedLandmarks: string[] = [];

        const rawSectorsAndLandmarks = [...allSectors, ...allLandmarks];
        const processed = new Set<string>();

        rawSectorsAndLandmarks.forEach((item: any) => {
          if (typeof item !== 'string') return;
          const trimmed = item.trim();
          if (!trimmed) return;
          
          // Clean sector prefix (e.g. "Sector 57", "Sec-53", "sector 43") safely
          const cleanItem = trimmed
            .replace(/^(sector|sec|sec\.)\s*[-_]?\s*/i, '')
            .replace(/^s\s*[-_]?\s*(?=\d)/i, '')
            .trim();
          const cleanItemLower = cleanItem.toLowerCase();
          
          if (processed.has(cleanItemLower)) return;
          processed.add(cleanItemLower);

          // Check landmark dictionary
          const normalizedLm = normalizeLandmark(cleanItem);
          if (normalizedLm && normalizedLm.toLowerCase() !== cleanItemLower) {
            cleanedLandmarks.push(normalizedLm);
          } else if (/^\d+[a-zA-Z]?$/.test(cleanItem)) {
            // It's a sector number (e.g. 57, 53, 23a)
            cleanedSectors.push(cleanItem);
          } else {
            // It's a landmark name or not a sector number
            cleanedLandmarks.push(normalizedLm || cleanItem);
          }
        });

        const filtered = filterAgentLeakage(chatPayload, cleanedSectors, cleanedLandmarks);
        parsedJson.preferredSectors = filtered.sectors;
        parsedJson.landmarks = filtered.landmarks;

        // 3. Normalize furnishing
        if (parsedJson.furnishing) {
          parsedJson.furnishing = normalizeFurnishing(parsedJson.furnishing);
        }

        // 4. Normalize occupant type
        if (parsedJson.occupantType) {
          parsedJson.occupantType = normalizeOccupant(parsedJson.occupantType);
        }

        // 5. Clean budget values to avoid Zod schema validation errors (>0 constraint)
        if (parsedJson.budgetMin !== undefined && parsedJson.budgetMin !== null) {
          const bMin = Number(parsedJson.budgetMin);
          parsedJson.budgetMin = (isNaN(bMin) || bMin <= 0) ? null : Math.round(bMin);
        }
        if (parsedJson.budgetMax !== undefined && parsedJson.budgetMax !== null) {
          const bMax = Number(parsedJson.budgetMax);
          parsedJson.budgetMax = (isNaN(bMax) || bMax <= 0) ? null : Math.round(bMax);
        }

        // 6. Overrides lead temperature using deterministic classification rules
        parsedJson.leadTemperature = calculateLeadTemperature(chatPayload, parsedJson);
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
