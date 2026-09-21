import { redirect } from "next/navigation";

// The Schedule page only ever showed a notice (the doctor self-service editor it once hosted was removed with the
// doctor portal). Working hours and shifts live in Settings, so old bookmarks land there.
export default function PortalSchedulePage() {
  redirect("/portal/settings");
}
