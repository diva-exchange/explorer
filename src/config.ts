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

export type Configuration = {
  http_ip?: string;
  http_port?: number;
  per_message_deflate?: boolean;
  url_api?: string;
};

export class Config {
  public readonly http_ip: string;
  public readonly http_port: number;
  public readonly per_message_deflate: boolean;
  public readonly url_api: string;

  constructor(c: Configuration = {}) {
    this.http_ip = c.http_ip || process.env.HTTP_IP || "127.0.0.1";
    this.http_port = c.http_port || Number(process.env.HTTP_PORT) || 3920;
    this.per_message_deflate = c.per_message_deflate || true;
    this.url_api = c.url_api || process.env.URL_API || '';
  }
}
