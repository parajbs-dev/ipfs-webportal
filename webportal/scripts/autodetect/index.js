/* global fetch, Blob */
import {
  parseIPFSURL,
  checkError,
  detectDefaultGateway,
  postFormFile,
  postRawBody,
  postRawCar,
  getFromGateway,
  getFromURL,
  getSizeFromURL,
  autoStream,
  streamToIterator,
} from "./util.js";

export { detectDefaultGateway, toGatewayURL, W3S_LINK_URL } from "./util.js";

let debug = false;

export function setDebug(shouldDebug = true) {
  debug = shouldDebug;
}

export const KNOWN_DAEMON_PORTS = [5001, 45001, 45002, 45003, 45004, 45005];
export const WEB3_STORAGE_URL = "https://api.web3.storage/";
export const NFT_STORAGE_URL = "https://api.nft.storage/";
export const PINATA_STORAGE_URL = "https://api.pinata.cloud/";
export const ESTUARY_URL = "https://api.estuary.tech/";
export const FILEBASE_URL = "https://api.filebase.io/v1/ipfs/";
export const DEFAULT_DAEMON_API_URL = "http://localhost:5001/";
export const CUSTOM_KUBO_DAEMON_API_URL = "";
export const DEFAULT_TIMEOUT = 1000;
export const INFURA_PROJECT_URL = "http://localhost:5003/";
export const AGREGORE_TYPE = "agregore";
export const DAEMON_TYPE = "daemon";
export const KUBO_TYPE = "kubo";
export const BRAVE_TYPE = "brave";
export const INFURA_TYPE = "infura";
export const FILEBASE_TYPE = "filebase";
export const WEB3_STORAGE_TYPE = "web3.storage";
export const NFT_STORAGE_TYPE = "nft.storage";
export const PINATA_STORAGE_TYPE = "pinata";
export const ESTUARY_TYPE = "estuary";
export const READONLY_TYPE = "readonly";
export const INVALID_TYPE = "invalid";
export const CHOOSE_ORDER = [
  AGREGORE_TYPE,
  DAEMON_TYPE,
  KUBO_TYPE,
  BRAVE_TYPE,
  INFURA_TYPE,
  FILEBASE_TYPE,
  WEB3_STORAGE_TYPE,
  NFT_STORAGE_TYPE,
  PINATA_STORAGE_TYPE,
  ESTUARY_TYPE,
  READONLY_TYPE,
];

export class API {
  get type() {
    return INVALID_TYPE;
  }

  async *get(url, { start, end, signal = null, format = null } = {}) {
    throw new Error("Not Implemented");
  }

  async getSize(url, signal = null) {
    throw new Error("Not Implemented");
  }

  async uploadCAR(carFileIterator, signal = null) {
    throw new Error("Not Implemented");
  }

  async uploadFile(carFileIterator, fileName, signal = null) {
    throw new Error("Not Implemented");
  }

  async clear(url, signal = null) {
    throw new Error("Not Implemented");
  }
}

