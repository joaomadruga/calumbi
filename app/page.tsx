import Dashboard from "@/components/dashboard";

const sections = new Set([
  "overview",
  "herd",
  "projection",
  "tests",
  "investors",
  "finance",
  "settings",
]);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { section } = await searchParams;
  const initialTab =
    typeof section === "string" && sections.has(section) ? section : "overview";
  return <Dashboard initialTab={initialTab} />;
}
