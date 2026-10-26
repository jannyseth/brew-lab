import { AreaTitle } from "@/components/area-shell";
import { Badge } from "@/components/ui";

/** Page title for a branch's pages; navigation lives in the sidebar. */
export function BranchHeader({
  branch,
  active,
  actions,
}: {
  branch: { id: number; name: string; status: string };
  active: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <AreaTitle
        title={active}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {branch.name} <Badge status={branch.status} />
          </span>
        }
        actions={actions}
      />
      {branch.status !== "approved" && (
        <p className="-mt-4 mb-6 text-sm text-muted">Customers can&apos;t order from this branch until the admin approves it.</p>
      )}
    </>
  );
}
