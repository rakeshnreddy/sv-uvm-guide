export interface Review {
  commitId: string;
  comment?: string;
  approved?: boolean;
}

const reviews: Review[] = [];

export function addReview(review: Review) {
  reviews.push(review);
}

export function getReviews() {
  return reviews;
}

export function clearReviews() {
  reviews.length = 0;
}
