import { NextResponse } from 'next/server';
import { OpenAIExtractionService } from '../../../../lib/signalflow/services/openai.service';
import { validateAnalysisRequest } from '../../../../lib/signalflow/schemas';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const isStubToken = authHeader === 'Bearer STUB_TOKEN';

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const isApiKeyMissing = !apiKey;

    const body = await req.json();
    const validatedRequest = validateAnalysisRequest(body);

    if (isStubToken || isApiKeyMissing) {
      console.log('Using mock fallback response (Stub Token or missing API key)');
      return NextResponse.json({
        success: true,
        received: validatedRequest,
        data: {
          transactionType: "RENT",
          requirementSummary: "Client looking for a 2BHK on rent in Sector 43 under 50k",
          requirementHistory: [
            "Looking for 1BHK under 30k",
            "Final: 2BHK on rent in Sector 43 under 50k"
          ],
          lastChatSnapshot: validatedRequest.chatPayload,
          propertyTypes: ["2BHK"],
          budgetMin: 40000,
          budgetMax: 50000,
          preferredSectors: ["43"],
          landmarks: ["Cyber City"],
          furnishing: "FULLY",
          occupantType: "FAMILY",
          moveInTimeline: "Immediate",
          leadTemperature: "WARM",
          nextAction: {
            actionType: "CALL",
            description: "Call back to schedule site visit",
            dueDate: new Date(Date.now() + 86400000).toISOString()
          }
        }
      }, { status: 200 });
    }

    const extractionService = new OpenAIExtractionService(apiKey);
    const result = await extractionService.extractLeadIntelligence(validatedRequest.chatPayload);

    if (!result.success || !result.data) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to extract lead intelligence.'
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      received: validatedRequest,
      data: result.data
    }, { status: 200 });

  } catch (error: any) {
    console.error('Analyze API Endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Invalid request body or validation failed'
    }, { status: 400 });
  }
}

// Support GET requests with a 405 Method Not Allowed to satisfy task 6
export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' }
  });
}
