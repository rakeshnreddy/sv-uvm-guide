import { getDueFlashcards, reviewFlashcard } from '@/actions/srs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { revalidatePath } from 'next/cache';

export default async function MemoryHubPage() {
  const dueFlashcards = await getDueFlashcards();

  const handleReview = async (flashcardId: string, quality: number) => {
    'use server';
    await reviewFlashcard(flashcardId, quality);
    revalidatePath('/dashboard/memory-hub');
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Memory Hub</h1>
      {dueFlashcards.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Due Flashcards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg">{dueFlashcards[0].front}</div>
            <details className="mt-4">
              <summary className="cursor-pointer">Show Answer</summary>
              <div className="mt-2 text-gray-600">{dueFlashcards[0].back}</div>
            </details>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <form action={handleReview.bind(null, dueFlashcards[0].id, 0)}>
              <Button type="submit" variant="destructive">Again</Button>
            </form>
            <form action={handleReview.bind(null, dueFlashcards[0].id, 2)}>
              <Button type="submit" variant="outline">Hard</Button>
            </form>
            <form action={handleReview.bind(null, dueFlashcards[0].id, 4)}>
              <Button type="submit">Good</Button>
            </form>
            <form action={handleReview.bind(null, dueFlashcards[0].id, 5)}>
              <Button type="submit" variant="ghost">Easy</Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <p>No flashcards due for review. Well done!</p>
      )}
    </div>
  );
}
