/** Keep SDK upgrades from widening automatic collection or bypassing transaction redaction. */
export const telemetryPrivacy = {
  traceLifecycle: 'static' as const,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [] as [],
    urlQueryParams: false,
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
    stackFrameVariables: false,
  },
}
