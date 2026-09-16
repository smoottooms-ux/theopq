import type { Settings } from '../../types';

/**
 * Kept separate from `llm.ts` so screens can ask "is bespoke writing on?"
 * without pulling the Anthropic SDK into the main bundle.
 */
export function llmAvailable(settings: Settings): boolean {
  return !!settings.anthropicKey?.trim();
}
