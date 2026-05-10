import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const search = url.searchParams.get("search") || "";
  const bucket = url.searchParams.get("bucket") || "";
  const unresolvedOnly = url.searchParams.get("unresolved_only") === "true";
  const startedAfter = url.searchParams.get("started_after") || "";
  const startedBefore = url.searchParams.get("started_before") || "";
  const lane = url.searchParams.get("lane") || "";

  return {
    filters: { search, bucket, unresolvedOnly, startedAfter, startedBefore, lane },
  };
};
