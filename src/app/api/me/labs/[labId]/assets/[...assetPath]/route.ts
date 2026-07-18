import { NextResponse } from "next/server";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { readLabAsset } from "@/lib/lab-assets";
import { getLabById } from "@/lib/lab-registry";
import { labAccessService } from "@/server/labs";

export const dynamic = "force-dynamic";

type RouteContext = { params: { labId: string; assetPath: string[] } };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const session = await requireSession();
    const lab = getLabById(params.labId);
    if (!lab || lab.status !== "available") {
      return NextResponse.json({ error: "LAB_NOT_FOUND" }, { status: 404 });
    }

    const access = await labAccessService.resolve(session.user.id, lab);
    const asset = await readLabAsset(lab, params.assetPath.join("/"), access);
    if (!asset) return NextResponse.json({ error: "LAB_ASSET_NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      path: asset.path,
      content: asset.content,
      editable: asset.editable,
      language: asset.language,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("Lab asset retrieval failed", error);
    return NextResponse.json({ error: "LAB_ASSET_UNAVAILABLE" }, { status: 503 });
  }
}
