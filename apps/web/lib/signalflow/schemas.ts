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

export const PropertyTypeEnum = z.enum(['1RK', 'STUDIO', '1BHK', '2BHK', '3BHK', '4BHK', 'BUILDER_FLOOR', 'VILLA', 'COMMERCIAL_SHOP', 'OFFICE', 'PLOT', 'COMMERCIAL', 'PG', 'CO_LIVING']);

// Updated Schema based on Benchmark findings
export const LeadIntelligenceSchema = z.object({
  transactionType: z.enum(['RENT', 'BUY']).default('RENT'),
  requirementSummary: z.string().nullable().default(null),
  requirementHistory: z.array(z.string()).default([]), // Added for requirement evolution
  lastChatSnapshot: z.array(ChatMessageSchema).nullable().default(null), // Stored to preserve context
  propertyTypes: z.array(PropertyTypeEnum).nullable().transform(val => val ?? []).default([]),
  budgetMin: z.number().int().positive().nullable().default(null),
  budgetMax: z.number().int().positive().nullable().default(null),
  preferredSectors: z.array(z.string()).nullable().transform(val => val ?? []).default([]),
  landmarks: z.array(z.string()).nullable().transform(val => val ?? []).default([]),
  furnishing: z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).nullable().default(null),
  occupantType: z.enum(['BACHELOR', 'FAMILY', 'COUPLE', 'WORKING_PROFESSIONALS', 'STUDENTS', 'AIRBNB_OPERATORS']).nullable().default(null),
  moveInTimeline: z.string().nullable().default(null),
  leadTemperature: z.enum(['HOT', 'WARM', 'COLD']).nullable().transform(val => val ?? 'COLD').default('COLD'),
  nextAction: SignalFlowTaskSchema.nullable().default(null)
});

export const AnalysisRequestSchema = z.object({
  whatsappPhone: z.string().min(10, 'Invalid phone number format'),
  chatPayload: z.array(ChatMessageSchema).min(1, 'Chat payload cannot be empty').max(1000, 'Payload too large'),
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
