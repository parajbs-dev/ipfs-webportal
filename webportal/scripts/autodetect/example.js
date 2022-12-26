/* global HTMLElement, localStorage, customElements, FormData, CustomEvent */
import { detect, create, choose, defaultChoice, setDebug } from "./index.js";

let debug;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

if (urlParams.has("debug") === true) {
  console.log("Debug = true");
  debug = true;
  setDebug(true);
}

const JBcheck = async (detctedApiUrl) => {
  if (detctedApiUrl !== undefined) {
    console.log("changing API ...");
  }
  const response = await fetch("http://localhost:11945/changeToAPI", {
    method: "POST",
    body: JSON.stringify({ url: detctedApiUrl }),
    headers: {
      Accept: "application/json, */*",
      "Content-Type": "application/json",
    },
  });
  if (detctedApiUrl !== undefined) {
    console.log("response_JB:  " + (await response.text()));

    console.log("PPP33331 :  ");
  }
};

export const OPTIONS_PERSIST_KEY = "auto-ipfs-options";

export class AutoIPFSOptions extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div style="padding: 5px;">
         <details >
            <summary>Settings</summary>
            <select title="Choose which backend you would like to use" style="height:20px; font-size:14px;">
               <option value="" >Autoslect Backend</option>
            </select> 
            <form>
               <table style="font-size:14px;">
                  <tr>
                     <td><label >Kubo Daemon URL:</label></td>
                     <td><input id="kuboURL" name="kuboURL" style="height:16px;" /></td>
                  </tr>
                  <tr>
                     <td><label >Infura ProjectId:</label></td>
                     <td><input id="infuraProjectId" name="infuraProjectId" style="height:16px;"   /></td>
                  </tr>
                  <tr>
                     <td><label >Infura ProjectSecret:</label></td>
                     <td><input id="infuraProjectSecret" name="infuraProjectSecret" style="height:16px;"  type="password" /></td>
                  </tr>
                  <tr>
                     <td><label >Filebase Token:</label></td>
                     <td><input id="filebaseToken" name="filebaseToken" style="height:16px;" /></td>
                  </tr>
                  <tr>
                     <td><label >Web3.Storage Token:</label></td>
                     <td><input id="web3StorageToken" name="web3StorageToken" style="height:16px;" /></td>
                  </tr>
                  <tr>
                     <td><label >NFT.Storage Token:</label></td>
                     <td><input id="nftStorageToken" name="nftStorageToken" style="height:16px;" /></td>
                  </tr>
                  <tr>
                     <td><label >Pinata JWT Key:</label></td>
                     <td><input id="pinataStorageToken" name="pinataStorageToken" style="height:16px;" /></td>
                  </tr>
                  <tr>
                     <td><label >Estuary Token:</label></td>
                     <td><input id="estuaryToken" name="estuaryToken" style="height:16px;"  /></td>
                  </tr>
               </table>
            </form>
         </details>
         `;
    this.form.addEventListener("change", () => this.handleChange());
    this.select.addEventListener("change", () => this.emitLatest());
    this.details.addEventListener("toggle", () => {
      this.saveOptions();
    });
    this.loadOptions();
    this.refreshBackends();
  }

  get select() {
    return this.querySelector("select");
  }

  get form() {
    return this.querySelector("form");
  }

  get details() {
    return this.querySelector("details");
  }

  get opts() {
    const data = new FormData(this.form);

    const opts = {
      readonly: false,
    };

    for (const [key, value] of data.entries()) {
      if (!value) continue;
      opts[key] = value;
    }

    return opts;
  }

  loadOptions() {
    const saved = localStorage.getItem(OPTIONS_PERSIST_KEY);

    if (!saved) return;

    const { opts, detailsOpen } = JSON.parse(saved);

    this.details.toggleAttribute("close", detailsOpen);

    for (const [key, value] of Object.entries(opts)) {
      const element = this.querySelector(`[name=${key}]`);
      if (!element) {
        if (debug) console.warn(`Couldn't find ${key} input`);
        continue;
      }
      element.value = value;
    }
  }

  saveOptions() {
    const { opts, details } = this;
    const detailsOpen = details.open;

    const toSave = JSON.stringify({
      opts,
      detailsOpen,
    });

    localStorage.setItem(OPTIONS_PERSIST_KEY, toSave);
  }

  handleChange() {
    this.saveOptions();
    this.refreshBackends();
  }

  emitLatest() {
    const { selected } = this;
    this.dispatchEvent(new CustomEvent("selected", { detail: unescape(selected) }));
  }

  async refreshBackends() {
    const { opts, select } = this;
    const options = await detect(opts);
    const defaultOption = defaultChoice(options);

    detectedOptionsJB = options;
    //console.log('detectedOptionsJB11:  '+JSON.stringify(detectedOptionsJB[0].url))

    //JBcheck(detectedOptionsJB[0].url);

    console.log("Detected options", opts, options, defaultOption);

    const optionSelects = options
      .map(
        (option) => `
      <option value="${escape(JSON.stringify(option))}">
        ${option.type}
      </option>
    `
      )
      .join("");

    select.innerHTML = `
      ${optionSelects}
      <option value="${escape(JSON.stringify(defaultOption))}" selected>
        default (${defaultOption.type})
      </option>
    `;

    this.emitLatest();
  }

  get selected() {
    return this.querySelector("option:checked").value;
  }
}

