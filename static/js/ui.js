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

'use strict';

/* global window */
/* global document */

// @see https://umbrellajs.com
/* global u */

// @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
/* global WebSocket */

// wait for rendered UI and available dependencies to initialize JS
setTimeout( () => { __initUi(); }, 100);
function __initUi () {
  // check if umbrella and DOM is already available
  if (!u || !WebSocket || !fetch) {
    setTimeout(() => {
      __initUi();
    }, 50);
    return;
  }

  Ui.make();
}

class Ui {

  /**
   * @type {number}
   */
  static height = 0;

  /**
   * @type {number}
   */
  static page = 1;

  static timeoutNotification = null;

  /**
   * @public
   */
  static make () {
    // menu
    u('a.navbar-item').removeClass('is-active');
    u('a.navbar-item[href="' + window.location.pathname + '"]').length ?
      u('a.navbar-item[href="' + window.location.pathname + '"]').addClass('is-active') :
      u(u('.navbar-menu a.navbar-item').first()).addClass('is-active');

    // mobile menu
    u('.navbar-burger').off('click').handle('click', () => {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      u('.navbar-burger').toggleClass('is-active');
      u('.navbar-menu').toggleClass('is-active');
    });

    Ui._initWebsocket();

    switch (window.location.pathname) {
      case '/':
      case '/ui/blocks':
        Ui._fetchBlocks(1);
        break;
      case '/ui/state':
        Ui._fetchState(Ui._getSearchString());
        break;
      case '/ui/network':
        Ui._fetchNetwork(Ui._getSearchString());
        break;
      default:
        Ui._attachEvents();
    }
  }