export async function detect({
  daemonURL = DEFAULT_DAEMON_API_URL,
  kuboURL = CUSTOM_KUBO_DAEMON_API_URL,
  infuraProjectUrl = INFURA_PROJECT_URL,
  infuraProjectId,
  infuraProjectSecret,
  filebaseToken,
  filebaseURL = FILEBASE_URL,
  web3StorageToken,
  web3StorageURL = WEB3_STORAGE_URL,
  nftStorageToken,
  nftStorageURL = NFT_STORAGE_URL,
  pinataStorageToken,
  pinataStorageURL = PINATA_STORAGE_URL,
  estuaryToken,
  estuaryURL = ESTUARY_URL,
  publicGatewayURL = detectDefaultGateway(),
  readonly = true,
  timeout = DEFAULT_TIMEOUT,
  fetch = globalThis.fetch,
} = {}) {
  const options = [];

  const toAttempt = [];

  toAttempt.push(
    detectAgregoreFetch(fetch).then((detected) => detected && options.push({ type: AGREGORE_TYPE, fetch }))
  );

  toAttempt.push(
    detectAllDaemons(fetch).then((detected) => detected && options.push({ type: DAEMON_TYPE, url: detected, fetch }))
  );

  if (daemonURL) {
    toAttempt.push(
      detectDaemon(daemonURL, timeout, fetch).then(
        (detected) => detected && options.push({ type: DAEMON_TYPE, url: daemonURL, fetch })
      )
    );
  }

  if (kuboURL) {
    toAttempt.push(
      detectDaemon(kuboURL, timeout, fetch).then(
        (detected) => detected && options.push({ type: KUBO_TYPE, url: kuboURL, fetch })
      )
    );
  }

  if (infuraProjectUrl && infuraProjectId && infuraProjectSecret) {
    const url = infuraProjectUrl;
    const authorization = "Basic " + btoa(infuraProjectId + ":" + infuraProjectSecret);
    //    options.push({ type: INFURA_TYPE, url: url, fetch, publicGatewayURL })
    options.push({ type: INFURA_TYPE, url, authorization, fetch, publicGatewayURL });
  }

  if (filebaseToken) {
    const url = filebaseURL;
    const authorization = filebaseToken;
    options.push({ type: FILEBASE_TYPE, url, authorization, fetch, publicGatewayURL });
  }

  if (estuaryToken) {
    const url = estuaryURL;
    const authorization = estuaryToken;
    options.push({ type: ESTUARY_TYPE, url, authorization, fetch, publicGatewayURL });
  }

  if (web3StorageToken) {
    const url = web3StorageURL;
    const authorization = web3StorageToken;
    options.push({ type: WEB3_STORAGE_TYPE, url, authorization, fetch, publicGatewayURL });
  }

  if (nftStorageToken) {
    const url = nftStorageURL;
    const authorization = nftStorageToken;
    options.push({ type: NFT_STORAGE_TYPE, url, authorization, fetch, publicGatewayURL });
  }

  if (pinataStorageToken) {
    const url = pinataStorageURL;
    const authorization = pinataStorageToken;
    options.push({ type: PINATA_STORAGE_TYPE, url, authorization, fetch, publicGatewayURL });
  }

  if (readonly && publicGatewayURL) {
    options.push({ type: READONLY_TYPE, fetch, publicGatewayURL });
  }

  await Promise.allSettled(toAttempt);

  return options;
}

export async function create({ chooseOrder = CHOOSE_ORDER, ...opts } = {}) {
  const options = await detect(opts);

  const chosen = defaultChoice(options, chooseOrder);

  return choose(chosen);
}

export function defaultChoice(options, chooseOrder = CHOOSE_ORDER) {
  const sorted = options
    .filter(({ type }) => chooseOrder.includes(type))
    .sort(({ type: type1 }, { type: type2 }) => chooseOrder.indexOf(type1) - chooseOrder.indexOf(type2));

  const chosen = sorted[0];
  if (!chosen) throw new Error("Unable to find valid type");

  return chosen;
}

export async function choose(option) {
  const { type } = option;
  let api = null;
  if (type === AGREGORE_TYPE) {
    api = new AgregoreAPI(option.fetch || globalThis.fetch);
  } else if (type === DAEMON_TYPE) {
    api = new DaemonAPI(option.url);
  } else if (type === KUBO_TYPE) {
    api = new DaemonAPI(option.url);
  } else if (type === BRAVE_TYPE) {
    api = new DaemonAPI(option.url);
  } else if (type === INFURA_TYPE) {
    api = new InfuraAPI(option.authorization, option.url, option.publicGatewayURL);
  } else if (type === FILEBASE_TYPE) {
    api = new FilebaseAPI(option.authorization, option.url, option.publicGatewayURL);
  } else if (type === WEB3_STORAGE_TYPE) {
    api = new Web3StorageAPI(option.authorization, option.url, option.publicGatewayURL);
  } else if (type === NFT_STORAGE_TYPE) {
    api = new NftStorageAPI(option.authorization, option.url, option.publicGatewayURL);
  } else if (type === PINATA_STORAGE_TYPE) {
    api = new PinataStorageAPI(option.authorization, option.url, option.publicGatewayURL);
  } else if (type === ESTUARY_TYPE) {
    api = new EstuaryAPI(option.authorization, option.url, option.publicGatewayURL);
  } else if (type === READONLY_TYPE) {
    api = new ReadonlyGatewayAPI(option.publicGatewayURL);
  } else {
    throw new TypeError(`Unknown API type: ${type}.`);
  }

  return { api };
}

export class ReadonlyGatewayAPI extends API {
  constructor(gatewayURL = detectDefaultGateway()) {
    super();
    this.gatewayURL = gatewayURL;
  }

  get type() {
    return READONLY_TYPE;
  }

  async *get(url, { start, end, signal = null, format = null } = {}) {
    yield* getFromGateway({
      url,
      start,
      end,
      format,
      gatewayURL: this.gatewayURL,
      signal,
    });
  }

  async getSize(url, signal = null) {
    const { cid, path, type } = parseIPFSURL(url);

    const relative = `/${type}/${cid}${path}`;
    const toFetch = new URL(relative, this.gatewayURL);

    return getSizeFromURL({
      url: toFetch,
      signal,
    });
  }
}

