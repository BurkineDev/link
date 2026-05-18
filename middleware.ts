import { proxy } from "./src/proxy";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf)$).*)",
  ],
};
