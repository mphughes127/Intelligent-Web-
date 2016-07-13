var protocol = require('http');
var stat = require('node-static');
var util = require('util');
var url = require('url');
var querystring = require('querystring');
var Twit = require('twit');
var mysql = require('mysql');
var SparqlClient = require('sparql-client');
var express = require('express');
var path = require('path');
var file = new (stat.Server)();
var portNo = 3001;
var app = express();
var server = app.listen(portNo);
var Flickr = require("node-flickr");
var keys = {"api_key": "039b7a6cc8e06f83e9f090dcb9b4bbe7"}
flickr = new Flickr(keys);
var client = new Twit({
  consumer_key: 'SAfh4eOLlzLs9eTKKMP2jHb0p',
  consumer_secret: '0SDAxe9XGtOxG0C1s6xyXIrJs6f43ZaATPRQLOJfmqeFjzj5uF',
  access_token: '703229342055329792-RvXEjiIqDtqFtEOUigIm3k4kGKVdIG7',
  access_token_secret: 'FSVUdIgYFqeObHxo9KPXD0W3P5lWkbsDbLaGtqfdZo8ya'
});
var connection = mysql.createConnection(
  {
    host     : 'stusql.dcs.shef.ac.uk',
    port     : '3306',
    user     : 'team080',
    password : '60ae51c2',
    database : 'team080'
  }
);
var endpoint = 'http://dbpedia.org/sparql';

app.use(express.static('public'));

// simplify the URL
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname+'/queryInterface.html'));
});
app.get('/queryInterface.html', function(req, res) {
  res.sendFile(path.join(__dirname+'/queryInterface.html'));
});
app.get('/queryInterface', function(req, res) {
  res.sendFile(path.join(__dirname+'/queryInterface.html'));
});

/**
* Function to handle the submitted form
* @param  {string} '/postFile.html' The action url from the form
* @param  {function} function(req, res) Top
*/
app.post('/postFile.html', function(req, res) {
  var body = '';
  req.on('data', function (data) {
    body +=  data;
    // if body >  1e6 == = 1 * Math.pow(10, 6) ~~~ 1MB
    // flood attack or faulty client
    // (code 413: req entity too large), kill req
    if (body.length > 1e6) {
      res.writeHead(413, {'Content-Type': 'text/plain'}).end();
      req.connection.destroy();
    }
    var form = JSON.parse(body);
    var fields = [];
    var toReturn = {tweets: [], twitterResponse: null, sqlErrors: []};
    for (field in form) {
      if (form[field] !=  "" && field !=  "search") {
        fields.push([field, form[field]]);
      }
    }

    query = "SELECT date FROM querylog WHERE (query = '";
    formData = "";
    for (f in fields) {
      formData += fields[f][0] + " = " + fields[f][1] + " ";
    }
    query += formData + "');";
    //console.log(query);
    connection.query(query, function(error, result, field) {
      if(error) {
        sqlError(error, toReturn, res);
      }
      else if(!result.length) {
        //Value not in database
        getTweets(fields, new Date("October 26 2015"), form.search, res, toReturn);
      }
      else {
        //Value in database
        getTweets(fields, new Date(result[0].date), form.search, res, toReturn);
      }
    });
    logQuery(formData, toReturn, res);
  });
});

/**
* Function to take a list of tweets and insert them into the database
* @param {type} err - An error, should one arise from the Twitter search
* @param {[type]} data - The tweets to process
* @param {type} response - The response code from twitter
*/
var processTweets = function(res, toReturn) {
  return function(err, data, response) {
    toReturn.twitterCode = response.statusCode;
    toReturn.twitterMessage = response.statusMessage;

    if (data.statuses.length == 0) {
      res.end(JSON.stringify(toReturn));
    }
    for (var indx in data.statuses) {
      var tweet =  data.statuses[indx];
      var toAdd = [];

      connection.query("SELECT * FROM tweets WHERE (string_id = \'"+tweet.id_str+"\');", function(error, result, field) {
        if(error) {
          sqlError(error, toReturn, res);
        }
        //If there isn't already a tweet with that id in the database then put it in
        else if(!result.length) {
          toAdd.push(true);
          insertTweets(data.statuses, toAdd, res, toReturn);
        }
        //If the tweet is already in the database add it
        else {
          toAdd.push(false);
          insertTweets(data.statuses, toAdd, res, toReturn);
        }
      });
    }
  }
}

