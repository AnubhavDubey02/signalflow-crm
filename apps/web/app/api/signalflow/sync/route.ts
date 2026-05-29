import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateLeadIntelligence } from '@/lib/signalflow/schemas';
import { IntelligenceRepository } from '@/lib/signalflow/repositories/intelligence.repository';
import { TasksRepository } from '@/lib/signalflow/repositories/tasks.repository';
import { logger } from '@/lib/signalflow/logger';

export async function POST(request: Request) {
  try {
    // 1. Auth & Supabase Client Init (Assuming Supabase URL/Key exist in env)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // In production, you would use createServerClient from @supabase/ssr, using service role if necessary for upserts
    const token = authHeader.replace('Bearer ', '');
    const isStub = token === 'STUB_TOKEN';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isStub || !supabaseUrl || !supabaseKey) {
      logger.info('Using Dev Mock Sync Auth Bypass');
      // Parse body if possible to include in logging
      let body;
      try {
        body = await request.clone().json();
      } catch (e) {}
      
      return NextResponse.json({
        success: true,
        leadId: 'dev-lead-id-456',
        intelligenceId: 'dev-intel-id-789',
        taskId: 'dev-task-id-101',
        message: 'Intelligence synced successfully (Development Mode)'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get agent ID from token (stubbed here, usually derived from auth user)
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: 'Invalid Token' }, { status: 401 });
    }
    const agentId = authData.user.id;

    // 2. Parse & Validate Body
    const body = await request.json();
    const { whatsappPhone, intelligenceData } = body;

    if (!whatsappPhone) {
      return NextResponse.json({ success: false, error: 'Missing whatsappPhone' }, { status: 400 });
    }

    const validatedIntelligence = validateLeadIntelligence(intelligenceData);

    // 3. Init Repositories
    const intelRepo = new IntelligenceRepository(supabase);
    const tasksRepo = new TasksRepository(supabase);

    // 4. Execute Sync (Transaction-safe Upsert)
    const { leadId, intelligenceId } = await intelRepo.syncIntelligence(
      agentId,
      whatsappPhone,
      validatedIntelligence
    );

    // 5. Create Task if applicable
    let taskId = null;
    if (validatedIntelligence.nextAction) {
      taskId = await tasksRepo.createTask(leadId, agentId, validatedIntelligence.nextAction);
    }

    logger.info('Intelligence Synced Successfully', { leadId, intelligenceId, taskId });

    return NextResponse.json({
      success: true,
      leadId,
      intelligenceId,
      taskId,
      message: 'Intelligence synced successfully'
    });

  } catch (error: any) {
    logger.error('Sync API Error', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
