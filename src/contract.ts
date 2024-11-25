
import { BigInt, Bytes, dataSource, DataSourceContext, DataSourceTemplate, json } from "@graphprotocol/graph-ts";
import {
  NewCrowdFundingContractCreated as NewCrowdFundingContractCreatedEvent
} from "../generated/CrowdFundingFactory/CrowdFundingFactory";

import { Campaign as CampaignTemplate } from "../generated/templates";

import { DonatedToProject as DonatedToProjectEvent, MilestoneCreated as MilestoneCreatedEvent, 
  MilestoneWithdrawal as MilestoneWithdrawalEvent, MileStoneRejected as MilestoneRejectedEvent, 
  DonationRetrievedByDonor as DonationRetrievedByDonorEvent,
  CampaignEnded as CampaignEndedEvent } from "../generated/templates/Campaign/Campaign";
import { Campaign, CampaignContent, CampaignCreator, Milestone, DonationWithdrawal,
         Donation, MilestoneContent, Statistic  } from "../generated/schema";

const CAMPAIGN_ID_KEY = "campaignID";
const MILESTONE_ID_KEY =  "milestoneID";
const STATS_ID = Bytes.fromUTF8("0x26471bEF27bA75c8965fCD382c89121d5d70B49a");

export function handleNewCrowdFundingContractCreated(
  event: NewCrowdFundingContractCreatedEvent
): void {
   
   let campaignCreator = CampaignCreator.load(event.params.owner.toHexString());
   let stats = Statistic.load(STATS_ID);
   let newCampaign = new Campaign(
    Bytes.fromUTF8(event.params.cloneAddress.toHexString())
   );
    newCampaign.campaignCID = event.params.fundingDetailsId;
    newCampaign.owner = event.params.owner.toHexString();
    newCampaign.dateCreated = event.block.timestamp;
    newCampaign.category = event.params.category;
    newCampaign.amountSought = event.params.amount;
    newCampaign.campaignRunning = true;
    newCampaign.active = true;
    newCampaign.amountRaised = BigInt.fromI32(0);
    newCampaign.contractAddress = event.params.cloneAddress.toHexString();
    newCampaign.projectDuration = event.params.duration;
    newCampaign.save();

    // let hash = newCampaign.campaignCID;
    // let context = new DataSourceContext();
    // context.setBytes(CAMPAIGN_ID_KEY, newCampaign.id);
    // DataSourceTemplate.createWithContext("ArweaveContentCampaign", [hash], context);

    CampaignTemplate.create(event.params.cloneAddress);

    if (!stats){
      stats = new Statistic(STATS_ID);
      stats.totalContracts = BigInt.fromI32(1);
      stats.totalBackers = BigInt.fromI32(0);
      stats.totalFundingRequest = BigInt.fromI32(0);
      stats.totalFundingGiven = BigInt.fromI32(0);
      stats.totalWithdrawals = BigInt.fromI32(0);
    } else{
      stats.totalContracts = stats.totalContracts.plus(BigInt.fromI32(1));
      stats.totalFundingRequest = stats.totalFundingRequest.plus(event.params.amount);
    }

    stats.save();
  
  if (campaignCreator === null){
    campaignCreator = new CampaignCreator(event.params.owner.toHexString());
    campaignCreator.fundingGiven = new BigInt(0);
    campaignCreator.fundingWithdrawn = new BigInt(0); 
    campaignCreator.save();
  }
}


export function handleFundsDonated(event: DonatedToProjectEvent ):void {
  //get the campaign we are donating to
  const stats = Statistic.load(STATS_ID);
  const campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()));
    if ( campaign ){
      let donation = new Donation(Bytes.fromUTF8(event.params.donor.toHexString() 
      + "_" + event.params.date.toString() + "_" + event.params.project.toHexString() ))
      donation.amount = event.params.amount;
      donation.donatingTo = campaign.id;
      donation.date = event.params.date;
      donation.donor = event.params.donor.toHexString();
      donation.save();
  
      campaign.amountRaised =campaign.amountRaised!.plus(event.params.amount);
      campaign.save();
      
      //get the campaignCreator and add the donation to the campainCreator
      const campaignCreator = CampaignCreator.load(campaign.owner);
      if ( campaignCreator){
        campaignCreator.fundingGiven = campaignCreator.fundingGiven!.plus(event.params.amount);
        campaignCreator.save();
      }

      if ( stats ){
        stats.totalBackers = stats.totalBackers.plus(BigInt.fromI32(1));
        stats.totalFundingGiven = stats.totalFundingGiven.plus(event.params.amount);
      }
    }
}

export function handleCampaignEnded(event: CampaignEndedEvent ):void {
    const campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()));
    if ( campaign ){
      campaign.active = false;
      campaign.save();
    }
}


