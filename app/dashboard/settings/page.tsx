import { ApiKeysSettings } from "@/components/dashboard/api-keys-settings"
import { LiveKitSettings } from "@/components/dashboard/livekit-settings"
import { TelnyxSettings } from "@/components/dashboard/telnyx-settings"

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-8">
      <LiveKitSettings />
      <TelnyxSettings />
      <ApiKeysSettings />
    </div>
  )
}
