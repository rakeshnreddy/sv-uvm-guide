import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AuthenticationError, requireSession } from "@/lib/auth";
import {
  authorizeRepositoryAccess,
  ReviewAuthorizationError,
  reviewRepository,
} from "@/server/reviews";

export const dynamic = "force-dynamic";

const repositorySchema = z.string().regex(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i);
const commitShaSchema = z.string().regex(/^[0-9a-f]{7,40}$/i);

const reviewSchema = z
  .object({
    repository: repositorySchema,
    commitSha: commitShaSchema,
    comment: z.string().trim().min(1).max(4_000).optional(),
    approved: z.boolean().optional(),
  })
  .strict()
  .refine((input) => input.comment !== undefined || input.approved !== undefined, {
    message: "A comment or approval decision is required",
  });

const querySchema = z.object({
  repository: repositorySchema,
  commitSha: commitShaSchema,
  cursor: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function publicError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (error instanceof ReviewAuthorizationError) {
    return NextResponse.json({ error: "REPOSITORY_ACCESS_DENIED" }, { status: 403 });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: "INVALID_REVIEW_REQUEST" }, { status: 400 });
  }

  console.error("Review API failed", error);
  return NextResponse.json({ error: "REVIEW_SERVICE_UNAVAILABLE" }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const query = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    authorizeRepositoryAccess(query.repository);

    const records = await reviewRepository.listByCommit({
      userId: session.user.id,
      repository: query.repository,
      commitSha: query.commitSha,
      cursor: query.cursor,
      limit: query.limit,
    });
    const hasNextPage = records.length > query.limit;
    const reviews = hasNextPage ? records.slice(0, query.limit) : records;
    return NextResponse.json({
      reviews,
      nextCursor: hasNextPage ? reviews[reviews.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = reviewSchema.parse(await request.json());
    authorizeRepositoryAccess(input.repository);

    const review = await reviewRepository.create({
      userId: session.user.id,
      repository: input.repository,
      commitSha: input.commitSha,
      comment: input.comment,
      approved: input.approved,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return publicError(error);
  }
}
