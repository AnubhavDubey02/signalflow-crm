export class SignalFlowError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SignalFlowValidationError extends SignalFlowError {
  constructor(message: string, details?: any) {
    super(message, 422, details);
  }
}

export class SignalFlowRateLimitError extends SignalFlowError {
  constructor(message: string = 'Rate limit exceeded for OpenAI API.') {
    super(message, 429);
  }
}

export class SignalFlowExtractionError extends SignalFlowError {
  constructor(message: string, details?: any) {
    super(message, 502, details); // 502 Bad Gateway since OpenAI failed us
  }
}

export class SignalFlowAuthError extends SignalFlowError {
  constructor(message: string = 'Unauthorized access.') {
    super(message, 401);
  }
}
