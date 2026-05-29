import { SupabaseClient } from '@supabase/supabase-js';
import { SignalFlowTask } from '../schemas';
import { logger } from '../logger';

export class TasksRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  public async createTask(
    leadId: string,
    agentId: string,
    task: SignalFlowTask
  ): Promise<string> {
    logger.info('Creating SignalFlow Task', { leadId, actionType: task.actionType });

    const { data, error } = await this.supabase
      .from('signalflow_tasks')
      .insert({
        lead_id: leadId,
        agent_id: agentId,
        action_type: task.actionType,
        description: task.description,
        due_date: task.dueDate,
        status: 'PENDING'
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create task: ${error?.message}`);
    }

    return data.id;
  }
}
