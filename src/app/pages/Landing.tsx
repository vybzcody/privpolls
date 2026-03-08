import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Shield } from 'lucide-react';
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { WalletMultiButton } from "@provablehq/aleo-wallet-adaptor-react-ui";

export function Landing() {
  const navigate = useNavigate();
  const { connected } = useWallet();

  useEffect(() => {
    if (connected) {
      navigate('/dashboard');
    }
  }, [connected, navigate]);

  return (
    <div className="min-h-screen bg-white text-foreground overflow-hidden">
      {/* Hero Section */}
      <div className="relative pt-20 pb-32 flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            <span>Powered by Aleo Zero-Knowledge Proofs</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            Private, Secure, <br />
            <span className="text-primary">Verifiable</span> Voting
          </h1>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            The first fully decentralized voting platform where your choices remain private, 
            but the results are mathematically guaranteed to be correct.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <WalletMultiButton className="bg-primary text-white hover:bg-primary/90 h-14 px-8 rounded-xl text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:scale-105" />
            <Button 
              variant="outline" 
              size="lg" 
              className="h-14 px-8 rounded-xl text-lg font-medium border-border"
              onClick={() => {
                const el = document.getElementById('how-it-works');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              How it works
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="text-primary font-semibold mb-2">Private</div>
              <div className="text-sm text-muted-foreground mb-1">Zero-Knowledge</div>
              <div className="text-sm">Your identity and specific votes are never revealed on-chain.</div>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="text-primary font-semibold mb-2">Secure</div>
              <div className="text-sm text-muted-foreground mb-1">Blockchain Backed</div>
              <div className="text-sm">Built on Aleo for maximum security and decentralization.</div>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="text-primary font-semibold mb-2">Verifiable</div>
              <div className="text-sm text-muted-foreground mb-1">Transparent</div>
              <div className="text-sm">Publicly verify that every vote was counted correctly.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
