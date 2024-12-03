
import { BigInt, Bytes, dataSource, DataSourceContext, DataSourceTemplate, json, log } from "@graphprotocol/graph-ts";
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
   // Comprehensive logging for event details
   log.info('New Crowd Funding Contract Created Event: {}', [
     'Owner: ' + event.params.owner.toHexString(),
     'Clone Address: ' + event.params.cloneAddress.toHexString(),
     'Funding Details ID: ' + event.params.fundingDetailsId.toString(),
     'Category: ' + event.params.category,
     'Amount: ' + event.params.amount.toString(),
     'Duration: ' + event.params.duration.toString(),
     'Block Number: ' + event.block.number.toString()
   ]);
   
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
    newCampaign.backers = BigInt.fromI32(0);
    newCampaign.save();

    log.info('Campaign Created: {}', [
      'Campaign ID: ' + newCampaign.id.toHexString(),
      'Contract Address: ' + newCampaign.contractAddress,
      'Amount Sought: ' + newCampaign.amountSought.toString()
    ]);

    let hash = newCampaign.campaignCID;
    let context = new DataSourceContext();
    context.setBytes(CAMPAIGN_ID_KEY, newCampaign.id);
    DataSourceTemplate.createWithContext("ArweaveContentCampaign", [hash], context);

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
    log.info('Global Statistics Updated: {}', [
      'Total Contracts: ' + stats.totalContracts.toString(),
      'Total Funding Requested: ' + stats.totalFundingRequest.toString()
    ]);
  
  if (campaignCreator === null){
    campaignCreator = new CampaignCreator(event.params.owner.toHexString());
    campaignCreator.fundingGiven = new BigInt(0);
    campaignCreator.fundingWithdrawn = new BigInt(0); 
    campaignCreator.save();

    log.info('New Campaign Creator Added: {}', [
      'Address: ' + event.params.owner.toHexString()
    ]);
  }
}

export function handleFundsDonated(event: DonatedToProjectEvent ):void {
  log.info('Funds Donated Event: {}', [
    'Donor: ' + event.params.donor.toHexString(),
    'Project: ' + event.params.project.toHexString(),
    'Amount: ' + event.params.amount.toString(),
    'Date: ' + event.params.date.toString()
  ]);

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

      log.info('Donation Recorded: {}', [
        'Donation ID: ' + donation.id.toHexString(),
        'Amount: ' + donation.amount.toString(),
        'Donor: ' + donation.donor
      ]);
  
      campaign.amountRaised = campaign.amountRaised!.plus(event.params.amount);
      campaign.backers = campaign.backers.plus(BigInt.fromI32(1));
      campaign.save();
      
      log.info('Campaign Updated After Donation: {}', [
        'Campaign ID: ' + campaign.id.toHexString(),
        'Amount Raised: ' + campaign.amountRaised!.toString(),
        'Total Backers: ' + campaign.backers.toString()
      ]);
      
      const campaignCreator = CampaignCreator.load(campaign.owner);
      if ( campaignCreator){
        campaignCreator.fundingGiven = campaignCreator.fundingGiven!.plus(event.params.amount);
        campaignCreator.save();

        log.info('Campaign Creator Updated: {}', [
          'Address: ' + campaignCreator.id,
          'Funding Given: ' + campaignCreator.fundingGiven!.toString()
        ]);
      }

      if ( stats ){
        stats.totalBackers = stats.totalBackers.plus(BigInt.fromI32(1));
        stats.totalFundingGiven = stats.totalFundingGiven.plus(event.params.amount);
        stats.save();

        log.info('Global Statistics Updated: {}', [
          'Total Backers: ' + stats.totalBackers.toString(),
          'Total Funding Given: ' + stats.totalFundingGiven.toString()
        ]);
      }
    } else {
      log.warning('Donation Event for Non-Existent Campaign: {}', [
        'Project: ' + event.params.project.toHexString()
      ]);
    }
}

export function handleCampaignEnded(event: CampaignEndedEvent ):void {
    log.info('Campaign Ended Event: {}', [
      'Project: ' + event.params.project.toHexString()
    ]);

    const campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()));
    if ( campaign ){
      campaign.active = false;
      campaign.save();

      log.info('Campaign Status Updated: {}', [
        'Campaign ID: ' + campaign.id.toHexString(),
        'Active Status: false'
      ]);
    } else {
      log.warning('End Campaign Event for Non-Existent Campaign: {}', [
        'Project: ' + event.params.project.toHexString()
      ]);
    }
}

