"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Explorer = void 0;
const compression_1 = __importDefault(require("compression"));
const http_errors_1 = __importDefault(require("http-errors"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("./logger");
const pug_1 = __importDefault(require("pug"));
const simple_get_1 = __importDefault(require("simple-get"));
const i2p_sam_1 = require("@diva.exchange/i2p-sam/dist/i2p-sam");
class Explorer {
    constructor(config) {
        this.webSocket = {};
        this.height = 0;
        this.config = config;
        this.app = (0, express_1.default)();
        this.app.set('x-powered-by', false);
        this.app.use((0, compression_1.default)());
        this.app.use(express_1.default.static(path_1.default.join(config.path_app, 'static')));
        this.app.use(express_1.default.json());
        this.app.use(async (req, res, next) => {
            await this.routes(req, res, next);
        });
        this.app.get('/favicon.ico', (req, res) => res.sendStatus(204));
        this.app.use((req, res, next) => {
            next((0, http_errors_1.default)(404));
        });
        this.app.use((err, req, res, next) => {
            this.error(err, req, res, next);
        });
        this.httpServer = http_1.default.createServer(this.app);
        this.httpServer.on('listening', () => {
            logger_1.Logger.info(`HttpServer listening on ${this.config.http_ip}:${this.config.http_port}`);
        });
        this.httpServer.on('close', () => {
            logger_1.Logger.info(`HttpServer closing on ${this.config.http_ip}:${this.config.http_port}`);
        });
        this.webSocketServer = new ws_1.default.Server({
            server: this.httpServer,
            clientTracking: true,
        });
        this.webSocketServer.on('close', () => {
            logger_1.Logger.info('WebSocketServer closing');
        });
    }
    listen() {
        this.httpServer.listen(this.config.http_port, this.config.http_ip);
        this.initFeed();
        return this;
    }
    async shutdown() {
        if (this.webSocketServer) {
            await new Promise((resolve) => {
                this.webSocketServer.clients.forEach((ws) => {
                    ws.close(1000);
                });
                this.webSocketServer.close(() => {
                    resolve(true);
                });
                setTimeout(() => {
                    resolve(true);
                }, 2000);
            });
        }
        if (this.httpServer) {
            await new Promise((resolve) => {
                this.httpServer.close(() => {
                    resolve(true);
                });
                setTimeout(() => {
                    resolve(true);
                }, 2000);
            });
        }
    }
    initFeed() {
        this.webSocket = new ws_1.default(this.config.url_feed, {
            followRedirects: false,
        });
        this.webSocket.on('close', () => {
            this.webSocket = {};
            setTimeout(() => {
                this.initFeed();
            }, 1000);
        });
        this.webSocket.on('message', (message) => {
            let block = {};
            let html = '';
            try {
                block = JSON.parse(message.toString());
                this.height = block.height > this.height ? block.height : this.height;
                html = pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/blocklist.pug'), {
                    blocks: [
                        {
                            height: block.height,
                            lengthTx: block.tx.length,
                        },
                    ],
                });
            }
            catch (e) {
                return;
            }
            if (html.length) {
                this.webSocketServer.clients.forEach((ws) => {
                    ws.send(JSON.stringify({ heightChain: this.height, heightBlock: block.height, html: html }));
                });
            }
        });
    }
    async routes(req, res, next) {
        const v = this.config.VERSION;
        const _p = req.path.replace(/\/+$/, '');
        switch (_p) {
            case '':
            case '/ui/blocks':
                res.end(pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/blocks.pug'), { version: v }));
                break;
            case '/ui/state':
                res.end(pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/state.pug'), { version: v }));
                break;
            case '/ui/network':
                res.end(pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/network.pug'), { version: v }));
                break;
            case '/blocks':
                await this.getBlocks(req, res);
                break;
            case '/block':
                await this.getBlock(req, res);
                break;
            case '/state':
                await this.getState(req, res);
                break;
            case '/network':
                await this.getNetwork(req, res);
                break;
            default:
                next();
        }
    }
    async getBlocks(req, res) {
        const pagesize = Math.floor(Number(req.query.pagesize || 0) >= 1 ? Number(req.query.pagesize) : 1);
        const page = Math.floor(Number(req.query.page || 0) >= 1 ? Number(req.query.page) : 1);
        const q = (req.query.q || '').toString();
        const url = this.config.url_api + (q.length ? `/blocks/search/${q}` : `/blocks/page/${page}/${pagesize}`);
        let arrayBlocks = [];
        try {
            arrayBlocks = (await this.getFromApi(url))
                .map((b) => {
                this.height = b.height > this.height ? b.height : this.height;
                return {
                    height: b.height,
                    lengthTx: b.tx.length,
                };
            })
                .reverse();
        }
        catch (e) {
            res.json({});
            return;
        }
        const html = pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/blocklist.pug'), {
            blocks: arrayBlocks,
        });
        res.json({
            blocks: arrayBlocks,
            page: page,
            height: this.height,
            html: html,
        });
    }
    async getBlock(req, res) {
        const id = Math.floor(Number(req.query.q || 0) >= 1 ? Number(req.query.q) : 1);
        const url = this.config.url_api + `/block/${id}`;
        try {
            res.json(await this.getFromApi(url));
        }
        catch (e) {
            res.json({});
            return;
        }
    }
    async getState(req, res) {
        try {
            res.json((await this.getFromApi(this.config.url_api + '/state/search/' + (req.query.q || '').toString()))
                .sort((a, b) => {
                return a.key > b.key ? 1 : -1;
            })
                .map((data) => {
                let v = '';
                try {
                    v = JSON.stringify(JSON.parse(data.value), null, ' ');
                }
                catch (error) {
                    v = data.value;
                }
                return {
                    html: pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/statelist.pug'), {
                        k: data.key,
                        v: v,
                    }),
                };
            }));
        }
        catch (e) {
            res.json({});
        }
    }
    async getNetwork(req, res) {
        try {
            const filter = (req.query.q || '').toString().toLowerCase();
            res.json((await this.getFromApi(this.config.url_api + '/network'))
                .sort((a, b) => (a.publicKey > b.publicKey ? 1 : -1))
                .map((data) => {
                const http = data.http.indexOf('.') === -1 ? (0, i2p_sam_1.toB32)(data.http) + '.b32.i2p' : data.http;
                const udp = data.udp.indexOf('.') === -1 ? (0, i2p_sam_1.toB32)(data.udp) + '.b32.i2p' : data.udp;
                return filter && (http + udp + data.publicKey + data.stake).toLowerCase().indexOf(filter) === -1
                    ? false
                    : {
                        html: pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/networklist.pug'), {
                            http: http,
                            udp: udp,
                            publicKey: data.publicKey,
                            stake: data.stake,
                        }),
                    };
            }));
        }
        catch (e) {
            res.json({});
        }
    }
    async getFromApi(url) {
        try {
            return await new Promise((resolve, reject) => {
                simple_get_1.default.concat({ url: url, timeout: 200 }, (_error, res, data) => {
                    return _error ? reject(_error) : resolve(JSON.parse(data.toString()));
                });
            });
        }
        catch (error) {
            logger_1.Logger.warn(`GET request failed: ${url}`);
            logger_1.Logger.trace(error.toString());
        }
        return {};
    }
    error(err, req, res, next) {
        res.status(err.status || 500);
        if (req.accepts('html')) {
            res.end(pug_1.default.renderFile(path_1.default.join(this.config.path_app, 'view/error.pug'), {
                status: err.status || 500,
                message: err.message,
                error: process.env.NODE_ENV === 'development' ? err : {},
            }));
        }
        else {
            res.json({
                status: err.status || 500,
                message: err.message,
                error: process.env.NODE_ENV === 'development' ? err : {},
            });
        }
        next();
    }
}
exports.Explorer = Explorer;
