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

'use strict'

// wait for rendered UI and available dependencies to initialize JS
setTimeout( () => { __initUi() }, 100)
function __initUi () {
  // check if umbrella and DOM is already available
  if (!u || !WebSocket || !fetch) {
    setTimeout(() => {
      __initUi()
    }, 50)
    return
  }

  Ui.make()
}

class Ui {

  /**
   * @type {number}
   */
  static page = 0

  /**
   * @public
   */
  static make () {
    // menu
    u('a.navbar-item').removeClass('is-active')
    u('a.navbar-item[href="' + window.location.pathname + '"]').length ?
      u('a.navbar-item[href="' + window.location.pathname + '"]').addClass('is-active') :
      u(u('.navbar-menu a.navbar-item').first()).addClass('is-active')

    // mobile menu
    u('.navbar-burger').off('click').handle('click', () => {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      u('.navbar-burger').toggleClass('is-active')
      u('.navbar-menu').toggleClass('is-active')
    })

    Ui._initWebsocket()

    let q = '';
    switch (window.location.pathname) {
      case '/':
      case '/ui/blocks':
        Ui._fetchBlocks(1)
        break
      case '/ui/state':
        q = encodeURIComponent(u('input.search').first().value.toString().trim())
        Ui._fetchState(q)
        break
      case '/ui/network':
        q = encodeURIComponent(u('input.search').first().value.toString().trim())
        Ui._fetchNetwork(q)
        break
    }
  }

  /**
   * @param page
   * @private
   */
  static _fetchBlocks (page = 1) {
    const q = encodeURIComponent(u('input.search').first().value).trim()
    const pagesize = u('select[name=pagesize]').first().value
    fetch('/blocks?q=' + q + '&page=' + page + '&pagesize=' + pagesize)
      .then((response) => {
        return response.json()
      })
      .then((response) => {
        Ui.height = response.height || 1
        Ui.page = response.page || 1

        u('table.blocks tbody').html(response.html)
        Ui._attachEvents()
      })
  }

  /**
   * @param q {string}
   * @private
   */
  static _fetchState (q = '') {
    fetch('/state?q=' + q)
      .then((response) => {
        return response.json()
      })
      .then((response) => {
        u('article.state').html('');
        if (Array.isArray(response)) {
          response.forEach((card) => {
            u('article.state').append(card.html)
          })
        }
        Ui._attachEvents()
      })
  }

  /**
   * @param q {string}
   * @private
   */
  static _fetchNetwork (q = '') {
    fetch('/network?q=' + q)
      .then((response) => {
        return response.json()
      })
      .then((response) => {
        u('article.network').html('');
        if (Array.isArray(response)) {
          response.forEach((card) => {
            u('article.network').append(card.html)
          })
        }
        Ui._attachEvents()
      })
  }

  /**
   * @private
   */
  static _initWebsocket () {
    // connect to local websocket
    Ui.websocket = new WebSocket((/s:/.test(document.location.protocol) ? 'wss://' : 'ws://') + document.location.host)

    // Connection opened
    Ui.websocket.addEventListener('open', () => {
      u('#status-connection').removeClass('has-text-danger').addClass('has-text-success')
      u('#status-connection i').removeClass('icon-times').addClass('icon-check')
    })

    // Connection closed
    Ui.websocket.addEventListener('close', () => {
      u('#status-connection').removeClass('has-text-success').addClass('has-text-danger')
      u('#status-connection i').removeClass('icon-check').addClass('icon-times')
      Ui.websocket = null
      setTimeout(() => { Ui._initWebsocket() }, 2000)
    })

    // Listen for data
    Ui.websocket.addEventListener('message', async (event) => {
      let obj
      try {
        obj = JSON.parse(event.data)
        u('#status-update').removeClass('is-hidden')
        setTimeout(() => {
          u('#status-update').addClass('is-hidden')
        }, 3000)

        Ui.height = obj.heightChain
        const q = encodeURIComponent(u('input.search').first().value)
        if (q === '' && Ui.page === 1) {
          if (u('table.blocks tbody tr#b' + Number(obj.heightBlock)).length) {
            u('table.blocks tbody tr#bd' + Number(obj.heightBlock)).remove()
            u('table.blocks tbody tr#b' + Number(obj.heightBlock)).replace(obj.html)
          } else {
            u('table.blocks tbody').prepend(obj.html)
          }

          // maintain page size, remove last two rows
          if (obj.heightBlock > u('select[name=pagesize]').first().value) {
            u('table.blocks tbody tr').last().remove()
            u('table.blocks tbody tr').last().remove()
          }
        }

        Ui._attachEvents()
      } catch (error) {
        console.error(error)
      }
    })
  }

  /**
   * @private
   */
  static _attachEvents () {
    // pages
    Ui.pages = Math.ceil(Ui.height / u('select[name=pagesize]').first().value || Ui.height);

    // height
    u('#heightBlockchain').text(Ui.height)

    // search Blocks
    u('#search-blocks').off('submit').handle('submit', async () => {
      Ui._fetchBlocks(1)
    })

    // search State
    u('#search-state').off('submit').handle('submit', async () => {
      const q = encodeURIComponent(u('input.search').first().value)
      Ui._fetchState(q)
    })

    // search Network
    u('#search-network').off('submit').handle('submit', async () => {
      const q = encodeURIComponent(u('input.search').first().value)
      Ui._fetchNetwork(q)
    })

    // pagesize
    u('select[name=pagesize]').off('change').handle('change', async () => {
      Ui._fetchBlocks(1)
    })

    // paging
    if (Ui.page === 1) {
      u('.paging a.first').addClass('is-hidden')
      u('.paging a.previous').addClass('is-hidden')
    } else {
      u('.paging a.first').removeClass('is-hidden')
      u('.paging a.previous').removeClass('is-hidden')
    }
    if (Ui.page === Ui.pages) {
      u('.paging a.last').addClass('is-hidden')
      u('.paging a.next').addClass('is-hidden')
    } else {
      u('.paging a.last').removeClass('is-hidden')
      u('.paging a.next').removeClass('is-hidden')
    }

    u('div.paging a.first').off('click').handle('click', async () => {
      Ui._fetchBlocks(1)
    })
    u('div.paging a.previous').off('click').handle('click', async () => {
      Ui._fetchBlocks(Ui.page - 1)
    })
    u('div.paging a.next').off('click').handle('click', async () => {
      Ui._fetchBlocks(Ui.page + 1)
    })
    u('div.paging a.last').off('click').handle('click', async () => {
      Ui._fetchBlocks(Ui.pages)
    })

    // load block data
    u('table.blocks td span, table.blocks td a').off('click').handle('click', async (e) => {
      const idBlock = u(e.currentTarget).data('id')

      const d = u('td.block-data[data-id="' + idBlock + '"]')
      let response = {}
      if (d.text() === '') {
        response = await (await fetch(`/block?q=${idBlock}`)).json()
        if (response) {
          d.text(JSON.stringify(response, null, 2))
        }
      }

      if (d.text() !== '') {
        d.toggleClass('is-hidden')
        u('td.marker[data-id="' + idBlock + '"] span i').toggleClass('icon-angle-down')
        u('td.marker[data-id="' + idBlock + '"] span i').toggleClass('icon-angle-right')
      }
    })
  }
}