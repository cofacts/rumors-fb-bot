# Get Facebook Page Access Tokens

A Facebook Page Access Token is required to make use of Facebook Graph API, which this chatbot depends on entirely. Getting the tokens is a little bit troublesome, but we haven't come up with a better idea for this yet.

### Brief explanation on Page Access Tokens
Please refer to [this page](https://developers.facebook.com/docs/facebook-login/access-tokens/#pagetokens) for complete information. Here we want to put emphasis on the lifetime of a token.

A token can be short-lived or long-lived. A short-lived token expires in one or two hours, while a long-lived token can live up to 60 days. What we do here is to first get a short-lived token manually, and then get a long-lived token with our program automatically.

### Step 1
Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer). You should see something like the screenshot below. Select your Facebook app at box 1 and then your Facebook page at box 2. You'll see your token in the "Access Token" box. This is a _short-lived_ access token.

![screeshot](https://i.imgur.com/Cn0Uifh.png)

### Step 2
Paste the page access token into your `.env` file. The program will fetch a _long-lived_ token for you before the server starts.

When going into production, don't forget to set the short-lived page access token as a config variable!
