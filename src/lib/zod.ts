import { z } from "zod";

/**
 * Import `z` from here, not from "zod". Schemas that reach the browser run under
 * a CSP without eval (src/lib/csp.ts); Zod probes for eval when a schema is
 * created, so this must be configured before any schema module evaluates.
 */
z.config({ jitless: true });
export { z };
