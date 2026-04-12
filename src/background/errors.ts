export class RateLimitError extends Error {
  constructor() {
    super('Rate limited by server');
    this.name = 'RateLimitError';
  }
}
