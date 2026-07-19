import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import type { Prisma } from "@prisma/client";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { resolveNotificationPreferences } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  mergeUserPreferences,
  normalizeUserPreferences,
  type PartialUserPreferences,
} from "@/lib/user-preferences";

export const dynamic = "force-dynamic";

const quietHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const updatesSchema: z.ZodType<PartialUserPreferences> = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  shareTelemetry: z.boolean().optional(),
  motivationalProfile: z.object({
    style: z.enum(["competitive", "collaborative", "curious", "goal-oriented"]),
    rewardPreference: z.enum(["badges", "certificates", "career", "tools"]),
  }).nullable().optional(),
  notifications: z.object({
    categories: z.object({
      progress: z.boolean().optional(),
      practice: z.boolean().optional(),
      review: z.boolean().optional(),
      community: z.boolean().optional(),
      mentor: z.boolean().optional(),
    }).optional(),
    channels: z.object({
      inApp: z.boolean().optional(),
      email: z.boolean().optional(),
    }).optional(),
    digest: z.enum(["daily", "weekly"]).optional(),
    quietHours: quietHoursSchema.nullable().optional(),
  }).optional(),
}).strict();

async function loadPreferences(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return normalizeUserPreferences(
    user?.preferences as PartialUserPreferences | null,
    resolveNotificationPreferences(),
  );
}

function handleError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: "INVALID_PREFERENCES" }, { status: 400 });
  }
  console.error("Preferences API failed", error);
  return NextResponse.json({ error: "PREFERENCES_UNAVAILABLE" }, { status: 503 });
}

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ preferences: await loadPreferences(session.user.id) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const payload = await request.json();
    const updates = updatesSchema.parse(payload.preferences ?? payload);
    const current = await loadPreferences(session.user.id);
    const merged = mergeUserPreferences(current, updates);
    merged.notifications.channels.inApp = true;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: merged as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({ preferences: merged });
  } catch (error) {
    return handleError(error);
  }
}
