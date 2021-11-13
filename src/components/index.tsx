import { useCallback, useEffect, useState } from "react";
import AceEditor from "react-ace";
import { providers } from "ethers";

import "ace-builds/src-noconflict/mode-jade";
import "ace-builds/src-noconflict/theme-vibrant_ink";

import { Connector } from "@web3-react/types";
import { Web3ReactHooks } from "@web3-react/core";
import { BigNumber } from "@ethersproject/bignumber";
import { formatEther } from "@ethersproject/units";
import { Magic } from "@web3-react/magic";
import { Network } from "@web3-react/network";
import { WalletConnect } from "@web3-react/walletconnect";
import { Frame } from "@web3-react/frame";
import { MetaMask } from "@web3-react/metamask";
import { WalletLink } from "@web3-react/walletlink";

import { evmcl, EVMcrispr } from "@1hive/evmcrispr";

import { connectors } from "../connectors";

const IPFS_GATEWAY = "https://ipfs.blossom.software/ipfs/";

function getName(connector: Connector) {
  if (connector instanceof Frame) {
    return "Frame (Experimental)";
  } else if (connector instanceof Magic) {
    return "Magic (Experimental)";
  } else if (connector instanceof MetaMask) {
    return "MetaMask";
  } else if (connector instanceof Network) {
    return "Network";
  } else if (connector instanceof WalletConnect) {
    return "WalletConnect";
  } else if (connector instanceof WalletLink) {
    return "WalletLink";
  } else {
    return "Unknown";
  }
}

function Status({
  connector,
  hooks: { useChainId, useAccounts, useError },
}: {
  connector: Connector;
  hooks: Web3ReactHooks;
}) {
  const chainId = useChainId();
  const accounts = useAccounts();
  const error = useError();

  const connected = Boolean(chainId && accounts);

  return (
    <div>
      <b>{getName(connector)}</b>
      <br />
      {error ? (
        <>
          🛑 {error.name ?? "Error"}: {error.message}
        </>
      ) : connected ? (
        <>✅ Connected</>
      ) : (
        <>⚠️ Disconnected</>
      )}
    </div>
  );
}

function ChainId({ hooks: { useChainId } }: { hooks: Web3ReactHooks }) {
  const chainId = useChainId();

  return <div>Chain Id: {chainId ? <b>{chainId}</b> : "-"}</div>;
}

function useBalances(
  provider?: ReturnType<Web3ReactHooks["useProvider"]>,
  accounts?: string[]
): BigNumber[] | undefined {
  const [balances, setBalances] = useState<BigNumber[] | undefined>();

  useEffect(() => {
    if (provider && accounts?.length) {
      let stale = false;

      Promise.all(accounts.map((account) => provider.getBalance(account))).then(
        (balances) => {
          if (!stale) {
            setBalances(balances);
          }
        }
      );

      return () => {
        stale = true;
        setBalances(undefined);
      };
    }
  }, [provider, accounts]);

  return balances;
}

