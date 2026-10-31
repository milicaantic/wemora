// Svaka aplikacija ima svoj Metro keš (u .expo/metro-cache).
// Aplikacije dele node_modules šablona preko linka, pa bi zajednički keš
// vratio rute neke druge aplikacije ("No routes found"). Vidi D-009.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);
config.cacheStores = [new FileStore({ root: path.join(__dirname, '.expo', 'metro-cache') })];

module.exports = config;
