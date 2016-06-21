const electron = require('electron');
const Configstore = require('configstore');
const pkg = require('./package.json');
const request = require('request');

// app - Module to control application life.
// BrowserWindow - Module to create native browser window.
// shell - Module to access shell functions
const {
	app,
	BrowserWindow,
	shell,
	ipcMain
} = electron;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

const http = require('http');
const fs = require('fs');

const config = new Configstore(pkg.name);

// Set default config options on first launch
if(Object.keys(config.all).length === 0) {
	setDefaults();
}

function createWindow() {
	// Create the browser window.
	win = new BrowserWindow(config.get('windowSettings'));

	// and load the index.html of the app.
	win.loadURL(`file://${__dirname}/index.html`);

	// Open the DevTools.
	// win.webContents.openDevTools();

	// Store window's position and size settings on close
	win.on('close', () => {
		config.set('windowSettings', win.getBounds());
	});

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null;
	});

	// Check for updates
	win.webContents.on('did-finish-load', () => {
		request({
			url: pkg.manifestUrl
		}, function(error, response, body) {
			if(!error && response.statusCode === 200) {
				body = JSON.parse(body);
				var pkgVersion = pkg.version ? pkg.version.split('.') : '0.0.0';
				var webVersion = body.version ? body.version.split('.') : '0.0.0';
				var newVersion = false;
				
				for(var i = 0; i < pkgVersion.length; i++) {
					if(webVersion[i] === pkgVersion[i]) {
						continue
					} else if(webVersion[i] > pkgVersion[i]) {
						newVersion = true;
						break;
					} else if(webVersion[i] < pkgVersion[i]) {
						break;
					}
				}

				if(newVersion) {
					win.webContents.send('update');
				}
			}
		});
	});
}

// Create and store default settings
function setDefaults() {
	config.all = {
		titleStyle: {
			'font-src': 'http://fonts.googleapis.com/css?family=Chango',
			'font-family': 'Chango, cursive',
			'color': '#000000',
			'font-size': '48px'
		},
		timerStyle: {
			'background-color': '#32cd32',
			'font-src': 'http://fonts.googleapis.com/css?family=Chango',
			'font-family': 'Chango, cursive',
			'color': '#000000',
			'font-size': '48px'
		},
		timers: [],
		windowSettings: {
			width: 650,
			height: 350
		},
		username: '',
		password: '',
		channel: '',
		idInc: 0,
		activeID: null
	}
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow();
	}
});

ipcMain.on('get', (event, key) => {
	console.log('config.get: '+key);
	event.returnValue = config.get(key);
});

ipcMain.on('getAll', (event) => {
	event.returnValue = config.all;
});

ipcMain.on('set', (event, key, val) => {
	console.log('config.set: '+key, val);
	config.set(key, val);
	event.returnValue = true;
});