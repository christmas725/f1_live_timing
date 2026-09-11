import type { Config, Context } from "@netlify/functions";
import { GET as supportSeries } from "../../api/support-series.js";

export default async (request: Request, _context: Context) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
  }
  return supportSeries(request);
};

export const config: Config = { path: "/api/support-series" };
