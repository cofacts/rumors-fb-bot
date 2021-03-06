# rumors-fb-bot
A Facebook Messenger bot that checks if a message contains internet rumor.

[![Build Status](https://travis-ci.org/cofacts/rumors-fb-bot.svg?branch=dev)](https://travis-ci.org/cofacts/rumors-fb-bot) 

## State diagram & Documents

This is a one of the sub-project of [Cofacts 真的假的](http://beta.hackfoldr.org/rumors).

This state diagram describes how the FB bot interacts with users:

![The state diagram](https://docs.google.com/drawings/d/e/2PACX-1vTvAKt7dKGE7bUtEGmGre3gBJ3uXgv52g4e9GCWf4iDX79esNS6KeXg8Sglr-_SW_sd-T3tb5KWFSlf/pub?w=941&h=591)


## Development

All hard-coded reply texts in source code are in Chinese and have translation in comments.

Please finish the following settings before starting development.

### Facebook App and Facebook page

Please follow all the steps in [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform/getting-started).

Note that we need permission `manage_pages`, `publish_pages`, `Page Public Content Access`, and `pages_messaging` for your app. Tests passed on 2019.11.1 using Graph API _v3.3_ and Send API _v2.6_.

**Important**: Please refer to [this page](https://github.com/cofacts/rumors-fb-bot/blob/dev/FacebookToken.md) for Facebook access tokens.

### Environment variables

First, install heroku toolbelt.

Create .env file from .env.sample template, at least fill in:
```
API_URL=https://cofacts-api.g0v.tw/graphql (or your api server)
APP_ID=<your Facebook app ID>
PAGE_ACCESS_TOKEN=<paste your Facebook page access token from Graph API Explorer here>
VERIFY_TOKEN=<paste your token for webhook verification here>
APP_SECRET=<paste your Facebook app secret here>
```

Other customizable env vars are:

* `LOCALE`: Your locale for building with i18n. `en_US` is used if not given.
* `REDIS_URL`: If not given, `redis://127.0.0.1:6379` is used.
* `PORT`: Which port the bot server will listen at.
* `GOOGLE_DRIVE_IMAGE_FOLDER`: Google drive folder id is needed when you want to test uploading image.
* `GOOGLE_CREDENTIALS`: will be populated by `authGoogleDrive.js`. See "Upload image/video" section below.
* `GA_ID`: Google analytics universal analytics tracking ID, for tracking events

### Redis server

We use Redis to store conversation context / intents. Please run a Redis server on your machine, or use the Heroku Redis's `REDIS_URL` directly if you happen to deploy the bot to Heroku.

### Node Dependencies

You will need `Node.JS` 8+  to proceed.

```
$ npm i
```

### Get the bot server running on your local machine

With Heroku toolbelt installed, just do this:

```
$ heroku local
```

and the server will be started on `localhost:5000`. (Or the `PORT` you specified in your `.env` file.)

### Get Facebook webhook events from your local machine

We recommend [using `localtunnel`](https://github.com/localtunnel/localtunnel) to create a public address that directs the traffic from Facebook server to your local machine. With `localtunnel` installed globally in your path, just execute

```
$ lt -s <custom subdomain> -p <port>
```

`localtunnel` will give you a public URL. Use this to set the webhook URL of your Page (See the tutorial in [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform/webhook)).

### Upload image/video

First, follow the step1 in this [url](https://developers.google.com/drive/v3/web/quickstart/nodejs) to get `client_secret.json` and save it to project root.

Second, run:

```
$ node authGoogleDrive.js
```

Visit the given url provided above. Get the auth code and paste it to console.
Then the program will save your google drive access token locally at `GOOGLE_CREDENTIALS` in `.env`.

Make sure you've also set `GOOGLE_DRIVE_IMAGE_FOLDER` = [folderID](https://googleappsscriptdeveloper.wordpress.com/2017/03/04/how-to-find-your-google-drive-folder-id/) in .env file.

ref:

[OAuth2 Protocols](https://developers.google.com/identity/protocols/OAuth2)

[Googleapi Nodejs Client](https://github.com/google/google-api-nodejs-client)   P.S. This page provide the newest api usage then [this](https://developers.google.com/drive/v3/web/quickstart/nodejs).


---

## Production Deployment

If you would like to start your own Facebook bot server in production environment, this section describes how you can deploy the bot to your own Heroku account.

### Get the server running

You can deploy the Facebook bot server to your own Heroku account by [creating a Heroku app and push to it](https://devcenter.heroku.com/articles/git#creating-a-heroku-remote).

Despite the fact that we don't use `Procfile`, Heroku still does detection and installs the correct environment for us.

### Provision add-on "Heroku Redis"

[Provision a Heroku Redis addon](https://elements.heroku.com/addons/heroku-redis) to get redis. It sets the env var `REDIS_URL` for you.

### Configurations

You have to set the following config vars manually:

```
$ heroku config:set API_URL=https://cofacts-api.g0v.tw/graphql (or your api server)
$ heroku config:set SITE_URL=https://cofacts.g0v.tw
$ heroku config:set PAGE_ACCESS_TOKEN=<Your page access token from Graph API Explorer>
$ heroku config:set APP_ID=<Your Facebook app id>
$ heroku config:set VERIFY_TOKEN=<Your webhook verification token>
$ heroku config:set APP_SECRET=<Your Facebook app secret>
$ heroku config:set GOOGLE_CREDENTIALS=<Your google credential (optional)>
```

**Note**: To deploy a build with i18n, `LOCALE` needs to be set _BEFORE_ the next deployment.

## Google Analytics Events table

Sent event format: `Event category` / `Event action` / `Event label`

1. User sends a message to us
  - `UserInput` / `MessageType` / `<text | image | video | ...>`
  - For the time being, we only process message with "text" type. The following events only applies
    for text messages.

  - If we found a articles in database that matches the message:
    - `UserInput` / `ArticleSearch` / `ArticleFound`
    - `Article` / `Search` / `<article id>` for each article found
  - If the message does not look like those being forwarded in instant messengers:
    - `UserInput` / `ArticleSearch` / `NonsenseText`
  - If nothing found in database:
    - `UserInput` / `ArticleSearch` / `ArticleNotFound`

2. User chooses a found article
  - `Article` / `Selected` / `<selected article id>`
  - If there are replies:
    - `Reply` / `Search` / `<reply id>` for each replies
  - If there are no replies:
    - `Article` / `NoReply` / `<selected article id>`

3. User chooses a reply
  - `Reply` / `Selected` / `<selected reply id>`
  - `Reply` / `Type` / `<selected reply's type>`

4. User votes a reply
  - `UserInput` / `Feedback-Vote` / `<articleId>/<replyId>`

5. User want to submit a new article
  - `Article` / `Create` / `Yes`

6. User does not want to submit an article
  - `Article` / `Create` / `No`

## License

The project is available as open source under the terms of the [MIT License](https://github.com/cofacts/rumors-fb-bot/blob/dev/LICENSE).