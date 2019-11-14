require('dotenv').config();
module.exports = {
  "presets": [
    ["env", {
      "targets": {
        "node": "current"
      }
    }],
    "stage-3"
  ],
  "plugins": [
    [
      'ttag', {resolve: {translations: `i18n/${process.env.LOCALE}.po`}}
    ]
  ]
};
