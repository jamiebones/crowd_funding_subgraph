
import { BigInt } from "@graphprotocol/graph-ts";
import {
  NewCrowdFundingContractCreated as NewCrowdFundingContractCreatedEvent
} from "../generated/CrowdFundingFactory/CrowdFundingFactory";

import { DonatedToProject as DonatedToProjectEvent, MilestoneCreated as MilestoneCreatedEvent, MilestoneWithdrawal as MilestoneWithdrawalEvent } from "../generated/templates/CrowdFundingContractForBegiBegi/CrowdFundingContractForBegiBegi";
import { Campaign, CampaignCreator, Donors, Milestone } from "../generated/schema";




export function handleNewCrowdFundingContractCreated(
  event: NewCrowdFundingContractCreatedEvent
): void {
   let newCampaign = Campaign.load(event.params.cloneAddress.toHexString());
   let campaignCreator = CampaignCreator.load(event.params.owner.toHexString());
  if ( newCampaign === null ){
    newCampaign = new Campaign(event.params.cloneAddress.toHexString());
    //details 
    newCampaign.campaignCID = event.params.fundingDetailsId;
    // if ( metadata ){
    //   const value = json.fromBytes(metadata).toObject();
    //   const details = value.get("details");

    //   if ( details ){
    //     newCampaign.details = details.toString();
    //   }
    // }
    newCampaign.owner = event.params.owner.toHexString();
    newCampaign.dateCreated = event.block.timestamp;
    newCampaign.amountSought = event.params.amount;
    newCampaign.campaignRunning = true;
  }
  if (campaignCreator === null){
    campaignCreator = new CampaignCreator(event.params.owner.toHexString());
    campaignCreator.fundingGiven = new BigInt(0);
    campaignCreator.fundingWithdrawn = new BigInt(0); 
}
     //CrowdFundingContract.create(event.params.cloneAddress);
     newCampaign.save();
     campaignCreator.save();
}


export function handleFundsDonated(event: DonatedToProjectEvent ):void {
  //get the campaign we are donating to
  const campaign = Campaign.load(event.transaction.to!.toHexString());
    if ( campaign ){
      //we save the donation in the Donor entity
      //load the donor from the graph if it exists;
      let donor = Donors.load(event.transaction.from.toHexString());
      if ( ! donor ){
        donor = new Donors(event.params.donor.toHexString())
      } 
      donor.amount = event.params.amount;
      donor.campaign = campaign.id;
      donor.date = event.params.date;
      donor.save();
      //get the campaignCreator and add the donation to the campainCreator
      const campaignCreator = CampaignCreator.load(campaign.owner);
      if ( campaignCreator && campaignCreator.fundingGiven ){
        campaignCreator.fundingGiven = campaignCreator.fundingGiven!.plus(event.params.amount);
        campaignCreator.save();
      }
    }
}


export function handleMilestoneCreated(event: MilestoneCreatedEvent ):void {
  const newMilestone = new Milestone(event.transaction.hash.toHexString().concat("-").concat(event.transaction.from.toHexString()))
    const campaign = Campaign.load(event.transaction.to!.toHexString());
    if ( campaign ){
      newMilestone.campaign = campaign.id;
      newMilestone.milestonestatus = "Pending";
      newMilestone.milestoneCID = event.params.milestoneCID;
      //get the details from Bundler
      // if ( metadata ){
      //   const value = json.fromBytes(metadata).toObject();
      //   const details = value.get("details");

      //   if ( details ){
      //     newMilestone.details = details.toString();
      //   }
      // }
      newMilestone.periodToVote = event.params.period;
      newMilestone.dateCreated = event.params.datecreated;

      newMilestone.save();
       //update the campaign with the current milestone
       campaign.currentMilestone = newMilestone.id;
       campaign.save()
    }
}

export function handleFundsWithdrawn(event: MilestoneWithdrawalEvent):void {
  let campaignCreator = CampaignCreator.load(event.params.owner.toHexString());
  if ( campaignCreator && campaignCreator.fundingWithdrawn){
    //increment the amount already withdrawan
    const totalWithdrawal = campaignCreator.fundingWithdrawn!.plus((event.params.amount))
    campaignCreator.fundingWithdrawn = totalWithdrawal;
    campaignCreator.save();
  }

  //set the current milestone to Approved
  //load the milestone and set it to Approved
   let campaign = Campaign.load((event.transaction.to!.toHexString()))

  if ( campaign && campaign.currentMilestone ){
     const currentMilestoneId = campaign.currentMilestone;
     //load the milestone
     const milestone = Milestone.load(currentMilestoneId!);
     if ( milestone && milestone.milestonestatus === "Pending" ){
       //check if the milestonestatus is pending
       //update it to Approved
       milestone.milestonestatus = "Approved";
       milestone.save();
     }
    }
}


//subgraph endpoint: https://api.studio.thegraph.com/query/9399/crowd_funding_begi_begi/v0.0.1