export class EstuaryAPI extends ReadonlyGatewayAPI {
  constructor(authorization, url = ESTUARY_URL, gatewayURL = detectDefaultGateway()) {
    super(gatewayURL);
    this.authorization = authorization;
    this.url = url;
  }

  get type() {
    return ESTUARY_TYPE;
  }

  async uploadCAR(carFileIterator, signal = null) {
    throw new Error("Not Implemented");
  }

  async uploadFile(fileIterator, fileName, signal = null) {
    const toFetch = new URL("/content/add", this.url);
    toFetch.password = this.authorization;

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      parameterName: "data",
      signal,
    });

    const { cid } = await response.json();

    return `ipfs://${cid}/`;
  }
}

export class AgregoreAPI extends API {
  constructor(fetch = globalThis.fetch) {
    super();
    this.fetch = fetch;
  }

  get type() {
    return AGREGORE_TYPE;
  }

  async *get(url, { start, end, signal = null, format = null } = {}) {
    const { fetch } = this;
    yield* getFromURL({
      url,
      start,
      end,
      format,
      fetch,
      signal,
    });
  }

  async getSize(url, signal = null) {
    const { fetch } = this;
    return getSizeFromURL({
      url,
      fetch,
      signal,
    });
  }

  async uploadCAR(carFileIterator, signal = null) {
    // convert to stream if iterator
    const body = await autoStream(carFileIterator);
    const { fetch } = this;
    const response = await fetch("ipfs://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.ipld.car",
      },
      signal,
      body,
    });

    await checkError(response);

    const results = await response.text();

    return results.split("\n");
  }

  async uploadFile(fileIterator, signal = null) {
    const body = await autoStream(fileIterator);
    const { fetch } = this;
    const response = await fetch("ipfs://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      signal,
      body,
    });

    await checkError(response);

    return response.headers.get("Location");
  }
}

export class FilebaseAPI extends ReadonlyGatewayAPI {
  constructor(authorization, url = FILEBASE_URL, gatewayURL = detectDefaultGateway()) {
    super(gatewayURL);
    this.authorization = authorization;
    this.url = url;
  }

  async uploadCAR(carFileIterator, signal = null) {
    const toFetch = new URL("/car", this.url);
    toFetch.password = this.authorization;

    const response = await postRawBody({
      url: toFetch,
      fileIterator: carFileIterator,
      signal,
    });

    const contents = await response.text();
    const items = contents.split("\n");

    return items
      .filter((line) => line)
      .map((line) => {
        const { cid } = JSON.parse(line);
        return `ipfs://${cid}/`;
      });
  }

  async uploadFile(fileIterator, { fileName = "", signal = null } = {}) {
    const toFetch = new URL("/upload", this.url);
    toFetch.password = this.authorization;

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      signal,
    });

    const { cid } = await response.json();

    return `ipfs://${cid}/`;
  }
}

export class Web3StorageAPI extends ReadonlyGatewayAPI {
  constructor(authorization, url = WEB3_STORAGE_URL, gatewayURL = detectDefaultGateway()) {
    super(gatewayURL);
    this.authorization = authorization;
    this.url = url;
  }

  get type() {
    return WEB3_STORAGE_TYPE;
  }

  async uploadCAR(carFileIterator, signal = null) {
    const toFetch = new URL("/car", this.url);
    toFetch.password = this.authorization;

    const response = await postRawBody({
      url: toFetch,
      fileIterator: carFileIterator,
      signal,
    });

    const contents = await response.text();
    const items = contents.split("\n");

    return items
      .filter((line) => line)
      .map((line) => {
        const { cid } = JSON.parse(line);
        return `ipfs://${cid}/`;
      });
  }

  async uploadFile(fileIterator, { fileName = "", signal = null } = {}) {
    const toFetch = new URL("/upload", this.url);
    toFetch.password = this.authorization;

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      signal,
    });

    const { cid } = await response.json();

    return `ipfs://${cid}/`;
  }
}

export class NftStorageAPI extends ReadonlyGatewayAPI {
  constructor(authorization, url = NFT_STORAGE_URL, gatewayURL = detectDefaultGateway()) {
    super(gatewayURL);
    this.authorization = authorization;
    this.url = url;
  }

  async uploadCAR(carFileIterator, signal = null) {
    const toFetch = new URL("/upload", this.url);
    toFetch.password = this.authorization;

    const response = await postRawCar({
      url: toFetch,
      fileIterator: carFileIterator,
      signal,
    });

    const contents = await response.text();
    const items = contents.split("\n");

    return items
      .filter((line) => line)
      .map((line) => {
        const res = JSON.parse(line);
        const cid = res.value.cid;
        return `ipfs://${cid}/`;
      });
  }

