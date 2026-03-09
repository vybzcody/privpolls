import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Plus, X, ArrowLeft, Info, Cloud } from 'lucide-react';
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
import { aleoService, stringToField } from '../services/aleoService';
import { storacha, PollMetadata } from '../services/storacha';
import { config } from '../config';

interface Question {
  question: string;
  options: string[];
}

export function CreatePoll() {
  const navigate = useNavigate();
  const { propose, isConnected, address } = useZkPoll();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { question: '', options: ['', ''] },
  ]);

  // Poll-specific options
  const [accessType, setAccessType] = useState<'public' | 'private'>('public');
  const [paymentType, setPaymentType] = useState<'free' | 'paid'>('free');
  const [tokenType, setTokenType] = useState<'credits' | 'usdx'>('credits');
  const [entryPrice, setEntryPrice] = useState('0');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addQuestion = () => {
    if (questions.length < 5) {
      setQuestions([...questions, { question: '', options: ['', ''] }]);
    } else {
      toast.error("Maximum 5 questions allowed");
    }
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index].question = value;
    setQuestions(newQuestions);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const addOption = (questionIndex: number) => {
    const newQuestions = [...questions];
    if (newQuestions[questionIndex].options.length < 4) {
      newQuestions[questionIndex].options.push('');
      setQuestions(newQuestions);
    } else {
      toast.error("Maximum 4 options per question");
    }
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions];
    if (newQuestions[questionIndex].options.length > 2) {
      newQuestions[questionIndex].options = newQuestions[questionIndex].options.filter(
        (_, i) => i !== optionIndex
      );
      setQuestions(newQuestions);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      toast.error("Connect and authorize wallet to deploy poll");
      return;
    }
    setShowConfirmModal(true);
  };

  /**
   * Create a single binary proposal for one question
   * Each question in a multi-question poll becomes a separate on-chain proposal
   * They are linked by sharing the same CID prefix in the title field
   */
  const createQuestionProposal = async (
    cid: string,
    questionIndex: number,
    questionText: string,
    option0: string,
    option1: string,
    endBlock: number,
    rewardType: number,
    tokenType: number,
    rewardAmount: number
  ) => {
    // Format: CID_Q{index} for title to link all questions together
    const titleField = await stringToField(`${cid}_Q${questionIndex}`);
    
    // Store question text and options in content fields
    const contentFields = [
      await stringToField("IPFS_POLL"),  // Marker for IPFS-backed polls
      await stringToField(questionText),  // Question text
      await stringToField(option0),       // Option 0 (YES equivalent)
      await stringToField(option1)        // Option 1 (NO equivalent)
    ];

    const functionName = accessType === 'public' ? 'propose_public' : 'propose_private';
    
    const tx = await propose(
      functionName,
      titleField,
      contentFields,
      true, // is_poll
      1, // quorum (minimum for binary vote)
      endBlock,
      rewardType,
      tokenType,
      rewardAmount
    );
    
    return tx;
  };

  const confirmCreate = async () => {
    try {
      setIsSubmitting(true);

      // Filter valid questions
      const validQuestions = questions.filter(q => q.question.trim() !== '' && q.options.length >= 2);
      
      if (validQuestions.length === 0) {
        throw new Error("At least one valid question is required");
      }

      // Prepare poll metadata for IPFS
      const pollMetadata: PollMetadata = {
        title,
        description,
        questions: validQuestions.map(q => ({
          question: q.question,
          options: q.options.filter(o => o.trim() !== ''),
          numOptions: q.options.filter(o => o.trim() !== '').length
        })),
        createdAt: new Date().toISOString(),
        creator: address || ''
      };

      // Validate metadata
      const validation = storacha.validateMetadata(pollMetadata);
      if (!validation.valid) {
        throw new Error(`Invalid poll: ${validation.errors.join(', ')}`);
      }

      // Calculate end block
      const currentHeight = await aleoService.getLatestHeight();
      let endBlock: number;
      if (endDate) {
        const selectedDate = new Date(endDate);
        const now = new Date();
        const daysDiff = Math.ceil((selectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const blocksPerDay = 8640;
        const blocksToAdd = daysDiff > 0 ? daysDiff * blocksPerDay : blocksPerDay;
        endBlock = currentHeight + blocksToAdd;
      } else {
        endBlock = currentHeight + (7 * 8640);
      }

      if (endBlock <= currentHeight + 8640) {
        endBlock = currentHeight + 8640;
      }

      const rewardTypeNum = paymentType === 'paid' ? 1 : 0;
      const tokenTypeNum = tokenType === 'usdx' ? 1 : 0;
      const rewardInMicrocredits = paymentType === 'paid' ? parseInt(entryPrice) * 1000000 : 0;

      // Upload to IPFS via Storacha
      toast.info('Uploading poll to IPFS...');
      const cid = await storacha.uploadPoll(pollMetadata);

      console.log("[CreatePoll] Poll uploaded to IPFS with CID:", cid);

      // Create a binary proposal for EACH question
      // All questions share the same CID but have different question indices
      const proposalTxs: string[] = [];
      
      for (let i = 0; i < validQuestions.length; i++) {
        const q = validQuestions[i];
        // For binary voting, we use first two options as YES/NO
        const option0 = q.options[0] || "Yes";
        const option1 = q.options[1] || "No";
        
        toast.loading(`Creating proposal for Question ${i + 1}...`);
        
        const tx = await createQuestionProposal(
          cid,
          i,
          q.question,
          option0,
          option1,
          endBlock,
          rewardTypeNum,
          tokenTypeNum,
          rewardInMicrocredits
        );
        
        proposalTxs.push(tx);
        console.log(`[CreatePoll] Question ${i} proposal created:`, tx);
      }

      toast.success(
        `${accessType === 'public' ? 'P' : 'Private p'}oll with ${validQuestions.length} question(s) deployed to IPFS + Aleo!`,
        { duration: 5000 }
      );
      
      navigate('/dashboard');
    } catch (error: any) {
      console.error("[CreatePoll] Error:", error);
      if (error.message.includes('IPFS') || error.message.includes('Storacha')) {
        toast.error('IPFS upload failed. Check your connection and try again.');
      } else if (error.message.includes('rejected')) {
        toast.error('Transaction rejected. Please try again.');
      } else {
        toast.error(`Poll error: ${error.message}`);
      }
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

        <h1 className="text-3xl mb-2 font-semibold">Create Poll</h1>
        <p className="text-muted-foreground mb-8">Multi-question polls with IPFS storage on Aleo</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-border p-6 space-y-6">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Cloud className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-800 font-medium">
                Poll data stored on IPFS • Only CID committed on-chain
              </p>
            </div>

            <div>
              <Label htmlFor="title">Poll Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q1 Roadmap Feedback"
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
                placeholder="Describe the purpose of this poll..."
                className="mt-2"
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

            {/* Payment Type */}
            <div>
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as any)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentType === 'paid' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entryPrice">Entry Price (Credits)</Label>
                    <Input
                      id="entryPrice"
                      type="number"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="tokenType">Token</Label>
                    <Select value={tokenType} onValueChange={(v) => setTokenType(v as any)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credits">Credits (ALEO)</SelectItem>
                        <SelectItem value="usdx">USDX (Stablecoin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Note:</span> As the creator, you'll need to pay a small fee to withdraw collected payments. Payments are stored in the program until you withdraw them.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2"
                required
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Questions (up to 5)</Label>
              {questions.length < 5 ? (
                <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="gap-2">
                  <Plus className="w-4 h-4" /> Add Question
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">Max 5 questions</span>
              )}
            </div>

            {questions.map((question, qIndex) => (
              <div key={qIndex} className="bg-white rounded-xl border border-border p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label>Question {qIndex + 1}</Label>
                    <Input
                      value={question.question}
                      onChange={(e) => updateQuestion(qIndex, e.target.value)}
                      placeholder="Enter question text..."
                      className="mt-2"
                      required
                    />
                  </div>
                  {questions.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(qIndex)} className="mt-7">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label>Options (2-4)</Label>
                  <div className="space-y-2 mt-2">
                    {question.options.map((option, oIndex) => (
                      <div key={oIndex} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          placeholder={`Option ${oIndex + 1}`}
                          required
                        />
                        {question.options.length > 2 && (
                          <Button type="button" variant="outline" size="icon" onClick={() => removeOption(qIndex, oIndex)}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {question.options.length < 4 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => addOption(qIndex)} className="mt-2 w-full border-dashed border">
                      <Plus className="w-4 h-4 mr-2" /> Add Option
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary text-white">
              {isSubmitting ? "Sign in Wallet..." : "Deploy Poll"}
            </Button>
          </div>
        </form>
      </main>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        onConfirm={confirmCreate}
        title="Deploy Poll to Aleo?"
        description={`This will create ${questions.filter(q => q.question.trim() !== '').length} binary proposal(s) on the Aleo blockchain. Each question will be voted on separately.`}
        confirmText="Confirm & Deploy"
      />
    </div>
  );
}
