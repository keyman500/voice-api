import { ApiKeysSettings } from "@/components/dashboard/api-keys-settings"
import { LiveKitSettings } from "@/components/dashboard/livekit-settings"

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-8">
      <LiveKitSettings />
      <ApiKeysSettings />
    </div>
  )
}
