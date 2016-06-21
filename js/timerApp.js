var timerApp = angular.module('timerApp', ['ui.bootstrap', 'colorpicker.module', 'angular-electron']);

timerApp.controller('timerCtrl', ['$scope', '$interval', '$filter', 'shell', function($scope, $interval, $filter, shell) {
	const {ipcRenderer} = require('electron');

	// **** INITIALIZE **** //
	(function() {
		$scope.editingSettings = false;
		$scope.editingTimer = false;

		$scope.username = ipcRenderer.sendSync('get', 'username');
		$scope.channel = ipcRenderer.sendSync('get', 'channel');
		$scope.password = ipcRenderer.sendSync('get', 'password');
		$scope.titleStyle = ipcRenderer.sendSync('get', 'titleStyle');
		$scope.timerStyle = ipcRenderer.sendSync('get', 'timerStyle');
		$scope.timers = ipcRenderer.sendSync('get', 'timers');
		$scope.activeID = ipcRenderer.sendSync('get', 'activeID');

		$scope.mods = [];

		// Grab the activeID and active timer on startup if they exist
		if($scope.timers.length > 0) {
			$scope.timer = $filter('filter')($scope.timers, {id: $scope.activeID}, true)[0];
		}
	})();

	ipcRenderer.on('update', function(event) {
		var confirmUpdate = confirm('There is an update available. Would you like to open the download page?');
		if(confirmUpdate) {
			shell.openExternal('https://github.com/xingped/twitchtimer/releases');
		}
	});

	// Open/close settings
	$scope.editSettings = function() {
		$scope.editingSettings = true;
		$scope.storedTitleStyle = $scope.titleStyle;
		$scope.storedTimerStyle = $scope.timerStyle;
		$scope.storedUsername = $scope.username;
		$scope.storedPassword = $scope.password;
	}

	$scope.saveSettings = function() {
		$scope.editingSettings = false;
		if($scope.username !== $scope.storedUsername || $scope.password !== $scope.storedPassword) {
			console.log('reconnecting');
			$scope.reconnect();
		}

		ipcRenderer.sendSync('set', 'titleStyle', $scope.titleStyle);
		ipcRenderer.sendSync('set', 'timerStyle', $scope.timerStyle);
		ipcRenderer.sendSync('set', 'username', $scope.username);
		ipcRenderer.sendSync('set', 'password', $scope.password);
		ipcRenderer.sendSync('set', 'channel', '#'.concat($scope.username));
	}

	$scope.cancelSettings = function() {
		$scope.titleStyle = $scope.storedTitleStyle;
		$scope.timerStyle = $scope.storedTimerStyle;
		$scope.username = $scope.storedUsername;
		$scope.password = $scope.storedPassword;
		$scope.editingSettings = false;
	}

	// Timer Functions
	$scope.newTimer = function() {
		$scope.activeID = ipcRenderer.sendSync('get', 'idInc');
		ipcRenderer.sendSync('set', 'activeID', $scope.activeID);
		$scope.timers.push({
			id: $scope.activeID,
			name: '',
			time: 0
		});
		ipcRenderer.sendSync('set', 'idInc', $scope.activeID+1);
		$scope.timer = $filter('filter')($scope.timers, {id: $scope.activeID}, true)[0];
		$scope.editTimer();
		$scope.storedTimer = null;
	}

	$scope.startTimer = function() {
		if(!$scope.active) {
			$scope.active = true;
			$scope.timerInterval = $interval(function() {
				if(!$scope.editing) {
					$scope.timer.time++;
					ipcRenderer.sendSync('set', 'timers', $scope.timers);
				}
			}, 1000);
		}
	};

	$scope.stopTimer = function() {
		if($scope.timer) {
			if($interval.cancel($scope.timerInterval)) {
				$scope.active = false;
			}
		}
	};

	$scope.resetTimer = function() {
		var reset = confirm("Are you sure you want to reset timer?");
		if(reset) {
			$scope.stopTimer();
			$scope.timer.time = 0;
			ipcRenderer.sendSync('set', 'timers', $scope.timers);
		}
	}

	$scope.editTimer = function() {
		input = $scope.timer.time;
		$scope.hours = parseInt(input / 3600);
		input %= 3600;
		$scope.minutes = parseInt(input/60);
		$scope.seconds = input % 60;

		$scope.editingTimer = true;
		$scope.storedTimer = angular.copy($scope.timer);
	}

	$scope.deleteTimer = function() {
		$scope.stopTimer();
		var del = confirm('Delete timer?');
		if(del) {
			$scope.timers.splice($scope.timers.indexOf($scope.timer), 1);
			$scope.timer = null;
			ipcRenderer.sendSync('set', 'timers', $scope.timers);
		} else {
			$scope.startTimer();
		}
	}

	$scope.saveTimer = function() {
		$scope.hours = $scope.hours || 0;
		$scope.minutes = $scope.minutes || 0;
		$scope.seconds = $scope.seconds || 0;
		$scope.timer.time = 60*(60*parseInt($scope.hours) + parseInt($scope.minutes)) + parseInt($scope.seconds);
		$scope.editingTimer = false;
		ipcRenderer.sendSync('set', 'timers', $scope.timers);
	}

	$scope.cancelTimer = function() {
		if($scope.storedTimer !== null) {
			$scope.timer = angular.copy($scope.storedTimer);
		} else {
			$scope.timers.splice($scope.timers.indexOf($scope.timer), 1);
			$scope.timer = null;
		}
		$scope.editingTimer = false;
	}

	$scope.changeTimer = function() {
		$scope.stopTimer();
		if($scope.timer) {
			$scope.activeID = $scope.timer.id;
			ipcRenderer.sendSync('set', 'activeID', $scope.activeID);
		}
	}


	/****************
	* IRC Functions *
	****************/
	var irc = require('tmi.js');

	$scope.client = new irc.client({
		options: {
			debug: true,
			debugDetails: true
		},
		identity: {
			username: $scope.username,
			password: $scope.password
		},
		connection: {
			preferredServer: 'irc.twitch.tv'
		},
		channels: [$scope.channel]
	});

	$scope.$watch('client.readyState()', function(nV, oV) {
		if(nV === 'OPEN') {
			$scope.client.connected = true;
		} else {
			$scope.client.connected = false;
		}
	});

	if($scope.username !== '' && $scope.password !== '') {
		console.log('connecting');
		$scope.client.connect();
	}

	$scope.reconnect = function() {
		console.log('reconnecting');
		$scope.client.disconnect();
		$scope.client.opts.identity = {
			username: $scope.username,
			password: $scope.password
		};
		$scope.client.channels = [$scope.channel];

		if($scope.username !== '' && $scope.password !== '') {
			$scope.client.connect();
		}
	}

	// On connect
	$scope.client.addListener('connected', function(address, port) {
		console.log('***CONNECTED***');
		$scope.client.mods($scope.channel).then(function(data) {
			$scope.mods = data;
		});
	});

	// On connectFail
	$scope.client.addListener('connectFail', function() {
		console.log('***CONNECT FAIL***');
	});

	// On disconnect
	$scope.client.addListener('disconnected', function(reason) {
		console.log('***DISCONNECTED***');
		console.log(reason);
	});

	$scope.client.addListener('crash', function(message, stack) {
		console.log('***CRASH***');
		console.log(message);
	});

	// If a mod is added or removed
	$scope.client.on('mod', function(channel, username) {
		$scope.mods.push(username);
	});

	$scope.client.on('unmod', function(channel, username) {
		for(var i = 0; i < $scope.mods.length; i++) {
			if(username === $scope.mods[i]) {
				$scope.mods.splice(i,1);
				break;
			}
		}
	});

	// Incoming chat messages
	$scope.client.on('chat', function(channel, user, message) {
		if($scope.timer && ($scope.mods.indexOf(user.username) !== -1
		  || user.username.toLower() === $scope.username.toLower())) {
			if(message.indexOf('!timer on') === 0) {
				$scope.startTimer();
			}

			if(message.indexOf('!timer off') === 0) {
				$scope.stopTimer();
			}
		}
	});
}]);


timerApp.filter('timeFilter', function() {
	return function(input,scope) {
		if(typeof input === 'undefined' || input === null) {
			return '--:--:--';
		}
		
		var hours = parseInt(input / 3600);
		input %= 3600;
		var minutes = parseInt(input/60);
		var seconds = input % 60;
		
		var timerString = pad(String(hours),2) + ":";
		timerString += pad(String(minutes),2) + ":";
		timerString += pad(String(seconds),2);

		return timerString;
	}
});


var pad = function(input, padding) {
	while(input.length < padding) {
		input = '0'.concat(input);
	}
	return input;
};