export class AutoIPFSUpload extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <label for="files"  style="text-align: center; width: 100%; height: 200px; display: flex; align-items: center; justify-content: center;">
         <i class="fa fa-cloud-upload"></i>
	 <div class="uppy-DragDrop-inner">
            <svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" class="uppy-c-icon uppy-DragDrop-arrow" width="64px" height="64px" viewBox="0 0 128 128" xml:space="preserve">
	       <path d="M0 128V83h17.25v27.75h93.5V83H128v45H0z" fill="#e1e1e1"/>
		  <g>
		     <path d="M80.92 210.95v-51.27h18.15L64 113.18l-35.07 46.5h18.15v51.27h33.84z" fill="#e1e1e1"/>
		     <animateTransform attributeName="transform" type="translate" from="0 0" to="0 -220" dur="9000ms" repeatCount="indefinite"/>
		  </g>
	       </svg>
	    <div class="uppy-DragDrop-label">Drop File/.CAR Or Choose</div>
	    </br>
	    </br>
	    <span class="uppy-DragDrop-note"></span>
	 </div>
         <input id="files" name="files" type="file" aria-hidden="true">
      </label>

	<ul style="display:none;">
      </ul>
    `;

    this.drop.addEventListener("drop", (e) => {
      e.preventDefault();
      console.log("drop", e.dataTransfer);
      this.uploadFiles(e.dataTransfer.files);
    });

    this.drop.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    this.input.addEventListener("change", async (e) => {
      const { files } = this.input;
      await this.uploadFiles(files);
    });
  }

  get drop() {
    return this.querySelector("label");
  }

  get input() {
    return this.querySelector("input");
  }

  get list() {
    return this.querySelector("ul");
  }

  async getAPI() {
    const selected = this.getAttribute("selected");
    if (selected) {
      const parsed = JSON.parse(selected);
      const { api } = await choose(parsed);
      return api;
    } else {
      const { api } = await create();
      return api;
    }
  }

  listFile(name, url) {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${url}">${name}: ${url}</a>`;

    this.list.appendChild(li);
  }

  async uploadFiles(fileList) {
    for (const file of fileList) {
      if (file.size < 35193653) {
        console.log("file.size:  " + file.size);
        console.log("uploading", file);

        if (file.name.endsWith(".car")) {
          this.uploadCar(file);
        } else {
          this.uploadFile(file);
        }
      } else {
        console.log("file.size large:  " + file.size);
        console.log("uploading LARGE", file);

        if (file.name.endsWith(".car")) {
          this.uploadCar(file);
        } else {
          this.uploadLargeFile(file);
        }
      }
    }
  }

  async uploadFile(file) {
    const api = await this.getAPI();
    const url = await api.uploadFile(file);
    const url1 = url.slice(7);
    const url2 = url1.slice(0, -1);
    outputCid(file.name, url2, "striped", "");
  }

  async uploadLargeFile(file) {
    console.log("detectedOptionsJB113:  " + JSON.stringify(detectedOptionsJB[0].url));
    JBcheck(detectedOptionsJB[0].url);

    var upload = new tus.Upload(file, {
      metadata: {
        name: file.name,
      },
      endpoint: TusUploadServer + "/files/",
      retryDelays: [0, 1000, 3000, 5000],
      onError: function (error) {
        console.log("Failed because: " + error);
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        var percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        progressBar.style.width = `${percentage}%`;
        console.log(bytesUploaded, bytesTotal, percentage + "%");
      },
      onSuccess: async function () {
        ids.push(upload.url.replace(TusUploadServer + "/files/", ""));
        await addToIPFS();
        setTimeout(function () {
          checkID(upload.file.name);
        }, 2000);
        const refreshId = setInterval(() => {
          let cidHash2 = document.getElementById("cidHash").innerHTML;
          const properID = cidHash2;
          if (properID !== "") {
            console.log(" ");
            console.log(">>> Hash:  " + properID);
            progressBar.style.width = `0%`;
            clearInterval(refreshId);
            JBcheck(undefined);
          }
          if (properID === "") {
            checkID(upload.file.name);
          }
        }, 3000);
      },
    });
    // Start the upload
    upload.start();
    document.getElementById("cidA").innerHTML = "";
    document.getElementById("cidHash").innerHTML = "";
    document.getElementById("upload_cid").style.display = "none";
    document.getElementById("btn1").style.display = "none";
    document.getElementById("urlCopyButton").style.display = "none";
    progressBar.style.width = `0%`;
  }

  async uploadCar(file) {
    const api = await this.getAPI();
    console.log({ api, file });
    const [url] = await api.uploadCAR(file);
    const url2 = url.slice(7);
    const url3 = url2.slice(0, -1);
    outputCid(file.name, url3, "info", "");
    this.listFile(file.name, url);
  }
}

