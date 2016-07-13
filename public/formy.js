var map;
var showMap = false;
var clickMarker;
var searchMap;

/**
* Creates the google maps
*/
function init() {
	var position = new google.maps.LatLng(53.38108855193859, -1.4801287651062012);
	var options = {
		zoom : 8,
		center: position
	};
	map = new google.maps.Map(document.getElementById("resultsMap"), options);

	var position2 = new google.maps.LatLng(30, 0);
	var options = {
		zoom: 1,
		center: position2
	};
	searchMap = new google.maps.Map(document.getElementById("searchMap"), options);

	clickMarker = new google.maps.Marker({
		// so it's not visable on the map to begin with
		position: {lat: 1000, lng: 1000},
		map: searchMap,
		title: 'You clicked here',
		icon: "http://maps.google.com/mapfiles/ms/icons/green.png"
	});

	google.maps.event.addListener(searchMap, 'click', function(event) {
		// add the info to the form
		var latBox = document.getElementById("lat");
		var lngBox = document.getElementById("lng");
		var pos = event.latLng;
		latBox.value = pos.lat();
		lngBox.value = pos.lng();

		clickMarker.setPosition(pos);

	});


	rightPanel = document.getElementById("right-panel")
	rightPanel.style.visibility = "hidden";
	document.getElementById("resultsMap").style.visibility = "hidden";
}

/**
* Adds the map to the page when it loads
*/
google.maps.event.addDomListener(window, 'load', init);