  async uploadFile(fileIterator, { fileName = "", signal = null } = {}) {
    const toFetch = new URL("/upload", this.url);
    toFetch.password = this.authorization;

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      signal,
    });
    const res = await response.json();
    const cid = res.value.cid;
    return `ipfs://${cid}/`;
  }
}

export class PinataStorageAPI extends ReadonlyGatewayAPI {
  constructor(authorization, url = PINATA_STORAGE_URL, gatewayURL = detectDefaultGateway()) {
    super(gatewayURL);
    this.authorization = authorization;
    this.url = url;
  }

  async uploadCAR(carFileIterator, signal = null) {
    const toFetch = new URL("/car", this.url);
    toFetch.password = this.authorization;

    const response = await postRawBody({
      url: toFetch,
      fileIterator: carFileIterator,
      signal,
    });

    const contents = await response.text();
    const items = contents.split("\n");

    return items
      .filter((line) => line)
      .map((line) => {
        const { cid } = JSON.parse(line);
        return `ipfs://${cid}/`;
      });
  }

  async uploadFile(fileIterator, { fileName = "", signal = null } = {}) {
    const toFetch = new URL("/pinning/pinFileToIPFS", this.url);
    toFetch.password = this.authorization;

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      signal,
    });
    const res = await response.json();
    const cid = res.IpfsHash;
    return `ipfs://${cid}/`;
  }
}

export class InfuraAPI extends ReadonlyGatewayAPI {
  constructor(authorization, url = INFURA_PROJECT_URL, gatewayURL = detectDefaultGateway()) {
    super(gatewayURL);
    this.authorization = authorization;
    this.url = url;
  }

  async uploadCAR(carFileIterator, signal = null) {
    const toFetch = new URL("/car", this.url);
    toFetch.password = this.authorization;

    const response = await postRawBody({
      url: toFetch,
      fileIterator: carFileIterator,
      signal,
    });

    const contents = await response.text();
    const items = contents.split("\n");

    return items
      .filter((line) => line)
      .map((line) => {
        const { cid } = JSON.parse(line);
        return `ipfs://${cid}/`;
      });
  }

  async uploadFile(fileIterator, { fileName = "", signal = null } = {}) {
    const toFetch = new URL("/upload", this.url);
    toFetch.password = this.authorization;

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      signal,
    });

    const { cid } = await response.json();

    return `ipfs://${cid}/`;
  }
}

export class DaemonAPI extends API {
  constructor(url = DEFAULT_DAEMON_API_URL) {
    super();
    this.url = url;
  }

  get type() {
    return DAEMON_TYPE;
  }

  async *get(url, { start, end, signal = null, format = null } = {}) {
    const { cid, path, type } = parseIPFSURL(url);
    const relative = `/api/v0/cat?arg=/${type}/${cid}${path}`;
    const toFetch = new URL(relative, this.url);

    if (start) {
      toFetch.searchParams.set("offset", start);
    }
    if (end) {
      toFetch.searchParams.set("length", end - (start || 0) + 1);
    }

    if (format) {
      throw new Error("Format is unsupported on Kubo Daemons for now");
    }

    const response = await fetch(toFetch, {
      method: "POST",
      signal,
    });

    await checkError(response);

    yield* streamToIterator(response.body);
  }

  async getSize(url, signal = null) {
    try {
      const { cid, path, type } = parseIPFSURL(url);
      const relative = `/api/v0/file/ls?arg=/${type}/${cid}${path}&size=true`;
      const toFetch = new URL(relative, this.url);

      const response = await fetch(toFetch, {
        method: "POST",
        signal,
      });

      await checkError(response);

      const { Objects } = await response.json();

      const [{ Size }] = Object.values(Objects);

      return Size;
    } catch (e) {
      if (debug) console.warn(e);
      return this._getSizeWithDag(url, signal);
    }
  }

  async _getSizeWithDag(url, signal = null) {
    const { cid, path, type } = parseIPFSURL(url);
    const relative = `/api/v0/dag/stat?arg=/${type}/${cid}${path}`;
    const toFetch = new URL(relative, this.url);

    const response = await fetch(toFetch, {
      method: "POST",
      signal,
    });

    await checkError(response);

    const { Size } = await response.json();

    return parseInt(Size, 10);
  }

