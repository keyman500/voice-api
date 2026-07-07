import { Files, type Body, type StoredFile, type UploadResult } from "files-sdk"
import { memory } from "files-sdk/memory"
import { vercelBlob } from "files-sdk/vercel-blob"

export type RecordingUploadInput = {
  callId: string
  recordingSid?: string
  body: Body
  contentType?: string
}

export type RecordingUploadResult = {
  key: string
  provider: string
  size: number
  contentType: string
  etag?: string
}

export type FileStorage = {
  provider: string
  uploadRecording(input: RecordingUploadInput): Promise<RecordingUploadResult>
  downloadRecording(key: string): Promise<StoredFile>
  headRecording(key: string): Promise<StoredFile>
  deleteRecording(key: string): Promise<void>
}

function recordingKey(input: RecordingUploadInput) {
  const safeCallId = input.callId.replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeRecordingSid = input.recordingSid?.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `recordings/${safeCallId}/${safeRecordingSid ?? "recording"}.mp3`
}

function resultFor(provider: string, uploaded: UploadResult): RecordingUploadResult {
  return {
    key: uploaded.key,
    provider,
    size: uploaded.size,
    contentType: uploaded.contentType,
    etag: uploaded.etag,
  }
}

export function createFileStorage(files?: Files, provider = "memory"): FileStorage {
  const client =
    files ??
    new Files({
      adapter:
        process.env.FILE_STORAGE_PROVIDER === "memory"
          ? memory()
          : vercelBlob({ access: "private" }),
    })
  const selectedProvider =
    files ? provider : process.env.FILE_STORAGE_PROVIDER || "vercel-blob"

  return {
    provider: selectedProvider,

    async uploadRecording(input) {
      const uploaded = await client.upload(recordingKey(input), input.body, {
        contentType: input.contentType ?? "audio/mpeg",
      })
      return resultFor(selectedProvider, uploaded)
    },

    downloadRecording(key) {
      return client.download(key)
    },

    headRecording(key) {
      return client.head(key)
    },

    deleteRecording(key) {
      return client.delete(key)
    },
  }
}

let fileStorage: FileStorage | undefined

export function getFileStorage() {
  fileStorage ??= createFileStorage()
  return fileStorage
}

export function setFileStorageForTests(storage: FileStorage | undefined) {
  fileStorage = storage
}
