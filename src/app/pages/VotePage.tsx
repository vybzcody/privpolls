import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle2, Users, TrendingUp, BarChart3, Info, Lock } from 'lucide-react';

import { Navbar } from '../components/Navbar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useZkPoll, useProposalData, useVoteStats, useHasVoted } from '../hooks/useZkPoll';
import { toast } from 'sonner';
import { fieldToString } from '../core/encoder';
import { parseAleoStruct, isIpfsPoll } from '../services/aleoService';

export function VotePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { data: rawProposal, isLoading: loadingProposal } = useProposalData(id || '');
  const { data: stats, isLoading: loadingStats } = useVoteStats(id || '');
  const { votePrivate, votePublicFree, votePublicRewardedCredits, votePublicRewardedUsdx, requestTicket, findTicket, issueTicket, depositRewards, isConnected, address } = useZkPoll();
  const { data: hasVoted, isLoading: loadingHasVoted } = useHasVoted(id || '', address);

  const [selectedVote, setSelectedVote] = useState<'yes' | 'no' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasTicket, setHasTicket] = useState<boolean | null>(null);
  const [isCheckingTicket, setIsCheckingTicket] = useState(false);
  const [voterAddress, setVoterAddress] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const checkTicket = async () => {
    if (!id || !isConnected) return;
    try {
      setIsCheckingTicket(true);
      const ticket = await findTicket(id);
      setHasTicket(!!ticket);
      if (ticket) {
        toast.success("Found a valid voting ticket in your wallet!");
      } else {
        toast.info("No voting ticket found for this proposal yet.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingTicket(false);
    }
  };

  const proposal = rawProposal ? parseAleoStruct(String(rawProposal)) : null;

  if (loadingProposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Proposal not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const handleVote = () => {
    if (!selectedVote) return;
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmVote = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Check poll type
      const isPrivatePoll = proposal?.accessType === 1;
      const isPaidPoll = proposal?.rewardType === 1; // reward_type: 1 means "paid/rewarded"
      const tokenType = proposal?.tokenType || 0; // 0 = credits, 1 = usdx
      
      let tx;
      if (isPrivatePoll) {
        // Use private voting for private polls
        tx = await votePrivate(id!, selectedVote === 'yes');
      } else if (isPaidPoll) {
        // Use rewarded voting for paid polls
        if (tokenType === 1) {
          tx = await votePublicRewardedUsdx(id!, selectedVote === 'yes');
        } else {
          tx = await votePublicRewardedCredits(id!, selectedVote === 'yes');
        }
      } else {
        // Use free voting for free public polls
        tx = await votePublicFree(id!, selectedVote === 'yes');
      }
      
      if (tx) {
        toast.success("Vote submitted! It will appear after confirmation.");
      }
    } catch (error: any) {
      if (error.message.includes("Could not establish connection")) {
        toast.error("Wallet connection lost. Please reconnect your wallet.");
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const yesVotes = stats?.agree || 0;
  const noVotes = stats?.disagree || 0;
  const totalVotes = stats?.total || 0;
  
  const yesPercentage = totalVotes > 0 ? ((yesVotes / totalVotes) * 100).toFixed(1) : "0.0";
  const noPercentage = totalVotes > 0 ? ((noVotes / totalVotes) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="secondary">On-Chain</Badge>
            <Badge variant={proposal?.accessType === 1 ? "default" : "outline"}>
              {proposal?.accessType === 1 ? "Private" : "Public"}
            </Badge>
            {proposal?.rewardType === 1 && (
              <Badge variant="secondary">
                {proposal?.tokenType === 1 ? "Paid (USDX)" : "Paid (Credits)"}
              </Badge>
            )}
            {proposal?.rewardType === 0 && (
              <Badge variant="secondary">Free</Badge>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">Live Data</span>
            </div>
          </div>
          <h1 className="text-3xl mb-1 font-semibold break-all">
            {proposal.title || "Untitled Proposal"}
          </h1>
          <p className="text-sm font-mono text-muted-foreground mb-3 opacity-70">
            ID: {id}
          </p>
          <p className="text-muted-foreground">
            Created by: <span className="font-mono text-xs">{proposal.proposer}</span>
          </p>
        </div>

        {/* Voting Interface */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelectedVote('yes')}
            className={`p-8 rounded-xl border-2 transition-all text-left ${
              selectedVote === 'yes'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-white hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                selectedVote === 'yes' ? 'bg-primary' : 'bg-gray-100'
              }`}>
                <ThumbsUp className={`w-6 h-6 ${
                  selectedVote === 'yes' ? 'text-white' : 'text-gray-600'
                }`} />
              </div>
              <div>
                <div className="text-2xl font-semibold">Yes</div>
                <div className="text-sm text-muted-foreground">
                  {yesVotes.toLocaleString()} votes
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedVote('no')}
            className={`p-8 rounded-xl border-2 transition-all text-left ${
              selectedVote === 'no'
                ? 'border-red-500 bg-red-50'
                : 'border-border bg-white hover:border-red-500/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                selectedVote === 'no' ? 'bg-red-500' : 'bg-gray-100'
              }`}>
                <ThumbsDown className={`w-6 h-6 ${
                  selectedVote === 'no' ? 'text-white' : 'text-gray-600'
                }`} />
              </div>
              <div>
                <div className="text-2xl font-semibold">No</div>
                <div className="text-sm text-muted-foreground">
                  {noVotes.toLocaleString()} votes
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Context-aware voting interface */}
        <div className="bg-white rounded-xl border border-border p-8 mb-8">
          {/* Check poll status and user permissions */}
          {(() => {
            const isPrivatePoll = proposal?.accessType === 1;
            const isProposer = proposal?.proposer === address;
            const canVote = !isPrivatePoll || hasTicket || isProposer;
            
            // Case 1: Private poll - user doesn't have ticket and isn't proposer
            if (isPrivatePoll && !hasTicket && !isProposer) {
              return (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Private Poll</h3>
                  <p className="text-muted-foreground mb-4">
                    You need a voting ticket to participate in this poll.
                  </p>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800">Contact the Proposer</p>
                    <p className="text-yellow-700 mt-1">
                      Ask <span className="font-mono text-xs">{proposal?.proposer?.slice(0, 10)}...</span> to issue you a voting ticket.
                    </p>
                  </div>
                </div>
              );
            }
            
            // Case 2: Private poll - proposer view
            if (isPrivatePoll && isProposer) {
              return (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="default">Proposer Mode</Badge>
                    <span className="text-sm text-muted-foreground">You can issue tickets to voters</span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter voter wallet addresses to issue them voting tickets for this private poll.
                  </p>
                  
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Voter wallet address (aleo1...)"
                      value={voterAddress}
                      onChange={(e) => setVoterAddress(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (!voterAddress) {
                          toast.error("Please enter a wallet address");
                          return;
                        }
                        issueTicket(id!, voterAddress);
                        setVoterAddress('');
                      }}
                      className="h-10"
                    >
                      Issue Ticket
                    </Button>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <Info className="w-4 h-4 inline mr-1" />
                    Voters must have a ticket to vote on this private poll.
                  </div>
                </div>
              );
            }
            
            // Case 3: Paid poll - proposer needs to deposit rewards
            const isPaidPoll = proposal?.rewardType === 1;
            if (isPaidPoll && isProposer) {
              return (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary">Paid Poll</Badge>
                    <span className="text-sm text-muted-foreground">Deposit rewards for voters</span>
                  </div>
                  
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p className="text-sm text-amber-800 mb-3">
                      Voters will receive <span className="font-bold">{proposal?.rewardType}</span> per vote. You need to deposit rewards before voting can begin.
                    </p>
                    
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Amount (in credits)"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => {
                          if (!depositAmount || parseInt(depositAmount) <= 0) {
                            toast.error("Please enter a valid amount");
                            return;
                          }
                          depositRewards(id!, parseInt(depositAmount));
                          setDepositAmount('');
                        }}
                        className="h-10"
                      >
                        Deposit Rewards
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Case 4: Paid poll - voter view (needs proposer to deposit)
            if (isPaidPoll && !isProposer) {
              return (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Paid Poll</h3>
                  <p className="text-muted-foreground mb-4">
                    This poll has rewards for voting. The proposer needs to deposit rewards before voting can begin.
                  </p>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800">Waiting for deposits</p>
                    <p className="text-yellow-700 mt-1">
                      Check back later or contact the proposer: <span className="font-mono text-xs">{proposal?.proposer?.slice(0, 10)}...</span>
                    </p>
                  </div>
                </div>
              );
            }
            
            // Case 5: Public poll with ticket request option OR direct voting
            return (
              <div>
                {/* User has already voted - show status */}
                {hasVoted && !loadingHasVoted && (
                  <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <div>
                      <p className="font-medium">You have already voted</p>
                      <p className="text-sm">Thank you for participating!</p>
                    </div>
                  </div>
                )}
                
                {/* Show ticket section only if user hasn't voted */}
                {!hasVoted && (
                  <>
                    {/* Show ticket status for public polls if user has ticket */}
                    {hasTicket && (
                      <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Ticket found! You are ready to vote.
                      </div>
                    )}
                    
                    {/* Show request ticket button only if user doesn't have a ticket */}
                    {proposal?.accessType !== 1 && !hasTicket && (
                      <div className="flex gap-2 mb-4">
                        <Button
                          onClick={() => {
                            if (!isConnected) {
                              toast.error("Please connect your wallet");
                              return;
                            }
                            requestTicket(id!);
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          Request Ticket
                        </Button>
                        <Button
                          onClick={checkTicket}
                          disabled={isCheckingTicket}
                          variant="secondary"
                          className="flex-1"
                        >
                          {isCheckingTicket ? "Checking..." : "Check for Ticket"}
                        </Button>
                      </div>
                    )}
                    
                    {/* If user has ticket, show check button only */}
                    {proposal?.accessType !== 1 && hasTicket && (
                      <div className="flex gap-2 mb-4">
                        <Button
                          onClick={checkTicket}
                          disabled={isCheckingTicket}
                          variant="secondary"
                          className="flex-1"
                        >
                          {isCheckingTicket ? "Checking..." : "Refresh Ticket Status"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Voting buttons - only show if can vote AND hasn't voted */}
        {(!proposal?.accessType || proposal?.accessType === 0 || hasTicket) && !hasVoted && (
          <>
            <h3 className="mb-6 font-semibold">Cast Your Vote</h3>
            <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Yes ({yesPercentage}%)</span>
                <span className="text-sm text-muted-foreground">{yesVotes} votes</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${yesPercentage}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">No ({noPercentage}%)</span>
                <span className="text-sm text-muted-foreground">{noVotes} votes</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${noPercentage}%` }} />
              </div>
            </div>
            </div>
          </>
        )}

        {/* Submit button - only show if can vote AND hasn't voted */}
        {(!proposal?.accessType || proposal?.accessType === 0 || hasTicket) && !hasVoted && !loadingHasVoted && (
          <Button
            onClick={handleVote}
            disabled={!selectedVote || isSubmitting}
            className="w-full h-12 bg-primary text-white"
          >
            {isSubmitting ? 'Processing Transaction...' : 'Submit Vote'}
          </Button>
        )}

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white rounded-xl border border-border">
            <div className="text-xl font-semibold">{totalVotes}</div>
            <div className="text-xs text-muted-foreground">Total Votes</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-border">
            <div className="text-xl font-semibold">Active</div>
            <div className="text-xs text-muted-foreground">Status</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-border">
            <div className="text-xl font-semibold">{proposal.endBlock}</div>
            <div className="text-xs text-muted-foreground">End Block</div>
          </div>
        </div>
      </main>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        onConfirm={confirmVote}
        title={proposal?.accessType === 1 ? "Confirm Private Vote" : "Confirm Vote"}
        description={
          proposal?.accessType === 1 
            ? `You are voting "${selectedVote?.toUpperCase()}". This will consume one voting ticket and record your vote anonymously on Aleo.`
            : proposal?.rewardType === 1
            ? `You are voting "${selectedVote?.toUpperCase()}" on this PAID poll (${proposal?.tokenType === 1 ? 'USDX' : 'Credits'} reward). Your vote will be recorded and you may earn rewards.`
            : `You are voting "${selectedVote?.toUpperCase()}" on this FREE public poll. Your vote will be recorded on the Aleo blockchain.`
        }
        confirmText="Sign & Vote"
      />
    </div>
  );
}
