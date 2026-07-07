import { describe, expect, it } from "@jest/globals"
import { Files } from "files-sdk"
import { memory } from "files-sdk/memory"
import { createFileStorage } from "@/lib/services/file-storage"

describe("file storage abstraction", () => {
  it("uploads, heads, downloads, and deletes recordings through files-sdk", async () => {
    const storage = createFileStorage(
      new Files({ adapter: memory() }),
      "memory"
    )

    const uploaded = await storage.uploadRecording({
      callId: "call-1",
      recordingSid: "rec-1",
      body: "audio bytes",
      contentType: "audio/mpeg",
    })

    expect(uploaded).toMatchObject({
      key: "recordings/call-1/rec-1.mp3",
      provider: "memory",
      contentType: "audio/mpeg",
      size: 11,
    })

    const head = await storage.headRecording(uploaded.key)
    expect(head.size).toBe(11)

    const downloaded = await storage.downloadRecording(uploaded.key)
    await expect(downloaded.text()).resolves.toBe("audio bytes")

    await storage.deleteRecording(uploaded.key)
    await expect(storage.headRecording(uploaded.key)).rejects.toThrow()
  })
})