  async _pin(url, signal = null) {
    const { cid, path, type } = parseIPFSURL(url);
    const relative = `/api/v0/pin/add?arg=/${type}/${cid}${path}`;
    const toFetch = new URL(relative, this.url);

    const response = await fetch(toFetch, {
      method: "POST",
      signal,
    });

    await checkError(response);
  }

  async _unpin(url, signal = null) {
    const { cid, path, type } = parseIPFSURL(url);
    const relative = `/api/v0/pin/rm?arg=/${type}/${cid}${path}`;
    const toFetch = new URL(relative, this.url);

    const response = await fetch(toFetch, {
      method: "POST",
      signal,
    });

    await checkError(response);
  }

  async clear(url, signal = null) {
    return this._unpin(url, signal);
  }

  async uploadCAR(carFileIterator, signal = null) {
    const relative = "/api/v0/dag/import?allow-big-block=true&pin-roots=true";
    const toFetch = new URL(relative, this.url);

    const response = await postFormFile({
      url: toFetch,
      file: carFileIterator,
      signal,
    });

    const contents = await response.text();
    const items = contents.split("\n");

    return items
      .filter((line) => line)
      .map((line) => {
        const { Root } = JSON.parse(line);
        const cid = Root.Cid["/"];
        return `ipfs://${cid}/`;
      });
  }

  async uploadFile(fileIterator, fileName = "", signal = null) {
    const relative = "/api/v0/add?pin=true&cid-version=1&inline=false&raw-leaves=true";
    const toFetch = new URL(relative, this.url);

    const isFile = fileIterator.name && fileIterator instanceof Blob;
    // We should just wrap files or things with a name with a directory
    if (fileName || isFile) {
      toFetch.searchParams.set("wrap-with-directory", "true");
    }

    const response = await postFormFile({
      url: toFetch,
      file: fileIterator,
      fileName,
      signal,
    });

    const contents = await response.text();
    const [line] = contents.split("\n");

    const { Hash: cid } = JSON.parse(line);

    const url = `ipfs://${cid}/`;

    await this._pin(url, signal);

    return url;
  }
}

export let hasInterceptedWebRequests = false;
export const shouldInterceptWebRequests = !!(
  globalThis &&
  globalThis.chrome &&
  globalThis.chrome.webRequest &&
  globalThis.chrome.webRequest.onBeforeSendHeaders &&
  globalThis.chrome.webRequest.onBeforeSendHeaders.addListener
);

export async function detectAllDaemons() {
  const potentialGateways = KNOWN_DAEMON_PORTS.map((port) => `http://localhost:${port}`);
  try {
    // Search all the potential gateways in parallel and return the first valid one
    const foundGateway = await Promise.any(
      potentialGateways.map((gateway) =>
        detectDaemon(gateway).then((exists) => {
          if (exists) return gateway;
          throw new Error("Not found");
        })
      )
    );

    if (!foundGateway) return false;

    if (shouldInterceptWebRequests && !hasInterceptedWebRequests) {
      interceptWebRequests(foundGateway);
    }

    return foundGateway;
  } catch {
    return false;
  }
}

// This a funky thing that WebRecorder did to bypass cors
function interceptWebRequests(apiURL) {
  hasInterceptedWebRequests = true;
  globalThis.chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const { requestHeaders } = details;

      for (const header of requestHeaders) {
        if (header.name.toLowerCase() === "origin") {
          header.value = apiURL;
          return { requestHeaders };
        }
      }

      details.requestHeaders.push({ name: "Origin", value: apiURL });
      return { requestHeaders };
    },
    { urls: [apiURL + "/*"] },
    ["blocking", "requestHeaders", "extraHeaders"]
  );
}

export async function detectAgregoreFetch(fetch = globalThis.fetch) {
  try {
    // Should throw error if IPFS is not supported
    // Also throws an error in brave even with IPFS support
    await fetch("ipfs://localhost/", {
      method: "POST",
      body: "",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return true;
  } catch (e) {
    if (debug) console.warn("Unable to detect Agregore", e);
    return false;
  }
}

export async function detectDaemon(url = DEFAULT_DAEMON_API_URL, timeout = 1000, fetch = globalThis.fetch) {
  try {
    const controller = new AbortController();
    const { signal } = controller;
    setTimeout(() => controller.abort(), timeout);
    const response = await fetch(new URL("/api/v0/version", url), {
      method: "POST",
      body: "",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal,
    });
    if (debug) console.log("response:  " + (await response.text()));
    if (response.ok) return true;
    if (response.status === 405) return true;
    return false;
  } catch (e) {
    if (debug) console.warn("Unable to detect Kubo Daemon", e, url);
    return false;
  }
}
