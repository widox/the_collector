var express = require('express'),
    cred = require('./config'),
    Rdio = require('./lib/rdio'),
    app = express()
;

app.use(express.cookieParser());
app.use(express.session({secret: 'the_collector', key: 'the_collector'}));
app.set('view engine', 'jade');


app.all('*', function(req, res, next) {
    // console.log('MATCHING *');
    // console.log(req.route);
    // console.log('TOKEN ' + req.session.token);

    if (typeof req.session.token === "undefined" || !req.session.token) {
        do_auth(req, res);
    } else {
        next();
    }
});

app.get('/', function (req, res) {
    var accessToken = req.session.token;
    var accessTokenSecret = req.session.tokenSecret;
    var greet = 'hola!';

    if (accessToken && accessTokenSecret) {
        var rdio = new Rdio([cred.RDIO_CONSUMER_KEY, cred.RDIO_CONSUMER_SECRET],
                            [accessToken, accessTokenSecret]);

        rdio.call("currentUser", function (err, data) {
            if (err) {
                return;
            }

            var currentUser = data.result;
            console.log(currentUser);
            greet = 'hola ' +
                currentUser.firstName +
                ' ' +
                currentUser.lastName +
                '!'
            ;
            console.log(greet);
            res.render('index', {greeting:greet});

        });
    } else {
        res.render('index', {greeting:greet});
    }

});

app.get('/login', function (req, res, next) {
    console.log('IN LOGIN');
    do_auth(req, res);
});

app.get('/logout', function (req, res) {
});

app.get('/collection/:type', function (req, res) {
    res.render('collection/index', {type: req.params.type, session:req.session});
});

app.get('/callback', function (req, res) {
    console.log("IN CALLBACK");

    var requestToken = req.session.requestToken;
    var requestTokenSecret = req.session.requestTokenSecret;
    var verifier = req.query.oauth_verifier;

    console.log('/CALLBACK verifier: ' + verifier);

    if (requestToken && requestTokenSecret && verifier) {
        // Exchange the verifier and token for an access token.
        var rdio = new Rdio([cred.RDIO_CONSUMER_KEY, cred.RDIO_CONSUMER_SECRET],
                            [requestToken, requestTokenSecret]);

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

