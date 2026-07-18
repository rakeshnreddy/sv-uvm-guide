import { NextResponse } from "next/server";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { buildEngagementResponse } from "@/lib/engagement";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timeZone: true },
    });
    const engagement = await buildEngagementResponse(
      session.user.id,
      new Date(),
      user?.timeZone ?? "UTC",
    );
    return NextResponse.json(engagement);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("Unable to build engagement dashboard", error);
    return NextResponse.json({ error: "ENGAGEMENT_UNAVAILABLE" }, { status: 503 });
  }
}
