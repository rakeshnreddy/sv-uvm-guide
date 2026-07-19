import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export class ReviewAuthorizationError extends Error {
  constructor() {
    super("Repository access denied");
    this.name = "ReviewAuthorizationError";
  }
}

export function authorizeRepositoryAccess(repository: string): void {
  const allowlist = (process.env.REVIEW_REPOSITORY_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0 && process.env.NODE_ENV !== "production") return;
  if (!allowlist.includes(repository.toLowerCase())) {
    throw new ReviewAuthorizationError();
  }
}

export const reviewRepository = {
  create(data: Prisma.ReviewUncheckedCreateInput) {
    return prisma.review.create({ data });
  },

  listByCommit(input: {
    userId: string;
    repository: string;
    commitSha: string;
    cursor?: string;
    limit: number;
  }) {
    return prisma.review.findMany({
      where: {
        userId: input.userId,
        repository: input.repository,
        commitSha: input.commitSha,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
    });
  },

  get(input: { userId: string; repository: string; id: string }) {
    return prisma.review.findFirst({
      where: {
        id: input.id,
        userId: input.userId,
        repository: input.repository,
      },
    });
  },
};
