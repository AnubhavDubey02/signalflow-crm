import { IntelligenceRepository } from '../repositories/intelligence.repository';
import { TasksRepository } from '../repositories/tasks.repository';

// Mock Supabase Client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis()
} as any;

describe('IntelligenceRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should find existing lead and upsert intelligence', async () => {
    const repo = new IntelligenceRepository(mockSupabase);
    
    // Setup mocks
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'lead-123' }, error: null }) // First call (select lead)
      .mockResolvedValueOnce({ data: { id: 'intel-123' }, error: null }); // Second call (upsert)

    const dummyIntelligence: any = {
      transactionType: 'RENT',
      propertyTypes: ['1BHK'],
      budgetMax: 20000,
      leadTemperature: 'HOT'
    };

    const result = await repo.syncIntelligence('agent-1', '+919876543210', dummyIntelligence);
    
    expect(result.leadId).toBe('lead-123');
    expect(result.intelligenceId).toBe('intel-123');
  });

  it('should create new lead if not found, then upsert', async () => {
    const repo = new IntelligenceRepository(mockSupabase);
    
    // Setup mocks
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, error: null }) // First call (select lead not found)
      .mockResolvedValueOnce({ data: { id: 'new-lead' }, error: null }) // Second call (insert lead)
      .mockResolvedValueOnce({ data: { id: 'intel-123' }, error: null }); // Third call (upsert intel)

    const dummyIntelligence: any = { transactionType: 'RENT', propertyTypes: ['1BHK'] };

    const result = await repo.syncIntelligence('agent-1', '+919876543210', dummyIntelligence);
    expect(result.leadId).toBe('new-lead');
  });
});