export function handleMilestoneCreated(event: MilestoneCreatedEvent ):void {
  log.info('Milestone Created Event: {}', [
    'Transaction Hash: ' + event.transaction.hash.toHexString(),
    'From: ' + event.transaction.from.toHexString(),
    'To: ' + event.transaction.to!.toHexString(),
    'Milestone CID: ' + event.params.milestoneCID.toString(),
    'Period to Vote: ' + event.params.period.toString(),
    'Date Created: ' + event.params.datecreated.toString()
  ]);

  const newMilestone = new Milestone(Bytes.fromUTF8(event.transaction.hash.toHexString().concat("-").concat(event.transaction.from.toHexString())))
  const campaign = Campaign.load(Bytes.fromUTF8(event.transaction.to!.toHexString()));
    if ( campaign ){
      newMilestone.campaign = campaign.id;
      newMilestone.milestonestatus = "Pending";
      newMilestone.milestoneCID = event.params.milestoneCID;
      newMilestone.periodToVote = event.params.period;
      newMilestone.dateCreated = event.params.datecreated;

      newMilestone.save();

      log.info('Milestone Recorded: {}', [
        'Milestone ID: ' + newMilestone.id.toHexString(),
        'Status: Pending',
        'Campaign ID: ' + campaign.id.toHexString()
      ]);
      
      //update the campaign with the current milestone
      campaign.currentMilestone = newMilestone.id;
      campaign.save()

      log.info('Campaign Updated with Current Milestone: {}', [
        'Campaign ID: ' + campaign.id.toHexString(),
        'Current Milestone ID: ' + newMilestone.id.toHexString()
      ]);

      let hash = newMilestone.milestoneCID;
      let context = new DataSourceContext();
      context.setBytes(MILESTONE_ID_KEY, newMilestone.id);
      DataSourceTemplate.createWithContext("ArweaveContentMilestone", [hash], context);
    } else {
      log.warning('Milestone Creation for Non-Existent Campaign: {}', [
        'Transaction To: ' + event.transaction.to!.toHexString()
      ]);
    }
}

export function handleFundsWithdrawn(event: MilestoneWithdrawalEvent): void {
  log.info('Funds Withdrawn Event: {}', [
    'Owner: ' + event.params.owner.toHexString(),
    'Amount: ' + event.params.amount.toString()
  ]);

  let creatorId = event.params.owner.toHexString();
  let campaignCreator = CampaignCreator.load(creatorId);
  const stats = Statistic.load(STATS_ID);
  
  if (campaignCreator) {
    campaignCreator.fundingWithdrawn = campaignCreator.fundingWithdrawn!.plus(event.params.amount);
    campaignCreator.save();

    log.info('Campaign Creator Withdrawal Updated: {}', [
      'Address: ' + campaignCreator.id,
      'Total Withdrawn: ' + campaignCreator.fundingWithdrawn!.toString()
    ]);
  }

  let campaignId = Bytes.fromUTF8(event.transaction.to!.toHexString());
  let campaign = Campaign.load(campaignId);
  
  if (campaign) {
    let milestone = Milestone.load(campaign.currentMilestone!);
    if (milestone && milestone.milestonestatus == "Pending") {
      milestone.milestonestatus = "Approved";
      milestone.save();

      log.info('Milestone Status Updated: {}', [
        'Milestone ID: ' + milestone.id.toHexString(),
        'New Status: Approved'
      ]);
    }
  }

  if (stats){
    stats.totalWithdrawals = stats.totalWithdrawals.plus(event.params.amount);
    stats.save();

    log.info('Global Statistics Updated: {}', [
      'Total Withdrawals: ' + stats.totalWithdrawals.toString()
    ]);
  }
}

export function handleMilestoneRejected(event: MilestoneRejectedEvent):void {
  log.info('Milestone Rejected Event: {}', [
    'Project: ' + event.params.project.toHexString()
  ]);

  let campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()))
  if ( campaign && campaign.currentMilestone ){
     const currentMilestoneId = campaign.currentMilestone;
     const milestone = Milestone.load(currentMilestoneId!);
     if ( milestone && milestone.milestonestatus === "Pending" ){
       milestone.milestonestatus = "Rejected";
       milestone.save();

       log.info('Milestone Status Updated: {}', [
         'Milestone ID: ' + milestone.id.toHexString(),
         'New Status: Rejected',
         'Campaign ID: ' + campaign.id.toHexString()
       ]);
     }
    }
}

