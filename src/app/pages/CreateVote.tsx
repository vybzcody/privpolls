import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

import { Navbar } from '../components/Navbar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useZkPoll } from '../hooks/useZkPoll';
import { toast } from 'sonner';
import { encodeStringAsField, stringToFieldArray } from '../core/encoder';
import { aleoService } from '../services/aleoService';

export function CreateVote() {
  const navigate = useNavigate();
  const { propose, isConnected, address } = useZkPoll();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quorum, setQuorum] = useState('10');
  const [endDate, setEndDate] = useState('');
  
  // Vote types: only public/private (no payment)
  const [accessType, setAccessType] = useState<'public' | 'private'>('public');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      toast.error("Please connect and authorize your wallet first");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmCreate = async () => {
    try {
      setIsSubmitting(true);
      
      // Encode title as field element
      const titleField = encodeStringAsField(title.slice(0, 31)); // Max 31 chars for single field
      
      // Encode description as array of 4 fields
      const contentFields = stringToFieldArray(description, 4);
      const contentArrayStr = `[${contentFields.join(', ')}]`;
      
      // Calculate end block based on selected date
      // Aleo produces ~1 block every 10 seconds (6 blocks per minute, 360 per hour, 8640 per day)
      const currentHeight = await aleoService.getLatestHeight();
      console.log("[CreateVote] Current block height:", currentHeight);
      
      let endBlock: number;
      if (endDate) {
        const selectedDate = new Date(endDate);
        const now = new Date();
        const daysDiff = Math.ceil((selectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const blocksPerDay = 8640;
        const blocksToAdd = daysDiff > 0 ? daysDiff * blocksPerDay : blocksPerDay; // Minimum 1 day
        endBlock = currentHeight + blocksToAdd;
      } else {
        // Default to 7 days from now
        endBlock = currentHeight + (7 * 8640);
      }
      
      // Ensure minimum voting period of 1 day
      if (endBlock <= currentHeight + 8640) {
        endBlock = currentHeight + 8640;
      }
      
      console.log("[CreateVote] End block:", endBlock, "(current:", currentHeight, "+", endBlock - currentHeight, "blocks)");

      // Votes are always free (reward_type = 0)
      // Use propose_public or propose_private based on access type
      const functionName = accessType === 'public' ? 'propose_public' : 'propose_private';
      
      const tx = await propose(
        functionName,
        [
          titleField,
          contentArrayStr,
          'false', // is_poll = false for yes/no vote
          `${quorum}u64`,
          `${endBlock}u32`,
          '0u8', // reward_type: 0 (free)
          '0u8', // token_type: 0 (credits)
          '0u64' // reward_amount: 0
        ],
        parseInt(quorum),
        endBlock
      );

      if (tx) {
        toast.success("Transaction submitted! Check your wallet for status.");
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error("[CreateVote] Error:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <h1 className="text-3xl mb-2" style={{ fontWeight: 600 }}>
          Create Vote
        </h1>
        <p className="text-muted-foreground mb-8">
          Binary choice voting with yes/no options on Aleo
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-border p-6 space-y-6">
            <div>
              <Label htmlFor="title">Proposal Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Protocol Upgrade #1"
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide context and details..."
                className="mt-2 min-h-24"
                required
              />
            </div>

            {/* Access Type */}
            <div>
              <Label>Access Type</Label>
              <Select value={accessType} onValueChange={(v) => setAccessType(v as any)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (Anyone can vote)</SelectItem>
                  <SelectItem value="private">Private (Ticket holders only)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {accessType === 'public' 
                  ? 'Anyone with a wallet can participate' 
                  : 'Only voters you invite can participate'}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quorum">Quorum (Minimum votes)</Label>
                <Input
                  id="quorum"
                  type="number"
                  value={quorum}
                  onChange={(e) => setQuorum(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="p-4 bg-accent rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">On-chain privacy:</span> Votes are encrypted using zk-SNARKs. Results are publicly verifiable.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? "Check Wallet..." : "Create on Aleo"}
            </Button>
          </div>
        </form>
      </main>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        onConfirm={confirmCreate}
        title="Deploy to Aleo?"
        description="This will initiate a transaction on the Aleo network to create your proposal. You will need to sign this in your wallet."
        confirmText="Confirm & Sign"
      />
    </div>
  );
}
