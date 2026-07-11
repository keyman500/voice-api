import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Better Auth core tables
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
})

// ---------------------------------------------------------------------------
// API Key plugin table (foundation — no full key-management UX yet)
// ---------------------------------------------------------------------------

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Kept nullable for rows created before Better Auth moved API keys to referenceId.
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").$defaultFn(() => true),
    rateLimitEnabled: boolean("rate_limit_enabled").$defaultFn(() => false),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").$defaultFn(() => 0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_config_id_idx").on(table.configId),
    index("apikey_reference_id_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ]
)

// ---------------------------------------------------------------------------
// Voice API product tables
// ---------------------------------------------------------------------------

export const livekitConfig = pgTable("livekit_config", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  encryptedUrl: text("encrypted_url").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  encryptedApiSecret: text("encrypted_api_secret").notNull(),
  defaultSipOutboundTrunkId: text("default_sip_outbound_trunk_id"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const twilioConfig = pgTable("twilio_config", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  encryptedAccountSid: text("encrypted_account_sid").notNull(),
  encryptedAuthToken: text("encrypted_auth_token").notNull(),
  defaultFromNumber: text("default_from_number"),
  defaultWebhookBaseUrl: text("default_webhook_base_url"),
  deleteTwilioRecordingAfterBlobUpload: boolean(
    "delete_twilio_recording_after_blob_upload"
  )
    .default(false)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const voiceAgent = pgTable(
  "voice_agent",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    voiceEngine: text("voice_engine").default("conversation-relay").notNull(),
    voice: jsonb("voice").$type<Record<string, unknown> | null>(),
    model: jsonb("model").$type<Record<string, unknown> | null>(),
    firstMessage: text("first_message"),
    maxDurationSeconds: integer("max_duration_seconds"),
    backgroundSound: text("background_sound"),
    voicemailMessage: text("voicemail_message"),
    successEvaluationPrompt: text("success_evaluation_prompt"),
    webhookUrl: text("webhook_url"),
    webhookTimeoutSeconds: integer("webhook_timeout_seconds"),
    encryptedWebhookSecret: text("encrypted_webhook_secret"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    providerOptions: jsonb("provider_options").$type<Record<
      string,
      unknown
    > | null>(),
    raw: jsonb("raw").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("voice_agent_user_id_idx").on(table.userId)]
)

export const voiceCall = pgTable(
  "voice_call",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    agentId: text("agent_id").references(() => voiceAgent.id, {
      onDelete: "set null",
    }),
    direction: text("direction")
      .notNull()
      .$defaultFn(() => "outbound"),
    status: text("status")
      .notNull()
      .$defaultFn(() => "queued"),
    toNumber: text("to_number"),
    fromNumber: text("from_number"),
    phoneNumberId: text("phone_number_id"),
    livekitRoomName: text("livekit_room_name"),
    livekitSipParticipantId: text("livekit_sip_participant_id"),
    livekitSipCallId: text("livekit_sip_call_id"),
    livekitSipTrunkId: text("livekit_sip_trunk_id"),
    twilioCallSid: text("twilio_call_sid"),
    twilioAccountSid: text("twilio_account_sid"),
    relaySessionId: text("relay_session_id"),
    voiceEngine: text("voice_engine").default("conversation-relay").notNull(),
    realtimeModel: text("realtime_model"),
    transcriptionStatus: text("transcription_status"),
    transcriptionModel: text("transcription_model"),
    transcriptionError: text("transcription_error"),
    terminalReason: text("terminal_reason"),
    recordingSid: text("recording_sid"),
    recordingStatus: text("recording_status"),
    recordingStorageKey: text("recording_storage_key"),
    recordingStorageProvider: text("recording_storage_provider"),
    recordingContentType: text("recording_content_type"),
    recordingSizeBytes: integer("recording_size_bytes"),
    postCallStatus: text("post_call_status"),
    postCallWorkflowRunId: text("post_call_workflow_run_id"),
    recordingIngestedAt: timestamp("recording_ingested_at"),
    recordingDeletedFromTwilioAt: timestamp("recording_deleted_from_twilio_at"),
    recordingIngestionError: text("recording_ingestion_error"),
    analysisStatus: text("analysis_status"),
    analysisError: text("analysis_error"),
    callSuccessful: boolean("call_successful"),
    successEvaluationStatus: text("success_evaluation_status"),
    successEvaluationReason: text("success_evaluation_reason"),
    successEvaluationError: text("success_evaluation_error"),
    webhookDeliveryStatus: text("webhook_delivery_status"),
    webhookDeliveryAttempts: integer("webhook_delivery_attempts"),
    webhookDeliveryError: text("webhook_delivery_error"),
    webhookLastAttemptAt: timestamp("webhook_last_attempt_at"),
    webhookDeliveredAt: timestamp("webhook_delivered_at"),
    providerSource: text("provider_source")
      .notNull()
      .$defaultFn(() => "user"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    duration: integer("duration"),
    transcript: text("transcript"),
    recordingUrl: text("recording_url"),
    analysis: jsonb("analysis").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    providerOptions: jsonb("provider_options").$type<Record<
      string,
      unknown
    > | null>(),
    raw: jsonb("raw").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("voice_call_user_id_idx").on(table.userId),
    index("voice_call_agent_id_idx").on(table.agentId),
    index("voice_call_status_idx").on(table.status),
  ]
)

export const voicePhoneNumber = pgTable(
  "voice_phone_number",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    number: text("number"),
    name: text("name"),
    inboundAgentId: text("inbound_agent_id").references(() => voiceAgent.id, {
      onDelete: "set null",
    }),
    outboundAgentId: text("outbound_agent_id").references(() => voiceAgent.id, {
      onDelete: "set null",
    }),
    webhookUrl: text("webhook_url"),
    areaCode: text("area_code"),
    livekitSipInboundTrunkId: text("livekit_sip_inbound_trunk_id"),
    livekitSipOutboundTrunkId: text("livekit_sip_outbound_trunk_id"),
    twilioPhoneNumberSid: text("twilio_phone_number_sid"),
    twilioAccountSid: text("twilio_account_sid"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    providerOptions: jsonb("provider_options").$type<Record<
      string,
      unknown
    > | null>(),
    raw: jsonb("raw").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("voice_phone_number_user_id_idx").on(table.userId)]
)

export const voiceTranscriptItem = pgTable(
  "voice_transcript_item",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    callId: text("call_id")
      .notNull()
      .references(() => voiceCall.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    text: text("text").notNull(),
    status: text("status")
      .notNull()
      .$defaultFn(() => "final"),
    sequence: integer("sequence").notNull(),
    raw: jsonb("raw").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("voice_transcript_item_call_id_idx").on(table.callId),
    index("voice_transcript_item_user_id_idx").on(table.userId),
  ]
)

export const voiceCallEvent = pgTable(
  "voice_call_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    callId: text("call_id")
      .notNull()
      .references(() => voiceCall.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("voice_call_event_call_id_idx").on(table.callId),
    index("voice_call_event_user_id_idx").on(table.userId),
  ]
)

export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    callId: text("call_id"),
    agentId: text("agent_id"),
    kind: text("kind").notNull(),
    eventName: text("event_name").notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    durationSeconds: integer("duration_seconds"),
    credits: doublePrecision("credits").notNull(),
    providerCostUsd: doublePrecision("provider_cost_usd"),
    billableUsd: doublePrecision("billable_usd"),
    markup: doublePrecision("markup"),
    polarEventId: text("polar_event_id"),
    polarIngestStatus: text("polar_ingest_status")
      .$defaultFn(() => "pending")
      .notNull(),
    polarIngestError: text("polar_ingest_error"),
    raw: jsonb("raw").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("usage_ledger_user_id_idx").on(table.userId),
    index("usage_ledger_call_id_idx").on(table.callId),
    index("usage_ledger_kind_idx").on(table.kind),
    index("usage_ledger_polar_ingest_status_idx").on(table.polarIngestStatus),
  ]
)
