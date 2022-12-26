import axios from "axios";
import process from "process";
import minimist from "minimist";
import FormData from "form-data";
import fs from "fs";
import devcert from "devcert";
import express from "express";
import https from "https";
import bodyParser from "body-parser";

import tus from "tus-node-server";
const server = new tus.Server();
import { v4 as Uid } from "uuid";
import { create } from "ipfs-http-client";

import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = minimist(process.argv.slice(2));
const httpsFlag = argv["https"];

var ssl
var port;
var host;
var ipfsapiHost;
var ipfsapiPort;
var ipfsapiProtocol;
var ipfs;
var ipfsapiHostUrl;
var files = [];
var ipfsStatus = [];
var ipfsState = "idle";
var fsState = "idle";
var dataFile = __dirname + "/data.json";
var configFile = __dirname + "/config.json";

if (fs.existsSync(configFile)) {
  const config = JSON.parse(fs.readFileSync(configFile));
  port = config.tusport;
  host = config.tushost;
  ipfsapiHost = config.ipfshost;
  ipfsapiPort = config.ipfsapiport;
  ipfsapiProtocol = config.ipfsprotocol;
} else {
  port = 11945;
  host = "localhost";
  ipfsapiHost = "localhost";
  ipfsapiPort = "5001";
  ipfsapiProtocol = "http";
}

if (fs.existsSync(dataFile)) {
  files = JSON.parse(fs.readFileSync(dataFile)).files;
  ipfsStatus = JSON.parse(fs.readFileSync(dataFile)).ipfsStatus;
} else {
  fs.writeFile(dataFile, '{"files":[], "ipfsStatus": []}');
}

const fileNameFromUrl = (req) => {
  var id = Uid();
  files.push({ id: id, name: req.headers["upload-metadata"].split(" ")[1] });
  return id;
};

server.datastore = new tus.FileStore({
  path: "/files",
  namingFunction: fileNameFromUrl,
});

// ############## express server #######################################
const app = express();
if (httpsFlag === true) {
  ssl = await devcert.certificateFor([host]);
}

app.use(bodyParser.json());

// Add headers
app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Request methods you wish to allow
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  // Request headers you wish to allow
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");
  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);
  // Pass to next layer of middleware
  next();
});

app.all("/files/*", function (req, res) {
  server.handle(req, res);
});

app.post("/changeToAPI", async function (req, res) {
  // move to folder, change files name back to normal, add folder to IPFS
  if (!req.body) {
    res.send("Error, please include POST data.");
    return;
  }

  ipfsapiHostUrl = req.body.url;

  if (ipfsapiHostUrl !== undefined) {
    res.send({ url: ipfsapiHostUrl, protocol: "http", host: "localhost", port: "5001" });
  } else {
    res.send({ url: ipfsapiHostUrl, protocol: ipfsapiHostUrl, host: ipfsapiHostUrl, port: ipfsapiHostUrl });
  }
});

app.post("/addToIPFS", function (req, res) {
  // move to folder, change files name back to normal, add folder to IPFS
  if (!req.body || !req.body.fileids) {
    res.send("Error, please include POST data.");
    return;
  }
  var ids = req.body.fileids;
//  var ids2 = req.body;
  if (!ids.length || ids.length == 0) {
    res.send("Please submit ids to add to IPFS!");
    return;
  }
  // Get a new Uid for a folder name.
  var id = Uid();
  ipfsStatus.push({ id: id, ids: ids, status: "not_started", cid: "" });
  res.send({ id: id, ids: ids, status: "not_started", cid: "" });
});

app.get("/check/:id", function (req, res) {
  var matched = false;
  for (var i = 0; i < ipfsStatus.length; i++) {
    if (req.params.id === ipfsStatus[i].id) {
      matched = true;
      res.send(ipfsStatus[i]);
    }
  }
  if (!matched) {
    res.send({ id: req.params.id });
  }
});

if (httpsFlag === true) {
  https.createServer(ssl, app).listen(port, host);
  console.log("Started IPFS-WEBPORTAL on https://" + host + ":" + port + "/webportal/");
}

if (httpsFlag === false || httpsFlag === null || httpsFlag === undefined ) {
  app.listen(port, host);
  console.log("Started IPFS-WEBPORTAL on http://" + host + ":" + port + "/webportal/");
}

app.use("/assets", express.static(__dirname + "/assets"));
app.use("/webportal", express.static(__dirname + "/webportal"));

// ############## express server end ####################################

var writeDataFile = function () {
  fs.writeFileSync(dataFile, JSON.stringify({ files: files, ipfsStatus: ipfsStatus }, null, 4));
};

// Every 5 minutes save file.
setInterval(function () {
  writeDataFile();
}, 5 * 60 * 1000);

