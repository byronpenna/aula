// Script k6 de referencia (sección 12). No ejecutado todavía en esta entrega.
// Uso previsto: k6 run -e API_BASE=https://api-aula.staging.example -e TOKEN=... assignment-save.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    validacion_pico: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 150 },
        { duration: "3m", target: 150 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.005"],
  },
};

const API_BASE = __ENV.API_BASE || "http://localhost:8000/api/v1";
const TOKEN = __ENV.TOKEN || "";
const ASSIGNMENT_ID = __ENV.ASSIGNMENT_ID || "";

export default function () {
  const res = http.put(
    `${API_BASE}/assignments/${ASSIGNMENT_ID}/my-submission`,
    JSON.stringify({ body: `respuesta ${Date.now()}`, version: 0 }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
    },
  );
  check(res, {
    "status es 200 o 409 (conflicto esperado bajo concurrencia)": (r) =>
      r.status === 200 || r.status === 409,
  });
  sleep(1);
}
