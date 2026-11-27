UPDATE "voice_agent"
SET
  "model" = jsonb_set(
    jsonb_set("model", '{model}', '"spacexai/grok-voice-3.0"'::jsonb),
    '{provider}',
    '"spacexai"'::jsonb
  ),
  "voice" = CASE
    WHEN "voice"->>'provider' = 'xai' THEN jsonb_set(
      "voice",
      '{provider}',
      '"spacexai"'::jsonb
    )
    ELSE "voice"
  END,
  "updated_at" = now()
WHERE
  "voice_engine" = 'realtime'
  AND "model"->>'model' = 'xai/grok-voice-think-fast-1.0';
