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
import createError from 'http-errors';
import express, { Express, NextFunction, Request, Response} from 'express';
import path from 'path';
import { Logger } from './logger';

export class Explorer {

  private app: Express;

  constructor() {
    /** @type {Function} */
    this.app = express();
    // generic
    this.app.set('x-powered-by', false);

    // compression
    this.app.use(compression());

    // static content
    this.app.use(express.static(path.join(__dirname, '/../app/static/')));

    // view engine setup
    this.app.set('views', path.join(__dirname, '/../app/view/'));
    this.app.set('view engine', 'pug');

    this.app.use(express.json());

    // routes
    this.app.use(Explorer.routes);

    // catch unavailable favicon.ico
    this.app.get('/favicon.ico', (req, res) => res.sendStatus(204));

    // catch 404 and forward to error handler
    this.app.use((req, res, next) => {
      next(createError(404))
    });

    // error handler
    this.app.use(Explorer.error);
  }

  listen() {
    this.app.listen(3920);
  }

  private static routes(req: Request, res: Response, next: NextFunction) {

    Logger.trace(req.path);
    Logger.trace(res);
    const _p = req.path.replace(/\/+$/, '');

    switch (_p) {
      case '':
      case '/ui/blocks':
        res.render('blocks');
        break;
      default:
        next();
    }
  }

  private static error(err: any, req: Request, res: Response, next: NextFunction) {
    // set locals, only providing error in development
    res.locals.status = err.status;
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);

    // render the error page
    if (req.accepts('html')) {
      res.render('error')
    } else {
      res.json({
        message: res.locals.message,
        error: res.locals.error
      })
    }
  }

}
