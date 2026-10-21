import { z } from 'zod'

// Schema construction probes Function() even when CSP rejects it. Browser validation must
// use the interpreter; server validation keeps its normal JIT path.
if (typeof window !== 'undefined') z.config({ jitless: true })

export { z }
