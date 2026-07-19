import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { buildEngagementResponse } from "@/lib/engagement";
import {
  deriveNotificationsFromEngagement,
  resolveNotificationPreferences,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  normalizeUserPreferences,
  type PartialUserPreferences,
} from "@/lib/user-preferences";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { limit } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true, timeZone: true },
    });
    const engagement = await buildEngagementResponse(
      session.user.id,
      new Date(),
      user?.timeZone ?? "UTC",
    );
    const defaults = resolveNotificationPreferences();
    const preferences = normalizeUserPreferences(
      user?.preferences as PartialUserPreferences | null,
      defaults,
    ).notifications;
    const notifications = deriveNotificationsFromEngagement(
      engagement,
      preferences,
      { limit },
    );

    return NextResponse.json({ notifications, preferences });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "INVALID_NOTIFICATION_QUERY" }, { status: 400 });
    }
    console.error("Unable to load notifications", error);
    return NextResponse.json({ error: "NOTIFICATIONS_UNAVAILABLE" }, { status: 503 });
  }
}
