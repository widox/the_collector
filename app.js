var express = require('express'),
    cred = require('./config'),
    Rdio = require('./lib/rdio'),
    app = express()
;

app.use(express.cookieParser());
app.use(express.session({secret: 'the_collector', key: 'the_collector'}));
app.set('view engine', 'jade');


// catch-all route, will be called for every route
app.all('*', function(req, res, next) {
    if (typeof req.session.token === "undefined" || !req.session.token) {
        // haven't auth'd to rdio yet, do it
        do_auth(req, res);
    } else {
        next();
    }
});

app.get('/', function (req, res) {
    var rdio = getRdio(req);

    if (rdio) {
        rdio.call('currentUser', {'extras': ['username']}, function (err, data) {
            if (err) {
                return;
            }

            var currentUser = data.result;
            req.session.curUser = currentUser;

            console.log(currentUser);
            res.render('index', {curUser:currentUser});

        });
    } else {
        res.render('error');
    }

});

app.get('/login', function (req, res, next) {
    console.log('IN LOGIN');
    do_auth(req, res);
});

app.get('/logout', function (req, res) {
    delete req.session.curUser;
    req.session.destroy(function(){
        res.redirect('/');
    });
});

app.get('/collection', function (req, res) {
    var rdio = getRdio(req);

    if (rdio) {
        var params = {
            'user': req.session.curUser.key,
            'sort': 'artist'
        };

        rdio.call('getAlbumsInCollection', params, function (err, data) {
            if (err) {
                return;
            }

            var albums = data.result;

            res.render(
                'collection/index',
                {session:req.session, albums:albums}
            );
        });
    } else {
        res.render('error');
    }
});

app.get('/callback', function (req, res) {
    console.log("IN CALLBACK");

    var verifier = req.query.oauth_verifier;
    var rdio = getRdio(req);

    console.log('/CALLBACK verifier: ' + verifier);

    if (rdio && verifier) {
        rdio.completeAuthentication(verifier, function (err) {
            if (err) {
                console.log('/callback ERROR');
                return;
            }

            // Save the access token/secret in the session (and discard the
            // request token/secret).
            req.session.token = rdio.token[0];
            req.session.tokenSecret = rdio.token[1];
            delete req.session.requestToken;
            delete req.session.requestTokenSecret;

            // Go to the home page.
            res.redirect('/');
        });
    } else {
        console.log('/callback:: else: MISSING SOMETHING LOGOUT');
        res.redirect("/logout");
    }
});


app.listen(3000);
console.log('Listening on port 3000');


function do_auth(req, res) {
    console.log('SETUP RDIO');
    var rdio = new Rdio([cred.RDIO_CONSUMER_KEY, cred.RDIO_CONSUMER_SECRET]);
    var callbackUrl = /*req.baseUrl +*/ "http://localhost:3000/callback";

        rdio.beginAuthentication(callbackUrl, function (err, authUrl) {
        console.log('BEGIN AUTH');
        if (err) {
            console.log('ERROR');
            return;
        }

        // Save the request token/secret in the session.
        req.session.token = 'dummy';
        req.session.requestToken = rdio.token[0];
        req.session.requestTokenSecret = rdio.token[1];

        console.log(req.session);

        // Go to Rdio to authenticate the app.
        res.redirect(authUrl);
    });
}

function getRdio(req) {
    var accessToken = req.session.token;
    var accessTokenSecret = req.session.tokenSecret;

    // if we've already done the oauth dance
    if (accessToken && accessTokenSecret) {
        return new Rdio(
            [cred.RDIO_CONSUMER_KEY, cred.RDIO_CONSUMER_SECRET],
            [accessToken, accessTokenSecret]
        );
    }

    // otherwise, finishing the auth from the callback
    var requestToken = req.session.requestToken;
    var requestTokenSecret = req.session.requestTokenSecret;

    if (requestToken && requestTokenSecret) {
        // Exchange the verifier and token for an access token.
        return new Rdio(
            [cred.RDIO_CONSUMER_KEY, cred.RDIO_CONSUMER_SECRET],
            [requestToken, requestTokenSecret]
        );
    }

    return false;
}

