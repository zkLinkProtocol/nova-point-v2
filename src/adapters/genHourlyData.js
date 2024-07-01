const fs = require("fs");
const path = require("path");

const { write } = require("fast-csv");

// Get the folder name from command line arguments
const folderName = process.argv[2];
const curBlockNumber = process.argv[3];

if (!folderName) {
  console.error("Folder name not provided. Please provide the folder name as an argument.");
  process.exit(1);
}

if (!curBlockNumber) {
  console.error("curBlockNumber not provided. Please provide the curBlockNumber as an argument.");
  process.exit(1);
}

// Get the absolute path of the provided folder
const folderPath = path.resolve(folderName);

// Check if the provided folder exists
if (!fs.existsSync(folderPath)) {
  console.error(`Folder '${folderPath}' does not exist.`);
  process.exit(1);
}

// Check if the provided folder contains index.ts file
const indexPath = path.join(folderPath, "execution/dist/index.js");
if (!fs.existsSync(indexPath)) {
  console.error(`Folder '${folderName}' does not contain index.ts file.`);
  process.exit(1);
}

// Import the funct function from the provided folder
const { getUserTVLData } = require(indexPath);

if (getUserTVLData) {
  getUserTVLData(Number(curBlockNumber)).then((result) => {
    const keyMap = new Map();
    try {
      // check : item of result must be an object with keys: address, poolAddress, tokenAddress, blockNumber, balance
      for (const item of result) {
        const key = item.userAddress + item.tokenAddress + item.poolAddress;
        if (
          item.userAddress === undefined ||
          item.poolAddress === undefined ||
          item.tokenAddress === undefined ||
          item.balance === undefined ||
          item.timestamp === undefined
        ) {
          console.error("getUserTVLData Invalid item:", item);
          console.error("Exiting the process due to invalid item, please fix the issue and try again.");
          process.exit(1);
        }

        if (keyMap.get(key)) {
          console.error("getUserTVLData Duplicate key: ", key, item, keyMap.get(key));
          console.error("Exiting the process due to duplicate key, please fix the issue and try again.");
          process.exit(1);
        } else {
          keyMap.set(key, item);
        }
      }

      const allCsvRows = result.map((item) => {
        return {
          userAddress: item.userAddress,
          poolAddress: item.poolAddress,
          tokenAddress: item.tokenAddress,
          blockNumber: item.blockNumber,
          balance: item.balance,
          timestamp: item.timestamp,
        };
      });

      // Accumulate CSV rows for all blocks
      const file = `${folderName}/data/hourly.${curBlockNumber}.csv`;
      fs.mkdirSync(`${folderName}/data`, { recursive: true });

      const ws = fs.createWriteStream(file, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`${file} has been written.`);
        });
      // Clear the accumulated CSV rows
      allCsvRows.length = 0;

      // Write to file when batch size is reached or at the end of loop
    } catch (error) {
      console.error(`An error occurred for block ${curBlockNumber}:`, error);
    }
  });
}
