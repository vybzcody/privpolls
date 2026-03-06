import { useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Plus, ChevronDown, Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { WalletMultiButton } from "@provablehq/aleo-wallet-adaptor-react-ui";

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connected, address } = useWallet();

  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <h1
              className="text-xl font-semibold cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              PrivPolls
            </h1>
            <nav className="hidden md:flex items-center gap-1">
              <Button
                variant={isActive('/dashboard') ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                Dashboard
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/notifications')}
              className={`relative ${isActive('/notifications') ? 'bg-secondary' : ''}`}
            >
              <Bell className="w-4 h-4" />
            </Button>
            
            <WalletMultiButton className="bg-primary text-white hover:bg-primary/90 rounded-lg h-9" />

            {connected && address && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                    <Plus className="w-4 h-4" />
                    Create
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => navigate('/create-vote')}>
                    New Vote
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/create-poll')}>
                    New Poll
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

