"use strict";

// (C) Jani Haiko, 2020 - 2021

const productionMode = process.env.NODE_ENV === "production";
const serverStartTime = new Date().getTime();

const fs = require("fs");
const tls = require("tls");
const restify = require("restify");
const fetch = require("node-fetch");
const helmet = require("helmet");

const Stream = require("stream");
const streamPipeline = require("util").promisify(Stream.pipeline);

const serverSettings = {
	name: "Jani Haiko's server",
	noWriteContinue: true
};
if (productionMode) {
	const certs = {
		"kissakala.sytes.net": {
			cert: fs.readFileSync(process.env.CERTIFICATE),
			key: fs.readFileSync(process.env.CERTIFICATE_KEY)
		},
		"dyn.kissakala.fi": {
			cert: fs.readFileSync(process.env.CERTIFICATE_DYN),
			key: fs.readFileSync(process.env.CERTIFICATE_KEY_DYN)
		}
	};

	const secureContext = {
		"kissakala.sytes.net": tls.createSecureContext({
			cert: certs["kissakala.sytes.net"].cert,
			key: certs["kissakala.sytes.net"].key,
		}),
		"dyn.kissakala.fi": tls.createSecureContext({
			cert: certs["dyn.kissakala.fi"].cert,
			key: certs["dyn.kissakala.fi"].key,
		})
	};

	Object.assign(serverSettings, {
		http2: {
			cert: certs["kissakala.sytes.net"].cert,
			key: certs["kissakala.sytes.net"].key,
			allowHTTP1: true,
			SNICallback: (hostname, cb) => {
				cb(null, secureContext[hostname]);
			}
		}
	});
}
const app = restify.createServer(serverSettings);

const iconBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAABuwAAAbsBOuzj4gAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANASURBVHic7dq/i1RXFAfwz1tlcSUoWcFCTRPYTSMJLIiWFlH8UQQrhXQpLCZFqtSptglYpQqkMSH5A4Ib2G4bS0GwEkUQMY0xIlHYdcVrMXdhvL6dvDfzZu7Ie184DDO8c873ft+759177hQhBG3GXG4CudEJkJtAbnQC5CaQG50AuQnkRidAbgK50QmQm0BudALkJpAbrRdg7zSSFEWxhM9wdMCOxE94jL/j547dDSHcmzi3SfQDiqLYh9O4iAv4dMRQD/AX1rARQthshOAgQgiNGPbgMm7gJULD9jLGvow9jfFuYOD78W28W3UH9TRaXb8HMef+bALgEH7Ak4qkt7GOHpaxMBBrIf7Wi9dsV4z5JHI4NDUB9N8cPTyrccfuYKVGjpXoUzX+s8hpbqIC4BRu1SD2GquYH0Ho+ej7uka+WzjVuAA4iF/wpuY8PTEk5iLO4Ct8gX27XHdCvfryJnI92IgAOI57NQjs3Pn3Bo9PcB33S3ye42d8tIsIdZ6EEDkfH0sAXMGLmokDVktifRMHOczvxyFcVkfg8QJXagugv0K8NkLCoF+85pN4f1Tw+1NcmA2pCXUK46Bdw95KAuAwNkZMtC2p9vHOV/G9VGE6rqj+ikxtA4eHCoCTeDRigoD1kjn/f4990C9cixUL8voY/B7hZKkAOI/NMYIH9BKy1yv6PTfk8U9i9sbkuInz7wigv2kZd/ABywnZsmq/m31eUYDlBnhu4mKM5xy2GggavLu8Xazp+11FARYa4roVx+52QwGfJkTP1PT/F0sVRRhlA1Vmt2epI/QxbhRFcWzaiWdlCuzYK/yOs/rNlK9xYGJTYIaK4G720MAbQsNFcA5CCGu4FFUZB18m32+OGQ9+CzvlujxHXWzpL7rWYFYWQsOmw1ISczILoRlYCpfZ1akuhQcS5dgMpfZTEmM6m6Ek6bS3wwH/4XtJ59c0t8NJ4mk1RP7BrzhS4penITJAYJItsXNlg04Gn68llpBpZ1M0IdbetnhCsp0HIyVCtPNorESID/JwtPXH4xMR4L0kbfuDxIeEWeoIZUEnQG4CudEJkJtAbnQC5CaQG50AuQnkRidAbgK50QmQm0ButF6At8nwsS0JQYGEAAAAAElFTkSuQmCC";

