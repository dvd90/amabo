import { StarPage } from '@/components/StarPage';

export default async function Page({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  return (
    <main>
      <StarPage tokenId={tokenId} />
    </main>
  );
}
