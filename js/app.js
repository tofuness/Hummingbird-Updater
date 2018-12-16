$(function(){
	var user = {
		os: air.Capabilities.os.indexOf('win'),
		watching: [],
		defaultBg: false,
		activityLen: 0,
		loggedIn: false,
		settings: {
			startAtLogin: true,
			toured: null, // If the user has seen/used the tour
			username: null,
			loginName: null,
			apiToken: null,
			basicToken: null,
			lastUpdate: null,
			lastDbUpdate: null,
			activity: []
		}
	},
	appInfo = {
		version: '0.0.7'
	},
	appState = {
		noteOpen: 0,
		processDetection: null,
	},
	bottom = $('#bottom'),
	loader = $('#loading'),
	activityList = $('#activity-list'),
	settingsOvl = $('#settings-ovl'),
	middle = $('#middle'),
	activityLastUpdate = null,
	ui = {
		note: {
			window: null,
			$body: null,
			open: false
		},
		showSettings: function(){
			settingsOvl.fadeIn(150);
		},
		hideSettings: function(){
			settingsOvl.fadeOut(150);
		},
		glowRed: function(){
			window.nativeWindow.notifyUser(air.NotificationType.CRITICAL);
		},
		glowYellow: function(){
			window.nativeWindow.notifyUser(air.NotificationType.INFORMATIONAL);
		},
		centerWindow: function(){
			window.nativeWindow.x = (air.Capabilities.screenResolutionX - window.nativeWindow.width) / 2;
			window.nativeWindow.y = (air.Capabilities.screenResolutionY - window.nativeWindow.height) / 2;
		},
		loading: function(message){
			//var dotCounter = 0;

			loader.addClass('visible').text(message + '...');
			/*
			// By design principle, one loading animation is enough
			var dotInterval = setInterval(function(){
				if(dotCounter === 3){
					loader.text(message);
					dotCounter = 0;
				} else {
					loader.text(loader.text() + '.');
					dotCounter++;
				}
			}, 500);
			*/
		},
		doneLoading: function(){
			loader.removeClass('visible');
		},
		message: function(message){
			$('#top-user').text(message);
		},
		initNote: function(){
			if(!appState.noteOpen){

				// Small growl-type notifications!
				var noteObj = {
						note: new air.NativeWindowInitOptions(),
						screenInfo: air.Screen.mainScreen.visibleBounds,
						noteBounds: new air.Rectangle(
							air.Screen.mainScreen.visibleBounds.width - 312 - 30,
							air.Screen.mainScreen.visibleBounds.height - 120 - 30,
							312, // Width
							120 // Height
						)
					}

				noteObj.note.resizable = false;
				noteObj.note.transparent = true;
				noteObj.note.maximizable = false;
				noteObj.note.type = air.NativeWindowType.LIGHTWEIGHT;
				//noteObj.note.type = air.NativeWindowType.NORMAL; // FOR DEV MODE
				noteObj.note.systemChrome = air.NativeWindowSystemChrome.NONE;

				noteObj.noteLoader = air.HTMLLoader.createRootWindow(true, noteObj.note, false, noteObj.noteBounds);

				noteObj.noteLoader.paintsDefaultBackground = false;
				noteObj.noteLoader.stage.nativeWindow.alwaysInFront = true;
				noteObj.noteLoader.navigateInSystemBrowser = true;

				appState.openNotes = true; // Don't open any more
				noteObj.noteLoader.load(new air.URLRequest('note.html'));

				ui.note.window = noteObj.noteLoader.window; // Save the note window for reuse
				noteObj = null;
			}
		},
		showNote: function(title, message, type, callback){
			type = type || 'scrobble';

			if(!ui.note.open){

				air.trace('New note opened!');

				var $note = $(ui.note.window.document.body),
					$msg = $note.find('#message-bg'),
					$close = $note.find('#message-close');

				ui.note.open = true;

				$msg.addClass('visible ' + type);
				$note.find('#message-title').html(title);
				$note.find('#message-desc').html(message);
				$note.find('#message-icon').css('background-image', 'url(img/nicons/' + type + '.jpg)');

				var noteTO = setTimeout(function(){
					$msg.removeClass('visible ' + type);
					$msg.off();
					$close.off();
					ui.note.open = false;
				}, 7000);

				$close.click(function(e){
					e.stopPropagation();
					clearTimeout(noteTO);
					$msg.removeClass('visible ' + type);
					air.trace('Closed note by cross');
					$msg.off();
					$close.off();
					ui.note.open = false;
				});

				$msg.click(function(){
					$msg.off();
					$close.off();
					if(!$msg.hasClass('scrobble')){
						clearTimeout(noteTO);
						$msg.removeClass('visible ' + type);
						ui.note.open = false;
						air.trace('Closed note by scrobble');
					} else {
						clearTimeout(noteTO);
						setTimeout(function(){
							$msg.removeClass('visible ' + type);
							ui.note.open = false;
						}, 1000);
						air.trace('Closed note by click');
					}
					if(callback){
						callback();
						air.trace('Run note callback');
					}
				}).mouseup(function(e){
					e.stopPropagation();
					if(e.button === 2 && $msg.hasClass('scrobble')){
						clearTimeout(noteTO);
						$msg.removeClass('visible scrobble');
						$msg.off();
						$close.off();
						ui.note.open = false;
						air.trace('Closed note by right-click');
					}
				});
			}
		}
	},
	helpers = {
		isNumber: function(number){
			return !isNaN(parseFloat(number)) && isFinite(number);
		},
		openInBrowser: function(url){
			var request = new air.URLRequest(url);
			air.navigateToURL(request);
		},
		activityObject: function(){
			var activity = {
				published: new Date().getTime(),
				verb: null,
				actor: {
					displayName: user.settings.username,
					url: 'http://hummingbird.me/users/' + user.settings.loginName + '/library'
				},
				target: {},
				object: {}
			}
			return activity;
		},
		generateColor: function(str){
			// str to hash
			for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));

			// int/hash to hex
			for (var i = 0, colour = "#"; i < 3; colour += ("00" + ((hash >> i++ * 8) & 0xFF).toString(16)).slice(-2));

			return colour;
		},
		displayActivity: function(){
			var activity = user.settings.activity,
				events = {};

			if(activity.length === 0 && !user.defaultBg){
				if(!middle.hasClass('new')){
					middle.addClass('new');
				}
			} else if(user.activityLen < activity.length || (new Date().getTime() - activityLastUpdate) > 10000){

				if(!user.defaultBg){
					middle.removeClass('new');
					user.defaultBg = true;
				}

				activityLastUpdate = new Date().getTime();

				user.activityLen = activity.length;
				activityList.empty();

				for(var i = 0; i < activity.length; i++){ // Bundle into "events"
					if(events[activity[i].object.id]){
						events[activity[i].object.id].push(activity[i]);
					} else {
						events[activity[i].object.id] = [activity[i]];
					}
				}

				for(var _id in events){ // Sort each individual array, desc.
					events[_id].sort(function(a, b){
						a = new Date(a.published);
						b = new Date(b.published);
						return a > b ? -1 : a < b ? 1 : 0;
					});

					for(var i = 0; i < events[_id].length; i++){
						var eventTemp = events[_id][i];

						if(i == 0){
							var activityItem = '<div class="cf activity ' + eventTemp.verb + '"><div class="activity-icon-wrap"><div class="activity-icon" style="background-image: url(http://images.weserv.nl/?w=40&q=95&url=' + eventTemp.object.image.replace('https://', '') + ')"><div class="activity-icon-ovl"></div></div></div><div class="activity-right"><div class="activity-timeago">' + moment(eventTemp.published).fromNow() + '</div><span class="activity-actor">' + eventTemp.actor.displayName + '</span> ' + eventTemp.verb + ' <a href="' + eventTemp.object.url + '" target="_blank" class="activity-object">' + eventTemp.object.displayName + '</a> to ' + eventTemp.target.displayName +  '.</div></div>';

							if(events[_id].length > 1){
								activityItem = '<div class="activity-wrap" data-lastupdate="' + eventTemp.published + '">' + activityItem + '<ul class="sub-activity-list" data-id="' + eventTemp.object.id + '"></ul></div>';
							} else {
								activityItem = '<div class="activity-wrap" data-lastupdate="' + eventTemp.published + '">' + activityItem + '</div>';
							}

							activityList.prepend(activityItem);

						} else if(i < 10){

							var activityItem = '<li class="sub-activity cf"><div class="sub-activity-icon"></div><div class="sub-activity-right"><div class="sub-activity-timeago">' + moment(eventTemp.published).fromNow() + '</div><span class="sub-activity-actor">' + eventTemp.actor.displayName + '</span> ' + eventTemp.verb + ' <span class="sub-activity-object">' + eventTemp.object.displayName + '.</span></div></li>';

							$('.sub-activity-list[data-id="' + eventTemp.object.id + '"]').append(activityItem);
						}
					}
				}

				$('.activity-wrap').tsort({ attr: 'data-lastupdate', order: 'desc' });

				/*
				for(var i = 0; i < activity.length; i++){
					if(activity[i].verb == 'connected'){
						var activityItem = '<li class="cf activity ' + activity[i].verb + '"><div class="activity-right"><div class="activity-timeago">' + moment(activity[i].published).fromNow() + '</div><span class="activity-actor">' + activity[i].actor.displayName + '</span> ' + activity[i].verb + ' <span class="activity-object">' + activity[i].object.displayName + '</span> to ' + activity[i].target.displayName +  '.</div></li>';
						activityList.prepend(activityItem);
					} else {
						//var activityItem = '<li class="cf activity ' + activity[i].verb + '"><div class="activity-icon-wrap"><div class="activity-icon" style="background: ' + helpers.generateColor(activity[i].object.id) + '"><div class="activity-icon-ovl"></div></div></div><div class="activity-right"><div class="activity-timeago">' + moment(activity[i].published).fromNow() + '</div><span class="activity-actor">' + activity[i].actor.displayName + '</span> ' + activity[i].verb + ' <a href="' + activity[i].object.url + '" target="_blank" class="activity-object">' + activity[i].object.displayName + '</a> to ' + activity[i].target.displayName +  '.</div></li>';
						var activityItem = '<li class="cf activity ' + activity[i].verb + '"><div class="activity-icon-wrap"><div class="activity-icon" style="background-image: url(http://images.weserv.nl/?w=50&q=95&url=herro.co/static/series/anime/5148d06583b471715e000d7a.jpg)"><div class="activity-icon-ovl"></div></div></div><div class="activity-right"><div class="activity-timeago">' + moment(activity[i].published).fromNow() + '</div><span class="activity-actor">' + activity[i].actor.displayName + '</span> ' + activity[i].verb + ' <a href="' + activity[i].object.url + '" target="_blank" class="activity-object">' + activity[i].object.displayName + '</a> to ' + activity[i].target.displayName +  '.</div></li>';
						activityList.prepend(activityItem);
					}
				}
				*/
			}
		},
		// Left new, right old
		versionCompare: function(left, right){
			if (typeof left + typeof right != 'stringstring')
				return false;

				var a = left.split('.')
				,   b = right.split('.')
				,   i = 0, len = Math.max(a.length, b.length);

				for (; i < len; i++) {
					if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
					return 1;
				} else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
					return -1;
				}
			}
			return 0;
		},
		checkUpdates: function(){
			ui.loading('Checking for updates');
			setTimeout(function(){
				$.ajax({
					type: 'get',
					url: 'https://cdn.combinatronics.com/Desuvader/Hummingbird-Updater/master/version',
					success: function(res){
						air.trace('Retrieved version info');
						if(helpers.versionCompare(res.version, appInfo.version) === 1){

							ui.loading('Downloading new update');

							var updateLoader = new air.URLLoader(), 
								updateStream = new air.FileStream(),
								//updateByteArray = new ByteArray(),
								updateNP = new air.NativeProcess(),
								updateNPSI = new air.NativeProcessStartupInfo();

							updateLoader.dataFormat = air.URLLoaderDataFormat.BINARY;
							updateLoader.load(new air.URLRequest(res.url));
							updateLoader.addEventListener(air.Event.COMPLETE, function(res){
								// Windows run update
								var updateFile = air.File.applicationStorageDirectory.resolvePath(updateFileName);
								air.trace(updateFile);
								updateStream.open(updateFile, air.FileMode.WRITE);
								updateStream.writeBytes(res.target.data); // Save updater
								updateStream.close();
								updateLoader.close();

								updateNPSI.executable = updateFile;
								updateNP.start(updateNPSI); // Run update
								air.NativeApplication.nativeApplication.exit();
							});
						} else {
							ui.doneLoading();
						}
					},
					error: function(){
						ui.doneLoading();
					}
				});
			}, 1500);
		}
	},
	app = {
		init: function(){
			ui.initNote();
			if(air.NativeApplication.supportsStartAtLogin && user.settings.startAtLogin){
    			//air.NativeApplication.nativeApplication.startAtLogin = true;
			}
			ui.centerWindow();
			app.getUserSettings(function(){
				//app.updateDatabase(); Not needed atm
				app.authenticate(function(){
					user.loggedIn = true;
					$('#login-form-wrap').remove();
					$('#open-herro').attr('href', 'http://hummingbird.me/users/' + user.settings.username + '/library');
					helpers.checkUpdates();
					ui.message('Hey, ' + user.settings.username + '!');
					app.initTour();
					app.detectionInit();
					helpers.displayActivity();
					app.createTrayIcon();
				});
			});
		},
		authenticate: function(callback){
			if(user.settings.username && user.settings.apiToken){
				// Continue
				callback();
			} else {
				air.trace('Requires authentication!');
				$('#login-form-wrap').show();
				$('#login-form-submit').on('click', function(){
					var $this = $(this);
					if($this.hasClass('disabled')){ return; }

					$(this).addClass('disabled');
					var inputUsername = $('#login-value-username').val(),
						inputPassword = $('#login-value-password').val(),
						tempToken = null;

					ui.loading('Authenticating');

					$.ajax({
						data: {
							username: inputUsername,
							password: inputPassword
						},
						type: 'post',
						url: 'http://hummingbird.me/api/v1/users/authenticate',
						success: function(res){
							air.trace('Authenticated');

							air.trace(res);

							user.settings.username = inputUsername.substr(0, 1).toUpperCase() + inputUsername.substr(1); // Show respect for people with these kind of uSerNAmES
							user.settings.password = inputPassword;
							user.settings.apiToken = res;
							app.saveUserSettings();

							setTimeout(function(){
								$this.removeClass('disabled');
								$('#login-form-submit').off();
								ui.doneLoading();
								callback();
							}, 1000);
						},
						error: function(res){
							air.trace('Error auth: ' + JSON.stringify(res));
							setTimeout(function(){
								$this.removeClass('disabled');
								ui.doneLoading();
								confirm('Wrong Username/API Token, try again');
							}, 1000);
						}
					});
				});
			}
		},
		detectionInit: function(){ // Loops forever and returns an array of videos being played

			// Setup a new native process and keep them separated
			var nativeProcessStartupInfo = new air.NativeProcessStartupInfo(),
				file = air.File.applicationDirectory.resolvePath('detect.cmd'),
				process = null;

			nativeProcessStartupInfo.executable = file;
			process = new air.NativeProcess();
			process.start(nativeProcessStartupInfo);

			process.addEventListener(air.ProgressEvent.STANDARD_OUTPUT_DATA, function(){
				var response = process.standardOutput.readUTFBytes(process.standardOutput.bytesAvailable).replace(/\s+$/, ''), // Replace any appended spaces/new lines
					detectedAnime = [];

				detectedAnime = response.split('\r\n');

				for(var i = 0; i < detectedAnime.length; i++){
					var tempDetected = detectedAnime[i].replace(/^.*: /, '').replace(/ - ([^-]+) VLC.*/, '').replace(/ - VLC.*/, '').replace(/\r\n/, '').replace(/^\s+/, ''),
						tempArr = [];
						
					if(user.watching.indexOf(tempDetected) === -1 && tempDetected.match(/(.mkv$|.avi$|.mp4$)/)){
						air.trace('New episode detected!');
						tempArr.push(tempDetected);	// New anime was opened. Add it to the array
						app.scrobble(tempDetected); // Send a request to herro and then ask if the user wants to update their list
					} else if(user.watching.indexOf(tempDetected) > -1){
						tempArr.push(tempDetected);
					}
				}

				user.watching = tempArr;

			});

			appState.processDetection = process;
		},
		scrobble: function(filename){
			var anime = {
				// Temporary anime obj, describing the file that is being processed
				_id: null,
				slug: null,
				title: null,
				image: null,
				progress: null,
				score: null, // How well it matches the filename. Internal use only!
				filename: filename,
			},
			detectedEpisodes = null;

			var animeTitle = anime.filename.replace(/\[.*?\]|(.mkv|.avi|.mp4)|\(.*\)/gi, '').replace(/_/g, ' ').replace(/^\s+|\s+$/g,'');
			var detectedEpisodes = anime.filename.replace(/_/g, ' ').match(/[\._ \-]([0-9]{2,3})[v\._ \-\[\(].*[\[\(][0-9A-Za-z]{4,8}[\)\]][\/\._ \-\[\(]/);

			$.ajax({
				url: 'http://hummingbird.me/api/v1/search/anime?query=' + animeTitle,
				success: function(response){
					var animeDistanceScores = [];
					var animeList = response;

					// Out stuff

					air.trace('animeTitle: "' + animeTitle + '"');
					air.trace('detectedEpisodes: ' + detectedEpisodes);

					if(detectedEpisodes){

						for(var i = 0; i < detectedEpisodes.length; i++){
							if(helpers.isNumber(detectedEpisodes[i])){
								// If it seems to be a valid number. Make it the "detected" episode.
								anime.progress = parseInt(parseFloat(detectedEpisodes[i]));
								air.trace('Decided on episode ' + anime.progress);
							}
						}					

						for(var i = 0, l = animeList.length; i < l; i++){

							if(animeList[i].title){
								var distanceScore = animeTitle.distance(animeList[i].title);
								if(distanceScore > 0.7){
									animeDistanceScores.push({
										anime: animeList[i],
										score: distanceScore,
										title: animeList[i].title
									});
								}
							}
						}

						distanceResults = animeDistanceScores.sort(function SortByName(a, b){
							var aScore = a.score;
							var bScore = b.score;
							return ((aScore > bScore) ? -1 : ((aScore < bScore) ? 1 : 0));
						}).slice(0, 3);

						if(distanceResults.length){
							anime._id = distanceResults[0].anime.id;
							anime.title = distanceResults[0].title;
							anime.slug = distanceResults[0].anime.id;
							anime.image = distanceResults[0].anime.cover_image;
							anime.score = distanceResults[0].score;

							// Best results

							if(anime.progress){ // If we ended up with something
								var animeObj = anime,
									activity = helpers.activityObject();
								ui.showNote(
									'Do you want to update?',
									'Detected <span class="openbold">' + animeObj.title +  ' Episode ' + animeObj.progress +  '</span>',
									'scrobble',
								function(){
									air.trace(JSON.stringify(animeObj));
									activity.verb = 'scrobbled';
									activity.object.id = animeObj._id;
									activity.object.title = animeObj.title;
									activity.object.progress = animeObj.progress;
									activity.object.displayName = animeObj.title + ' Episode ' + animeObj.progress;
									activity.object.url = 'http://hummingbird.me/anime/' + animeObj.slug;
									activity.object.image = animeObj.image;
									activity.target.displayName = 'their list';
									user.settings.activity.push(activity);
									app.saveUserSettings();

									// If the user confirmed the scrobble
									air.trace('Scrobbling...');
									app.scrobbleAnime(animeObj);
									animeObj = null;
								});
								//app.screenshot(anime.filename);
							}
						} else {
							air.trace('Nothing matched distance search');
						}
					}

					// Nullify. Not sure if this thing really works
					animeDistanceScores = null;
					detectedEpisodes = null;
					anime = null;
					response = null;
					animeList = null;
				}
			});
		},
		scrobbleAnime: function(anime){
			$.ajax({
				type: 'post',			
				url: 'http://hummingbird.me/api/v1/libraries/' + anime._id,
				data: {
					id: anime._id,
					auth_token: user.settings.apiToken,
					episodes_watched: anime.progress
				},
				success: function(res){
					air.trace('Updated!');
				},
				error: function(){
					confirm('Something went wrong when updating your list. Try updating directly through Hummingbird instead!');
				}
			});
		},
		initTour: function(){
			if(!user.settings.toured){

				var $tourWrap = $('#tour-wrap'),
					$tourSlideWrap = $('#tour-slide-wrap'),
					$tourControlWrap = $('.tour-control-wrap'),
					currSlide = 0;

				$tourWrap.show();
				app.saveUserSettings();
				$('#tour-text-skip').click(function(){
					user.settings.toured = true;
					$tourWrap.addClass('hidden');
					setTimeout(function(){
						$tourWrap.hide();
						bottom.addClass('toured');
					}, 550);
				});

				$('#tour-take').click(function(){
					currSlide = 1;
					$tourSlideWrap.css('left', '-=360px');
					$tourControlWrap.fadeIn(500);
					ui.showNote(
						'Do you want to update?',
						'This is just an <b>example</b>. Keep reading the tour!'
					);
				});

				$('.tour-control-left').click(function(){
					if($tourSlideWrap.position().left < 0){
						currSlide--;
						$tourSlideWrap.css('left', '-' + (currSlide * 360) + 'px');
					}
				});

				$('.tour-control-right').click(function(){
					if(currSlide < 3){
						currSlide++;
						$tourSlideWrap.css('left', '-' + (currSlide * 360) + 'px');
					} else if(currSlide === 3){
						currSlide++;
						user.settings.toured = true;
						app.saveUserSettings();
						$tourSlideWrap.css('left', '-' + (currSlide * 360) + 'px');
						$tourControlWrap.fadeOut(500);
						setTimeout(function(){
							$tourWrap.hide();
							bottom.addClass('toured');
						}, 550);
					}
				});
			} else {
				bottom.addClass('toured');

			}
		},
		replayTour: function(){
			if(user.settings.toured){
				user.settings.toured = false;
				bottom.removeClass('toured');
				$('#tour-wrap').removeClass('hidden');
				$('#tour-slide-wrap').css('left', '0');
				app.initTour();
			}
		},
		getUserSettings: function(callback){
			var settingsJSON = air.File(air.File.applicationStorageDirectory.resolvePath('settings.json')),
				loadedJSON = function(){
					user.settings = $.parseJSON(settingsJSON.data.readUTFBytes(settingsJSON.data.bytesAvailable).toString());
					settingsJSON.removeEventListener(air.Event.COMPLETE, loadedJSON);
					air.trace('Retrieved settings.json');
					if(callback){
						callback();
					}
				}

			settingsJSON.addEventListener(air.Event.COMPLETE, loadedJSON);

			if(!settingsJSON.exists){
				// If settings.json is missing, create a new one with default values.
				app.saveUserSettings(function(){
					settingsJSON.load();
				});
			} else {
				settingsJSON.load();
			}
		},
		saveUserSettings: function(callback){
			var settingsJSON = new air.FileStream();
			settingsJSON.open(air.File.applicationStorageDirectory.resolvePath('settings.json'), air.FileMode.WRITE);
			settingsJSON.writeUTFBytes(JSON.stringify(user.settings));
			settingsJSON.close();
			air.trace('Settings.json has been updated');
			if(callback){
				callback();
			}
		},
		createTrayIcon: function(){
			var iconLoadComplete = function(event){
				air.NativeApplication.nativeApplication.icon.bitmaps = [event.target.content.bitmapData];
			}

			var iconLoad = new air.Loader(); 
			var iconMenu = new air.NativeMenu(); 
			var iconMenuOpen = iconMenu.addItem(new air.NativeMenuItem('Open Updater'));
			var iconMenuClose = iconMenu.addItem(new air.NativeMenuItem('Exit'));

			iconMenuOpen.addEventListener(air.Event.SELECT, function(){
				ui.glowYellow();
				window.nativeWindow.activate();
			});

			iconMenuClose.addEventListener(air.Event.SELECT, function(){ 
				if(confirm('Are you sure you want to exit?')){
					air.NativeApplication.nativeApplication.icon.bitmaps = [];
					if(appState.processDetection){
						appState.processDetection.exit(true); // Forcequit
					}
					app.saveUserSettings(function(){
						air.NativeApplication.nativeApplication.exit();
					});
				}
			});

			if(air.NativeApplication.supportsSystemTrayIcon){
				iconLoad.contentLoaderInfo.addEventListener(air.Event.COMPLETE, iconLoadComplete); 
				iconLoad.load(new air.URLRequest('img/16x16.png')); 
				air.NativeApplication.nativeApplication.icon.tooltip = 'Hummingbird Updater'; 
				air.NativeApplication.nativeApplication.icon.menu = iconMenu;

				air.NativeApplication.nativeApplication.icon.addEventListener(air.MouseEvent.CLICK, function(){
					ui.glowYellow();
					window.nativeWindow.activate();
					window.nativeWindow.alwaysInFront = true;
					window.nativeWindow.alwaysInFront = false;
				});
			}
		}
	}

	app.init();

	window.nativeWindow.addEventListener(air.Event.CLOSING, function(e){
		e.preventDefault();

		// Remove all processes

		if(appState.processDetection){
			appState.processDetection.exit(true); // Forcequit
		}

		// Save before closing
		// Weird mac bug?
		if(user.os !== 'mac'){
			app.saveUserSettings(function(){ // If user has removed information, it will only exit.
				air.NativeApplication.nativeApplication.exit();
			});
		} else {
			// At change theme/set folder we save settings if mac, so we can close without saving.
			air.NativeApplication.nativeApplication.exit();
		}
	});

	// Yeah. I think I went a little bit too far...
	// The plugin has been modded, adding a few new things
	/*
	$.parallaxify({
		positionProperty: 'transform',
		relativeEl: $('#app-wrap')
	});
	*/
 
	setInterval(function(){
		if(user.loggedIn){
			//air.trace(air.System.privateMemory / 1048576);
			helpers.displayActivity();
			//air.trace('Currently watching: ' + JSON.stringify(user.watching));
		}
	}, 2000);

	$('#settings-clearrecent').click(function(){
		if(confirm('Are you sure you want to clear your recent activity?')){
			ui.hideSettings();
			user.settings.activity = [];
			activityList.empty();
			user.defaultBg = false;
			helpers.displayActivity();
			app.saveUserSettings();
		}
	});

	$('#settings-retaketour').click(function(){
		ui.hideSettings();
		app.replayTour();
	});

	$('#settings-clearall').click(function(){
		if(confirm('Are you sure you want to clear everything?')){
			air.trace('Resetting..');
			air.File.applicationStorageDirectory.resolvePath('settings.json').deleteFile();
			if(appState.processDetection){
				appState.processDetection.exit(true); // Forcequit
			}
			location.reload();
			//air.NativeApplication.nativeApplication.exit();
		}
	});

	$('#settings-close').click(function(){
		ui.hideSettings();
	});

	$('#open-settings').click(function(){
		ui.showSettings();
	});

	$('#top').mousedown(function(){
		window.nativeWindow.startMove();
	});

	$('#top-close').click(function(){
		if(user.loggedIn){
			window.nativeWindow.visible = false;
			ui.showNote(
				'Running in the background',
				'You can still access the updater through the system tray',
				'update'
			);
		} else {
			if(appState.processDetection){
				appState.processDetection.exit(true); // Forcequit
			}
			app.saveUserSettings(function(){
				air.NativeApplication.nativeApplication.exit();
			});
		}
		/*
		if(confirm('Are you sure you want to exit?')){
			if(appState.processDetection){
				appState.processDetection.exit(true); // Forcequit
			}
			app.saveUserSettings(function(){
				air.NativeApplication.nativeApplication.exit();
			});
		}
		*/
	});

	$('#top-minimize').click(function(){
		window.nativeWindow.minimize();
		air.System.gc();
	});

	$('body').on('click', 'a[target="_blank"]', function(event){
		event.preventDefault();
		helpers.openInBrowser(this.href);
	});
});