export function handleDonationRetrievedByDonor(event: DonationRetrievedByDonorEvent):void {
    //set the current milestone to Rejected
    log.info("handles donation retrieval", ["donation retrieval started"])
     let campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()));
     let stats = Statistic.load(STATS_ID);
     let donationWithdrawal = new DonationWithdrawal(Bytes.fromUTF8(event.params.project.toHexString() 
     + event.params.donor.toHexString() + event.params.date.toString()))
    if ( campaign ){
      let campaignCreator = CampaignCreator.load(campaign.owner);
      if ( campaignCreator ){
        campaignCreator.fundingGiven = campaignCreator.fundingGiven!.minus(event.params.amountDonated);
        campaignCreator.save();
      }
       campaign.amountRaised = campaign.amountRaised!.minus(event.params.amountDonated);
       campaign.save();
       donationWithdrawal.amount = event.params.amountReceived;
       donationWithdrawal.donor = event.params.donor.toHexString();
       campaign.backers = campaign.backers.minus(BigInt.fromI32(1));
       donationWithdrawal.withdrawingFrom = campaign.id;
       donationWithdrawal.date = event.params.date;
       donationWithdrawal.save();
    }
    if (stats){
      stats.totalBackers = stats.totalBackers.minus(BigInt.fromI32(1));
      stats.totalFundingGiven = stats.totalFundingGiven.minus(event.params.amountDonated);
      stats.save();
  
    }

    log.info("handles donation retrieval", ["donation retrieval ended"])
  
  }
  
  export function handleCampaignContent(content: Bytes): void {
    log.info("handlingcampaigncontent", ["campaign content started"])
    let hash = dataSource.stringParam();
    let context = dataSource.context();
    let id = context.getBytes(CAMPAIGN_ID_KEY);
    let campaignContent = new CampaignContent(id);
  
    //campaignContent.content = content.toString()
  
    let value = json.fromBytes(content).toObject();
    let title = value.get("title");
    let media = value.get("media");
    let details = value.get("details");
  
    campaignContent.campaign = id;
    if ( title ){
      campaignContent.title = title.toString();
    }
  
    if ( details ){
      campaignContent.details = details.toString();
    }
   let mediaArray:string[] = [];
    if ( media && media.toArray().length > 0){
      for (let i=0; i < media.toArray().length; i++ ){
        const url = media.toArray()[i].toString();
        mediaArray.push(url)
      }
      campaignContent.media = mediaArray;
    }
  
    campaignContent.hash = hash;
    campaignContent.save();
    log.info("handlingcampaigncontent", ["campaign content ended"])
  }
  
  export function handleMilestoneContent(content: Bytes): void {
    let hash = dataSource.stringParam();
    let context = dataSource.context();
    let id = context.getBytes(MILESTONE_ID_KEY);
    let milestoneContent = new MilestoneContent(id);
    milestoneContent.milestone = id;
  
    //milestoneContent.content = content.toString();
  
    let value = json.fromBytes(content).toObject();
    let title = value.get("title");
    let media = value.get("media");
    let details = value.get("details");
  
    if ( title ){
      milestoneContent.title = title.toString();
    }
  
    if ( details ){
      milestoneContent.details = details.toString();
    }
   let mediaArray: string[] = [];
    if ( media && media.toArray().length > 0 ){
      for (let i=0; i < media.toArray().length; i++ ){
        const url = media.toArray()[i].toString();
        mediaArray.push(url)
      }
      milestoneContent.media = mediaArray;
    }
  
    milestoneContent.hash = hash;
    milestoneContent.save();
  }










// import { BigInt, Bytes, dataSource, DataSourceContext, DataSourceTemplate, json } from "@graphprotocol/graph-ts";
// import {
//   NewCrowdFundingContractCreated as NewCrowdFundingContractCreatedEvent
// } from "../generated/CrowdFundingFactory/CrowdFundingFactory";

// import { Campaign as CampaignTemplate } from "../generated/templates";

