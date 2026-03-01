# PrivPolls

PrivPolls is a privacy-first, zero-knowledge powered polling and voting platform built on the Aleo blockchain. It enables users to create, manage, and participate in polls with verifiable results while maintaining voter privacy through ZK-proofs.

## Features

-   **Privacy-First Voting**: Leverage Aleo's zero-knowledge technology to ensure voter anonymity and ballot secrecy.
-   **Public & Private Proposals**: Create open polls for the community or restricted voting for specific participants.
-   **Reward Mechanisms**: Incentivize participation with reward pools in Aleo Credits or USDX.
-   **Ticket-Based Access**: Use secure records (Tickets) for controlled-access voting.
-   **Verifiable Results**: On-chain finalization ensures that every vote is counted accurately without compromising individual privacy.
-   **ZK-Powered Analytics**: Gain insights into poll performance and voter demographics without exposing sensitive data.

## Project Structure

-   `zkpowered_polls_app_v1/`: Core Aleo program (Leo) implementing the voting logic.
-   `src/app/`: React-based frontend application.
    -   `core/`: Data encoding and transaction handling.
    -   `services/`: Aleo blockchain service integrations.
    -   `pages/`: Application views including Dashboard, Poll Creation, and Analytics.
-   `zk-examples/`: Reference implementations and toolkit for Aleo development.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later)
-   [Leo Toolchain](https://developer.aleo.org/leo/) (for modifying the ZK program)
-   An Aleo-compatible wallet (e.g., Leo Wallet)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-repo/privpolls.git
    cd privpolls
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    ```bash
    cp .env.example .env
    # Update .env with your Aleo configuration
    ```

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Deploying the Leo Program

To deploy the ZK program to the Aleo network:
```bash
cd zkpowered_polls_app_v1
leo build
# Follow Aleo deployment procedures
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
