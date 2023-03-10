import http from "k6/http";
import { check } from "k6";

// Use environment variables
let maxVUs = parseInt(__ENV.MAX_VUS) || 50;
let baseUrl = __ENV.BASE_URL || "https://azweb-cdp-content-v3-we-dev.azurewebsites.net";
let endpoint = __ENV.ENDPOINT || "/content/type";
let httpMethod = __ENV.HTTP_METHOD || "GET";
let tenantId = __ENV.TENANT_ID || "298f68ee-fc48-49da-bae7-74d666e981e4"; // TODO: Which project should be our default tenant?

let startRate = parseInt(__ENV.START_RATE) || 1;
let rpsTarget = parseInt(__ENV.RPS_TARGET) || 1000;
let rpsRampUpRate = parseInt(__ENV.RPS_RAMP_UP_RATE) || 1;
let testDuration = (rpsTarget / rpsRampUpRate).toString() + "s";

export const options = {
  discardResponseBodies: true,

  scenarios: {
    rampingArrivalRate: {
      executor: 'ramping-arrival-rate',

      // It should start with `startRate` iterations per `timeUnit` (e.g. 1 * `startRate` iterations per minute).
      startRate: startRate,

      // It should increase the rate by `rate` iterations per `timeUnit` (e.g. `startRate` + (1 * `rate`) iterations per minute).
      timeUnit: "1s",

      // It should preallocate 2 VUs before starting the test.
      preAllocatedVUs: 2,

      // It is allowed to spin up to `maxVUs` in order to sustain the defined arrival rate.
      maxVUs: maxVUs,

      stages: [
        { target: rpsTarget, duration: testDuration }
      ],
    },
  },
  thresholds: {
    // http errors are not allowed
    http_req_failed: [
      {
        threshold: "rate==0",
        abortOnFail: true
      }],
    http_req_duration: [
      // 95% of requests must complete below 2s
      {
        threshold: "p(95)<2000",
        abortOnFail: true,
        delayAbortEval: "10s"
      },
      // 100% of requests must complete below 5s
      {
        threshold: "p(100)<5000",
        abortOnFail: true
      }
    ]
  }
};

export default function () {
  // We set up the request
  let url = baseUrl + endpoint;
  let params = {
    headers: {
      'TenantId': tenantId
    }
  }

  // We determine the request type, and we make the request
  let res = null;
  switch (httpMethod) {
    case "GET":
      res = http.get(url, params);
      break;
    default:
      throw new Error("Unsupported HTTP method: " + httpMethod);
  }

  // We check that the response is valid
  check(res, {
    "status is 200": (r) => r.status === 200
  });
}
