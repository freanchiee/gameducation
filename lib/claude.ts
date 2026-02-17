import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set')
}

/**
 * Shared Anthropic Claude client.
 * Only import this in server-side code (API routes, Server Actions).
 * Never expose the API key to the client.
 */
export const claudeClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
