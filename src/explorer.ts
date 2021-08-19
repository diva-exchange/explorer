/**
 * Copyright (C) 2021 diva.exchange
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
//@ts-ignore
import get from 'simple-get';

export class Explorer {
  private readonly config: Config;
  private readonly app: Express;
  private readonly httpServer: http.Server;
  private readonly webSocketServer: WebSocket.Server;
  private webSocket: WebSocket = {} as WebSocket;
  private height: number = 0;

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
    });
    this.httpServer.on('close', () => {
      Logger.info(`HttpServer closing on ${this.config.http_ip}:${this.config.http_port}`);
    });

    this.webSocketServer = new WebSocket.Server({
      server: this.httpServer,
      clientTracking: true,
      perMessageDeflate: this.config.per_message_deflate,
    });
    this.webSocketServer.on('connection', (ws: WebSocket) => {
      ws.on('error', (error: Error) => {
        Logger.trace(error);
        ws.terminate();
      });
    });
    this.webSocketServer.on('close', () => {
      Logger.info('WebSocketServer closing');
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
    this.webSocket = new WebSocket(this.config.url_feed, {
      followRedirects: false,
      perMessageDeflate: true,
    });

    this.webSocket.on('error', () => {});

    this.webSocket.on('close', () => {
      this.webSocket = {} as WebSocket;
      setTimeout(() => { this.initFeed(); }, 1000);
    });

    this.webSocket.on('message', (message: Buffer) => {
      let block: any = {};
      let html: string = '';
      try {
        block = JSON.parse(message.toString());
        this.height = block.height > this.height ? block.height : this.height;
        html = pug.renderFile(path.join(this.config.path_app, 'view/blocklist.pug'), {
          blocks: [{
            height: block.height,
            lengthTx: block.tx.length,
            dateTimeFormatted: new Date(block.tx[0].timestamp).toUTCString(),
            }],
        });
      } catch (e) {
        return;
      }
      if (html.length) {
        this.webSocketServer.clients.forEach((ws) => {
          ws.send(JSON.stringify({ heightChain: this.height, heightBlock: block.height, html: html }));
        });
      }
    });
  }

  private async routes(req: Request, res: Response, next: NextFunction) {
    const _p = req.path.replace(/\/+$/, '');
    switch (_p) {
      case '':
      case '/ui/blocks':
        res.end(pug.renderFile(path.join(this.config.path_app, 'view/blocks.pug')));
        break;
      case '/blocks':
        await this.getBlocks(req, res);
        break;
      case '/block':
        await this.getBlock(req, res);
        break;
      default:
        next();
    }
  }

  private async getBlocks(req: Request, res: Response) {
    const pagesize = Math.floor(Number(req.query.pagesize || 0) >= 1 ? Number(req.query.pagesize) : 0);
    const page = Math.floor(Number(req.query.page || 0) >= 1 ? Number(req.query.page) : 0);
    const filter = String(req.query.q || '').replace(/[^\w\-+*[\]/().,;: ]/gi, '');
    const url =
      this.config.url_api + '/blocks/page' + (page > 0 ? '/' + page : '') + (pagesize > 0 ? '?size=' + pagesize : '');

    let arrayBlocks: Array<any> = [];
    try {
      arrayBlocks = (await this.getFromApi(url)).map((b: any) => {
        this.height = b.height > this.height ? b.height : this.height;
        return {
          height: b.height,
          lengthTx: b.tx.length,
          dateTimeFormatted: new Date(b.tx[0].timestamp).toUTCString(),
        };
      });
    } catch (e) {
      res.json({});
      return;
    }

    const html = pug.renderFile(path.join(this.config.path_app, 'view/blocklist.pug'), {
      blocks: arrayBlocks,
    });
    res.json({
      blocks: arrayBlocks,
      filter: filter,
      page: page,
      pages: Math.ceil(this.height / pagesize),
      sizePage: pagesize,
      height: this.height,
      html: html,
    });
  }

  private async getBlock(req: Request, res: Response) {
    const id = Math.floor(Number(req.query.q || 0) >= 1 ? Number(req.query.q) : 0);
    const url = this.config.url_api + `/blocks?gte=${id}&lte=${id}`;

    try {
      res.json((await this.getFromApi(url))[0]);
    } catch (e) {
      res.json({});
      return;
    }
  }

  private async getFromApi(url: string): Promise<any> {
    try {
      return await new Promise((resolve, reject) => {
        get.concat({ url: url, timeout: 200 }, (_error: Error, res: object, data: Buffer) => {
          return _error ? reject(_error) : resolve(JSON.parse(data.toString()));
        });
      });
    } catch (error) {
      Logger.warn(`GET request failed: ${url}`);
      Logger.trace(error);
    }
    return {};
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