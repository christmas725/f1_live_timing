import type { Config, Context } from "@netlify/functions";
import { GET as vercelOpenF1 } from "../../api/openf1.js";

export default async (request: Request, _context: Context) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  return vercelOpenF1(request);
};

export const config: Config = {
  path: "/api/openf1",
};
