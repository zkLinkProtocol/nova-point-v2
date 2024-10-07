import { Staked } from '../generated/StablecoinFarm/StablecoinFarm';
import { TransferEvent, UserStake } from '../generated/schema';
import { TargetProcessed } from '../generated/ActionExecutor/ActionExecutor';
import { IToken, NATIVE_ADDRESS, STABLE_POOL_TOKENS } from './constants';
import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { ERC20 } from '../generated/ActionExecutor/ERC20';

export function handleStaked (event: Staked): void {
  const id = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  let stake = new UserStake(id);

  stake.user = event.params.user;
  stake.pid = event.params.pid;
  stake.amount = event.params.amount;
  stake.timestamp = event.block.timestamp;
  stake.blocknumber = event.block.number;

  stake.save();
}

export function handleActionTarget (event: TargetProcessed): void {
  let entity = new TransferEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString());

  const toTokenAddress = event.params.toTokenAddress.toHex().toLowerCase();

  let decimalPrice = BigDecimal.zero();
  let toTokenDecimals = getTokenDecimals(toTokenAddress);

  const fromTokenAddress = event.params.fromTokenAddress.toHex().toLowerCase();
  const fromTokenData = getTokenInfo(fromTokenAddress);

  if (fromTokenData && toTokenDecimals) {
    const fromAmount = new BigDecimal(event.params.fromAmount);
    const tokenDecimals = new BigDecimal(BigInt.fromI32(10).pow(fromTokenData.decimals));
    const sumInUsd = fromAmount.div(tokenDecimals);

    decimalPrice = new BigDecimal(
      BigInt.fromI32(10).pow(toTokenDecimals)
    )
      .times(sumInUsd)
      .div(new BigDecimal(event.params.resultAmount));
  }

  entity.timestamp = event.block.timestamp;
  entity.userAddress = event.params.recipient;
  entity.contractAddress = event.address;
  entity.tokenAddress = event.params.toTokenAddress;
  entity.quantity = event.params.resultAmount;
  entity.txHash = event.transaction.hash;
  entity.nonce = event.logIndex.toString();
  entity.blockNumber = event.block.number;
  entity.price = decimalPrice.truncate(2);
  entity.decimals = toTokenDecimals;

  entity.save();
}

export function getTokenInfo (tokenAddress: string): IToken | null {
  let tokenInfo: IToken | null = null;

  for (let i = 0; i < STABLE_POOL_TOKENS.length; i++) {
    if (STABLE_POOL_TOKENS[i].address == tokenAddress) {
      tokenInfo = STABLE_POOL_TOKENS[i];
      break;
    }
  }

  return tokenInfo;
}

function getTokenDecimals (address: string): u8 {
  if(isNative(address)) {
    return 18;
  }

  let token = ERC20.bind(Address.fromString(address));


  let decimals = token.try_decimals();

  if (decimals.reverted) {
    return 0;
  }

  return u8(decimals.value);
}

function isNative (address: string): boolean {
  return address.toLowerCase() == NATIVE_ADDRESS;
}
