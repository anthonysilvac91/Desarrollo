import { NextRequest, NextResponse } from "next/server";
import {
  buildForwardHeaders,
  copyResponseHeaders,
  getClientIp,
  signAuthProxyRequest,
} from "@/lib/auth-proxy";

// Proxy dedicado solo a /auth/* (ver src/lib/api.ts). A diferencia del
// rewrite generico /api-proxy (next.config.ts), este Route Handler necesita
// logica propia: capturar la IP real del visitante en Vercel y firmarla con
// HMAC antes de reenviarla a Railway, que en produccion queda detras de
// Vercel (Usuario -> Vercel/Next.js -> Railway).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

// Statuses que, por spec de Fetch, no pueden llevar body en la Response
// reconstruida (aunque el backend haya enviado 0 bytes igualmente).
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

async function handleProxyRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");

  if (!backendUrl) {
    return NextResponse.json(
      { message: "Backend URL is not configured" },
      { status: 500 },
    );
  }

  const { path } = await context.params;
  const backendPathWithQuery = `/${path.join("/")}${request.nextUrl.search}`;

  const clientIp = getClientIp(request.headers);
  const secret = process.env.AUTH_PROXY_HMAC_SECRET;
  const timestamp = String(Date.now());
  const signature =
    clientIp && secret
      ? signAuthProxyRequest(
          request.method,
          backendPathWithQuery,
          timestamp,
          clientIp,
          secret,
        )
      : null;

  const forwardHeaders = buildForwardHeaders(request.headers, {
    clientIp,
    timestamp,
    signature,
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${backendUrl}${backendPathWithQuery}`, {
      method: request.method,
      headers: forwardHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    // No registrar detalles de la request (podria incluir cookies/tokens de
    // login); solo la ruta y el metodo son seguros de loguear.
    console.error(
      `[auth-proxy] backend unreachable for ${request.method} ${backendPathWithQuery}`,
    );
    return NextResponse.json({ message: "Bad gateway" }, { status: 502 });
  }

  const responseBody = NULL_BODY_STATUSES.has(backendResponse.status)
    ? null
    : await backendResponse.arrayBuffer();
  const responseHeaders = new Headers();
  copyResponseHeaders(backendResponse.headers, responseHeaders);

  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}