  /**
   * @param page
   * @private
   */
  static _fetchBlocks (page = 1) {
    const pagesize = u('select[name=pagesize]').first().value;
    const q = Ui._getSearchString();
    if (q !== '') {
      u('div.paging').addClass('is-hidden');
      u('div.select').addClass('is-hidden');
    } else {
      u('div.paging').removeClass('is-hidden');
      u('div.select').removeClass('is-hidden');
    }
    fetch('/blocks?q=' + q + '&page=' + page + '&pagesize=' + pagesize)
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        Ui.height = response.height || 0;
        Ui.page = response.page || 1;

        u('article.blocks table tbody').html(response.html);
        Ui._attachEvents();
      });
  }

  /**
   * @param q {string}
   * @private
   */
  static _fetchState (q = '') {
    fetch('/state?q=' + q)
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        u('article.state').html('');
        if (Array.isArray(response)) {
          response.forEach((card) => {
            u('article.state').append(card.html);
          });
        }
        Ui._attachEvents();
      });
  }

  /**
   * @param q {string}
   * @private
   */
  static _fetchNetwork (q = '') {
    fetch('/network?q=' + q)
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        u('article.network').html('');
        if (Array.isArray(response)) {
          response.forEach((card) => {
            u('article.network').append(card.html);
          });
        }
        Ui._attachEvents();
      });
  }

  /**
   * @private
   */
  static _putTx() {
    const q = Ui._getDemoTxString();
    q.length > 0 && fetch('/tx?q=' + q)
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        Ui._updateUIStatus(response.ident || '');
        u('form#demo-tx input').first().value = '';
      });
  }

  /**
   * @private
   */
  static _initWebsocket () {
    // connect to local websocket
    Ui.websocket = new WebSocket((/s:/.test(document.location.protocol) ? 'wss://' : 'ws://') + document.location.host);

    // Connection opened
    Ui.websocket.addEventListener('open', () => {
      u('#status-ui').addClass('online');
      u('#status-ui i').removeClass('icon-times').addClass('icon-check');
    }, { once: true });

    // Connection closed
    Ui.websocket.addEventListener('close', () => {
      u('#status-ui').removeClass('online');
      u('#status-ui i').removeClass('icon-check').addClass('icon-times');
      Ui.websocket = null;
      setTimeout(() => { Ui._initWebsocket(); }, 2000);
    }, { once: true });

    // Listen for data
    Ui.websocket.addEventListener('message', async (event) => {
      try {
        const obj = JSON.parse(event.data);
        switch (obj.type) {
          case 'block':
            Ui._msgBlock(obj);
            break;
          case 'status':
            Ui._msgStatus(obj);
            break;
          default:
            return;
        }
      } catch (error) {}
    });
  }

  /**
   * @private
   */
  static _msgBlock (block) {
    if (!Object(block).hasOwnProperty('heightChain')) {
      return;
    }

    if (!u('#status-chain').hasClass('online')) {
      u('#status-chain').addClass('online');
      u('#status-chain i').removeClass('icon-times').addClass('icon-check');
    }

    Ui.height = block.heightChain;
    Ui._updateUIStatus('# ' + Ui.height);

    if (Ui._getSearchString() === '' && Ui.page === 1) {
      if (u('article.blocks table tbody tr#b' + Number(block.heightBlock)).length) {
        u('article.blocks table tbody tr#bd' + Number(block.heightBlock)).remove();
        u('article.blocks table tbody tr#b' + Number(block.heightBlock)).replace(block.html);
      } else {
        u('article.blocks table tbody').prepend(block.html);
      }

      // maintain page size, remove last two rows
      if (block.heightBlock > u('select[name=pagesize]').first().value) {
        u('article.blocks table tbody tr').last().remove();
        u('article.blocks table tbody tr').last().remove();
      }
    }

    Ui._attachEvents();
  }

  /**
   * @private
   */
  static _msgStatus (status) {
    if (!Object(status).hasOwnProperty('status')) {
      return;
    }

    if (status.status) {
      u('#status-chain').addClass('online');
      u('#status-chain i').removeClass('icon-times').addClass('icon-check');
    } else {
      Ui._updateUIStatus('Chain offline');
      u('#status-chain').removeClass('online');
      u('#status-chain i').removeClass('icon-check').addClass('icon-times');
    }
  }

  /**
   * @private
   */
  static _updateUIStatus(s) {
    clearTimeout(Ui.timeoutNotification);
    u('div.status .status-update').text(s).addClass('animated-visible').removeClass('animated-hidden');
    Ui.timeoutNotification = setTimeout(() => {
      u('div.status .status-update').addClass('animated-hidden').removeClass('animated-visible');
    }, 5000);
  }

  /**
   * @private
   */
  static _attachEvents () {
    // pages
    Ui.pages = Ui.height > 0 ? Math.ceil(Ui.height / u('select[name=pagesize]').first().value) : 1;

    // search Blocks
    u('form#demo-tx').off('submit').handle('submit', () => {
      Ui._putTx();
    });

    // search Blocks
    u('form#search-blocks').off('submit').handle('submit', async () => {
      Ui._fetchBlocks(1);
    });

    // search State
    u('form#search-state').off('submit').handle('submit', async () => {
      Ui._fetchState(Ui._getSearchString());
    });

    // search Network
    u('form#search-network').off('submit').handle('submit', async () => {
      Ui._fetchNetwork(Ui._getSearchString());
    });

    // pagesize
    u('select[name=pagesize]').off('change').handle('change', async () => {
      Ui._fetchBlocks(1);
    });

    // paging
    if (Ui.page === 1) {
      u('a.paging.first').addClass('is-hidden');
      u('a.paging.previous').addClass('is-hidden');
    } else {
      u('a.paging.first').removeClass('is-hidden');
      u('a.paging.previous').removeClass('is-hidden');
    }
    if (Ui.page === Ui.pages) {
      u('a.paging.last').addClass('is-hidden');
      u('a.paging.next').addClass('is-hidden');
    } else {
      u('a.paging.last').removeClass('is-hidden');
      u('a.paging.next').removeClass('is-hidden');
    }

    u('a.paging.first').off('click').handle('click', async () => {
      Ui._fetchBlocks(1);
    });
    u('a.paging.previous').off('click').handle('click', async () => {
      Ui._fetchBlocks(Ui.page - 1);
    });
    u('a.paging.next').off('click').handle('click', async () => {
      Ui._fetchBlocks(Ui.page + 1);
    });
    u('a.paging.last').off('click').handle('click', async () => {
      Ui._fetchBlocks(Ui.pages);
    });

    // load block data
    u('article.blocks table td span, article.blocks table td a').off('click').handle('click', async (e) => {
      const idBlock = u(e.currentTarget).data('id');

      const d = u('td.block-data[data-id="' + idBlock + '"]');
      let response = {};
      if (d.text() === '') {
        response = await (await fetch(`/block?q=${idBlock}`)).json();
        if (response) {
          d.text(JSON.stringify(response, null, 2));
        }
      }

      if (d.text() !== '') {
        d.toggleClass('is-hidden');
        u('td.marker[data-id="' + idBlock + '"] span i').toggleClass('icon-angle-down');
        u('td.marker[data-id="' + idBlock + '"] span i').toggleClass('icon-angle-right');
      }
    });
  }

  /**
   * @private
   */
  static _getSearchString() {
    return encodeURIComponent(u('input.search').first().value.toString().trim());
  }

  /**
   * @private
   */
  static _getDemoTxString() {
    return encodeURIComponent(u('form#demo-tx input').first().value.toString());
  }
}
