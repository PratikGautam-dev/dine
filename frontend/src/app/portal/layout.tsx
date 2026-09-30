"use client";

import { BranchProvider } from "@/lib/branchContext";

/** Wraps every /portal/* page -- BranchProvider has to be an ANCESTOR of each page's own
 * component (where useBranchFilter() is called to feed the page's data hooks), not just a
 * descendant rendered inside PortalShell's JSX. Mounting it only inside PortalShell (as it
 * first was) meant every page read the context's default value, since the page component
 * itself sits above PortalShell in the tree, not below it -- the switcher UI worked (it's
 * genuinely inside PortalShell), but nothing it selected ever reached the pages' own fetches. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <BranchProvider>{children}</BranchProvider>;
}
