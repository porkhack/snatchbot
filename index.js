const { connect } = require('@oada/client');
const oadalist  = require('@oada/list-lib');
const trees = require('@pork/trees');
const express = require('express');
const config = require('./config');
const debug = require('debug');

const trace = debug('snatchbot:trace');
const info = debug('snatchbot:info');
const warn = debug('snatchbot:warn');
const error = debug('snatchbot:error');

const ListWatch = oadalist.ListWatch; // not sure why I can't just import this directly

const domain = config.get('domain');
const token = config.get('token');

(async () => {

if (domain === 'localhost') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
  warn('WARNING: doman is localhost, automatically accepting self-signed ssl certs');
}

const oada = await connect({domain,token});

// ensure the thing exists because we are in charge of this endpoint
trace('Checking if tree exists...');
const exists = await oada.get({ path: `/bookmarks/trellisfw/asns`}).then(r=>r.status).catch(e => e.status);
if (exists !== 200) {
   info(`/bookmarks/trellisfw/asns does not exist, creating....`);
   await oada.put({path: '/bookmarks/trellisfw/asns', data: {}, tree: trees.asn});
}


const asnWritten = async (item, key) => {
  console.log('onItem called!  key = ', key, ', item = ', item);
}

trace('Setting up watch...');
const watch = new ListWatch({
  path: `/bookmarks/trellisfw/asns`,
  // Need tree and itemsPath for this to work
  tree: trees.asn,
  itemsPath: `$.day-index.*.*`,
  name: 'SNATCHBOT-PORKHACK',
  conn: oada,
  resume: true,

  //onAddItem: asnAdded,
  //onChangeItem: asnAdded,
  onItem: asnWritten,

  onNewList: ListWatch.AssumeHandled,
  // TODO: onDeleteList
});


trace('Setting up express');
const app = express();

app.get('/', async (req, res) => {
  console.log('The snatchbot endpoint was called!  req = ', req);

  /*
  if (!req || !req.headers) {
    trace('no headers!');
    return res.end();
  }
  if (req.headers.authorization !== 'Bearer '+incomingToken) {
    info('Request for check: Not the right token');
    return res.end();
  }*/


});


trace('Starting express....');
app.listen(config.get('port'), () => console.log(`snatchbot listening on port ${config.get('port')}`));

})();