// import { DonatedToProject as DonatedToProjectEvent, MilestoneCreated as MilestoneCreatedEvent, 
//   MilestoneWithdrawal as MilestoneWithdrawalEvent, MileStoneRejected as MilestoneRejectedEvent, 
//   DonationRetrievedByDonor as DonationRetrievedByDonorEvent,
//   CampaignEnded as CampaignEndedEvent } from "../generated/templates/Campaign/Campaign";
// import { Campaign, CampaignContent, CampaignCreator, Milestone, DonationWithdrawal,
//          Donation, MilestoneContent, Statistic  } from "../generated/schema";

// const CAMPAIGN_ID_KEY = "campaignID";
// const MILESTONE_ID_KEY =  "milestoneID";
// const STATS_ID = Bytes.fromUTF8("0x26471bEF27bA75c8965fCD382c89121d5d70B49a");

// export function handleNewCrowdFundingContractCreated(
//   event: NewCrowdFundingContractCreatedEvent
// ): void {
   
//    let campaignCreator = CampaignCreator.load(event.params.owner.toHexString());
//    let stats = Statistic.load(STATS_ID);
//    let newCampaign = new Campaign(
//     Bytes.fromUTF8(event.params.cloneAddress.toHexString())
//    );
//     newCampaign.campaignCID = event.params.fundingDetailsId;
//     newCampaign.owner = event.params.owner.toHexString();
//     newCampaign.dateCreated = event.block.timestamp;
//     newCampaign.category = event.params.category;
//     newCampaign.amountSought = event.params.amount;
//     newCampaign.campaignRunning = true;
//     newCampaign.active = true;
//     newCampaign.amountRaised = BigInt.fromI32(0);
//     newCampaign.contractAddress = event.params.cloneAddress.toHexString();
//     newCampaign.projectDuration = event.params.duration;
//     newCampaign.backers = BigInt.fromI32(0);
//     newCampaign.save();

//     let hash = newCampaign.campaignCID;
//     let context = new DataSourceContext();
//     context.setBytes(CAMPAIGN_ID_KEY, newCampaign.id);
//     DataSourceTemplate.createWithContext("ArweaveContentCampaign", [hash], context);

//     CampaignTemplate.create(event.params.cloneAddress);

//     if (!stats){
//       stats = new Statistic(STATS_ID);
//       stats.totalContracts = BigInt.fromI32(1);
//       stats.totalBackers = BigInt.fromI32(0);
//       stats.totalFundingRequest = BigInt.fromI32(0);
//       stats.totalFundingGiven = BigInt.fromI32(0);
//       stats.totalWithdrawals = BigInt.fromI32(0);
//     } else{
//       stats.totalContracts = stats.totalContracts.plus(BigInt.fromI32(1));
//       stats.totalFundingRequest = stats.totalFundingRequest.plus(event.params.amount);
//     }

//     stats.save();
  
//   if (campaignCreator === null){
//     campaignCreator = new CampaignCreator(event.params.owner.toHexString());
//     campaignCreator.fundingGiven = new BigInt(0);
//     campaignCreator.fundingWithdrawn = new BigInt(0); 
//     campaignCreator.save();
//   }
// }


// export function handleFundsDonated(event: DonatedToProjectEvent ):void {
//   //get the campaign we are donating to
//   const stats = Statistic.load(STATS_ID);
//   const campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()));
//     if ( campaign ){
//       let donation = new Donation(Bytes.fromUTF8(event.params.donor.toHexString() 
//       + "_" + event.params.date.toString() + "_" + event.params.project.toHexString() ))
//       donation.amount = event.params.amount;
//       donation.donatingTo = campaign.id;
//       donation.date = event.params.date;
//       donation.donor = event.params.donor.toHexString();
//       donation.save();
  
//       campaign.amountRaised = campaign.amountRaised!.plus(event.params.amount);
//       campaign.backers = campaign.backers.plus(BigInt.fromI32(1));
//       campaign.save();
      
//       //get the campaignCreator and add the donation to the campainCreator
//       const campaignCreator = CampaignCreator.load(campaign.owner);
//       if ( campaignCreator){
//         campaignCreator.fundingGiven = campaignCreator.fundingGiven!.plus(event.params.amount);
//         campaignCreator.save();
//       }

//       if ( stats ){
//         stats.totalBackers = stats.totalBackers.plus(BigInt.fromI32(1));
//         stats.totalFundingGiven = stats.totalFundingGiven.plus(event.params.amount);
//       }
//     }
// }

// export function handleCampaignEnded(event: CampaignEndedEvent ):void {
//     const campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()));
//     if ( campaign ){
//       campaign.active = false;
//       campaign.save();
//     }
// }


