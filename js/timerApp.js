window.onerror = function() {return true;}

var timerApp = angular.module('timerApp', ['ui.bootstrap', 'colorpicker.module']);

timerApp.controller('timerCtrl', ['$scope', '$interval', '$filter', '$timeout', function($scope, $interval, $filter, $timeout) {
	// **** INITIALIZE **** //
	$scope.initialize = function() {
		$scope.editingSettings = false;
		$scope.editingTimer = false;
		$scope.gui = require('nw.gui');
		$scope.win = $scope.gui.Window.get();

		$scope.username = localStorage.username || '';
		$scope.channel = localStorage.channel || '';
		$scope.password = localStorage.password || '';

		localStorage.idInc = localStorage.idInc || '0';

		// Window settings
		if(localStorage.windowSettings !== undefined && localStorage.windowSettings !== null) {
			var winSet = JSON.parse(localStorage.windowSettings);
			$scope.win.moveTo(winSet.posX, winSet.posY);
			$scope.win.resizeTo(winSet.width, winSet.height);
		}

		// Default settings
		if(localStorage.styles === undefined || localStorage.styles === null) {
			localStorage.styles = JSON.stringify({
				backgroundColor:  "#32cd32",
				fontSrc: "http://fonts.googleapis.com/css?family=Chango",
				fontFamily: "Chango, cursive",
				fontColor: "#000000",
				fontSize: 48
			});
		}
		$scope.styles = JSON.parse(localStorage.styles);
		$scope.getStyles = function() {
			return $scope.styles;
		}

		if(localStorage.timers === undefined || localStorage.timers === null) {
			localStorage.timers = '[]';
		}
		$scope.timers = JSON.parse(localStorage.timers);

		// Grab the activeID and active timer on startup if they exist
		if(localStorage.activeID) {
			$scope.activeID = localStorage.activeID;
			if($scope.timers.length > 0) {
				$scope.timer = $filter('filter')($scope.timers, {id: $scope.activeID}, true)[0];
			}
		}
	}
	$scope.initialize();

	// Check for updates
	var pkg = require('./package.json');
	var updater = require('node-webkit-updater');
	var upd = new updater(pkg);
	
	upd.checkNewVersion(function(error, newVersionExists, manifest) {
		if(!error && newVersionExists) {
			var confirmUpdate = confirm('There is an update available. Would you like to open the download page?');
			if(confirmUpdate) {
				$scope.gui.Shell.openExternal('https://github.com/xingped/twitchtimer/releases');
			} else {
				return;
			}
		} else if(error) {
			console.log('Error checking version: '+error);
		}
	});

	// Open link in external browser
	$scope.openLink = function(link, event) {
		event.stopPropagation();
		$scope.gui.Shell.openExternal(link);
	}

	// Save window size/position on exit
	$scope.win.on('close', function() {
		localStorage.windowSettings = JSON.stringify({
			posX: $scope.win.x,
			posY: $scope.win.y,
			width: $scope.win.width,
			height: $scope.win.height
		});
		this.close(true);
	});

	// Open/close settings
	$scope.editSettings = function() {
		$scope.editingSettings = true;
		$scope.storedStyles = $scope.styles;
		$scope.storedUsername = $scope.username;
		$scope.storedPassword = $scope.password;
	}

	$scope.saveSettings = function() {
		console.log('saving settings - '+$scope.username+'/'+$scope.storedUsername+' ... '+$scope.password+'/'+$scope.storedPassword);
		$scope.editingSettings = false;
		if($scope.username !== $scope.storedUsername || $scope.password !== $scope.storedPassword) {
			console.log('reconnecting');
			$scope.reconnect();
		}
		$scope.getStyles = function() {
			return $scope.styles;
		}
		localStorage.styles = JSON.stringify($scope.styles);
		localStorage.username = $scope.username;
		localStorage.channel = '#'.concat($scope.username);
		localStorage.password = $scope.password;
	}

	$scope.cancelSettings = function() {
		$scope.styles = $scope.storedStyles;
		$scope.username = $scope.storedUsername;
		$scope.password = $scope.storedPassword;
		$scope.editingSettings = false;
	}

	// Timer Functions
	$scope.newTimer = function() {
		$scope.activeID = localStorage.idInc;
		localStorage.activeID = $scope.activeID;
		$scope.timers.push({
			id: $scope.activeID,
			name: '',
			time: 0
		});
		localStorage.idInc++;
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
					localStorage.timers = JSON.stringify($scope.timers);
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
			localStorage.timers = JSON.stringify($scope.timers);
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
			localStorage.timers = JSON.stringify($scope.timers);
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
		localStorage.timers = JSON.stringify($scope.timers);
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
			localStorage.activeID = $scope.activeID;
		}
	}


	/****************
	* IRC Functions *
	****************/
	var irc = require('twitch-irc');

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

	if($scope.username !== '' && $scope.password !== '') {
		$scope.client.connect();
	}

	$scope.reconnect = function() {
		console.log('reconnecting');
		$scope.client.disconnect();
		$scope.client.options.identity = {
			username: $scope.username,
			password: $scope.password
		};
		$scope.client.options.channels = ['#'+$scope.username];

		if($scope.username !== '' && $scope.password !== '') {
			$scope.client.connect();
		}
	}

	// On connect
	$scope.client.addListener('connected', function(address, port) {
		console.log('***CONNECTED***');
		$scope.$apply();
	});

	// On connectFail
	$scope.client.addListener('connectFail', function() {
		console.log('***CONNECT FAIL***');
		$scope.$apply();
	});

	// On disconnect
	$scope.client.addListener('disconnected', function(reason) {
		console.log('***DISCONNECTED***');
		$scope.$apply();
	});

	$scope.client.addListener('crash', function(message, stack) {
		console.log('***CRASH***');
		console.log(message);
		$scope.$apply();
	});

	$scope.client.addListener('chat', function(channel, user, message) {
		if($scope.timer && $scope.client.isMod(channel, user.username)) {
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