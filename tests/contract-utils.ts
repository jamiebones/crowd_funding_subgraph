import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  NewCrowdFundingContractCreated,
  OwnershipTransferred
} from "../generated/Contract/Contract"

export function createNewCrowdFundingContractCreatedEvent(
  owner: Address,
  amount: BigInt,
  cloneAddress: Address,
  fundingDetailsId: string
): NewCrowdFundingContractCreated {
  let newCrowdFundingContractCreatedEvent =
    changetype<NewCrowdFundingContractCreated>(newMockEvent())

  newCrowdFundingContractCreatedEvent.parameters = new Array()

  newCrowdFundingContractCreatedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  newCrowdFundingContractCreatedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  newCrowdFundingContractCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "cloneAddress",
      ethereum.Value.fromAddress(cloneAddress)
    )
  )
  newCrowdFundingContractCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "fundingDetailsId",
      ethereum.Value.fromString(fundingDetailsId)
    )
  )

  return newCrowdFundingContractCreatedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent = changetype<OwnershipTransferred>(
    newMockEvent()
  )

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}
