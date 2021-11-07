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

import { Util } from './util';
import { TransactionStruct } from './transaction';
import { BLOCK_VERSION } from '../config';

export type BlockStruct = {
  version: number;
  previousHash: string;
  hash: string;
  tx: Array<TransactionStruct>;
  height: number;
  votes: Array<{ origin: string; sig: string }>;
};

export class Block {
  readonly previousBlock: BlockStruct;
  readonly version: number;
  readonly height: number;
  readonly previousHash: string;
  readonly hash: string;
  readonly tx: Array<TransactionStruct>;

  static make(previousBlock: BlockStruct, tx: Array<TransactionStruct>): BlockStruct {
    return new Block(previousBlock, tx).get();
  }

  private constructor(previousBlock: BlockStruct, tx: Array<TransactionStruct>) {
    this.previousBlock = previousBlock;
    this.version = BLOCK_VERSION;
    this.previousHash = previousBlock.hash;
    this.height = previousBlock.height + 1;
    this.tx = tx;
    this.hash = Block.createHash({
      version: this.version,
      previousHash: this.previousHash,
      hash: '',
      tx: this.tx,
      height: this.height,
      votes: [],
    });
  }

  get(): BlockStruct {
    return {
      version: this.version,
      previousHash: this.previousHash,
      hash: this.hash,
      tx: this.tx,
      height: this.height,
      votes: [],
    } as BlockStruct;
  }

  static createHash(structBlock: BlockStruct): string {
    const { version, previousHash, height, tx } = structBlock;
    return Util.hash(previousHash + version + height + JSON.stringify(tx));
  }

  static validateHash(structBlock: BlockStruct): boolean {
    const { version, hash, previousHash, height, tx } = structBlock;
    return Util.hash(previousHash + version + height + JSON.stringify(tx)) === hash;
  }
}
