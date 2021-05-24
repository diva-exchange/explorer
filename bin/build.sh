#!/usr/bin/env bash
#
# Copyright (C) 2021 diva.exchange
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
# Author/Maintainer: Konrad Bächler <konrad@diva.exchange>
#

# -e  Exit immediately if a simple command exits with a non-zero status
set -e

PROJECT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"/../
cd ${PROJECT_PATH}
PROJECT_PATH=`pwd`/

source "${PROJECT_PATH}bin/echos.sh"
source "${PROJECT_PATH}bin/helpers.sh"

if ! command_exists npm; then
  error "npm not available. Install node";
  exit 1
fi

if ! command_exists pkg; then
  error "pkg not available. Install it with npm i -g pkg";
  exit 2
fi

info "Transpiling TypScript to Javascript..."
rm -rf ${PROJECT_PATH}dist/*
node_modules/.bin/tsc
cp node_modules/umbrellajs/umbrella.min.js static/js/umbrella.min.js
node_modules/.bin/node-sass --omit-source-map-url --output-style compressed static/sass/explorer.scss static/css/explorer.min.css

info "Packaging..."
rm -rf ${PROJECT_PATH}build/explorer-linux-x64

cd build/node12-linux-x64
pkg --no-bytecode \
  --public \
  --output ${PROJECT_PATH}build/explorer-linux-x64 \
  .