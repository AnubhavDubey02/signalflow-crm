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

    // 2. Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const isStub = token === 'STUB_TOKEN';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (isStub || !supabaseUrl || !supabaseKey) {
      logger.info('Using Dev Mock Recommendations Bypass');
      return NextResponse.json({
        success: true,
        recommendations: [
          {
            id: 'mock-rec-1',
            title: 'Sleek 2BHK Apartment in Sector 43',
            price: '45,000',
            match_score: 95,
            type: 'Rent',
            sector: 'Sector 43'
          },
          {
            id: 'mock-rec-2',
            title: 'Cozy 2BHK Flat near Cyber City',
            price: '48,000',
            match_score: 88,
            type: 'Rent',
            sector: 'Sector 43'
          }
        ]
      });
    }

    // 1. Init Supabase Client
    const supabase = createClient(supabaseUrl, supabaseKey);

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
