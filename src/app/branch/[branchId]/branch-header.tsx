import { AreaTitle } from "@/components/area-shell";
import { Badge } from "@/components/ui";
import { BranchTabs } from "./branch-tabs";

/** Page title for a branch's pages: the branch name, with its tabs underneath. */
export function BranchHeader({
  branch,
  actions,
}: {
  branch: { id: number; name: string; status: string };
  actions?: React.ReactNode;
}) {
  return (
    <>
      <AreaTitle
        title={branch.name}
        subtitle={branch.status !== "approved" ? <Badge status={branch.status} /> : undefined}
        actions={actions}
      />
      <BranchTabs />
      {branch.status !== "approved" && (
        <p className="-mt-2 mb-6 text-sm text-muted">Customers can&apos;t order from this branch until the admin approves it.</p>
      )}
    </>
  );
}
