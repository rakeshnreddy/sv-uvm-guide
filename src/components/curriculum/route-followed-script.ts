/**
 * The curriculum index's second "before first paint" mark: the landing page's
 * returningLearnerScript marks <html> when the browser holds a lesson visit;
 * this one marks it with the id of the route the browser follows
 * (data-route-followed="junior"), so "Pick up where you left off" (which a
 * route alone also shows) and the followed route's card, with its "Steps on
 * this route" toggle, paint at their final size before React hydrates. It only
 * reads storage and fails silently where storage is blocked.
 */
import { ROUTE_IDS, ROUTE_STORAGE_KEY } from '@/lib/learning-route-state';

/** Set on <html> by the inline script when the browser follows a route; its value is the route id. */
export const ROUTE_FOLLOWED_ATTRIBUTE = 'data-route-followed';

export function routeFollowedScript(): string {
  const key = JSON.stringify(ROUTE_STORAGE_KEY);
  const ids = JSON.stringify(ROUTE_IDS);
  return `(function(){try{var v=window.localStorage.getItem(${key});if(v&&${ids}.indexOf(v)>=0)document.documentElement.setAttribute(${JSON.stringify(ROUTE_FOLLOWED_ATTRIBUTE)},v)}catch(e){}})();`;
}