export function handleMilestoneCreated(event: MilestoneCreatedEvent ):void {
  const newMilestone = new Milestone(Bytes.fromUTF8(event.transaction.hash.toHexString().concat("-").concat(event.transaction.from.toHexString())))
    const campaign = Campaign.load(Bytes.fromUTF8(event.transaction.to!.toHexString()));
    if ( campaign ){
      newMilestone.campaign = campaign.id;
      newMilestone.milestonestatus = "Pending";
      newMilestone.milestoneCID = event.params.milestoneCID;
      newMilestone.periodToVote = event.params.period;
      newMilestone.dateCreated = event.params.datecreated;

      newMilestone.save();
       //update the campaign with the current milestone
      campaign.currentMilestone = newMilestone.id;
      campaign.save()
      // let hash = newMilestone.milestoneCID;
      // let context = new DataSourceContext();
      // context.setBytes(MILESTONE_ID_KEY, newMilestone.id);
      // DataSourceTemplate.createWithContext("ArweaveContentMilestone", [hash], context);
    }
}

export function handleFundsWithdrawn(event: MilestoneWithdrawalEvent): void {
  let creatorId = event.params.owner.toHexString();
  let campaignCreator = CampaignCreator.load(creatorId);
  const stats = Statistic.load(STATS_ID);
  if (campaignCreator) {
    campaignCreator.fundingWithdrawn = campaignCreator.fundingWithdrawn!.plus(event.params.amount);
    campaignCreator.save();
  }

  let campaignId = Bytes.fromUTF8(event.transaction.to!.toHexString());
  let campaign = Campaign.load(campaignId);
  
  if (campaign) {
    let milestone = Milestone.load(campaign.currentMilestone!);
    if (milestone && milestone.milestonestatus == "Pending") {
      milestone.milestonestatus = "Approved";
      milestone.save();
    }
  }
  if (stats){
    stats.totalWithdrawals = stats.totalWithdrawals.plus(event.params.amount);
  }
}


export function handleMilestoneRejected(event: MilestoneRejectedEvent):void {
  //set the current milestone to Rejected
   let campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()))
  if ( campaign && campaign.currentMilestone ){
     const currentMilestoneId = campaign.currentMilestone;
     //load the milestone
     const milestone = Milestone.load(currentMilestoneId!);
     if ( milestone && milestone.milestonestatus === "Pending" ){
       //check if the milestonestatus is pending
       //update it to Rejected
       milestone.milestonestatus = "Rejected";
       milestone.save();
     }
    }
}

export function handleDonationRetrievedByDonor(event: DonationRetrievedByDonorEvent):void {
  //set the current milestone to Rejected
   let campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()))
   let donationWithdrawal = new DonationWithdrawal(Bytes.fromUTF8(event.params.project.toHexString() 
   + event.params.donor.toHexString() + event.params.date.toString()))
  if ( campaign ){
     campaign.amountRaised = campaign.amountRaised!.minus(event.params.amountDonated);
     campaign.save();
     donationWithdrawal.amount = event.params.amountReceived;
     donationWithdrawal.donor = event.params.donor.toHexString();
     donationWithdrawal.withdrawingFrom = event.params.project;
     donationWithdrawal.date = event.params.date;
     donationWithdrawal.save();
  }

}

// export function handleCampaignContent(content: Bytes): void {
//   let hash = dataSource.stringParam();
//   let context = dataSource.context();
//   let id = context.getBytes(CAMPAIGN_ID_KEY);
//   let campaignContent = new CampaignContent(id);

//   //campaignContent.content = content.toString()

//   let value = json.fromBytes(content).toObject();
//   let title = value.get("title");
//   let media = value.get("media");
//   let details = value.get("details");

//   campaignContent.campaign = id;
//   if ( title ){
//     campaignContent.title = title.toString();
//   }

//   if ( details ){
//     campaignContent.details = details.toString();
//   }
//  let mediaArray:string[] = [];
//   if ( media ){
//     for (let i=0; i < media.toArray().length; i++ ){
//       const url = media.toArray()[i].toString();
//       mediaArray.push(url)
//     }
//     campaignContent.media = mediaArray;
//   }

//   campaignContent.hash = hash;
//   campaignContent.save();
// }

// export function handleMilestoneContent(content: Bytes): void {
//   let hash = dataSource.stringParam();
//   let context = dataSource.context();
//   let id = context.getBytes(MILESTONE_ID_KEY);
//   let milestoneContent = new MilestoneContent(id);
//   milestoneContent.milestone = id;

//   //milestoneContent.content = content.toString();

//   let value = json.fromBytes(content).toObject();
//   let title = value.get("title");
//   let media = value.get("media");
//   let details = value.get("details");

//   if ( title ){
//     milestoneContent.title = title.toString();
//   }

//   if ( details ){
//     milestoneContent.details = details.toString();
//   }
//  let mediaArray: string[] = [];
//   if ( media ){
//     for (let i=0; i < media.toArray().length; i++ ){
//       const url = media.toArray()[i].toString();
//       mediaArray.push(url)
//     }
//     milestoneContent.media = mediaArray;
//   }

//   milestoneContent.hash = hash;
//   milestoneContent.save();
// }

//https://api.studio.thegraph.com/query/9399/crowd_funding_begi_begi/v0.0.3