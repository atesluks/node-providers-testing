import { randomBytes } from "crypto";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from 'fs';
import * as path from 'path';
import { plot, Plot } from 'nodeplotlib';

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
  // const ns: Array<number> = [1];
  const ns: Array<number> = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 112, 128, 160, 192];

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

const testWithFakeData = async(nodeProviders: any, funcName: string, params: Array<any> = []) => {
  const allResults: any = {};
  const ns: Array<number> = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 112, 128, 160, 192];

  for(let j: number = 0; j < ns.length; j++) {
    const n: number = ns[j];

    // For each node provider
    for(let key of Object.keys(nodeProviders)) {
      console.log(`\n🔄 Testing calls of '${funcName}()' requests for the node '${key}', (${n} calls per second) ...`);
      
      // Generate fake results between 50-200ms
      const results = Array(n * 10).fill(0).map(() => 
        Math.floor(Math.random() * (200 - 50 + 1)) + 50
      );
      
      allResults[key + '_' + n + '_calls'] = await interpretResults(results);
    }
  }

  return allResults;
}

const saveToCSV = (network: string = '', resultsText: string) => {
  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename with current date/time
  const now = new Date();
  const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `${network}_${dateTime}.csv`;
  const filePath = path.join(outputDir, fileName);

  // Write to file
  fs.writeFileSync(filePath, resultsText);
  console.log(`Results saved to: ${filePath}`);
}

const toCsvFormat = (resultsObj: any) => {
  let resultsText = 'Metric,Min,Max,Avg,Median\n';

  const keys = Object.keys(resultsObj).sort((a, b) => {
    // Remove "_calls" suffix and split remaining parts
    const aParts = a.replace('_calls', '').split('_');
    const bParts = b.replace('_calls', '').split('_');
    
    // Get the last parts which contain numbers
    const aNum = parseInt(aParts[aParts.length - 1]);
    const bNum = parseInt(bParts[bParts.length - 1]);
    
    // If base keys (everything except the number) are the same, sort by number
    const aBase = aParts.slice(0, -1).join('_');
    const bBase = bParts.slice(0, -1).join('_');
    if (aBase === bBase) {
      return aNum - bNum;
    }
    
    // Otherwise sort alphabetically
    return aBase.localeCompare(bBase);
  });

  for(let key of keys) {
    const values = resultsObj[key];
    resultsText += `${key},${values.min},${values.max},${values.avg},${values.median}\n`;
  }
  
  return resultsText;
}

const createProvider = (rpcUrl = "") => {
  // Websocket provider
  if (rpcUrl.startsWith('wss://') || rpcUrl.startsWith('ws://')) {
    return new ethers.providers.WebSocketProvider(rpcUrl);
  }

  // HTTP provider
  if(rpcUrl.includes('@')) {
    // If there is basic auth
    let [credentials, url] = rpcUrl.replace('https://', '').replace('http://', '').split('@');
    let [user, password] = credentials.split(':');
    return new ethers.providers.JsonRpcProvider({url: (rpcUrl.includes('https://') ? 'https://' : 'http://') + url, user, password});
  } else {
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  }
}

