import fetch from 'node-fetch';
import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;
let drive = null;

initGDrive();

function initGDrive() {
  if (!process.env.GOOGLE_DRIVE_IMAGE_FOLDER) {
    console.log('Google drive forder id not set, skip Gdrive initialization.');
    return;
  }

  if (!process.env.GOOGLE_CREDENTIALS) {
    console.log('Google credentials not set, skip Gdrive initialization.');
    return;
  }

  const { token, secrets } = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  // Authorize a client with the loaded credentials, then call the
  // Drive API.
  const clientSecret = secrets.installed.client_secret;
  const clientId = secrets.installed.client_id;
  const redirectUrl = secrets.installed.redirect_uris[0];
  const oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  oauth2Client.setCredentials(token);
  drive = google.drive({ version: 'v3', auth: oauth2Client });
}

export async function uploadImageFile(messageId, idx, fileUrl) {
  const fileMetadata = {
    name: `${messageId}__${idx}.jpg`,
    mimeType: 'image/jpeg',
    url: fileUrl,
    parents: [process.env.GOOGLE_DRIVE_IMAGE_FOLDER],
  };

  uploadFile(messageId, fileMetadata);
}

export async function uploadVideoFile(messageId, idx, fileUrl) {
  const fileMetadata = {
    name: `${messageId}__${idx}.mp4`,
    mimeType: 'video/mp4',
    url: fileUrl,
    parents: [process.env.GOOGLE_DRIVE_IMAGE_FOLDER],
  };

  uploadFile(messageId, fileMetadata);
}

async function uploadFile(messageId, fileMetadata) {
  if (!drive) {
    console.log('Gdrive is not initial, skip uploading data.');
    return;
  }

  //get attachment file
  const options = {
    method: 'GET',
  };
  const res = await fetch(fileMetadata.url, options);

  const media = {
    mimeType: 'image/jpeg',
    body: res.body,
  };
  //upload to google drive
  drive.files.create(
    {
      resource: fileMetadata,
      media: media,
      fields: 'id',
    },
    function(err, file) {
      if (err) {
        // Handle error
        console.error('Error: ', err);
      } else {
        console.log('Uploaded File Id: ', file.data.id);
      }
    }
  );
}
