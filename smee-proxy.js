// Simple smee.io proxy that works on Node 18
// Connects to smee.io EventSource and forwards webhooks to localhost

const https = require("https");
const http = require("http");
const { URL } = require("url");

const SMEE_URL = "https://smee.io/MmpzUwrarI3i5AfC";
const TARGET = "http://localhost:3000/api/webhooks";

function connectSSE() {
  const url = new URL(SMEE_URL);

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    headers: { Accept: "text/event-stream" },
  };

  console.log(`[smee-proxy] Connecting to ${SMEE_URL}...`);

  https.get(options, (res) => {
    if (res.statusCode !== 200) {
      console.error(`[smee-proxy] Got status ${res.statusCode}, retrying in 3s...`);
      setTimeout(connectSSE, 3000);
      return;
    }

    console.log("[smee-proxy] Connected! Waiting for webhooks...");

    let buffer = "";

    res.on("data", (chunk) => {
      buffer += chunk.toString();
      const events = buffer.split("\n\n");
      buffer = events.pop(); // keep incomplete event in buffer

      for (const event of events) {
        if (!event.trim()) continue;

        const lines = event.split("\n");
        let data = "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            data += line.slice(6);
          }
        }

        if (!data) continue;

        try {
          const payload = JSON.parse(data);
          if (payload.body) {
            forwardWebhook(payload);
          }
        } catch {
          // skip non-JSON events (like ping)
        }
      }
    });

    res.on("end", () => {
      console.log("[smee-proxy] Connection closed, reconnecting in 3s...");
      setTimeout(connectSSE, 3000);
    });

    res.on("error", (err) => {
      console.error("[smee-proxy] Error:", err.message);
      setTimeout(connectSSE, 3000);
    });
  }).on("error", (err) => {
    console.error("[smee-proxy] Connection error:", err.message);
    setTimeout(connectSSE, 3000);
  });
}

function forwardWebhook(payload) {
  const targetUrl = new URL(TARGET);
  const body = JSON.stringify(payload.body);

  // Forward original GitHub headers
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  };

  // Copy relevant headers from smee payload
  if (payload["x-github-event"]) headers["x-github-event"] = payload["x-github-event"];
  if (payload["x-hub-signature-256"]) headers["x-hub-signature-256"] = payload["x-hub-signature-256"];
  if (payload["x-github-delivery"]) headers["x-github-delivery"] = payload["x-github-delivery"];
  if (payload["x-hub-signature"]) headers["x-hub-signature"] = payload["x-hub-signature"];

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname,
    method: "POST",
    headers,
  };

  const req = http.request(options, (res) => {
    let responseBody = "";
    res.on("data", (chunk) => { responseBody += chunk; });
    res.on("end", () => {
      console.log(`[smee-proxy] Forwarded ${payload["x-github-event"] || "unknown"} -> ${res.statusCode} ${responseBody.slice(0, 200)}`);
    });
  });

  req.on("error", (err) => {
    console.error(`[smee-proxy] Forward failed:`, err.message);
  });

  req.write(body);
  req.end();
}

connectSSE();