//var processIPFS = async function (callback) {
var processIPFS = async function () {
//  var cbCalled = false;
  for (var i = 0; i < ipfsStatus.length; i++) {
    if (ipfsStatus[i].status === "not_started" || ipfsStatus[i].status === "ipfs_directory_create_fail") {
      ipfsStatus[i].status = "ipfs_directory_create_start";
      // Make the directory
      makeIPFSDirectory(i);
    } else if (
      ipfsStatus[i].status === "ipfs_directory_create_complete" ||
      ipfsStatus[i].status === "ipfs_file_copy_start" ||
      ipfsStatus[i].status === "ipfs_file_copy_inprogress" ||
      ipfsStatus[i].status === "ipfs_file_copy_queue"
    ) {
      ipfsStatus[i].status = "ipfs_file_copy_start";
      // Move the files into place.
      copyFilesToIPFSDirectory(i);
    } else if (
      ipfsStatus[i].status === "ipfs_file_copy_complete" ||
      ipfsStatus[i].status === "ipfs_file_add_retry" ||
      ipfsStatus[i].status === "waiting_on_ipfs_add_queue"
    ) {
      ipfsStatus[i].status = "ipfs_file_add_start";
      const addedCid = await addFilesToIPFS(i);
      ipfsStatus[i].cid = await addedCid.toString();
      console.log("Hash:   " + (await addedCid.toString()));
    } else if (
      ipfsStatus[i].status === "ipfs_file_add_start" ||
      ipfsStatus[i].status === "ipfs_file_add_success" ||
      ipfsStatus[i].status === "ipfs_file_add_error" ||
      ipfsStatus[i].status === "ipfs_add_check_error"
    ) {
      checkIPFSaddStatus(i);
    }
    // Cleanup the dir since the add was successful.
    //rimraf(__dirname + '/ipfs/' + id + '/', function(){});
  }
};

var makeIPFSDirectory = function (ipfsNum) {
  if (!fs.existsSync(__dirname + "/ipfs/")) {
    fs.mkdirSync(__dirname + "/ipfs/");
  }
  if (fs.existsSync(__dirname + "/ipfs/" + ipfsStatus[ipfsNum].id)) {
    ipfsStatus[ipfsNum].status = "ipfs_directory_create_complete";
  } else {
    fs.mkdir(__dirname + "/ipfs/" + ipfsStatus[ipfsNum].id, function (err) {
      if (err) {
        console.log(err);
        ipfsStatus[ipfsNum].status = "ipfs_directory_create_fail";
        return;
      }
      ipfsStatus[ipfsNum].status = "ipfs_directory_create_complete";
    });
  }
};

var copyFilesToIPFSDirectory = function (ipfsNum) {
  var allAdded = true;
  for (var i = 0; i < ipfsStatus[ipfsNum].ids.length; i++) {
    if (!ipfsStatus[ipfsNum].ids[i]) continue;
    var match = false;
    for (var j = 0; j < files.length; j++) {
      if (files[j].id == ipfsStatus[ipfsNum].ids[i]) {
        match = true;
        if (fs.existsSync(__dirname + "/files/" + ipfsStatus[ipfsNum].ids[i])) {
          var decodedName = Buffer.from(files[j].name, "base64").toString("ascii");
          // If we have already copied the file, move on.
          var checkStat = false;
          var mainStat, copyStat;
          if (fs.existsSync(__dirname + "/ipfs/" + ipfsStatus[ipfsNum].id + "/" + decodedName)) {
            checkStat = true;
            mainStat = fs.statSync(__dirname + "/files/" + ipfsStatus[ipfsNum].ids[i]);
            copyStat = fs.statSync(__dirname + "/ipfs/" + ipfsStatus[ipfsNum].id + "/" + decodedName);
          }
          if (checkStat && mainStat.size === copyStat.size) {
            continue;
          } else {
            allAdded = false;
            if (fsState != "idle" && !ipfsStatus[ipfsNum].copyStart) {
              ipfsStatus[ipfsNum].status = "ipfs_file_copy_queue";
            } else {
              ipfsStatus[ipfsNum].status = "ipfs_file_copy_inprogress";
            }
            copyFile(
              __dirname + "/files/" + ipfsStatus[ipfsNum].ids[i],
              __dirname + "/ipfs/" + ipfsStatus[ipfsNum].id + "/" + decodedName,
              function (err) {
                if (err) {
                  console.log(err);
                  ipfsStatus[ipfsNum].status = "ipfs_file_copy_error";
                }
              }
            );
          }
        } else {
          console.log("File does not exist! " + ipfsStatus[ipfsNum].ids[i]);
          ipfsStatus[ipfsNum].status = "ipfs_file_does_not_exist";
        }
      }
    }
    if (!match) {
      allAdded = false;
    }
  }
  if (allAdded) {
    ipfsStatus[ipfsNum].status = "ipfs_file_copy_complete";
    fs.rmSync(__dirname + "/files/" + ipfsStatus[ipfsNum].ids, { recursive: true, force: true });
  }
};

