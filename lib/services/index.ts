/**
 * Voice product services — replace in-memory implementations with LiveKit / DB
 * without changing `/api/v1` route contracts.
 */
export { voiceInMemory } from "./voice-in-memory"
export type {
  JsonAgent,
  JsonCall,
  JsonPhoneNumber,
  PaginatedList,
} from "./voice-types"
