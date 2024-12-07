# Crowd Funding SubGraph

This is a subgraph for the Crowdfunding Smart Contract deployed to the Rootstock network. The smart contract is found [here](https://github.com/jamiebones/crowd_funding_begi_begi).

The sub graph index different log events from the smart contract

## Installation

Run ````npm install```` to install dependencies. 

* To run locally, install Ganache CLI and start the CLI. 
* When running locally, the network field of ````subgraph.yaml```` is set to mainnet.
* Start the docker container by running; ````docker-compose up -d````
* After the container starts up and running, run on the terminal; ````npm run create-local```` to create a local subgraph
* Run ````npm run deploy-local```` to deploy the subgraph to the local network running on Ganache
  