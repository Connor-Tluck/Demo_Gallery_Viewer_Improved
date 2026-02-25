import * as LDClient from "launchdarkly-js-client-sdk";
import Observability from "@launchdarkly/observability";
import SessionReplay from "@launchdarkly/session-replay";

window.LDClient = LDClient;
window.LDObservability = Observability;
window.LDSessionReplay = SessionReplay;