// export function handleMilestoneCreated(event: MilestoneCreatedEvent ):void {
//   const newMilestone = new Milestone(Bytes.fromUTF8(event.transaction.hash.toHexString().concat("-").concat(event.transaction.from.toHexString())))
//     const campaign = Campaign.load(Bytes.fromUTF8(event.transaction.to!.toHexString()));
//     if ( campaign ){
//       newMilestone.campaign = campaign.id;
//       newMilestone.milestonestatus = "Pending";
//       newMilestone.milestoneCID = event.params.milestoneCID;
//       newMilestone.periodToVote = event.params.period;
//       newMilestone.dateCreated = event.params.datecreated;

//       newMilestone.save();
//        //update the campaign with the current milestone
//       campaign.currentMilestone = newMilestone.id;
//       campaign.save()
//       let hash = newMilestone.milestoneCID;
//       let context = new DataSourceContext();
//       context.setBytes(MILESTONE_ID_KEY, newMilestone.id);
//       DataSourceTemplate.createWithContext("ArweaveContentMilestone", [hash], context);
//     }
// }

// export function handleFundsWithdrawn(event: MilestoneWithdrawalEvent): void {
//   let creatorId = event.params.owner.toHexString();
//   let campaignCreator = CampaignCreator.load(creatorId);
//   const stats = Statistic.load(STATS_ID);
//   if (campaignCreator) {
//     campaignCreator.fundingWithdrawn = campaignCreator.fundingWithdrawn!.plus(event.params.amount);
//     campaignCreator.save();
//   }

//   let campaignId = Bytes.fromUTF8(event.transaction.to!.toHexString());
//   let campaign = Campaign.load(campaignId);
  
//   if (campaign) {
//     let milestone = Milestone.load(campaign.currentMilestone!);
//     if (milestone && milestone.milestonestatus == "Pending") {
//       milestone.milestonestatus = "Approved";
//       milestone.save();
//     }
//   }
//   if (stats){
//     stats.totalWithdrawals = stats.totalWithdrawals.plus(event.params.amount);
//   }
// }


// export function handleMilestoneRejected(event: MilestoneRejectedEvent):void {
//   //set the current milestone to Rejected
//    let campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()))
//   if ( campaign && campaign.currentMilestone ){
//      const currentMilestoneId = campaign.currentMilestone;
//      //load the milestone
//      const milestone = Milestone.load(currentMilestoneId!);
//      if ( milestone && milestone.milestonestatus === "Pending" ){
//        //check if the milestonestatus is pending
//        //update it to Rejected
//        milestone.milestonestatus = "Rejected";
//        milestone.save();
//      }
//     }
// }

// export function handleDonationRetrievedByDonor(event: DonationRetrievedByDonorEvent):void {
//   //set the current milestone to Rejected
//    let campaign = Campaign.load(Bytes.fromUTF8(event.params.project.toHexString()))
//    let stats = Statistic.load(STATS_ID);
//    let donationWithdrawal = new DonationWithdrawal(Bytes.fromUTF8(event.params.project.toHexString() 
//    + event.params.donor.toHexString() + event.params.date.toString()))
//   if ( campaign ){
//      campaign.amountRaised = campaign.amountRaised!.minus(event.params.amountDonated);
//      campaign.save();
//      donationWithdrawal.amount = event.params.amountReceived;
//      donationWithdrawal.donor = event.params.donor.toHexString();
//      campaign.backers = campaign.backers.minus(BigInt.fromI32(1));
//      donationWithdrawal.withdrawingFrom = campaign.id;
//      donationWithdrawal.date = event.params.date;
//      donationWithdrawal.save();
//   }
//   if (stats){
//     stats.totalBackers = stats.totalBackers.minus(BigInt.fromI32(1));
//     stats.totalFundingGiven = stats.totalFundingGiven.minus(event.params.amountDonated);
//     stats.save();

//   }

// }

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
//   if ( media && media.toArray().length > 0){
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
//   if ( media && media.toArray().length > 0 ){
//     for (let i=0; i < media.toArray().length; i++ ){
//       const url = media.toArray()[i].toString();
//       mediaArray.push(url)
//     }
//     milestoneContent.media = mediaArray;
//   }

//   milestoneContent.hash = hash;
//   milestoneContent.save();
// }

// //https://api.studio.thegraph.com/query/9399/crowd_funding_begi_begi/v0.0.3