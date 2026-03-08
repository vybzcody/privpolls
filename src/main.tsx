import { createRoot } from "react-dom/client";
import { useMemo } from "react";
import App from "./app/App.tsx";
import "./styles/index.css";
import "@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css";

import { AleoWalletProvider } from "@provablehq/aleo-wallet-adaptor-react";
import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { FoxWalletAdapter } from "@provablehq/aleo-wallet-adaptor-fox";
import { ShieldWalletAdapter } from "@provablehq/aleo-wallet-adaptor-shield";
import { PuzzleWalletAdapter } from "@provablehq/aleo-wallet-adaptor-puzzle";
import { SoterWalletAdapter } from "@provablehq/aleo-wallet-adaptor-soter";
import { WalletModalProvider } from "@provablehq/aleo-wallet-adaptor-react-ui";
import { AleoHooksProvider } from "@provablehq/aleo-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DecryptPermission } from "@provablehq/aleo-wallet-adaptor-core";
import { Network } from "@provablehq/aleo-types";
import { Toaster } from "sonner";
import { PROGRAM_ID } from "./app/services/aleoService";

const queryClient = new QueryClient();

function Main() {
  const wallets = useMemo(
    () => [
      new ShieldWalletAdapter({ appName: "PrivPolls" }),
      new LeoWalletAdapter({ appName: "PrivPolls" }),
      new PuzzleWalletAdapter({ appName: "PrivPolls" }),
      new FoxWalletAdapter({ appName: "PrivPolls" }),
      new SoterWalletAdapter({ appName: "PrivPolls" }),
    ],
    []
  );

  // Define the programs the app interacts with to ensure wallet permissioning
  const programs = useMemo(() => [PROGRAM_ID, 'credits.aleo'], []);

  return (
    <QueryClientProvider client={queryClient}>
      <AleoHooksProvider>
        <AleoWalletProvider
          wallets={wallets}
          autoConnect
          decryptPermission={DecryptPermission.OnChainHistory}
          network={Network.Testnet}
          programs={programs}
        >
          <WalletModalProvider>
            <App />
            <Toaster position="bottom-right" richColors />
          </WalletModalProvider>
        </AleoWalletProvider>
      </AleoHooksProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Main />);
