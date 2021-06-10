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

import { VoteStruct } from '../net/message/vote';

export class VotePool {
  private arrayHashes: Array<string> = [];
  private mapVotes: Map<string, Array<{ origin: string; sig: string }>> = new Map();
  private mapStakes: Map<string, Array<{ origin: string; stake: number }>> = new Map();

  add(structVote: VoteStruct, stake: number, quorum: number): boolean {
    const aVotes = this.mapVotes.get(structVote.block.hash) || [];
    const aStakes = this.mapStakes.get(structVote.block.hash) || [];

    const sumStake = aStakes.reduce((_s, _o) => _s + _o.stake, 0);

    // if the quorum has already been reached, return immediately
    if (sumStake >= quorum) {
      return false;
    }

    if (aVotes.some((v) => v.origin === structVote.origin)) {
      return false;
    }

    aVotes.push({ origin: structVote.origin, sig: structVote.sig });
    aStakes.push({ origin: structVote.origin, stake: stake });
    !this.arrayHashes.includes(structVote.block.hash) && this.arrayHashes.push(structVote.block.hash);
    this.mapVotes.set(structVote.block.hash, aVotes);
    this.mapStakes.set(structVote.block.hash, aStakes);
    return sumStake + stake >= quorum;
  }

  get(hash: string): Array<{ origin: string; sig: string }> {
    return this.mapVotes.get(hash) || [];
  }

  getAll(): { hashes: Array<any>; votes: Array<any>; stakes: Array<any> } {
    return { hashes: this.arrayHashes, votes: [...this.mapVotes.entries()], stakes: [...this.mapStakes.entries()] };
  }

  clear() {
    this.arrayHashes.forEach((hash) => {
      this.mapVotes.delete(hash);
      this.mapStakes.delete(hash);
    });
    this.arrayHashes = [];
  }
}
