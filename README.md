# DIVA Blockchain Explorer

User Interface to explore the DIVA Blockchain.

See the DIVA Testnet: https://testnet.diva.exchange/

## Configuration
The configuration can be controlled using environment variables.

### HTTP_IP
Default: 127.0.0.1

### HTTP_PORT
Default: 3920

### URL_API
Default: http://localhost:17468

### URL_FEED
Default: ws://localhost:17469

## Contributing
Contributions are very welcome. This is the general workflow:
1. Star and fork the project on https://github.com/diva-exchange/explorer/
2. Pull the forked project to your local developer environment
3. Make your changes, commit and push them
4. Create a new pull request

If you have questions, please just contact us and we will help.

## Deployment

_**Remark:**_ credentials (like username and password, ssh keys or tokens) are needed to deploy packages. The helper scripts are created to support automated deployment but do not contain any credentials.

* Docker: to create docker images, use `bin/create-docker-image.sh`.
* Release packages: use `bin/release.sh` to tag the version and push it to the main branch. Additionally create images and packages and publish them to repositories. 

## Contact the Developers

On [DIVA.EXCHANGE](https://www.diva.exchange) you'll find various options to get in touch with the team.

Talk to us via Telegram [https://t.me/diva_exchange_chat_de]() (English or German).

## Donations

Your donation goes entirely to the project. Your donation makes the development of DIVA.EXCHANGE faster.

XMR: 42QLvHvkc9bahHadQfEzuJJx4ZHnGhQzBXa8C9H3c472diEvVRzevwpN7VAUpCPePCiDhehH4BAWh8kYicoSxpusMmhfwgx

BTC: 3Ebuzhsbs6DrUQuwvMu722LhD8cNfhG1gs

Awesome, thank you!

## License

[AGPLv3](https://github.com/diva-exchange/explorer/blob/main/LICENSE)
