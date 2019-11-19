import { t } from 'ttag';
import ga from '../ga';
import { createPostbackAction } from './utils';

/**
 * The state that a user is about to submit a new article. We ask for confirmation.
 * The user can modify her submission if she wants.
 */
export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  const visitor = ga('FB-' + userId, data.searchedText);
  visitor.screenview({ screenName: state });

  if (event.input === 'n') {
    // Track whether user create Article or not if the Article is not found in DB.
    visitor.event({ ec: 'Article', ea: 'Create', el: 'No' });

    replies = [
      {
        type: 'text',
        content: {
          text: t`The message is discarded. Thank you.`,
        },
      },
    ];
    state = '__INIT__';
  } else {
    const reason = event.input;

    replies = [
      {
        type: 'text',
        content: {
          text: t`Reason you just input` + `:\n"${reason}"`,
        },
      },
      {
        type: 'text',
        content: {
          text: t`You're about to submit this article and your reason. If they are vague or improper, you may not be able to submit articles in the future.`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: t`Please confirm:`,
              buttons: [
                createPostbackAction(t`Submit`, 'y'),
                createPostbackAction(t`Revise`, 'r'),
                createPostbackAction(t`Discard`, 'n'),
              ],
            },
          },
        },
      },
    ];
    data.reasonText = reason;
    state = 'ASKING_ARTICLE_SUBMISSION';
  }

  visitor.send();
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
