import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const limit = parseInt(url.searchParams.get("limit") || "25", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const search = url.searchParams.get("search") || "";
  const startedAfter = url.searchParams.get("started_after") || "";
  const startedBefore = url.searchParams.get("started_before") || "";
  const lane = url.searchParams.get("lane") || "";
  const tab = url.searchParams.get("tab") || "events";
  const eventType = url.searchParams.get("event_type") || "";

  return {
    limit,
    offset,
    filters: { search, startedAfter, startedBefore, lane, tab, eventType },
  };
};
