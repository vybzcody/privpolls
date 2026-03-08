import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Shield, Home, MessageCircle, Activity } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>

          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold mb-3">Page not found</h2>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/activity')}
              className="h-12"
            >
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="h-12"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Home
            </Button>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">Quick links</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate('/create-vote')}
              className="text-primary hover:underline"
            >
              Create Vote
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => navigate('/create-poll')}
              className="text-primary hover:underline"
            >
              Create Poll
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => navigate('/verify')}
              className="text-primary hover:underline"
            >
              Verify
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => navigate('/activity')}
              className="text-primary hover:underline"
            >
              Activity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