let zzu;

const fileInput = document.querySelector("#inputDir");

const uploadDir = (file) => {
  console.log("Uploading file...");
  const API_ENDPOINT = IpfsApiServer + "/api/v0/add?pin=true&recursive=true&wrap-with-directory=false";
  const request = new XMLHttpRequest();
  const formData = new FormData();

  request.open("POST", API_ENDPOINT, true);
  request.onreadystatechange = () => {
    if (request.readyState === 4 && request.status === 200) {
      zzu = request.response;
    }
  };

  request.send(file);

  request.onloadend = function () {
    let zzu2 = zzu.replace(/\n/g, ", ");
    let zzu3 = zzu2.slice(0, -2);
    let zzu4 = zzu3.split(", ");
    let zzu5 = JSON.parse(zzu4[zzu4.length - 1]);
    outputCid(zzu5.Name, zzu5.Hash, "warning", "/");
  };
};

const JBcheck2 = () => {
  console.log("checking ...");
  const API_ENDPOINT = TusUploadServer + "/changeToAPI";
  const request = new XMLHttpRequest();
  const formData = new FormData();

  request.open("POST", API_ENDPOINT, true);
  request.onreadystatechange = () => {
    if (request.readyState === 4 && request.status === 200) {
      console.log("PPP:  " + request.response);
    }
  };

  request.send(formData);

  request.onloadend = function () {
    console.log("PPP3333 :  ");
  };
};

fileInput.addEventListener("change", (event) => {
  async function ttt() {
    const formData = new FormData();
    const files = event.target.files;
    for await (const file of files) {
      formData.append("file", file);
    }
    uploadDir(formData);
  }
  ttt();
});

