import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Plus, ChevronDown, Search, Cloud, Users, Clock } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useProposals } from '../hooks/useZkPoll';
import { 
  fieldToString, 
  isIpfsPoll, 
  extractCid, 
  aleoService, 
  parseAleoStruct 
} from '../services/aleoService';
import { toast } from 'sonner';

type SortOption = 'newest' | 'ending-soon';

interface ProposalGroup {
  baseCid: string;
  isLinked: boolean;
  proposals: Array<{
    id: string;
    info: any;
    title: string;
    description: string;
    proposer: string;
    isPoll: boolean;
    endBlock: number;
    questionIndex?: number;
  }>;
  // Computed fields for grouped polls
  totalQuestions?: number;
  firstProposalId?: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data: rawProposals, isLoading } = useProposals();

  const [activeTab, setActiveTab] = useState<'all' | 'votes' | 'polls'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [ipfsMetadata, setIpfsMetadata] = useState<Record<string, any>>({});
  const [groupedProposals, setGroupedProposals] = useState<ProposalGroup[]>([]);

  // Fetch IPFS metadata and group linked proposals
  useEffect(() => {
    const processProposals = async () => {
      if (!rawProposals?.length) {
        setGroupedProposals([]);
        return;
      }

      // Step 1: Parse all proposals and identify linked ones
      const parsedProposals = rawProposals.map(p => {
        const parsed = parseAleoStruct(String(p.info));
        const isIpfs = isIpfsPoll(parsed);
        const title = parsed.title || "";
        const baseCid = aleoService.extractBaseCid(title);
        const questionIndex = aleoService.extractQuestionIndex(title);

        return {
          id: p.id,
          info: p.info,
          ...parsed,
          isIpfs,
          baseCid,
          questionIndex,
          isLinked: baseCid !== null
        };
      });

      // Step 2: Group linked proposals by base CID
      const groups = new Map<string, ProposalGroup>();
      const standaloneProposals: ProposalGroup[] = [];

      for (const p of parsedProposals) {
        if (p.isLinked && p.baseCid) {
          // Add to linked group
          const existing = groups.get(p.baseCid);
          if (existing) {
            existing.proposals.push({
              id: p.id,
              info: p.info,
              title: p.title,
              description: p.description || '',
              proposer: p.proposer,
              isPoll: p.is_poll,
              endBlock: p.endBlock,
              questionIndex: p.questionIndex
            });
            // Update first proposal ID to the earliest question
            if (p.questionIndex !== undefined && 
                (existing.firstProposalId === undefined || 
                 p.questionIndex < (existing.proposals.find(pr => pr.id === existing.firstProposalId)?.questionIndex ?? 999))) {
              existing.firstProposalId = p.id;
            }
          } else {
            groups.set(p.baseCid, {
              baseCid: p.baseCid,
              isLinked: true,
              proposals: [{
                id: p.id,
                info: p.info,
                title: p.title,
                description: p.description || '',
                proposer: p.proposer,
                isPoll: p.is_poll,
                endBlock: p.endBlock,
                questionIndex: p.questionIndex
              }],
              firstProposalId: p.id
            });
          }
        } else {
          // Standalone proposal
          standaloneProposals.push({
            baseCid: p.id,
            isLinked: false,
            proposals: [{
              id: p.id,
              info: p.info,
              title: p.title,
              description: p.description || '',
              proposer: p.proposer,
              isPoll: p.is_poll,
              endBlock: p.endBlock
            }],
            firstProposalId: p.id
          });
        }
      }

      // Step 3: Finalize linked groups
      const finalizedGroups: ProposalGroup[] = Array.from(groups.values()).map(group => {
        // Sort proposals by question index
        group.proposals.sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0));
        group.totalQuestions = group.proposals.length;
        group.firstProposalId = group.proposals[0]?.id;
        return group;
      });

      setGroupedProposals([...finalizedGroups, ...standaloneProposals]);

      // Step 4: Fetch IPFS metadata for all base CIDs
      const metadataPromises = finalizedGroups
        .filter(g => g.isLinked)
        .map(async (group) => {
          try {
            const metadata = await aleoService.getPollMetadata(group.firstProposalId!);
            return { baseCid: group.baseCid, metadata };
          } catch (error) {
            console.error(`Failed to fetch metadata for ${group.baseCid}:`, error);
            return { baseCid: group.baseCid, metadata: null };
          }
        });

      const results = await Promise.all(metadataPromises);
      const metadataMap = results.reduce((acc, { baseCid, metadata }) => {
        if (metadata) acc[baseCid] = metadata;
        return acc;
      }, {} as Record<string, any>);

      setIpfsMetadata(metadataMap);
    };

    processProposals();
  }, [rawProposals]);

  const filteredItems = useMemo(() => {
    return groupedProposals.filter(group => {
      const firstProposal = group.proposals[0];
      
      // Tab filter
      const matchesTab = activeTab === 'all' ||
        (activeTab === 'votes' && !firstProposal.isPoll) ||
        (activeTab === 'polls' && firstProposal.isPoll);

      // Search filter - search in title and metadata
      const metadata = group.isLinked ? ipfsMetadata[group.baseCid] : null;
      const searchTitle = metadata?.title || firstProposal.title || '';
      const searchDesc = metadata?.description || firstProposal.description || '';
      
      const matchesSearch = searchQuery === '' ||
        searchTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        firstProposal.id.includes(searchQuery);

      return matchesTab && matchesSearch;
    });
  }, [groupedProposals, activeTab, searchQuery, ipfsMetadata]);

  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    if (sortBy === 'newest') {
      // Sort by proposal ID (hash-based, roughly chronological)
      items.sort((a, b) => b.firstProposalId!.localeCompare(a.firstProposalId!));
    } else if (sortBy === 'ending-soon') {
      // Sort by end block (ascending)
      items.sort((a, b) => a.proposals[0].endBlock - b.proposals[0].endBlock);
    }
    return items;
  }, [filteredItems, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title or proposal ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-base"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Type Tabs */}
            <div className="flex bg-white rounded-lg border border-border p-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'all' ? 'bg-primary text-white' : 'hover:bg-accent'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab('votes')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'votes' ? 'bg-primary text-white' : 'hover:bg-accent'
                }`}
              >
                Votes
              </button>
              <button
                onClick={() => setActiveTab('polls')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'polls' ? 'bg-primary text-white' : 'hover:bg-accent'
                }`}
              >
                Polls
              </button>
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Clock className="w-4 h-4" />
                  {sortBy === 'newest' ? 'Newest' : 'Ending Soon'}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setSortBy('newest')}>Newest</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('ending-soon')}>Ending Soon</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse border border-border" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {sortedItems.length} {activeTab === 'all' ? 'items' : activeTab} on Aleo
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedItems.map((group) => {
                const firstProposal = group.proposals[0];
                const metadata = group.isLinked ? ipfsMetadata[group.baseCid] : null;
                const displayTitle = metadata?.title || firstProposal.title || "Untitled";
                const numQuestions = group.totalQuestions || 1;

                return (
                  <div
                    key={group.firstProposalId}
                    onClick={() => {
                      if (group.isLinked) {
                        // Navigate to first question of linked poll
                        navigate(`/poll/${group.firstProposalId}`);
                      } else {
                        // Navigate to standalone proposal
                        navigate(firstProposal.isPoll ? `/poll/${firstProposal.id}` : `/vote/${firstProposal.id}`);
                      }
                    }}
                    className="bg-white rounded-xl border border-border p-5 hover:border-primary/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {group.isLinked ? (
                            <span className="flex items-center gap-1">
                              <Cloud className="w-3 h-3" />
                              {numQuestions}Q Poll
                            </span>
                          ) : (
                            firstProposal.isPoll ? 'Binary Poll' : 'Vote'
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs text-muted-foreground">Active</span>
                      </div>
                    </div>

                    <h3 className="mb-2 text-base font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {displayTitle}
                    </h3>

                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1 font-mono text-xs opacity-50">
                      ID: {group.firstProposalId?.slice(0, 16)}...
                    </p>

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      Proposer: {firstProposal.proposer?.slice(0, 10)}...{firstProposal.proposer?.slice(-6)}
                    </p>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>Live on Testnet</span>
                      </div>
                      <span>End: {firstProposal.endBlock}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-border">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No proposals found</h3>
                <p className="text-muted-foreground">Be the first to create one on-chain!</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
