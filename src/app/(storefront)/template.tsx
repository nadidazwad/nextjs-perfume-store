import { ViewTransition } from "react";

/*
 * Directional page transitions, like a native navigation stack: links tagged
 * `nav-forward` (product cards, shortcuts) push the next page in from the
 * right, the app bar's back button (`nav-back`) slides it back. Untagged
 * navigations (tabs, browser back, filters) swap instantly. A template, not
 * the layout, because it remounts per navigation. Animations are phone-only;
 * see "PAGE TRANSITIONS" in src/app/app-shell.css.
 */
const types = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

export default function StorefrontTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={types} exit={types} default="none">
      {/* One opaque layer per page, so the incoming page covers the outgoing one. */}
      <div className="route-page">{children}</div>
    </ViewTransition>
  );
}
