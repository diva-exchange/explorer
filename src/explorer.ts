/**
 * Copyright (C) 2022 diva.exchange
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Author/Maintainer: Konrad Bächler <konrad@diva.exchange>
 */

import compression from 'compression';
import { Config } from './config';
import createError from 'http-errors';
import express, { Express, NextFunction, Request, Response } from 'express';
import path from 'path';
import http from 'http';
import WebSocket from 'ws';
import { Logger } from './logger';
import pug from 'pug';
import get from 'simple-get';
import { toB32 } from '@diva.exchange/i2p-sam/dist/i2p-sam';

export class Explorer {
  private readonly config: Config;
  private readonly app: Express;
  private readonly httpServer: http.Server;
  private readonly webSocketServer: WebSocket.Server;
  private webSocket: WebSocket = {} as WebSocket;
  private height: number = 0;

  private timeoutInit: number = 5000;

  constructor(config: Config) {
    this.config = config;

    this.app = express();
    // generic
    this.app.set('x-powered-by', false);

    // compression
    this.app.use(compression());

    // static content
    this.app.use(express.static(path.join(config.path_app, 'static')));

    this.app.use(express.json());

    // routes
    this.app.use(async (req, res, next) => {
      await this.routes(req, res, next);
    });

    // catch unavailable favicon.ico
    this.app.get('/favicon.ico', (req, res) => res.sendStatus(204));

    // catch 404 and forward to error handler
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      next(createError(404));
    });

    // error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      this.error(err, req, res, next);
    });

    // Web Server
    this.httpServer = http.createServer(this.app);
    this.httpServer.on('listening', () => {
      Logger.info(`HttpServer listening on ${this.config.http_ip}:${this.config.http_port}`);
      Logger.info(`WebSocketServer ready on ${this.config.http_ip}:${this.config.http_port}`);
    });
    this.httpServer.on('close', () => {
      Logger.info(`HttpServer closing on ${this.config.http_ip}:${this.config.http_port}`);
    });

    this.webSocketServer = new WebSocket.Server({
      server: this.httpServer,
      clientTracking: true,
    });
    this.webSocketServer.on('connection', () => {
      // Backend status
      this.webSocket.readyState === WebSocket.OPEN && this.broadcastStatus(true);
    });
    this.webSocketServer.on('close', () => {
      Logger.info('WebSocketServer closing');
    });
    this.webSocketServer.on('error', (error: Error) => {
      Logger.warn('WebSocketServer error');
      Logger.trace(error.toString());
    });
  }

  listen(): Explorer {
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

  private initFeed() {
    // feed to/from chain
    this.webSocket = new WebSocket(this.config.url_feed, {
      followRedirects: false,
      perMessageDeflate: false,
    });

    this.webSocket.on('open', () => {
      Logger.info(`WebSocket opened to ${this.config.url_feed}`);

      this.timeoutInit = 5000;
      // Backend status
      this.broadcastStatus(true);

      (async () => {
        try {
          // get genesis block
          this.broadcastBlock(await this.getFromApi(this.config.url_api + '/block/1'));
        } catch (error: any) {
          Logger.warn(`WebSocket.onOpen(), GET request failed: ${this.config.url_api}/block/1 - ${error.toString()}`);
          this.height = 0;
        }
      })();
    });

    this.webSocket.on('message', (message: Buffer) => {
      try {
        this.broadcastBlock(JSON.parse(message.toString()));
      } catch (error: any) {
        Logger.warn(`WebSocket.onMessage(): ${error.toString()}`);
      }
    });

    this.webSocket.on('close', (code, reason) => {
      // Backend status
      this.broadcastStatus(false);

      this.timeoutInit = Math.floor(this.timeoutInit * 1.5 > 60000 ? 60000 : this.timeoutInit * 1.5);
      setTimeout(() => {
        this.initFeed();
      }, this.timeoutInit);
      this.webSocket = {} as WebSocket;
      this.height = 0;

      Logger.trace(`WebSocket onClose: ${code} ${reason}`);
    });

    this.webSocket.on('error', (error: any) => {
      Logger.warn('WebSocket error');
      Logger.trace(error.toString());
    });
  }

  private broadcastBlock(block: any) {
    try {
      const html = pug.renderFile(path.join(this.config.path_app, 'view/blocklist.pug'), {
        blocks: this.processBlocks([block]),
      });
      this.webSocketServer.clients.forEach((ws) => {
        ws.readyState === WebSocket.OPEN &&
          ws.send(JSON.stringify({ type: 'block', heightChain: this.height, heightBlock: block.height, html: html }));
      });
    } catch (error: any) {
      Logger.warn(`broadcastBlock(): ${error.toString()}`);
    }
  }

  private broadcastStatus(status: any) {
    try {
      this.webSocketServer.clients.forEach((ws) => {
        ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'status', status: status }));
      });
    } catch (error: any) {
      Logger.warn(`broadcastStatus(): ${error.toString()}`);
    }
  }

  private async routes(req: Request, res: Response, next: NextFunction) {
    const v = this.config.VERSION;
    const _p = req.path.replace(/\/+$/, '');
    const q = req.query.q || '';
    switch (_p) {
      case '':
      case '/ui/blocks':
        res.end(pug.renderFile(path.join(this.config.path_app, 'view/blocks.pug'), { q: q }));
        break;
      case '/ui/state':
        res.end(pug.renderFile(path.join(this.config.path_app, 'view/state.pug'), {}));
        break;
      case '/ui/network':
        res.end(pug.renderFile(path.join(this.config.path_app, 'view/network.pug'), {}));
        break;
      case '/ui/about':
        res.end(pug.renderFile(path.join(this.config.path_app, 'view/about.pug'), { version: v }));
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
      case '/tx':
        await this.putTx(req, res);
        break;
      default:
        next();
    }
  }

  private async getBlocks(req: Request, res: Response) {
    const pagesize = Math.floor(Number(req.query.pagesize || 0) >= 1 ? Number(req.query.pagesize) : 1);
    const page = Math.floor(Number(req.query.page || 0) >= 1 ? Number(req.query.page) : 1);
    const q = (req.query.q || '').toString();
    const url = this.config.url_api + (q.length ? `/blocks/search/${q}` : `/blocks/page/${page}/${pagesize}`);

    let arrayBlocks: Array<any> = [];
    try {
      arrayBlocks = this.processBlocks(await this.getFromApi(url));
    } catch (error: any) {
      res.json({});
      return;
    }

    const html = pug.renderFile(path.join(this.config.path_app, 'view/blocklist.pug'), {
      blocks: arrayBlocks,
    });
    res.json({
      blocks: arrayBlocks,
      page: page,
      height: this.height,
      html: html,
    });
  }

  private processBlocks(arrayBlocks: Array<any>) {
    return arrayBlocks
      .map((b: any) => {
        this.height = b.height > this.height ? b.height : this.height;
        const dnaCommands: Map<string, number> = new Map();
        let lengthCommands: number = 0;
        Array.from(b.tx).forEach((tx: any) => {
          [...tx.commands].forEach((c) => {
            const n = dnaCommands.get(c.command) || 0;
            dnaCommands.set(c.command, n + 1);
            lengthCommands++;
          });
        });
        return {
          height: b.height,
          lengthTx: b.tx.length,
          dnaCmds: [...dnaCommands].sort((a, b) => (a[0] >= b[0] ? 1 : -1)),
          lengthCmds: lengthCommands,
          weightTotal: JSON.stringify(b).length,
          weightTx: JSON.stringify(b.tx).length,
        };
      })
      .reverse();
  }

  private async getBlock(req: Request, res: Response) {
    const height = Math.floor(Number(req.query.q || 0) >= 1 ? Number(req.query.q) : 1);
    try {
      res.json(await this.getFromApi(this.config.url_api + `/block/${height}`));
    } catch (error: any) {
      Logger.warn(`getBlock(), GET request failed: ${this.config.url_api}/block/${height} - ${error.toString()}`);
      res.json({});
      return;
    }
  }

  private async getState(req: Request, res: Response) {
    const url = this.config.url_api + '/state/search/' + (req.query.q || '').toString();
    try {
      res.json(
        (await this.getFromApi(url))
          .sort((a: any, b: any) => {
            return a.key > b.key ? 1 : -1;
          })
          .map((data: any) => {
            let v = '';
            try {
              v = JSON.stringify(JSON.parse(data.value), null, ' ');
            } catch (error: any) {
              v = data.value;
            }
            return {
              html: pug.renderFile(path.join(this.config.path_app, 'view/statelist.pug'), {
                k: data.key,
                v: v,
              }),
            };
          })
      );
    } catch (error: any) {
      Logger.warn(`getState(), GET request failed: ${url} - ${error.toString()}`);
      res.json({});
    }
  }

  private async getNetwork(req: Request, res: Response) {
    const filter = (req.query.q || '').toString().toLowerCase();
    const url = this.config.url_api + '/network';
    try {
      res.json(
        (await this.getFromApi(url))
          .sort((a: any, b: any) => (a.publicKey > b.publicKey ? 1 : -1))
          .map((data: any) => {
            const http = data.http.indexOf('.') === -1 ? toB32(data.http) + '.b32.i2p' : data.http;
            const udp = data.udp.indexOf('.') === -1 ? toB32(data.udp) + '.b32.i2p' : data.udp;
            return filter && (http + udp + data.publicKey + data.stake).toLowerCase().indexOf(filter) === -1
              ? false
              : {
                  html: pug.renderFile(path.join(this.config.path_app, 'view/networklist.pug'), {
                    http: http,
                    udp: udp,
                    publicKey: data.publicKey,
                    stake: data.stake,
                  }),
                };
          })
      );
    } catch (error: any) {
      Logger.warn(`getNetwork(), GET request failed: ${url} - ${error.toString()}`);
      res.json({});
    }
  }

  private async putTx(req: Request, res: Response) {
    const txData = (req.query.q || '').toString().slice(0, 64);
    const url = this.config.url_api + '/transaction';
    try {
      const aC = [{ seq: 1, command: 'data', ns: 'testnet:explorer:diva:exchange', d: txData }];
      const result = await this.putToApi(url, aC);
      return res.json(result);
    } catch (error: any) {
      Logger.warn(`putTx(), PUT request failed: ${url} - ${error.toString()}`);
      res.json({});
    }
  }

  private async getFromApi(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      get.concat(
        {
          url: url,
          timeout: 1000,
          json: true,
        },
        (_error: Error, res: Response, data: Buffer) => {
          _error || res.statusCode !== 200 ? reject(_error || res.statusCode) : resolve(data);
        }
      );
    });
  }

  private async putToApi(url: string, arrayCommand: Array<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      get.concat(
        {
          method: 'PUT',
          url: url,
          timeout: 1000,
          body: arrayCommand,
          json: true,
        },
        (_error: Error, res: Response, data: Buffer) => {
          _error || res.statusCode !== 200 ? reject(_error || res.statusCode) : resolve(data);
        }
      );
    });
  }

  private error(err: any, req: Request, res: Response, next: NextFunction) {
    res.status(err.status || 500);

    // render the error page
    if (req.accepts('html')) {
      res.end(
        pug.renderFile(path.join(this.config.path_app, 'view/error.pug'), {
          status: err.status || 500,
          message: err.message,
          error: process.env.NODE_ENV === 'development' ? err : {},
        })
      );
    } else {
      res.json({
        status: err.status || 500,
        message: err.message,
        error: process.env.NODE_ENV === 'development' ? err : {},
      });
    }

    next();
  }
}
