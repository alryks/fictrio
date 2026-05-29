import type {
  FeedFilter,
  FeedItem,
  FeedListActivity,
  FeedPage,
  FeedPostActivity,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type { FeedFilter, FeedItem, FeedListActivity, FeedPostActivity, FeedPage };

function buildFeedQuery(filter: FeedFilter, offset: number, limit: number) {
  const params = new URLSearchParams();
  params.set("filter", filter);
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  return params.toString();
}

/** Activity of the users the signed-in viewer follows. */
export function getFollowingFeed(filter: FeedFilter, offset = 0, limit = 10) {
  return apiRequest<FeedPage>(`/feed?${buildFeedQuery(filter, offset, limit)}`);
}

/** Activity of a single user, shown on their profile. */
export function getUserFeed(
  username: string,
  filter: FeedFilter,
  offset = 0,
  limit = 10,
) {
  return apiRequest<FeedPage>(
    `/users/${encodeURIComponent(username)}/feed?${buildFeedQuery(filter, offset, limit)}`,
  );
}