let cooldown = false;
let currentCount;

app.use(restify.plugins.throttle({
	burst: 2,
	rate: 1,
	ip: true,
	username: false,
	xff: false
}));

app.use(restify.plugins.gzipResponse());

// Helmet
app.use(helmet({
	contentSecurityPolicy: {
		useDefaults: true
	},
	crossOriginEmbedderPolicy: true,
	crossOriginOpenerPolicy: true,
	crossOriginResourcePolicy: {
		policy: "cross-origin"
	},
	expectCt: {
		maxAge: Number.MAX_SAFE_INTEGER,
		enforce: true
	},
	referrerPolicy: true,
	hsts: {
		maxAge: Number.MAX_SAFE_INTEGER,
		includeSubDomains: true,
		preload: true
	},
	noSniff: true,
	originAgentCluster: true,
	dnsPrefetchControl: {
		allow: true
	},
	ieNoOpen: true,
	frameguard: {
		action: "deny"
	},
	permittedCrossDomainPolicies: true,
	xssFilter: true
}));

// CORS
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "https://github.com");

	next();
});

// ### Routes

app.opts("*", (req, res) => {
	res.header("Access-Control-Allow-Methods", "GET");
	res.status(201).send();
});

app.get("/", (req, res) => {
	res.send(200, "OK");
});

app.get("/latest.svg", async (req, res) => {
	try {
		if (!currentCount || !cooldown) {
			try {
				const data = await fs.promises.readFile("./counter.txt", "UTF-8");
				currentCount = Number(data);
				if (isNaN(currentCount)) {
					currentCount = 0;
				}
			}
			catch (error) {
				if (error.code !== "ENOENT") {
					console.error(error);
				}
				currentCount = 0;
			}
		}

		if (!cooldown) {
			currentCount++;
			cooldown = true;
			setTimeout(() => {
				cooldown = false;
			}, productionMode ? 300000 : 3000);

			fs.writeFile("./counter.txt", String(currentCount), (error) => {
				if (error) {
					console.error(error);
				}
			});

			try {
				const response = await fetch(`https://img.shields.io/static/v1?message=${currentCount}&style=plastic&label=Profile%20views&logo=${iconBase64}`);
				if (!response.ok) {
					console.error(`Status code ${response.status} (${response.statusText}) returned from Shields.io`);
				}
				else {
					await streamPipeline(response.body, fs.createWriteStream("./latest.svg"));
				}
			}
			catch (fetchError) {
				console.error(fetchError);
			}

			// FIXME: req.connection is deprecated
			fs.appendFile("ip_addresses.log", `${req.connection.remoteAddress}\n`, (error) => {
				if (error) {
					console.error(error);
				}
			});
		}

		// (Try to) manage GitHub cache
		res.setHeader("Cache-Control", "max-age=300,no-cache");
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", 0);
		res.setHeader("ETag", `"Haiko-HitCounter-${serverStartTime}-${currentCount}"`);

		const readStream = fs.createReadStream("./latest.svg");
		res.setHeader("Content-Type", "image/svg+xml");
		readStream.pipe(res);
	}
	catch (error) {
		console.error(error);
		res.send(500);
	}
});

// ### Starting the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
	console.info(`Server successfully started on port ${port}`);
	if (!productionMode) {
		console.warn("Running in development mode");
	}
});