const generateChart = async (resultsObj: any, network: string = '') => {
  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Extract unique node providers and their call counts
  const providers = new Set<string>();
  const providerData: { [key: string]: { calls: number[], medians: number[] } } = {};
  
  Object.keys(resultsObj).forEach(key => {
    // The key format is: providerName_number_calls
    // We need to extract everything before the last number
    const parts = key.split('_');
    // Find the last number in the parts array
    let lastNumberIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!isNaN(Number(parts[i]))) {
        lastNumberIndex = i;
        break;
      }
    }
    
    if (lastNumberIndex > 0) {
      // Join all parts before the last number to get the full provider name
      const provider = parts.slice(0, lastNumberIndex).join('_');
      const calls = parseInt(parts[lastNumberIndex]);
      providers.add(provider);

      // Initialize provider data if not exists
      if (!providerData[provider]) {
        providerData[provider] = { calls: [], medians: [] };
      }

      // Add the call count and median time
      providerData[provider].calls.push(calls);
      providerData[provider].medians.push(resultsObj[key].median);
    }
  });

  // Split providers into HTTP and WS groups
  const httpProviders = Array.from(providers).filter(p => p.toLowerCase().includes('http'));
  const wsProviders = Array.from(providers).filter(p => p.toLowerCase().includes('ws'));

  // Function to generate chart HTML
  const generateChartHTML = (providerGroup: string[], title: string) => {
    const traces: Plot[] = providerGroup.sort().map(provider => {
      // Sort the data by call count
      const sortedIndices = providerData[provider].calls
        .map((_, index) => index)
        .sort((a, b) => providerData[provider].calls[a] - providerData[provider].calls[b]);

      const sortedCalls = sortedIndices.map(i => providerData[provider].calls[i]);
      const sortedMedians = sortedIndices.map(i => providerData[provider].medians[i]);

      return {
        x: sortedCalls,
        y: sortedMedians,
        type: 'scatter',
        mode: 'lines+markers',
        name: provider,
        line: {
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`
        }
      };
    });

    const layout = {
      title: `${title} - ${network.toUpperCase()} Network`,
      xaxis: {
        title: 'Number of Calls per Second',
        type: 'linear',
        autorange: true
      },
      yaxis: {
        title: 'Median Response Time (ms)',
        type: 'linear',
        autorange: true
      },
      showlegend: true,
      legend: {
        x: 1,
        xanchor: 'right',
        y: 1
      }
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} Performance Chart</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <style>
            body { margin: 0; padding: 20px; }
            #plot { width: 100%; height: 800px; }
          </style>
        </head>
        <body>
          <div id="plot"></div>
          <script>
            const data = ${JSON.stringify(traces)};
            const layout = ${JSON.stringify(layout)};
            Plotly.newPlot('plot', data, layout);
          </script>
        </body>
      </html>
    `;
  };

  // Generate and save HTTP chart
  const now = new Date();
  const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  const httpFileName = `${network}_${dateTime}_http_chart.html`;
  const httpFilePath = path.join(outputDir, httpFileName);
  fs.writeFileSync(httpFilePath, generateChartHTML(httpProviders, 'HTTP Providers'));
  console.log(`HTTP Chart saved to: ${httpFilePath}`);

  // Generate and save WS chart
  const wsFileName = `${network}_${dateTime}_ws_chart.html`;
  const wsFilePath = path.join(outputDir, wsFileName);
  fs.writeFileSync(wsFilePath, generateChartHTML(wsProviders, 'WebSocket Providers'));
  console.log(`WS Chart saved to: ${wsFilePath}`);

  console.log('\nOpen these files in a web browser to view the charts.');
};

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
    'POLYGON_AZURE_WS',
    'POLYGON_AZURE_HTTP',
  ] : [
    'AMOY_INHOUSE_1_WS',
    'AMOY_INHOUSE_1_HTTP',
    'AMOY_INHOUSE_2_WS',
    'AMOY_INHOUSE_2_HTTP',
    'AMOY_QUICKNODE_WS', 
    'AMOY_QUICKNODE_HTTP',
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
  // const N = 100;
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
        'to': '0xf4ffd2261c8Ef02806f99336554ebf6609E298a5', 
        'data': '' // will be added in every test automatically
      }, 
      'latest'
    ]
  ];

  // Launching testing
  const currResult = await test(providers, 'send',  params);
  // const currResult = await testWithFakeData(providers, 'send',  params);

  // Printing results of the testing
  console.log(`\n\n ========= RESULTS FOR TESTING 'getLedgerEntry()' function ========= `);
  const resultsText = toCsvFormat(currResult);

  saveToCSV(network, resultsText);
  
  // Generate and save chart
  await generateChart(currResult, network);

  process.exit(0);
}

let allAddresses: Array<string> = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});