function Accounts({
  useAnyNetwork,
  hooks: { useAccounts, useProvider, useENSNames },
}: {
  useAnyNetwork: boolean;
  hooks: Web3ReactHooks;
}) {
  const provider = useProvider(useAnyNetwork ? "any" : undefined);
  const accounts = useAccounts();
  const ENSNames = useENSNames(provider);

  const balances = useBalances(provider, accounts);

  return (
    <div>
      Accounts:
      {accounts === undefined
        ? " -"
        : accounts.length === 0
        ? " None"
        : accounts?.map((account, i) => (
            <ul
              key={account}
              style={{
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <b>{ENSNames?.[i] ?? account}</b>
              {balances?.[i] ? ` (Ξ${formatEther(balances[i])})` : null}
            </ul>
          ))}
    </div>
  );
}

function Connect({
  connector,
  hooks: { useChainId, useIsActivating, useError, useIsActive },
}: {
  connector: Connector;
  hooks: Web3ReactHooks;
}) {
  const chainId = useChainId();
  const isActivating = useIsActivating();
  const error = useError();

  const active = useIsActive();

  const [activateArgs, setActivateArgs] = useState<any[]>([]);

  if (error) {
    return (
      <button
        onClick={() => {
          connector.activate();
        }}
      >
        Try Again?
      </button>
    );
  } else if (active) {
    return (
      <>
        {connector instanceof Network ? (
          <label>
            Network:
            <select
              value={`${chainId}`}
              onChange={(event) =>
                connector.activate(Number(event.target.value))
              }
            >
              <option value="1">Mainnet</option>
              <option value="3">Ropsten</option>
              <option value="4">Rinkeby</option>
              <option value="5">Görli</option>
              <option value="42">Kovan</option>
              <option value="10">Optimism</option>
              <option value="42161">Arbitrum</option>
            </select>
          </label>
        ) : null}
        <button
          onClick={() => {
            if (connector.deactivate) {
              connector.deactivate();
            }
          }}
          disabled={connector.deactivate ? false : true}
        >
          {connector.deactivate ? "Disconnect" : "Connected"}
        </button>
      </>
    );
  } else {
    return (
      <>
        {connector instanceof Magic ? (
          <label>
            Email:{" "}
            <input
              type="email"
              name="email"
              onChange={(event) =>
                setActivateArgs([{ email: event.target.value }])
              }
            />
          </label>
        ) : null}
        <button
          onClick={() => {
            if (!isActivating) {
              connector.activate(...activateArgs);
            }
          }}
          disabled={isActivating ? true : false}
        >
          {isActivating ? "Connecting..." : "Activate"}
        </button>
      </>
    );
  }
}

function Forward({
  useAnyNetwork,
  hooks: { useChainId, useIsActivating, useProvider, useAccounts },
  code,
}: {
  useAnyNetwork: boolean;
  hooks: Web3ReactHooks;
  code: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const chainId = useChainId();
  const provider = useProvider(useAnyNetwork ? "any" : undefined);
  const isActivating = useIsActivating();
  const accounts = useAccounts();

  const [, dao, _path, , , context] =
    code
      .split("\n")[0]
      .match(/^connect ([\w.-]+)(( [\w.\-:]+)*)( @context:(.+))?$/) ?? [];

  function client(chainId: number) {
    return {
      1: "client.aragon.org",
      4: "rinkeby.client.aragon.org",
      100: "xdai.aragon.blossom.software",
    }[chainId];
  }

  const handleOnForward = useCallback(
    async (signer: providers.JsonRpcSigner) => {
      setError("");
      setLoading(true);

      try {
        if (!dao || !_path) {
          console.log(dao, _path);
          throw new Error("First line must be `connect <dao> <...path>`");
        }
        if (!/0x[0-9A-Fa-f]+/.test(dao)) {
          throw new Error(
            "ENS not supported yet, please introduce the address of the DAO."
          );
        }

        const path = _path
          .trim()
          .split(" ")
          .map((id) => id.trim());

        const _code = code.split("\n").slice(1).join("\n");

        const evmcrispr = await EVMcrispr.create(dao, signer, {
          ipfsGateway: IPFS_GATEWAY,
        });

        await evmcrispr.forward(evmcl`${_code}`, path, { context });

        const lastApp = evmcrispr.app(path.slice(-1)[0]);

        window.location.href = chainId
          ? `https://${client(chainId)}/#/${dao}/${lastApp}`
          : "";
      } catch (e: any) {
        console.error(e);
        if (
          e.message.startsWith("transaction failed") &&
          /^0x[0-9a-f]{64}$/.test(e.message.split('"')[1])
        ) {
          setError(
            `Transaction failed, watch in block explorer ${
              e.message.split('"')[1]
            }`
          );
        } else {
          setError(e.message);
        }
      }
      setLoading(false);
    },
    [_path, chainId, code, context, dao]
  );

  return (
    <>
      {provider && accounts?.length && (
        <button
          onClick={() => handleOnForward(provider.getSigner())}
          disabled={isActivating ? true : false}
        >
          {`${loading ? "Forwarding" : "Forward"} from ${accounts[0].substr(
            0,
            4
          )}..${accounts[0].substr(-4)}`}
        </button>
      )}
      {error && <div style={{ color: "red" }}>{"Error: " + error}</div>}
    </>
  );
}

export function Main() {
  const [code, setCode] = useState(
    `# Available commands:

connect <dao> <...path> [@context:https://yoursite.com]
install <repo> [...initParams]
grant <entity> <app> <role> [permissionManager]
revoke <entity> <app> <role>
exec <app> <methodName> [...params]
act <agent> <targetAddr> <methodSignature> [...params]

# Example (unwrap wxDAI):

connect 1hive token-manager voting
install agent:new-agent
grant voting agent:new-agent TRANSFER_ROLE voting
exec vault transfer -token:tokens.honeyswap.org:WXDAI agent:new-agent 100e18
act agent:new-agent -token:tokens.honeyswap.org:WXDAI withdraw(uint256) 100e18
exec agent:new-agent transfer -token:XDAI vault 100e18
`
  );

  return (
    <div
      style={{ display: "flex", flexFlow: "wrap", fontFamily: "sans-serif" }}
    >
      <AceEditor
        width="100%"
        mode="jade"
        theme="github"
        name="code"
        value={code}
        onLoad={() => console.log("load")}
        onChange={setCode}
        fontSize={20}
        showPrintMargin={true}
        showGutter={true}
        highlightActiveLine={true}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
        }}
      />
      {connectors.map(([connector, hooks], i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "20rem",
            padding: "1rem",
            margin: "1rem",
            overflow: "auto",
            border: "1px solid",
            borderRadius: "1rem",
          }}
        >
          <div>
            <Status connector={connector} hooks={hooks} />
            <br />
            <ChainId hooks={hooks} />
            <Accounts
              useAnyNetwork={connector instanceof WalletConnect}
              hooks={hooks}
            />
            <br />
          </div>
          <Connect connector={connector} hooks={hooks} />
          <Forward
            useAnyNetwork={connector instanceof WalletConnect}
            hooks={hooks}
            code={code}
          />
        </div>
      ))}
    </div>
  );
}
