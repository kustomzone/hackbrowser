'use strict';

/**
 * TabView consists of a browser tab and it's associated webview
 *
 * @param {HackBrowserWindowController} hackBrowserWindow - the browser window
 * @param {BrowserTabBar} browserTabBar
 * @param {string} url - initial url
 *
 * @constructor
 */
function TabView(hackBrowserWindow, browserTabBar, url) {
	let _this = this;

	const fs = require('fs');
	const electron = require('electron');
	const {remote} = require('electron');
	const logger = remote.getGlobal('__app').logger;

	/* ====================================
	 private member variables
	 ====================================== */
	var webViewEl;
	var webViewTitle;
	var webViewURL;
	var webViewContainerEl;
	var webViewWrapperEl;
	var webViewStatusBoxEl;
	var searchBox;
	var searchBoxEl;
	var tabViewId;
	var browserTab;
	var isDOMReady;


	/* ====================================
	 private methods
	 ====================================== */
	/**
	 * create a new <webview> element and linked browser tab
	 *
	 * @param url
	 */
	var init = function(url) {
		webViewEl = document.createElement("webview");
		webViewWrapperEl = document.createElement("div");
		webViewWrapperEl.classList.add("webview-wrapper");
		webViewWrapperEl.style.visibility = "hidden";
		webViewStatusBoxEl = document.createElement("div");
		webViewStatusBoxEl.classList.add("status-message-box");
		webViewTitle = "New Tab";
		webViewURL = url;
		webViewContainerEl = document.getElementById("webview-container"); 
		isDOMReady = false;
		tabViewId = "wv-" + hackBrowserWindow.getCreatedTabViewCount();

		// increase created tab view count
		hackBrowserWindow.incrementCreatedTabViewCount();

		// assign tabViewId to <webview> element's id
		webViewEl.setAttribute("id", tabViewId);
		webViewEl.setAttribute("plugins", "");
		webViewEl.setAttribute("disablewebsecurity", "");

		if (url === null) {
			_this.navigateTo("./new-tab.html");
		} else {
			_this.navigateTo(url);
		}

		// append search box
		searchBox = new SearchBox(_this);
		searchBoxEl = searchBox.getSearchWrapperEl();

		// append the webview element to screen (#webview-container)
		webViewWrapperEl.appendChild(webViewEl);
		webViewWrapperEl.appendChild(searchBoxEl);
		webViewWrapperEl.appendChild(webViewStatusBoxEl); 
		webViewContainerEl.appendChild(webViewWrapperEl); 

		browserTab = browserTabBar.createTab(tabViewId);
		attachEventHandlers();
	};

	/**
	 * attach event handlers for <webview> events
	 */
	var attachEventHandlers = function() {
		/*
			<webview> events are fired in the following order

			did-start-loading
			did-get-response-details
			load-commit
			did-navigate
			page-title-updated
			dom-ready
			page-favicon-updated
			did-stop-loading
			did-frame-finish-load
			did-finish-load
		 */

		webViewEl.addEventListener("load-commit", handleLoadCommit);
		webViewEl.addEventListener("did-finish-load", handleDidFinishLoad);
		webViewEl.addEventListener("did-fail-load", handleDidFailLoad);
		webViewEl.addEventListener("did-frame-finish-load", handleDidFrameFinishLoad);
		webViewEl.addEventListener("did-start-loading", handleDidStartLoading);
		webViewEl.addEventListener("did-stop-loading", handleDidStopLoading);
		webViewEl.addEventListener("did-get-response-details", handleDidGetResponseDetails);
		webViewEl.addEventListener("did-get-redirect-request", handleDidGetRedirectRequest);
		webViewEl.addEventListener("dom-ready", handleDOMReady);
		webViewEl.addEventListener("page-title-updated", handlePageTitleUpdated);
		webViewEl.addEventListener("page-favicon-updated", handlePageFaviconUpdated);
		webViewEl.addEventListener("new-window", handleNewWindow);
		webViewEl.addEventListener("will-navigate", handleWillNavigate);
		webViewEl.addEventListener("did-navigate", handleDidNavigate);
		webViewEl.addEventListener("did-navigate-in-page", handleDidNavigateInPage);
		webViewEl.addEventListener("console-message", handleConsoleMessage);
		webViewEl.addEventListener("crashed", handleCrashed); 
		webViewEl.addEventListener("gpu-crashed", handleGPUCrashed); 
		webViewEl.addEventListener("plugin-crashed", handlePluginCrashed); 
		webViewEl.addEventListener("update-target-url", handleUpdateTargetURL); 
	};

	var handleLoadCommit = function(e) {
		console.log("[" + tabViewId + "] load-commit");

		if (e.isMainFrame === true) {
			webViewURL = e.url;

			if (hackBrowserWindow.getActiveTabView() === _this) {
				hackBrowserWindow.updateWindowTitle(webViewURL);
			}

			if (hackBrowserWindow.getActiveTabView() === _this) {
				hackBrowserWindow.updateWindowControls();
			}
		}
	};

	// 'did-finish-load' event fires after onload event is dispatched from the WebView
	var handleDidFinishLoad = function() {
		console.log("[" + tabViewId + "] did-finish-load");
	};

	var handleDidFailLoad = function(e) {
		console.log("[" + tabViewId + "] did-fail-load");
		console.log(e);
	};

	var handleDidFrameFinishLoad = function(e) {
		console.log("[" + tabViewId + "] did-frame-finish-load");
		webViewURL = webViewEl.getURL();
	};

	var handleDidStartLoading = function() {
		console.log("[" + tabViewId + "] did-start-loading");

		// set loading icon
		browserTab.startLoading();

		if (hackBrowserWindow.getActiveTabView() === _this) {
			hackBrowserWindow.getMenuBar().showLoadStopBtn();
		}
	};

	var handleDidStopLoading = function() {
		console.log("[" + tabViewId + "] did-stop-loading");

		// clear loading icon
		browserTab.stopLoading();

		// notify navigation details to main process
		var navigationInfo = {
			url: webViewURL,
			title: webViewTitle
		};

		// save URL to navigation history
		hackBrowserWindow.getNavigationHistoryHandler().addNavigationHistory(navigationInfo, function() {});

		if (hackBrowserWindow.getActiveTabView() === _this) {
			hackBrowserWindow.getMenuBar().showReloadBtn();
		}
	};

	var handleDidGetResponseDetails = function(e) {
		console.log("[" + tabViewId + "] did-get-response-details");
	};

	var handleDidGetRedirectRequest = function(e) {
		console.log("[" + tabViewId + "] did-get-redirect-request");
	};

	var handleDOMReady = function() {
		console.log("[" + tabViewId + "] dom-ready");

		var TRACK_SCRIPT_PATH = __dirname + "/../js/browser-window/inject/inject-to-webview.js";

		isDOMReady = true;

		// insert custom script to <webview> to handle click events
		fs.readFile(TRACK_SCRIPT_PATH, "utf-8", function(err, injectScript) {
			if (err) {
				console.log("[" + tabViewId + "] error loading inject script");
				return;
			}

			webViewEl.executeJavaScript(injectScript);
			console.log("[" + tabViewId + "] successfully injected script to webview");
		});
	};

	var handlePageTitleUpdated = function(e) {
		console.log("[" + tabViewId + "] page-title-updated");

		webViewTitle = e.title;

		// update tab title
		_this.updateTabTitle(webViewTitle);

		if (hackBrowserWindow.getActiveTabView() === _this) {
			hackBrowserWindow.updateWindowTitle(webViewTitle);
		}
	};

	var handlePageFaviconUpdated = function(e) {
		console.log("[" + tabViewId + "] page-favicon-updated");

		// the last element in favicons array is used
		// TODO: if multiple favicon items are returned and last element is invalid, use other ones
		_this.updateTabFavicon(e.favicons[e.favicons.length - 1]);
	};

	var handleNewWindow = function(e) {
		console.log("[" + tabViewId + "] new-window");

		hackBrowserWindow.addNewTab(e.url, true);

		console.log(e);
	};

	var handleWillNavigate = function(e) {
		console.log("[" + tabViewId + "] will-navigate");
		console.log(e);
	};

	var handleDidNavigate = function(e) {
		console.log("[" + tabViewId + "] did-navigate");
		console.log(e);

		webViewURL = e.url;
	};

	var handleDidNavigateInPage = function(e) {
		console.log("[" + tabViewId + "] did-navigate-in-page");
		console.log(e);
	};

	var handleConsoleMessage = function(e) {
		console.log("[" + tabViewId + "] console-message");

		// check if message text begins with curly braces (for json format)
		// most of the time, non-json formats would be filtered here
		// if the first character of message text is curly braces
		// but the message text is not json format, an exception is thrown
		if (e.message[0] == '{') {
			try {
				var msgObject = JSON.parse(e.message);
				console.log(msgObject);

				// if contextmenu action, pass it to context menu handler
				if (msgObject.eventType === "contextmenu") {
					hackBrowserWindow.getContextMenuHandler().handleWebViewContextMenu(msgObject);
				}

				// record click event
				else if (msgObject.eventType === "click") {
				}

				else if (msgObject.eventType === "scroll") {
				}

				else if ((msgObject.eventType === "focus") && (msgObject.type === "input/password")) {
				}

				else if (msgObject.eventType === "blur") {
					if ((msgObject.type === "input/password") || (msgObject.type === "input/search") || (msgObject.type === "input/email") || (msgObject.type === "input/text") || (msgObject.type === "textarea")) {

					}
				}
			} catch(err) {
				// console.error(err);
				// since the console-message is not a HackBrowser message, do nothingq
			}
		}
	};

	var handleCrashed = function(e) {
		console.log("[" + tabViewId + "] crashed");
		console.log(e);
	};

	var handleGPUCrashed = function(e) {
		console.log("[" + tabViewId + "] gpu-crashed");
		console.log(e);
	};

	var handlePluginCrashed = function(e) {
		console.log("[" + tabViewId + "] plugin-crashed");
		console.log(e); 
	};

	var handleUpdateTargetURL = function(e) {
		console.log("[" + tabViewId + "] update-target-url");
		console.log(e); 

		displayStatusMessage(e.url); 
	};

	var displayStatusMessage = function(msg) {
		if (!msg || msg === "") {
			webViewStatusBoxEl.style.display = "none"; 
		}

		else {
			webViewStatusBoxEl.style.display = "block"; 
		}

		webViewStatusBoxEl.innerHTML = msg;

		// Get the Display object where mouse cursor is located at
		let currentCursorPoint = electron.screen.getCursorScreenPoint();
		let currentDisplay = electron.screen.getDisplayNearestPoint(currentCursorPoint);

		logger.debug(currentCursorPoint);
		logger.debug(currentDisplay);



		// Check whether mouse is in the left side of the screen, or the right side of the screen

	}; 



	/* ====================================
	 public methods
	 ====================================== */
	/**
	 * navigate to a URI
	 * the type of URI will be determined by a URIParser helper object
	 *
	 * @param uri {string} uri to navigate to
	 */
	_this.navigateTo = function(uri) {
		var URIInfo = URIParser.parse(uri);

		// if an invalid URL is passed
		if (URIInfo.isValid !== true) {
			// do nothing
			return;
		}

		if (URIInfo.type === "http") {
			webViewEl.setAttribute("src", URIInfo.formattedURI);
		}

		else if (URIInfo.type === "file") {
			console.log("User has entered a file URL into the addressbar: " + uri);
			webViewEl.setAttribute("src", URIInfo.formattedURI);
		}

		else if (URIInfo.type === "page") {
			console.log("Opening HTML template file " + uri);
			webViewEl.setAttribute("src", URIInfo.formattedURI);
		}

		else if (URIInfo.type === "internal") {
			console.log("User has navigated to an internal link: " + uri);
		}

		else if (URIInfo.type === "search") {
			console.log("User has searched " + uri);
			webViewEl.setAttribute("src", URIInfo.formattedURI);
		}
	};

	/**
	 * activate TabView (user clicks on this browser tab)
	 */
	_this.activate = function() {
		webViewWrapperEl.style.visibility = "visible";
		browserTab.activate();
	};

	/**
	 * deactivate TabView (user clicks on another browser tab)
	 */
	_this.deactivate = function() {
		webViewWrapperEl.style.visibility = "hidden";
		browserTab.deactivate();
	};

	/**
	 * check whether navigation actions (back, forward, reload, etc) can be performed on <webview>
	 *
	 * @returns {boolean} whether dom-ready was fired at least once in the <webview> object
	 */
	_this.isDOMReady = function() {
		return isDOMReady;
	};

	/**
	 * close current TabView
	 */
	_this.close = function() {
		// remove webview element
		webViewContainerEl.removeChild(webViewWrapperEl);
	};

	/**
	 * Returns current TabView object's string ID
	 *
	 * @returns {string} current TabView object's string ID
	 */
	_this.getId = function() {
		return tabViewId;
	};

	/**
	 * Returns <webview> element
	 *
	 * @returns {DOMElement} <webview> element associated with current TabView object
	 */
	_this.getWebViewEl = function() {
		return webViewEl;
	};

	/**
	 * Returns <webview> element's title
	 * 
	 * @returns {*}
	 */
	_this.getWebViewTitle = function() {
		return webViewTitle;
	};

	_this.getURL = function() {
		return webViewURL;
	};

	_this.getSearchBox = function() {
		return searchBox;
	};

	_this.updateTabFavicon = function(imageURL) {
		browserTab.updateTabFavicon(imageURL);
	};

	_this.updateTabTitle = function(title) {
		browserTab.updateTitle(title);
	};

	init(url);
}
