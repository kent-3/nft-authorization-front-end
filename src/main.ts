// @ts-nocheck

import { SecretNetworkClient } from "secretjs";
import { sign } from "curve25519-js";
import axios from 'axios';

interface KeplrWindow extends Window {
  keplr: Function,
  getEnigmaUtils(): Function,
  getOfflineSigner(): Function,
  getOfflineSignerOnlyAmino(_:string): Function,
  enable(_:string): Function,
  getAccounts(): Function,
}

declare let window: KeplrWindow;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

while (
  !window.keplr ||
  !window.getEnigmaUtils ||
  !window.getOfflineSignerOnlyAmino
) {
  await sleep(100);
}

let myAddress: string;
let secretjs: SecretNetworkClient;
let signature;

const contractAddress = 'secret1tk808ayrwluck5wk8nssyh6n0fcy23zm96a60m';
const CHAIN_ID = "pulsar-2";
const permitName = "nft-authorization";
const allowedTokens = [contractAddress];
const permissions = ["owner"];

function createOption(value) {
  let el = document.createElement('option');
  el.value = value;
  el.innerHTML = value;
  el.id = value;

  document.getElementById('nfts').appendChild(el);
}
 
window.onload = async () => {
  if (!window.getOfflineSigner || !window.keplr) {
    alert("Please install Keplr extension");
  } else {
  // @ts-expect-error
    if (window.keplr.experimentalSuggestChain) {
      try {
        // Keplr v0.6.4 introduces an experimental feature that supports the feature to suggests the chain from a webpage.
        // cosmoshub-3 is integrated to Keplr so the code should return without errors.
        // The code below is not needed for cosmoshub-3, but may be helpful if you’re adding a custom chain.
        // If the user approves, the chain will be added to the user's Keplr extension.
        // If the user rejects it or the suggested chain information doesn't include the required fields, it will throw an error.
        // If the same chain id is already registered, it will resolve and not require the user interactions.
        // @ts-expect-error
        await window.keplr.experimentalSuggestChain({
          // Chain-id of the Osmosis chain.
          chainId: "pulsar-2",
          // The name of the chain to be displayed to the user.
          chainName: "Pulsar-2 Testnet",
          // TODO RPC endpoint of the chain. In this case we are using blockapsis, as it's accepts connections from any host currently. No Cors limitations.
          rpc: "https://pulsar-2.api.trivium.network:26657",
          // TOOD REST endpoint of the chain.
          rest: "https://pulsar-2.api.trivium.network:1317",
          stakeCurrency: {
            coinDenom: "SCRT",
            coinMinimalDenom: "uscrt",
            coinDecimals: 6,
            coinGeckoId: "secret"
        },
        bip44: {
          coinType: 529,
            },
            bech32Config: {
                bech32PrefixAccAddr: "secret",
                bech32PrefixAccPub: "secretpub",
                bech32PrefixValAddr: "secretvaloper",
                bech32PrefixValPub: "secretvaloperpub",
                bech32PrefixConsAddr: "secretvalcons",
                bech32PrefixConsPub: "secretvalconspub"
            },
            currencies: [{
              coinDenom: "SCRT",
              coinMinimalDenom: "uscrt",
              coinDecimals: 6,
              coinGeckoId: "secret"
            }],
            feeCurrencies: [{
              coinDenom: "SCRT",
              coinMinimalDenom: "uscrt",
              coinDecimals: 6,
              coinGeckoId: "secret"
            }],
            // (Optional) The number of the coin type.
            // This field is only used to fetch the address from ENS.
            // Ideally, it is recommended to be the same with BIP44 path's coin type.
            // However, some early chains may choose to use the Cosmos Hub BIP44 path of '118'.
            // So, this is separated to support such chains.
            coinType: 529,
            // TODO determine default gas prices
            gasPriceStep: {
                low: 0.1,
                average: 0.25,
                high: 0.4
            }
        });
      } catch {
          alert("Failed to suggest the chain");
        }
    } else {
        alert("Please use the recent version of keplr extension"); 
    }

  await window.keplr.enable(CHAIN_ID);

  const keplrOfflineSigner = window.getOfflineSignerOnlyAmino(CHAIN_ID);
  [{ address: myAddress }] = await keplrOfflineSigner.getAccounts();
  console.log(myAddress);

  secretjs = await SecretNetworkClient.create({
    //grpcWebUrl: "http://rpc.pulsar.griptapejs.com:9091/",
    grpcWebUrl: "https://pulsar-2.api.trivium.network:9091/",
    chainId: CHAIN_ID,
    wallet: keplrOfflineSigner,
    walletAddress: myAddress,
    encryptionUtils: window.getEnigmaUtils(CHAIN_ID),
  });

  //get query permit
  const signed = await window.keplr.signAmino(
    CHAIN_ID,
    myAddress,
    {
      chain_id: CHAIN_ID,
      account_number: "0", // Must be 0
      sequence: "0", // Must be 0
      fee: {
        amount: [{ denom: "uscrt", amount: "0" }], // Must be 0 uscrt
        gas: "1", // Must be 1
      },
      msgs: [
        {
          type: "query_permit", // Must be "query_permit"
          value: {
            permit_name: permitName,
            allowed_tokens: allowedTokens,
            permissions: permissions,
          },
        },
      ],
      memo: "", // Must be empty
    },
    {
      preferNoSetFee: true, // Fee must be 0, so hide it from the user
      preferNoSetMemo: true, // Memo must be empty, so hide it from the user
    }
  );
  signature = signed.signature;

  //query
  const tokensQuery = {
    tokens: {
      owner: myAddress,
    }
  }
  
  const permitQuery = {
    with_permit: {
      query: tokensQuery,
      permit: {
        params: {
          permit_name: permitName,
          allowed_tokens: allowedTokens,
          chain_id: CHAIN_ID,
          permissions: permissions,
        },
        signature: signature,
      },
    },
  }
  console.log("Contract: ", contractAddress)
  const { token_list: { tokens: response }} = await secretjs.query.compute.queryContract({
    contractAddress: contractAddress,
    codeHash: "19ccaec86f94e601ba922f3a74e5d8faa2a332dbad14475382ee255e42e8e2e3",
    query: permitQuery
  });

  console.log("RESPONSE", response)
  console.log(response.length)
  document.getElementById('nfts').disabled = false;
  document.getElementById('submit').disabled = false;
  document.getElementById('nfts').innerHTML = '';
  
  for (let i = 0; i < response.length; i++){
    createOption(response[i])
  }



}
}

