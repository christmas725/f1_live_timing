import type { Config, Context } from "@netlify/functions";
import { GET as vercelJolpica } from "../../api/jolpica.js";

export default async (request: Request, _context: Context) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  return vercelJolpica(request);
};

export const config: Config = {
  path: "/api/jolpica",
};
