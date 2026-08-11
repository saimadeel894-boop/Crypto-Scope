import { Button } from "./ui/button"
import { WalletIcon, CopyIcon, CheckIcon, ExternalLinkIcon, LogOutIcon, ChevronRightIcon, NetworkIcon } from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { useState } from "react"
import { Separator } from "./ui/separator"
import { toast } from "sonner"

export function WalletPopup() {
  const { account, balance, network, disconnectWallet } = useWallet();
  const [copied, setCopied] = useState(false);

  const getNetworkIcon = (chainId: string) => {
    switch (chainId) {
      case '1':
        return '🟢'; // Ethereum Mainnet
      case '5':
        return '🟡'; // Goerli
      case '11155111':
        return '🟣'; // Sepolia
      case '137':
        return '🟣'; // Polygon
      case '80001':
        return '🟡'; // Mumbai
      case '361':
        return '🔵'; // Theta Mainnet
      default:
        return '⚪';
    }
  };

  const copyAddress = async () => {
    if (account) {
      try {
        await navigator.clipboard.writeText(account);
        setCopied(true);
        toast.success("Wallet address copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy address:", err);
      }
    }
  };

  const viewOnExplorer = () => {
    if (account && network) {
      const explorerUrl = network.chainId === '1' 
        ? `https://etherscan.io/address/${account}`
        : network.chainId === '361'
        ? `https://explorer.thetatoken.org/address/${account}`
        : `https://sepolia.etherscan.io/address/${account}`;
      window.open(explorerUrl, '_blank');
    }
  };

  if (!account) return null;

  const truncatedAddress = `${account.slice(0, 6)}...${account.slice(-4)}`;

  return (
    <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-xl z-50 text-card-foreground">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/20 p-2">
              <WalletIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">Connected Wallet</span>
              <span className="text-xs text-muted-foreground">MetaMask</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            onClick={disconnectWallet}
            title="Disconnect Wallet"
          >
            <LogOutIcon className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Network & Balance */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Network</span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${network?.chainId === '1' ? 'bg-green-500' : 'bg-blue-500'}`} />
              <span className="font-medium">{network?.name || 'Unknown'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">{getNetworkIcon(network?.chainId || '')}</span>
              <div className="flex flex-col">
                <span className="text-xs font-medium">{network?.name}</span>
                <span className="text-[10px] text-muted-foreground">Chain ID: {network?.chainId}</span>
              </div>
            </div>
            <NetworkIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Balance</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
              <span>{balance} ETH</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Address & Copy Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Wallet Address</span>
            {copied && (
              <span className="text-[11px] font-semibold text-emerald-500 animate-in fade-in transition-all">
                Copied!
              </span>
            )}
          </div>
          <div className="flex items-center justify-between bg-muted rounded-lg p-2 gap-2">
            <span className="text-xs font-mono font-medium truncate">
              {truncatedAddress}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs flex items-center gap-1 transition-all ${
                  copied ? 'text-emerald-500 bg-emerald-500/10' : 'hover:bg-primary/20'
                }`}
                onClick={copyAddress}
                title="Copy Address"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[11px] font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-primary/20"
                onClick={viewOnExplorer}
                title="View on Explorer"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}