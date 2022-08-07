"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Config {
    constructor(c = {}) {
        this.path_app = path_1.default.join(__dirname, '/../');
        this.VERSION = fs_1.default.readFileSync(path_1.default.join(this.path_app, '/static/version')).toString();
        this.http_ip = c.http_ip || process.env.HTTP_IP || '127.0.0.1';
        this.http_port = c.http_port || Number(process.env.HTTP_PORT) || 3920;
        this.url_api = c.url_api || process.env.URL_API || 'http://localhost:17468';
        this.url_feed = c.url_feed || process.env.URL_FEED || 'ws://localhost:17469';
    }
}
exports.Config = Config;