async function outputCid(file, cid, design, dirEnd) {
  // done
  $(".qr-code").empty();
  res_cid = cid;
  var uploadFileName = file;
  let cidA_FileName = (document.getElementById("cidA").innerHTML = uploadFileName + dirEnd);
  let cidA_Href = (document.getElementById("cidA").href =
    IpfsGataway + "/ipfs/" + res_cid + "/?filename=" + uploadFileName);
  if (res_cid !== "") {
    let cidHash = (document.getElementById("cidHash").innerHTML = "IPFS Hash : " + res_cid);
    let urlCopyButton = (document.getElementById("foo").value =
      IpfsGataway + "/ipfs/" + res_cid + "/?filename=" + uploadFileName);
    let btn11 = (document.getElementById("btn1").style.display = "block");
    let urlCopyButton1 = (document.getElementById("urlCopyButton").style.display = "block");
    //    let mySmallModalLabel = (document.getElementById("mySmallModalLabel").innerHTML = uploadFileName);
    let mySmallModalLabel = (document.getElementById("mySmallModalLabel").innerHTML = "QR-CODE");

    generate({
      value: IpfsGataway + "/ipfs/" + res_cid + "/?filename=" + uploadFileName,
    });
  }
  let hhhz = (document.getElementById("upload_cid").style.display = "contents");

  if (res_cid !== "") {
    const table = document.createElement("table");
    table.innerHTML = `
        <colgroup>
           <col width="90%">
           <col width="10%">
        </colgroup>
        <tbody style="background-color:white ;">
           <tr >
	      <td style="white-space: nowrap; text-overflow:ellipsis; overflow: hidden; max-width:1px;">
	         <div class="d-flex justify-content-between align-items-start">
                    <div class="ms-2 me-auto d-inline-block">
		       <div class="fw-bold">
			  <a style="text-decoration: none;" href="${IpfsGataway}/ipfs/${res_cid}/?filename=${uploadFileName}" target="_blank">${uploadFileName}${dirEnd}</a>
		       </div>
		       <div>IPFS Hash : ${res_cid}</div>
		    </div>
		 </div>
	      </td>
	      <td>
	         <button type='button' onclick='$(".qr-code2").empty(); generate_uploadList({ value: "${IpfsGataway}/ipfs/${res_cid}/?filename=${uploadFileName}" }); $(".fff").modal("show")'  class="btn btn2  btn-primary " style=" --bs-btn-padding-y: .25rem; --bs-btn-padding-x: .5rem; --bs-btn-font-size: .75rem;">
		    <span class="bi bi-clipboard"></span>
		    <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" fill="currentColor" class="bi bi-qr-code" viewBox="0 0 16 16">
                       <path d="M2 2h2v2H2V2Z"/>
                       <path d="M6 0v6H0V0h6ZM5 1H1v4h4V1ZM4 12H2v2h2v-2Z"/>
                       <path d="M6 10v6H0v-6h6Zm-5 1v4h4v-4H1Zm11-9h2v2h-2V2Z"/>
                       <path d="M10 0v6h6V0h-6Zm5 1v4h-4V1h4ZM8 1V0h1v2H8v2H7V1h1Zm0 5V4h1v2H8ZM6 8V7h1V6h1v2h1V7h5v1h-4v1H7V8H6Zm0 0v1H2V8H1v1H0V7h3v1h3Zm10 1h-1V7h1v2Zm-1 0h-1v2h2v-1h-1V9Zm-4 0h2v1h-1v1h-1V9Zm2 3v-1h-1v1h-1v1H9v1h3v-2h1Zm0 0h3v1h-2v1h-1v-2Zm-4-1v1h1v-2H7v1h2Z"/>
                       <path d="M7 12h1v3h4v1H7v-4Zm9 2v2h-3v-1h2v-1h1Z"/>
                    </svg>
		 </button>
	      </td>
	      <td>
		 <button  type="button"  onclick="navigator.clipboard.writeText('${IpfsGataway}/ipfs/${res_cid}/?filename=${uploadFileName}')"   class="btn  btn-primary "  style="--bs-btn-padding-y: .25rem; --bs-btn-padding-x: .5rem; --bs-btn-font-size: .75rem;">
		    <span class="bi bi-clipboard"></span> COPY LINK
	         </button>
	      </td>
	   </tr>
        </tbody>`;
    table.className = "table table-" + design + " table-hover";
    table.style = "width: 100%; background-color:blue ;";
    uploadList.appendChild(table);
  }
}

var clipboard = new ClipboardJS(".btncopy");

clipboard.on("success", function (e) {
  e.clearSelection();
});

clipboard.on("error", function (e) {
  console.error("Action:", e.action);
  console.error("Trigger:", e.trigger);
});

