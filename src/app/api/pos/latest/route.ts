import { latestRelease } from "@/lib/posReleases";

/** The newest till release for the portal (Terminals: which tills are out of date). The browser can't read R2 directly. */
export async function GET() {
  return Response.json(await latestRelease());
}
