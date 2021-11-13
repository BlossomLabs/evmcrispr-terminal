import { initializeConnector } from "@web3-react/core";
import { WalletLink } from "@web3-react/walletlink";
import { URLS } from "./network";

export const [walletLink, hooks] = initializeConnector<WalletLink>(
  (actions) =>
    new WalletLink(actions, {
      // @ts-ignore
      url: URLS[1][0],
      appName: "evmcrispr",
    }),
  [1]
);
