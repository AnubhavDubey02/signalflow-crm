import { SupabaseClient } from '@supabase/supabase-js';
import { LeadIntelligence } from '../schemas';
import { logger } from '../logger';

export class IntelligenceRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Upserts a lead and their intelligence securely in a transaction-like manner.
   * If lead doesn't exist by phone, creates it first.
   */
  public async syncIntelligence(
    agentId: string,
    whatsappPhone: string,
    intelligence: LeadIntelligence
  ): Promise<{ leadId: string; intelligenceId: string }> {
    
    // 1. Resolve Lead ID (Find or Create)
    const { data: existingLead, error: leadSearchErr } = await this.supabase
      .from('leads')
      .select('id')
      .eq('whatsapp_phone', whatsappPhone)
      .single();

    let leadId: string;

    if (!existingLead) {
      logger.info('Lead not found. Creating new CRM lead.', { whatsappPhone });
      const { data: newLead, error: insertErr } = await this.supabase
        .from('leads')
        .insert({ whatsapp_phone: whatsappPhone, agent_id: agentId })
        .select('id')
        .single();
        
      if (insertErr || !newLead) {
        throw new Error(`Failed to create base lead: ${insertErr?.message}`);
      }
      leadId = newLead.id;
    } else {
      leadId = existingLead.id;
    }

    // Map detailed occupant types to the basic database enum values to avoid CHECK constraint violations
    let dbOccupantType = intelligence.occupantType;
    if (dbOccupantType) {
      const upper = dbOccupantType.toUpperCase();
      if (upper === 'WORKING_PROFESSIONALS' || upper === 'STUDENTS' || upper === 'BACHELOR') {
        dbOccupantType = 'BACHELOR' as any;
      } else if (upper === 'FAMILY' || upper === 'AIRBNB_OPERATORS') {
        dbOccupantType = 'FAMILY' as any;
      } else if (upper === 'COUPLE') {
        dbOccupantType = 'COUPLE' as any;
      }
    }

    // 2. Upsert Intelligence
    // Converting camelCase TS to snake_case DB
    const dbPayload = {
      lead_id: leadId,
      whatsapp_phone: whatsappPhone,
      transaction_type: intelligence.transactionType,
      requirement_summary: intelligence.requirementSummary,
      property_types: intelligence.propertyTypes,
      budget_min: intelligence.budgetMin,
      budget_max: intelligence.budgetMax,
      preferred_sectors: intelligence.preferredSectors,
      landmarks: intelligence.landmarks,
      furnishing: intelligence.furnishing,
      occupant_type: dbOccupantType,
      move_in_timeline: intelligence.moveInTimeline,
      lead_temperature: intelligence.leadTemperature,
      last_chat_snapshot: intelligence.lastChatSnapshot,
      needs_review: false, // Agent just hit sync, so it's reviewed
    };

    const { data: upserted, error: upsertErr } = await this.supabase
      .from('signalflow_intelligence')
      .upsert(dbPayload, { onConflict: 'whatsapp_phone' })
      .select('id')
      .single();

    if (upsertErr || !upserted) {
      throw new Error(`Failed to upsert intelligence: ${upsertErr?.message}`);
    }

    return { leadId, intelligenceId: upserted.id };
  }
}
