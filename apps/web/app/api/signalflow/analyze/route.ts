import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    return NextResponse.json({
      success: true,
      received: body,
      // data corresponds to the LeadIntelligence object the extension expects
      data: {
        requirementSummary: "Client looking for a 2BHK on rent in Sector 43",
        transactionType: "RENT",
        propertyTypes: ["2BHK"],
        budgetMin: 40000,
        budgetMax: 50000,
        preferredSectors: ["Sector 43"],
        landmarks: ["Cyber City"],
        furnishing: "FULLY",
        occupantType: "FAMILY",
        moveInTimeline: "Immediate",
        leadTemperature: "WARM",
        nextAction: {
          actionType: "CALL",
          description: "Call back to schedule site visit",
          dueDate: new Date(Date.now() + 86400000).toISOString() // 1 day from now
        }
      },
      // leadIntelligence matches the user's expected debug output structure
      leadIntelligence: {
        transactionType: "Rent",
        propertyType: "2BHK",
        budget: "40000-50000",
        sectors: ["43"],
        leadTemperature: "Warm",
        nextAction: "Call Lead"
      }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Invalid JSON request body'
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
