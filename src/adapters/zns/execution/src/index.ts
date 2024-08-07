import { UserTxData } from './sdk/types';
import ZNSNovaPointer from './sdk/lib';

export const getUserTransactionData = async (startBlock: number, endBlock: number): Promise<UserTxData[]> => {
    console.log(`Get Tx Data From ${startBlock} to ${endBlock}`);

    const novapointer = new ZNSNovaPointer("https://rpc.zklink.io", "0xe0971a2B6E34bd060866081aE879630e83C4A0BD")
    await novapointer.initialize()

    const userTxDataCollection: Array<UserTxData> = []

    // collect block list
    const blocks = []
    for (let i = startBlock; i <= endBlock; i++) {
        blocks.push(i)
    }

    // main process
    for await (const block of blocks) {
        const txDataSet = await novapointer.getZNSInteractionByBlock(block)
        userTxDataCollection.push(...txDataSet)
    }

    return userTxDataCollection
};