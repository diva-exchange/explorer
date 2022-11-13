# DIVA Blockchain Explorer
User Interface to explore the DIVA Blockchain.

See DIVA Testnet on https://testnet.diva.exchange/

## Configuration
The configuration can be controlled using environment variables.

### LOG_LEVEL
Default: warn

Available levels: trace, info, warn, error, critical

### HTTP_IP
Default: 127.0.0.1

### HTTP_PORT
Default: 3920

### URL_API
Default: [http://127.0.0.1:17468](#)

### URL_FEED
Default: [ws://127.0.0.1:17469](#)

## Building
To build a binary on Linux (amd64) within the `build/` folder, use `bin/build.sh`.

## Running
On Linux amd64: build it first, then execute `bin/explorer-linux-amd64`. Set the environment variables (see configuration above) like this `LOG_LEVEL=trace bin/explorer-linux-amd64`.

Docker (all platforms): `docker run -p 3920:3920 -d --name diva-explorer divax/explorer:current`. Adapt the port exposure (`-p`) and the name (`--name`) to your needs. Use `--env` to set the environment variables within the container. IMPORTANT: a docker network is required (see docker docs) to let the explorer communicate with the blockchain backend running in another docker container. For beginners, it might be easier to use the [DIVA Dockerized](https://github.com/diva-exchange/diva-dockerized) project to get started. 

## Deployment
_**Remark:**_ credentials (like username and password, ssh keys or tokens) are needed to deploy packages. The helper scripts are created to support automated deployment but do not contain any credentials.

* Docker: to create docker images, use `bin/create-docker-image.sh`.

## Contributions
Contributions are very welcome. This is the general workflow:

1. Fork from https://github.com/diva-exchange/explorer/
2. Pull the forked project to your local developer environment
3. Make your changes, test, commit and push them
4. Create a new pull request on github.com

It is strongly recommended to sign your commits: https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key

If you have questions, please just contact us (see below).

## Donations
Your donation goes entirely to the project. Your donation makes the development of DIVA.EXCHANGE faster. Thanks a lot.

### XMR
42QLvHvkc9bahHadQfEzuJJx4ZHnGhQzBXa8C9H3c472diEvVRzevwpN7VAUpCPePCiDhehH4BAWh8kYicoSxpusMmhfwgx

![XMR](https://www.diva.exchange/wp-content/uploads/2020/06/diva-exchange-monero-qr-code-1.jpg)

or via https://www.diva.exchange/en/join-in/

### BTC
3Ebuzhsbs6DrUQuwvMu722LhD8cNfhG1gs

![BTC](https://www.diva.exchange/wp-content/uploads/2020/06/diva-exchange-bitcoin-qr-code-1.jpg)

## Contact the Developers
On [DIVA.EXCHANGE](https://www.diva.exchange) you'll find various options to get in touch with the team.

Talk to us via Telegram [https://t.me/diva_exchange_chat_de]() (English or German).

## License
[AGPLv3](https://github.com/diva-exchange/explorer/blob/main/LICENSE)
