import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/signalflow/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Missing lead_id query parameter' }, { status: 400 });
    }

    // 1. Init Supabase Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Read operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Call Postgres RPC
    logger.info('Fetching recommendations', { leadId });
    const { data, error } = await supabase.rpc('get_signalflow_recommendations', { p_lead_id: leadId });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      recommendations: data || []
    });

  } catch (error: any) {
    logger.error('Recommendations API Error', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
