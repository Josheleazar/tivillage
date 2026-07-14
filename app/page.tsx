import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

// Next 14 requires a Suspense boundary around any client component that
// uses useSearchParams(), otherwise the build emits a CSR-bailout
// warning or fails router middleware checks. Wrapping the home page
// in <Suspense fallback={null}> lets DashboardClient's own loading
// state handle the first paint rather than streaming a fallback UI
// from this boundary.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