$(function () {
  var dropZoneId = "drop-zone";
  var buttonId = "clickHere";
  var mouseOverClass = "mouse-over";
  var dropZone = $("." + dropZoneId);
  var ooleft = dropZone.offset().left;
  var ooright = dropZone.outerWidth() + ooleft;
  var ootop = dropZone.offset().top;
  var oobottom = dropZone.outerHeight() + ootop;
  var inputFile = dropZone.find("input");
  var userSelection = document.getElementsByClassName(dropZoneId);
  for (let i = 0; i < userSelection.length; i++) {
    userSelection[i].addEventListener(
      "dragover",
      function (e) {
        console.log("Clicked index: " + i);
        e.preventDefault();
        e.stopPropagation();
        dropZone.addClass(mouseOverClass);
        var x = e.pageX;
        var y = e.pageY;
        if (!(x < ooleft || x > ooright || y < ootop || y > oobottom)) {
          inputFile.offset({ top: y - 15, left: x - 100 });
        } else {
          inputFile.offset({ top: -400, left: -400 });
        }
      },
      true
    );
  }
  if (buttonId != "") {
    var clickZone = $("#" + buttonId);
    var oleft = clickZone.offset().left;
    var oright = clickZone.outerWidth() + oleft;
    var otop = clickZone.offset().top;
    var obottom = clickZone.outerHeight() + otop;
    document.getElementById("file").style.opacity = 0.0;
    $("#" + buttonId).mousemove(function (e) {
      var x = e.pageX;
      var y = e.pageY;
      if (!(x < oleft || x > oright || y < otop || y > obottom)) {
        inputFile.offset({ top: y - 15, left: x - 160 });
      } else {
        inputFile.offset({ top: -400, left: -400 });
      }
    });
  }
  for (let i = 0; i < userSelection.length; i++) {
    userSelection[i].addEventListener(
      "drop",
      function (e) {
        $("#" + dropZoneId).removeClass(mouseOverClass);
      },
      true
    );
  }
});

var ids = [];
var cid;
let id_res;
let res_cid;
const progress = document.querySelector(".progress");
const progressBar = progress.querySelector(".bar");
const uploadList = document.querySelector("#upload-list");
const qr_code_element = document.querySelector(".qr-code");

export var generate = function generate(user_input) {
  qr_code_element.style = "";

  var qrcode = new QRCode(qr_code_element, {
    text: `${user_input.value}`,
    width: 180, //128
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });

  let download = document.createElement("button");
  qr_code_element.appendChild(download);

  let download_link = document.createElement("a");
  download_link.setAttribute("download", "qr_code.png");
  download_link.innerHTML = `QR-Code <i class="fa-solid fa-download"></i>`;
  download.appendChild(download_link);

  let download2 = document.createElement("button");
  qr_code_element.appendChild(download2);

  let download_link2 = document.createElement("a");
  download_link2.setAttribute("download2", "qr_code.png");
  download_link2.innerHTML = `Sharing <i class="fa-solid fa-download"></i>`;
  download2.appendChild(download_link2);

  if (!navigator.share) {
    throw new Error("Web Share API is not supported.");
  }

  download2.onclick = (e) => {
    navigator.share({
      title: "Share ipfs cid",
      text: "Check out this Ipfs Cid shared over locahost:8080 !",
      url: `${user_input.value}`,
    });
  };

  let qr_code_img = document.querySelector(".qr-code img");
  let qr_code_canvas = document.querySelector("canvas");

  if (qr_code_img.getAttribute("src") == null) {
    setTimeout(() => {
      download_link.setAttribute("href", `${qr_code_canvas.toDataURL()}`);
      //      download_link2.setAttribute("href", `${qr_code_canvas.toDataURL()}`);
    }, 300);
  } else {
    setTimeout(() => {
      download_link.setAttribute("href", `${qr_code_img.getAttribute("src")}`);
      //      download_link2.setAttribute("href", `${qr_code_img.getAttribute("src")}`);
    }, 300);
  }
};

var addToIPFS = async function () {
  // construct an HTTP request
  var xhr = new XMLHttpRequest();
  xhr.open("POST", TusUploadServer + "/addToIPFS", true);
  xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");

  // send the collected data as JSON
  xhr.send(JSON.stringify({ fileids: ids }));

  xhr.onloadend = function () {
    // done
    ids = [];
    id_res = JSON.parse(xhr.response);
  };
};

var checkID = async function (uploadFileName) {
  // construct an HTTP request
  var xhr = await new XMLHttpRequest();
  xhr.open("GET", TusUploadServer + "/check/" + id_res.id, true);
  xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");

  // send the collected data as JSON
  xhr.send(null);

  xhr.onloadend = await function () {
    res_cid = JSON.parse(xhr.response);
    outputCid(uploadFileName, res_cid.cid, "success", "");
  };
};

customElements.define("auto-ipfs-options", AutoIPFSOptions);
customElements.define("auto-ipfs-upload", AutoIPFSUpload);
