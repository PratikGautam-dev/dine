"use client";

import { Check, Copy, Minus, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { isAdministrator } from "@/components/portal/RoleEditor";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { useStaffManagement } from "@/hooks/useStaffManagement";
import { ROLE_PAGES } from "@/lib/rolePages";
import { usePermission } from "@/lib/staffAuth";
import { orderedRoles, roleDescription, roleLabel } from "@/lib/staffRoles";
import { toast } from "@/lib/toast";

/** Roles & Permissions: every role with who holds it, and a grid of which role can open which page. A role opens in its own editor. */
export default function RolesAndPermissionsPage() {
  const { restaurant, ready } = usePortalGuard();
  const router = useRouter();
  const canView = usePermission("roles", "view");
  const canWrite = usePermission("roles", "write");
  const { matrix, error, createRole, saveGrid } = usePortalRoles(canView);
  const { staff } = useStaffManagement(canView);
  const [q, setQ] = useState("");
  const [copying, setCopying] = useState(false);

  const roles = useMemo(() => (matrix ? orderedRoles(matrix) : []), [matrix]);
  const shown = roles.filter((r) => roleLabel(r).toLowerCase().includes(q.trim().toLowerCase()));
  const usersByRole = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of staff ?? []) if (s.is_active) counts.set(s.role, (counts.get(s.role) ?? 0) + 1);
    return counts;
  }, [staff]);

  if (!ready) return null;

  async function copy(role: string) {
    if (!matrix) return;
    setCopying(true);
    try {
      let name = `${roleLabel(role)} copy`;
      for (let n = 2; roles.includes(name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")); n++)
        name = `${roleLabel(role)} copy ${n}`;
      const key = await createRole(name, true);
      if (!key) return;
      const problem = await saveGrid(key, matrix[role]);
      if (problem) return toast.error("Couldn't copy the permissions", problem);
      toast.success("Role duplicated");
      router.push(`/portal/settings/roles/${key}`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <PortalShell restaurant={restaurant} active="roles">
      <PageHeader
        icon={<ShieldCheck size={20} />}
        title="Roles & Permissions"
        description="A role is a set of permissions you give to many people. To change what one person can do, give them a different role on the Users page. Owner / Manager can see and do everything."
        actions={
          canWrite && (
            <Button href="/portal/settings/roles/new">
              <Plus size={16} /> Add role
            </Button>
          )
        }
      />
      {!canView ? (
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Roles &amp; Permissions.</p>
      ) : (
        <>
          {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
          <Card className="mb-space-5 p-space-2">
            <div className="p-space-2">
              <Input placeholder="Search roles" aria-label="Search roles" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {!matrix ? (
              <div className="flex flex-col gap-space-2 p-space-2" role="status" aria-label="Loading roles">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-paper text-left text-[11px] tracking-wide text-ink-400 uppercase">
                    <th className="p-space-3 font-semibold">Name</th>
                    <th className="p-space-3 font-semibold">Works in</th>
                    <th className="p-space-3 text-right font-semibold">Users</th>
                    <th className="w-12 p-space-3" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const system = isAdministrator(r);
                    return (
                      <tr key={r} className={`border-t border-line ${system ? "text-ink-400" : "text-ink-900"}`}>
                        <td className="p-space-3 font-medium">
                          <Link href={`/portal/settings/roles/${r}`} className="hover:underline">
                            {roleLabel(r)}
                          </Link>
                          <div className="text-[12px] font-normal text-ink-400">{roleDescription(r)}</div>
                        </td>
                        <td className="p-space-3">
                          <Badge tone={system ? "brand" : "clay"}>{system ? "Administrator" : "Portal"}</Badge>
                        </td>
                        <td className="p-space-3 text-right">{usersByRole.get(r) ?? 0}</td>
                        <td className="p-space-3 text-right">
                          {canWrite && !system && (
                            <button
                              type="button"
                              title="Duplicate"
                              aria-label={`Duplicate ${roleLabel(r)}`}
                              disabled={copying}
                              onClick={() => copy(r)}
                              className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900"
                            >
                              <Copy size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-space-4 text-center text-ink-400">
                        No roles match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>

          {matrix && (
            <Card className="no-scrollbar overflow-x-auto p-space-4">
              <h2 className="text-[15px] font-bold text-ink-900">Page access overview</h2>
              <p className="mb-space-3 text-[12px] text-ink-400">Which roles can open each page in the portal.</p>
              <table className="w-full min-w-[480px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
                    <th className="py-space-2 font-semibold">Page</th>
                    {roles.map((r) => (
                      <th key={r} className="py-space-2 text-center font-semibold">
                        {roleLabel(r)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROLE_PAGES.map((p) => (
                    <tr key={p.key} className="border-t border-line">
                      <td className="py-space-2 text-ink-900">{p.label}</td>
                      {roles.map((r) => (
                        <td key={r} className="py-space-2 text-center">
                          {isAdministrator(r) || matrix[r]?.[p.key]?.view ? (
                            <Check size={14} className="mx-auto text-success" aria-label="Allowed" />
                          ) : (
                            <Minus size={14} className="mx-auto text-ink-300" aria-label="Not allowed" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </PortalShell>
  );
}
