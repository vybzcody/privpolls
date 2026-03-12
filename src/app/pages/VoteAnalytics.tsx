import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Navbar } from '../components/Navbar';

export function VoteAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/vote/${id}`)} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Vote
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Vote Analytics</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Analytics for vote <span className="font-mono">{id?.slice(0, 16)}...</span> will be available once on-chain data is fetched from Aleo.
          </p>
          <Button onClick={() => navigate(`/vote/${id}`)}>
            Back to Vote
          </Button>
        </div>
      </main>
    </div>
  );
}
