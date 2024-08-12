export const methodNames = {
    registerDomains: '0x3a99d4eb',
    renewDomain: '0x9bb827cb'
}

export const graphQuery = (startBlock: number, endBlock: number, pageSize: number, skip: number) => `
    query MyQuery {
        mintedDomains(where: { blockNumber_gte:${startBlock}, blockNumber_lte:${endBlock} }, first: ${pageSize}, skip: ${skip}) {
            id
            blockNumber,
            expiry,
            blockTimestamp,
            domainName,
            owner,
            transactionHash,
            tokenId,
        }
        renewedDomains(where: { blockNumber_gte:${startBlock}, blockNumber_lte:${endBlock} }, first: ${pageSize}, skip: ${skip}) {
            id
            blockNumber,
            expiry,
            blockTimestamp,
            transactionHash,
            tokenId
        }
    }
`