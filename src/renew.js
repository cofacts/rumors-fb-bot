import { getLongLivedPageAccessToken } from './fbClient';

getLongLivedPageAccessToken()
  .then(() => {
    console.log('Long-lived page access token fetched');
  })
  .catch(e => {
    console.error(e);
    process.exit();
  });