window.onload = function() {
	/**
	* Sends the data from the form to the server and handles the result
	* @param {string} url - The url of the request
	* @param {string} data - the form in JSON string format
	*/
	function sendAjaxQuery(url, data) {
		$.ajax({
			type: 'POST',
			url: 'postFile.html',
			data: data,
			success: function (res) {
				mapDiv = document.getElementById("resultsMap");
				mapDiv.style.visibility = "hidden";
				showMap = false;

				resetMap();

				var jsonResults = JSON.parse(res);

				var sqlErrors = jsonResults.sqlErrors;
				document.getElementById("right-panel").style.visibility = "visible";

				if (sqlErrors.length > 0) {
					var h2 = document.createElement('h2');
					h2.innerHTML = "Database Error, sorry for the inconvenience";
					var results = document.getElementById('notifications');
					try {
						results.replaceChild(h2, results.firstChild);
					}
					catch (TypeError) {
						results.appendChild(h2);
					}
				}
				else if (jsonResults.twitterCode && jsonResults.twitterCode != 200) {
					var h2 = document.createElement('h2');
					h2.innerHTML = "Twitter search error";
					var results = document.getElementById('notifications');
					try {
						results.replaceChild(h2, results.firstChild);
					}
					catch (TypeError) {
						results.appendChild(h2);
					}
				}
				else {

					var note = document.getElementById('notifications');
					note.innerHTML = "";

					var tweets = jsonResults.tweets;
					if (tweets.length > 0) {
						var results = document.getElementById('right-panel');
						var str = '<h2>Tweets</h2>';
						var people = {};
						var authors = [];
						var words = [];
						for (i in tweets) {
							tweet = tweets[i];
							authors.push(tweet.posted_by);
							if (people.hasOwnProperty(tweet.posted_by)) {
								people[tweet.posted_by].numTweets++;
							}
							else {
								people[tweet.posted_by] = {numTweets: 1, words: []}
							}
							words = words.concat(tweet.content.split(" "));
							people[tweet.posted_by].words = people[tweet.posted_by].words.concat(tweet.content.split(" "));
							str += '<li class=\'tweet\'>';
							str += '<img class=\'left\', src=\'' + tweet.profile_pic + "\' >";
							str += '<p><a href=\'http://www.twitter.com/' + tweet.posted_by + ' target=\'_blank\'>@' + tweet.posted_by + '</a><br>';
							str += tweet.created_at + '</p>';
							str += '<p>' + processContent(tweet.content, tweet.hashtag, tweet.urls) + '</p>';
							str += '<p><a href=\'http://www.twitter.com/' + tweet.posted_by + '/status/' + tweet.string_id + '\' target=\'_blank\'>View on twitter</a></p>';
							if (tweet.author != null) {
								str += '<p>Retweet: <a href=\'http://www.twitter.com/' + tweet.author + '\' target=\'_blank\'>@' + tweet.author + '</a></p>'
							}
							for (o in tweet.objects) {
								if (tweet.objects[o].type == "photo") {
									str += "<img src = \'" + tweet.objects[o].url + "\'>";
								}
							}
							str += '</li>';
							plotTweet(tweet);

						}
						var overallFrequencies = findFrequencies(words, true);
						var topTalkers = findFrequencies(authors, false);
						var stats = "";
						stats += "<h2>Overall word frequency</h2><ul>"
						for (p = 0; p < 20; p++) {
							if (overallFrequencies[p] != null) {
								stats += "<li>" + overallFrequencies[p][0].charAt(0).toUpperCase() +
								overallFrequencies[p][0].slice(1) + ": " + overallFrequencies[p][1] + "</li>";
							}
						}
						stats += "</ul><h2>Top talkers</h2><ul>";
						for (p = 0; p < 10; p++) {
							author = topTalkers[p]
							if (author != null) {
								stats += "<li><h3><a target=\'_blank\' href=\'http://www.tiwtter.com/" + author[0] + "\'>@" + author[0] + "</a>: " + author[1] + "</h3></li><ul>";
								author = author[0];
								authorFrequency = findFrequencies(people[author].words, true);
								for (w = 0; w < 10; w++) {
									if (authorFrequency[w] != null) {
										stats += "<li>" + authorFrequency[w] + "</li>"
									}
								}
								stats += "</ul>"
							}
						}

						// result tweets
						var ul = document.createElement('ul');
						ul.className = 'tweets';
						ul.innerHTML = "";
						ul.innerHTML = str;
						var results = document.getElementById('results');
						results.style.visibility = "visible";
						replace_elem(results, ul, results.firstChild);

						// word frequency
						var freq = document.getElementById('stats');
						freq.innerHTML = stats;

						mapDiv = document.getElementById("resultsMap");
						if (! showMap) {
							mapDiv.innerHTML = "<h2>No geo tweets found</h2>";
						}
						mapDiv.style.visibility = "visible";
						mapDiv.style.backgroundColor = "white";
					}
					else {
						var h2 = document.createElement('h2');
						h2.innerHTML = "No tweets found";
						var results = document.getElementById('notifications');
						// adds the new results to the top of the results div
						replace_elem(results, h2, results.firstChild);

						var ul = document.createElement('ul');
						ul.innerHTML = "";
						var results = document.getElementById('results');
						replace_elem(results, ul, results.firstChild);
						results.style.visibility = "hidden";

						// word frequency
						var freq = document.getElementById('stats');
						freq.innerHTML = "";
					}
				}
			},
			error: function (xhr, status, error) {
				var h2 = document.createElement('h2');
				h2.innerHTML = "";
				h2.innerHTML = "Error";
				h2.className = "warning";
				var results = document.getElementById('results');
				try {
					results.replaceChild(h2, results.firstChild);
				}
				catch (TypeError) {
					results.appendChild(h2);
				}
			}
		});
	}

	function resetMap() {
		var position = new google.maps.LatLng(53.38108855193859, -1.4801287651062012);
		var options = {
			zoom : 8,
			center: position
		};
		map = new google.maps.Map(document.getElementById("resultsMap"), options);
	}

	/**
	Computes word frequencies
	@param {[string]} lst - the tweet content split by space
	@param {bool} rep - whether or not to remove punctuation
	*/
	function findFrequencies(lst, rep) {
		var frequencies = {};
		var ignore = ['a', 'about', 'above', 'after', 'again', 'against', 'all',
		'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at', 'be',
		'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
		'by', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do',
		'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few',
		'for', 'from', 'further', 'get', 'gmt', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
		'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
		'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
		'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is',
		'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more',
		'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off',
		'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
		'ourselves', 'out', 'over', 'own', 'rt', 'same', 'shan\'t', 'she', 'she\'d',
		'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
		'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
		'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d',
		'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to',
		'too', 'ukire', 'under', 'until', 'up', 'v', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
		'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s',
		'when', 'when\'s', 'where', 'will', 'where\'s', 'which', 'while', 'who',
		'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would',
		'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your',
		'yours', 'yourself', 'yourselves'];
		lst.map(function (a) {
			if (rep) {
				a = a.replace(/[\"?\.,-\/\\!$%\^&\*;:\[\]{}=\-_`~()]/g,"");
			}
			if (($.inArray(a.toLowerCase(), ignore) == -1) &&
			(a.length > 2) &&
			(a.indexOf('#') == -1) &&
			(a.indexOf('@') == -1) &&
			(a.indexOf('http') == -1)) {
				if (a in frequencies) {
					frequencies[a] ++;
				}
				else {
					frequencies[a] = 1;
				}
			}
		});
		pairs = [];
		for (key in frequencies) {
			pairs.push([key, frequencies[key]]);
		}
		pairs.sort(function(a, b) {
			return a[1] - b[1];
		});
		pairs = pairs.reverse();
		return pairs;
	}

	function replace_elem(parent, new_elem, old_elem) {
		try {
			parent.replaceChild(new_elem, old_elem);
		}
		catch (TypeError) {
			parent.appendChild(new_elem);
		}
	}

	function processContent(content, hashtags, urls) {
		content = content.split(" ");
		result = "";
		for (w in content) {
			word = content[w];
			if (word.indexOf("@") > -1 && word.length > 1) {
				word = "<a href = \'http://www.twitter.com/" + word.replace(/[\.,-\/#!$%\^&\*;@:{}=\-_`~()]/g,"") + "\' target = \'_blank\'>" + word + "</a>";
			}
			for (h in hashtags) {
				if (word.indexOf("#" + hashtags[h].replace(/[\"\'\.,-\/\\!$%\^&\*;@:\[\]{}=\-_`~()]/g,"")) > -1) {
					word = word.replace("#" + hashtags[h], "<a href = \'http://www.twitter.com/hashtag/" + hashtags[h] + "\', target = \'_blank\'>" + "#" + hashtags[h] + "</a>");
				}
			}
			for (u in urls) {
				url = urls[u];
				if (word == url) {
					word = "<a href = \'" + url + "\' target = \'_blank\'>" + word + "</a>";
				}
			}
			result += word;
			if (w < content.length - 1) {
				result += " ";
			}
		}
		return result;
	}

	/**
	* Prepares the form for sending to the server
	*/
	function sendData() {
		// empty form check
		err = document.getElementById("errors");
		err.innerHTML = "";
		var formInfo = "";

		var inputs = document.getElementsByTagName("input");
		//console.log(inputs);
		var items=[];
		for (var i=0, length=inputs.length; i<length; i++){
			if (inputs[i].className.indexOf('ignore') >= 0) {}
			else{
				items.push(inputs[i]);
			}
		}
		//console.log(items);



		var lon = document.forms["input"]["longitude"].value;
		var lat = document.forms["input"]["latitude"].value;
		var rad = document.forms["input"]["radius"].value;

		var right = true;
		var handles = document.getElementById("handles").childNodes;
		for (i = 0; i < handles.length; i++) {
			var textPart = document.getElementById("team-handle"+i);
			if (textPart.value != "") {
				var author = document.getElementById("team-author"+i).checked;
				var mention = document.getElementById("team-mention"+i).checked;
				var reply = document.getElementById("team-reply"+i).checked;
				if (!author && !mention && !reply) {
					right = false;
				}
			}
		}

		for (var i = 0; i < items.length; i++) {
			if (items[i].type == "text") {
				formInfo += items[i].value;
			}
		}
		var since = document.getElementById("since").value;
		var until = document.getElementById("until").value
		formInfo += since + until;
		if (formInfo == "") {
			err.innerHTML = "Please enter a search term";
		}
		else if (since != "" && until != "") {
			if (until < since) {
				err.innerHTML = "Please check the dates";
			}
		}
		else if (!right) {
			err.innerHTML = "Please check at least 1 checkbox is ticked";
		}
		else if ((lon != "" || lat != "" || rad != "") && !(lon != "" && lat != "" && rad != "")) {
			err == document.createElement("p");
			err.innerHTML = "Please ensure all three location parameters have a value";
			document.getElementById("location-input").insertBefore(err, document.getElementById("searchMap"));
		}
		else {
			document.getElementById("right-panel").style.visibility = "visible";

			var h3 = document.createElement('h3');
			h3.innerHTML = "Searching";
			var results = document.getElementById('notifications');
			try {
				results.replaceChild(h3, results.firstChild);
			}
			catch (TypeError) {
				results.appendChild(h3);
			}
			handles = document.getElementById("handles").childNodes;
			for (i = 0; i < handles.length; i++) {
				if(document.getElementById("team-author"+i).checked){
					document.getElementById("team-author-hidden"+i).disabled=true;
				}
				if(document.getElementById("team-mention"+i).checked){
					document.getElementById("team-mention-hidden"+i).disabled=true;
				}
				if(document.getElementById("team-reply"+i).checked){
					document.getElementById("team-reply-hidden"+i).disabled=true;
				}
			}
			//var form = document.getElementById('myForm');

			var sendMe = ($('form').serializeObject());
			delete sendMe.team1;
			delete sendMe.team2;
			//console.log(sendMe);
			sendAjaxQuery('http://localhost:3000/', JSON.stringify(sendMe));
			for (i = 0; i < handles.length; i++) {
				document.getElementById("team-author-hidden"+i).disabled=false;
				document.getElementById("team-mention-hidden"+i).disabled=false;
				document.getElementById("team-reply-hidden"+i).disabled=false;
			}
		}
	}

	/**
	* Plots a tweet on the map if it has geolocation data
	* @param {Object} tweet - The tweet to plot on the map
	*/
	function plotTweet(tweet) {
		// plot the tweet on the map
		if (tweet.latitude != null && tweet.longitude != null) {
			showMap = true;
			var latitude = tweet.latitude;
			var longitude = tweet.longitude;
			var author = tweet.posted_by;
			var date = tweet.created_at;

			var marker = new google.maps.Marker({
				position: {lat: latitude, lng: longitude},
				map: map,
				title: author
			});
			var info = '<h2>' + author + '</h2>' + '<h3>' + date + '</h3>' +
			'<p>' + processContent(tweet.content, tweet.hashtag, tweet.urls) + '</p>';

			var tweetInfo = new google.maps.InfoWindow({
				content: info, maxWidth:250
			});

			marker.addListener('click', function() {
				tweetInfo.open(map, marker);
			});
			map.setCenter({lat: latitude, lng: longitude})
		}
	}

	function addPeople() {
		var form = document.getElementById('handles');
		var str = "Twitter handle:<br>" +
		" <input type=\"text\" max=40 name=\"from" + idNum + "\" id=\"team-handle" + idNum + "\"><br>" +
		"	<input type=\"hidden\" id=\"team-author-hidden" + idNum + "\" name=\"team-author-hidden" + idNum + "\" value=\"off\">" +
		"	Author:<input type=\"checkbox\" name=\"team-author" + idNum + "\" id=\"team-author" + idNum + "\" checked>" +
		"	<input type=\"hidden\" id=\"team-mention-hidden" + idNum + "\" name=\"team-mention-hidden" + idNum + "\" value=\"off\">" +
		"	Mentions:<input type=\"checkbox\" name=\"team-mention" + idNum + "\" id=\"team-mention" + idNum + "\" checked>" +
		"	<input type=\"hidden\" id=\"team-reply-hidden" + idNum + "\" name=\"team-reply-hidden" + idNum + "\" value=\"off\">" +
		"	Replies:<input type=\"checkbox\" name=\"team-reply" + idNum + "\" id=\"team-reply" + idNum + "\" checked>";
		var div = document.createElement('div');
		div.className = "form-field inline-block";
		div.innerHTML = "";
		div.innerHTML = str;
		form.appendChild(div);
		idNum++;
	}

	var idNum = 1;
	var sendButton = document.getElementById('send-button');
	sendButton.onclick = sendData;
	var addButton = document.getElementById('add-button');
	addButton.onclick = addPeople;



	/**
	* Sends the data from the form to the server and handles the result
	* @param {string} url - The url of the request
	* @param {string} data - the form in JSON string format
	*/
	function sendAjaxQuery2(url, data) {
		$.ajax({
			type: 'POST',
			url: 'postSearch.html',
			data: data,
			success: function (res) {
				document.getElementById("notifications-1").innerHTML = "";
				res = JSON.parse(res);
				//console.log(res);

				var results1 = document.getElementById('results-team-1');
				var results2 = document.getElementById('results-team-2');
				if (!res[0]) {
					results1.innerHTML = '<h2>Cannot Find Team</h2>';
				}
				else {
					setData(results1, res[0], 1);
				}
				if (!res[1]) {
					results2.innerHTML = '<h2>Cannot Find Team</h2>';
				}
				else {
					setData(results2, res[1], 2);
				}
			},
			error: function (xhr, status, error) {
				var h2 = document.createElement('h2');
				h2.innerHTML = "";
				h2.innerHTML = "Error";
				h2.className = "warning";
				var results = document.getElementById('notifications-1');
				try {
					results.replaceChild(h2, results.firstChild);
				}
				catch (TypeError) {
					results.appendChild(h2);
				}
			}
		});
	}

	/**
	* Displays the SPARQL data in a given object
	* @param {Element} results the div to contain the results
	* @param {Object} res     the object containing the results
	* * @param {int} id     the team being processed
	*/
	function setData(results, res, id) {
		var html = "<h2>"+res.teamData.name+"</h2>";
		html += "<span about="+res.teamData.uri+">" //say which team the following rdfa is about
		html += "<div class=\"scroll-y\">"
		html += "<p>"+prepareDescription(res.teamData.description, id)+"</p>";
		html += "<p><span class=\"bold\">Manager: </span><span property=\"dbo:manager\">"+res.teamData.manager+"</span></p>";
		html += "<img class=\"player-img\" src=\'"+res.teamData.managerImage+"\' alt=\""+res.teamData.manager+"\">"
		html += "<p><span class=\"bold\">Stadium: </span><span property=\"dbo:ground\">"+res.teamData.stadium+"</span></p>";
		html += "<img src=\'"+res.teamData.stadiumImage+"\'>";
		html += "<h2>Players</h2>";
		html += "<ul class=\"no-padding\">";
		for (p in res.players) {
			var player = res.players[p];
			if (player.name) {
				html += "<span about="+player.uri+">" //say which player the following rdfa is about
				html += "<button class=\"accordion flex\"><h3 property=\"foaf:name\">"+player.name+"</h3><a target=\"_blank\" href=\"" + player.uri + "\">View on DBPedia</a></button>";
				html += "<div class=\"panel\">";
				html += "<div><p>"
				if (player.images.length > 0) {
					html += "<img class=\"player-img\" src=\'"+player.images[0]+"\' alt=\""+player.name+"\" align=\"left\">";
				}
				html += player.description+"</p></div>";
				html += "<p><span class=\"bold\">Height: </span><span property=\"dbo:height\">"+player.height+"</span></p>";
				html += "<p><span class=\"bold\">History: </span>";
				html += "<ul>";
				for (h in player.history) {
					html += "<li>"+player.history[h].value+"</li>";
				}
				html += "</ul>";
				html += "</p>";
				html += "<p><span class=\"bold\">Position: </span><span rel=\"dbo:position\">"+player.position+"</span></p>";
				html += "<p><span class=\"bold\">Number: </span><span property=\"dbo:number\">"+player.number+"</span></p>";
				if (player.images.length > 1) {
					html += "<p class=\"bold\">Related images</p>"
					html += "<div class=\"thumbwrap\">"
					for (i=1; i<player.images.length; i++){
						html += "<a class=\"thumbnail inline-block\" target=\"_blank_\", href=\""+player.images[i].url+".jpg\">"
						html += "<img src="+player.images[i].url+"_s.jpg><span><img src="+player.images[i].url+"_m.jpg></span>"
						html += "</a>"
					}
					html += "</div>"
				}
				html += "</div>";
				html += "</span>" //end the player span
			}
			html += "</span>" //end the team span
		}
		html += "</ul>"
		html += "<p><a target=\"_blank\" href=\"" + res.teamData.uri + "\">View on DBPedia</a></p>";
		html += "</div>"
		results.innerHTML = html;

		//Set up the accordion expansion
		var acc = document.getElementsByClassName("accordion");
		for (i in acc) {
			acc[i].onclick = function(){
				this.classList.toggle("active");
				this.nextElementSibling.classList.toggle("show");
			}
		}

		//Set up the read more expansion
		$('.read-more-content'+id).addClass('hide')
		.before('<a class="read-more-show" href="#"> Read More</a>')
		.append(' <a class="read-more-hide" href="#"> Read Less</a>');

		$('.read-more-show').on('click', function(e) {
			$(this).next('.read-more-content'+id).removeClass('hide');
			$(this).addClass('hide');
			e.preventDefault();
		});

		$('.read-more-hide').on('click', function(e) {
			$(this).parent('.read-more-content'+id).addClass('hide').parent().children('.read-more-show').removeClass('hide');
			e.preventDefault();
		});

	}

	function prepareDescription(description, id) {
		descriptionArray = description.split(" ");
		if (descriptionArray.length < 100) {
			return description;
		}
		else {
			result = descriptionArray[0];

			for (i=0; i<100; i++) {
				result += " " + descriptionArray[i];
			}
			result += "<span class=\"read-more-content" + id +"\">";
			for (i=100; i<descriptionArray.length; i++) {
				result += " " + descriptionArray[i];
			}
			result += "</span>";
			return result;
		}
	}

	/**
	* Serializes an object
	* @return a string representing the object
	*/
	$.fn.serializeObject = function () {
		var o = {};
		var a = this.serializeArray();
		$.each(a, function () {
			if (o[this.name] !== undefined) {
				if (!o[this.name].push) {
					o[this.name] = [o[this.name]];
				}
				o[this.name].push(this.value || '');
			} else {
				o[this.name] = this.value || '';
			}
		});
		return o;
	};

	/**
	* Prepares the form for sending to the server
	*/
	function sendData2() {
		//var form = document.getElementById('myForm');
		var err = document.getElementById("errors-1");
		err.innerHTML = "";

		var team1 = document.getElementById("team1").value;
		var team2 = document.getElementById("team2").value;

		if (team1 == "" || team2 == "") {
			err.innerHTML = "Please fill the form";
		}
		else {
			document.getElementById("results-team-1").innerHTML = "";
			document.getElementById("results-team-2").innerHTML = "";
			document.getElementById("notifications-1").innerHTML = "<h2>Searching</h2>";
			sendAjaxQuery2('http://localhost:3001/', JSON.stringify($('form').serializeObject()));
		}
	}

	var sendButton2 = document.getElementById('search-button');
	sendButton2.onclick = sendData2;

};
