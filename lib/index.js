// Generated by CoffeeScript 1.10.0
(function() {
  var Anime, Bottleneck, Episode, KISS_URL, KissHTTP, KissPage, Promise, SearchResult, Video, b, cheerio, debug, k;

  Promise = require('bluebird');

  debug = require('debug')('scraper');

  cheerio = require('cheerio');

  Bottleneck = require('bottleneck');

  KissHTTP = require('./http-wrapper');

  KISS_URL = 'https://kissanime.to';

  k = new KissHTTP();

  b = new Bottleneck(0, 500);

  KissPage = (function() {
    function KissPage(url1, _buffer) {
      this.url = url1;
      this._buffer = _buffer;
      this._$ = cheerio.load(this._buffer);
    }

    KissPage.prototype.getTableRows = function() {
      var arr;
      arr = [];
      this._$(".listing tr").not(".head").not("[style]").not(":contains(Episode name)").not(":contains(Anime name)").each((function(_this) {
        return function(index, value) {
          var altText, nameTag, result;
          nameTag = _this._$(value).children("td").first().find("a");
          altText = _this._$(value).children("td").eq(1);
          result = {
            name: nameTag.text().trim(),
            url: "" + KISS_URL + (nameTag.attr("href")),
            alt: altText.text().trim()
          };
          return arr[index] = result;
        };
      })(this));
      return arr;
    };

    KissPage.prototype.getQualityList = function() {
      var arr;
      arr = [];
      this._$('#selectQuality > option').each((function(_this) {
        return function(index, value) {
          var buf, name, url;
          name = _this._$(value).text();
          url = _this._$(value).attr('value');
          buf = new Buffer(url, 'base64');
          url = buf.toString('utf-8');
          return arr[index] = {
            name: name,
            url: url
          };
        };
      })(this));
      return arr;
    };

    KissPage.fromUrl = function(url) {
      return k.request(url).then(function(resp) {
        return new KissPage(url, resp.body);
      });
    };

    return KissPage;

  })();

  Video = (function() {
    function Video(obj) {
      this.name = obj.name, this.url = obj.url;
    }

    return Video;

  })();

  SearchResult = (function() {
    function SearchResult(obj) {
      this.name = obj.name, this.url = obj.url, this.last_episode = obj.last_episode;
    }

    SearchResult.prototype.toAnime = function() {
      return Anime.fromUrl(this.url);
    };

    return SearchResult;

  })();

  Episode = (function() {
    function Episode(obj) {
      this.name = obj.name, this.url = obj.url, this.video_links = obj.video_links;
    }

    Episode.fromUrl = function(url) {
      return KissPage.fromUrl(url).then(function(page) {
        if (page._buffer.indexOf('has not been released yet') > -1) {
          throw new Error('Invalid episode/not released.');
        }
        debug(page);
        return new Episode({
          name: page._$("meta[name='keywords']").attr('content').split(',')[0],
          url: url,
          video_links: page.getQualityList().map(function(row) {
            return new Video(row);
          })
        });
      });
    };

    Episode.prototype.fetch = function() {
      return Episode.fromUrl(this.url);
    };

    return Episode;

  })();

  Anime = (function() {
    function Anime(obj) {
      this.name = obj.name, this.url = obj.url, this.summary = obj.summary, this.genres = obj.genres, this.names = obj.names, this.episodes = obj.episodes;
    }

    Anime.fromUrl = function(url) {
      return KissPage.fromUrl(url).then(function(page) {
        if (page._$('title').text().trim() === 'KissAnime - Watch anime online in high quality') {
          throw new Error('KissAnime returned an error.');
        }
        return new Anime({
          url: page.url,
          name: page._$(".bigChar").text().trim(),
          summary: page._$("p:contains('Summary')").next().text().trim(),
          genres: page._$("span:contains('Genres')").parent().text().replace('Genres:', '').trim().split(',').map(function(s) {
            return s.trim();
          }),
          names: page._$("span:contains('Other name:')").parent().text().replace('Other name:', '').trim().split(';').map(function(s) {
            return s.trim();
          }),
          episodes: page.getTableRows().map(function(e) {
            return new Episode(e);
          })
        });
      });
    };

    Anime.fromSearchResult = function(searchResult) {
      return Anime.fromUrl(searchResult.url);
    };

    Anime.search = function(query) {
      var body, options, url;
      url = KISS_URL + "/AdvanceSearch";
      body = 'animeName=' + query + '&status=&genres=';
      options = {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      debug('Starting AdvanceSearch');
      return k.request(url, options).then(function(resp) {
        var kiss_page, rows, search_results;
        debug('AdvanceSearch Ended');
        kiss_page = new KissPage(url, resp.body);
        rows = kiss_page.getTableRows();
        search_results = rows.map(function(row) {
          row.last_episode = row.alt;
          return new SearchResult(row);
        });
        return search_results;
      });
    };

    Anime.fromName = function(query) {
      return Anime.search(query).then(function(results) {
        if (results.length > 0) {
          return results[0].toAnime();
        } else {
          throw new Error('No anime found by that name.');
        }
      });
    };

    Anime.prototype.fetchAllEpisodes = function() {
      return Promise.map(this.episodes, function(episode) {
        return episode.fetch();
      }, {
        concurrency: 1
      }).then((function(_this) {
        return function(episodes) {
          return _this.episodes = episodes;
        };
      })(this));
    };

    return Anime;

  })();

  module.exports = {
    Anime: Anime,
    Episode: Episode,
    SearchResult: SearchResult,
    Video: Video
  };

}).call(this);
