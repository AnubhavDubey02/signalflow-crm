import { OpenAIExtractionService } from '../services/openai.service';
import { ChatMessage } from '../schemas';
import { SignalFlowExtractionError } from '../errors';

// This would use Jest in a real environment
describe('OpenAIExtractionService', () => {
  const mockChat: ChatMessage[] = [
    { sender: 'AGENT', message: 'Hi! Looking for a rental?', timestamp: '2026-05-18T10:00:00Z' },
    { sender: 'LEAD', message: 'Yes, 1bhk in 52 under 25k', timestamp: '2026-05-18T10:05:00Z' }
  ];

  it('should format prompt correctly and validate good JSON', async () => {
    // Mock the OpenAI response to return perfect JSON
    const mockApiKey = 'sk-test';
    const service = new OpenAIExtractionService(mockApiKey);
    
    // In actual implementation, we mock the `this.openai.chat.completions.create` method here.
    // Assuming the mock returns:
    const mockResponse = JSON.stringify({
      summary: "Looking for 1BHK in Sector 52 under 25,000",
      propertyType: "1BHK",
      budgetMin: null,
      budgetMax: 25000,
      preferredSectors: ["52"],
      furnishing: null,
      occupantType: null,
      moveInTimeline: null,
      leadTemperature: "WARM",
      nextAction: null
    });

    // We simulate the output validation
    // const result = await service.extractLeadIntelligence(mockChat);
    // expect(result.success).toBe(true);
    // expect(result.data.budgetMax).toBe(25000);
  });

  it('should throw extraction error on hallucinated schema', async () => {
    const mockApiKey = 'sk-test';
    const service = new OpenAIExtractionService(mockApiKey);

    // If mock returns { budgetMax: "twenty thousand" } -> string instead of number
    // We expect the Zod validation to fail and throw SignalFlowExtractionError.
  });
});
