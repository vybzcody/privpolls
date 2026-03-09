import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import { ArrowLeft, CheckCircle2, TrendingUp, BarChart3, Lock, Info, Users } from 'lucide-react';
import { Input } from '../components/ui/input';

import { Navbar } from '../components/Navbar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useZkPoll, useProposalData, useHasVoted } from '../hooks/useZkPoll';
import { aleoService, fieldToString, isIpfsPoll, parseAleoStruct } from '../services/aleoService';
import { toast } from 'sonner';

interface LinkedQuestion {
  proposalId: string;
  questionText: string;
  option0: string;
  option1: string;
  questionIndex: number;
  agreeVotes: number;
  disagreeVotes: number;
  totalVotes: number;
}

export function PollPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { votePublicFree, votePublicRewardedCredits, votePublicRewardedUsdx, votePrivate, requestTicket, findTicket, issueTicket, depositRewards, isConnected, address } = useZkPoll();

  // State for linked multi-question poll
  const [linkedQuestions, setLinkedQuestions] = useState<LinkedQuestion[]>([]);
  const [pollMetadata, setPollMetadata] = useState<any>(null);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);
  const [baseCid, setBaseCid] = useState<string | null>(null);
  const [isLinkedPoll, setIsLinkedPoll] = useState(false);

  // State for single binary vote
  const { data: rawProposal, isLoading: loadingProposal } = useProposalData(id || '');
  const { data: hasVoted, isLoading: loadingHasVoted } = useHasVoted(id, address);

  // IPFS metadata state
  const [ipfsMetadata, setIpfsMetadata] = useState(null);
  const [loadingIpfs, setLoadingIpfs] = useState(false);

  // Voting state
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasTicket, setHasTicket] = useState<boolean | null>(null);
  const [isCheckingTicket, setIsCheckingTicket] = useState(false);
  const [voterAddress, setVoterAddress] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const proposal = rawProposal ? parseAleoStruct(String(rawProposal)) : null;
  const isPrivatePoll = proposal?.accessType === 1;
  const isPaidPoll = proposal?.rewardType === 1;
  const isProposer = proposal?.proposer === address;

  // Check if this is a linked poll on mount
  useEffect(() => {
    const checkIfLinked = async () => {
      if (!id || !rawProposal) return;

      try {
        const infoStr = await aleoService.getProposal(id);
        if (!infoStr) return;

        const info = parseAleoStruct(String(infoStr));
        const title = info.title || "";
        const base = aleoService.extractBaseCid(title);
        
        if (base) {
          setIsLinkedPoll(true);
          setBaseCid(base);
          await loadLinkedPoll(base);
        }
      } catch (error) {
        console.error('Error checking if linked:', error);
      }
    };

    checkIfLinked();
  }, [id, rawProposal]);

  // Fetch IPFS metadata
  useEffect(() => {
    const fetchIpfsMetadata = async () => {
      if (!id || loadingProposal) return;

      setLoadingIpfs(true);
      try {
        const metadata = await aleoService.getPollMetadata(id);
        if (metadata) {
          setIpfsMetadata(metadata);
        }
      } catch (error) {
        console.error('Failed to fetch IPFS metadata:', error);
      } finally {
        setLoadingIpfs(false);
      }
    };

    fetchIpfsMetadata();
  }, [id, loadingProposal]);

  const loadLinkedPoll = async (cid: string) => {
    setIsLoadingLinked(true);
    try {
      // Fetch all linked proposals
      const linkedProposals = await aleoService.getLinkedPollProposals(cid);
      
      // Fetch metadata from IPFS
      const metadata = await aleoService.getPollMetadata(cid);
      if (metadata) {
        setPollMetadata(metadata);
      }

      // Fetch vote data for each question
      const questions: LinkedQuestion[] = await Promise.all(
        linkedProposals.map(async (p) => {
          const votes = await aleoService.getLinkedProposalVotes(p.proposalId);
          const content = p.info.content || [];
          
          return {
            proposalId: p.proposalId,
            questionText: content[1] ? fieldToString(content[1]) : `Question ${p.questionIndex + 1}`,
            option0: content[2] ? fieldToString(content[2]) : 'Yes',
            option1: content[3] ? fieldToString(content[3]) : 'No',
            questionIndex: p.questionIndex,
            agreeVotes: votes.agree,
            disagreeVotes: votes.disagree,
            totalVotes: votes.total
          };
        })
      );

      setLinkedQuestions(questions.sort((a, b) => a.questionIndex - b.questionIndex));
    } catch (error) {
      console.error('Error loading linked poll:', error);
    } finally {
      setIsLoadingLinked(false);
    }
  };

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

  const updateAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers({ ...answers, [questionIndex]: optionIndex });
  };

  const handleSubmit = () => {
    if (!isLinkedPoll) {
      setShowConfirmModal(true);
      return;
    }

    // For linked polls, check all questions answered
    const allAnswered = linkedQuestions.every((_, idx) => answers[idx] !== undefined);
    if (!allAnswered) {
      toast.error('Please answer all questions');
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

      if (isLinkedPoll) {
        // Vote on each question separately
        const votePromises = linkedQuestions.map(async (q) => {
          const answer = answers[q.questionIndex];
          const agree = answer === 0; // 0 = first option (agree), 1 = second option (disagree)
          
          if (isPrivatePoll) {
            return votePrivate(q.proposalId, agree);
          } else if (isPaidPoll) {
            if (proposal.tokenType === 1) {
              return votePublicRewardedUsdx(q.proposalId, agree);
            }
            return votePublicRewardedCredits(q.proposalId, agree);
          }
          return votePublicFree(q.proposalId, agree);
        });

        await Promise.all(votePromises);
        toast.success("All votes submitted successfully!");
      } else {
        // Single binary vote
        const agree = answers[0] === 0;
        
        if (isPrivatePoll) {
          await votePrivate(id!, agree);
        } else if (isPaidPoll) {
          if (proposal.tokenType === 1) {
            await votePublicRewardedUsdx(id!, agree);
          } else {
            await votePublicRewardedCredits(id!, agree);
          }
        } else {
          await votePublicFree(id!, agree);
        }
        
        toast.success("Vote submitted successfully!");
      }

      // Refresh hasVoted status
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      if (error.message.includes("rejected")) {
        toast.error("Transaction rejected. Please try again.");
      } else if (error.message.includes("Could not establish connection")) {
        toast.error("Wallet connection lost. Please reconnect your wallet.");
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  if (isLoadingLinked || loadingProposal || loadingIpfs) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const displayTitle = pollMetadata?.title || ipfsMetadata?.title || proposal?.title || "Loading...";
  const displayDescription = pollMetadata?.description || ipfsMetadata?.description;
  const displayQuestions = pollMetadata?.questions || ipfsMetadata?.questions;

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
            <Badge variant="secondary">
              {isLinkedPoll ? (
                <span className="flex items-center gap-1">Multi-Question Poll</span>
              ) : (
                proposal?.isPoll ? 'Binary Poll' : 'Vote'
              )}
            </Badge>
            <Badge variant={isPrivatePoll ? "default" : "outline"}>
              {isPrivatePoll ? "Private" : "Public"}
            </Badge>
            {isPaidPoll && (
              <Badge variant="secondary">
                {proposal?.tokenType === 1 ? "Paid (USDX)" : "Paid (Credits)"}
              </Badge>
            )}
            {!isPaidPoll && (
              <Badge variant="secondary">Free</Badge>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">Live Data</span>
            </div>
          </div>
          <h1 className="text-3xl mb-1 font-semibold break-all">
            {displayTitle}
          </h1>
          <p className="text-sm font-mono text-muted-foreground mb-3 opacity-70">
            ID: {id}
          </p>
          {displayDescription && (
            <p className="text-muted-foreground mb-3">
              {displayDescription}
            </p>
          )}
          <p className="text-muted-foreground">
            Created by: <span className="font-mono text-xs">{proposal?.proposer}</span>
          </p>
        </div>

        {hasVoted && !loadingHasVoted && (
          <div className="mb-6 p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <div className="text-sm">
              <p style={{ fontWeight: 500 }} className="text-primary">
                {isLinkedPoll ? 'All responses submitted' : 'Vote submitted'} successfully
              </p>
              <p className="text-muted-foreground text-xs">
                Your {isLinkedPoll ? 'answers' : 'vote'} has been recorded
              </p>
            </div>
          </div>
        )}

        {/* Context-aware voting interface */}
        <div className="bg-white rounded-xl border border-border p-6 mb-8">
          {(() => {
            // Private poll - no ticket
            if (isPrivatePoll && !hasTicket && !isProposer) {
              return (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Private Poll</h3>
                  <p className="text-muted-foreground mb-4">
                    You need a voting ticket to participate.
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

            // Private poll - proposer view
            if (isPrivatePoll && isProposer) {
              return (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="default">Proposer Mode</Badge>
                    <span className="text-sm text-muted-foreground">Issue tickets to voters</span>
                  </div>
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
                </div>
              );
            }

            // Paid poll - proposer
            if (isPaidPoll && isProposer) {
              return (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary">Paid Poll</Badge>
                    <span className="text-sm text-muted-foreground">Deposit rewards</span>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p className="text-sm text-amber-800 mb-3">
                      Voters will receive <span className="font-bold">{proposal?.rewardAmount}</span> per vote.
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

            // Paid poll - voter
            if (isPaidPoll && !isProposer) {
              return (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Paid Poll</h3>
                  <p className="text-muted-foreground mb-4">
                    Waiting for proposer to deposit rewards.
                  </p>
                </div>
              );
            }

            // Public poll - ticket management
            return (
              <div>
                {!hasVoted && !isPrivatePoll && !hasTicket && (
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
                      {isCheckingTicket ? "Checking..." : "Check Ticket"}
                    </Button>
                  </div>
                )}
                {hasTicket && !hasVoted && (
                  <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Ticket found! Ready to vote.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Questions / Vote Options */}
        {!hasVoted ? (
          <div className="space-y-6">
            {isLinkedPoll ? (
              // Multi-question linked poll
              linkedQuestions.map((q) => (
                <div key={q.proposalId} className="bg-white rounded-xl border border-border p-6">
                  <h3 className="mb-4" style={{ fontWeight: 500 }}>
                    {q.questionIndex + 1}. {q.questionText}
                  </h3>
                  <RadioGroup
                    value={String(answers[q.questionIndex] ?? '')}
                    onValueChange={(value) => updateAnswer(q.questionIndex, parseInt(value))}
                  >
                    <div className="space-y-2">
                      <div
                        className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                          answers[q.questionIndex] === 0
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => updateAnswer(q.questionIndex, 0)}
                      >
                        <RadioGroupItem value="0" id={`q${q.questionIndex}-o0`} />
                        <Label htmlFor={`q${q.questionIndex}-o0`} className="flex-1 cursor-pointer">
                          {q.option0}
                        </Label>
                      </div>
                      <div
                        className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                          answers[q.questionIndex] === 1
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => updateAnswer(q.questionIndex, 1)}
                      >
                        <RadioGroupItem value="1" id={`q${q.questionIndex}-o1`} />
                        <Label htmlFor={`q${q.questionIndex}-o1`} className="flex-1 cursor-pointer">
                          {q.option1}
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              ))
            ) : (
              // Single binary vote
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="mb-4" style={{ fontWeight: 500 }}>
                  {displayQuestions?.[0]?.question || proposal?.title || "Vote"}
                </h3>
                <RadioGroup
                  value={String(answers[0] ?? '')}
                  onValueChange={(value) => updateAnswer(0, parseInt(value))}
                >
                  <div className="space-y-2">
                    <div
                      className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                        answers[0] === 0
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateAnswer(0, 0)}
                    >
                      <RadioGroupItem value="0" id="option0" />
                      <Label htmlFor="option0" className="flex-1 cursor-pointer">
                        {displayQuestions?.[0]?.options?.[0] || (proposal?.content?.[2] ? fieldToString(proposal.content[2]) : 'Agree')}
                      </Label>
                    </div>
                    <div
                      className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                        answers[0] === 1
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateAnswer(0, 1)}
                    >
                      <RadioGroupItem value="1" id="option1" />
                      <Label htmlFor="option1" className="flex-1 cursor-pointer">
                        {displayQuestions?.[0]?.options?.[1] || (proposal?.content?.[3] ? fieldToString(proposal.content[3]) : 'Disagree')}
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (isLinkedPoll ? Object.keys(answers).length !== linkedQuestions.length : Object.keys(answers).length === 0)}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? 'Submitting...' : (isLinkedPoll ? 'Submit All Responses' : 'Submit Vote')}
            </Button>
          </div>
        ) : (
          /* Results Display */
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontWeight: 600 }}>Results</h3>
            </div>

            {isLinkedPoll ? (
              // Multi-question results
              <div className="space-y-6">
                {linkedQuestions.map((q) => {
                  const agreePercentage = q.totalVotes > 0 ? ((q.agreeVotes / q.totalVotes) * 100).toFixed(1) : "0.0";
                  const disagreePercentage = q.totalVotes > 0 ? ((q.disagreeVotes / q.totalVotes) * 100).toFixed(1) : "0.0";
                  const isLeading = (val: number) => val === Math.max(q.agreeVotes, q.disagreeVotes);

                  return (
                    <div key={q.proposalId} className="bg-white rounded-xl border border-border p-6">
                      <h3 className="mb-4" style={{ fontWeight: 500 }}>
                        {q.questionIndex + 1}. {q.questionText}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span style={{ fontWeight: 500 }}>{q.option0}</span>
                              {isLeading(q.agreeVotes) && q.totalVotes > 0 && (
                                <Badge variant="secondary" className="text-xs">Leading</Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <div style={{ fontWeight: 600 }}>{agreePercentage}%</div>
                              <div className="text-xs text-muted-foreground">{q.agreeVotes.toLocaleString()} votes</div>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${agreePercentage}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span style={{ fontWeight: 500 }}>{q.option1}</span>
                              {isLeading(q.disagreeVotes) && q.totalVotes > 0 && (
                                <Badge variant="secondary" className="text-xs">Leading</Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <div style={{ fontWeight: 600 }}>{disagreePercentage}%</div>
                              <div className="text-xs text-muted-foreground">{q.disagreeVotes.toLocaleString()} votes</div>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${disagreePercentage}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single binary vote results
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="mb-4" style={{ fontWeight: 500 }}>
                  {displayQuestions?.[0]?.question || proposal?.title || "Vote Results"}
                </h3>
                
                <div className="space-y-4">
                  {/* Option 0 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontWeight: 500 }}>
                        {displayQuestions?.[0]?.options?.[0] || (proposal?.content?.[2] ? fieldToString(proposal.content[2]) : 'Agree')}
                      </span>
                      <div className="text-right">
                        <div style={{ fontWeight: 600 }}>
                          {((proposal?.agreeVotes || 0) / Math.max(1, (proposal?.agreeVotes || 0) + (proposal?.disagreeVotes || 0)) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">{(proposal?.agreeVotes || 0).toLocaleString()} votes</div>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all" 
                        style={{ width: `${((proposal?.agreeVotes || 0) / Math.max(1, (proposal?.agreeVotes || 0) + (proposal?.disagreeVotes || 0)) * 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Option 1 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontWeight: 500 }}>
                        {displayQuestions?.[0]?.options?.[1] || (proposal?.content?.[3] ? fieldToString(proposal.content[3]) : 'Disagree')}
                      </span>
                      <div className="text-right">
                        <div style={{ fontWeight: 600 }}>
                          {((proposal?.disagreeVotes || 0) / Math.max(1, (proposal?.agreeVotes || 0) + (proposal?.disagreeVotes || 0)) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">{(proposal?.disagreeVotes || 0).toLocaleString()} votes</div>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all" 
                        style={{ width: `${((proposal?.disagreeVotes || 0) / Math.max(1, (proposal?.agreeVotes || 0) + (proposal?.disagreeVotes || 0)) * 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-6 text-xs text-muted-foreground text-center italic">
                  Results are updated every 15 seconds.
                </p>
              </div>
            )}
          </>
        )}

        {/* Poll Stats */}
        <div className="mt-8 p-6 bg-white rounded-xl border border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {isLinkedPoll 
                  ? linkedQuestions.reduce((sum, q) => sum + q.totalVotes, 0).toLocaleString()
                  : (proposal?.agreeVotes || 0) + (proposal?.disagreeVotes || 0)
                }
              </div>
              <div className="text-sm text-muted-foreground">
                {isLinkedPoll ? 'Total Responses' : 'Total Votes'}
              </div>
            </div>
            <div>
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {isLinkedPoll ? linkedQuestions.length : 1}
              </div>
              <div className="text-sm text-muted-foreground">
                {isLinkedPoll ? 'Questions' : 'Question'}
              </div>
            </div>
            <div>
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>
                {proposal?.endBlock || 0}
              </div>
              <div className="text-sm text-muted-foreground">End Block</div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        onConfirm={confirmVote}
        title={isLinkedPoll ? "Submit All Responses?" : "Submit Vote?"}
        description={isLinkedPoll 
          ? "Your responses will be recorded on-chain for each question. This action cannot be undone."
          : "Your vote will be recorded on-chain. This action cannot be undone."
        }
        confirmText={isLinkedPoll ? "Submit All" : "Submit Vote"}
      />
    </div>
  );
}