/**
* Adds the list of tweets to the database
* @param {Array} - tweets - The list of tweets to add
* @param {bool} toAdd - How many tweets need to be added, an indicator that it
* has finished
*/
function insertTweets(tweets, toAdd, res, toReturn) {
  if (tweets.length ==  toAdd.length) {
    results = [];
    for (tweet in tweets) {
      if (toAdd[tweet]) {
        insertTweet(tweets[tweet], toReturn, res);
      }
      toReturn.tweets.push(prepareData(tweets[tweet]));
    }
    res.end(JSON.stringify(toReturn));
  }
}

/**
* Converts a Twitter tweet object to a simpler version compatable with the database
* @param {type} tweet - The tweet to convert
* @return {string} The json string of the new tweet object
*/
function prepareData(tweet) {
  var result = {string_id: tweet.id_str,
    posted_by: tweet.user.screen_name,
    created_at: tweet.created_at,
    content: tweet.text};
    if (tweet.retweeted_status !=  null) {
      result.author = tweet.retweeted_status.user.screen_name;
    }
    else {
      result.author = null;
    }
    if (tweet.coordinates !=  null){
      result.longitude = tweet.coordinates.coordinates[0];
      result.latitude = tweet.coordinates.coordinates[1];
    }
    else {
      result.longitude = null;
      result.latitude = null;
    }
    result.objects = [];
    result.hashtags = [];
    result.urls = [];
    if (tweet.entities) {
      if (tweet.entities.media) {
        for (m in tweet.entities.media) {
          result.objects.push({"type":tweet.entities.media[m].type, "url":tweet.entities.media[m].media_url});
        }
      }
      if (tweet.entities.urls) {
        for (u in tweet.entities.urls) {
          result.urls.push(tweet.entities.urls[u].url);
        }
      }
      if (tweet.entities.hashtags) {
        for (h in tweet.entities.hashtags) {
          result.hashtags.push(tweet.entities.hashtags[h].text);
        }
      }
      if (tweet.in_reply_to_screen_name) {
        result.in_reply_to = tweet.in_reply_to_screen_name;
      }
      if (tweet.user.profile_image_url) {
        result.profile_pic = tweet.user.profile_image_url;
      }

      return result;
    }
  }

  /**
  * Inserts a given tweet into the database
  * @param {type} tweet - A tweet to be inserted into the database
  */
  function insertTweet(tweet, toReturn, res) {
    var query = "INSERT INTO tweets VALUES ("
    + "\'" + tweet.id_str + "\'"
    + ", \'" + tweet.user.screen_name + "\'";
    if (tweet.retweeted_status) {
      query +=  ", \'" + tweet.retweeted_status.user.screen_name + "\'";
    }
    else {
      query +=  ", NULL"
    }
    query +=  ", \'" + tweet.created_at + "\'"
    + ", " + connection.escape(tweet.text);
    if (tweet.coordinates) {
      query +=  ", \'" + tweet.coordinates.coordinates[1] + "\'"
      + ", \'" + tweet.coordinates.coordinates[0] + "\', ";
    }
    else {
      query +=  ", NULL, NULL, "
    }
    if (tweet.in_reply_to_screen_name) {
      query += "\'" + tweet.in_reply_to_screen_name + "\', ";
    }
    else {
      query += "NULL, ";
    }
    if (tweet.user.profile_image_url) {
      query += "\'" + tweet.user.profile_image_url + "\'";
    }
    else {
      query += "NULL"
    }
    query +=   ");";

    var result = connection.query(query);
    result.on('error', function(err) {
      sqlError(err, toReturn, res);
    });

    if (tweet.entities) {
      if (tweet.entities.media) {
        for (m in tweet.entities.media) {
          query = "INSERT INTO media VALUES (" + tweet.id_str + ", \'" + tweet.entities.media[m].media_url + "\', \'" + tweet.entities.media[m].type + "\');";
          entity = connection.query(query);
          entity.on('error', function(err) {
            sqlError(err, toReturn, res);
          })
        }
      }
      if (tweet.entities.urls) {
        for (u in tweet.entities.urls) {
          query = "INSERT INTO urls VALUES (" + tweet.id_str + ", \'" + tweet.entities.urls[u].url + "\');";
          entity = connection.query(query);
          entity.on('error', function(err) {
            sqlError(err, toReturn, res);
          });
        }
      }
      if (tweet.entities.hashtags) {
        for (h in tweet.entities.hashtags) {
          query = "INSERT INTO hashtags VALUES (" + tweet.id_str+ ", \'" + tweet.entities.hashtags[h].text + "\');";
          entity = connection.query(query);
          entity.on('error', function(err) {
            sqlError(err, toReturn, res);
          });
        }
      }
    }
  }

  /**
  * Code to handle SQL errors
  * @param {Error} err - The error to be handled
  */
  function sqlError(err, toReturn, res) {
    toReturn.sqlErrors.push(err.message);
    console.log(err.message);
    //If fatal error, reset the connection
    if (err.fatal) {
      connection.destroy();
      connection = mysql.createConnection(
        {
          host     : 'stusql.dcs.shef.ac.uk',
          port     : '3306',
          user     : 'team080',
          password : '60ae51c2',
          database : 'team080'
        }
      );
    }
    res.end(JSON.stringify(toReturn));
  }

  /**
  * Searches twitter for tweets matching the fields given
  * @param {[type]} fields - A list of lists of the form [field, value] to be
  * searched for
  * @param {[type]} times - A list of times extracted from the database as to
  * when that particular field, value combination was last searched for
  * @param {bool} search - The tickbox from the form indicating if twitter is
  * to be searched
  */
  function getTweets(fields, time, search, res, toReturn) {
    res.writeHead(200, {"Content-Type": "text/plain"});
    searchSQL(fields, res, search, toReturn);
    if (search) {
      minTime = time.toISOString().substring(0, 10);
      //build search query from form,ifentifier used if twitter wants, otherwise just put the word in
      //use twitters search bar to make sure that query will actually return something
      searchQuery = "";
      longitude = null;
      latitude = null;
      radius = null;
      handleFlag = false;
      for (f in fields) {
        if (fields[f][0].indexOf("from") > -1) {
          fromFlag = false;
          if (handleFlag) {
            searchQuery += "OR "
          }
          handleFlag = true;
          fields[f][1] = fields[f][1].replace("@", "");
          //checking which checkboxes are active (at least one must be active)
          if(fields[Number(f)+1][1] ==  "on"){
            searchQuery +=  "from:" + fields[f][1] + " ";
            fromFlag = true;
          }
          if(fields[Number(f)+2][1] ==  "on"){
            if(fromFlag){
              searchQuery += " OR ";
            }
            searchQuery +=  "@" + fields[f][1] + " ";
            fromFlag = true;
          }
          if(fields[Number(f)+3][1] ==  "on"){
            if(fromFlag){
              searchQuery += " OR ";
            }
            searchQuery +=  "to:" + fields[f][1] + " ";
            fromFlag = true;
          }
        }
        if (fields[f][0] ==  "longitude") {
          longitude = fields[f][1];
        }
        if (fields[f][0] ==  "latitude") {
          latitude = fields[f][1];
        }
        if (fields[f][0] ==  "radius") {
          radius = parseInt(fields[f][1]);
        }
        else if(fields[f][0] == "hashtag"){
          searchQuery +=  "#" + fields[f][1] + " ";
        }
        else if(fields[f][0] == "keyword"){
          searchQuery +=  fields[f][1] + " ";
        }
        else if(fields[f][0] == "since"){
          if (new Date(fields[f][1]) > minTime) {
            searchQuery +=  "since:" + fields[f][1] + " ";
          }
        }
        else if(fields[f][0] == "until"){
          searchQuery +=  "until:" + fields[f][1] + " ";
        }
        if (longitude && latitude && radius) {
          searchQuery +=  "geocode:\"" + latitude + "," + longitude + "," + radius + "mi\" ";
        }

      }
      if (searchQuery.indexOf("since:") == -1) {
        searchQuery +=  "since:" + minTime;
      }
      client.get('search/tweets', { q: searchQuery, count: 300 }, processTweets(res, toReturn));
    }
  }

  /**
  * Searches the database for tweets
  * @param {Array} fields - A list of lists of the form [field, value] to be
  * searched for
  * @param {bool} searchingOn - Whether or not twitter has been queried, to
  * indicate if the return file should be ended
  */
  function searchSQL(fields, res, searchingOn, toReturn) {
    sqlQuery = "SELECT * FROM tweets LEFT JOIN media ON tweets.string_id = media.tweet_id " +
    "LEFT JOIN hashtags ON tweets.string_id = hashtags.tweet_id " +
    "LEFT JOIN urls ON tweets.string_id = urls.tweet_id " +
    "WHERE ";
    sqlFlag = false;
    longitude = null;
    latitude = null;
    radius = null;
    handlesFlag = false;
    for (f in fields) {
      if (fields[f][0] ==  "longitude") {
        longitude = fields[f][1];
      }
      if (fields[f][0] ==  "latitude") {
        latitude = fields[f][1];
      }
      if (fields[f][0] ==  "radius") {
        radius = parseInt(fields[f][1]) * 0.621371;
      }
      if (fields[f][0].indexOf("from") > -1) {
        fromFlag = false;
        if (handlesFlag) {
          searchQuery += "OR "
        }
        handlesFlag = true;
        fields[f][1] = fields[f][1].replace("@", "");
        //checking which checkboxes are active (at least one must be active)
        if(fields[Number(f)+1][1] ==  "on"){
          sqlQuery +=  "posted_by = \'" + fields[f][1] + "\' ";
          fromFlag = true;
        }
        if(fields[Number(f)+2][1] ==  "on"){
          if(fromFlag){
            sqlQuery += " OR ";
          }
          sqlQuery +=  "content LIKE \'%@" + fields[f][1] + "%\' ";
          fromFlag = true;
        }
        if(fields[Number(f)+3][1] ==  "on"){
          if(fromFlag){
            sqlQuery += " OR ";
          }
          sqlQuery +=  "in_reply_to = \'" + fields[f][1] + "\' ";
          fromFlag = true;
        }
      }
      else if(fields[f][0] == "since"){
        if (sqlFlag) {
          sqlQuery +=  "AND ";
        }
        sqlQuery +=  "created_at > " + fields[f][1] + " ";
        sqlFlag = true;
      }
      else if(fields[f][0] == "hashtag"){
        fields[f][1] = fields[f][1].replace("#", "");
        if (sqlFlag) {
          sqlQuery +=  "AND ";
        }
        sqlQuery +=  "content LIKE \'%#" + fields[f][1] + "%\' ";
        sqlFlag = true;
      }
      else if(fields[f][0] == "keyword"){
        if (sqlFlag) {
          sqlQuery +=  "AND ";
        }
        sqlQuery +=  "content LIKE \'%" + fields[f][1] + "%\' ";
        sqlFlag = true;
      }
      else if(fields[f][0] == "until"){
        if (sqlFlag) {
          sqlQuery +=  "AND ";
        }
        sqlQuery +=  "created_at < " + fields[f][1] + " ";
        sqlFlag = true;
      }
    }
    if (longitude && latitude && radius) {
      if (sqlFlag) {
        sqlQuery +=  "AND ";
      }
      sqlQuery +=  "MBRContains ( " +
      "LineString ( " +
      "Point ( " + longitude + " + " + radius + " / ( 69 / COS(RADIANS(" + latitude + "))), " + latitude + " + " + radius + " / 69 ), " +
      "Point ( " + longitude + " - " + radius + " / ( 69 / COS(RADIANS(" + latitude + "))), " + latitude + " - " + radius + " / 69 ) " +
      "), " +
      "Point(longitude, latitude)" +
      ")";
    }
    sqlQuery +=  ";";
    var result = connection.query(sqlQuery, function(err, rows, fields) {
      if (err) {
        sqlError(err, toReturn, res);
      }
      else {
        tweets = {}
        for (r in rows) {
          row = rows[r];
          if (tweets.hasOwnProperty(row.string_id)) {
            if (row.hashtag) {
              tweets[row.string_id].hashtag.push(row.hashtag);
            }
            object_urls = [];
            for (o in tweets[row.string_id].objects) {
              object_urls.push(tweets[row.string_id].objects[o].url);
            }
            if (row.object_url && object_urls.indexOf(row.object_url) ==  -1) {
              tweets[row.string_id].objects.push({"type": row.type, "url": row.object_url});
            }
            tweet_urls = [];
            for (o in tweets[row.string_id].urls) {
              tweet_urls.push(tweets[row.string_id].urls[o]);
            }
            if (row.url && tweet_urls.indexOf(row.url) ==  -1) {
              tweets[row.string_id].urls.push(row.url);
            }
          }
          else {
            tweets[row.string_id] = row;
            if (row.hashtag) {
              tweets[row.string_id].hashtag = [row.hashtag];
            }
            else {
              tweets[row.string_id].hashtag = [];
            }
            if (row.object_url) {
              tweets[row.string_id].objects = [{"type": row.type, "url": row.object_url}]
            }
            else {
              tweets[row.string_id].objects = [];
            }
            if (row.url) {
              tweets[row.string_id].urls = [row.url];
            }
            else {
              tweets[row.string_id].urls = [];
            }
          }
        }
        var i = 0;
        for (t in tweets) {
          toReturn.tweets.push(tweets[t]);
        }
        if (! searchingOn) {
          res.end(JSON.stringify(toReturn));
        }
      }
    });
  }

  /**
  * Inserts a given (field, value) pair into the query database along with the
  * current time so Twitter queries can be logged
  * @param {string} field - The twitter field to be logged
  * @param {string} value - The value of the field
  */
  function logQuery(query, toReturn, res) {
    query = "INSERT INTO querylog VALUES ("
    + connection.escape(query) + ", "
    + "NOW()) ON DUPLICATE KEY UPDATE date = NOW();";
    var result = connection.query(query);

    result.on('error', function(err) {
      sqlError(err, toReturn, res);
    });
  }

  // ------------ SPARQL stuff -------------------------------------------------
  app.post('/postSearch.html', function(req, res) {
    var body = '';
    req.on('data', function (data) {
      body +=  data;
      // if body >  1e6 == = 1 * Math.pow(10, 6) ~~~ 1MB
      // flood attack or faulty client
      // (code 413: req entity too large), kill req
      if (body.length > 1e6) {
        res.writeHead(413, {'Content-Type': 'text/plain'}).end();
        req.connection.destroy();
      }

      res.writeHead(200, {"Content-Type": "text/plain"});
      var whatToReturn = []; // list, [{team1data and players}, team2]
      var form = JSON.parse(body);

      getTeam(form.team1.split(' ').join('_'), form.team2.split(' ').join('_'), whatToReturn, res);

    });
  });

  function getTeam(team1, team2, toReturn, res) {

    if (toReturn.length > 1) {
      res.end(JSON.stringify(toReturn));
    }
    else {
      var searchTeam = '';
      if (toReturn.length == 0) {
        searchTeam = team1;
      }
      if (toReturn.length == 1) {
        searchTeam = team2;
      }
      //console.log(searchTeam);

      var teamURI = 'http://dbpedia.org/resource/'+ searchTeam;

      var query = "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"+
      "PREFIX dbp: <http://dbpedia.org/property/>"+
      "PREFIX dbo: <http://dbpedia.org/ontology/>"+
      "SELECT ?name ?desc ?players ?manager ?managerIm ?stad ?stadIm FROM <http://dbpedia.org> WHERE {"+
      "?team dbp:name ?players;"+
      "dbo:abstract ?desc;"+
      "dbp:fullname ?name;"+
      "dbo:manager ?managerU;"+
      "dbo:ground ?stadU."+
      "?managerU dbp:fullname ?manager."+
      "?managerU foaf:depiction ?managerIm."+
      "?stadU foaf:name ?stad."+
      "?stadU foaf:depiction ?stadIm."+
      "FILTER ( langMatches(lang(?desc), \"EN\"))"+
      "}";
      var client = new SparqlClient(endpoint);
      //console.log("Query to " + endpoint);
      //console.log("Query: " + query);
      client.query(query).bind('team', '<'+ teamURI +'>') // pick a team
      .execute({format: 'resource', resource: 'name'}, function(error, results) {
        if (error) {
          console.log('SPARQL ERROR!!!');
          res.writeHead(500, {'Content-Type': 'text/plain'}).end();
          req.connection.destroy();
        }
        //console.log(util.inspect(results, null, 20, true)+"\n\n");
        if (results.results.bindings.length == 0) {
          //console.log("There are no dbpedia results for this team "+searchTeam+"...");
          toReturn.push(false);
          getTeam(team1, team2, toReturn, res);
        }
        else {
          var team = convertTeam(results.results.bindings[0]);
          team.uri = teamURI;
          //console.log(team);
          toReturn.push({teamData:team, players:[]})
          for (var play in team.players) {
            //console.log(team.players[play]);
            getAPlayer(team.players[play], toReturn, team.players, team1, team2, res);
          }
        }
      });
    }
  }

  function convertTeam(obj) {
    var team = {players:[]};
    team.name = obj.name.value;
    team.description = obj.desc[0].value;
    // iterate through the players
    for (i = 0; i < obj.players.length; i++) {
      team.players.push({value: obj.players[i].value, isURI: (obj.players[i].type == 'uri')});
    }
    team.manager = obj.manager[0].value;
    team.managerImage = obj.managerIm[0].value;
    team.stadium = obj.stad[0].value;
    team.stadiumImage = obj.stadIm[0].value;
    return team;
  }

  // pass a URI, preferably from a team
  // take a callback
  function getAPlayer(uri, toReturn, playerList, team1, team2, res) {
    //console.log(uri);
    if (!uri.isURI) {
      toReturn[toReturn.length-1].players.push(uri.value);
      if (toReturn[toReturn.length-1].players.length == playerList.length) {
        getTeam(team1, team2, toReturn, res);
      }
    }
    else {
      var query = "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"+
      "PREFIX dbp: <http://dbpedia.org/property/>"+
      "PREFIX dbo: <http://dbpedia.org/ontology/>"+
      "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"+
      "SELECT ?name ?image ?posU ?pos ?desc ?histU ?hist ?height ?num FROM <http://dbpedia.org> WHERE {"+
      "?player dbp:fullname ?name;"+
      "foaf:depiction ?image;"+
      "dbo:position ?posU;"+
      "dbo:abstract ?desc;"+
      "dbp:clubs ?histU;"+
      "dbo:height ?height;"+
      "dbo:number ?num."+
      "?posU rdfs:label ?pos."+
      "?histU dbp:clubname ?hist."+
      "FILTER ( langMatches(lang(?desc), \"EN\") && langMatches(lang(?pos), \"EN\"))"+
      "}";
      var client = new SparqlClient(endpoint);
      //console.log("Query to " + endpoint);
      //console.log("Query: " + query);
      client.query(query).bind('player', '<'+uri.value+'>')
      .execute({format: 'resource', resource: 'name'}, function(error, results) {
        //console.log(util.inspect(results, null, 20, true)+"\n\n");
        if (error) {
          console.log('SPARQL ERROR!!!');
          res.writeHead(500, {'Content-Type': 'text/plain'}).end();
          req.connection.destroy();
        }
        var player = uri.value;
        if (results.results.bindings.length != 0) {
          player = convertPlayer(results.results.bindings[0]); // because binding is a list
          player.uri = uri.value;
          flickr.get("photos.search", {"text":player.name, "privicy_filter":1, "per_page":5, "page":1}, function(err, result){
            if (err) return console.error(err);
            //console.log(result.photos.photo);
            for (p in result.photos.photo) {
              pic = result.photos.photo[p];
              url = {url:"https://farm"+pic.farm+".staticflickr.com/"+pic.server+"/"+pic.id+"_"+pic.secret, alt:pic.title};
              player.images.push(url);
            }
            toReturn[toReturn.length-1].players.push(player);
            if (toReturn[toReturn.length-1].players.length == playerList.length) {
              getTeam(team1, team2, toReturn, res);
            }
          });
        }
        //console.log(player);
        else {
          toReturn[toReturn.length-1].players.push(player);
          if (toReturn[toReturn.length-1].players.length == playerList.length) {
            getTeam(team1, team2, toReturn, res);
          }
        }
      });
    }
  }

  function convertPlayer(obj) {
    var player = {history:[], images:[]};
    player.name = obj.name.value;
    player.images.push(obj.image[0].value);
    player.posURI = obj.posU[0].value;
    player.position = obj.pos[0].value;
    player.description = obj.desc[0].value;
    for (i = 0; i < obj.hist.length; i++) {
      player.history.push({value: obj.hist[i].value, uri: obj.histU[i].value});
    }
    player.height = obj.height[0].value;
    player.number = obj.num[0].value;
    return player;
  }
