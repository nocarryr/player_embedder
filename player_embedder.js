(function($){
    var playerEmbedder = {
        embed_methods: ['auto', 'html5', 'shaka', 'strobe'],
        html5_embed_method: 'html5',
        libRootUrls: {
            'all':'player_embedder',
            'strobe':'/strobe-media',
        },
        cssUrls: {
            //'strobe':[
                //'_ROOTURL_STROBE_/jquery.strobemediaplayback.css',
            //],
            'all':[
                '_ROOTURL_ALL_/player_embedder.css',
            ]
        },
        scriptUrls: {
            'strobe':[
                '//ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js',
                //'_ROOTURL_STROBE_/jquery.strobemediaplayback.js',
            ],
            'shaka':[
                '//cdnjs.cloudflare.com/ajax/libs/shaka-player/1.5.0/shaka-player.compiled.js',
            ]
        },
        debugMode: false,
        debugOutputFunction: null,
        debugSaveDataEnable: false,
        debugData: [],
        debug: function(){
            if (!this.debugMode){
                return;
            }
            if (typeof(this.firstDebugTimestamp) == 'undefined'){
                this.firstDebugTimestamp = new Date();
                this.debug('Log Start: ', this.firstDebugTimestamp.toString());
            }
            var args = [new Date() - this.firstDebugTimestamp, 'playerEmbedder'];
            $.each(arguments, function(i, arg){
                args.push(arg);
            });
            if (this.debugOutputFunction == 'console'){
                console.log(args);
            } else if (this.debugOutputFunction){
                this.debugOutputFunction(args);
            }
            if (this.debugSaveDataEnable){
                this.debugData.push(args);
            }
        },
        formatLibUrl: function(url){
            var self = this,
                replTxt,
                lib,
                libUrl;
            if (url.indexOf('_ROOTURL_') == -1){
                return url;
            }
            lib = url.split('_ROOTURL_')[1].split('_')[0];
            replTxt = ['', 'ROOTURL', lib, ''].join('_');
            libUrl = self.libRootUrls[lib.toLowerCase()];
            return url.replace(replTxt, libUrl);
        },
        loadSources: function(libName){
            var self = this,
                cssComplete = false,
                scriptsComplete = false,
                loadedSources = $("body").data('player_embedder_sources_loaded'),
                dfd = $.Deferred();
            self.debug('loading sources');
            if (typeof(loadedSources) == 'undefined'){
                loadedSources = {};
                $("body").data('player_embedder_sources_loaded', loadedSources);
            } else {
                self.debug('sources already loaded: ', loadedSources);
            }
            if (libName != 'all' && !loadedSources.all){
                self.loadSources('all');
            }
            function loadCss(){
                var numResponse = 0,
                    urls = self.cssUrls[libName];
                if (!urls || urls.length == 0){
                    $("body").trigger('player_embedder_css_loaded', [libName]);
                    return;
                }
                self.debug('loading css');
                $.each(urls, function(i, url){
                    if (!url){
                        return;
                    }
                    url = self.formatLibUrl(url);
                    $.get(url, function(data){
                        var s = $('<style type="text/css"></style');
                        s.text(data);
                        $("body").append(s);
                        numResponse += 1;
                        if (numResponse == urls.length){
                            $("body").trigger('player_embedder_css_loaded', [libName]);
                        }
                    });
                });
            }
            function loadJs(){
                var numResponse = 0,
                    urls = self.scriptUrls[libName];
                if (!urls || urls.length == 0){
                    $("body").trigger('player_embedder_scripts_loaded', [libName]);
                    return;
                }
                self.debug('loading js');
                $.each(urls, function(i, url){
                    if (!url){
                        return;
                    }
                    url = self.formatLibUrl(url);
                    $.getScript(url, function(){
                        numResponse += 1;
                        if (numResponse == urls.length){
                            $("body").trigger('player_embedder_scripts_loaded', [libName]);
                        }
                    });
                });
            }
            function doComplete(){
                loadedSources[libName] = true;
                if (cssComplete && scriptsComplete){
                    self.debug('all sources loaded');
                    $("body").trigger('player_embedder_sources_loaded', [libName]);
                }
                dfd.resolve(libName);
            }
            if (loadedSources[libName]){
                cssComplete = true;
                scriptsComplete = true;
                doComplete();
                return dfd.promise();
            }
            $("body").one('player_embedder_css_loaded', function(){
                self.debug('css loaded');
                cssComplete = true;
                doComplete();
            });
            $("body").one('player_embedder_scripts_loaded', function(){
                self.debug('js loaded');
                scriptsComplete = true;
                doComplete();
            });
            loadCss();
            loadJs();
            return dfd.promise();
        },
        loadShakaSources: function(){
            var dfd = $.Deferred(),
                startTime = new Date();
            function isShakaLoaded(){
                var loadedSources = $("body").data('player_embedder_sources_loaded');
                if ($("body").data('shakaSourcesLoaded')){
                    return true;
                }
                if (typeof(loadedSources) == 'undefined'){
                    return false;
                }
                if (!loadedSources.shaka){
                    return false;
                }
                if (typeof(window.shaka) == 'undefined'){
                    return false;
                }
                return true;
            }
            function initShaka(){
                console.log('initShaka');
                shaka.polyfill.installAll();
                $("body").data('shakaSourcesLoaded', true);
                dfd.resolve();
            }
            function waitForShaka(){
                var now = new Date();
                if (now - startTime > 10000){
                    dfd.reject();
                } else if (isShakaLoaded()){
                    initShaka();
                } else {
                    console.log('waiting for shaka');
                    window.setTimeout(waitForShaka, 100);
                }
            }
            if (isShakaLoaded()){
                dfd.resolve();
                return dfd.promise();
            }
            playerEmbedder.loadSources('shaka').done(function(){
                waitForShaka();
            });
            return dfd.promise();
        },
        streamSrc: function(base_url){
            var defaults = {
                  hls_url: 'playlist.m3u8',
                  hds_url: 'manifest.f4m',
                  mpd_url: 'manifest.mpd',
              },
              d = {base_url: base_url};
            $.each(defaults, function(key, val){
                if (base_url.endsWith(val.split('.')[1])){
                    val = base_url;
                } else {
                    val = [base_url, val].join('/');
                }
                d[key] = val;
            });
            return d;
        },
        embedDataDefaults: {
            streamSrc: '',
            playerId: 'player',
            playerClasses: [],
            embed_method: 'auto',
            size: null,
            sizeWithContainer: false,
            sizeByCSS: false,
            maxWidth: 640,
            aspect_ratio: [16, 9],
            container: null,
            swfUrl: '_ROOTURL_STROBE_/StrobeMediaPlayback.swf',
            expressInstallSwfUrl: '_ROOTURL_STROBE_/expressInstall.swf',
        },
        embedData: function(data){
            var d = {};
            $.each(playerEmbedder.embedDataDefaults, function(key, val){
                if (typeof(data[key]) != 'undefined'){
                    val = data[key];
                }
                if (key == 'streamSrc'){
                    val = playerEmbedder.streamSrc(val);
                } else if (key == 'swfUrl' || key == 'expressInstallSwfUrl'){
                    val = playerEmbedder.formatLibUrl(val);
                }
                d[key] = val;
            });
            return d;
        },
        addPlayerClasses: function(player, data){
            if (data.playerClasses.length == 0){
                return;
            }
            player.addClass(data.playerClasses.join(' '));
        },
        buildFallbackContent: function(data){
            var cdiv = $('<ul style="margin-top:25%;text-align:center;font-size:1.5em;"></ul>'),
                ua = navigator.userAgent,
                isDesktop = false;
            this.debug('building fallback content');
            try {
                if (typeof(window.orientation) == 'undefined'){
                    isDesktop = true;
                }
            } catch(e) {
                this.debug('window.orientation check failed: ');
                this.debug(e);
            }
            if (isDesktop){
                cdiv.append('<li><p>Flash Player plugin either not installed or out of date.</p></li>');
                cdiv.append('<li><a href="//www.adobe.com/software/flash/about/‎" taget="_blank">Click Here to update or install Flash</a></li>');
            } else {
                cdiv.append('<li><a href="URL" type="application/vnd.apple.mpegurl">Click here to open in your mobile device</a></li>'.replace('URL', data.streamSrc.hls_url));
            }
            if (ua.toLowerCase().search('android') != -1){
                data.isAndroid = true;
            //    cdiv.append('<li><a href="URL">Click here to open in the video player app on you mobile device</a></li>'.replace('URL', data.streamSrc.hls_url));
            }
            if (data.fallbackContentFunction){
                cdiv = data.fallbackContentFunction(cdiv);
            } else {
                data.container.one('player_embed_complete', function(){
                    $("a", cdiv).each(function(){
                        var $this = $(this),
                            s = $this.attr('href'),
                            firstUnicodeChar;
                        for (i=1; i<s.length; i++){
                            if (s.charCodeAt(i) > 255){
                                firstUnicodeChar = i;
                                break;
                            }
                        }
                        if (firstUnicodeChar){
                            s = s.slice(0, firstUnicodeChar);
                            $this.attr('href', s);
                        }
                    });
                });
            }
            this.debug('fallback content built');
            return cdiv;
        },
        testHLSSupport: function(data){
            this.debug('testing HLS capabilities');
            var result = false,
                vidtag = $('<video autoplay></video>');
            try {
                data.container.append(vidtag);
                if (vidtag[0].canPlayType('application/vnd.apple.mpegurl') != ''){
                    result = true;
                    this.debug('HLS supported');
                } else {
                    this.debug('HTML5 supported, but no HLS');
                    vidtag.remove();
                }
            } catch(e) {
                this.debug('HTML5 error:', e);
                result = false;
            }
            return result;
        },
        testMPDSupport: function(data){
            this.debug('testing MPEG-DASH support');
            var result,
                dfd = $.Deferred();
            function doTest(){
                var self = playerEmbedder,
                    isSupported = false;
                if (shaka.player.Player.isBrowserSupported()){
                    self.debug('Browser possibly supports MPEG-DASH...');
                    try {
                        if (shaka.player.Player.isTypeSupported('video/mp4; codecs="avc1.42E01E"')){
                            isSupported = true;
                        }
                    } catch(e) {
                        self.debug('The browser lied');
                    }
                }
                if (isSupported){
                    self.debug('Browser support for MPEG-DASH confirmed');
                } else {
                    self.debug('Browser does not support MPEG-DASH');
                }
                return isSupported;
            }
            this.loadShakaSources().done(function(){
                result = doTest();
                if (result){
                    dfd.resolve();
                } else {
                    dfd.reject();
                }
            });
            return dfd.promise();
        },
        doEmbed: function(data){
            var self = this,
                embed_fn;
            if (typeof(data) == 'string'){
                data = {'streamSrc':data};
            }
    /*
            if (typeof(data.container.jquery) == 'undefined'){
                data.container = $(data.container);
                if (data.container.length == 0){
                    data.container = $("#" + data.container);
                }
            }
    */
            if (typeof(data.container) == 'undefined' || data.container == null){
                data.container = $("body");
            }
            data = self.embedData(data);
            if (!data.size){
                self.calcPlayerSize(data);
                self.debug('calculated player size: ', data.size);
            }
            data.container.data('embedData', data);
            self.debug('embedding now. data: ', data);
            embed_fn = self['doEmbed_' + data.embed_method];
            return embed_fn(data);
        },
        doEmbed_auto: function(data){
            var self = playerEmbedder,
                hlsSupported = self.testHLSSupport(data),
                embed_fn,
                dfd = $.Deferred();
            if (hlsSupported){
                data.embed_method = 'html5'
                self.doEmbed_html5(data).done(function(data){
                    dfd.resolve(data);
                });
            } else {
                self.testMPDSupport(data).done(function(){
                    data.embed_method = 'shaka';
                    self.doEmbed_shaka(data).done(function(data){
                        dfd.resolve(data);
                    }).fail(function(){
                        data.embed_method = 'strobe';
                        self.doEmbed_strobe(data).done(function(data){
                            dfd.resolve(data);
                        });
                    });
                }).fail(function(){
                    data.embed_method = 'strobe';
                    self.doEmbed_strobe(data).done(function(data){
                        dfd.resolve(data);
                    });
                });
            }
            return dfd.promise();
        },
        buildVidTag: function(data){
            var self = playerEmbedder,
                vidtag = $("video", data.container),
                overlay = $(".player_embedder-overlay", data.container);
            if (vidtag.length == 0){
                vidtag = $('<video autoplay></video>');
                data.container.append(vidtag);
            }
            if (overlay.length == 0){
                overlay = $('<div class="player_embedder-overlay"></div>');
                data.container.append(overlay);
            }
            data.overlay = overlay;
            vidtag.addClass('player_embedder-video');
            vidtag.attr('id', data.playerId);
            if (data.sizeWithContainer == true){
                data.size = ['100%', '100%'];
                data.sizeByCSS = true;
            }
            vidtag.attr('width', data.size[0]);
            vidtag.attr('height', data.size[1]);
            self.addPlayerClasses(vidtag, data);
            vidtag[0].controls = true;
            return vidtag;
        },
        showOverlayMessage: function(data, message){
            var vidtag = $("video", data.container),
                overlay = data.overlay,
                $content;
            if (message.jquery){
                $content = message;
            } else {
                $content = $('<p>' + message + '</p>');
            }
            $content.addClass('player_embedder-overlay-content');
            overlay
                .empty()
                .append($content)
                .innerWidth(data.container.innerWidth())
                .innerHeight(data.container.innerHeight())
                .css(vidtag.position())
                .show()
                .click(function(){
                    $content.parent().hide();
                });
        },
        hideOverlay: function(){
            $(".player_embedder-overlay").hide();
        },
        doEmbed_html5: function(data){
            var self = playerEmbedder,
                vidtag = self.buildVidTag(data),
                dfd = $.Deferred();
            vidtag.append('<source src="URL" type="application/vnd.apple.mpegurl">'.replace('URL', data.streamSrc.hls_url));
            data.player = vidtag;
            fbdiv = self.buildFallbackContent(data);
            if (data.isAndroid){
                data.container.parent().append(fbdiv);
            }
            data.container.trigger('player_embed_complete');
            dfd.resolve(data);
            return dfd.promise();
        },
        doEmbed_shaka: function(data){
            var dfd = $.Deferred();
            function doEmbed(data){
                var self = playerEmbedder,
                    vidtag = self.buildVidTag(data),
                    player,
                    estimator,
                    source;
                vidtag.attr('crossorigin', 'anonymous');
                player = new shaka.player.Player(vidtag.get(0));
                estimator = new shaka.util.EWMABandwidthEstimator();
                source = new shaka.player.DashVideoSource(data.streamSrc.mpd_url, null, estimator);
                player.addEventListener('error', function(e){
                    var error = e.detail;
                    self.debug('Shaka Error', {type:error.type, message:error.message});
                    data.container.trigger('player_error', [player, e]);
                    if (e.detail.status == 404){
                        var msg = 'There was an error playing the requested content.  Please check your connection or refresh the page';
                        self.showOverlayMessage(data, msg);
                        data.overlay.click(function(e){
                            e.preventDefault();
                            self.hideOverlay();
                        });
                    }
                });
                player.load(source).then(function(){
                    data.player = player;
                    data.container.trigger('player_embed_complete');
                    self.debug('Shaka player load complete');
                    dfd.resolve(data);
                }).catch(function(){
                    self.debug('Shaka player load error');
                    dfd.reject();
                });
            }
            playerEmbedder.loadShakaSources().done(function(){
                doEmbed(data);
            });
            return dfd.promise();
        },
        doEmbed_strobe: function(data){
            var self = playerEmbedder,
                dfd = $.Deferred(),
                embedDataKeys = ['swf', 'id', 'width', 'height', 'minimumFlashPlayerVersion', 'expressInstallSwfUrl'],
                embedData = [],
                flashVars = {
                    'width': data.size[0],
                    'height': data.size[1],
                    'src': data.streamSrc.hds_url,
                    'autoPlay': true,
                    'loop': false,
                    'controlBarMode': 'docked',
                    'poster': '',
                    'swf': data.swfUrl,
                    'expressInstallSwfUrl':data.expressInstallSwfUrl,
                    'minimumFlashPlayerVersion': '9',
                    'javascriptCallbackFunction': 'playerEmbedder.strobeCallback',
                },
                params = {
                    'allowFullScreen': 'true',
                    'wmode':'direct',
                },
                attrs = {
                    'id': data.playerId,
                    'name': data.playerId,
                },
                embedCallback = function(event){
                    if (event.success){
                        data.player = $("#" + event.id);
                    }
                    data.container.trigger('player_embed_complete');
                },
                embedStatic = function(playerWrapper){
                    self.debug('embedding using static method (PS3)');
                    var player = $('<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"></object>'),
                        innerObj = $('<object type="application/x-shockwave-flash"></object>');
                    player.attr({'id': data.playerId, 'width': data.size[0], 'height': data.size[1]});
                    params.movie = flashVars.swf;
                    params.flashvars = flashVars;
                    function buildParams($objElem){
                        $.each(params, function(key, val){
                            if (key == 'flashvars'){
                                val = $.param(val);
                            } else {
                                val = val.toString();
                            }
                            $objElem.append('<param name="KEY" value="VAL" />'.replace('KEY', key).replace('VAL', val));
                        });
                    };
                    buildParams(player);
                    innerObj.attr({'data':flashVars.swf, 'width':data.size[0], 'height':data.size[1]});
                    player.append(innerObj);
                    buildParams(innerObj);
                    innerObj.append(self.buildFallbackContent(data));
                    playerWrapper.append(player);
                    data.container.append(playerWrapper);
                    self.debug('static content built... registering with swfobject');
                    try {
                        swfobject.registerObject(data.playerId, flashVars.minimumFlashPlayerVersion);
                    } catch(e) {
                        self.debug('swfobject error: ', e);
                    }
                },
                embedDynamic = function(playerWrapper){
                    self.debug('embedding using dynamic method');
                    var player = $('<div></div>');
                    player.attr('id', data.playerId);
                    player.append(self.buildFallbackContent(data));
                    playerWrapper.append(player);
                    data.container.append(playerWrapper);
                    try {
                        swfobject.embedSWF.apply(swfobject.embedSWF, embedData);
                    } catch(e) {
                        self.debug('swfobject error: ', e);
                    }
                };
            $.each(embedDataKeys, function(i, key){
                var val = flashVars[key];
                if (typeof(val) == 'undefined'){
                    val = attrs[key];
                }
                embedData.push(val);
            });
            embedData.push(flashVars, params, attrs, embedCallback);
            $("body").one('player_embedder_sources_loaded', function(){
                self.debug('beginning swfobject embed');
                var playerWrapper = $('<div id="ID-wrapper"></div>'.replace('ID', data.playerId)),
                    flashVer,
                    flashVerStr = [];
                self.debug('testing Flash version...');
                try {
                    flashVer = swfobject.getFlashPlayerVersion();
                } catch(e) {
                    self.debug('Flash detection error: ', e);
                    flashVer = null;
                }
                if (flashVer){
                    $.each(['major', 'minor', 'release'], function(i, n){
                        flashVerStr.push(flashVer[n].toString());
                    });
                    flashVerStr = flashVerStr.join('.');
                    self.debug('Flash version: ', flashVerStr);
                }
                self.addPlayerClasses(playerWrapper, data);
                if (navigator.userAgent.search('PLAYSTATION') != -1){
                    embedStatic(playerWrapper);
                } else {
                    embedDynamic(playerWrapper);
                }
                dfd.resolve(data);
            });
            self.debug('loading strobe sources');
            self.loadSources('strobe');
            return dfd.promise();
        },
        doResize: function(container, newSize){
            var self = this,
                data = container.data('embedData'),
                resizeFn = playerEmbedder['doResize_' + data.embed_method];
            if (data.sizeByCSS == true){
                return;
            }
            if (!data.player){
                return;
            }
            if (!newSize){
                hasChanged = self.calcPlayerSize(data);
                if (!hasChanged){
                    return;
                }
            } else {
                if (data.size[0] == newSize[0] && data.size[1] == newSize[1]){
                    return;
                }
                data.size = newSize;
            }
            resizeFn(container, data);
        },
        doResize_html5: function(data){
            data.player.width(data.size[0]);
            data.player.height(data.size[1]);
        },
        doResize_shaka: function(data){
            var player = $("#" + data.playerId);
            player.width(data.size[0]);
            player.height(data.size[1]);
        },
        doResize_strobe: function(data){
            // need to look at api docs
        },
        calcPlayerSize: function(data){
            if (data.sizeByCSS == true){
                return false;
            }
            function getMaxWidth(){
                var width = data.container.innerWidth();
                if (width > data.maxWidth){
                    width = data.maxWidth;
                }
                return width;
            }
            var complete,
                hasChanged = false,
                x = getMaxWidth(),
                xMin = x * 0.5,
                y,
                ratio = data.aspect_ratio[0] / data.aspect_ratio[1];
            if (data.sizeWithContainer == true){
                x = data.container.innerWidth();
                y = data.container.innerHeight();
                if (data.size){
                    if (data.size[0] == x || data.size[1] == y){
                        return false;
                    }
                    data.size[0] = x;
                    data.size[1] = y;
                    return true;
                } else {
                    data.size = [x, y];
                    return true;
                }
            }
            if (data.size){
                // size hasn't changed so don't waste time
                if (x == data.size[0]){
                    return false;
                }
            }
            function integersFound(_x, _y){
                if (Math.floor(_x) != _x){
                    return false;
                }
                if (Math.floor(_y) != _y){
                    return false;
                }
            }
            y = x / ratio;
            complete = integersFound(x, y);
            while (!complete){
                x -= 1;
                y = x / ratio;
                complete = integersFound(x, y);
                if (!complete && x <=xMin){
                    x = getMaxWidth();
                    y = x / ratio;
                    y = Math.floor(y);
                    break;
                }
            }
            if (!data.size){
                data.size = [x, y];
                hasChanged = true;
            } else {
                if (data.size[0] != x){
                    data.size[0] = x;
                    hasChanged = true;
                }
                if (data.size[1] != y){
                    data.size[1] = y;
                    hasChanged = true;
                }
            }
            return hasChanged;
        },
    };

    playerEmbedder.strobeCallback = function(id, eventName, updatedProperties){
        playerEmbedder.debug('strobe callback: ', id, eventName, updatedProperties);
    };
    window.playerEmbedder = playerEmbedder;
    $(document).trigger('playerEmbedderReady');
})(jQuery);