var copyFile = function (source, target, cb) {
  if (fsState != "idle") return;
  fsState = "copying";
  var cbCalled = false;

  function done(err) {
    fsState = "idle";
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }

  var rd = fs.createReadStream(source);
  rd.on("error", function (err) {
    done(err);
  });

  var wr = fs.createWriteStream(target);
  wr.on("error", function (err) {
    done(err);
  });

//  wr.on("close", function (ex) {
  wr.on("close", function () {
    done();
  });
  rd.pipe(wr);
};

var addipfs = async function (odir, ofname) {
  const form = new FormData();
  form.append("file", fs.readFileSync(odir + ofname), ofname);
  const response = await axios.post("http://127.0.0.1:5001/api/v0/add", form, {
    headers: {
      ...form.getHeaders(),
    },
  });

  return response.data.Hash;
};

var addFilesToIPFS = async function (ipfsNum) {
  let fname;
  let upCid;
  if (ipfsState === "idle") {
    ipfsState = "addingFolder";
    ipfsStatus[ipfsNum].status = "ipfs_file_add_inprogress";
    var idir = __dirname + "\\ipfs\\" + ipfsStatus[ipfsNum].id + "\\";

    await fs.readdirSync(idir).forEach(async (file) => {
      fname = file;
    });

    upCid = await addipfs(idir, fname);
    ipfsState = "idle";
    ipfsStatus[ipfsNum].status = "ipfs_file_add_success";
    ipfsStatus[ipfsNum].cid = upCid;
    fs.rmSync(__dirname + "\\ipfs\\" + ipfsStatus[ipfsNum].id + "\\", { recursive: true, force: true });
  } else {
    ipfsStatus[ipfsNum].status = "waiting_on_ipfs_add_queue";
  }
  ipfsStatus[ipfsNum].cid = upCid;
  return upCid;
};

var checkIPFSaddStatus = function (ipfsNum) {
  if (!ipfsStatus[ipfsNum] || !ipfsStatus[ipfsNum].mainHash) {
    if (ipfsStatus[ipfsNum].status === "ipfs_file_add_error") {
      ipfsStatus[ipfsNum].status = "ipfs_file_add_retry";
    }
    return;
  }

  ipfs.object.links(ipfsStatus[ipfsNum].mainHash, { enc: "base58" }, function (err, result) {
    if (err) {
      ipfsStatus[ipfsNum].status = "ipfs_add_check_error";
      console.log(err);
      return;
    }
    var allAdded = true;
    for (var k = 0; k < result.length; k++) {
      var matched = false;
      for (var i = 0; i < ipfsStatus[ipfsNum].ids.length; i++) {
        for (var j = 0; j < files.length; j++) {
          if (files[j].id == ipfsStatus[ipfsNum].ids[i]) {
            var decodedName = Buffer.from(files[j].name, "base64").toString("ascii");
            if (decodedName === result[k]._name) {
              matched = true;
            }
          }
        }
      }
      if (!matched) {
        allAdded = false;
        console.log("File not added for: " + result[k]._name);
      }
    }
    if (allAdded) {
      ipfsStatus[ipfsNum].status = "ipfs_file_check_complete";
    } else {
      ipfsStatus[ipfsNum].status = "ipfs_file_add_retry";
    }
  });
};

// Process IPFS every 1 second
setInterval(function () {
  processIPFS();
  if (ipfsapiHostUrl === undefined) {
    ipfs = create({ host: ipfsapiHost, port: ipfsapiPort, protocol: ipfsapiProtocol });
  } else {
    var apiHostUrl = ipfsapiHostUrl;
    var apiHostUrlSplit1 = apiHostUrl.split(":");
    var apiHostProtocol = apiHostUrlSplit1[0];
    var apiHostSplit2 = apiHostUrlSplit1[1];
    var apiHost = apiHostSplit2.slice(2);
    var apiHostPortSplit3 = apiHostUrlSplit1[2];
    var apiHostPort = apiHostPortSplit3.slice(0, -1);
    ipfs = create({ host: apiHost, port: apiHostPort, protocol: apiHostProtocol });
  }
}, 1 * 1000);

//processIPFSTimeout;
process.stdin.resume(); //so the program will not close instantly
function exitHandler(options, err) {
  writeDataFile();
  if (err) console.log(err.stack);
  if (options.exit) process.exit();
}
//do something when app is closing
process.on("exit", exitHandler.bind(null, { cleanup: true }));
//catches ctrl+c event
process.on("SIGINT", exitHandler.bind(null, { exit: true }));
//catches uncaught exceptions
process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
