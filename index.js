const { connect } = require("@oada/client");
const oadalist = require("@oada/list-lib");
const trees = require("@pork/trees");
const express = require("express");
const config = require("./config");
const debug = require("debug");

const trace = debug("snatchbot:trace");
const info = debug("snatchbot:info");
const warn = debug("snatchbot:warn");
const error = debug("snatchbot:error");

const ListWatch = oadalist.ListWatch; // not sure why I can't just import this directly

const domain = "proxy";
const token = "changeme";

(async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  const oada = await connect({ domain, token });

  // ensure the thing exists because we are in charge of this endpoint
  console.log("Checking if tree exists...");
  const exists = await oada
    .get({ path: `/bookmarks/trellisfw/asns` })
    .then((r) => r.status)
    .catch((e) => e.status);
  if (exists !== 200) {
    console.log(`/bookmarks/trellisfw/asns does not exist`);
  }

  // user states
  let session = new Map();

  trace("Setting up express");
  const app = express();
  app.use(express.urlencoded());
  app.use(express.json());

  app.all("/*", function (req, res, next) {
    console.log("Request received:", req.body);
    if (!req || !req.headers) {
      trace("no headers!");
      return res.end();
    }
    if (
      !req.body ||
      !req.body.user_id ||
      !req.body.bot_id ||
      !req.body.module_id
    ) {
      trace("Unrecognized format");
      return res.end();
    }
    next(); // pass control to the next handler
  });

  app.post("/snatchbot/processors", async (req, res) => {
    // delete old session info
    session.delete(req.body.user_id);

    // get info from Trellis
    const tradingPartnersOADA = await oada.get({
      path: `/bookmarks/trellisfw/trading-partners`,
      tree: trees.tree,
    });
    var haulers = [];
    var processors = [];
    for (const [key, item] of Object.entries(tradingPartnersOADA.data)) {
      if (item.partnertype == "hauler") {
        haulers.push(item);
      } else if (item.partnertype == "processor") {
        processors.push(item);
      }
    }
    const locationsOADA = await oada.get({
      path: `/bookmarks/trellisfw/locations`,
      tree: trees.tree,
    });
    var locations = [];
    for (const [key, item] of Object.entries(locationsOADA.data)) {
      if (item.premiseid) {
        locations.push(item);
      }
    }
    var asn = { status: "scheduled", farmer: { name: "My Farm" } };
    session.set(req.body.user_id, { haulers, processors, locations, asn });

    var str = "Where are you sending it to?::next::";
    processors.forEach(function (item, idx) {
      str += `${idx}) ${item.name}\n`;
    });

    const obj = {
      user_id: req.body.user_id,
      bot_id: req.body.bot_id,
      module_id: req.body.module_id,
      message: str,
    };
    res.json(obj);
  });

  app.post("/snatchbot/barns", (req, res) => {
    // check and get session
    if (!session.has(req.body.user_id)) {
      return res.end();
    }
    var state = session.get(req.body.user_id);

    const responseVal = parseInt(req.body.incoming_message);
    state.asn.processor = {
      name: state.processors[responseVal].name,
      farmerid: "", // TODO
      haulerid: "", // TODO
    };
    var str = `Cool. The processor is ${state.processors[responseVal].name}.::next::What barn are you pulling from?\n`;
    state.locations.forEach(function (item, idx) {
      str += `${idx}) ${item.name}\n`;
    });

    const obj = {
      user_id: req.body.user_id,
      bot_id: req.body.bot_id,
      module_id: req.body.module_id,
      message: str,
    };
    res.json(obj);
  });

  app.post("/snatchbot/haulers", (req, res) => {
    if (!session.has(req.body.user_id)) {
      return res.end();
    }
    var state = session.get(req.body.user_id);
    const responseVal = parseInt(req.body.incoming_message);
    state.asn.scheduled = {
      shipfromlocation: {
        name: state.locations[responseVal].name,
        premiseid: state.locations[responseVal].id,
        address: state.locations[responseVal].address,
      },
    };
    var str = `Got it. ::next::Which hauler do you want to use?\n`;
    state.haulers.forEach(function (item, idx) {
      str += `${idx}) ${item.name}\n`;
    });
    const obj = {
      user_id: req.body.user_id,
      bot_id: req.body.bot_id,
      module_id: req.body.module_id,
      message: str,
    };
    res.json(obj);
  });

  app.post("/snatchbot/heads", (req, res) => {
    if (!session.has(req.body.user_id)) {
      return res.end();
    }
    var state = session.get(req.body.user_id);
    var str = `Got it.::next::Estimated # of head?\n`;
    const obj = {
      user_id: req.body.user_id,
      bot_id: req.body.bot_id,
      module_id: req.body.module_id,
      message: str,
    };
    res.json(obj);
  });

  app.post("/snatchbot/confirm", (req, res) => {
    if (!session.has(req.body.user_id)) {
      return res.end();
    }
    var state = session.get(req.body.user_id);
    const responseVal = parseInt(req.body.incoming_message);
    var str = `Great, we're almost done.::next::This is what we have so far:\nSending to ${state.asn.processor.name},\nPulling from ${state.asn.scheduled.shipfromlocation.name},\nEst. number of heads is ${responseVal}.`;
    const obj = {
      user_id: req.body.user_id,
      bot_id: req.body.bot_id,
      module_id: req.body.module_id,
      message: str,
    };
    res.json(obj);
  });

  trace("Starting express....");
  app.listen(config.get("port"), () =>
    console.log(`snatchbot listening on port ${config.get("port")}`)
  );
})();
