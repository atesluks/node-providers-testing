
import { randomBytes } from "crypto";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// variables
const RUN_N_TIMES = 10;

const multipleCallsTesting = async (provider: any, callsPerSecond: number, funcName: string, params: Array<any> = []) => {
  const len = allAddresses.length;
  const results: Array<number> = new Array(RUN_N_TIMES * callsPerSecond);

  let lastTime: number = 0;

  for(let i = 0; i < RUN_N_TIMES; i++) {
    for(let j = 0; j < callsPerSecond; j++) {
      const index = i * callsPerSecond + j;
      const randomAddr = allAddresses[Math.floor(Math.random() * len)].replace('0x', '');
      params[1][0].data = '0xa89a8884' + '000000000000000000000000' + randomAddr;

      results[index] = Date.now();
      provider[funcName](...params).then((res: any) => {
        // console.log('------- returned: -----');
        // console.log(res);
        // console.log('-------');
        results[index] = Date.now() - results[index];
      }).catch((err: any) => {
        console.log('--- ERROR: ');
        console.log(err);
        console.log('----');
      });
      await new Promise(r => setTimeout(r, 1000 / callsPerSecond));
      // if(lastTime > 0) {
      //   const diff = Date.now() - lastTime;
      //   console.log(diff);
      // }
      // lastTime = Date.now();
    }
  }

  // waiting 1.5 second for all calls to finish
  await new Promise(r => setTimeout(r, 1500));

  return results;
}

const interpretResults = (arr: Array<number>) => {
  arr.sort((a, b) => (a - b));
  
  const len = arr.length;
  const sum = arr.reduce((prevVal, currVal) => prevVal + currVal, 0);

  const results = {
    min: arr[0], 
    max: arr[len - 1], 
    avg: sum / len, 
    median: len % 2 === 1 ? arr[Math.floor(len / 2)] : (arr[((len / 2) - 1)] + arr[(len / 2)]) / 2
  };

  console.log(`\tMin: ${results.min} ms`);
  console.log(`\tMax: ${results.max} ms`);
  console.log(`\tAvg: ${results.avg} ms`);
  console.log(`\tMedian: ${results.median} ms`);

  return results;
}

const test = async(nodeProviders: any, funcName: string, params: Array<any> = []) => {
  const allResults: any = {};
  let results: Array<number>;
  const ns: Array<number> = [1, 2, 16, 24, 32, 160];
  // const ns: Array<number> = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 112, 128, 160, 192];

  for(let j: number = 0; j < ns.length; j++) {
    const n: number = ns[j];

    // For each node provider
    for(let key of Object.keys(nodeProviders)) {
      console.log(`\n🔄 Testing calls of '${funcName}()' requests for the node '${key}', (${n} calls per second) ...`);
      results = await multipleCallsTesting(nodeProviders[key], n, funcName, params);
      allResults[key + '_' + n + '_calls'] = await interpretResults(results);
    }
  }

  return allResults;
}

const printTable = (resultsObj: any) => {
  let resultsText = 'Metric\t\tMin\tMax\tAvg\tMedian\n';

  const keys = Object.keys(resultsObj).sort();

  for(let key of keys) {
    const values = resultsObj[key];
    resultsText += `${key}\t${values.min}\t${values.max}\t${values.avg}\t${values.median}\n`;
  }

  console.log(resultsText);
}

const createProvider = (rpcUrl = "") => {
  // Websocket provider
  if (rpcUrl.startsWith('wss://') || rpcUrl.startsWith('ws://')) {
    return new ethers.providers.WebSocketProvider(rpcUrl);
  }

  // HTTP provider
  if(rpcUrl.includes('@')) {
    let [credentials, url] = rpcUrl.replace('https://', '').replace('http://', '').split('@');
    let [user, password] = credentials.split(':');
    return new ethers.providers.JsonRpcProvider({url: (rpcUrl.includes('https://') ? 'https://' : 'http://') + url, user, password});
  } else {
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  }
}

const main = async() => {
  // Creating network providers based on .env file
  const providers: any = {};
  
  const network = process.env.NETWORK;
  const isPolygon = network === 'polygon';
  
  console.log(`🔄 Setting up providers for ${isPolygon ? 'Polygon mainnet' : 'Amoy testnet'}...`);

  const envVars = isPolygon ? [
    'POLYGON_INHOUSE_1_WS',
    'POLYGON_INHOUSE_1_HTTP',
    'POLYGON_INHOUSE_2_WS', 
    'POLYGON_INHOUSE_2_HTTP',
    'POLYGON_QUICKNODE_WS',
    'POLYGON_QUICKNODE_HTTP',
    'POLYGON_CHAINSTACK_1_WS',
    'POLYGON_CHAINSTACK_1_HTTP',
    'POLYGON_CHAINSTACK_2_WS',
    'POLYGON_CHAINSTACK_2_HTTP'
  ] : [
    'AMOY_INHOUSE_1_WS',
    'AMOY_INHOUSE_1_HTTP',
    'AMOY_INHOUSE_2_WS',
    'AMOY_INHOUSE_2_HTTP',
    'AMOY_QUICKNODE_WS', 
    'AMOY_QUICKNODE_HTTP',
    'AMOY_CHAINSTACK_WS',
    'AMOY_CHAINSTACK_HTTP'
  ];

  for(const envVar of envVars) {
    const envValue = process.env[envVar];
    if(envValue) {
      const providerKey = envVar.toLowerCase();
      console.log(`Adding ${providerKey} provider:`, envValue);
      providers[providerKey] = createProvider(envValue);
    }
  }
  console.log('✅ Done.');

  // Generating random addresses for testing purposes
  const N = 100000;
  console.log(`\nCreating ${N} random addresses...`);
  allAddresses = []

  for(let i: number = 0; i < N; i++) {
    const id = randomBytes(32).toString('hex');
    const privateKey = "0x" + id;
    const wallet = new ethers.Wallet(privateKey);
    allAddresses.push(wallet.address);
    if((i + 1) % 10000 === 0) {
      console.log(Math.round((i + 1) / 1000), '% done.');
    }
  }
  console.log('✅ Done.');

  // Params when calling JSON RPC

  // In this case we call StLedger's function 'getLedgerEntry' with parameter '9c3b5c0ca0773833f0a15784fcac65230392cc5a'
  // const params: [methodName: string, params: Array<any>] = [
  //   'eth_call',
  //   [
  //     {
  //       'to': process.env.NETWORK == 'polygon' ? '0x3D47037A40d01e7BB902b9E49D9249145b542b10' : '0x12D3989cd72f13fB9aE4A236763927f0425128Ab', 
  //       'data': '' // will be added in every test automatically
  //     }, 
  //     'latest'
  //   ]
  // ];

  const params: [methodName: string, params: Array<any>] = [
    'eth_call',
    [
      {
        'to': '0x044BCd8063216E27059fB9299271D5F3b48DA99C', 
        'data': '' // will be added in every test automatically
      }, 
      'latest'
    ]
  ];

  // Launching testing
  const currResult = await test(providers, 'send',  params);

  // Printing results of the testing
  console.log(`\n\n ========= RESULTS FOR TESTING 'getLedgerEntry()' function ========= `);
  printTable(currResult);
}

let allAddresses: Array<string> = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});