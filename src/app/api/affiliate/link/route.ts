import { createClient } from "@/lib/supabase/server";
import { isValidSlug } from "@/lib/slug";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { slug } = await request.json();
  if (typeof slug !== "string" || !isValidSlug(slug)) {
    return NextResponse.json(
      { error: "Slug must be 3-40 characters: letters, numbers, dashes only." },
      { status: 400 }
    );
  }

  // Uniqueness must be checked with the service role: RLS hides other
  // affiliates' rows from a normal client, so it would never see a clash.
  const admin = createAdminClient();
  const [{ data: taken }, { data: takenOld }] = await Promise.all([
    admin.from("affiliates").select("id").eq("slug", slug).neq("id", user.id).maybeSingle(),
    admin.from("affiliate_old_slugs").select("affiliate_id").eq("slug", slug).maybeSingle(),
  ]);
  if (taken || (takenOld && takenOld.affiliate_id !== user.id)) {
    return NextResponse.json({ error: "That link is already taken." }, { status: 409 });
  }

  const { error } = await supabase.from("affiliates").update({ slug }).eq("id", user.id);
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "That link is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug });
}
