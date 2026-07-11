import { RoomServiceClient, SipClient } from "livekit-server-sdk"
import type { LiveKitCredentials } from "./voice-types"

export type LiveKitSipParticipant = {
  participantIdentity?: string
  participantName?: string
  sipCallId?: string
  attributes?: Record<string, string>
  raw: unknown
}

export type LiveKitAdapter = {
  testCredentials(credentials: LiveKitCredentials): Promise<void>
  createRoom(credentials: LiveKitCredentials, roomName: string): Promise<unknown>
  createSipParticipant(
    credentials: LiveKitCredentials,
    input: {
      sipTrunkId: string
      phoneNumber: string
      roomName: string
      participantIdentity: string
      participantName?: string
    }
  ): Promise<LiveKitSipParticipant>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value ? (value as Record<string, unknown>) : {}
}

export const liveKitAdapter: LiveKitAdapter = {
  async testCredentials(credentials) {
    const rooms = new RoomServiceClient(
      credentials.url,
      credentials.apiKey,
      credentials.apiSecret
    )
    await rooms.listRooms()
  },

  async createRoom(credentials, roomName) {
    const rooms = new RoomServiceClient(
      credentials.url,
      credentials.apiKey,
      credentials.apiSecret
    )
    try {
      return await rooms.createRoom({ name: roomName })
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ""
      if (message.includes("already") || message.includes("exist")) {
        return { existing: true, roomName }
      }
      throw error
    }
  },

  async createSipParticipant(credentials, input) {
    const sip = new SipClient(
      credentials.url,
      credentials.apiKey,
      credentials.apiSecret
    )
    const participant = await sip.createSipParticipant(
      input.sipTrunkId,
      input.phoneNumber,
      input.roomName,
      {
        participantIdentity: input.participantIdentity,
        participantName: input.participantName,
        waitUntilAnswered: false,
      }
    )
    const raw = asRecord(participant)
    const attributes =
      typeof raw.attributes === "object" && raw.attributes
        ? (raw.attributes as Record<string, string>)
        : undefined
    return {
      participantIdentity:
        typeof raw.participantIdentity === "string"
          ? raw.participantIdentity
          : typeof raw.identity === "string"
            ? raw.identity
            : undefined,
      participantName:
        typeof raw.participantName === "string"
          ? raw.participantName
          : typeof raw.name === "string"
            ? raw.name
            : undefined,
      sipCallId:
        attributes?.["sip.callID"] ??
        attributes?.["sip.callIDFull"] ??
        (typeof raw.sipCallId === "string" ? raw.sipCallId : undefined),
      attributes,
      raw: participant,
    }
  },
}