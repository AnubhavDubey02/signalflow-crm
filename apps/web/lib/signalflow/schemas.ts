import { z } from 'zod';

export const ChatMessageSchema = z.object({
  sender: z.enum(['AGENT', 'LEAD']),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
});

export const SignalFlowTaskSchema = z.object({
  actionType: z.enum(['SITE_VISIT', 'CALL', 'SHARE_INVENTORY', 'FOLLOW_UP']),
  description: z.string().nullable(),
  dueDate: z.string().datetime(), // ISO string
});

export const PropertyTypeEnum = z.enum(['STUDIO', '1BHK', '2BHK', '3BHK', '4BHK', 'PLOT', 'COMMERCIAL', 'PG', 'CO_LIVING']);

// Updated Schema based on Benchmark findings
export const LeadIntelligenceSchema = z.object({
  transactionType: z.enum(['RENT', 'BUY']).default('RENT'),
  requirementSummary: z.string().nullable(),
  lastChatSnapshot: z.array(ChatMessageSchema).nullable(), // Stored to preserve context
  propertyTypes: z.array(PropertyTypeEnum).min(1).default(['1BHK']), // Changed from string to array
  budgetMin: z.number().int().positive().nullable(),
  budgetMax: z.number().int().positive().nullable(),
  preferredSectors: z.array(z.string()),
  landmarks: z.array(z.string()).default([]), // Added based on "Near rapid metro" findings
  furnishing: z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).nullable(),
  occupantType: z.enum(['BACHELOR', 'FAMILY', 'COUPLE']).nullable(),
  moveInTimeline: z.string().nullable(),
  leadTemperature: z.enum(['HOT', 'WARM', 'COLD']),
  nextAction: SignalFlowTaskSchema.nullable()
});

export const AnalysisRequestSchema = z.object({
  whatsappPhone: z.string().min(10, 'Invalid phone number format'),
  chatPayload: z.array(ChatMessageSchema).min(1, 'Chat payload cannot be empty').max(200, 'Payload too large'),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type LeadIntelligence = z.infer<typeof LeadIntelligenceSchema>;
export type SignalFlowTask = z.infer<typeof SignalFlowTaskSchema>;

export function validateAnalysisRequest(data: unknown) {
  const result = AnalysisRequestSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid Analysis Request: ${result.error.message}`);
  return result.data;
}

export function validateLeadIntelligence(data: unknown) {
  const result = LeadIntelligenceSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid AI Output: ${result.error.message}`);
  return result.data;
}
