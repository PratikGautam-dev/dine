"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Clock in/out was folded into My Attendance (one page instead of two for the same
// check_in_out permission) -- this route stays as a redirect so old links/bookmarks still land
// somewhere real, rather than a dead link.
export default function ClockInOutRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/portal/attendance");
  }, [router]);
  return null;
}