document.loginForm.onsubmit = async(e) => {
  e.preventDefault();
  document.getElementById('submit').disabled = true;
  const selected = document.getElementById('nfts').value;
  console.log(selected)

  //query
  const privateMetadataQuery = {
    private_metadata: {
      token_id: selected,
      viewer: {
        address: myAddress,
      },
    }
  }
  
  const permitQuery = {
    with_permit: {
      query: privateMetadataQuery,
      permit: {
        params: {
          permit_name: permitName,
          allowed_tokens: allowedTokens,
          chain_id: CHAIN_ID,
          permissions: permissions,
        },
        signature: signature,
      },
    },
  }

  const { private_metadata: { extension: { auth_key: private_key } } } = await secretjs.query.compute.queryContract({
    contractAddress: contractAddress,
    //codeHash: '19ccaec86f94e601ba922f3a74e5d8faa2a332dbad14475382ee255e42e8e2e3',
    query: permitQuery,
  });
  console.log(private_key)
  document.getElementById('submit').disabled = false;

 const uint8key = Uint8Array.from(private_key);
 const message = new Uint8Array([23,65,12,87]);
 console.log(uint8key, message)

  const signed = sign(uint8key, message, /*secureRandom(8, { type: "Uint8Array" })*/);
  console.log(signed.toString())

  var params = new URLSearchParams();
    params.append('signature', signed.toString());
    params.append('nft_id', selected);

  const response = await axios.post(
      `http://localhost:3001/login`,
      params
  );

}

//  //contract function to execute
//  const handleMsg = {
//   change_distribution : {
//       dist_info: {
//           decimal_places_in_rates: 2,
//           royalties: [
//               {
//                   recipient: recipient,
//                   rate: 100
//               }
//           ]
//       },
//   }
// }

// //execute the contract function
// const tx = await secretjs.tx.compute.executeContract(
//   {
//     sender: myAddress,
//     contract: process.env.CONTRACT_ADDRESS,
//     msg: handleMsg
//   },
//   {
//     gasLimit: 35000,
//   },
// );

// console.log(tx);