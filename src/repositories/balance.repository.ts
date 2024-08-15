import { Injectable } from "@nestjs/common";
import { ExplorerUnitOfWork as UnitOfWork } from "../unitOfWork";
import { BaseRepository } from "./base.repository";
import { Balance } from "../entities";

export const selectBalancesScript = `
  SELECT * FROM balances
         JOIN
       (
         SELECT address, "tokenAddress", MAX("blockNumber") AS "blockNumber"
         FROM balances
         WHERE
         address = ANY($1)
         AND
         "tokenAddress" = ANY($2)
         GROUP BY address, "tokenAddress"
       ) AS latest_balances
       ON balances.address = latest_balances.address
         AND balances."tokenAddress" = latest_balances."tokenAddress"
         AND balances."blockNumber" = latest_balances."blockNumber";
`;

export const selectBalancesByBlockScript = `
  SELECT *
  FROM balances
         JOIN
       (
         SELECT address, "tokenAddress", MAX("blockNumber") AS "blockNumber"
         FROM balances
         WHERE address = $1 AND "blockNumber" <= $2
         GROUP BY address, "tokenAddress"
       ) AS latest_balances
       ON balances.address = latest_balances.address
         AND balances."tokenAddress" = latest_balances."tokenAddress"
         AND balances."blockNumber" = latest_balances."blockNumber";
`;

@Injectable()
export class BalanceRepository extends BaseRepository<Balance> {
  public constructor(unitOfWork: UnitOfWork) {
    super(Balance, unitOfWork);
  }

  public async getAccountsBalances(addresses: string[], tokenAddresses: string[]): Promise<Balance[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const addressesBuffer = addresses.map((address) => Buffer.from(address.substring(2), "hex"));
    const tokenAddressesBuffer = tokenAddresses.map((tokenAddress) => Buffer.from(tokenAddress.substring(2), "hex"));
    const result = await transactionManager.query(selectBalancesScript, [addressesBuffer, tokenAddressesBuffer]);
    return result.map((item) => {
      return {
        ...item,
        address: "0x" + item.address.toString("hex"),
        tokenAddress: "0x" + item.tokenAddress.toString("hex"),
      };
    });
  }

  public async getAllAddressesByBlock(blockNumber: number, page: number, limit: number = 40000): Promise<string[]> {
    const offset = page * limit;
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(
      `SELECT DISTINCT address FROM balances WHERE "blockNumber" <= $1 order by address asc limit ${limit} offset ${offset};`,
      [blockNumber]
    );
    return result.map((row: any) => "0x" + row.address.toString("hex"));
  }

  public async getAllAddresses(): Promise<Buffer[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const result = await transactionManager.query(`SELECT address FROM balances group by address;`);
    return result.map((row: any) => row.address);
  }

  public async getAccountBalances(address: Buffer): Promise<Balance[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    return await transactionManager.query(selectBalancesScript, [address]);
  }

  public async getAllAccountBalancesByBlock(addresses: String[], blockNumber: number): Promise<Balance[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const addressesBuff = addresses.map((item) => Buffer.from(item.substring(2), "hex"));
    return await transactionManager
      .getRepository(Balance)
      .createQueryBuilder("balance")
      .where("balance.blockNumber = :blockNumber and balance.address = ANY(:addresses)", {
        blockNumber,
        addresses: addressesBuff,
      })
      .getMany();
  }

  public async getAccountBalancesByBlock(address: Buffer, blockNumber: number): Promise<Balance[]> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    return await transactionManager.query(selectBalancesByBlockScript, [address, blockNumber]);
  }

  public async getLatesBlockNumber(): Promise<number> {
    const transactionManager = this.unitOfWork.getTransactionManager();
    const [latestBlockNumber] = await transactionManager.query(`SELECT MAX("blockNumber") FROM balances;`);
    return Number(latestBlockNumber.max);
  }
}
