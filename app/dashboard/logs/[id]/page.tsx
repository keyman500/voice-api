import { CallLogDetail } from "@/components/dashboard/call-log-detail"

export default async function DashboardLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CallLogDetail id={id} />
}
