"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import {
  RiArrowRightUpLine,
  RiFilter3Line,
  RiRefreshLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/eden"
import {
  dashboardQueryKeys,
  formatDateTime,
  formatDuration,
  getApiErrorMessage,
} from "@/lib/dashboard"
import {
  DashboardPageIntro,
  DashboardPanel,
  InlineError,
  StatusBadge,
} from "@/components/dashboard/control-room-ui"
import type { AgentListResponse, CallListResponse } from "@/lib/dashboard"
import type { JsonCall } from "@/lib/services/voice-types"

async function fetchLogs(agentId: string, callStatus: string, limit: number) {
  const { data, error } = await api.v1.calls.get({
    query: {
      limit,
      agentId: agentId || undefined,
      callStatus: callStatus || undefined,
    },
  })

  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load call logs"))
  }

  return data as CallListResponse
}

async function fetchAgentOptions() {
  const { data, error } = await api.v1.agents.get({ query: { limit: 100 } })
  if (error) {
    throw new Error(getApiErrorMessage(error, "Failed to load agents"))
  }
  return data as AgentListResponse
}

export function CallLogsTable() {
  const [agentFilter, setAgentFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [limit, setLimit] = useState(25)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "startedAt", desc: true },
  ])

  const logsQuery = useQuery({
    queryKey: dashboardQueryKeys.calls({ agentFilter, statusFilter, limit }),
    queryFn: () => fetchLogs(agentFilter, statusFilter, limit),
  })

  const agentsQuery = useQuery({
    queryKey: dashboardQueryKeys.agents(),
    queryFn: fetchAgentOptions,
  })

  const columns = useMemo<ColumnDef<JsonCall>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "toNumber",
        header: "Destination",
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {row.original.toNumber ?? "—"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.id}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "fromNumber",
        header: "Source",
        cell: ({ row }) => row.original.fromNumber ?? "—",
      },
      {
        accessorKey: "agentId",
        header: "Agent",
        cell: ({ row }) => row.original.agentId ?? "Unassigned",
      },
      {
        accessorKey: "providerSource",
        header: "Provider",
        cell: ({ row }) => row.original.providerSource ?? "—",
      },
      {
        accessorKey: "startedAt",
        header: "Started",
        cell: ({ row }) => formatDateTime(row.original.startedAt),
      },
      {
        accessorKey: "duration",
        header: "Duration",
        cell: ({ row }) => formatDuration(row.original.duration),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/dashboard/logs/${row.original.id}`} />}
          >
            View
            <RiArrowRightUpLine />
          </Button>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: logsQuery.data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-8">
      <DashboardPageIntro
        eyebrow="Logs"
        title="Scan every call record in a table built for operators."
        description="The logs surface is backed by the calls API, rendered with shadcn table primitives, and managed with TanStack Table so the history view can grow without becoming brittle."
        action={
          <Button variant="outline" onClick={() => void logsQuery.refetch()}>
            <RiRefreshLine />
            Refresh logs
          </Button>
        }
      />

      <DashboardPanel
        title="Filters"
        description="Server-side filters are applied through the v1 calls list query, then TanStack Table handles the rendered dataset."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
          <div className="space-y-2">
            <Label htmlFor="agent-filter">Agent</Label>
            <Select
              value={agentFilter || "all"}
              onValueChange={(value) =>
                setAgentFilter(!value || value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full" id="agent-filter">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {(agentsQuery.data?.items ?? []).map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name ?? agent.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-filter">Call status</Label>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) =>
                setStatusFilter(!value || value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full" id="status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[
                  "queued",
                  "ringing",
                  "in-progress",
                  "ended",
                  "error",
                  "unknown",
                ].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logs-limit">Row limit</Label>
            <Input
              id="logs-limit"
              type="number"
              min="5"
              max="100"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 25)}
            />
          </div>
        </div>
      </DashboardPanel>

      <DashboardPanel
        title="Call logs"
        description="Click any row to inspect the full call record, including event timeline and payload snapshots."
      >
        <InlineError message={logsQuery.error?.message ?? null} />

        <div className="mb-4 flex items-center gap-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
          <RiFilter3Line className="size-4" />
          {logsQuery.data?.items.length ?? 0} rows loaded
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {logsQuery.isPending ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={8}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  No call logs match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DashboardPanel>
    </div>
  )
}
