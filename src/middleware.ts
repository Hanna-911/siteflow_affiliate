import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/admin");
  const isPendingPage = path === "/pending";

  if (!isProtected && !isPendingPage) {
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("status, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!affiliate || affiliate.status !== "approved") {
    if (isPendingPage) return response;
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  if (path.startsWith("/admin") && affiliate.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Approved affiliate hitting /pending on purpose — send them onward.
  if (isPendingPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/pending"],
};
