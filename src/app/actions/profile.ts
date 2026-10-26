"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { logActivity } from "@/lib/audit";
import { getSession } from "@/lib/session";

export async function updateName(_: FormState, data: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in first." };
  const parsed = z.string().trim().min(1).max(80).safeParse(data.get("name"));
  if (!parsed.success) return { ok: false, message: "Enter a name (up to 80 characters)." };
  await db.update(user).set({ name: parsed.data }).where(eq(user.id, session.user.id));
  await logActivity({ userId: session.user.id, userEmail: session.user.email, action: "profile.name", targetType: "user", targetId: session.user.id });
  revalidatePath("/", "layout");
  return { ok: true, message: "Name saved." };
}

/** The separate, optional consent to personalized offers and analytics. Can be withdrawn any time. */
export async function setAnalyticsConsent(consent: boolean): Promise<FormState> {
  const session = await getSession();
  if (session?.user.role !== "customer") return { ok: false, message: "Only customer accounts have this setting." };
  await db
    .update(user)
    .set({ analyticsConsent: consent, analyticsConsentAt: consent ? new Date() : null })
    .where(eq(user.id, session.user.id));
  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email,
    action: consent ? "consent.analytics_given" : "consent.analytics_withdrawn",
    targetType: "user",
    targetId: session.user.id,
  });
  revalidatePath("/profile");
  return { ok: true, message: consent ? "Thanks! You'll get offers based on your favourites." : "Done. We'll stop using your history for offers." };
}
