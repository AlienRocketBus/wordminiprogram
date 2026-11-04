import * as H from './lib.mjs';
const b = await H.launchBrowser(); console.log('chromium', b.version()); await b.close();
