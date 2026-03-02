program zkpowered_polls_app_mvp.aleo {

    // ==================== STRUCTS ====================

    struct ProposalInfo {
        title: field,
        content: [field; 4],
        proposer: address,
        is_poll: bool,
        quorum: u64,
        end_block: u32,
        access_type: u8,     // 0=public, 1=private
        reward_type: u8,     // 0=no_reward, 1=rewarded
        token_type: u8,      // 0=credits, 1=usdx
        reward_amount: u64   // reward per vote in microcredits/microusdx
    }

    record Ticket {
        owner: address,
        proposal_id: field,
        is_used: bool
    }

    record Proposal {
        owner: address,
        id: field,
        info: ProposalInfo
    }

    // ==================== MAPPINGS ====================

    mapping proposals: field => ProposalInfo;
    mapping proposals_count: u64 => u64;
    mapping proposals_index: u64 => field;
    mapping agree_votes: field => u64;
    mapping disagree_votes: field => u64;
    mapping poll_scores: field => u64;
    mapping tickets_issued: field => u64;
    mapping tickets_used: field => u64;
    mapping voter_has_ticket: field => bool;
    mapping voter_has_voted: field => bool;
    mapping results: field => field;
    mapping reward_pools: field => u64;

    // ==================== CONSTRUCTOR ====================

    @admin(address="aleo1ewwhmgm4mr3aq3sclxzs53axghxazlhhwtt8a3jsruum5ul54qxsxuqz83")
    async constructor() {}

    // ==================== PROPOSAL CREATION - BINARY ====================

    async transition propose_public(
        public title: field,
        public content: [field; 4],
        public is_poll: bool,
        public quorum: u64,
        public end_block: u32,
        public reward_type: u8,
        public token_type: u8,
        public reward_amount: u64
    ) -> (Proposal, Future) {
        let info: ProposalInfo = ProposalInfo {
            title, content, proposer: self.signer, is_poll, quorum, end_block,
            access_type: 0u8, reward_type, token_type, reward_amount
        };
        let id: field = BHP256::hash_to_field(info);
        let proposal: Proposal = Proposal { owner: self.signer, id, info };
        return (proposal, finalize_propose(id, info));
    }

    async transition propose_private(
        public title: field,
        public content: [field; 4],
        public is_poll: bool,
        public quorum: u64,
        public end_block: u32,
        public reward_type: u8,
        public token_type: u8,
        public reward_amount: u64
    ) -> (Proposal, Future) {
        let info: ProposalInfo = ProposalInfo {
            title, content, proposer: self.signer, is_poll, quorum, end_block,
            access_type: 1u8, reward_type, token_type, reward_amount
        };
        let id: field = BHP256::hash_to_field(info);
        let proposal: Proposal = Proposal { owner: self.signer, id, info };
        return (proposal, finalize_propose(id, info));
    }



    async function finalize_propose(id: field, info: ProposalInfo) {
        proposals.set(id, info);
        let count: u64 = proposals_count.get_or_use(0u64, 0u64);
        proposals_count.set(0u64, count + 1u64);
        proposals_index.set(count + 1u64, id);
        agree_votes.set(id, 0u64);
        disagree_votes.set(id, 0u64);
        tickets_issued.set(id, 0u64);
        tickets_used.set(id, 0u64);
        reward_pools.set(id, 0u64);
    }



    // ==================== REWARD POOL MANAGEMENT ====================

    async transition deposit_rewards(
        public proposal_id: field,
        public amount: u64
    ) -> Future {
        return finalize_deposit_rewards(proposal_id, amount, self.signer);
    }

    async function finalize_deposit_rewards(proposal_id: field, amount: u64, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert_eq(info.proposer, signer);
        assert_eq(info.reward_type, 1u8);
        let current_pool: u64 = reward_pools.get_or_use(proposal_id, 0u64);
        reward_pools.set(proposal_id, current_pool + amount);
    }

    // ==================== TICKET MANAGEMENT ====================

    async transition issue_ticket(
        public proposal_id: field,
        public voter: address
    ) -> (Ticket, Future) {
        let ticket: Ticket = Ticket { owner: voter, proposal_id, is_used: false };
        return (ticket, finalize_issue_ticket(proposal_id, voter, self.signer));
    }

    async function finalize_issue_ticket(proposal_id: field, voter: address, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert_eq(info.proposer, signer);
        assert(block.height < info.end_block);
        let current: u64 = tickets_issued.get_or_use(proposal_id, 0u64);
        tickets_issued.set(proposal_id, current + 1u64);
        let key: field = BHP256::hash_to_field([proposal_id, (voter as group) as field]);
        voter_has_ticket.set(key, true);
    }

    async transition request_ticket(
        public proposal_id: field
    ) -> (Ticket, Future) {
        let ticket: Ticket = Ticket { owner: self.signer, proposal_id, is_used: false };
        return (ticket, finalize_request_ticket(proposal_id, self.signer));
    }

    async function finalize_request_ticket(proposal_id: field, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert(block.height < info.end_block);
        let key: field = BHP256::hash_to_field([proposal_id, (signer as group) as field]);
        let has_ticket: bool = voter_has_ticket.get_or_use(key, false);
        assert_eq(has_ticket, false);
        voter_has_ticket.set(key, true);
        let current: u64 = tickets_issued.get_or_use(proposal_id, 0u64);
        tickets_issued.set(proposal_id, current + 1u64);
    }

    // ==================== VOTING - PUBLIC FREE ====================

    async transition vote_public_free(
        public proposal_id: field,
        public agree: bool
    ) -> Future {
        return finalize_vote_free(proposal_id, agree, self.signer);
    }

    async function finalize_vote_free(proposal_id: field, agree: bool, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert(block.height < info.end_block);
        assert_eq(info.access_type, 0u8);
        assert_eq(info.reward_type, 0u8);
        let key: field = BHP256::hash_to_field([proposal_id, (signer as group) as field]);
        let has_voted: bool = voter_has_voted.get_or_use(key, false);
        assert_eq(has_voted, false);
        if (agree) {
            let count: u64 = agree_votes.get_or_use(proposal_id, 0u64);
            agree_votes.set(proposal_id, count + 1u64);
        } else {
            let count: u64 = disagree_votes.get_or_use(proposal_id, 0u64);
            disagree_votes.set(proposal_id, count + 1u64);
        }
        voter_has_voted.set(key, true);
    }

    // ==================== VOTING - PUBLIC REWARDED CREDITS ====================

    async transition vote_public_rewarded_credits(
        public proposal_id: field,
        public agree: bool
    ) -> Future {
        return finalize_vote_credits(proposal_id, agree, self.signer);
    }

    async function finalize_vote_credits(proposal_id: field, agree: bool, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert(block.height < info.end_block);
        assert_eq(info.access_type, 0u8);
        assert_eq(info.reward_type, 1u8);
        assert_eq(info.token_type, 0u8);

        let pool: u64 = reward_pools.get_or_use(proposal_id, 0u64);
        assert(pool >= info.reward_amount);

        let key: field = BHP256::hash_to_field([proposal_id, (signer as group) as field]);
        let has_voted: bool = voter_has_voted.get_or_use(key, false);
        assert_eq(has_voted, false);

        if (agree) {
            let count: u64 = agree_votes.get_or_use(proposal_id, 0u64);
            agree_votes.set(proposal_id, count + 1u64);
        } else {
            let count: u64 = disagree_votes.get_or_use(proposal_id, 0u64);
            disagree_votes.set(proposal_id, count + 1u64);
        }
        voter_has_voted.set(key, true);

        reward_pools.set(proposal_id, pool - info.reward_amount);
    }

    // ==================== VOTING - PUBLIC REWARDED USDX ====================

    async transition vote_public_rewarded_usdx(
        public proposal_id: field,
        public agree: bool
    ) -> Future {
        return finalize_vote_usdx(proposal_id, agree, self.signer);
    }

    async function finalize_vote_usdx(proposal_id: field, agree: bool, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert(block.height < info.end_block);
        assert_eq(info.access_type, 0u8);
        assert_eq(info.reward_type, 1u8);
        assert_eq(info.token_type, 1u8);

        let pool: u64 = reward_pools.get_or_use(proposal_id, 0u64);
        assert(pool >= info.reward_amount);

        let key: field = BHP256::hash_to_field([proposal_id, (signer as group) as field]);
        let has_voted: bool = voter_has_voted.get_or_use(key, false);
        assert_eq(has_voted, false);

        if (agree) {
            let count: u64 = agree_votes.get_or_use(proposal_id, 0u64);
            agree_votes.set(proposal_id, count + 1u64);
        } else {
            let count: u64 = disagree_votes.get_or_use(proposal_id, 0u64);
            disagree_votes.set(proposal_id, count + 1u64);
        }
        voter_has_voted.set(key, true);

        reward_pools.set(proposal_id, pool - info.reward_amount);
    }

    // ==================== VOTING - PRIVATE ====================

    async transition vote_private(
        private ticket: Ticket,
        public agree: bool
    ) -> Future {
        return finalize_vote_private(ticket.proposal_id, agree, self.signer);
    }

    async function finalize_vote_private(proposal_id: field, agree: bool, signer: address) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert(block.height < info.end_block);
        assert_eq(info.access_type, 1u8);
        let key: field = BHP256::hash_to_field([proposal_id, (signer as group) as field]);
        let has_ticket: bool = voter_has_ticket.get_or_use(key, false);
        assert_eq(has_ticket, true);
        let has_voted: bool = voter_has_voted.get_or_use(key, false);
        assert_eq(has_voted, false);
        if (agree) {
            let count: u64 = agree_votes.get_or_use(proposal_id, 0u64);
            agree_votes.set(proposal_id, count + 1u64);
        } else {
            let count: u64 = disagree_votes.get_or_use(proposal_id, 0u64);
            disagree_votes.set(proposal_id, count + 1u64);
        }
        voter_has_voted.set(key, true);
        let used: u64 = tickets_used.get_or_use(proposal_id, 0u64);
        tickets_used.set(proposal_id, used + 1u64);
    }



    // ==================== RESULT FINALIZATION ====================

    async transition set_result(
        public proposal_id: field,
        public winner: field
    ) -> Future {
        return finalize_set_result(proposal_id, winner);
    }

    async function finalize_set_result(proposal_id: field, winner: field) {
        let info: ProposalInfo = proposals.get(proposal_id);
        assert(block.height >= info.end_block);
        assert(!results.contains(proposal_id));
        let agree: u64 = agree_votes.get_or_use(proposal_id, 0u64);
        let disagree: u64 = disagree_votes.get_or_use(proposal_id, 0u64);
        let total: u64 = agree + disagree;
        assert(total >= info.quorum);
        results.set(proposal_id, winner);
    }
}
