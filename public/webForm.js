window.onload = function() {
	/**
	* Sends the data from the form to the server and handles the result
	* @param {string} url - The url of the request
	* @param {string} data - the form in JSON string format
	*/
	function sendAjaxQuery(url, data) {
		$.ajax({
			type: 'POST',
			url: 'postSearch.html',
			data: data,
			success: function (res) {
		        document.getElementById("notifications").innerHTML = "";
				res = JSON.parse(res);
				console.log(res);

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

	/**
	* Displays the SPARQL data in a given object
	* @param {Element} results the div to contain the results
	* @param {Object} res     the object containing the results
	* * @param {int} id     the team being processed
	*/
	function setData(results, res, id) {
		var html = "<h2><a href=\""+res.teamData.uri+"\">"+res.teamData.name+"</a></h2>";
		html += "<div class=\"scroll-y\">"
		html += "<p>"+prepareDescription(res.teamData.description, "description-"+id)+"</p>";
		html += "<p><span class=\"bold\">Manager: </span>"+res.teamData.manager+"</p>";
		html += "<p><span class=\"bold\">Staduim: </span>"+res.teamData.stadium+"</p>";
		html += "<img src=\'"+res.teamData.stadiumImage+"\'>";
		html += "<h2>Players</h2>";
		html += "<ul class=\"no-padding\">";
		for (p in res.players) {
			var player = res.players[p];
			if (player.name) {
				html += "<button class=\"accordion\"><h3 property=\"foaf:name\">"+player.name+"</h3></button>";
				html += "<div class=\"panel\">";
				html += "<p>"+player.description+"</p>";
				html += "<p><span class=\"bold\">Height: </span><span property=\"dbo:height\">"+player.height+"</span></p>";
				//html += "<div property=\"dbo:\""+player.height+"></div>"
				html += "<p><span class=\"bold\">History: </span>";
				html += "<ul>";
				for (h in player.history) {
					html += "<li>"+player.history[h].value+"</li>";
				}
				html += "</ul>";
				html += "</p>";
				html += "<p><span class=\"bold\">Position: </span><span rel=\"dbo:position\">"+player.position+"</span></p>";
				//html += "<div rel=\"dbo:\""+player.position+"></div>"
				html += "<p><span class=\"bold\">Number: </span><span property=\"dbo:number\">"+player.number+"</span></p>";
				//html += "<div property=\"dbo:\""+player.number+"></div>"
				html += "<img src=\'"+player.image+"\'>";
				html += "<p><a href=\""+player.uri+"\">dpedia Link</a></p>"
				html += "</div>";
			}
		}
		html += "</ul>"
		html += "</div>"
		results.innerHTML = html;
		var acc = document.getElementsByClassName("accordion");
		var i;

		for (i = 0; i < acc.length; i++) {
			acc[i].onclick = function(){
				this.classList.toggle("active");
				this.nextElementSibling.classList.toggle("show");
			}
		}
	}

	function prepareDescription(description, id) {
		return description;
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
	function sendData() {
		//var form = document.getElementById('myForm');
		document.getElementById("results-team-1").innerHTML = "";
		document.getElementById("results-team-2").innerHTML = "";
		document.getElementById("notifications").innerHTML = "<h2>Searching</h2>";
		sendAjaxQuery('http://localhost:3001/', JSON.stringify($('form').serializeObject()));
	}

	var sendButton = document.getElementById('search-button');
	sendButton.onclick = sendData;
};
