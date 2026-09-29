export const CONTRACT_ADDRESS = "0x03362574ce6c22A58b23eA42Aa7A6f4dFf4Ec4fd";

export const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "newMessage",
        "type": "string"
      }
    ],
    "name": "setMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "initialMessage",
        "type": "string"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "message",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface KnownNetwork {
  name: string;
  symbol: string;
  explorer: string;
  rpcUrl?: string;
}

export const TARGET_NETWORK: KnownNetwork = {
  name: "Sepolia Testnet",
  symbol: "SEP",
  explorer: "https://sepolia.etherscan.io",
  rpcUrl: "https://rpc.sepolia.org"
};

export const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex
